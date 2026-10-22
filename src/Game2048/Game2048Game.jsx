import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    SIZES,
    DEFAULT_SIZE_ID,
    getSize,
    DIR_LABELS,
    createTiles,
    spawnRandomTile,
    moveTiles,
    hasMoves,
    maxTileValue,
    findHint
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Game2048.css';

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

/* 开一局新的会话 */
const createSession = (sizeId) => {
    const conf = getSize(sizeId);
    return {
        size: conf.size,
        target: conf.target,
        tiles: createTiles(conf.size),
        score: 0,
        moves: 0,
        log: []
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    totalMoves: 0,
    bestScore: { small: null, classic: null, large: null },
    maxTile: { small: null, classic: null, large: null }
};

const PAD_KEYS = [
    { dir: 'up', glyph: '↑', label: '向上滑动' },
    { dir: 'left', glyph: '←', label: '向左滑动' },
    { dir: 'down', glyph: '↓', label: '向下滑动' },
    { dir: 'right', glyph: '→', label: '向右滑动' }
];

const FAQ_ITEMS = [
    {
        q: '2048 到底怎么玩？',
        a: '用方向键、WASD、屏幕上的方向按钮，或者直接在棋盘上滑动，整盘方块会朝那个方向一起滑动。两个数值相同的方块撞在一起会合并成一个两倍大小的新方块，每次有效滑动之后，空格里会随机出现一个 2 或 4。'
    },
    {
        q: '为什么有时候滑动没有反应？',
        a: '如果该方向上所有方块都已经贴边、且没有可以合并的同值方块，这一下就不算有效移动：棋盘不会变化，也不会落新方块，更不会增加步数。换一个方向通常就能继续。'
    },
    {
        q: '三种棋盘有什么区别？',
        a: '3×3 是轻快模式，凑出 256 即可达成；4×4 是经典模式，目标 2048；5×5 空间更开阔，目标 4096。尺寸越大，容错越高，但对整体布局的要求也越高。'
    },
    {
        q: '分数是怎么计算的？',
        a: '每合并出一个新方块，就把它合并后的数值加进总分。例如两个 8 合成 16，就得 16 分。因此想拿高分，既要不断合并，也要让大数持续翻倍。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎给出的建议方向。它会模拟四个方向的结果，从空格数量、可合并对数、排列平滑度和大数位置等角度综合打分，用金色虚线箭头标出更优的一步。'
    },
    {
        q: '成绩会保存下来吗？',
        a: '会。最高分、最大方块与完成局数都会保存在浏览器本地，并按棋盘尺寸分别记录。随时回来刷新自己的纪录即可。'
    }
];

const RULES = [
    {
        step: '01',
        title: '整盘滑动',
        desc: '方向键、WASD、屏幕方向按钮或直接在棋盘上滑，所有方块都会朝同一个方向移动，直到贴边或撞上别的方块。'
    },
    {
        step: '02',
        title: '同数合并',
        desc: '两个数值相同的方块相撞时会合成一个两倍数值的新方块，合并所得直接计入分数。'
    },
    {
        step: '03',
        title: '随机落子',
        desc: '每次有效滑动后，空格中会随机出现一个 2 或 4。无效滑动不会落子，也不会增加步数。'
    },
    {
        step: '04',
        title: '冲击目标',
        desc: '3×3 达成 256、4×4 达成 2048、5×5 达成 4096 即可通关；达成之后还能继续挑战更高分。'
    }
];

const TIPS = [
    { title: '大数压角', desc: '把最大的方块固定在一个角落，并且不要轻易移动它所在的这一行，整盘才有稳定的根基。' },
    { title: '保持单调', desc: '让同一行或同一列的数字沿着一个方向递增，避免大数被小数夹在中间，腾挪空间会大很多。' },
    { title: '只用两三个方向', desc: '例如主要用左、下、右，尽量减少向上滑动，盘面会自然维持一种「蛇形」的秩序。' },
    { title: '给大数留退路', desc: '不要急着把棋盘塞满，保留至少一行或一列的活动空间，关键时刻才有周转余地。' },
    { title: '合并前看一眼落点', desc: '同样能合并时，优先选择能让新方块留在角落或大数一侧的方向，而不是把它推向棋盘中央。' },
    { title: '卡住就按提示', desc: '确实看不出方向时点一次「提示」，观察引擎推荐的方向，往往能发现被自己忽略的活动空间。' }
];

const FEATURES = [
    { title: '三档棋盘尺寸', desc: '3×3 轻快、4×4 经典、5×5 开阔，目标分别为 256、2048 与 4096，随时切换难度。' },
    { title: '四种操作方式', desc: '方向键、WASD、屏幕方向按钮与触屏滑动全部支持，桌面与手机都能顺手操作。' },
    { title: '智能提示引擎', desc: '一键模拟四个方向，用金色虚线箭头标出综合评分更高的走法，卡住时也能继续。' },
    { title: '支持逐步撤销', desc: '走错一步不必重开，撤销会连同分数与步数一起回退，随时回到上一步重新布局。' },
    { title: '完整的战绩记录', desc: '最高分、最大方块与完成局数按棋盘分别保存，每一次突破都会被记住。' },
    { title: '细腻的动效反馈', desc: '滑动位移、合并弹跳、新方块浮现与音效反馈，让每一次合并都清晰可感。' }
];

function Game2048Game() {
    const [sizeId, setSizeId] = useState(DEFAULT_SIZE_ID);
    const [timeline, setTimeline] = useState(() => [createSession(DEFAULT_SIZE_ID)]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hintDir, setHintDir] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [resultKind, setResultKind] = useState('win');

    const [record, setRecord] = useState(() => safeGet('g2048.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('g2048.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);
    const targetRef = useRef(false);

    const state = timeline[timeline.length - 1];
    const { tiles, score, moves, log } = state;

    /* 最新盘面的镜像：连续按键时以它为准，避免闭包过期 */
    const stateRef = useRef(state);
    useLayoutEffect(() => {
        stateRef.current = state;
    }, [state]);

    const conf = getSize(sizeId);
    const { size, target } = conf;

    const maxTile = useMemo(() => maxTileValue(tiles), [tiles]);
    const progress = Math.min(
        100,
        Math.max(0, Math.round((Math.log2(Math.max(maxTile, 2)) / Math.log2(target)) * 100))
    );

    const bestScore = record.bestScore?.[sizeId] ?? null;
    const bestTile = record.maxTile?.[sizeId] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('g2048.record', record), [record]);
    useEffect(() => safeSet('g2048.sound', soundOn), [soundOn]);
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

    /* 写入战绩：countGame 表示是否把这一局计入完成局数 */
    const commitRecord = useCallback(
        (countGame, finalScore, finalMoves) => {
            const peak = maxTileValue(stateRef.current.tiles);
            setRecord((prev) => {
                const bestScoreMap = { ...(prev.bestScore ?? {}) };
                const maxTileMap = { ...(prev.maxTile ?? {}) };

                if (bestScoreMap[sizeId] == null || finalScore > bestScoreMap[sizeId]) {
                    bestScoreMap[sizeId] = finalScore;
                }
                if (maxTileMap[sizeId] == null || peak > maxTileMap[sizeId]) {
                    maxTileMap[sizeId] = peak;
                }

                return {
                    games: (prev.games ?? 0) + (countGame ? 1 : 0),
                    totalTime: (prev.totalTime ?? 0) + (countGame ? elapsed : 0),
                    totalMoves: (prev.totalMoves ?? 0) + (countGame ? finalMoves : 0),
                    bestScore: bestScoreMap,
                    maxTile: maxTileMap
                };
            });
        },
        [sizeId, elapsed]
    );

    /* 开始新的一局 */
    const startNewGame = useCallback(
        (nextId) => {
            const id = nextId ?? sizeId;
            const session = createSession(id);
            stateRef.current = session;
            recordedRef.current = false;
            targetRef.current = false;

            setSizeId(id);
            setTimeline([session]);
            setPhase('playing');
            setElapsed(0);
            setToast('');
            setHintDir(null);
            setShowResult(false);
            setResultKind('win');
            sound.click();
        },
        [sizeId]
    );

    /* 提交一份新的快照 */
    const commit = useCallback((next) => {
        stateRef.current = next;
        setTimeline((prev) => [...prev, next]);
    }, []);

    /* 滑动一步 */
    const handleMove = useCallback(
        (dir) => {
            if (phase !== 'playing') return;

            const current = stateRef.current;
            const currentConf = getSize(sizeId);
            const result = moveTiles(current.tiles, currentConf.size, dir);

            if (!result.moved) {
                showToast('这个方向滑不动，换一个试试');
                sound.click();
                return;
            }

            const spawned = spawnRandomTile(result.tiles, currentConf.size);
            const nextScore = current.score + result.gained;
            const nextMoves = current.moves + 1;

            commit({
                size: currentConf.size,
                target: currentConf.target,
                tiles: spawned.tiles,
                score: nextScore,
                moves: nextMoves,
                log: [
                    ...current.log,
                    {
                        label: DIR_LABELS[dir],
                        text: result.gained > 0 ? `+${result.gained}` : '移动',
                        tone: result.gained > 0 ? 'merge' : 'move'
                    }
                ]
            });

            setHintDir(null);

            if (result.gained > 0) {
                sound.flip(result.mergeCount);
                showToast(`合并 ${result.mergeCount} 次 · +${result.gained}`);
            } else {
                sound.place();
            }

            const peak = maxTileValue(spawned.tiles);
            const counted = !recordedRef.current;

            /* 达成目标：弹出通关结算，可继续挑战 */
            if (peak >= currentConf.target && !targetRef.current) {
                targetRef.current = true;
                recordedRef.current = true;
                setPhase('won');
                setResultKind('win');
                setShowResult(true);
                sound.win();
                commitRecord(counted, nextScore, nextMoves);
                return;
            }

            /* 无路可走：本局结束 */
            if (!hasMoves(spawned.tiles, currentConf.size)) {
                recordedRef.current = true;
                setPhase('over');
                setResultKind('over');
                setShowResult(true);
                sound.lose();
                commitRecord(counted, nextScore, nextMoves);
            }
        },
        [phase, sizeId, commit, showToast, commitRecord]
    );

    /* 撤销上一步：分数、步数与盘面一起回退 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (timeline.length <= 1) return;
        const nextTimeline = timeline.slice(0, -1);
        stateRef.current = nextTimeline[nextTimeline.length - 1];
        setTimeline(nextTimeline);
        setPhase('playing');
        setHintDir(null);
        setShowResult(false);
        sound.click();
    }, [timeline]);

    /* 提示：给出综合评分更高的方向 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        const currentConf = getSize(sizeId);
        const dir = findHint(stateRef.current.tiles, currentConf.size);

        if (!dir) {
            showToast('已经没有可以移动的方向了');
            return;
        }

        setHintDir(dir);
        showToast(`引擎建议：${DIR_LABELS[dir]}`);
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHintDir(null), 4000);
    }, [phase, sizeId, showToast]);

    /* 通关后继续挑战：若棋盘恰好已经无路可走，直接给出结束结算 */
    const handleContinue = useCallback(() => {
        setShowResult(false);
        const currentConf = getSize(sizeId);
        if (!hasMoves(stateRef.current.tiles, currentConf.size)) {
            setPhase('over');
            setResultKind('over');
            setShowResult(true);
            return;
        }
        setPhase('playing');
        sound.click();
    }, [sizeId]);

    /* 键盘：方向键与 WASD */
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
            handleMove(dir);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleMove]);

    const statusText = () => {
        if (phase === 'won') return `已达成 ${target}，还可以继续冲更高分`;
        if (phase === 'over') return '本局结束，棋盘上没有可移动的方向';
        if (hintDir) return `引擎建议：${DIR_LABELS[hintDir]}`;
        return `当前最大方块 ${maxTile} · 目标 ${target}`;
    };

    return (
        <div className="g2048-page">
            <GameNav />
            <BackBar title="2048" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">数字合并 · 2048</div>
                    <h1 className="gp-hero__title">
                        2048 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        朝着一个方向轻轻一滑，相同的数字相撞就会合并、翻倍。
                        从两个小小的 2 开始，一步步把大数推向角落，
                        直到棋盘上出现那个梦寐以求的数字——2048。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">三档棋盘</span>
                        <span className="ui-tag">键盘 / 滑动</span>
                        <span className="ui-tag">撤销回退</span>
                        <span className="ui-tag ui-tag--gold">智能提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span className="gp-turnbar__dot" data-player="yellow" />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            tiles={tiles}
                            size={size}
                            hintDir={hintDir}
                            interactive={phase === 'playing'}
                            onMove={handleMove}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">分数</span>
                                <strong>{score}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">最高分</span>
                                <strong>{Math.max(score, bestScore ?? 0)}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">最大方块</span>
                                <strong>{maxTile}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>方向键、WASD 或在棋盘上滑动</span>
                            <span>相同数字相撞即合并，合并值计入分数</span>
                            <span>金色虚线箭头是引擎建议的方向</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">冲击目标</span>
                                <span className="gp-dash__lead">
                                    最大 {maxTile} / 目标 {target} · {progress}%
                                </span>
                            </div>
                            <div className="g2048-progress">
                                <span
                                    className="g2048-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前棋盘</span>
                                    <strong>{conf.label}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>当前分数</span>
                                    <strong>{score}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>最大方块</span>
                                    <strong>{maxTile}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>目标方块</span>
                                    <strong>{target}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>大数压角</b> 别轻易动它所在的行
                                </span>
                                <span className="gp-dash__tip">
                                    <b>保持单调</b> 让数字沿一个方向递增
                                </span>
                                <span className="gp-dash__tip">
                                    <b>留一行活口</b> 关键时刻有腾挪空间
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">棋盘设置</h2>
                            <div className="ui-seg g2048-sizes">
                                {SIZES.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            sizeId === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            if (item.id === sizeId) return;
                                            startNewGame(item.id);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="g2048-note">{conf.desc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                方向控制
                                <span className="gp-card__count">{DIR_LABELS[hintDir] ?? '可选'}</span>
                            </h2>
                            <div className="g2048-pad">
                                {PAD_KEYS.map((key) => (
                                    <button
                                        key={key.dir}
                                        className={`g2048-pad__key is-${key.dir}${
                                            hintDir === key.dir ? ' is-hint' : ''
                                        }`}
                                        onClick={() => handleMove(key.dir)}
                                        disabled={phase !== 'playing'}
                                        aria-label={key.label}
                                    >
                                        {key.glyph}
                                    </button>
                                ))}
                                <span className="g2048-pad__center" aria-hidden="true">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </span>
                            </div>
                            <p className="g2048-note">
                                也可以直接用方向键或 WASD，手机端则可以在棋盘上滑动。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startNewGame(sizeId)}
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
                                    <strong>{bestScore != null ? bestScore : '—'}</strong>
                                    <span>{conf.label}最高分</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{bestTile != null ? bestTile : '—'}</strong>
                                    <span>最大方块</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{record.games}</strong>
                                    <span>完成局数</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最高分与最大方块按当前棋盘分别记录
                                {avgTime ? ` · 平均用时 ${formatTime(avgTime)}` : ''}
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始滑动后，每一步都会记录在这里。</p>
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
                                                    className={`g2048-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于 2048</div>
                            <h2 className="ui-section-title">
                                一个数字，
                                <span className="ui-grad-text">无限次翻倍</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                2048 诞生于 2014 年，规则简单到一句话就能讲完：
                                滑动、合并、翻倍。
                                但正是这种极简的机制，让它在很短的时间里传遍全世界，
                                成为无数人手机里那个「再来一局就睡」的存在。
                            </p>
                            <p>
                                它的魅力在于秩序与随机并存。
                                每一次落子都是随机的，但盘面的走向始终掌握在你手里：
                                大数放在哪里、留哪一行做通道、什么时候合并，
                                每一个选择都会在十几步之后显出后果。
                                当 2048 终于在角落里合成出来的那一刻，
                                所有克制的等待都变得值得。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步玩懂 2048</h2>
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
                    <div className="ui-eyebrow">进阶技巧</div>
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
                            <h2 className="ui-section-title">为合并手感打磨的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只把 2048 搬到浏览器里，而是把滑动、撤销、提示与战绩
                            都做成顺手的能力，让你把注意力全部留给盘面本身。
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
                        <h2 className="gp-cta__title">准备好把数字翻倍了吗？</h2>
                        <p className="gp-cta__desc">
                            从一个 2 开始，用一次次合并把整盘数字推向那个目标。
                            无论是三分钟的热身，还是半小时的精心布局，2048 都值得一试。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                startNewGame(sizeId);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="game-2048" />

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
                                <li>2048</li>
                                <li>数字华容道</li>
                                <li>数独</li>
                                <li>扫雷</li>
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
                    <div className={`gp-modal__card ${resultKind === 'win' ? 'is-win' : 'is-draw'}`}>
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">
                            {resultKind === 'win' ? `达成 ${target}！` : '本局结束'}
                        </h3>
                        <p className="gp-modal__sub">
                            {resultKind === 'win'
                                ? `你用 ${moves} 步、${formatTime(elapsed)} 在「${conf.label}」棋盘上凑出了 ${target}。`
                                : `棋盘已经滑不动了，这局你走了 ${moves} 步，用时 ${formatTime(elapsed)}。`}
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">得分</span>
                                <strong>{score}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">最大方块</span>
                                <strong>{maxTile}</strong>
                            </div>
                        </div>
                        <div className="gp-modal__actions">
                            {resultKind === 'win' ? (
                                <>
                                    <button
                                        className="ui-btn ui-btn--primary"
                                        onClick={handleContinue}
                                    >
                                        继续挑战
                                    </button>
                                    <button
                                        className="ui-btn ui-btn--ghost"
                                        onClick={() => startNewGame(sizeId)}
                                    >
                                        再来一局
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="ui-btn ui-btn--primary"
                                        onClick={() => startNewGame(sizeId)}
                                    >
                                        再来一局
                                    </button>
                                    <button
                                        className="ui-btn ui-btn--ghost"
                                        onClick={handleUndo}
                                        disabled={!canUndo}
                                    >
                                        撤销一步
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Game2048Game;
