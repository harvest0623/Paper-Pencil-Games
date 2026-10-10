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
    applyMove as sowStones,
    isGameOver,
    sweepRemaining,
    getScores,
    getValidMoves,
    otherPlayer,
    pitLabel,
    PLAYER_1,
    PLAYER_2
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Mancala.css';

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
        q: '曼卡拉的棋盘是怎么布局的？',
        a: '棋盘分上下两排，每排 6 个坑，两端各有一个竖直的宝库。玩家 1 使用下方 6 个坑与右端宝库，玩家 2 使用上方 6 个坑与左端宝库，开局每坑 4 粒石子，全盘共 48 粒。'
    },
    {
        q: '为什么落进宝库后还能再走一次？',
        a: '这是曼卡拉的核心节奏：当最后一粒石子恰好落进己方宝库，你可以立刻再走一步。连续命中宝库往往能一气呵成地扩大优势。'
    },
    {
        q: '捕获是怎么触发的？',
        a: '当你的最后一粒石子落在己方一个原本为空的坑里，且正对面对方坑中有石子时，你会把这一粒连同对面坑里的全部石子一起收入自己的宝库。'
    },
    {
        q: '对局什么时候结束？',
        a: '当任意一方的 6 个坑全部清空时对局立即结束，另一方坑中剩余的石子全部归入其宝库。最后比较双方宝库中的石子数量，多者获胜，相同则平局。'
    },
    {
        q: '可以让电脑先手吗？',
        a: '可以。在「对局设置」中把先手切换为「电脑先手」，重新开局后由电脑先行播种。'
    },
    {
        q: '棋盘上的金色虚线框是什么？',
        a: '那是你点击「提示」后，引擎为你计算出的当前推荐坑位，仅作参考，不影响正常对局。'
    }
];

const RULES = [
    {
        step: '01',
        title: '逐格播种',
        desc: '选中己方一个非空的坑，取出其中的全部石子，沿逆时针方向逐个坑放下一粒，经过己方宝库会放子，跳过对方宝库。'
    },
    {
        step: '02',
        title: '额外回合',
        desc: '如果最后一粒石子正好落入己方宝库，你可以立即再走一步，连续命中就能连续行动。'
    },
    {
        step: '03',
        title: '对位捕获',
        desc: '最后一粒落在己方空坑，且正对面对方坑中有石子时，把这一粒连同对面的全部石子一起收进宝库。'
    },
    {
        step: '04',
        title: '终局计分',
        desc: '任一方 6 个坑全部清空即结束，另一方坑中石子归其宝库。宝库石子多者胜，相同则平局。'
    }
];

