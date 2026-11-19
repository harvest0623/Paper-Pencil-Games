import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    DIFFICULTIES,
    PEG_LABELS,
    PEG_NAMES,
    TARGET_PEG,
    createSession,
    canMove,
    moveDisk,
    isSolved,
    countOnTarget,
    findHint,
    topDisk,
    moveLabel
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './TowerOfHanoi.css';

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

const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: {
        easy: { moves: null, time: null },
        medium: { moves: null, time: null },
        hard: { moves: null, time: null }
    }
};

const FAQ_ITEMS = [
    {
        q: '汉诺塔怎么玩？',
        a: '棋盘上有 A、B、C 三根柱子，所有圆盘一开始按小到大叠在 A 柱。每次只能移动一根柱子最上面的圆盘，大盘不能压在小盘上，把所有圆盘按同样的顺序叠到 C 柱就通关了。'
    },
    {
        q: '最少步数为什么是 2^n-1？',
        a: '想把 n 个圆盘搬到目标柱，必须先把上面 n-1 个圆盘搬到辅助柱，再搬最大的一个，最后把 n-1 个圆盘搬回目标柱，所以步数满足 T(n)=2T(n-1)+1，解得 T(n)=2^n-1。3 盘是 7 步，4 盘 15 步，5 盘 31 步。'
    },
    {
        q: '为什么大盘不能压在小盘上？',
        a: '这是汉诺塔的核心限制。它让圆盘始终按小到大的顺序堆叠，塔形不会崩塌，也让每一步的选择都被前一步约束。如果允许大盘压小盘，游戏会退化成随意搬动，失去推理的乐趣。'
    },
    {
        q: '提示会直接帮我移动吗？',
        a: '不会。点击「提示」后，引擎会用广度优先搜索算出当前局面的最优下一步，并用金色虚线标记起点柱和终点柱，还会提示要移动几号盘。圆盘仍由你自己点击搬动。'
    },
    {
        q: '三个难度有什么区别？',
        a: '入门 3 个圆盘，最少 7 步；进阶 4 个圆盘，最少 15 步；挑战 5 个圆盘，最少 31 步。盘数每加一个，最短路线就翻倍再加一，规划深度也随之增加。'
    },
    {
        q: '可以撤销到开局前吗？',
        a: '可以。每一次合法移动都会被记录，「撤销」会退回上一步，一直退到开局状态都可以。非法移动不会被记录，也不会占用撤销次数。'
    },
    {
        q: '键盘能操作吗？',
        a: '可以。按 1、2、3 分别对应 A、B、C 柱，效果与点击柱子相同；按 Esc 可以取消当前选中的圆盘。'
    }
];

const RULES = [
    {
        step: '01',
        title: '一次只搬一个盘',
        desc: '每一步只能移动一个圆盘，拿起和放下都只针对某一根柱子最上面的那个盘。'
    },
    {
        step: '02',
        title: '只能移动塔顶',
        desc: '被压在下面的圆盘不能直接抽出，必须先把上面的圆盘全部搬走，才能动它。'
    },
    {
        step: '03',
        title: '大盘不压小盘',
        desc: '任何圆盘都不能放到比它更小的圆盘上；目标柱为空时，任何圆盘都可以放。'
    },
    {
        step: '04',
        title: '整座塔搬到 C 柱',
        desc: '当所有圆盘按从小到大的顺序完整叠在 C 柱上时，本局完成。'
    }
];

const TIPS = [
    {
        title: '把问题拆成递归',
        desc: '想把 n 个盘从 A 搬到 C：先把上面 n-1 个盘搬到辅助柱 B，再把最大的盘搬到 C，最后把 n-1 个盘从 B 搬到 C。'
    },
    {
        title: '最小盘先走哪边',
        desc: 'n 为奇数时，第一步把 1 号盘搬到目标 C 柱；n 为偶数时，第一步搬到辅助 B 柱。本页 3 盘先到 C、4 盘先到 B、5 盘先到 C。'
    },
    {
        title: '每一步只盯塔顶',
        desc: '不用在脑内记住整座塔，只看三根柱子最上面的圆盘：能放就放，放不下就换一根柱子。'
    },
    {
        title: '别堵住辅助柱',
        desc: '搬 n-1 个盘时辅助柱会被占满，所以最大的盘要尽早送进目标柱，否则它会把后面的路线全部挡住。'
    },
    {
        title: '记住步数公式',
        desc: 'n 个盘最少 2^n-1 步：3 盘 7 步、4 盘 15 步、5 盘 31 步。步数低于这个数字是不可能完成的，可以据此判断自己是否走了弯路。'
    },
    {
        title: '用撤销复盘',
        desc: '卡住时退回一步，观察刚才哪一步把大盘放错了位置。复盘一步比重新开始整局更省时间，也更容易看清递归的结构。'
    }
];

