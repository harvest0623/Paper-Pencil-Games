import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    getBoard,
    createInitialState,
    getMovesFrom,
    applyMove as applyMoveLogic,
    countOnGoal,
    getAIMove,
    findHint
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './ChineseCheckers.css';

const BOARD = getBoard();

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
        q: '跳棋该怎么玩？',
        a: '棋子每次可以走到相邻的空位，也可以跳过紧邻的一枚棋子、落到它背后的空位。跳过之后如果还能继续跳，就可以一鼓作气连跳，中途允许改变方向。目标是把全部 10 枚棋子送进对面的三角形阵营。'
    },
    {
        q: '为什么我只能走一格，不能跳？',
        a: '跳棋必须「隔一子」才能跳：前方相邻棋位要有棋子，且这枚棋子背后紧接着的空位必须是空的。相邻位置是空地时只能走一步；背后被墙或另一枚棋子挡住时也跳不过去。'
    },
    {
        q: '连跳可以中途停下吗？',
        a: '可以。每一次跳跃后的落点都是合法的终点，你可以随时停下，也可以继续跳到更远的位置。界面会把所有可落点都标成呼吸小点，青色代表连跳落点。'
    },
    {
        q: '怎样才算获胜？',
        a: '当一方的 10 枚棋子全部进入对面的三角形阵营时，这一方立即获胜。注意：进入目标阵营后通常不应再往外走，否则会拖慢自己的进度。'
    },
    {
        q: '金色虚圈是什么？',
        a: '那是你点击「提示」后，引擎推荐的落点。它会用困难档的思路评估所有合法走法，并用金色虚线圈出推荐位置，圆圈中央的呼吸点则告诉你这一步是单步还是连跳。'
    },
    {
        q: '可以先手选择吗？',
        a: '可以。在「对局设置」里把先手切换为「电脑先手」，重新开局后由电脑执蓝方先行；默认由你执蓝方先走。'
    }
];

const RULES = [
    {
        step: '01',
        title: '一步一挪',
        desc: '轮到的一方每次只能移动一枚棋子，可以走到任意一个相邻的空位，六个方向都允许。'
    },
    {
        step: '02',
        title: '隔子起跳',
        desc: '如果相邻棋位上有棋子，且它背后的位置是空的，就可以跳过去，落在那片空位上。自己的子和对手的子都可以作为跳板。'
    },
    {
        step: '03',
        title: '连续跳跃',
        desc: '跳过去之后若还能继续跳，就可以一直跳下去，中途允许改变方向。只要每一步都满足「隔一子、落空位」，就能一路飞驰。'
    },
    {
        step: '04',
        title: '对岸取胜',
        desc: '蓝方要把 10 枚棋子送进下方三角，红方则要送进上方三角。率先让全部棋子抵达对面阵营的一方获胜。'
    }
];

const TIPS = [
    { title: '别急着往外走', desc: '开局先把后方棋子向前推进，让棋子排成可以互相借力的队形，后续才跳得起来。' },
    { title: '善用对手的棋子', desc: '跳板不区分敌我，对手的棋子同样可以借力。观察全盘，最长的连跳路线往往由双方棋子共同搭成。' },
    { title: '先送最前面一枚', desc: '最靠前、最接近对面阵营的棋子最值得优先推进，它落位后还能成为后方棋子的跳板。' },
    { title: '保持中间走廊通畅', desc: '棋盘中央是六条路线交汇的地方，尽量不要把自己的棋子堵在走廊入口，留出连跳的通道。' },
    { title: '别把棋子困在角落', desc: '边角的棋位虽然安全，却很难接上连跳。推进时尽量让棋子在中央区域活动，路线会灵活很多。' },
    { title: '推进与收官分开算', desc: '进入目标三角后要按形状填满，先填最靠里的位置，再填外侧，避免自己挡住自己和后续棋子的落点。' }
];

const FEATURES = [
    { title: '完整跳棋规则', desc: '单步、隔子跳、连续变向连跳全部实现，落点实时高亮，规则细节一处不省。' },
    { title: '三档智能引擎', desc: '简单档随性走棋，中等档步步为营，困难档会推演你的最佳回应，越下越有压力。' },
    { title: '双人同屏对弈', desc: '无需登录，和朋友轮流点击棋盘即可开战，蓝色与红色阵营一目了然。' },
    { title: '智能提示落点', desc: '一键用金色虚圈标出推荐落点，并用呼吸点区分单步与连跳，卡住时也能继续。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，人机模式会自动回到你的回合，棋谱记录每一手的棋子与连跳次数。' },
    { title: '战绩与全端适配', desc: '自动统计人机战绩与胜率，手机、平板、桌面都能顺畅操作。' }
];

