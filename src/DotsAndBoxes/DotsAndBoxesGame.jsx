import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    P1,
    P2,
    createBoard,
    otherPlayer,
    applyMove as playEdge,
    countBoxes,
    countEmptyEdges,
    getWinner,
    edgeLabel
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './DotsAndBoxes.css';

const BLUE = P1; // 蓝方
const RED = P2; // 红方

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

const DIFFICULTY_OPTIONS = [
    { id: 'easy', label: '简单' },
    { id: 'medium', label: '中等' },
    { id: 'hard', label: '困难' }
];

const FAQ_ITEMS = [
    {
        q: '为什么围住方格后还能再画一条线？',
        a: '这正是点格棋最关键的规则：围住方格的一方获得额外的一次落线机会。所以棋盘上一旦出现「三边已成」的方格，往往意味着一整串格子都会被同一个人连吃下去。'
    },
    {
        q: '什么情况下会「送格」？',
        a: '当所有空线画下去都会让对手围住某个方格时，你就不得不送格。此时应当挑最短的那条链画出来，把损失压到最低——这正是点格棋最见功力的地方。'
    },
    {
        q: '点格棋有必胜策略吗？',
        a: '点格棋是少数被数学彻底吃透的棋类之一，可以用「链理论」算出最优解。不过对普通玩家而言，记住三条就够用：不留下第三条边、数清链条长度、把开链的难题留给对手。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑执蓝方落下第一条线。'
    },
    {
        q: '怎样修改玩家名字？',
        a: '直接点击比分板上的名字即可就地编辑，修改会保存在浏览器中，下次打开依然生效。'
    },
    {
        q: '悔棋会退回到哪一步？',
        a: '双人模式退回一步；人机对战会一直退回到你上一次落线之前，方便你换一个方案再试。'
    }
];

const RULES = [
    {
        step: '01',
        title: '点阵与方格',
        desc: '棋盘由 6 × 6 个点组成，相邻四点围出一个方格，共有 25 个待争夺的格子。双方轮流在相邻两点之间画一条线。'
    },
    {
        step: '02',
        title: '围住即占有',
        desc: '当一个方格的第四条边被画上，这个方格立刻归最后画线的一方所有，并在棋盘上留下自己的颜色。'
    },
    {
        step: '03',
        title: '连吃加一手',
        desc: '围住方格的一方能立刻再画一条线。所以只要出现「三边已成」的方格，就可能被顺着链条一口气连吃好几格。'
    },
    {
        step: '04',
        title: '多者为胜',
        desc: '当 60 条线全部画完，占领方格更多的一方获胜。25 个方格为奇数，所以本局一定分出胜负。'
    }
];

const TIPS = [
    { title: '别留下第三条边', desc: '任何时刻都要避免让对手画出第三条边，那等于把方格递到对方手里。宁可先画无关紧要的安全线。' },
    { title: '数清链条长度', desc: '被吃掉的格子数等于链条的长度。落笔前先顺着三边格数一数，你就知道这次送格到底要付出多少。' },
    { title: '送最窄的那条链', desc: '非得送格时，挑最短的链送给对手。送一格远比送五格划算，这一点往往直接决定胜负。' },
    { title: '能吃的立刻吃掉', desc: '棋盘上出现现成的方格时，先吃干净再考虑别的。吃格会奖励额外一手，白送的格子不吃就是浪费。' },
    { title: '少画孤立的一笔', desc: '随手画下与任何已有线都不相连的孤线，只会消耗掉你自己的安全着法，把送格的时机提前。' },
    { title: '长链留一手', desc: '吃长链时可以只吃到剩两格为止，然后把这「两格」丢给对手，让「必须开链」的难题重新回到他手上。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档随手落线，中等档懂得规避送格，困难档会在残局穷举搜索，算得既准又稳。' },
    { title: '连锁推算', desc: '引擎顺着链条推算每个方格最终归谁，帮你提前看清一次送格背后真实的代价。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落线，随时复盘每一手。' },
    { title: '站内提示引擎', desc: '卡住时一键取回引擎推荐的那条线，边下边体会链条与先手权的取舍。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一笔的坐标，以及这一手吃掉了几个方格。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，支持触屏与鼠标操作。' }
];

