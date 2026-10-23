import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    LEVELS,
    TIERS,
    getTier,
    getLevel,
    getLevelsByTier,
    getNextLevel,
    getParsedLevel,
    createInitialState,
    tryMove,
    isSolved,
    countOnGoal,
    findHint,
    DIR_LABELS
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Sokoban.css';

/* ---------------- 本地持久化 ---------------- */
const safeGet = (key, fallback) => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const safeSet = (key, value) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* ignore */
    }
};

/* 秒数格式化为 mm:ss */
const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    cleared: [],
    best: { easy: null, medium: null, hard: null },
    fewest: { easy: null, medium: null, hard: null }
};

const FAQ_ITEMS = [
    {
        q: '推箱子的规则是什么？',
        a: '你控制一名搬运工，每次只能朝上下左右走一格。如果正前方是箱子，且箱子后面是空的，就可以把箱子往前推一格；箱子后面是墙或者另一个箱子时，就推不动。把所有箱子都推到金色目标点上，这一关就完成了。'
    },
    {
        q: '箱子被推到墙角推不出来了怎么办？',
        a: '点一次「撤销」回到上一步即可。推箱子最经典的失误就是把箱子推进非目标点的死角，一旦推死就再也无法挽救，只能重开。所以每推一步之前，先看看箱子后面还有没有退路。'
    },
    {
        q: '为什么箱子推不动？',
        a: '两个原因：箱子后面是墙，或者箱子后面还挡着另一个箱子。此时界面会提示「前方被挡住了」，这一次操作不计步数。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎给出的下一步。它会用 A* 搜索从当前局面出发的最短推动路线，用金色虚线框标出你这一步应该走到的位置，并附上方向箭头。'
    },
    {
        q: '步数和推动次数有什么区别？',
        a: '每走一格都算一步，但只有真正推动箱子时才计一次「推动」。箱子数量固定的关卡里，推动次数更能反映解法是否精简，因此战绩会单独记录最少步数。'
    },
    {
        q: '关卡难度是怎么划分的？',
        a: '入门、进阶、挑战各四关，共十二关。入门以单箱和双箱为主，路线宽松；进阶箱子增多、需要安排先后顺序；挑战则加入走廊与分室，走错一步就可能把箱子推死。'
    }
];

const RULES = [
    {
        step: '01',
        title: '走到箱子后方',
        desc: '推动箱子之前，你必须先绕到它的另一侧，站在与目标方向相反的位置上。'
    },
    {
        step: '02',
        title: '一格格推动',
        desc: '每次只能推一格，而且箱子后面必须是空地。若后面是墙或另一个箱子，就推不动。'
    },
    {
        step: '03',
        title: '别把箱子推死',
        desc: '非目标点的墙角是箱子的坟墓，一旦推进去就无法再拉出来，随时用撤销挽救。'
    },
    {
        step: '04',
        title: '全部归位',
        desc: '当所有箱子都落在金色目标点上，关卡即告完成；挑战下一关或刷新最少步数。'
    }
];

const TIPS = [
    { title: '先看终点再动手', desc: '开局先通读地图，判断每个箱子最终要从哪个方向进入目标点，避免第一推就把路线堵死。' },
    { title: '优先处理死角箱子', desc: '越靠近墙角或窄道的箱子越难腾挪，先把它们安排到目标点，剩下的空间会宽松很多。' },
    { title: '想好先后顺序', desc: '多个箱子会互相挡路，先推哪一个、把哪个暂时当障碍，往往决定整关能不能解开。' },
    { title: '给箱子留后路', desc: '推之前确认箱子背后有足够的空位，尤其是贴着墙推的时候，一格格推进死角就很难回头。' },
    { title: '绕远路也是近路', desc: '为了站到正确的推动位置，多走几步没关系，步数只计一次通关，解不开才是最贵的成本。' },
    { title: '卡住就用撤销', desc: '推箱子几乎没有「将就」的余地，发现路线不对就撤回到关键决策点，比硬推十步更高效。' }
];

