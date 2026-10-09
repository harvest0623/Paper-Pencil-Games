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
    getValidMoves,
    makeMove,
    getFlippedPieces,
    countPieces,
    otherPlayer,
    coordLabel,
    BLACK,
    WHITE
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';

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
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后电脑会自动落下第一步。'
    },
    {
        q: '觉得当前难度太简单，能中途更换吗？',
        a: '可以。游戏提供简单、中等、困难三个档位，点击即可切换，调整会立即对电脑接下来的走法生效。'
    },
    {
        q: '如何修改玩家名字？',
        a: '直接点击比分板上的名字即可就地编辑，修改会保存在浏览器中，下次打开仍然生效。'
    },
    {
        q: '下错了想反悔怎么办？',
        a: '点击「悔棋」即可回退。人机模式会自动回退到你的上一次落子前，双人模式则回退一步。'
    },
    {
        q: '棋盘上的小圆点和虚线圈是什么？',
        a: '小圆点表示当前轮到你时所有合法的落子位置；虚线圈是你点击「提示」后，引擎推荐的最佳一手。'
    },
    {
        q: '怎样关闭游戏音效？',
        a: '点击操作区的喇叭按钮即可静音，再次点击恢复正常，设置会被记住。'
    }
];

const RULES = [
    {
        step: '01',
        title: '初始布局',
        desc: '棋盘为 8×8，开局时中央四格对角摆放两颗黑棋与两颗白棋，黑棋先行。'
    },
    {
        step: '02',
        title: '夹击翻转',
        desc: '在任意方向用自己的棋子夹住对方一整排连续的棋子，被夹住的棋子全部翻转成你的颜色。'
    },
    {
        step: '03',
        title: '必须有得翻',
        desc: '只有当落子能翻转至少一颗对方棋子时才算合法。若某方无子可下，则该回合自动跳过。'
    },
    {
        step: '04',
        title: '结束计分',
        desc: '当双方都无法继续落子时对局结束，占据格子多的一方获胜，数量相同则为平局。'
    }
];

const TIPS = [
    { title: '抢占四角', desc: '角落的棋子永远不会被翻转，是全盘价值最高的战略要地。' },
    { title: '慎占角旁', desc: '角落里紧邻的格子（星位）极具风险，贸然落子常把角落拱手让人。' },
    { title: '控制边线', desc: '稳住边线就稳住了翻盘的支点，边线优势往往能滚雪球成胜势。' },
    { title: '少即是多', desc: '前期棋子多不代表领先，保持落子选择多、逼迫对手无路可走才是关键。' },
    { title: '提前读数', desc: '每一步都问自己：下完之后对手还剩几个好点？主动限制对手的选择。' },
    { title: '收官定胜负', desc: '棋盘格子越少，每一子越值钱，末盘精确计算决定最终比分。' }
];

const FEATURES = [
    { title: '三种智能难度', desc: '基于 Alpha-Beta 剪枝的引擎，简单档轻松上手，困难档具备多步推演。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，实时计分。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的最佳落点，边玩边学。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一手坐标，复盘子力变化。' },
    { title: '胜负战绩统计', desc: '自动记录对人机的胜、负、平与胜率，见证你的成长曲线。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，支持键盘与触屏操作。' }
];

const INITIAL_STATE = (firstPlayer) => ({
    board: createInitialBoard(),
    currentPlayer: firstPlayer,
    lastMove: null,
    flipped: [],
    log: []
});

