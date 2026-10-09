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
    getValidMoves,
    getWinningCells,
    coordLabel,
    X,
    O
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './TicTacToe.css';

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

const otherPlayer = (player) => (player === X ? O : X);

const DIFFICULTY_OPTIONS = [
    { id: 'easy', label: '简单' },
    { id: 'medium', label: '中等' },
    { id: 'hard', label: '困难' }
];

const FAQ_ITEMS = [
    {
        q: '井字棋是先手必胜吗？',
        a: '在双方都走最优的情况下，井字棋必然以平局收场，先手无法强制取胜。但只要对手出现一步失误，先手就能立刻抓住机会连成一线。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑执 X 先行。'
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
        q: '金色虚线的方框是什么？',
        a: '那是你点击「提示」后，引擎为你计算出的当前最优落点，仅作参考，不影响对局。'
    },
    {
        q: '怎样才算获胜？',
        a: '横、竖或斜线方向率先连成三个自己的标记即获胜；若九格填满仍无人连成一线，则本局平局。'
    }
];

const RULES = [
    {
        step: '01',
        title: '九格棋盘',
        desc: '棋盘是 3×3 的九宫格，双方各执一种标记，轮流在空格中落子，落子后不可移动。'
    },
    {
        step: '02',
        title: 'X 先 O 后',
        desc: '执 X 的一方先行，之后双方交替出手。每回合只能落一子，落在任意空白格中。'
    },
    {
        step: '03',
        title: '连成一线',
        desc: '横、竖、斜任意方向率先连成三个自己的标记即获胜，最多九手就能分出胜负。'
    },
    {
        step: '04',
        title: '满格平局',
        desc: '如果九格被填满仍未出现三连，本局以平局收场——这也是最优对抗下的常见结果。'
    }
];

