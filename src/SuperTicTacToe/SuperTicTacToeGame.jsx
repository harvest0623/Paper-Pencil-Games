import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    createInitialState,
    applyMove as applyMoveLogic,
    getLegalMoves,
    getBigWinningSubs,
    countSubWins,
    subCoordLabel,
    X,
    O
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './SuperTicTacToe.css';

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
        q: '超级井字棋和普通井字棋有什么区别？',
        a: '普通井字棋只有一个 3×3 的棋盘；超级井字棋把九个井字棋拼成一个大棋盘，全盘共 81 格。你不仅要在一个子棋盘内连成三子，还要把赢下的子棋盘在大棋盘上连成一线。'
    },
    {
        q: '为什么我只能在某一个子棋盘里落子？',
        a: '这是超级井字棋的核心规则：你在子棋盘内落子的位置，决定了对手下一步必须去哪个子棋盘。例如在左上角子棋盘的「右下角」落子，对手下一步就只能去大棋盘的「右下角」子棋盘落子。'
    },
    {
        q: '什么是「自由落子」？',
        a: '当被指定的子棋盘已经分出胜负或已经下满时，就没有合法的指定格可落，此时对手获得自由落子权，可以落到任意一个尚未结束、尚未下满的子棋盘的空格中。'
    },
    {
        q: '怎样才算赢下整局？',
        a: '先在一个子棋盘内连成三子即可赢下该子棋盘；当你在整个大棋盘上把三个「赢下的子棋盘」连成一线时，就赢下整局。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑执 X 先行。'
    },
    {
        q: '金色虚线的方框是什么？',
        a: '那是你点击「提示」后，引擎为你计算出的当前推荐落点，仅作参考，不影响对局。'
    }
];

const RULES = [
    {
        step: '01',
        title: '九宫嵌套',
        desc: '大棋盘由 3×3 共九个子棋盘组成，每个子棋盘又是 3×3，全盘 81 格，双方轮流落子。'
    },
    {
        step: '02',
        title: '落点定战场',
        desc: '你在子棋盘内的落点位置，决定对手下一步必须去哪个子棋盘——一步棋就把对手送进你指定的战场。'
    },
    {
        step: '03',
        title: '先赢子棋盘',
        desc: '在某个子棋盘内连成三子即赢下该子棋盘，此后其中的格子不可再落子；若目标子棋盘已结束或已满，则对手自由落子。'
    },
    {
        step: '04',
        title: '子棋盘连线',
        desc: '当赢下的子棋盘在大棋盘上连成一线时赢得整局；若所有子棋盘都已结束或下满且无人连线，则本局平局。'
    }
];

const TIPS = [
    { title: '让对手被动', desc: '把对手送进对你有利、对他不利的子棋盘，让他的每一步都在替你布局。' },
    { title: '抢占中心子棋盘', desc: '中央的子棋盘参与四条大棋盘连线，价值最高，尽早拿下它能掌握全局主动。' },
    { title: '经营大棋盘连线', desc: '时刻留意自己赢下的子棋盘能否连成一线，两子一线时就要提防对手的封堵。' },
    { title: '控制自由落子', desc: '当指定格会把对手送进好位置时，宁可选择让目标子棋盘提前结束，逼出自由落子。' },
    { title: '别忽视局部', desc: '子棋盘内的双杀与封堵同样重要，赢下的每一个子棋盘都是大棋盘上的一颗棋子。' },
    { title: '算清战线', desc: '在多个子棋盘同时布局，让对手顾此失彼，才是超级井字棋最有效的进攻方式。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档带随机性出手，中等档浅层搜索，困难档深搜并附带节点与耗时上限，稳妥不卡顿。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，随时开局随时复盘。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的最优落点，用金色虚线框直观看到「最优一手」。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一手所在子棋盘与坐标，赢下子棋盘的一手会被特别标注。' },
    { title: '胜负战绩统计', desc: '自动记录对人机的胜、负、平与胜率，数据保存在本地，见证你的进步。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，大棋盘按视口自动缩放，支持触屏操作。' }
];

const INITIAL_STATE = () => createInitialState(X);

function SuperTicTacToeGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE()]);
    const [phase, setPhase] = useState('playing'); // playing | over
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('st.names', { x: '玩家', o: '玩家 2' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('st.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('st.sound', true));

    const toastTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, subWinners, currentPlayer, lastMove, forcedSub, bigWinner, draw, log } = state;

    const subWins = useMemo(
        () => ({ x: countSubWins(subWinners, X), o: countSubWins(subWinners, O) }),
        [subWinners]
    );
    const winSubs = useMemo(() => {
        const res = getBigWinningSubs(subWinners);
        return res ? res.subs : [];
    }, [subWinners]);

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

    /* 电脑回合即「思考中」，由状态推导，避免在 effect 中同步 setState */
    const thinking = phase === 'playing' && mode === 'ai' && currentPlayer === aiPlayer;
    const isHumanTurn =
        phase === 'playing' && (mode === 'pvp' || currentPlayer === humanPlayer);

    useEffect(() => safeSet('st.names', names), [names]);
    useEffect(() => safeSet('st.record', record), [record]);
    useEffect(() => safeSet('st.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 计时器：每步落子或重开时归零 */
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
        setTimeline([INITIAL_STATE()]);
        setPhase('playing');
        setToast('');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
    }, []);

    const applyMove = useCallback(
        (sub, row, col) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;

            const next = applyMoveLogic(cur, sub, row, col);
            if (!next) return;

            const entry = next.log[next.log.length - 1];
            setTimeline((prev) => [...prev, next]);
            setHint(null);
            setElapsed(0);
            sound.place();
            if (entry.subWon) sound.flip(3);

            if (next.bigWinner || next.draw) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    const humanWon = next.bigWinner === humanPlayer;
                    if (next.draw) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else if (humanWon) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                }
            }
        },
        [timeline, mode, humanPlayer]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return;
        if (currentPlayer !== aiPlayer) return;
        if (getLegalMoves(state).length === 0) return;

        const timer = setTimeout(() => {
            const move = getAIMove(state, aiPlayer, difficulty);
            if (move) applyMove(move.sub, move.row, move.col);
        }, 520);

        return () => clearTimeout(timer);
    }, [phase, mode, currentPlayer, aiPlayer, state, difficulty, applyMove]);

    /* 结算内容 */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: subWins.x, white: subWins.o };

        if (draw || !bigWinner) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '所有子棋盘都已结束或下满，大棋盘上双方都没能连成三个子棋盘。',
                scores
            };
        }

        if (mode === 'ai') {
            const humanWon = bigWinner === humanPlayer;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你赢下 ${scores.black > scores.white ? scores.black : scores.white} 个子棋盘并连成一线，拿下本局。`
                    : '电脑在子棋盘连线上抢先一步，换个思路再来一局吧。',
                scores,
                winnerSide: bigWinner === X ? 'x' : 'o'
            };
        }

        return {
            tone: 'win',
            title: `${playerName(bigWinner)} 获胜`,
            sub: `${playerName(bigWinner)} 赢下的子棋盘连成一线，赢得本局。`,
            scores,
            winnerSide: bigWinner === X ? 'x' : 'o'
        };
    }, [phase, draw, bigWinner, subWins, mode, humanPlayer, playerName]);

    /* 操作 */
    const canUndo = timeline.length > 1;

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
        setElapsed(0);
        sound.click();
    }, [canUndo, timeline, mode, humanPlayer]);

    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const move = getAIMove(state, currentPlayer, 'hard');
        if (move) {
            setHint(move);
            showToast('已为你标出推荐落点');
            sound.click();
        }
    }, [isHumanTurn, state, currentPlayer, showToast]);

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        setTimeline([INITIAL_STATE()]);
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
        setTimeline([INITIAL_STATE()]);
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        setElapsed(0);
        sound.click();
    };

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;

    const placed = subWins.x + subWins.o;
    const xPct = placed ? (subWins.x / placed) * 100 : 50;
    const oPct = 100 - xPct;
    const emptyCount = 81 - log.length;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const leadText =
        placed === 0
            ? '等待第一手落子'
            : subWins.x === subWins.o
              ? '双方子棋盘持平'
              : `${subWins.x > subWins.o ? xName : oName} 领先 ${Math.abs(
                    subWins.x - subWins.o
                )} 个子棋盘`;

    const statusText = () => {
        if (phase === 'over') {
            if (draw || !bigWinner) return '对局结束 · 平局';
            return `对局结束 · ${playerName(bigWinner)} 获胜`;
        }
        if (thinking) return '电脑正在思考…';
        if (!currentPlayer) return '对局结束';
        const where =
            forcedSub === null
                ? '自由落子'
                : `子棋盘 ${subCoordLabel(forcedSub)}`;
        return `轮到 ${playerName(currentPlayer)} 落子 · ${where}`;
    };

    const isFreeMove =
        phase === 'playing' && currentPlayer && forcedSub === null && log.length > 0;

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
        <div className="st-page">
            <GameNav />
            <BackBar title="超级井字棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">烧脑进阶 · Ultimate Tic-Tac-Toe</div>
                    <h1 className="gp-hero__title">
                        超级井字棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        九个井字棋嵌套成一个大棋盘。你在子棋盘内的落点，
                        会决定对手下一步必须踏入哪个战场——一步棋，既是进攻，也是布局。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">9 子棋盘 · 81 格</span>
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
                            {isFreeMove && <span className="st-free-tag">自由落子</span>}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    本步用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            subWinners={subWinners}
                            forcedSub={forcedSub}
                            currentPlayer={currentPlayer}
                            lastMove={lastMove}
                            winSubs={winSubs}
                            hint={hint}
                            onCellClick={applyMove}
                            interactive={isHumanTurn}
                            finished={phase === 'over'}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">X 子棋盘</span>
                                <strong>{subWins.x}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">O 子棋盘</span>
                                <strong>{subWins.o}</strong>
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
                            <span>在子棋盘的亮起区域点击空格落子</span>
                            <span>金色虚线框是引擎推荐的最佳一手</span>
                            <span>赢下的子棋盘在大棋盘上连成一线即胜</span>
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
                                    <strong>{subWins.x}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--mark gp-chip--o">O</span>
                                    <span>{oName}</span>
                                    <strong>{subWins.o}</strong>
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
                                    <span>下一步</span>
                                    <strong>
                                        {phase === 'over'
                                            ? '—'
                                            : forcedSub === null
                                              ? '自由落子'
                                              : subCoordLabel(forcedSub)}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>落点定战场</b> 一步决定对手去哪
                                </span>
                                <span className="gp-dash__tip">
                                    <b>自由落子</b> 目标子棋盘已结束时触发
                                </span>
                                <span className="gp-dash__tip">
                                    <b>子棋盘连线</b> 三个一线赢整局
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
                                        <p className="st-first-note">
                                            超级井字棋由执 X 一方先行，选择「电脑先手」时电脑将执 X 开局。
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
                                    <strong key={`x-${subWins.x}`} className="gp-score__value">
                                        {subWins.x}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === O && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--mark gp-chip--o">O</span>
                                    {renderNameArea('o')}
                                    <strong key={`o-${subWins.o}`} className="gp-score__value">
                                        {subWins.o}
                                    </strong>
                                </div>
                            </div>
                            <p className="st-score-note">数字为「已赢下的子棋盘数」。</p>
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
                                <p className="gp-log__empty">
                                    落子后将在这里记录每一手所在的子棋盘与坐标。
                                </p>
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
                                                    {entry.free && (
                                                        <span className="st-log__tag">自由</span>
                                                    )}
                                                    {entry.subWon && (
                                                        <span className="st-log__tag st-log__tag--won">
                                                            拿下子棋盘
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
                            <div className="ui-eyebrow">关于超级井字棋</div>
                            <h2 className="ui-section-title">
                                当井字棋
                                <span className="ui-grad-text">长出第二个维度</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                超级井字棋把九个普通的井字棋拼成一个大棋盘，全盘共 81 格。
                                它保留了「连成三子」的直观规则，却因为「落点决定对手战场」这一条，
                                把每一手都变成了攻守兼备的布局。
                            </p>
                            <p>
                                你在一子棋盘内落下的位置，会指定对手下一步只能去对应的子棋盘；
                                当那个子棋盘已经分出胜负或下满时，对手反而获得自由落子的机会。
                                于是「赢下一城」和「把对手逼进死角」成为同一件事，
                                整局棋因此拥有了远超普通井字棋的深度与变数。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂超级井字棋</h2>
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
                        <h2 className="gp-cta__title">准备好布局整盘了吗？</h2>
                        <p className="gp-cta__desc">
                            想在熟悉的井字棋里寻找更深的挑战，
                            超级井字棋会用 81 格与九个子棋盘，让你重新理解「一步千金」。现在就开始吧。
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

            <MoreGames currentId="super-tictactoe" />

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
                                <li>超级井字棋</li>
                                <li>井字棋</li>
                                <li>黑白棋</li>
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

export default SuperTicTacToeGame;