import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    BLACK,
    WHITE,
    createState,
    otherPlayer,
    legalMoves,
    applyMove,
    captureTargets,
    countOnBoard,
    countMills,
    isFlying,
    phaseLabel,
    moveLabel,
    pointLabel
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './NineMensMorris.css';

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

const DIFFICULTY_OPTIONS = [
    { id: 'easy', label: '简单' },
    { id: 'medium', label: '中等' },
    { id: 'hard', label: '困难' }
];

const EMPTY_SET = new Set();

const FAQ_ITEMS = [
    {
        q: '什么时候可以吃对方的棋子？',
        a: '只要你落下或走动一步后，让己方三枚棋子连成一条直线（成三），就可以立刻吃掉对方一子。成三与吃子是同一回合内完成的，吃完才轮到对手。'
    },
    {
        q: '为什么有时不能吃三线上的棋子？',
        a: '规则规定：只要对方还有不在三线上的棋子，你就必须先吃那些棋子。只有当对方所有棋子都在三线上时，才允许从三线中拆一子——这是九子棋保护「成型结构」的关键设计。'
    },
    {
        q: '什么叫「飞子」？',
        a: '当一方盘面上只剩三枚棋子时，他就不再受相邻线的限制，可以把棋子落到任意空点。这是给劣势方的补偿机制，也让残局变得更加凶险。'
    },
    {
        q: '什么情况下会输？',
        a: '两种情况：一是你的棋子总数被吃到不足三枚；二是轮到你走子时所有棋子都被堵死、无处可动。想赢就要在减少对手子力的同时，避免让自己的棋子失去活动空间。'
    },
    {
        q: '为什么一直不吃子会判和？',
        a: '为了不让对局无限拖延，双方连续 50 手都没有吃到棋子时，本局自动判和。遇到僵持局面时，记得主动寻找突破点。'
    },
    {
        q: '悔棋会退回到哪一步？',
        a: '双人模式退回一步；人机对战会一直退回到你上一次落子之前，方便你换一个方案再试。'
    }
];

const RULES = [
    {
        step: '01',
        title: '布子阶段',
        desc: '双方各有 9 枚棋子，轮流把棋子放到 24 个空点上。棋盘由三个同心方环与四条辐条组成，棋子只能落在交点处。'
    },
    {
        step: '02',
        title: '成三吃子',
        desc: '三枚同色棋子连成一条直线即为「成三」，立刻吃掉对方任意一子。若对方还有不在三线上的棋子，则必须从这些棋子中选。'
    },
    {
        step: '03',
        title: '走子与飞子',
        desc: '9 枚棋子布完后进入走子阶段，棋子沿着相邻连线移动一格。当一方只剩三子时进入飞子阶段，可以落到任意空点。'
    },
    {
        step: '04',
        title: '胜负判定',
        desc: '把对方的棋子吃到只剩两枚，或者让对方所有棋子无处可走，即可获胜。双方连续 50 手没有吃子则判和。'
    }
];

const TIPS = [
    { title: '开局先抢双三', desc: '布子阶段的核心是「双三」：让若干条线都只差一子。对手挡住一条，你还能从另一条成三吃子。' },
    { title: '别急着吃外环', desc: '外环的棋子活动空间最大。吃子时优先拆掉对方内环的关键子，往往比吃外环更致命。' },
    { title: '留出活动空间', desc: '走子阶段最怕被堵死。宁可放弃一点进攻，也不要让自己的棋子只剩一条出路。' },
    { title: '盯住对手的三线', desc: '对方一旦有两条棋子连成的线，就要提前占住那个空点，用一子换掉他整条成三的机会。' },
    { title: '巧用飞子翻盘', desc: '进入飞子阶段并不等于认输。三子飞动时威胁反而更大，常常能连续成三、连吃对手两子。' },
    { title: '残局算准子力', desc: '残局阶段子力就是一切。每一次吃子都要算清楚：换完之后双方的子数与机动性会变成什么样。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档随手落子，中等档懂得成三与拦挡，困难档做四层搜索，兼顾子力、三线与机动性。' },
    { title: '成三高亮提示', desc: '每一步新连成的三线都会在棋盘上亮起金色连线，吃子目标用红色虚线脉冲标出，规则一目了然。' },
    { title: '双人同屏对战', desc: '无需登录，和朋友在同一台设备上轮流落子，随时复盘每一手。' },
    { title: '站内提示引擎', desc: '卡住时一键取回引擎推荐的那一手，金色虚线会同时在起点与终点亮起。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录布子、走子与吃子的每一步坐标。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，支持触屏与鼠标操作。' }
];