const INITIAL_STATE = (firstPlayer) => createInitialState(firstPlayer);

function ChineseCheckersGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [INITIAL_STATE('blue')]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [names, setNames] = useState(() => safeGet('cc.names', { blue: '玩家', red: '玩家' }));
    const [record, setRecord] = useState(() => safeGet('cc.record', { win: 0, loss: 0 }));
    const [soundOn, setSoundOn] = useState(() => safeGet('cc.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { pieces, turn, winner, lastMove, log } = state;

    const aiPlayer = computerFirst ? 'blue' : 'red';
    const humanPlayer = computerFirst ? 'red' : 'blue';

    const thinking = phase === 'playing' && mode === 'ai' && turn === aiPlayer;
    const isHumanTurn = phase === 'playing' && turn && (mode === 'pvp' || turn === humanPlayer);

    const nameOf = useCallback(
        (player) => {
            if (mode === 'ai' && player === aiPlayer) return '电脑';
            if (mode === 'pvp') {
                const stored = names[player];
                if (stored === '玩家') return player === 'blue' ? '玩家 1' : '玩家 2';
                return stored;
            }
            return names[player];
        },
        [mode, aiPlayer, names]
    );

    const blueOnGoal = useMemo(() => countOnGoal(pieces, 'blue'), [pieces]);
    const redOnGoal = useMemo(() => countOnGoal(pieces, 'red'), [pieces]);

    useEffect(() => safeSet('cc.names', names), [names]);
    useEffect(() => safeSet('cc.record', record), [record]);
    useEffect(() => safeSet('cc.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing') return;
        const id = setInterval(() => setElapsed((v) => v + 1), 1000);
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

    const resetGame = useCallback(() => {
        setTimeline([INITIAL_STATE('blue')]);
        setPhase('playing');
        setElapsed(0);
        setToast('');
        setHint(null);
        setSelected(null);
        setShowResult(false);
    }, []);

    /* 落子 */
    const commitMove = useCallback(
        (move) => {
            const cur = timeline[timeline.length - 1];
            if (!cur.turn || cur.winner) return;

            const next = applyMoveLogic(cur, move);
            setTimeline((prev) => [...prev, next]);
            setSelected(null);
            setHint(null);

            if (next.winner) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    if (next.winner === humanPlayer) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                } else {
                    sound.win();
                }
                return;
            }

            if (move.jumps > 1) sound.win();
            else sound.place();
        },
        [timeline, mode, humanPlayer]
    );

    /* 电脑回合 */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai' || turn !== aiPlayer) return;

        const timer = setTimeout(() => {
            const move = getAIMove(state, aiPlayer, difficulty);
            if (move) commitMove(move);
        }, 620);

        return () => clearTimeout(timer);
    }, [phase, mode, turn, aiPlayer, state, difficulty, commitMove]);

    /* 点击棋位：先选中自己的棋子，再点高亮落点落子 */
    const destinations = useMemo(() => {
        if (!selected || !isHumanTurn || selected.player !== turn) return [];
        return getMovesFrom(state, turn, selected.cell);
    }, [selected, isHumanTurn, state, turn]);

    const handleCellClick = (cell) => {
        if (!isHumanTurn) return;

        const move = destinations.find((item) => item.to === cell);
        if (move && selected) {
            commitMove(move);
            return;
        }

        const index = pieces[turn].indexOf(cell);
        if (index >= 0) {
            if (selected && selected.cell === cell) {
                setSelected(null);
            } else {
                setSelected({ player: turn, piece: index, cell });
                /* 后排棋子常被自家棋子挡住，给出明确反馈 */
                if (!getMovesFrom(state, turn, cell).length) {
                    showToast('这枚棋子暂时没有可走的落点');
                }
            }
            sound.click();
            return;
        }

        if (selected) setSelected(null);
    };

    const canUndo = timeline.length > 1 && phase !== 'over' && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let tl = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (tl.length > 1 && tl[tl.length - 1].turn !== humanPlayer) {
                tl = tl.slice(0, -1);
            }
        }
        setTimeline(tl);
        setPhase('playing');
        setSelected(null);
        setHint(null);
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode, humanPlayer]);

    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const move = findHint(state, turn);
        if (!move) {
            showToast('暂时没有可走的路线');
            return;
        }
        setHint({ from: move.from, to: move.to, jumps: move.jumps });
        setSelected({ player: turn, piece: move.piece, cell: move.from });
        showToast(move.jumps > 0 ? `推荐连跳 ${move.jumps} 格的落点` : '推荐落点已标出');
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);
    }, [isHumanTurn, state, turn, showToast]);

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        resetGame();
        sound.click();
    };

    const handleFirstChange = (first) => {
        const value = first === 'computer';
        if (value === computerFirst) return;
        setComputerFirst(value);
        resetGame();
        sound.click();
    };

    const totalGames = record.win + record.loss;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;

    const placed = blueOnGoal + redOnGoal;
    const bluePct = placed ? (blueOnGoal / placed) * 100 : 50;
    const redPct = 100 - bluePct;
    const leadText =
        placed === 0
            ? '双方都还没人到位'
            : blueOnGoal === redOnGoal
              ? '双方进度持平'
              : `${blueOnGoal > redOnGoal ? nameOf('blue') : nameOf('red')} 领先`;

    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const statusText = () => {
        if (phase === 'over') return `${nameOf(winner)} 完成全部归位`;
        if (thinking) return '电脑正在思考…';
        return `${nameOf(turn)} 走棋`;
    };

    const renderNameArea = (player) => {
        if (mode === 'ai' && player === aiPlayer) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={nameOf(player)}
                maxLength={8}
                onChange={(e) => setNames((prev) => ({ ...prev, [player]: e.target.value }))}
                aria-label={`${player === 'blue' ? '蓝方' : '红方'}名字`}
            />
        );
    };

    /* 结算数据 */
    const result = useMemo(() => {
        if (phase !== 'over' || !winner) return null;
        const scores = { black: blueOnGoal, white: redOnGoal };
        const base = {
            scores,
            winnerSide: winner
        };

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                ...base,
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你率先把 10 枚棋子全部送进对面阵营，用 ${state.log.length} 手、${formatTime(elapsed)} 拿下本局。`
                    : `电脑抢先完成全部归位，本局共 ${state.log.length} 手，用时 ${formatTime(elapsed)}。`
            };
        }

        return {
            ...base,
            tone: 'win',
            title: `${nameOf(winner)} 获胜`,
            sub: `${nameOf(winner)} 率先让 10 枚棋子抵达对面阵营，本局共 ${state.log.length} 手。`
        };
    }, [phase, winner, blueOnGoal, redOnGoal, mode, humanPlayer, nameOf, state.log.length, elapsed]);

    const logLabel = (entry) =>
        entry.jumps > 0 ? `${entry.piece + 1} 号 · 连跳 ${entry.jumps} 格` : `${entry.piece + 1} 号 · 单步`;

    return (
        <div className="cc-page">
            <GameNav />
            <BackBar title="跳棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">星形棋盘 · Chinese Checkers</div>
                    <h1 className="gp-hero__title">
                        跳棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        走一步，或者借一枚棋子一跃而过。
                        跳棋的乐趣在于「连跳」——只要路线顺畅，一枚棋子就能跨越半个棋盘。
                        把所有棋子送进对面的三角阵营，你就赢了。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">121 个棋位</span>
                        <span className="ui-tag">3 档 AI</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">连跳提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={turn === 'red' ? 'red' : 'blue'}
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
                            board={BOARD}
                            state={state}
                            selected={selected}
                            destinations={destinations}
                            lastMove={lastMove}
                            hint={hint}
                            interactive={isHumanTurn}
                            onCellClick={handleCellClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">蓝方到位</span>
                                <strong>{blueOnGoal} / 10</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红方到位</span>
                                <strong>{redOnGoal} / 10</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">手数</span>
                                <strong>{log.length}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点自己的棋子，再点高亮位置落子</span>
                            <span>白色呼吸点是单步，青色是连跳落点</span>
                            <span>金色虚圈是引擎建议的位置</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">归位进度</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--blue" />
                                    <span>{nameOf('blue')}</span>
                                    <strong>{blueOnGoal} / 10</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>{nameOf('red')}</span>
                                    <strong>{redOnGoal} / 10</strong>
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
                                    <b>借子搭桥</b> 对手的棋子也能当跳板
                                </span>
                                <span className="gp-dash__tip">
                                    <b>中央走廊</b> 连跳路线最密集
                                </span>
                                <span className="gp-dash__tip">
                                    <b>由内而外</b> 先填目标三角的里侧
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
                                                className={`ui-seg__item ${
                                                    !computerFirst ? 'is-active' : ''
                                                }`}
                                                onClick={() => handleFirstChange('player')}
                                            >
                                                我先手
                                            </button>
                                            <button
                                                className={`ui-seg__item ${
                                                    computerFirst ? 'is-active' : ''
                                                }`}
                                                onClick={() => handleFirstChange('computer')}
                                            >
                                                电脑先手
                                            </button>
                                        </div>
                                        <p className="cc-first-note">
                                            蓝方位于上方三角并先行；选择「电脑先手」时，电脑将执蓝方开局。
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
                                        turn === 'blue' && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--blue" />
                                    {renderNameArea('blue')}
                                    <strong key={`b-${blueOnGoal}`} className="gp-score__value">
                                        {blueOnGoal}
                                    </strong>
                                </div>
                                <div
                                    className={`gp-score__item ${
                                        turn === 'red' && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--red" />
                                    {renderNameArea('red')}
                                    <strong key={`r-${redOnGoal}`} className="gp-score__value">
                                        {redOnGoal}
                                    </strong>
                                </div>
                            </div>
                            <p className="cc-note">
                                数字代表已进入对面阵营的棋子数，集满 10 枚即获胜。
                            </p>
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
                                        <strong>{winRate}%</strong>
                                        <span>胜率</span>
                                    </div>
                                </div>
                                <div className="gp-record__bar">
                                    <div
                                        className="gp-record__fill"
                                        style={{ width: `${winRate}%` }}
                                    />
                                </div>
                                <p className="gp-record__note">共 {totalGames} 局 · 耗时 {formatTime(elapsed)}</p>
                            </div>
                        )}

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                棋谱
                                <span className="gp-card__count">{log.length} 手</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始走棋后，每一步都会记录在这里。</p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => {
                                            const turnNo = log.length - index;
                                            return (
                                                <li
                                                    key={`${entry.piece}-${turnNo}`}
                                                    className="gp-log__item"
                                                >
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${
                                                            entry.player === 'blue'
                                                                ? 'blue'
                                                                : 'red'
                                                        }`}
                                                    />
                                                    <span className="gp-log__label">
                                                        {logLabel(entry)}
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
                            <div className="ui-eyebrow">关于跳棋</div>
                            <h2 className="ui-section-title">
                                最简单的走法，
                                <span className="ui-grad-text">最酣畅的连跳</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                跳棋（Chinese Checkers）虽然名字里带着「中国」，
                                却诞生于 19 世纪末的德国，最初被称作「Stern-Halma」，
                                是 Halma 棋的一种星形变体。
                                它后来传入美国与亚洲，逐渐成为家喻户晓的棋盘游戏。
                            </p>
                            <p>
                                它的规则非常朴素：走一步，或者跳过一枚棋子。
                                但连跳机制让整盘棋有了惊人的张力——
                                一条搭好的跳跃路线，可以让一枚棋子在一回合内穿越半个棋盘。
                                于是每一次落子都不只是推进自己，也是在为对手或为后续棋子搭建跳板。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂跳棋</h2>
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
                            <h2 className="ui-section-title">为跳棋打磨的对局细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            完整规则、连跳高亮、AI 对手与棋谱复盘都在同一页里，
                            让你把注意力留给路线本身。
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
                        <h2 className="gp-cta__title">准备好跳向对岸了吗？</h2>
                        <p className="gp-cta__desc">
                            从一枚棋子的单步开始，慢慢搭出一条连跳的走廊。
                            无论是想快速来一局，还是想和朋友认真对弈，跳棋都很合适。
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

            <MoreGames currentId="chinese-checkers" />

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
                                <li>跳棋</li>
                                <li>五子棋</li>
                                <li>黑白棋</li>
                                <li>井字棋</li>
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
                names={{ black: nameOf('blue'), white: nameOf('red') }}
                variant="blue"
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default ChineseCheckersGame;
