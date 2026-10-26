import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    COLOR_LABELS,
    SIZE,
    createInitialState,
    getLegalActions,
    applyAction,
    finalizeState,
    countColor,
    countRevealed,
    countHidden,
    countCaptures,
    actionLabel
} from './utils/gameLogic';
import { getAIAction, findHint } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Banqi.css';

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

const FAQ_ITEMS = [
    {
        q: '第一枚翻到什么颜色，我就执哪一方吗？',
        a: '是的。暗棋开局没有固定的红黑归属，先手玩家翻开的第一枚棋子是什么颜色，就先手玩家执什么颜色，另一方自动执另一种颜色。之后双方只能翻棋、移动或吃自己颜色的明子。'
    },
    {
        q: '暗棋可以直接吃吗？',
        a: '不能。所有背面朝上的棋子都不可以被移动、跳过或吃掉，必须先花一回合把它翻开。翻棋本身就是一种行动，翻完后轮到对方。'
    },
    {
        q: '炮是怎么吃子的？',
        a: '炮在不吃子时和其他棋子一样只能走一格；但吃子时必须沿横线或竖线，隔恰好一个棋子（这个棋子可以是任意颜色、也可以是暗棋），打到后面的第一枚对方明子上，距离不限。'
    },
    {
        q: '为什么兵卒可以吃帥將？',
        a: '暗棋的吃子关系是一个循环：帥/將 > 仕/士 > 相/象 > 俥/車 > 傌/馬 > 炮 > 兵/卒，而兵/卒又能吃帥/將。所以最小的兵卒反而是对方主帅的克星，而帥/將不能反过来吃兵卒。'
    },
    {
        q: '怎样才算获胜？',
        a: '吃光对方全部棋子（包括还没翻开的暗棋）即获胜；如果轮到对方行动时，对方已经没有任何合法行动（无棋可走），同样判负。'
    },
    {
        q: '金色虚框是什么？',
        a: '点击「提示」后，引擎会用困难档思路给出建议。翻棋时金色虚框会标在建议翻开的棋格上，走子时会标出起点与落点；提示只使用已翻开的信息，不会泄露暗棋身份。'
    },
    {
        q: '为什么会出现平局？',
        a: '如果连续 80 手既没有翻棋也没有吃子，说明局面陷入无意义的来回移动，本局自动判和。进入残局后请主动寻找交换或突破。'
    }
];

const RULES = [
    {
        step: '01',
        title: '全暗开局',
        desc: '红黑双方各 16 枚棋子随机背面朝上，铺满 4×8 棋盘。未翻开的暗棋不能被直接吃，也不能被越过。'
    },
    {
        step: '02',
        title: '翻棋定色',
        desc: '首翻者执该枚棋子的颜色。之后每回合可以翻开一枚暗棋，或者移动、吃自己的一枚明子。'
    },
    {
        step: '03',
        title: '一步一格',
        desc: '棋盘没有河界与九宫，所有棋子都只能上下左右走一格；吃子按棋种大小关系进行，同级可以互吃。'
    },
    {
        step: '04',
        title: '炮隔子打',
        desc: '炮平时只走一格，吃子时必须隔恰好一个棋子、距离不限。兵/卒可以吃帥/將，帥/將却吃不了兵/卒。'
    }
];

const TIPS = [
    {
        title: '记住每一枚翻开的棋',
        desc: '暗棋的信息就是优势。记住场上已经明了的棋种与位置，才能判断哪些暗棋值得冒险去翻。'
    },
    {
        title: '时刻给炮留一个炮架',
        desc: '炮的威力全在那一个「隔子」上。别把自己唯一的炮架走掉，也别在对方炮的直线上留下刚好一个挡子。'
    },
    {
        title: '用兵卒逼住对方主帅',
        desc: '兵卒是唯一能吃掉帥/將的棋子。哪怕只是一枚小卒贴在对方主帅身边，也能让它整局都不敢乱动。'
    },
    {
        title: '大子别太早出头',
        desc: '車、馬、炮一旦被小卒换掉就非常亏。让大子留在有掩护的位置，等对方的兵卒被清理后再发力。'
    },
    {
        title: '边角翻棋更安全',
        desc: '边角棋格的活动范围小，翻出来的棋子不容易立刻被围攻。局面不明时，先翻边角是性价比较高的选择。'
    },
    {
        title: '中央四格价值最高',
        desc: '越靠近中央，棋子可以走的方向越多，也越容易形成对炮线的控制。中局之后，尽量把明子往中央靠。'
    }
];