const TIPS = [
    { title: '右坑优先', desc: '靠近己方宝库的坑更容易让最后一粒落库，从而赢得额外回合，值得优先考虑。' },
    { title: '蓄力宝库', desc: '前期多往宝库送子，稳稳积累分数优势，让对手始终处于追赶的位置。' },
    { title: '设伏捕获', desc: '留意与自己对位的坑，规划好落点顺序，等待时机用一粒石子收走对方一大把。' },
    { title: '别送空坑', desc: '留意与自己对位、而且自己已经清空的坑——对手很可能正好用一粒石子完成捕获。' },
    { title: '保留行动力', desc: '不要一次清空整排坑位，手上留几粒石子，才能维持后续的连续行动与威胁。' },
    { title: '算清终局', desc: '临近结束时预判哪一方会先清空坑位，及时把石子送进宝库，锁定最后的分数。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '基于 Minimax 与 Alpha-Beta 剪枝，困难档会搜索多步并正确评估额外回合的价值。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流播种，随时开局随时复盘。' },
    { title: '站内提示引擎', desc: '卡住时一键获取引擎推荐的坑位，用金色虚线框直观看到「最优一手」。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一手的坑位、捕获与额外回合，赛后轻松回看。' },
    { title: '胜负战绩统计', desc: '自动记录对人机的胜、负、平与胜率，数据保存在本地，见证你的进步。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，棋盘按视口自动缩放，支持触屏操作。' }
];

const INITIAL_STATE = () => ({
    board: createInitialBoard(),
    currentPlayer: PLAYER_1,
    lastIndex: null,
    log: []
});

function MancalaGame() {
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
        safeGet('mc.names', { p1: '玩家', p2: '玩家 2' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('mc.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('mc.sound', true));

    const toastTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, currentPlayer, lastIndex, log } = state;

    const sc = useMemo(() => getScores(board), [board]);

    const aiPlayer = computerFirst ? PLAYER_1 : PLAYER_2;
    const humanPlayer = otherPlayer(aiPlayer);

    const p1Name =
        mode === 'ai'
            ? aiPlayer === PLAYER_1
                ? '电脑'
                : names.p1
            : names.p1 === '玩家'
              ? '玩家 1'
              : names.p1;
    const p2Name = mode === 'ai' && aiPlayer === PLAYER_2 ? '电脑' : names.p2;

    const playerName = useCallback(
        (player) => (player === PLAYER_1 ? p1Name : p2Name),
        [p1Name, p2Name]
    );

    /* 电脑回合即「思考中」，由状态推导，避免在 effect 中同步 setState */
    const thinking = phase === 'playing' && mode === 'ai' && currentPlayer === aiPlayer;
    const isHumanTurn =
        phase === 'playing' && (mode === 'pvp' || currentPlayer === humanPlayer);

    useEffect(() => safeSet('mc.names', names), [names]);
    useEffect(() => safeSet('mc.record', record), [record]);
    useEffect(() => safeSet('mc.sound', soundOn), [soundOn]);
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
        (pitIndex) => {
            const cur = timeline[timeline.length - 1];
            const player = cur.currentPlayer;
            if (!player) return;

            const res = sowStones(cur.board, pitIndex);
            if (!res) return;

            const finished = isGameOver(res.board);
            const finalBoard = finished ? sweepRemaining(res.board) : res.board;

            const entry = {
                player,
                pit: pitIndex,
                label: pitLabel(pitIndex),
                stones: res.stones,
                capture: res.captured,
                extraTurn: res.extraTurn,
                end: finished
            };

            const nextState = {
                board: finalBoard,
                currentPlayer: finished ? null : res.extraTurn ? player : otherPlayer(player),
                lastIndex: res.lastIndex,
                log: [...cur.log, entry]
            };

            setTimeline((prev) => [...prev, nextState]);
            setHint(null);
            setElapsed(0);
            sound.place();
            if (res.captured > 0) sound.flip(res.captured);

            if (res.extraTurn) {
                showToast(`${playerName(player)} 落进宝库，再来一回合`);
            } else if (res.captured > 0) {
                showToast(`捕获 ${res.captured} 粒石子！`);
            }

            if (finished) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    const finalSc = getScores(finalBoard);
                    const draw = finalSc.p1 === finalSc.p2;
                    const humanWin =
                        humanPlayer === PLAYER_1
                            ? finalSc.p1 > finalSc.p2
                            : finalSc.p2 > finalSc.p1;
                    if (draw) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else if (humanWin) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                }
            }
        },
        [timeline, mode, humanPlayer, playerName, showToast]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai') return;
        if (currentPlayer !== aiPlayer) return;
        if (getValidMoves(board, aiPlayer).length === 0) return;

        const timer = setTimeout(() => {
            const pit = getAIMove(board, aiPlayer, difficulty);
            if (pit !== null && pit !== undefined) applyMove(pit);
        }, 620);

        return () => clearTimeout(timer);
    }, [phase, mode, currentPlayer, aiPlayer, board, difficulty, applyMove]);

    /* 结算内容（无 winnerSide：曼卡拉不区分黑白棋子） */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: sc.p1, white: sc.p2 };

        if (sc.p1 === sc.p2) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '双方宝库中的石子数量完全相同，握手言和。',
                scores
            };
        }

        const p1Won = sc.p1 > sc.p2;
        const winnerStore = p1Won ? sc.p1 : sc.p2;

        if (mode === 'ai') {
            const humanWon = humanPlayer === PLAYER_1 ? p1Won : !p1Won;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你的宝库收下 ${winnerStore} 粒石子，成功赢下本局。`
                    : `电脑的宝库收下 ${winnerStore} 粒石子，调整思路再来一局吧。`,
                scores
            };
        }

        const winnerName = p1Won ? p1Name : p2Name;
        return {
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName} 的宝库收下 ${winnerStore} 粒石子，赢得本局。`,
            scores
        };
    }, [phase, sc, mode, humanPlayer, p1Name, p2Name]);

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
        const pit = getAIMove(board, currentPlayer, 'hard');
        if (pit !== null && pit !== undefined) {
            setHint(pit);
            sound.click();
        }
    }, [isHumanTurn, board, currentPlayer]);

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

    const placed = sc.p1 + sc.p2;
    const p1Pct = placed ? (sc.p1 / placed) * 100 : 50;
    const p2Pct = 100 - p1Pct;
    const remaining = 48 - placed;
    const moveCount = timeline.length - 1;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const leadText =
        placed === 0
            ? '等待第一步播种'
            : sc.p1 === sc.p2
              ? '双方宝库持平'
              : `${sc.p1 > sc.p2 ? p1Name : p2Name} 领先 ${Math.abs(sc.p1 - sc.p2)} 粒`;

    const statusText = () => {
        if (phase === 'over') {
            if (sc.p1 === sc.p2) return '对局结束 · 平局';
            return `对局结束 · ${sc.p1 > sc.p2 ? p1Name : p2Name} 获胜`;
        }
        if (thinking) return '电脑正在思考…';
        if (!currentPlayer) return '对局结束';
        return `轮到 ${playerName(currentPlayer)} 播种`;
    };

    const renderNameArea = (seat) => {
        const isP1Seat = seat === 'p1';
        const isAiSeat = mode === 'ai' && aiPlayer === (isP1Seat ? PLAYER_1 : PLAYER_2);
        if (isAiSeat) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={isP1Seat ? p1Name : p2Name}
                maxLength={8}
                onChange={(e) => setNames((prev) => ({ ...prev, [seat]: e.target.value }))}
                aria-label={`${isP1Seat ? '下方' : '上方'}玩家名字`}
            />
        );
    };

    return (
        <div className="mc-page">
            <GameNav />
            <BackBar title="曼卡拉" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">古老播种 · Mancala / Kalah</div>
                    <h1 className="gp-hero__title">
                        曼卡拉 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        一把石子，一条跑道。沿着坑位一粒粒播种，让最后一粒落进自己的宝库，
                        顺手再把对手的一整坑收归己有——最简单的手势里，藏着环环相扣的算计。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">12 坑 2 宝库</span>
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
                                data-player={currentPlayer === PLAYER_2 ? 'p2' : 'p1'}
                            />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            {thinking && <span className="gp-turnbar__spinner" aria-hidden="true" />}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    本步用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            currentPlayer={currentPlayer}
                            lastIndex={lastIndex}
                            hint={hint}
                            onPitClick={applyMove}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">宝库 1</span>
                                <strong>{sc.p1}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">宝库 2</span>
                                <strong>{sc.p2}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">手数</span>
                                <strong>{log.length}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">坑内剩余</span>
                                <strong>{remaining}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击己方高亮的坑位即可播种</span>
                            <span>金色虚线框是引擎推荐的坑位</span>
                            <span>任一方的 6 个坑清空即结束，宝库多者胜</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip mc-chip--p1" />
                                    <span>{p1Name}</span>
                                    <strong>{sc.p1}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip mc-chip--p2" />
                                    <span>{p2Name}</span>
                                    <strong>{sc.p2}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="gp-dash__seg mc-seg--p1"
                                    style={{ width: `${p1Pct}%` }}
                                />
                                <span
                                    className="gp-dash__seg mc-seg--p2"
                                    style={{ width: `${p2Pct}%` }}
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
                                    <b>落宝库</b> 最后一粒进库可再走一步
                                </span>
                                <span className="gp-dash__tip">
                                    <b>对位空坑</b> 触发捕获收走对面
                                </span>
                                <span className="gp-dash__tip">
                                    <b>清坑即终局</b> 剩余石子归入宝库
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
                                        <p className="mc-first-note">
                                            选择「电脑先手」时，电脑将占据先手的下方一侧先行播种。
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
                                        currentPlayer === PLAYER_1 && phase === 'playing'
                                            ? 'is-active'
                                            : ''
                                    }`}
                                >
                                    <span className="gp-chip mc-chip--p1" />
                                    {renderNameArea('p1')}
                                    <strong key={`p1-${sc.p1}`} className="gp-score__value">
                                        {sc.p1}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === PLAYER_2 && phase === 'playing'
                                            ? 'is-active'
                                            : ''
                                    }`}
                                >
                                    <span className="gp-chip mc-chip--p2" />
                                    {renderNameArea('p2')}
                                    <strong key={`p2-${sc.p2}`} className="gp-score__value">
                                        {sc.p2}
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
                                <p className="gp-log__empty">
                                    播种后将在这里记录每一手的坑位与效果。
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
                                                        className={`gp-chip mc-chip--${
                                                            entry.player === PLAYER_1 ? 'p1' : 'p2'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">
                                                        {entry.label}
                                                    </span>
                                                    {entry.capture > 0 && (
                                                        <span className="mc-log__tag mc-log__tag--cap">
                                                            捕获 {entry.capture}
                                                        </span>
                                                    )}
                                                    {entry.extraTurn && (
                                                        <span className="mc-log__tag mc-log__tag--extra">
                                                            再来
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
                            <div className="ui-eyebrow">关于曼卡拉</div>
                            <h2 className="ui-section-title">
                                一条跑道，一把石子的
                                <span className="ui-grad-text">古老智慧</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                曼卡拉是世界上流传最久远的播种类棋戏之一，在非洲、中东与东南亚
                                都有各自的变体。它不需要棋子颜色，只用一把小石子与一排坑洞，
                                就能演绎出绵长的策略博弈。
                            </p>
                            <p>
                                玩法看似只是「一把把地撒石子」，实则每一步都在权衡：这粒石子会
                                停在哪里？是对手的坑，还是自己的宝库？会不会正好送给对手一次捕获？
                                当额外回合、对位捕获与终局清坑交织在一起，简单的手势就变成了精妙的算计。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂曼卡拉</h2>
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
                        <h2 className="gp-cta__title">准备好播种了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想锻炼布局思维，还是只想在午后放松一局，
                            曼卡拉都是娱乐与脑力训练的完美结合。现在就开始吧。
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

            <MoreGames currentId="mancala" />

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
                                <li>曼卡拉</li>
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
                names={{ black: p1Name, white: p2Name }}
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default MancalaGame;