const FEATURES = [
    {
        title: '三档盘数',
        desc: '3、4、5 个圆盘逐级加难，最少步数从 7 步到 31 步，随时都能找到合适的挑战。'
    },
    {
        title: '逐柱点选',
        desc: '点柱子选中塔顶，再点另一根柱子放下；非法移动会立即被拒绝并给出原因。'
    },
    {
        title: '最优提示',
        desc: '卡住时用广度优先搜索算出最优下一步，金色标记起点与终点，不替你动手。'
    },
    {
        title: '撤销与计时',
        desc: '每一步都可以撤销到开局，全程计时，让你放心尝试不同的搬运顺序。'
    },
    {
        title: '完整操作记录',
        desc: '每一次搬运都记录为「A → C」与圆盘编号，随时回看自己的路线。'
    },
    {
        title: '最佳战绩',
        desc: '自动保存完成局数与各难度的最佳步数、最佳用时，见证自己的递归直觉。'
    }
];

function TowerOfHanoiGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [selected, setSelected] = useState(null);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [invalidMoves, setInvalidMoves] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('hanoi.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('hanoi.sound', true));

    const timelineRef = useRef(timeline);
    const selectedRef = useRef(null);
    const toastTimer = useRef(null);
    const lastTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { pegs, log } = state;

    const moves = log.length;
    const onTarget = countOnTarget(pegs);
    const progress = Math.round((onTarget / session.disks) * 100);

    const difficultyItem =
        DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[0];
    const difficultyLabel = difficultyItem.label;
    const bestMoves = record.best?.[difficulty]?.moves ?? null;
    const bestTime = record.best?.[difficulty]?.time ?? null;
    const optimal = phase === 'over' && moves === session.minimum;

    useEffect(() => {
        timelineRef.current = timeline;
    }, [timeline]);

    useEffect(() => safeSet('hanoi.record', record), [record]);
    useEffect(() => safeSet('hanoi.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing') return undefined;
        const id = setInterval(() => setElapsed((value) => value + 1), 1000);
        return () => clearInterval(id);
    }, [phase]);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
            if (lastTimer.current) clearTimeout(lastTimer.current);
        },
        []
    );

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 2100);
    }, []);

    /* 选中态同时写入 ref，保证连续快速点击不会读到旧状态 */
    const selectPeg = useCallback((value) => {
        selectedRef.current = value;
        setSelected(value);
    }, []);

    /* 开始新的一局 */
    const startNewGame = useCallback(
        (difficultyId) => {
            const next = createSession(difficultyId ?? 'easy');
            recordedRef.current = false;
            if (lastTimer.current) clearTimeout(lastTimer.current);
            timelineRef.current = [next.initial];
            setDifficulty(next.config.id);
            setSession(next);
            setTimeline([next.initial]);
            selectPeg(null);
            setPhase('playing');
            setElapsed(0);
            setInvalidMoves(0);
            setHintsUsed(0);
            setToast('');
            setHint(null);
            setLastMove(null);
            setShowResult(false);
        },
        [selectPeg]
    );

    /* 完成一局 */
    const finishGame = useCallback(
        (finalMoves) => {
            if (recordedRef.current) return;
            recordedRef.current = true;
            setPhase('over');
            setShowResult(true);
            sound.win();
            setRecord((prev) => {
                const best = { ...(prev.best ?? {}) };
                const current = best[difficulty] ?? { moves: null, time: null };
                best[difficulty] = {
                    moves:
                        current.moves == null
                            ? finalMoves
                            : Math.min(current.moves, finalMoves),
                    time:
                        current.time == null
                            ? elapsed
                            : Math.min(current.time, elapsed)
                };
                return {
                    games: (prev.games ?? 0) + 1,
                    totalTime: (prev.totalTime ?? 0) + elapsed,
                    best
                };
            });
        },
        [difficulty, elapsed]
    );

    /* 点击柱子：先选中塔顶，再点另一根柱子放下 */
    const handlePegClick = useCallback(
        (index) => {
            if (phase !== 'playing') return;

            const current = timelineRef.current;
            const latest = current[current.length - 1];
            const currentPegs = latest.pegs;
            const active = selectedRef.current;

            if (active === null) {
                if (!topDisk(currentPegs, index)) {
                    showToast(`${PEG_NAMES[index]}上没有圆盘`);
                    return;
                }
                selectPeg(index);
                sound.click();
                return;
            }

            if (active === index) {
                selectPeg(null);
                sound.click();
                return;
            }

            if (!canMove(currentPegs, active, index)) {
                setInvalidMoves((value) => value + 1);
                showToast(
                    `不能把 ${topDisk(currentPegs, active)} 号盘放在 ${topDisk(
                        currentPegs,
                        index
                    )} 号盘上`
                );
                return;
            }

            const disk = topDisk(currentPegs, active);
            const nextPegs = moveDisk(currentPegs, active, index);
            const entry = {
                label: moveLabel(active, index),
                text: `${disk} 号盘`,
                tone: 'move'
            };
            const nextState = {
                pegs: nextPegs,
                log: [...latest.log, entry]
            };
            const nextTimeline = [...current, nextState];
            timelineRef.current = nextTimeline;
            setTimeline(nextTimeline);
            selectPeg(null);
            setHint(null);
            setLastMove({ from: active, to: index, disk });
            if (lastTimer.current) clearTimeout(lastTimer.current);
            lastTimer.current = setTimeout(() => setLastMove(null), 700);
            sound.place();

            if (isSolved(nextPegs, session.disks)) {
                finishGame(nextState.log.length);
            }
        },
        [phase, session.disks, showToast, finishGame, selectPeg]
    );

    /* 撤销 */
    const canUndo = timeline.length > 1 && phase === 'playing';
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        const history = timelineRef.current;
        if (history.length <= 1) return;
        const next = history.slice(0, -1);
        timelineRef.current = next;
        setTimeline(next);
        selectPeg(null);
        setHint(null);
        sound.click();
    }, [canUndo, selectPeg]);

    /* 提示：BFS 求最优下一步，标记会保留到下一次搬运 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        const suggestion = findHint(session, pegs);
        if (!suggestion) {
            showToast('本局已经完成，没有可提示的走法');
            return;
        }
        setHint(suggestion);
        setHintsUsed((value) => value + 1);
        showToast(
            `把 ${suggestion.disk} 号盘从 ${PEG_LABELS[suggestion.from]} 柱移到 ${
                PEG_LABELS[suggestion.to]
            } 柱`
        );
        sound.click();
    }, [phase, session, pegs, showToast]);

    /* 键盘：1 / 2 / 3 选柱，Esc 取消选中 */
    const pegClickRef = useRef(handlePegClick);
    useEffect(() => {
        pegClickRef.current = handlePegClick;
    }, [handlePegClick]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === 'Escape') {
                selectPeg(null);
                return;
            }
            if (event.key === '1' || event.key === '2' || event.key === '3') {
                event.preventDefault();
                pegClickRef.current?.(Number(event.key) - 1);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectPeg]);

    const statusText = () => {
        if (phase === 'over') return '恭喜完成，整座塔已经搬到 C 柱';
        return `目标：全部圆盘移到 ${PEG_LABELS[TARGET_PEG]} 柱 · 已移动 ${moves} 步`;
    };

    return (
        <div className="hanoi-page">
            <GameNav />
            <BackBar title="汉诺塔" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典益智 · Tower of Hanoi</div>
                    <h1 className="gp-hero__title">
                        汉诺塔 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        把整座塔从 A 柱搬到 C 柱，每次只能移动一个圆盘，而且大盘永远不能压在小盘上。
                        规则只有两句话，最少步数却藏着 2^n-1 的递归之美。
                        盘数越多，越能体会「先让路、再搬运」的思路。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">3 / 4 / 5 盘</span>
                        <span className="ui-tag">大盘不压小盘</span>
                        <span className="ui-tag">最少 2^n−1 步</span>
                        <span className="ui-tag ui-tag--gold">最优解提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span className="gp-turnbar__dot" data-player="x" />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            pegs={pegs}
                            disks={session.disks}
                            selected={selected}
                            hint={hint}
                            lastMove={lastMove}
                            done={phase === 'over'}
                            interactive={phase === 'playing'}
                            onPegClick={handlePegClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">圆盘</span>
                                <strong>{session.disks}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已移动</span>
                                <strong>{moves}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">最少步数</span>
                                <strong>{session.minimum}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击柱子选中塔顶圆盘</span>
                            <span>再点另一根柱子放下</span>
                            <span>大盘不能压在小盘上</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">搬运进度</span>
                                <span className="gp-dash__lead">
                                    C 柱已就位 {onTarget} / {session.disks} 个圆盘 ·{' '}
                                    {progress}%
                                </span>
                            </div>
                            <div className="hn-progress">
                                <span
                                    className="hn-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前难度</span>
                                    <strong>{difficultyLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>已用步数</span>
                                    <strong>{moves}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>提示次数</span>
                                    <strong>{hintsUsed}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>无效操作</span>
                                    <strong>{invalidMoves}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>先搬小盘</b> 为大盘让出位置
                                </span>
                                <span className="gp-dash__tip">
                                    <b>最少步数</b> 2^n−1，3 盘 7 步
                                </span>
                                <span className="gp-dash__tip">
                                    <b>递归拆解</b> 先搬 n−1 个到辅助柱
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg hn-diff">
                                {DIFFICULTIES.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            difficulty === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            if (item.id === difficulty) return;
                                            startNewGame(item.id);
                                            sound.click();
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="hn-diff__note">{difficultyItem.desc}</p>
                            <p className="hn-note">
                                单击一根柱子会选中它的塔顶圆盘，再单击另一根柱子即可放下；
                                按 1 / 2 / 3 也能直接选择 A / B / C 柱。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作
                                <span className="gp-card__count">
                                    已选 {selected !== null ? PEG_NAMES[selected] : '无'}
                                </span>
                            </h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startNewGame(difficulty)}
                                >
                                    重新开始
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
                                    <strong>{record.games}</strong>
                                    <span>完成局数</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>
                                        {bestMoves != null ? `${bestMoves} 步` : '—'}
                                    </strong>
                                    <span>{difficultyLabel}最佳步数</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>
                                        {bestTime != null ? formatTime(bestTime) : '—'}
                                    </strong>
                                    <span>{difficultyLabel}最佳用时</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最佳步数与最佳用时按难度分别记录，完成后自动更新
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{moves} 步</span>
                            </h2>
                            {moves === 0 ? (
                                <p className="gp-log__empty">
                                    开始搬运后，每一步移动都会记录在这里。
                                </p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => (
                                            <li
                                                key={`${entry.label}-${moves - index}`}
                                                className="gp-log__item"
                                            >
                                                <span className="gp-log__no">
                                                    {moves - index}
                                                </span>
                                                <span className="gp-log__label">
                                                    {entry.label}
                                                </span>
                                                <span
                                                    className={`hn-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于汉诺塔</div>
                            <h2 className="ui-section-title">
                                两句话的规则，
                                <span className="ui-grad-text">一座塔的递归</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                汉诺塔来自一个古老传说：寺庙里有三根柱子，僧侣要把一叠金盘从一根柱子搬到另一根，
                                每次只能移动一个盘，而且大盘不能压在小盘上。1883 年，法国数学家卢卡斯把这个传说
                                做成了流传至今的益智玩具。
                            </p>
                            <p>
                                传说中 64 个金盘最少需要 2^64−1 步，即使每秒搬一次也要数百亿年。
                                本页把盘数缩小到 3–5 个，但解题思路完全一致：先把上面的小盘搬开，
                                为大盘腾出位置，再把小盘叠回来。每一次成功的搬运，都是一次递归的落地。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂汉诺塔</h2>
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
                    <div className="ui-eyebrow">解题技巧</div>
                    <h2 className="ui-section-title">高手的六条心法</h2>
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
                            <h2 className="ui-section-title">为递归思考而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把汉诺塔搬到浏览器里，而是把最优提示、逐步撤销、计时和战绩
                            都做成顺手的能力，让你专注于每一次该搬哪个盘。
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
                        <h2 className="gp-cta__title">准备好把整座塔搬过去了吗？</h2>
                        <p className="gp-cta__desc">
                            从 3 个圆盘的 7 步开始，慢慢体会 2^n−1 的递归节奏。
                            现在就开始吧。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                startNewGame(difficulty);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="tower-of-hanoi" />

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
                                <li>数独</li>
                                <li>数桥</li>
                                <li>汉诺塔</li>
                                <li>五子棋</li>
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
                    <div
                        className="gp-modal__backdrop"
                        onClick={() => setShowResult(false)}
                    />
                    <div className="gp-modal__card is-win">
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">
                            {optimal ? '完美通关！' : '恭喜完成！'}
                        </h3>
                        <p className="gp-modal__sub">
                            你用 {moves} 步、{formatTime(elapsed)} 把 {session.disks}{' '}
                            个圆盘全部搬到了 C 柱。
                            {optimal
                                ? ` 正好等于理论最少步数 ${session.minimum} 步！`
                                : ` 理论最少只需 ${session.minimum} 步，再试一局？`}
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">提示</span>
                                <strong>{hintsUsed}</strong>
                            </div>
                        </div>
                        <div className="gp-modal__actions">
                            <button
                                className="ui-btn ui-btn--primary"
                                onClick={() => startNewGame(difficulty)}
                            >
                                再来一局
                            </button>
                            <button
                                className="ui-btn ui-btn--ghost"
                                onClick={() => setShowResult(false)}
                            >
                                查看棋盘
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TowerOfHanoiGame;