const FEATURES = [
    {
        title: '完整暗棋规则',
        desc: '全暗开局、首翻定色、一步一格、炮隔子打、兵卒擒王、同级互吃与困毙判负全部实现。'
    },
    {
        title: '不偷看底牌的 AI',
        desc: '电脑只根据已经翻开的棋子判断局势，暗棋的颜色与棋种对它同样未知，输赢全凭计算。'
    },
    {
        title: '双人同屏对弈',
        desc: '无需登录，和朋友轮流翻棋、走子即可开战；每一步的棋色与吃子都会即时记录。'
    },
    {
        title: '翻棋与吃子提示',
        desc: '选中自己的明子后，白点标出可走位置，红色虚圈标出可吃棋子；提示会用金色虚框给出建议。'
    },
    {
        title: '悔棋与完整棋谱',
        desc: '支持逐步悔棋，人机模式会自动回到你的回合；棋谱记录翻棋、走子与吃子的全部细节。'
    },
    {
        title: '战绩与全端适配',
        desc: '自动统计人机战绩与胜率并持久保存，手机、平板与桌面都能顺畅点击，支持触屏操作。'
    }
];

function BanqiGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [createInitialState(0)]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [names, setNames] = useState(() =>
        safeGet('bq.names', { one: '玩家', two: '玩家' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('bq.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('bq.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, players, currentPlayer, winner, draw, lastAction, log } = state;

    const thinking = phase === 'playing' && mode === 'ai' && currentPlayer === 1;
    const isHumanTurn =
        phase === 'playing' && currentPlayer !== null && (mode === 'pvp' || currentPlayer === 0);

    const displayName = useCallback(
        (index) => {
            if (mode === 'ai' && index === 1) return '电脑';
            const stored = names[index === 0 ? 'one' : 'two'];
            if (mode === 'pvp' && stored === '玩家') {
                return index === 0 ? '玩家 1' : '玩家 2';
            }
            return stored;
        },
        [mode, names]
    );

    const humanActions = useMemo(
        () => (isHumanTurn ? getLegalActions(state, currentPlayer) : []),
        [isHumanTurn, state, currentPlayer]
    );

    const targets = useMemo(() => {
        if (selected === null) return [];
        return humanActions.filter(
            (action) => action.kind !== 'flip' && action.from === selected
        );
    }, [humanActions, selected]);

    const redRevealed = countRevealed(board, 'red');
    const blackRevealed = countRevealed(board, 'black');
    const hiddenCount = countHidden(board);
    const redRemaining = countColor(board, 'red');
    const blackRemaining = countColor(board, 'black');

    /* ---------------- 持久化与音效 ---------------- */
    useEffect(() => safeSet('bq.names', names), [names]);
    useEffect(() => safeSet('bq.record', record), [record]);
    useEffect(() => safeSet('bq.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* ---------------- 计时 ---------------- */
    useEffect(() => {
        if (phase !== 'playing') return undefined;
        const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
        return () => window.clearInterval(id);
    }, [phase]);

    useEffect(
        () => () => {
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            if (hintTimer.current) window.clearTimeout(hintTimer.current);
        },
        []
    );

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2000);
    }, []);

    const resetGame = useCallback(
        (starter) => {
            const first = starter ?? (mode === 'ai' && computerFirst ? 1 : 0);
            setTimeline([createInitialState(first)]);
            setPhase('playing');
            setElapsed(0);
            setToast('');
            setHint(null);
            setSelected(null);
            setShowResult(false);
            sound.click();
        },
        [mode, computerFirst]
    );

    /* ---------------- 执行行动 ---------------- */
    const commitAction = useCallback(
        (action) => {
            const cur = timeline[timeline.length - 1];
            if (!cur || cur.winner || cur.draw || cur.currentPlayer === null) return;

            const next = finalizeState(applyAction(cur, action));
            setTimeline((prev) => [...prev, next]);
            setSelected(null);
            setHint(null);

            if (action.kind === 'flip') sound.flip(1);
            else if (action.kind === 'capture') sound.flip(3);
            else sound.place();

            if (next.winner || next.draw) {
                setPhase('over');
                setShowResult(true);

                if (mode === 'ai') {
                    if (next.draw) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else if (next.players[0] === next.winner) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                } else if (!next.draw) {
                    sound.win();
                }
                return;
            }

            if (action.kind === 'flip') {
                const char = next.lastAction.char;
                if (char === '帥' || char === '將') showToast(`翻出了 ${char}，主帅登场`);
            } else if (action.kind === 'capture') {
                showToast(`吃掉了 ${next.lastAction.capturedChar}`);
            }
        },
        [timeline, mode, showToast]
    );

    /* ---------------- 电脑回合 ---------------- */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai' || currentPlayer !== 1) return undefined;

        const timer = window.setTimeout(() => {
            const action = getAIAction(state, 1, difficulty);
            if (action) commitAction(action);
        }, 680);

        return () => window.clearTimeout(timer);
    }, [phase, mode, currentPlayer, state, difficulty, commitAction]);

    /* ---------------- 点击棋格 ---------------- */
    const handleCellClick = useCallback(
        (index) => {
            if (!isHumanTurn) return;

            const target = targets.find((action) => action.to === index);
            if (target) {
                commitAction(target);
                return;
            }

            const piece = board[index];
            if (piece && !piece.revealed) {
                commitAction({ kind: 'flip', from: null, to: index });
                return;
            }

            const myColor = players[currentPlayer];
            if (piece && piece.revealed && myColor && piece.color === myColor) {
                if (selected === index) {
                    setSelected(null);
                    return;
                }
                setSelected(index);
                const moves = humanActions.filter(
                    (action) => action.kind !== 'flip' && action.from === index
                );
                if (moves.length === 0) showToast('这枚棋子暂时没有可走的位置');
                sound.click();
                return;
            }

            if (selected !== null) setSelected(null);
            if (piece && piece.revealed) showToast('这不是你的棋子，无法移动');
        },
        [
            isHumanTurn,
            targets,
            commitAction,
            board,
            players,
            currentPlayer,
            selected,
            humanActions,
            showToast
        ]
    );

    /* ---------------- 悔棋 ---------------- */
    const canUndo = timeline.length > 1 && phase !== 'over' && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let next = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (next.length > 1 && next[next.length - 1].currentPlayer !== 0) {
                next = next.slice(0, -1);
            }
        }
        setTimeline(next);
        setPhase('playing');
        setSelected(null);
        setHint(null);
        setToast('');
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode]);

    /* ---------------- 提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const action = findHint(state, currentPlayer);
        if (!action) {
            showToast('暂时没有可行动的选择');
            return;
        }
        setHint(action);
        setSelected(action.kind === 'flip' ? null : action.from);
        showToast(
            action.kind === 'flip'
                ? '建议翻开这枚暗棋'
                : action.kind === 'capture'
                  ? '建议吃掉这枚棋子'
                  : '建议走到金色虚框位置'
        );
        sound.click();

        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(null), 5000);
    }, [isHumanTurn, state, currentPlayer, showToast]);

    /* ---------------- 设置 ---------------- */
    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        resetGame(nextMode === 'pvp' ? 0 : computerFirst ? 1 : 0);
    };

    const handleFirstChange = (first) => {
        const value = first === 'computer';
        if (value === computerFirst) return;
        setComputerFirst(value);
        resetGame(value ? 1 : 0);
    };

    /* ---------------- 派生数据 ---------------- */
    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((option) => option.id === difficulty)?.label ?? '—';

    const revealedTotal = redRevealed + blackRevealed;
    const redPct = (redRevealed / SIZE) * 100;
    const blackPct = (blackRevealed / SIZE) * 100;
    const leadText =
        revealedTotal === 0
            ? '翻开第一枚暗棋开始对局'
            : redRevealed === blackRevealed
              ? '双方明子数量持平'
              : `${redRevealed > blackRevealed ? '红方' : '黑方'}明子暂时领先`;

    const turnColor = currentPlayer === null ? null : players[currentPlayer];

    const statusText = () => {
        if (phase === 'over') {
            if (draw) return '本局平局';
            const winnerIndex = players.indexOf(winner);
            return `${displayName(winnerIndex === -1 ? 0 : winnerIndex)}（${COLOR_LABELS[winner]}）获胜`;
        }
        if (thinking) return '电脑正在翻棋推演…';
        if (!players[currentPlayer]) {
            return `${displayName(currentPlayer)} 翻开第一枚暗棋定色`;
        }
        return `${displayName(currentPlayer)} ${COLOR_LABELS[players[currentPlayer]]} · 走棋`;
    };

    const indexOfColor = (color) => {
        const index = players.indexOf(color);
        return index === -1 ? 0 : index;
    };

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: redRemaining, white: blackRemaining };

        if (draw) {
            return {
                tone: 'draw',
                title: '平局',
                sub: '连续 80 手没有翻棋也没有吃子，本局以和棋收场。',
                scores
            };
        }

        const winnerIndex = players.indexOf(winner);
        const winnerName = displayName(winnerIndex === -1 ? 0 : winnerIndex);
        const how = state.reason === 'blocked' ? '让对方无子可动' : '吃光了对方的棋子';

        if (mode === 'ai') {
            const humanWon = players[0] === winner;
            return {
                scores,
                winnerSide: winner,
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: `${winnerName}（${COLOR_LABELS[winner]}）${how}，本局共 ${log.length} 手，用时 ${formatTime(elapsed)}。`
            };
        }

        return {
            scores,
            winnerSide: winner,
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName}（${COLOR_LABELS[winner]}）${how}，本局共 ${log.length} 手。`
        };
    }, [
        phase,
        draw,
        redRemaining,
        blackRemaining,
        players,
        winner,
        state.reason,
        displayName,
        mode,
        log.length,
        elapsed
    ]);

    const modalNames = {
        black: displayName(indexOfColor('red')),
        white: displayName(indexOfColor('black'))
    };

    const renderNameInput = (index) => {
        if (mode === 'ai' && index === 1) {
            return <span className="gp-score__name-static">电脑</span>;
        }
        return (
            <input
                className="gp-name-input"
                value={displayName(index)}
                maxLength={8}
                onChange={(e) =>
                    setNames((prev) => ({
                        ...prev,
                        [index === 0 ? 'one' : 'two']: e.target.value
                    }))
                }
                aria-label={`${index === 0 ? '玩家一' : '玩家二'}名字`}
            />
        );
    };

    const renderPlayerRow = (index) => {
        const color = players[index];
        const revealed = color ? countRevealed(board, color) : 0;
        const captures = color ? countCaptures(log, color) : 0;

        return (
            <div
                key={index}
                className={`bq-player ${
                    currentPlayer === index && phase === 'playing' ? 'is-active' : ''
                }`}
            >
                <span className={`bq-side-mark is-${color || 'none'}`}>
                    {color === 'red' ? '红' : color === 'black' ? '黑' : '?'}
                </span>
                <div className="bq-player__info">
                    {renderNameInput(index)}
                    <span className="bq-player__sub">
                        {color
                            ? `${COLOR_LABELS[color]} · 吃子 ${captures}`
                            : '等待翻棋定色'}
                    </span>
                </div>
                <div className="bq-player__count">
                    <strong key={`${index}-${revealed}`}>{revealed}</strong>
                    <span>明子</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bq-page">
            <GameNav />
            <BackBar title="暗棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">暗棋 · Banqi</div>
                    <h1 className="gp-hero__title">
                        暗棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        三十二枚棋子全部背面朝上，翻开的第一枚决定你的棋色。
                        是运气先落子，还是记牌与算计走到最后，只有翻完最后一张才知道。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">4 × 8 棋盘</span>
                        <span className="ui-tag">32 枚暗子</span>
                        <span className="ui-tag">翻棋定色</span>
                        <span className="ui-tag">炮隔子吃</span>
                        <span className="ui-tag ui-tag--gold">三档 AI</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={turnColor || 'none'}
                            />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            {thinking && (
                                <span className="gp-turnbar__spinner" aria-hidden="true" />
                            )}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            selected={selected}
                            targets={targets}
                            lastAction={lastAction}
                            hint={hint}
                            interactive={isHumanTurn}
                            onCellClick={handleCellClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">剩余暗棋</span>
                                <strong>{hiddenCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红方明子</span>
                                <strong>{redRevealed}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">黑方明子</span>
                                <strong>{blackRevealed}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">手数</span>
                                <strong>{log.length}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点暗棋翻开，首翻决定你的棋色</span>
                            <span>点自己的明子选中，再点高亮位置行动</span>
                            <span>白点可走，红色虚圈可吃</span>
                            <span>炮吃子必须隔一个棋子</span>
                            <span>金色虚框是引擎提示</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>红方明子</span>
                                    <strong>{redRevealed}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--black" />
                                    <span>黑方明子</span>
                                    <strong>{blackRevealed}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__bar">
                                <span
                                    className="bq-bar__seg bq-bar__seg--red"
                                    style={{ width: `${redPct}%` }}
                                />
                                <span
                                    className="bq-bar__seg bq-bar__seg--black"
                                    style={{ width: `${blackPct}%` }}
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
                                    <span>已翻棋子</span>
                                    <strong>
                                        {revealedTotal} / {SIZE}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>首翻定色</b> 翻到什么颜色就执哪一方
                                </span>
                                <span className="gp-dash__tip">
                                    <b>炮隔一子</b> 炮吃子必须隔一个棋子
                                </span>
                                <span className="gp-dash__tip">
                                    <b>卒可擒王</b> 兵卒能吃帥將，帥將不能吃兵卒
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
                                            {DIFFICULTY_OPTIONS.map((option) => (
                                                <button
                                                    key={option.id}
                                                    className={`ui-seg__item ${
                                                        difficulty === option.id ? 'is-active' : ''
                                                    }`}
                                                    onClick={() => {
                                                        setDifficulty(option.id);
                                                        sound.click();
                                                    }}
                                                >
                                                    {option.label}
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
                                                我先翻
                                            </button>
                                            <button
                                                className={`ui-seg__item ${
                                                    computerFirst ? 'is-active' : ''
                                                }`}
                                                onClick={() => handleFirstChange('computer')}
                                            >
                                                电脑先翻
                                            </button>
                                        </div>
                                        <p className="bq-note">
                                            首翻者执该枚棋子的颜色，另一方自动执另一色；暗棋不可直接吃，必须先翻开。
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">对局双方</h2>
                            <div className="bq-players">
                                {renderPlayerRow(0)}
                                {renderPlayerRow(1)}
                            </div>
                            <p className="bq-note">
                                数字为已经翻开的明子数量；暗棋的身份在翻开前对双方都保密。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => resetGame()}
                                >
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
                                    onClick={() => setSoundOn((value) => !value)}
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
                                    翻开第一枚暗棋后，每一步的翻棋、走子与吃子都会记录在这里。
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
                                                    key={`${turnNo}-${entry.to}`}
                                                    className="gp-log__item"
                                                >
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${entry.color}`}
                                                    />
                                                    <span className="bq-log__label">
                                                        {actionLabel(entry)}
                                                    </span>
                                                    {entry.kind === 'flip' && (
                                                        <span className="bq-log__tag is-flip">
                                                            翻棋
                                                        </span>
                                                    )}
                                                    {entry.kind === 'capture' && (
                                                        <span className="bq-log__tag is-capture">
                                                            吃子
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
                            <div className="ui-eyebrow">关于暗棋</div>
                            <h2 className="ui-section-title">
                                牌面朝下，
                                <span className="ui-grad-text">算计在上</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                暗棋又叫半棋、翻棋，是从中国象棋演化出来的一种民间玩法。
                                它把整副象棋翻过来铺满 4×8 的棋盘，没有河界也没有九宫，
                                所有棋子都回到最朴素的走法：上下左右一格。
                            </p>
                            <p>
                                开局时没人知道哪一枚是自己的子。你必须先翻开，才能确定棋色、
                                组织进攻；而翻开的每一枚棋子，也会立刻成为对方的信息。
                                运气决定了开头，记牌、炮线与大小吃子的计算决定了结尾。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂暗棋</h2>
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
                            <h2 className="ui-section-title">为暗棋打磨的对局细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            暗棋的乐趣在于信息逐步揭开的过程，这里把翻棋、炮线与吃子关系都做得清清楚楚。
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
                        <h2 className="gp-cta__title">准备好翻开第一张牌了吗？</h2>
                        <p className="gp-cta__desc">
                            从一枚暗棋开始，慢慢摸清场上的颜色与棋种。
                            无论是想快速来一局，还是和朋友认真对弈，暗棋都很合适。
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

            <MoreGames currentId="banqi" />

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
                                <li>暗棋</li>
                                <li>中国象棋</li>
                                <li>西洋跳棋</li>
                                <li>九子棋</li>
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
                names={modalNames}
                variant="banqi"
                onRestart={() => resetGame()}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default BanqiGame;