const FEATURES = [
    { title: '十二道手工关卡', desc: '入门、进阶、挑战各四关，从单箱教学到双室五箱，难度曲线经过逐关验证。' },
    { title: 'A* 智能求解提示', desc: '提示不是简单的方向猜测，而是实时搜索最短推动路线，用金色虚框标出真正的下一步。' },
    { title: '完整撤销回退', desc: '每一次移动都留有快照，连同步数与推动次数一起回退，随时回到关键决策点。' },
    { title: '键盘与触屏双操作', desc: '方向键、WASD 与棋盘滑动全部支持，桌面和手机都能顺手推箱。' },
    { title: '关卡进度记忆', desc: '通关记录保存在浏览器本地，已完成的关卡打勾标记，下次回来接着挑战。' },
    { title: '节奏与反馈打磨', desc: '推动、到位、通关都有对应的音效与动画反馈，每一步都清晰可感。' }
];

const pickLevelForTier = (tierId, cleared) => {
    const levels = getLevelsByTier(tierId);
    return levels.find((level) => !cleared.includes(level.id)) ?? levels[0];
};

function SokobanGame() {
    const [levelId, setLevelId] = useState(LEVELS[0].id);
    const [timeline, setTimeline] = useState(() => [
        createInitialState(getParsedLevel(LEVELS[0].id))
    ]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('sk.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('sk.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const parsed = getParsedLevel(levelId);
    const level = getLevel(levelId);
    const tier = getTier(level.tier);
    const tierLevels = getLevelsByTier(level.tier);

    const state = timeline[timeline.length - 1] ?? createInitialState(parsed);
    const { boxes, moves, pushes, log } = state;

    const totalBoxes = boxes.length;
    const onGoal = countOnGoal(state, parsed);
    const remaining = totalBoxes - onGoal;
    const progress = totalBoxes ? Math.round((onGoal / totalBoxes) * 100) : 0;

    const tierIndex = TIERS.findIndex((item) => item.id === tier.id);
    const levelIndex = tierLevels.findIndex((item) => item.id === levelId);
    const cleared = record.cleared ?? [];
    const clearedInTier = tierLevels.filter((item) => cleared.includes(item.id)).length;

    const bestTime = record.best?.[tier.id] ?? null;
    const fewestMoves = record.fewest?.[tier.id] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('sk.record', record), [record]);
    useEffect(() => safeSet('sk.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing') return;
        const id = setInterval(() => setElapsed((value) => value + 1), 1000);
        return () => clearInterval(id);
    }, [phase]);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
            if (hintTimer.current) clearTimeout(hintTimer.current);
        },
        []
    );

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 1800);
    }, []);

    /* 开始某一关 */
    const startLevel = useCallback((nextId) => {
        const nextParsed = getParsedLevel(nextId);
        const initial = createInitialState(nextParsed);
        recordedRef.current = false;

        setLevelId(nextId);
        setTimeline([initial]);
        setPhase('playing');
        setElapsed(0);
        setToast('');
        setHint(null);
        setShowResult(false);
    }, []);

    /* 完成一关：写入战绩 */
    const finishGame = useCallback(
        (finalMoves) => {
            if (recordedRef.current) return;
            recordedRef.current = true;
            setPhase('won');
            setShowResult(true);
            sound.win();

            setRecord((prev) => {
                const tierId = getLevel(levelId).tier;
                const best = { ...(prev.best ?? {}) };
                const fewest = { ...(prev.fewest ?? {}) };
                const prevBest = best[tierId];
                const prevFewest = fewest[tierId];
                if (prevBest == null || elapsed < prevBest) best[tierId] = elapsed;
                if (prevFewest == null || finalMoves < prevFewest) fewest[tierId] = finalMoves;

                const prevCleared = Array.isArray(prev.cleared) ? prev.cleared : [];
                return {
                    games: (prev.games ?? 0) + 1,
                    totalTime: (prev.totalTime ?? 0) + elapsed,
                    cleared: prevCleared.includes(levelId)
                        ? prevCleared
                        : [...prevCleared, levelId],
                    best,
                    fewest
                };
            });
        },
        [levelId, elapsed]
    );

    /* 移动一步 */
    const handleMove = (dir) => {
        if (phase !== 'playing') return;

        const currentParsed = getParsedLevel(levelId);
        const result = tryMove(state, currentParsed, dir);

        if (!result) {
            showToast('前方被挡住了');
            sound.click();
            return;
        }

        const next = {
            player: result.player,
            boxes: result.boxes,
            moves: state.moves + 1,
            pushes: state.pushes + (result.pushed ? 1 : 0),
            log: [
                ...state.log,
                {
                    label: DIR_LABELS[dir],
                    text: result.pushed ? '推动' : '移动',
                    tone: result.pushed ? 'push' : 'move'
                }
            ]
        };

        setTimeline((prev) => [...prev, next]);
        setHint(null);

        if (result.pushed) sound.flip(1);
        else sound.place();

        if (isSolved(next, currentParsed)) finishGame(next.moves);
    };

    /* 撤销上一步 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (timeline.length <= 1) return;
        setTimeline(timeline.slice(0, -1));
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        sound.click();
    }, [timeline]);

    /* 提示：A* 求最短推动路线，取下一步 */
    const handleHint = () => {
        if (phase !== 'playing') return;

        const next = findHint(getParsedLevel(levelId), state);
        if (!next) {
            showToast('暂时找不到更优走法，试试撤销');
            return;
        }

        setHint(next);
        showToast(`引擎建议：${DIR_LABELS[next.dir]}`);
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);
    };

    /* 切换难度：自动进入该难度第一个未通关的关卡 */
    const goToTier = (tierId) => {
        if (tierId === tier.id) return;
        startLevel(pickLevelForTier(tierId, cleared).id);
        sound.click();
    };

    /* 键盘：方向键与 WASD，监听只注册一次，通过 ref 取到最新的移动逻辑 */
    const moveRef = useRef(handleMove);
    useEffect(() => {
        moveRef.current = handleMove;
    });

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.target?.isContentEditable) return;

            const keys = {
                ArrowUp: 'up',
                ArrowDown: 'down',
                ArrowLeft: 'left',
                ArrowRight: 'right',
                w: 'up',
                s: 'down',
                a: 'left',
                d: 'right',
                W: 'up',
                S: 'down',
                A: 'left',
                D: 'right'
            };
            const dir = keys[event.key];
            if (!dir) return;

            event.preventDefault();
            moveRef.current?.(dir);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const nextLevel = getNextLevel(levelId);
    const levelNo = levelIndex + 1;

    const statusText = () => {
        if (phase === 'won') return '全部箱子已归位';
        if (hint) return `引擎建议：${DIR_LABELS[hint.dir]}`;
        return `还剩 ${remaining} 个箱子未归位`;
    };

    return (
        <div className="sk-page">
            <GameNav />
            <BackBar title="推箱子" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">仓库番 · Sokoban</div>
                    <h1 className="gp-hero__title">
                        推箱子 <span className="ui-grad-text">在线解谜</span>
                    </h1>
                    <p className="gp-hero__desc">
                        你只有一双手，箱子只能推、不能拉。
                        先绕到箱子背后，选对方向，再把它们一个个送上金色目标点。
                        规则一句话，解法却要步步为营。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">12 道关卡</span>
                        <span className="ui-tag">方向键 / 滑动</span>
                        <span className="ui-tag">撤销回退</span>
                        <span className="ui-tag ui-tag--gold">智能提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span className="gp-turnbar__dot" data-player="red" />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            parsed={parsed}
                            state={state}
                            hint={hint}
                            interactive={phase === 'playing'}
                            onMove={handleMove}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">箱子到位</span>
                                <strong>
                                    {onGoal} / {totalBoxes}
                                </strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">推动</span>
                                <strong>{pushes}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>方向键、WASD 或在棋盘上滑动</span>
                            <span>站到箱子背后，才能把它推向前方</span>
                            <span>金色虚框是引擎建议的下一步</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">归位进度</span>
                                <span className="gp-dash__lead">
                                    {onGoal} / {totalBoxes} 个箱子 · {progress}%
                                </span>
                            </div>
                            <div className="sk-progress">
                                <span
                                    className="sk-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前关卡</span>
                                    <strong>
                                        {tier.label} · {levelNo}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>参考推动</span>
                                    <strong>{level.par} 次</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>当前推动</span>
                                    <strong>{pushes} 次</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>剩余箱子</span>
                                    <strong>{remaining}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>先看终点</b> 想好箱子从哪进
                                </span>
                                <span className="gp-dash__tip">
                                    <b>别推进死角</b> 墙角无法挽回
                                </span>
                                <span className="gp-dash__tip">
                                    <b>撤销</b> 回到关键决策点
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                难度设置
                                <span className="gp-card__count">共 {LEVELS.length} 关</span>
                            </h2>
                            <div className="ui-seg sk-tiers">
                                {TIERS.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            tier.id === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => goToTier(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="sk-note">{tier.desc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                关卡选择
                                <span className="gp-card__count">
                                    已通关 {clearedInTier} / {tierLevels.length}
                                </span>
                            </h2>
                            <div className="sk-levels">
                                {tierLevels.map((item, index) => (
                                    <button
                                        key={item.id}
                                        className={`sk-level${
                                            item.id === levelId ? ' is-active' : ''
                                        }${cleared.includes(item.id) ? ' is-cleared' : ''}`}
                                        onClick={() => {
                                            if (item.id === levelId) return;
                                            startLevel(item.id);
                                            sound.click();
                                        }}
                                        title={item.name}
                                    >
                                        <span className="sk-level__no">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <span className="sk-level__name">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="sk-note">
                                当前为「{tier.label} {levelNo}」· {level.name}，参考推动{' '}
                                {level.par} 次。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startLevel(levelId)}
                                >
                                    重开本关
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleUndo}
                                    disabled={!canUndo}
                                >
                                    撤销
                                </button>
                                <button className="ui-btn ui-btn--ghost" onClick={handleHint}>
                                    提示
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost gp-sound-btn"
                                    onClick={() => setSoundOn((value) => !value)}
                                    aria-label={soundOn ? '关闭音效' : '开启音效'}
                                >
                                    {soundOn ? '🔊 音效' : '🔇 静音'}
                                </button>
                            </div>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">我的战绩</h2>
                            <div className="gp-record">
                                <div className="gp-record__item">
                                    <strong>
                                        {cleared.length} / {LEVELS.length}
                                    </strong>
                                    <span>已通关</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{bestTime != null ? formatTime(bestTime) : '—'}</strong>
                                    <span>{tier.label}最佳</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{fewestMoves != null ? fewestMoves : '—'}</strong>
                                    <span>最少步数</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最佳用时与最少步数按当前难度分别记录
                                {avgTime ? ` · 平均用时 ${formatTime(avgTime)}` : ''}
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始移动后，每一步都会记录在这里。</p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => (
                                            <li
                                                key={`${entry.label}-${log.length - index}`}
                                                className="gp-log__item"
                                            >
                                                <span className="gp-log__no">
                                                    {log.length - index}
                                                </span>
                                                <span className="gp-log__label">
                                                    {entry.label}
                                                </span>
                                                <span
                                                    className={`sk-log__text is-${entry.tone}`}
                                                >
                                                    {entry.text}
                                                </span>
                                            </li>
                                        ))}
                                </ol>
                            )}
                        </div>
                    </aside>
                </div>
            </section>

            <section className="ui-section gp-prose" id="about">
                <div className="ui-container">
                    <div className="gp-prose__grid">
                        <div>
                            <div className="ui-eyebrow">关于推箱子</div>
                            <h2 className="ui-section-title">
                                只能推，不能拉，
                                <span className="ui-grad-text">所以每一步都算数</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                推箱子（Sokoban）诞生于 1981 年的日本，原名「仓库番」，
                                最初只是仓库里搬运货物的一个小游戏。
                                它的规则简单到几句话就能讲清：
                                箱子只能推不能拉，推之前必须站到它背后。
                                但正是这条限制，让每一次推动都变得不可逆。
                            </p>
                            <p>
                                它因此常被称作「一步错、满盘输」的谜题。
                                你需要同时考虑箱子的最终归宿、自己的站位、以及箱子之间的相互阻挡，
                                在有限的走廊里为每一个箱子规划出唯一的入场方向。
                                当最后一个箱子咔哒一声落进目标点，那份秩序感正是它四十多年不衰的原因。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂推箱子</h2>
                    <div className="gp-steps">
                        {RULES.map((item) => (
                            <div key={item.step} className="gp-step">
                                <span className="gp-step__no">{item.step}</span>
                                <h3 className="gp-step__title">{item.title}</h3>
                                <p className="gp-step__desc">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section gp-tips" id="tips">
                <div className="ui-container">
                    <div className="ui-eyebrow">解谜技巧</div>
                    <h2 className="ui-section-title">少走弯路的六条经验</h2>
                    <div className="gp-tip-grid">
                        {TIPS.map((tip, index) => (
                            <div key={tip.title} className="gp-tip">
                                <span className="gp-tip__index">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <h3 className="gp-tip__title">{tip.title}</h3>
                                <p className="gp-tip__desc">{tip.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section gp-features">
                <div className="ui-container">
                    <div className="gp-features__head">
                        <div>
                            <div className="ui-eyebrow">为什么选择指尖弈局</div>
                            <h2 className="ui-section-title">为推演体验打磨的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们把求解、撤销、关卡记忆与移动端操作都做成顺手的能力，
                            让你可以把注意力全部放在箱子和路线上。
                        </p>
                    </div>
                    <div className="gp-feature-grid">
                        {FEATURES.map((feature) => (
                            <div key={feature.title} className="gp-feature">
                                <span className="gp-feature__check" aria-hidden="true" />
                                <div>
                                    <h3 className="gp-feature__title">{feature.title}</h3>
                                    <p className="gp-feature__desc">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section gp-faq" id="faq">
                <div className="ui-container gp-faq__inner">
                    <div className="gp-faq__head">
                        <div className="ui-eyebrow">常见问题</div>
                        <h2 className="ui-section-title">你可能想知道</h2>
                        <p className="ui-section-sub">
                            还有疑问？上面这些问题覆盖了绝大多数上手场景。
                        </p>
                    </div>
                    <Accordion items={FAQ_ITEMS} />
                </div>
            </section>

            <section className="gp-cta">
                <div className="ui-container">
                    <div className="gp-cta__card">
                        <h2 className="gp-cta__title">准备把箱子送到终点了吗？</h2>
                        <p className="gp-cta__desc">
                            从第一关的一个箱子开始，逐步走进走廊与双室谜题。
                            每一关都经过求解验证，保证有解，剩下的只是你的路线。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                startLevel(levelId);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="sokoban" />

            <footer className="ui-footer">
                <div className="ui-container">
                    <div className="ui-footer__grid">
                        <div>
                            <div className="ui-logo" style={{ marginBottom: 14 }}>
                                <span className="ui-logo__mark">弈</span>
                                指尖弈局
                            </div>
                            <p className="ui-footer__text">
                                现代化在线纸笔游戏平台，把经典对弈搬到你的指尖。
                            </p>
                        </div>
                        <div>
                            <h3 className="ui-footer__title">热门游戏</h3>
                            <ul className="ui-footer__list">
                                <li>推箱子</li>
                                <li>数字华容道</li>
                                <li>2048</li>
                                <li>数独</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="ui-footer__title">更多</h3>
                            <ul className="ui-footer__list">
                                <li>
                                    <a href="#rules">玩法规则</a>
                                </li>
                                <li>
                                    <a href="#faq">常见问题</a>
                                </li>
                                <li>
                                    <Link to="/home">全部游戏</Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="ui-footer__bottom">
                        <span>© 2026 指尖弈局 · 保留所有权利</span>
                        <span>用心做好每一局对弈</span>
                    </div>
                </div>
            </footer>

            {showResult && (
                <div className="gp-modal" role="dialog" aria-modal="true">
                    <div className="gp-modal__backdrop" onClick={() => setShowResult(false)} />
                    <div className="gp-modal__card is-win">
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">
                            {tier.label} {levelNo} · 完成！
                        </h3>
                        <p className="gp-modal__sub">
                            你用 {moves} 步、{pushes} 次推动、{formatTime(elapsed)} 完成了
                            「{level.name}」（{tierIndex + 1}/{TIERS.length} · {levelNo}/
                            {tierLevels.length}）。
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">推动</span>
                                <strong>{pushes}</strong>
                            </div>
                        </div>
                        <div className="gp-modal__actions">
                            {nextLevel ? (
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startLevel(nextLevel.id)}
                                >
                                    下一关
                                </button>
                            ) : (
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startLevel(LEVELS[0].id)}
                                >
                                    回到第一关
                                </button>
                            )}
                            <button
                                className="ui-btn ui-btn--ghost"
                                onClick={() => startLevel(levelId)}
                            >
                                再玩一次
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SokobanGame;