function ReversiGame() {
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
        safeGet('rv.names', { black: '玩家', white: '玩家 2' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('rv.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('rv.sound', true));

    const toastTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastMove, flipped, log } = state;

    const validMoves = useMemo(
        () => (currentPlayer ? getValidMoves(board, currentPlayer) : []),
        [board, currentPlayer]
    );
    const scores = useMemo(() => countPieces(board), [board]);

    const whiteName = mode === 'ai' ? '电脑' : names.white;
    /* 双人模式下先手名显示为「玩家 1」，与「玩家 2」呼应 */
    const blackName = mode === 'pvp' && names.black === '玩家' ? '玩家 1' : names.black;
    const playerName = useCallback(
        (player) => (player === BLACK ? blackName : whiteName),
        [blackName, whiteName]
    );
    const isHumanTurn =
        phase === 'playing' && (mode === 'pvp' || currentPlayer === BLACK) && !thinking;

    useEffect(() => safeSet('rv.names', names), [names]);
    useEffect(() => safeSet('rv.record', record), [record]);
    useEffect(() => safeSet('rv.sound', soundOn), [soundOn]);
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
        setTimeline([INITIAL_STATE(computerFirst ? WHITE : BLACK)]);
        setPhase('playing');
        setToast('');
        setHint(null);
        setThinking(false);
        setShowResult(false);
        setElapsed(0);
    }, [computerFirst]);

    const applyMove = useCallback(
        (row, col) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;

            const flippedCells = getFlippedPieces(cur.board, row, col, player);
            if (flippedCells.length === 0) return;

            const newBoard = makeMove(cur.board, row, col, player);
            const opponent = otherPlayer(player);

            let nextPlayer = opponent;
            let passed = null;
            if (getValidMoves(newBoard, opponent).length === 0) {
                if (getValidMoves(newBoard, player).length > 0) {
                    nextPlayer = player;
                    passed = opponent;
                } else {
                    nextPlayer = null;
                }
            }

            const nextState = {
                board: newBoard,
                currentPlayer: nextPlayer,
                lastMove: { row, col, player },
                flipped: flippedCells.map(([r, c]) => ({ row: r, col: c })),
                log: [
                    ...cur.log,
                    { player, row, col, label: coordLabel(row, col), flips: flippedCells.length }
                ]
            };

            setTimeline((prev) => [...prev, nextState]);
            setHint(null);
            sound.place();
            sound.flip(flippedCells.length);

            if (passed) {
                showToast(`${playerName(passed)} 无子可下，跳过一回合`);
            }
            if (nextPlayer === null) {
                setPhase('over');
            }
        },
        [timeline, showToast, playerName]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return;
        if (currentPlayer !== WHITE) return;
        if (validMoves.length === 0) return;

        setThinking(true);
        const timer = setTimeout(() => {
            const move = getAIMove(board, WHITE, difficulty);
            setThinking(false);
            if (move) applyMove(move.row, move.col);
        }, 620);

        return () => {
            clearTimeout(timer);
            setThinking(false);
        };
    }, [phase, mode, currentPlayer, board, difficulty, validMoves.length, applyMove]);

    /* 结算与战绩 */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const { black, white } = scores;
        if (black === white) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '势均力敌，双方棋子数量完全相同。',
                scores
            };
        }
        const winner = black > white ? blackName : whiteName;
        const winnerCount = Math.max(black, white);
        const winnerSide = black > white ? 'black' : 'white';
        if (mode === 'ai') {
            const humanWon = black > white;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你以 ${winnerCount} 颗棋子拿下本局，干得漂亮。`
                    : `电脑以 ${winnerCount} 颗棋子取胜，调整策略再来一局吧。`,
                scores,
                winnerSide
            };
        }
        return {
            tone: 'win',
            title: `${winner} 获胜`,
            sub: `${winner} 以 ${winnerCount} 颗棋子赢得本局。`,
            scores,
            winnerSide
        };
    }, [phase, scores, blackName, whiteName, mode]);

    useEffect(() => {
        if (phase !== 'over' || recordedRef.current) return;
        recordedRef.current = true;
        if (mode === 'ai') {
            setRecord((prev) => {
                if (scores.black > scores.white) return { ...prev, win: prev.win + 1 };
                if (scores.black < scores.white) return { ...prev, loss: prev.loss + 1 };
                return { ...prev, draw: prev.draw + 1 };
            });
        }
        if (result?.tone === 'win') sound.win();
        else if (result?.tone === 'lose') sound.lose();
        setShowResult(true);
    }, [phase, mode, scores, result]);

    /* 操作 */
    const canUndo = timeline.length > 1 && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let tl = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (tl.length > 1 && tl[tl.length - 1].currentPlayer !== BLACK) {
                tl = tl.slice(0, -1);
            }
        }
        setTimeline(tl);
        setPhase('playing');
        setHint(null);
        setToast('');
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode]);

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
        setTimeline([INITIAL_STATE(nextMode === 'ai' && computerFirst ? WHITE : BLACK)]);
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
        setTimeline([INITIAL_STATE(mode === 'ai' && value ? WHITE : BLACK)]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const emptyCount = 64 - scores.black - scores.white;

    /* 对局仪表盘数据 */
    const placedStones = scores.black + scores.white;
    const blackPct = placedStones ? (scores.black / placedStones) * 100 : 50;
    const whitePct = 100 - blackPct;
    const leadText =
        placedStones === 0
            ? '等待第一手落子'
            : scores.black === scores.white
              ? '双方势均力敌'
              : `${scores.black > scores.white ? blackName : whiteName} 领先 ${Math.abs(
                    scores.black - scores.white
                )} 子`;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';
    const moveCount = timeline.length - 1;

    const statusText = () => {
        if (phase === 'over') return '对局结束';
        if (thinking) return '电脑正在思考…';
        if (currentPlayer === BLACK) return `${blackName} 落子`;
        return `${whiteName} 落子`;
    };

    return (
        <div className="gp-page">
            <GameNav />
            <BackBar title="黑白棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典对弈 · Reversi / Othello</div>
                    <h1 className="gp-hero__title">
                        黑白棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        规则一分钟学会，策略却能钻研一辈子。翻转对手的棋子，占领更多棋盘格，
                        在每一次落子中推演三步之后的局势。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">8 × 8 棋盘</span>
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
                            <span className="gp-turnbar__dot" data-player={currentPlayer === WHITE ? 'white' : 'black'} />
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
                            validMoves={validMoves}
                            currentPlayer={currentPlayer}
                            lastMove={lastMove}
                            flippedCells={flipped}
                            hint={hint}
                            onCellClick={applyMove}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">黑棋</span>
                                <strong>{scores.black}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">白棋</span>
                                <strong>{scores.white}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">空格</span>
                                <strong>{emptyCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">可落子</span>
                                <strong>{validMoves.length}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>淡色小圆点表示可落子的位置</span>
                            <span>金色虚线圈是引擎推荐的最佳一手</span>
                            <span>角位棋子永不会被翻转</span>
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
                                    <strong>{scores.black}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--white" />
                                    <span>{whiteName}</span>
                                    <strong>{scores.white}</strong>
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
                                    <strong>{mode === 'ai' ? difficultyLabel : '—'}</strong>
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
                                    <b>角位</b> 价值最高且永不翻转
                                </span>
                                <span className="gp-dash__tip">
                                    <b>星位</b> 让对手无法形成稳定子
                                </span>
                                <span className="gp-dash__tip">
                                    <b>少即是多</b> 残局时棋子少反而占优
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
                                    <input
                                        className="gp-name-input"
                                        value={blackName}
                                        maxLength={8}
                                        onChange={(e) =>
                                            setNames((prev) => ({ ...prev, black: e.target.value }))
                                        }
                                        aria-label="黑棋名字"
                                    />
                                    <strong key={`b-${scores.black}`} className="gp-score__value">
                                        {scores.black}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === WHITE && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--white" />
                                    {mode === 'ai' ? (
                                        <span className="gp-score__name-static">电脑</span>
                                    ) : (
                                        <input
                                            className="gp-name-input"
                                            value={names.white}
                                            maxLength={8}
                                            onChange={(e) =>
                                                setNames((prev) => ({ ...prev, white: e.target.value }))
                                            }
                                            aria-label="白棋名字"
                                        />
                                    )}
                                    <strong key={`w-${scores.white}`} className="gp-score__value">
                                        {scores.white}
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
                                                <li key={`${entry.label}-${turnNo}`} className="gp-log__item">
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${
                                                            entry.player === BLACK ? 'black' : 'white'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">{entry.label}</span>
                                                    <span className="gp-log__flips">
                                                        +{entry.flips}
                                                    </span>
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
                            <div className="ui-eyebrow">关于黑白棋</div>
                            <h2 className="ui-section-title">
                                一分钟学会，一辈子钻研的
                                <span className="ui-grad-text">策略棋</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                黑白棋（又称翻转棋、奥赛罗）是一款风靡全球的策略棋盘游戏。
                                目标很纯粹：让自己的棋子占据最多的格子。但实现它的过程充满算计——
                                每一步落子都会翻转对手的一片棋子，改变盘面形势，也改变双方后续的选择。
                            </p>
                            <p>
                                正因为「翻转」这一机制，落后几子并不代表输，一个漂亮的角落落子就能掀起连锁反应。
                                这种随时可能翻盘的紧张感，让黑白棋成为各年龄段玩家都爱不释手的经典。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂黑白棋</h2>
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
                                <span className="gp-tip__index">{String(index + 1).padStart(2, '0')}</span>
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
                        <h2 className="gp-cta__title">准备好翻转棋盘了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想锻炼战略思维，还是只想在午后放松一局，
                            黑白棋都是娱乐与脑力训练的完美结合。现在就开始吧。
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

            <MoreGames currentId="reversi" />

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
                                <li>黑白棋</li>
                                <li>井字棋</li>
                                <li>五子棋</li>
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

export default ReversiGame;