const INITIAL_STATE = (firstPlayer) => ({
    board: createBoard(),
    currentPlayer: firstPlayer,
    lastMove: null,
    log: []
});
function DotsAndBoxesGame() {
    const [mode, setMode] = useState('ai');
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);

    /* 时间线：每个元素都是完整的一步局面，悔棋只需回退一步 */
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE(BLUE)]);
    const [phase, setPhase] = useState('playing');
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('dnb.names', { p1: '玩家 1', p2: '玩家 2', blue: '玩家', red: '电脑' })
    );
    const [record, setRecord] = useState(() => safeGet('dnb.record', { win: 0, loss: 0, draw: 0 }));
    const [soundOn, setSoundOn] = useState(() => safeGet('dnb.sound', true));

    const toastTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastMove, log } = state;

    const scores = useMemo(
        () => ({ blue: countBoxes(board, BLUE), red: countBoxes(board, RED) }),
        [board]
    );
    const emptyCount = useMemo(() => countEmptyEdges(board), [board]);

    const aiPlayer = computerFirst ? BLUE : RED;
    const humanPlayer = computerFirst ? RED : BLUE;
    const thinking = phase === 'playing' && mode === 'ai' && currentPlayer === aiPlayer;
    const isHumanTurn = phase === 'playing' && !thinking && (mode === 'pvp' || currentPlayer === humanPlayer);

    /* ---------------- 音效 ---------------- */
    useEffect(() => {
        sound.setEnabled(soundOn);
        safeSet('dnb.sound', soundOn);
    }, [soundOn]);

    /* ---------------- 名字与战绩持久化 ---------------- */
    useEffect(() => {
        safeSet('dnb.names', names);
    }, [names]);

    useEffect(() => {
        safeSet('dnb.record', record);
    }, [record]);

    const playerName = useCallback(
        (player) => {
            if (mode === 'ai') {
                return player === humanPlayer ? names.blue : names.red;
            }
            return player === BLUE ? names.p1 : names.p2;
        },
        [mode, humanPlayer, names]
    );

    /* ---------------- 提示 ---------------- */
    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2000);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    /* ---------------- 计时：每落一步、每次重开都归零 ---------------- */
    useEffect(() => {
        if (phase !== 'playing') return undefined;
        const timer = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => window.clearInterval(timer);
    }, [phase, timeline]);

    /* ---------------- 落线 ---------------- */
    const place = useCallback(
        (edge) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;

            const res = playEdge(cur.board, edge, player);
            if (!res) return;

            const finished = countEmptyEdges(res.board) === 0;
            const nextState = {
                board: res.board,
                currentPlayer: finished ? null : res.extraTurn ? player : otherPlayer(player),
                lastMove: { edge, player, captured: res.captured },
                log: [...cur.log, { player, label: edgeLabel(edge), captured: res.captured.length }]
            };
            setTimeline((prev) => [...prev, nextState]);
            setHint(null);

            if (res.captured.length) sound.flip(res.captured.length);
            else sound.place();

            if (res.captured.length && (mode === 'pvp' || player === humanPlayer)) {
                showToast(`围住 ${res.captured.length} 个方格，可以继续落线`);
            }

            if (finished) {
                setPhase('over');
                setShowResult(true);
                const winner = getWinner(res.board);
                if (mode === 'ai') {
                    if (winner === humanPlayer) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else if (winner === 0) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                } else if (winner !== 0) {
                    sound.win();
                }
            }
        },
        [timeline, mode, humanPlayer, showToast]
    );

    /* ---------------- 电脑落线 ---------------- */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return undefined;
        if (currentPlayer !== aiPlayer) return undefined;
        const chain = Boolean(lastMove && lastMove.player === aiPlayer && lastMove.captured.length);
        const timer = window.setTimeout(
            () => {
                const edge = getAIMove(board, aiPlayer, difficulty);
                if (edge) place(edge);
            },
            chain ? 420 : 620
        );
        return () => window.clearTimeout(timer);
    }, [phase, mode, currentPlayer, aiPlayer, board, difficulty, lastMove, place]);

    /* ---------------- 重开 / 设置 ---------------- */
    const reset = useCallback(() => {
        setTimeline([INITIAL_STATE(BLUE)]);
        setPhase('playing');
        setShowResult(false);
        setHint(null);
        setToast('');
        setElapsed(0);
        sound.click();
    }, []);

    const handleModeChange = useCallback(
        (next) => {
            setMode(next);
            reset();
        },
        [reset]
    );

    const handleComputerFirstChange = useCallback(
        (next) => {
            setComputerFirst(next);
            reset();
        },
        [reset]
    );

    /* ---------------- 悔棋 ---------------- */
    const canUndo = timeline.length > 1 && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let next = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (next.length > 1 && next[next.length - 1].currentPlayer !== humanPlayer) {
                next = next.slice(0, -1);
            }
        }
        setTimeline(next);
        setPhase('playing');
        setShowResult(false);
        setHint(null);
        setToast('');
        sound.click();
    }, [canUndo, timeline, mode, humanPlayer]);

    /* ---------------- 提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const edge = getAIMove(board, currentPlayer, 'hard');
        if (!edge) return;
        setHint(edge);
        showToast(`推荐这一手：${edgeLabel(edge)}`);
        sound.click();
    }, [isHumanTurn, board, currentPlayer, showToast]);

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const pair = { black: scores.blue, white: scores.red };
        const winner = getWinner(board);

        if (winner === 0) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '双方占领的方格数相同，本局不分胜负。',
                scores: pair
            };
        }

        const winnerSide = winner === BLUE ? 'blue' : 'red';
        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            const mine = winner === BLUE ? scores.blue : scores.red;
            const theirs = winner === BLUE ? scores.red : scores.blue;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你以 ${mine} : ${theirs} 占领更多方格，赢下本局。`
                    : `电脑以 ${mine} : ${theirs} 领先，换个思路再来一局吧。`,
                scores: pair,
                winnerSide
            };
        }

        const winnerName = winner === BLUE ? names.p1 : names.p2;
        return {
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName} 占领了更多方格，赢下本局。`,
            scores: pair,
            winnerSide
        };
    }, [phase, board, scores, mode, humanPlayer, names]);

    /* ---------------- 名字编辑 ---------------- */
    const handleNameChange = useCallback((key, value) => {
        setNames((prev) => ({ ...prev, [key]: value }));
    }, []);

    /* ---------------- 比分与战绩 ---------------- */
    const placed = scores.blue + scores.red;
    const bluePct = placed ? Math.round((scores.blue / placed) * 100) : 50;
    const redPct = 100 - bluePct;
    const leadText =
        placed === 0
            ? '还没有方格被围住'
            : scores.blue === scores.red
              ? '双方势均力敌'
              : `${scores.blue > scores.red ? playerName(BLUE) : playerName(RED)} 领先`;

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;

    const topName = mode === 'pvp' ? names.p1 : humanPlayer === BLUE ? names.blue : names.red;
    const bottomName = mode === 'pvp' ? names.p2 : humanPlayer === BLUE ? names.red : names.blue;

    const turnLabel = thinking
        ? '电脑正在推演链条…'
        : phase === 'over'
          ? '本局已结束'
          : `轮到 ${playerName(currentPlayer)} · 执${currentPlayer === BLUE ? '蓝' : '红'}`;
    const difficultyLabel = DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    /* 比分板上的名字：人机模式沿用「玩家 / 电脑」，双人模式统一为「玩家 1 / 玩家 2」 */
    const renderNameArea = (side) => {
        const isAiSide = mode === 'ai' && (side === 'blue' ? BLUE : RED) === aiPlayer;
        if (isAiSide) {
            return <span className="gp-score__name-static">{names[side]}</span>;
        }
        const key = mode === 'pvp' ? (side === 'blue' ? 'p1' : 'p2') : side;
        return (
            <input
                className="gp-name-input"
                value={names[key]}
                maxLength={8}
                onChange={(e) => handleNameChange(key, e.target.value)}
                aria-label={`${side === 'blue' ? '蓝方' : '红方'}名字`}
            />
        );
    };

    return (
        <div className="dbx-page">
            <GameNav />
            <BackBar title="点格棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典对弈 · Dots and Boxes</div>
                    <h1 className="gp-hero__title">
                        点格棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        在 6 × 6 的点阵之间轮流画线，围住一个方格，这个方格就归你。
                        看似只是连线，其实是关于「谁来吃掉下一串格子」的算计——
                        课本边角最经久不衰的纸上博弈，现在随时都能开一局。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">6 × 6 点阵</span>
                        <span className="ui-tag">25 个方格</span>
                        <span className="ui-tag">3 档 AI 难度</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">连锁推算</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={currentPlayer === BLUE ? 'blue' : 'red'}
                            />
                            <span className="gp-turnbar__text">{turnLabel}</span>
                            {thinking && <span className="gp-turnbar__spinner" aria-hidden="true" />}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">用时 {formatTime(elapsed)}</span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            currentPlayer={currentPlayer}
                            lastMove={lastMove}
                            hint={hint}
                            onEdgeClick={place}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">蓝方格</span>
                                <strong>{scores.blue}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红方格</span>
                                <strong>{scores.red}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已画线</span>
                                <strong>{log.length}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">剩余线</span>
                                <strong>{emptyCount}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击任意一条空线落笔</span>
                            <span>金色虚线是引擎推荐的那条线</span>
                            <span>围住方格即可继续落线</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--blue" />
                                    <span>{topName}</span>
                                    <strong>{scores.blue}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>{bottomName}</span>
                                    <strong>{scores.red}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="gp-dash__seg gp-dash__seg--blue"
                                    style={{ width: `${bluePct}%` }}
                                />
                                <span
                                    className="gp-dash__seg gp-dash__seg--red"
                                    style={{ width: `${redPct}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>对战模式</span>
                                    <strong>{mode === 'ai' ? '人机对战' : '双人对战'}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>AI 难度</span>
                                    <strong>{mode === 'ai' ? difficultyLabel : '—'}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>先手</span>
                                    <strong>
                                        {mode === 'ai' ? (computerFirst ? '电脑' : '玩家') : '玩家 1'}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>已画线</span>
                                    <strong>{log.length} / 60</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>三边格</b> 等于白送一分
                                </span>
                                <span className="gp-dash__tip">
                                    <b>链条长度</b> 决定送格代价
                                </span>
                                <span className="gp-dash__tip">
                                    <b>长链留两格</b> 把开链难题丢回去
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">对局设置</h2>

                            <div className="gp-field">
                                <span className="gp-field__label">对战模式</span>
                                <div className="ui-seg gp-seg-full">
                                    <button
                                        className={`ui-seg__item ${mode === 'ai' ? 'is-active' : ''}`}
                                        onClick={() => handleModeChange('ai')}
                                    >
                                        玩家 vs 电脑
                                    </button>
                                    <button
                                        className={`ui-seg__item ${mode === 'pvp' ? 'is-active' : ''}`}
                                        onClick={() => handleModeChange('pvp')}
                                    >
                                        双人对战
                                    </button>
                                </div>
                            </div>

                            {mode === 'ai' && (
                                <>
                                    <div className="gp-field">
                                        <span className="gp-field__label">电脑难度</span>
                                        <div className="ui-seg gp-seg-full">
                                            {DIFFICULTY_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    className={`ui-seg__item ${
                                                        difficulty === opt.id ? 'is-active' : ''
                                                    }`}
                                                    onClick={() => {
                                                        setDifficulty(opt.id);
                                                        sound.click();
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="gp-field">
                                        <span className="gp-field__label">先手</span>
                                        <div className="ui-seg gp-seg-full">
                                            <button
                                                className={`ui-seg__item ${!computerFirst ? 'is-active' : ''}`}
                                                onClick={() => handleComputerFirstChange(false)}
                                            >
                                                我先手
                                            </button>
                                            <button
                                                className={`ui-seg__item ${computerFirst ? 'is-active' : ''}`}
                                                onClick={() => handleComputerFirstChange(true)}
                                            >
                                                电脑先手
                                            </button>
                                        </div>
                                        <p className="dbx-first-note">
                                            点格棋由执蓝棋一方先画线，选择「电脑先手」时电脑将执蓝棋开局。
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">比分板</h2>
                            <div className="gp-score">
                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === BLUE && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--blue" />
                                    {renderNameArea('blue')}
                                    <strong key={`b-${scores.blue}`} className="gp-score__value">
                                        {scores.blue}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === RED && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--red" />
                                    {renderNameArea('red')}
                                    <strong key={`r-${scores.red}`} className="gp-score__value">
                                        {scores.red}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button className="ui-btn ui-btn--primary" onClick={reset}>
                                    重新开始
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleUndo}
                                    disabled={!canUndo}
                                >
                                    悔棋
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleHint}
                                    disabled={!isHumanTurn}
                                >
                                    提示
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost gp-sound-btn"
                                    onClick={() => setSoundOn((v) => !v)}
                                    aria-label={soundOn ? '关闭音效' : '开启音效'}
                                >
                                    {soundOn ? '🔊 音效' : '🔇 静音'}
                                </button>
                            </div>
                        </div>

                        {mode === 'ai' && (
                            <div className="gp-card">
                                <h2 className="gp-card__title">我的战绩</h2>
                                <div className="gp-record">
                                    <div className="gp-record__item">
                                        <strong>{record.win}</strong>
                                        <span>胜</span>
                                    </div>
                                    <div className="gp-record__item">
                                        <strong>{record.loss}</strong>
                                        <span>负</span>
                                    </div>
                                    <div className="gp-record__item">
                                        <strong>{record.draw}</strong>
                                        <span>平</span>
                                    </div>
                                </div>
                                <div className="gp-record__bar">
                                    <div className="gp-record__fill" style={{ width: `${winRate}%` }} />
                                </div>
                                <p className="gp-record__note">
                                    共 {totalGames} 局 · 胜率 {winRate}%
                                </p>
                            </div>
                        )}

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                棋谱
                                <span className="gp-card__count">{log.length} 手</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">落笔后将在这里记录每一笔的连线坐标。</p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => {
                                            const turnNo = log.length - index;
                                            return (
                                                <li
                                                    key={`${entry.label}-${turnNo}`}
                                                    className="gp-log__item"
                                                >
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${
                                                            entry.player === BLUE ? 'blue' : 'red'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">
                                                        {entry.label}
                                                    </span>
                                                    {entry.captured > 0 && (
                                                        <span className="dbx-log__tag">
                                                            +{entry.captured} 格
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
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
                            <div className="ui-eyebrow">关于点格棋</div>
                            <h2 className="ui-section-title">
                                一句话的规则，
                                <span className="ui-grad-text">一整套的算计</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                点格棋（Dots and Boxes）最早出现在法国数学家 Édouard Lucas 1889
                                年的《数学娱乐》中，一百多年来一直是纸笔游戏的常客。
                                它的规则只要一句话就能说清，却因为「连锁」与「送格」的存在，
                                成了计算机博弈研究里最经典的题目之一。
                            </p>
                            <p>
                                在很多人手里，它只是课本边角的消遣；但在会数链条的人眼里，
                                每一次落笔都是在计算：这一手之后，谁会先被逼着送出一整串格子。
                                学会看链条，你就掌握了点格棋真正的乐趣。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂点格棋</h2>
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
                    <div className="ui-eyebrow">制胜策略</div>
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
                            <h2 className="ui-section-title">为对局体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把棋盘搬到浏览器里，而是把提示、复盘、战绩都做成顺手的能力，
                            让你在任何设备上都能专注地享受思考本身。
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
                        <h2 className="gp-cta__title">准备好画下第一条线了吗？</h2>
                        <p className="gp-cta__desc">
                            25 个方格等着一分高下，规则一分钟就能学会。
                            现在就开始，试试你能不能把最后一串格子送给对手。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                reset();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="dots-and-boxes" />

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
                                <li>点格棋</li>
                                <li>四子棋</li>
                                <li>井字棋</li>
                                <li>黑白棋</li>
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

            <GameOverModal
                open={showResult}
                result={result}
                names={{ black: topName, white: bottomName }}
                variant="blue"
                onRestart={reset}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default DotsAndBoxesGame;