const createInitial = (firstPlayer) => createState(firstPlayer);

const logText = (entry) => {
    if (entry.type === 'place') return `布 ${entry.label}`;
    if (entry.type === 'capture') return `吃 ${entry.label}`;
    return entry.label;
};

function NineMensMorrisGame() {
    const [mode, setMode] = useState('ai');
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [selected, setSelected] = useState(null);

    /* 时间线：每个元素都是完整的一步局面，悔棋只需回退一步 */
    const [timeline, setTimeline] = useState(() => [createInitial(BLACK)]);
    const [showResult, setShowResult] = useState(false);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('nm.names', { human: '玩家', computer: '电脑', p1: '玩家 1', p2: '玩家 2' })
    );
    const [record, setRecord] = useState(() => safeGet('nm.record', { win: 0, loss: 0, draw: 0 }));
    const [soundOn, setSoundOn] = useState(() => safeGet('nm.sound', true));

    const toastTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { points, currentPlayer, phase, toPlace, pendingCapture, mill, lastMove, log } = state;
    const over = phase === 'over';
    const winner = over ? state.winner ?? null : null;

    const blackCount = countOnBoard(points, BLACK);
    const whiteCount = countOnBoard(points, WHITE);
    const blackMills = countMills(state, BLACK);
    const whiteMills = countMills(state, WHITE);

    const aiPlayer = computerFirst ? BLACK : WHITE;
    const humanPlayer = computerFirst ? WHITE : BLACK;
    const thinking = !over && mode === 'ai' && currentPlayer === aiPlayer;
    const isHumanTurn = !over && !thinking && (mode === 'pvp' || currentPlayer === humanPlayer);
    const flying = !over && isFlying(state, currentPlayer);

    /* ---------------- 音效 ---------------- */
    useEffect(() => {
        sound.setEnabled(soundOn);
        safeSet('nm.sound', soundOn);
    }, [soundOn]);

    useEffect(() => {
        safeSet('nm.names', names);
    }, [names]);

    useEffect(() => {
        safeSet('nm.record', record);
    }, [record]);

    const playerName = useCallback(
        (player) => {
            if (mode === 'ai') return player === humanPlayer ? names.human : names.computer;
            return player === BLACK ? names.p1 : names.p2;
        },
        [mode, humanPlayer, names]
    );

    /* ---------------- 提示条 ---------------- */
    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    /* ---------------- 计时：每走一步、每次重开都归零 ---------------- */
    useEffect(() => {
        if (over) return undefined;
        const timer = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => window.clearInterval(timer);
    }, [over, timeline]);

    /* ---------------- 落子 ---------------- */
    const commitMove = useCallback(
        (move) => {
            const next = applyMove(state, move);
            setTimeline((prev) => [...prev, next]);
            setSelected(null);
            setHint(null);

            if (move.type === 'capture') sound.flip(1);
            else sound.place();

            if (next.phase === 'over') {
                setShowResult(true);
                if (mode === 'ai') {
                    if (next.winner === null) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else if (next.winner === humanPlayer) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                } else if (next.winner !== null) {
                    sound.win();
                }
                return;
            }

            if (next.pendingCapture) {
                showToast('连成三子，请吃掉对方一子');
            } else if (move.type === 'capture') {
                showToast(`吃掉 ${pointLabel(move.to)}`);
            }
        },
        [state, mode, humanPlayer, showToast]
    );

    const handlePointClick = useCallback(
        (index) => {
            if (!isHumanTurn) return;

            if (pendingCapture) {
                if (!captureTargets(state).includes(index)) {
                    showToast('只能吃对方的棋子');
                    return;
                }
                commitMove({ type: 'capture', to: index });
                return;
            }

            if (phase === 'placing') {
                if (points[index]) {
                    showToast('这个落点已经有棋子了');
                    return;
                }
                commitMove({ type: 'place', to: index });
                return;
            }

            if (points[index] === currentPlayer) {
                setSelected((prev) => (prev === index ? null : index));
                sound.click();
                return;
            }

            if (points[index]) {
                showToast('只能移动自己的棋子');
                return;
            }

            if (selected === null) {
                showToast('请先点击自己的棋子');
                return;
            }

            const ok = legalMoves(state).some(
                (move) => move.type === 'move' && move.from === selected && move.to === index
            );
            if (ok) commitMove({ type: 'move', from: selected, to: index });
            else showToast(flying ? '飞子阶段请选择任意空位' : '这一步走不过去');
        },
        [
            isHumanTurn,
            pendingCapture,
            state,
            phase,
            points,
            currentPlayer,
            selected,
            flying,
            commitMove,
            showToast
        ]
    );

    /* ---------------- 电脑落子 ---------------- */
    useEffect(() => {
        if (over || mode !== 'ai' || currentPlayer !== aiPlayer) return undefined;
        const delay = pendingCapture ? 460 : 620;
        const timer = window.setTimeout(() => {
            const move = getAIMove(state, aiPlayer, difficulty);
            if (move) commitMove(move);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [over, mode, currentPlayer, aiPlayer, pendingCapture, state, difficulty, commitMove]);

    /* ---------------- 重开 / 设置 ---------------- */
    const reset = useCallback(() => {
        setTimeline([createInitial(BLACK)]);
        setSelected(null);
        setHint(null);
        setToast('');
        setShowResult(false);
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
            while (next.length > 1) {
                const last = next[next.length - 1];
                if (last.currentPlayer === humanPlayer && !last.pendingCapture) break;
                next = next.slice(0, -1);
            }
        }
        setTimeline(next);
        setSelected(null);
        setHint(null);
        setToast('');
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode, humanPlayer]);

    /* ---------------- 提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const move = getAIMove(state, currentPlayer, 'hard');
        if (!move) return;
        setHint(move);
        showToast(`推荐这一手：${moveLabel(move)}`);
        sound.click();
    }, [isHumanTurn, state, currentPlayer, showToast]);

    /* ---------------- 棋盘可点集合 ---------------- */
    const targets = useMemo(() => {
        if (!isHumanTurn) {
            return { selectable: EMPTY_SET, destinations: EMPTY_SET, captures: EMPTY_SET };
        }
        const moves = legalMoves(state);
        if (pendingCapture) {
            return {
                selectable: EMPTY_SET,
                destinations: EMPTY_SET,
                captures: new Set(moves.map((move) => move.to))
            };
        }
        if (phase === 'placing') {
            return {
                selectable: EMPTY_SET,
                destinations: new Set(moves.map((move) => move.to)),
                captures: EMPTY_SET
            };
        }
        if (selected !== null) {
            return {
                selectable: new Set([selected]),
                destinations: new Set(
                    moves.filter((move) => move.from === selected).map((move) => move.to)
                ),
                captures: EMPTY_SET
            };
        }
        return {
            selectable: new Set(moves.map((move) => move.from)),
            destinations: EMPTY_SET,
            captures: EMPTY_SET
        };
    }, [isHumanTurn, state, pendingCapture, phase, selected]);

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (!over) return null;
        const scores = { black: blackCount, white: whiteCount };
        if (winner === null) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '双方连续 50 手都没有吃子，本局以和棋收场。',
                scores
            };
        }

        const winnerSide = winner === BLACK ? 'black' : 'white';
        const blockedWin = state.reason === 'blocked';
        const how = blockedWin ? '把对方棋子彻底封死' : '把对方棋子吃到不足三枚';
        const loserHow = blockedWin ? '被彻底封死' : '棋子被吃到不足三枚';

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你${how}，拿下本局。`
                    : `电脑${how}，换个思路再来一局吧。`,
                scores,
                winnerSide
            };
        }

        const winnerName = playerName(winner);
        const loserName = playerName(otherPlayer(winner));
        return {
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName}${how}，${loserName}${loserHow}，本局告负。`,
            scores,
            winnerSide
        };
    }, [over, winner, blackCount, whiteCount, state, mode, humanPlayer, playerName]);

    /* ---------------- 名字编辑 ---------------- */
    const handleNameChange = useCallback((key, value) => {
        setNames((prev) => ({ ...prev, [key]: value }));
    }, []);

    const renderNameArea = (side) => {
        if (mode === 'ai') {
            if (side !== humanPlayer) {
                return <span className="gp-score__name-static">{names.computer}</span>;
            }
            return (
                <input
                    className="gp-name-input"
                    value={names.human}
                    maxLength={8}
                    onChange={(e) => handleNameChange('human', e.target.value)}
                    aria-label="我的名字"
                />
            );
        }
        const key = side === BLACK ? 'p1' : 'p2';
        return (
            <input
                className="gp-name-input"
                value={names[key]}
                maxLength={8}
                onChange={(e) => handleNameChange(key, e.target.value)}
                aria-label={`${side === BLACK ? '黑棋' : '白棋'}名字`}
            />
        );
    };

    /* ---------------- 局势数据 ---------------- */
    const totalOnBoard = blackCount + whiteCount;
    const blackPct = totalOnBoard ? Math.round((blackCount / totalOnBoard) * 100) : 50;
    const whitePct = 100 - blackPct;
    const leadText =
        totalOnBoard === 0
            ? '双方尚未落子'
            : blackCount === whiteCount
              ? '双方子力相当'
              : `${playerName(blackCount > whiteCount ? BLACK : WHITE)} 子力领先`;

    const pendingPlace = toPlace[BLACK] + toPlace[WHITE];
    const stageLabel = phaseLabel(state);
    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;

    const blackName = playerName(BLACK);
    const whiteName = playerName(WHITE);
    const difficultyLabel = DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const turnLabel = thinking
        ? pendingCapture
            ? '电脑正在选择吃哪一子…'
            : '电脑正在推演三线…'
        : over
          ? '本局已结束'
          : pendingCapture
            ? `${playerName(currentPlayer)} 成三，请吃子`
            : `轮到 ${playerName(currentPlayer)} · 执${currentPlayer === BLACK ? '黑' : '白'}`;

    const stageHint =
        phase === 'placing'
            ? '点击任意空点布下棋子'
            : pendingCapture
              ? '点击红色虚线标记的棋子将其吃掉'
              : flying
                ? '飞子阶段：点击自己的棋子，再点任意空位'
                : '点击自己的棋子，再点相邻的空位';

    return (
        <div className="nmm-page">
            <GameNav />
            <BackBar title="九子棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典对弈 · Nine Men's Morris</div>
                    <h1 className="gp-hero__title">
                        九子棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        三个同心方环、四条辐条、二十四枚落点。布子、成三、吃子、飞子依次登场，
                        规则几分钟就能学会，可真正让人上瘾的，是那条看似平静却步步紧逼的攻防长线。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">24 个落点</span>
                        <span className="ui-tag">每人 9 子</span>
                        <span className="ui-tag">3 档 AI 难度</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">成三吃子</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={currentPlayer === BLACK ? 'black' : 'white'}
                            />
                            <span className="gp-turnbar__text">{turnLabel}</span>
                            {thinking && <span className="gp-turnbar__spinner" aria-hidden="true" />}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">用时 {formatTime(elapsed)}</span>
                            </span>
                        </div>

                        <Board
                            points={points}
                            mill={mill}
                            lastMove={lastMove}
                            hint={hint}
                            selected={selected}
                            targets={targets}
                            onPointClick={handlePointClick}
                            interactive={isHumanTurn}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">黑棋</span>
                                <strong>{blackCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">白棋</span>
                                <strong>{whiteCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">待布</span>
                                <strong>{pendingPlace}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已走</span>
                                <strong>{log.length}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>{stageHint}</span>
                            <span>三子连线即可吃对方一子</span>
                            <span>金色虚线是引擎推荐的一手</span>
                            <span>子力不足三枚或被困死即判负</span>
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
                                    <strong>{blackCount}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--white" />
                                    <span>{whiteName}</span>
                                    <strong>{whiteCount}</strong>
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
                                    <span>当前阶段</span>
                                    <strong>{stageLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>成三（黑 : 白）</span>
                                    <strong>
                                        {blackMills} : {whiteMills}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>成三</b> 后立刻吃掉对方一子
                                </span>
                                <span className="gp-dash__tip">
                                    <b>优先拆内环</b> 限制对手的活动空间
                                </span>
                                <span className="gp-dash__tip">
                                    <b>三子飞子</b> 劣势方仍可翻盘
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
                                        <p className="nmm-first-note">
                                            九子棋由执黑一方先行。选择「电脑先手」时，电脑将执黑棋开局。
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
                                        currentPlayer === BLACK && !over ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--black" />
                                    {renderNameArea(BLACK)}
                                    <strong key={`b-${blackCount}`} className="gp-score__value">
                                        {blackCount}
                                    </strong>
                                </div>

                                <div
                                    className={`gp-score__item ${
                                        currentPlayer === WHITE && !over ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--white" />
                                    {renderNameArea(WHITE)}
                                    <strong key={`w-${whiteCount}`} className="gp-score__value">
                                        {whiteCount}
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
                                <p className="gp-log__empty">
                                    落子后将在这里记录布子、走子与吃子的坐标。
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
                                                    key={`${entry.label}-${turnNo}-${entry.type}`}
                                                    className="gp-log__item"
                                                >
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${entry.player}`}
                                                    />
                                                    <span className="gp-log__label">
                                                        {logText(entry)}
                                                    </span>
                                                    {entry.type === 'capture' && (
                                                        <span className="nmm-log__tag">吃子</span>
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
                            <div className="ui-eyebrow">关于九子棋</div>
                            <h2 className="ui-section-title">
                                规则的简单，
                                <span className="ui-grad-text">与棋理的深远</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                九子棋（Nine Men's Morris）的历史可以追溯到古罗马时代，在
                                欧洲、非洲与亚洲的古代遗迹中都留下过它的棋盘刻痕。它只用
                                三环一线和九枚棋子，却把「布局、连接、封锁、交换」这几件
                                事说透了。
                            </p>
                            <p>
                                它的乐趣不在记住规则，而在于那种缓慢的收紧：布子阶段抢建
                                三线，走子阶段一点点挤压对手的活动空间，直到对方的棋子被
                                逼到无路可走。每一步都安静，每一步都在收网。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂九子棋</h2>
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
                        <h2 className="gp-cta__title">准备好落下第一子了吗？</h2>
                        <p className="gp-cta__desc">
                            二十四点、九枚棋子、三个阶段，规则几分钟就能学会。
                            现在就开始，试试你能不能在飞子残局里完成一次翻盘。
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

            <MoreGames currentId="nine-mens-morris" />

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
                                <li>九子棋</li>
                                <li>点格棋</li>
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
                names={{ black: blackName, white: whiteName }}
                onRestart={reset}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default NineMensMorrisGame;
