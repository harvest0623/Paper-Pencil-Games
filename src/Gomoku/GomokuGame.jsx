import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    createEmptyBoard,
    placeStone,
    checkWin,
    isBoardFull,
    countStones,
    otherPlayer,
    coordLabel,
    BOARD_SIZE,
    EMPTY,
    BLACK,
    WHITE
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Gomoku.css';

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
        q: '五子棋的开局规则是什么？',
        a: '标准五子棋由执黑一方先行，双方轮流在交叉点落子。任意一方率先在横、竖、斜任一方向连成五子（含五子以上）即获胜。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑执黑先行。'
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
        q: '棋盘上的金色虚线圈是什么？',
        a: '那是你点击「提示」后，引擎为你计算出的当前最优落点，仅作参考，不影响对局。'
    },
    {
        q: '连成五子后棋盘会有什么变化？',
        a: '获胜的五颗棋子会被高亮标出，并弹出结算面板显示胜负结果与双方棋子数。'
    }
];

const RULES = [
    {
        step: '01',
        title: '黑先白后',
        desc: '棋盘为 15×15 的交叉点，执黑一方先行，双方轮流落下一子，落子后不可移动。'
    },
    {
        step: '02',
        title: '连五取胜',
        desc: '横、竖、斜任意方向连成五颗同色棋子即获胜，连成五颗以上同样算赢。'
    },
    {
        step: '03',
        title: '攻守兼备',
        desc: '既要构筑自己的连线，也要随时封堵对手的「活三」「冲四」，一步之差常常决定成败。'
    },
    {
        step: '04',
        title: '满盘和棋',
        desc: '若棋盘下满仍无一方连成五子，则本局以平局收场。'
    }
];