const TIPS = [
    { title: '抢占中心', desc: '中心格同时属于四条连线，是第一优先级的落点，先拿到它就能掌握主动。' },
    { title: '先占角位', desc: '角格处在三条连线上，价值仅次于中心；中心被占时，优先抢角而不是边。' },
    { title: '及时封堵', desc: '对手已有两子连线时必须立刻堵住第三格，否则下一手就会被直接连成。' },
    { title: '制造双杀', desc: '一子同时形成两条「差一格」的线路，对手只能堵住一条，另一条就是制胜点。' },
    { title: '别只顾防守', desc: '每次落子前先看自己能否直接取胜，再考虑是否需要封堵，进攻往往比防守更省手。' },
    { title: '逼对手走边', desc: '把对手赶到边格，边格只属于两条连线，其威胁范围最小，更利于你掌控局面。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档随机出手，中等档会攻守兼顾，困难档使用极小化极大搜索，几乎不会失误。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，随时复盘每一手。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的最优落点，边下边体会连线与双杀的手筋。' },
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

function TicTacToeGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE(X)]);
    const [phase, setPhase] = useState('playing'); // playing | over
    const [toast, setToast] = useState('');
    const [thinking, setThinking] = useState(false);
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('tt.names', { x: '玩家', o: '玩家 2' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('tt.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('tt.sound', true));

    const toastTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastMove, winCells, winner, log } = state;

    const marks = useMemo(() => {
        let x = 0;
        let o = 0;
        board.forEach((row) =>
            row.forEach((cell) => {
                if (cell === X) x += 1;
                else if (cell === O) o += 1;
            })
        );
        return { x, o };
    }, [board]);

    const aiPlayer = computerFirst ? X : O;
    const humanPlayer = computerFirst ? O : X;

    const xName =
        mode === 'ai'
            ? aiPlayer === X
                ? '电脑'
                : names.x
            : names.x === '玩家'
              ? '玩家 1'
              : names.x;
    const oName = mode === 'ai' && aiPlayer === O ? '电脑' : names.o;

    const playerName = useCallback(
        (player) => (player === X ? xName : oName),
        [xName, oName]
    );

    const isHumanTurn =
        phase === 'playing' &&
        (mode === 'pvp' || currentPlayer === humanPlayer) &&
        !thinking;

    useEffect(() => safeSet('tt.names', names), [names]);
    useEffect(() => safeSet('tt.record', record), [record]);
    useEffect(() => safeSet('tt.sound', soundOn), [soundOn]);
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
        setTimeline([INITIAL_STATE(X)]);
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

            const newBoard = makeMove(cur.board, row, col, player);
            if (!newBoard) return;

            const winningCells = getWinningCells(newBoard);
            const full = getValidMoves(newBoard).length === 0;
            const finished = winningCells.length > 0 || full;

            const nextState = {
                board: newBoard,
                currentPlayer: finished ? null : otherPlayer(player),
                lastMove: { row, col, player },
                winCells: winningCells,
                winner: winningCells.length > 0 ? player : null,
                log: [
                    ...cur.log,
                    {
                        player,
                        row,
                        col,
                        label: coordLabel(row, col),
                        winning: winningCells.length > 0
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
        }, 520);

        return () => {
            clearTimeout(timer);
            setThinking(false);
        };
    }, [phase, mode, currentPlayer, aiPlayer, board, difficulty, applyMove]);

    /* 结算 */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: marks.x, white: marks.o };

        if (!winner) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '九格已经填满，双方都没能连成一线。',
                scores
            };
        }

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? '你率先连成一线，拿下本局，干得漂亮。'
                    : '电脑率先连成一线，换个思路再来一局吧。',
                scores,
                winnerSide: winner === X ? 'x' : 'o'
            };
        }

        return {
            tone: 'win',
            title: `${playerName(winner)} 获胜`,
            sub: `${playerName(winner)} 率先连成三子，赢得本局。`,
            scores,
            winnerSide: winner === X ? 'x' : 'o'
        };
    }, [phase, winner, marks, mode, humanPlayer, playerName]);

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
            showToast('已为你标出推荐落点');
            sound.click();
        }
    }, [isHumanTurn, board, currentPlayer, showToast]);

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        recordedRef.current = false;
        setTimeline([INITIAL_STATE(X)]);
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
        setTimeline([INITIAL_STATE(X)]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const emptyCount = 9 - marks.x - marks.o;

    /* 对局仪表盘数据 */
    const placed = marks.x + marks.o;
    const xPct = placed ? (marks.x / placed) * 100 : 50;
    const oPct = 100 - xPct;
    const leadText =
        placed === 0
            ? '等待第一手落子'
            : marks.x === marks.o
              ? '双方势均力敌'
              : `${marks.x > marks.o ? xName : oName} 领先`;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const statusText = () => {
        if (phase === 'over') return winner ? `${playerName(winner)} 连成一线` : '对局结束';
        if (thinking) return '电脑正在思考…';
        return `${playerName(currentPlayer)} 落子`;
    };

    const renderNameArea = (side) => {
        const isAiSide = mode === 'ai' && aiPlayer === (side === 'x' ? X : O);
        if (isAiSide) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={side === 'x' ? xName : oName}
                maxLength={8}
                onChange={(e) => setNames((prev) => ({ ...prev, [side]: e.target.value }))}
                aria-label={`${side === 'x' ? 'X 方' : 'O 方'}名字`}
            />
        );
    };

    return (
        <div className="tt-page">
            <GameNav />
            <BackBar title="井字棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">入门首选 · Tic-Tac-Toe</div>
                    <h1 className="gp-hero__title">
                        井字棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        九格之间，三步定胜负。规则简单到一句话就能说清，
                        却藏着先手优势、双杀陷阱与封堵的取舍。
                        一分钟学会，慢慢品味其中的博弈乐趣。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">3 × 3 棋盘</span>
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
                                data-player={currentPlayer === O ? 'o' : 'x'}
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
                                <span className="gp-boardstat__label">X 棋子</span>
                                <strong>{marks.x}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">O 棋子</span>
                                <strong>{marks.o}</strong>
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
                            <span>点击空格落子</span>
                            <span>金色虚框是引擎推荐的最佳一手</span>
                            <span>横竖斜连成三子即胜</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--mark gp-chip--x">X</span>
                                    <span>{xName}</span>
                                    <strong>{marks.x}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--mark gp-chip--o">O</span>
                                    <span>{oName}</span>
                                    <strong>{marks.o}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="gp-dash__seg gp-dash__seg--x"
                                    style={{ width: `${xPct}%` }}
                                />
                                <span
                                    className="gp-dash__seg gp-dash__seg--o"
                                    style={{ width: `${oPct}%` }}
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
                                    <strong>{log.length}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>中心</b> 同时属于四条连线
                                </span>
                                <span className="gp-dash__tip">
                                    <b>角位</b> 优于边格
                                </span>
                                <span className="gp-dash__tip">
                                    <b>双杀</b> 让对手无法兼顾
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
                                        <p className="tt-first-note">
                                            井字棋由执 X 一方先行，选择「电脑先手」时电脑将执 X 开局。
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
                                        currentPlayer === X && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--mark gp-chip--x">X</span>
                                    {renderNameArea('x')}
                                    <strong key={`x-${marks.x}`} className="gp-score__value">
                                        {marks.x}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === O && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--mark gp-chip--o">O</span>
                                    {renderNameArea('o')}
                                    <strong key={`o-${marks.o}`} className="gp-score__value">
                                        {marks.o}
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
                                                        className={`gp-chip gp-chip--mark gp-chip--${
                                                            entry.player === X ? 'x' : 'o'
                                                        }`}
                                                    >
                                                        {entry.player === X ? 'X' : 'O'}
                                                    </span>
                                                    <span className="gp-log__label">
                                                        {entry.label}
                                                    </span>
                                                    {entry.winning && (
                                                        <span className="tt-log__tag">三连</span>
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
                            <div className="ui-eyebrow">关于井字棋</div>
                            <h2 className="ui-section-title">
                                最简单的规则，
                                <span className="ui-grad-text">最纯粹的博弈</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                井字棋又称三连棋，是一款几乎人人都会、却很少有人真正下明白的游戏。
                                它在 3×3 的九宫格中进行，双方轮流落子，
                                谁先把三个自己的标记连成一线，谁就赢下这一局。
                            </p>
                            <p>
                                它的规则只有一句话，但里面藏着完整的攻防逻辑：
                                中心与角格的价值差异、双杀式的必胜陷阱、以及「先看进攻再看防守」的决策顺序。
                                也正因为它足够小，你可以在几秒内复盘每一手，
                                从而把抽象的策略变成看得见的推理训练。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂井字棋</h2>
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
                        <h2 className="gp-cta__title">准备好连成一线了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想练练手速，还是只想在课间来一局，
                            井字棋都是最轻巧的脑力热身。现在就开始吧。
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

            <MoreGames currentId="tictactoe" />

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
                                <li>井字棋</li>
                                <li>黑白棋</li>
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
                names={{ black: xName, white: oName }}
                variant="mark"
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default TicTacToeGame;