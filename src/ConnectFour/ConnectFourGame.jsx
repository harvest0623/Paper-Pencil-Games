import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    createInitialBoard,
    makeMove,
    getDropRow,
    getWinningCells,
    isBoardFull,
    countDiscs,
    coordLabel,
    otherPlayer,
    RED,
    YELLOW
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './ConnectFour.css';

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
        q: '四子棋是先手必胜吗？',
        a: '在标准的 7×6 棋盘上，先手只要不失误就能立于不败之地，但并非随手就能取胜——想赢仍需主动制造双重威胁，逼对手顾此失彼。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑执红棋先行。'
    },
    {
        q: '怎样修改玩家名字？',
        a: '直接点击比分板上的名字即可就地编辑，修改会保存在浏览器中，下次打开依然生效。'
    },
    {
        q: '下错了能悔棋吗？',
        a: '可以。点击「悔棋」即回退，人机模式会自动回到你的上一次落子前，双人模式则回退一步。'
    },
    {
        q: '金色虚线的圆圈是什么？',
        a: '那是你点击「提示」后，引擎为你算出的当前最优列的最下方空位，仅作参考，不影响对局。'
    },
    {
        q: '怎样才算获胜？',
        a: '横、竖或斜任意方向率先连成四枚自己的棋子即获胜；若 42 个格子填满仍无人连成四子，则本局平局。'
    }
];

const RULES = [
    {
        step: '01',
        title: '七列棋盘',
        desc: '棋盘由 7 列 6 行共 42 个格子组成，双方各执一种颜色的棋子，轮流出手。'
    },
    {
        step: '02',
        title: '投入落子',
        desc: '轮到的一方选择任意一列，把棋子从列顶投入，它会沿着重力落到该列目前最下方的空位。'
    },
    {
        step: '03',
        title: '连成四子',
        desc: '横、竖或斜任意方向率先把自己的四枚棋子连成一线即获胜，注意对手在斜向上的隐蔽连线。'
    },
    {
        step: '04',
        title: '满盘平局',
        desc: '如果 42 个格子被填满仍未出现任何四连，本局以平局收场，这在势均力敌时偶有发生。'
    }
];

const TIPS = [
    { title: '抢占中心列', desc: '中间列能同时向左右两侧展开，是最有弹性的起点，开局不妨优先落在这里。' },
    { title: '尽量往低处走', desc: '位置越高的棋子越难参与后续连线，把子落在低处，才能保留更多可能性。' },
    { title: '别替对手垫脚', desc: '在对手棋子正上方落子，等于帮他垒高，反而更容易被纵向连成四子。' },
    { title: '制造双重威胁', desc: '一手同时形成两条「差一格」的连线，对手只能堵住一条，另一条就是制胜点。' },
    { title: '斜线别放松', desc: '横向与纵向容易被盯住，斜向的四连最隐蔽，务必留意对手的斜线布局。' },
    { title: '多算两三层', desc: '四子棋一步失误往往再无翻盘机会，落子前多推演几步，胜过事后后悔。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档随手落子，中等档攻守兼备，困难档用带剪枝的深度搜索，几乎不会漏掉杀招。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，随时复盘每一手。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的最优列，边下边体会双重威胁与封堵的取舍。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一手坐标，制胜一手会被特别标注。' },
    { title: '胜负战绩统计', desc: '自动记录对人机的胜、负、平与胜率，见证你的进步曲线。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，支持触屏与鼠标操作。' }
];

const INITIAL_STATE = (firstPlayer) => ({
    board: createInitialBoard(),
    currentPlayer: firstPlayer,
    lastMove: null,
    winCells: [],
    winner: null,
    log: []
});

function ConnectFourGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE(RED)]);
    const [phase, setPhase] = useState('playing'); // playing | over
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('cf.names', { red: '玩家', yellow: '玩家' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('cf.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('cf.sound', true));

    const toastTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastMove, winCells, winner, log } = state;

    const marks = useMemo(
        () => ({ red: countDiscs(board, RED), yellow: countDiscs(board, YELLOW) }),
        [board]
    );

    const aiPlayer = computerFirst ? RED : YELLOW;
    const humanPlayer = computerFirst ? YELLOW : RED;

    /* 电脑思考中：由状态派生，避免在 effect 中同步 setState */
    const thinking = phase === 'playing' && mode === 'ai' && currentPlayer === aiPlayer;

    const redName =
        mode === 'ai'
            ? aiPlayer === RED
                ? '电脑'
                : names.red
            : names.red === '玩家'
              ? '玩家 1'
              : names.red;
    const yellowName =
        mode === 'ai'
            ? aiPlayer === YELLOW
                ? '电脑'
                : names.yellow
            : names.yellow === '玩家'
              ? '玩家 2'
              : names.yellow;

    const playerName = useCallback((player) => (player === RED ? redName : yellowName), [redName, yellowName]);

    const isHumanTurn =
        phase === 'playing' && (mode === 'pvp' || currentPlayer === humanPlayer) && !thinking;

    useEffect(() => safeSet('cf.names', names), [names]);
    useEffect(() => safeSet('cf.record', record), [record]);
    useEffect(() => safeSet('cf.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing') return;
        const id = setInterval(() => setElapsed((v) => v + 1), 1000);
        return () => clearInterval(id);
    }, [phase]);

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 1800);
    }, []);

    const resetGame = useCallback(() => {
        setTimeline([INITIAL_STATE(RED)]);
        setPhase('playing');
        setToast('');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
    }, []);

    const applyMove = useCallback(
        (col) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;

            const dropped = makeMove(cur.board, col, player);
            if (!dropped) return;

            const { board: newBoard, row } = dropped;
            const winningCells = getWinningCells(newBoard);
            const full = isBoardFull(newBoard);
            const finished = winningCells.length > 0 || full;

            const nextState = {
                board: newBoard,
                currentPlayer: finished ? null : otherPlayer(player),
                lastMove: { col, row, player },
                winCells: winningCells,
                winner: winningCells.length > 0 ? player : null,
                log: [
                    ...cur.log,
                    {
                        player,
                        col,
                        row,
                        label: coordLabel(col, row),
                        winning: winningCells.length > 0
                    }
                ]
            };

            setTimeline((prev) => [...prev, nextState]);
            setHint(null);
            sound.place();

            if (finished) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    if (winningCells.length > 0 && player === humanPlayer) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else if (winningCells.length > 0) {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    } else {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    }
                } else if (winningCells.length > 0) {
                    sound.win();
                }
            }
        },
        [timeline, mode, humanPlayer]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return;
        if (currentPlayer !== aiPlayer) return;

        const timer = setTimeout(() => {
            const col = getAIMove(board, aiPlayer, difficulty);
            if (col !== null && col !== undefined) applyMove(col);
        }, 520);

        return () => clearTimeout(timer);
    }, [phase, mode, currentPlayer, aiPlayer, board, difficulty, applyMove]);

    /* 结算 */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: marks.red, white: marks.yellow };

        if (!winner) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '棋盘已经填满，双方都没能连成四子。',
                scores
            };
        }

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? '你率先连成四子，拿下本局，干得漂亮。'
                    : '电脑率先连成四子，换个思路再来一局吧。',
                scores,
                winnerSide: winner === RED ? 'red' : 'yellow'
            };
        }

        return {
            tone: 'win',
            title: `${playerName(winner)} 获胜`,
            sub: `${playerName(winner)} 率先连成四子，赢得本局。`,
            scores,
            winnerSide: winner === RED ? 'red' : 'yellow'
        };
    }, [phase, winner, marks, mode, humanPlayer, playerName]);

    /* 操作 */
    const canUndo = timeline.length > 1 && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let tl = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (tl.length > 1 && tl[tl.length - 1].currentPlayer !== humanPlayer) {
                tl = tl.slice(0, -1);
            }
        }
        setTimeline(tl);
        setPhase('playing');
        setHint(null);
        setToast('');
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode, humanPlayer]);

    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const col = getAIMove(board, currentPlayer, 'hard');
        if (col !== null && col !== undefined) {
            setHint({ col, row: getDropRow(board, col) });
            showToast('已为你标出推荐落点');
            sound.click();
        }
    }, [isHumanTurn, board, currentPlayer, showToast]);

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        setTimeline([INITIAL_STATE(RED)]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const handleFirstMoveChange = (first) => {
        const value = first === 'computer';
        if (value === computerFirst) return;
        setComputerFirst(value);
        setTimeline([INITIAL_STATE(RED)]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const emptyCount = 42 - marks.red - marks.yellow;

    /* 对局仪表盘数据 */
    const placed = marks.red + marks.yellow;
    const redPct = placed ? (marks.red / placed) * 100 : 50;
    const yellowPct = 100 - redPct;
    const leadText =
        placed === 0
            ? '等待第一手落子'
            : marks.red === marks.yellow
              ? '双方势均力敌'
              : `${marks.red > marks.yellow ? redName : yellowName} 领先`;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const statusText = () => {
        if (phase === 'over') return winner ? `${playerName(winner)} 连成四子` : '对局结束';
        if (thinking) return '电脑正在思考…';
        return `${playerName(currentPlayer)} 落子`;
    };

    const renderNameArea = (side) => {
        const isAiSide = mode === 'ai' && aiPlayer === (side === 'red' ? RED : YELLOW);
        if (isAiSide) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={side === 'red' ? redName : yellowName}
                maxLength={8}
                onChange={(e) => setNames((prev) => ({ ...prev, [side]: e.target.value }))}
                aria-label={`${side === 'red' ? '红棋' : '黄棋'}方名字`}
            />
        );
    };

    return (
        <div className="cf-page">
            <GameNav />
            <BackBar title="四子棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典对弈 · Connect Four</div>
                    <h1 className="gp-hero__title">
                        四子棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        选一列，把棋子投下去。它看似只是「连成四个」的简单游戏，
                        却藏着中心与边缘的价值差、纵向的先手优势，
                        以及让对手顾此失彼的双重威胁。一分钟学会，慢慢品味其中的攻防。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">7 × 6 棋盘</span>
                        <span className="ui-tag">3 档 AI 难度</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">即时提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={currentPlayer === YELLOW ? 'yellow' : 'red'}
                            />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            {thinking && <span className="gp-turnbar__spinner" aria-hidden="true" />}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            currentPlayer={currentPlayer}
                            lastMove={lastMove}
                            winCells={winCells}
                            hint={hint}
                            onColumnClick={applyMove}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红棋</span>
                                <strong>{marks.red}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">黄棋</span>
                                <strong>{marks.yellow}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">手数</span>
                                <strong>{log.length}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">空位</span>
                                <strong>{emptyCount}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击任意一列落子</span>
                            <span>金色虚圈是引擎推荐的位置</span>
                            <span>横竖斜连成四子即胜</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>{redName}</span>
                                    <strong>{marks.red}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--yellow" />
                                    <span>{yellowName}</span>
                                    <strong>{marks.yellow}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="gp-dash__seg gp-dash__seg--red"
                                    style={{ width: `${redPct}%` }}
                                />
                                <span
                                    className="gp-dash__seg gp-dash__seg--yellow"
                                    style={{ width: `${yellowPct}%` }}
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
                                    <span>当前手数</span>
                                    <strong>{log.length}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>中心列</b> 左右呼应最灵活
                                </span>
                                <span className="gp-dash__tip">
                                    <b>低处</b> 优于高处身位
                                </span>
                                <span className="gp-dash__tip">
                                    <b>双威胁</b> 让对手无法兼顾
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
                                                onClick={() => handleFirstMoveChange('player')}
                                            >
                                                我先手
                                            </button>
                                            <button
                                                className={`ui-seg__item ${computerFirst ? 'is-active' : ''}`}
                                                onClick={() => handleFirstMoveChange('computer')}
                                            >
                                                电脑先手
                                            </button>
                                        </div>
                                        <p className="cf-first-note">
                                            四子棋由执红棋一方先行，选择「电脑先手」时电脑将执红棋开局。
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
                                        currentPlayer === RED && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--red" />
                                    {renderNameArea('red')}
                                    <strong key={`r-${marks.red}`} className="gp-score__value">
                                        {marks.red}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === YELLOW && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--yellow" />
                                    {renderNameArea('yellow')}
                                    <strong key={`y-${marks.yellow}`} className="gp-score__value">
                                        {marks.yellow}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button className="ui-btn ui-btn--primary" onClick={resetGame}>
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
                                    <div
                                        className="gp-record__fill"
                                        style={{ width: `${winRate}%` }}
                                    />
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
                                <p className="gp-log__empty">落子后将在这里记录每一手的坐标。</p>
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
                                                            entry.player === RED ? 'red' : 'yellow'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">
                                                        {entry.label}
                                                    </span>
                                                    {entry.winning && (
                                                        <span className="cf-log__tag">四连</span>
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
                            <div className="ui-eyebrow">关于四子棋</div>
                            <h2 className="ui-section-title">
                                最简单的手，
                                <span className="ui-grad-text">最烧脑的局</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                四子棋（Connect Four）由 Howard Wexler 与 Ned Strongin 于 1974 年发明。
                                它把竖立的棋盘与重力结合：每次落子只需选一列，
                                棋子便会自动坠到该列最下方——操作简单到几岁小孩也能立刻上手。
                            </p>
                            <p>
                                但简单的操作背后，是极其丰富的策略空间。
                                中间列的价值、身位的高低、纵向的先手、隐蔽的斜线，
                                以及「一手做出两个威胁」的杀招，都让它可以被反复琢磨。
                                正因如此，它既是家庭游戏，也是人工智能领域研究博弈树搜索的经典题目。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂四子棋</h2>
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
                        <h2 className="gp-cta__title">准备好连成四子了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想练练手速，还是只想在课间来一局，
                            四子棋都是最轻巧的脑力热身。现在就开始吧。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                resetGame();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="connect-four" />

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
                                <li>四子棋</li>
                                <li>井字棋</li>
                                <li>五子棋</li>
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
                names={{ black: redName, white: yellowName }}
                variant="disc"
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default ConnectFourGame;