const TIPS = [
    { title: '抢占天元', desc: '开局落在棋盘中心附近，能向四面八方延伸，获得最多的进攻角度。' },
    { title: '活三必应', desc: '对手形成「活三」时必须及时封堵，否则下一手就会变成无法阻挡的活四。' },
    { title: '制造双三', desc: '一子同时形成两个活三，对手只能堵住一个，这是最常见的取胜手筋。' },
    { title: '冲四逼应', desc: '用「冲四」逼迫对手被动防守，从而为自己争取到关键的进攻节奏。' },
    { title: '紧贴缠斗', desc: '落子尽量靠近对手棋形，压缩其发展空间，同时在纠缠中寻找机会。' },
    { title: '留有余地', desc: '不要过早走成死形，保持多条线路的可能性，让对手难以兼顾。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '基于棋型评分的引擎，简单档轻松上手，困难档会预判你的反击路线。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，随时复盘。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的落点，边下边体会棋型与先手的重要性。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一手坐标，制胜一手会被特别标注。' },
    { title: '胜负战绩统计', desc: '自动记录对人机的胜、负、平与胜率，见证你的进步曲线。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，支持触屏与鼠标操作。' }
];

const INITIAL_STATE = (firstPlayer) => ({
    board: createEmptyBoard(),
    currentPlayer: firstPlayer,
    lastMove: null,
    winCells: [],
    winner: null,
    log: []
});

function GomokuGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE(BLACK)]);
    const [phase, setPhase] = useState('playing'); // playing | over
    const [toast, setToast] = useState('');
    const [thinking, setThinking] = useState(false);
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('gm.names', { black: '玩家', white: '玩家 2' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('gm.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('gm.sound', true));

    const toastTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastMove, winCells, winner, log } = state;

    const stones = useMemo(() => countStones(board), [board]);

    const aiPlayer = computerFirst ? BLACK : WHITE;
    const humanPlayer = computerFirst ? WHITE : BLACK;

    const blackName = mode === 'ai' && aiPlayer === BLACK ? '电脑' : names.black;
    const whiteName = mode === 'ai' && aiPlayer === WHITE ? '电脑' : names.white;

    const playerName = useCallback(
        (player) => (player === BLACK ? blackName : whiteName),
        [blackName, whiteName]
    );

    const isHumanTurn =
        phase === 'playing' &&
        (mode === 'pvp' || currentPlayer === humanPlayer) &&
        !thinking;

    useEffect(() => safeSet('gm.names', names), [names]);
    useEffect(() => safeSet('gm.record', record), [record]);
    useEffect(() => safeSet('gm.sound', soundOn), [soundOn]);
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
        recordedRef.current = false;
        setTimeline([INITIAL_STATE(BLACK)]);
        setPhase('playing');
        setToast('');
        setHint(null);
        setThinking(false);
        setShowResult(false);
        setElapsed(0);
    }, []);

    const applyMove = useCallback(
        (row, col) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;
            if (cur.board[row][col] !== EMPTY) return;

            const newBoard = placeStone(cur.board, row, col, player);
            const winningLine = checkWin(newBoard, row, col);
            const full = isBoardFull(newBoard);
            const finished = Boolean(winningLine) || full;

            const nextState = {
                board: newBoard,
                currentPlayer: finished ? null : otherPlayer(player),
                lastMove: { row, col, player },
                winCells: winningLine || [],
                winner: winningLine ? player : null,
                log: [
                    ...cur.log,
                    {
                        player,
                        row,
                        col,
                        label: coordLabel(row, col),
                        winning: Boolean(winningLine)
                    }
                ]
            };

            setTimeline((prev) => [...prev, nextState]);
            setHint(null);
            sound.place();

            if (finished) setPhase('over');
        },
        [timeline]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return;
        if (currentPlayer !== aiPlayer) return;

        setThinking(true);
        const timer = setTimeout(() => {
            const move = getAIMove(board, aiPlayer, difficulty);
            setThinking(false);
            if (move) applyMove(move.row, move.col);
        }, 560);

        return () => {
            clearTimeout(timer);
            setThinking(false);
        };
    }, [phase, mode, currentPlayer, aiPlayer, board, difficulty, applyMove]);

    /* 结算 */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: stones.black, white: stones.white };

        if (!winner) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '棋盘已经下满，双方都没能连成五子。',
                scores
            };
        }

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? '你率先连成五子，拿下本局，干得漂亮。'
                    : '电脑率先连成五子，调整策略再来一局吧。',
                scores
            };
        }

        return {
            tone: 'win',
            title: `${playerName(winner)} 获胜`,
            sub: `${playerName(winner)} 率先连成五子，赢得本局。`,
            scores
        };
    }, [phase, winner, stones, mode, humanPlayer, playerName]);

    useEffect(() => {
        if (phase !== 'over' || recordedRef.current) return;
        recordedRef.current = true;
        if (mode === 'ai') {
            setRecord((prev) => {
                if (winner === humanPlayer) return { ...prev, win: prev.win + 1 };
                if (winner === aiPlayer) return { ...prev, loss: prev.loss + 1 };
                return { ...prev, draw: prev.draw + 1 };
            });
        }
        if (result?.tone === 'win') sound.win();
        else if (result?.tone === 'lose') sound.lose();
        setShowResult(true);
    }, [phase, mode, winner, humanPlayer, aiPlayer, result]);

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
        const move = getAIMove(board, currentPlayer, 'hard');
        if (move) {
            setHint(move);
            sound.click();
        }
    }, [isHumanTurn, board, currentPlayer]);

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        recordedRef.current = false;
        setTimeline([INITIAL_STATE(BLACK)]);
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
        recordedRef.current = false;
        setTimeline([INITIAL_STATE(BLACK)]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const emptyCount = BOARD_SIZE * BOARD_SIZE - stones.black - stones.white;

    /* 对局仪表盘数据 */
    const placedStones = stones.black + stones.white;
    const blackPct = placedStones ? (stones.black / placedStones) * 100 : 50;
    const whitePct = 100 - blackPct;
    const leadText =
        placedStones === 0
            ? '等待第一手落子'
            : stones.black === stones.white
              ? '双方势均力敌'
              : `${stones.black > stones.white ? blackName : whiteName} 领先 ${Math.abs(
                    stones.black - stones.white
                )} 子`;
    const moveCount = timeline.length - 1;

    const statusText = () => {
        if (phase === 'over') return winner ? `${playerName(winner)} 连成五子` : '对局结束';
        if (thinking) return '电脑正在思考…';
        return `${playerName(currentPlayer)} 落子`;
    };

    const renderNameArea = (chipSide) => {
        const isAiSide = mode === 'ai' && aiPlayer === (chipSide === 'black' ? BLACK : WHITE);
        if (isAiSide) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={names[chipSide]}
                maxLength={8}
                onChange={(e) =>
                    setNames((prev) => ({ ...prev, [chipSide]: e.target.value }))
                }
                aria-label={`${chipSide === 'black' ? '黑方' : '白方'}名字`}
            />
        );
    };

    return (
        <div className="gm-page">
            <GameNav />
            <BackBar title="五子棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">东方经典 · Gomoku / Five in a Row</div>
                    <h1 className="gp-hero__title">
                        五子棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        一黑一白，落在交叉点上的每一次选择都在编织棋形。
                        抢先一步连成五子，又在对手的活三面前及时收手——
                        最简单的规则，藏着最深的变化。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">15 × 15 棋盘</span>
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
                                data-player={currentPlayer === WHITE ? 'white' : 'black'}
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
                            onCellClick={applyMove}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">黑子</span>
                                <strong>{stones.black}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">白子</span>
                                <strong>{stones.white}</strong>
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
                            <span>点击交叉点落子</span>
                            <span>金色虚线圈是引擎推荐的最佳一手</span>
                            <span>横竖斜任一连成五子即胜</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--black" />
                                    <span>{blackName}</span>
                                    <strong>{stones.black}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--white" />
                                    <span>{whiteName}</span>
                                    <strong>{stones.white}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="gp-dash__seg gp-dash__seg--dark"
                                    style={{ width: `${blackPct}%` }}
                                />
                                <span
                                    className="gp-dash__seg gp-dash__seg--light"
                                    style={{ width: `${whitePct}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>对战模式</span>
                                    <strong>{mode === 'ai' ? '人机对战' : '双人对战'}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>AI 难度</span>
                                    <strong>
                                        {mode === 'ai'
                                            ? (DIFFICULTY_OPTIONS.find(
                                                  (opt) => opt.id === difficulty
                                              )?.label ?? '—')
                                            : '—'}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>先手</span>
                                    <strong>
                                        {mode === 'ai'
                                            ? computerFirst
                                                ? '电脑'
                                                : '玩家'
                                            : '玩家 1'}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>当前手数</span>
                                    <strong>{moveCount}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>天元</b> 开局抢占中心视野最广
                                </span>
                                <span className="gp-dash__tip">
                                    <b>活三</b> 必须立刻封堵
                                </span>
                                <span className="gp-dash__tip">
                                    <b>双三</b> 让对手无从兼顾
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
                                        <p className="gm-first-note">
                                            五子棋由执黑一方先行，选择「电脑先手」时电脑将执黑开局。
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
                                        currentPlayer === BLACK && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--black" />
                                    {renderNameArea('black')}
                                    <strong key={`b-${stones.black}`} className="gp-score__value">
                                        {stones.black}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === WHITE && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--white" />
                                    {renderNameArea('white')}
                                    <strong key={`w-${stones.white}`} className="gp-score__value">
                                        {stones.white}
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
                                                            entry.player === BLACK ? 'black' : 'white'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">{entry.label}</span>
                                                    {entry.winning && (
                                                        <span className="gm-log__tag">五连</span>
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
                            <div className="ui-eyebrow">关于五子棋</div>
                            <h2 className="ui-section-title">
                                规则最简，变化最深的
                                <span className="ui-grad-text">东方棋艺</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                五子棋起源于中国，是流传最广、上手最快的棋类之一。
                                它把棋盘交错成 15×15 的网格，双方各执黑白，轮流在交叉点上落子，
                                谁的棋子先在任意方向连成五颗，谁就赢下这一局。
                            </p>
                            <p>
                                但「连五」只是表象。真正决定胜负的是棋形——
                                活三、冲四、双三、禁手与反制，每一步都在为下一步铺路。
                                当你学会在进攻的同时留意对手的线路，五子棋就会从消遣变成一场真正的博弈。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂五子棋</h2>
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
                        <h2 className="gp-cta__title">准备好连成五子了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想锻炼棋感，还是只想在午后放松一局，
                            五子棋都是娱乐与脑力训练的完美结合。现在就开始吧。
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

            <MoreGames currentId="gomoku" />

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
                                <li>五子棋</li>
                                <li>黑白棋</li>
                                <li>井字棋</li>
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

            <GameOverModal
                open={showResult}
                result={result}
                names={{ black: blackName, white: whiteName }}
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default GomokuGame;