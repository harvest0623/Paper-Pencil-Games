import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    CELLS,
    PLAYER_COLORS,
    PLAYER_LABELS,
    createInitialState,
    applyRoll,
    rollDie,
    resolveLanding,
    findNextLink,
    rollLabel,
    countRolls,
    countLadders,
    countSnakes
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './SnakesAndLadders.css';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const DIE_PIPS = {
    1: ['c'],
    2: ['tl', 'br'],
    3: ['tl', 'c', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'c', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br']
};

const FAQ_ITEMS = [
    {
        q: '从哪里出发，怎样才算获胜？',
        a: '双方棋子都从第 1 格出发，轮流掷骰按点数前进。最先恰好停在 100 格的玩家获胜。掷骰后如果踩到梯子或蛇，会立即结算上升或下滑。'
    },
    {
        q: '点数超过 100 怎么办？',
        a: '本局采用「必须恰好抵达」规则：如果位置加上骰子点数超过 100，棋子原地不动，本回合结束，也不触发任何梯子或蛇。'
    },
    {
        q: '掷出 6 点有什么奖励？',
        a: '掷出 6 点且本局尚未结束时，可以立刻再掷一次，相当于多获得一个回合。如果连续掷出 6，就会连续获得额外回合。'
    },
    {
        q: '梯子和蛇会连锁触发吗？',
        a: '不会。一次掷骰只会结算一次梯子或蛇。例如踩到梯子升到某个格子，即使那个格子是蛇头，也不会继续下滑，本回合到此结束。'
    },
    {
        q: '为什么电脑没有难度选择？',
        a: '蛇梯棋是纯运气游戏，没有任何可决策的走法。电脑与玩家使用完全相同的掷骰规则，唯一的差别是谁先手，因此不需要额外的难度选项。'
    },
    {
        q: '提示按钮提示什么？',
        a: '点击「提示」会用金色虚框标出你当前所在的格，以及前方 6 步内最近的梯子或蛇。如果 6 步内没有任何梯子与蛇，只会高亮当前格，提醒你这一段是安全路。'
    },
    {
        q: '悔棋后点数会一样吗？',
        a: '不会。悔棋会回到上一次掷骰之前，但重新掷骰时点数会重新随机。因此悔棋可以换一次运气，但无法保证结果更好。'
    }
];

const RULES = [
    {
        step: '01',
        title: '掷骰前进',
        desc: '双方从第 1 格出发，轮流掷一枚六面骰，按点数沿着蛇形编号前进。掷出 6 点可以再掷一次。'
    },
    {
        step: '02',
        title: '梯子上行',
        desc: '停在第 4、9、21、28、36、51、71、80 格时，会立即顺着梯子爬到对应的更高格，瞬间拉近距离。'
    },
    {
        step: '03',
        title: '蛇头下滑',
        desc: '停在 17、54、62、64、87、93、95、98 格会撞上蛇头，直接滑回蛇尾所在的低处，前面的努力可能白费。'
    },
    {
        step: '04',
        title: '恰好抵达',
        desc: '必须恰好停在 100 格才算到达终点；点数超出时原地不动。一次移动只结算一次梯子或蛇，不会连锁。'
    }
];

const TIPS = [
    {
        title: '6 点是最有价值的点数',
        desc: '掷出 6 不只是多走六格，还能立刻再掷一次。连续掷出 6 时，往往能在一回合内拉开大段距离。'
    },
    {
        title: '记住梯子与蛇的位置',
        desc: '梯子集中在 4、9、21、28、36、51、71、80 格附近，蛇头则在 17、54、62、64、87、93、95、98 格。知道这些位置，才能看懂每一次落点。'
    },
    {
        title: '蛇头前一格最惊险',
        desc: '当你的位置距离某个蛇头只有 1 到 6 格时，那一小段路就是全场最危险的地方。掷骰前可以先看清风险。'
    },
    {
        title: '落后时不必焦虑',
        desc: '一条梯子就能从 28 格直接冲到 84 格。蛇梯棋的运气波动非常大，落后十几格在一条好梯面前都不算什么。'
    },
    {
        title: '残局看精确点数',
        desc: '当你距离 100 格不足 6 格时，只有特定的点数能让你获胜，其他点数都会原地不动。这是全盘最考验运气的时刻。'
    },
    {
        title: '把心态放平',
        desc: '这个游戏没有最优解，也没有必输的局。与其纠结某一次掷骰，不如享受每一步的意外与反转。'
    }
];

const FEATURES = [
    {
        title: '标准 10 × 10 棋盘',
        desc: '完整的 1–100 蛇形编号，8 条梯子与 8 条蛇的位置遵循经典布局，落点计算与真实棋盘一致。'
    },
    {
        title: '逐格移动动画',
        desc: '棋子会按点数一格一格前进，踩到梯子与蛇时再用慢速动画跳动，过程清楚不突兀。'
    },
    {
        title: '双人同屏与人机对战',
        desc: '无需登录即可和朋友轮流掷骰；人机模式中的电脑与你使用同一套规则，没有任何隐藏加成。'
    },
    {
        title: '骰子与音效反馈',
        desc: '六面骰带滚动动画，掷骰、前进、爬梯、遇蛇都有独立音效，并支持一键静音与记忆。'
    },
    {
        title: '悔棋与路线提示',
        desc: '支持悔棋重掷，提示会用金色虚框标出前方 6 步内的梯子或蛇，让你看清即将到来的运气。'
    },
    {
        title: '战绩与全端适配',
        desc: '自动统计人机战绩与胜率并持久保存，手机、平板与桌面都能顺畅操作，支持触屏。'
    }
];

function SnakesAndLaddersGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [createInitialState(0)]);
    const [phase, setPhase] = useState('playing'); // playing | rolling | over
    const [elapsed, setElapsed] = useState(0);
    const [die, setDie] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [visual, setVisual] = useState(null);
    const [hintCells, setHintCells] = useState([]);
    const [toast, setToast] = useState('');
    const [showResult, setShowResult] = useState(false);

    const [names, setNames] = useState(() =>
        safeGet('snl.names', { one: '玩家', two: '玩家' })
    );
    const [record, setRecord] = useState(() =>
        safeGet('snl.record', { win: 0, loss: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('snl.sound', true));

    const timelineRef = useRef(timeline);
    const busyRef = useRef(false);
    const runIdRef = useRef(0);
    const toastTimer = useRef(null);
    const hintTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { positions, currentPlayer, winner, lastEvent, log } = state;

    const aiIndex = 1;
    const humanIndex = 0;
    const thinking =
        phase === 'playing' && mode === 'ai' && currentPlayer === aiIndex;
    const isHumanTurn =
        phase === 'playing' &&
        currentPlayer !== null &&
        (mode === 'pvp' || currentPlayer === humanIndex);

    useEffect(() => {
        timelineRef.current = timeline;
    }, [timeline]);

    const displayName = useCallback(
        (index) => {
            if (mode === 'ai' && index === aiIndex) return '电脑';
            const stored = names[index === 0 ? 'one' : 'two'];
            if (mode === 'pvp' && stored === '玩家') {
                return index === 0 ? '玩家 1' : '玩家 2';
            }
            return stored;
        },
        [mode, names]
    );

    /* ---------------- 持久化与音效 ---------------- */
    useEffect(() => safeSet('snl.names', names), [names]);
    useEffect(() => safeSet('snl.record', record), [record]);
    useEffect(() => safeSet('snl.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* ---------------- 计时 ---------------- */
    useEffect(() => {
        if (phase === 'over') return undefined;
        const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
        return () => window.clearInterval(id);
    }, [phase]);

    useEffect(
        () => () => {
            runIdRef.current += 1;
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            if (hintTimer.current) window.clearTimeout(hintTimer.current);
        },
        []
    );

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    }, []);

    const resetGame = useCallback(
        (starter) => {
            runIdRef.current += 1;
            busyRef.current = false;
            const first = starter ?? (mode === 'ai' && computerFirst ? 1 : 0);
            setTimeline([createInitialState(first)]);
            setPhase('playing');
            setElapsed(0);
            setDie(null);
            setRolling(false);
            setVisual(null);
            setHintCells([]);
            setToast('');
            setShowResult(false);
            sound.click();
        },
        [mode, computerFirst]
    );

    /* ---------------- 掷骰与动画 ---------------- */
    const performRoll = useCallback(
        async (playerIndex) => {
            if (busyRef.current) return;

            const current = timelineRef.current[timelineRef.current.length - 1];
            if (!current || current.winner !== null) return;
            if (current.currentPlayer !== playerIndex) return;

            busyRef.current = true;
            const runId = runIdRef.current;
            const alive = () => runIdRef.current === runId;
            const stop = () => {
                busyRef.current = false;
            };

            setPhase('rolling');
            setHintCells([]);
            setRolling(true);

            /* 骰子滚动动画 */
            for (let i = 0; i < 7; i++) {
                setDie(rollDie());
                await sleep(55);
                if (!alive()) return stop();
            }

            const value = rollDie();
            setDie(value);
            setRolling(false);
            sound.flip(2);
            await sleep(230);
            if (!alive()) return stop();

            const from = current.positions[playerIndex];
            const landing = resolveLanding(from, value);
            const walkTo = landing.overshoot ? from : landing.landing;

            for (let position = from + 1; position <= walkTo; position++) {
                setVisual({ player: playerIndex, position });
                sound.place();
                await sleep(135);
                if (!alive()) return stop();
            }

            await sleep(130);
            if (!alive()) return stop();

            if (landing.via) {
                setVisual({ player: playerIndex, position: landing.position, jump: true });
                if (landing.via === 'ladder') sound.flip(4);
                else sound.place();
                await sleep(480);
                if (!alive()) return stop();
            }

            const next = applyRoll(current, value);
            setTimeline((prev) => [...prev, next]);
            setVisual(null);
            setRolling(false);
            setPhase('playing');
            busyRef.current = false;

            if (next.winner !== null) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    if (next.winner === humanIndex) {
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

            if (landing.overshoot) {
                showToast(`点数超出 100 格，棋子原地不动`);
            } else if (landing.via === 'ladder') {
                showToast(`${landing.landing} 格有梯子，直上 ${landing.position} 格`);
            } else if (landing.via === 'snake') {
                showToast(`${landing.landing} 格撞上蛇头，滑到 ${landing.position} 格`);
            } else if (value === 6) {
                showToast('掷出 6 点，可以再掷一次');
            }
        },
        [humanIndex, mode, showToast]
    );

    /* ---------------- 电脑回合 ---------------- */
    useEffect(() => {
        if (mode !== 'ai' || phase !== 'playing' || currentPlayer !== aiIndex) {
            return undefined;
        }
        const id = window.setTimeout(() => performRoll(aiIndex), 780);
        return () => window.clearTimeout(id);
    }, [mode, phase, currentPlayer, aiIndex, performRoll]);

    /* ---------------- 悔棋 ---------------- */
    const canUndo = timeline.length > 1 && phase === 'playing';

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        runIdRef.current += 1;
        busyRef.current = false;

        let next = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (next.length > 1 && next[next.length - 1].currentPlayer !== humanIndex) {
                next = next.slice(0, -1);
            }
        }

        setTimeline(next);
        setPhase('playing');
        setDie(null);
        setRolling(false);
        setVisual(null);
        setHintCells([]);
        setToast('');
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline, mode, humanIndex]);

    /* ---------------- 路线提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!isHumanTurn || busyRef.current) return;

        const position = positions[currentPlayer];
        const link = findNextLink(position);

        if (link) {
            setHintCells([position, link.number]);
            showToast(
                link.kind === 'ladder'
                    ? `前方 ${link.steps} 步有梯子：${link.number} 格升到 ${link.target} 格`
                    : `前方 ${link.steps} 步有蛇头：${link.number} 格滑到 ${link.target} 格`
            );
        } else {
            setHintCells([position]);
            showToast('未来 6 步内没有梯子或蛇，这段路很安全');
        }
        sound.click();

        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHintCells([]), 5200);
    }, [isHumanTurn, positions, currentPlayer, showToast]);

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
    const totalGames = record.win + record.loss;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;

    const blueRolls = countRolls(log, 0);
    const redRolls = countRolls(log, 1);
    const blueLadders = countLadders(log, 0);
    const blueSnakes = countSnakes(log, 0);
    const redLadders = countLadders(log, 1);
    const redSnakes = countSnakes(log, 1);

    const turnColor = currentPlayer === null ? null : PLAYER_COLORS[currentPlayer];
    const leader =
        positions[0] === positions[1]
            ? null
            : positions[0] > positions[1]
              ? 0
              : 1;

    const statusText = () => {
        if (phase === 'over') return `${displayName(winner)} 获胜`;
        if (phase === 'rolling') return '骰子滚动中…';
        if (thinking) return '电脑正在掷骰…';
        return `${displayName(currentPlayer)} 的回合`;
    };

    const buttonText = () => {
        if (phase === 'over') return '本局结束';
        if (phase === 'rolling') return '掷骰中…';
        if (thinking) return '电脑掷骰中…';
        if (isHumanTurn) return '掷骰子';
        return '等待中';
    };

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (phase !== 'over' || winner === null) return null;

        const scores = { black: positions[0], white: positions[1] };
        const winnerName = displayName(winner);

        if (mode === 'ai') {
            const humanWon = winner === humanIndex;
            return {
                scores,
                winnerSide: PLAYER_COLORS[winner],
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: `${winnerName}率先抵达 100 格，共掷骰 ${log.length} 次，用时 ${formatTime(elapsed)}。`
            };
        }

        return {
            scores,
            winnerSide: PLAYER_COLORS[winner],
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName}率先抵达 100 格，本局共掷骰 ${log.length} 次。`
        };
    }, [phase, winner, positions, mode, humanIndex, displayName, log.length, elapsed]);

    const renderNameInput = (index) => {
        if (mode === 'ai' && index === aiIndex) {
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
        const color = PLAYER_COLORS[index];
        const rolls = index === 0 ? blueRolls : redRolls;
        const ladders = index === 0 ? blueLadders : redLadders;
        const snakes = index === 0 ? blueSnakes : redSnakes;

        return (
            <div
                key={index}
                className={`snl-player ${
                    currentPlayer === index && phase !== 'over' ? 'is-active' : ''
                }`}
            >
                <span className={`gp-chip gp-chip--${color}`} />
                <div className="snl-player__info">
                    {renderNameInput(index)}
                    <span className="snl-player__sub">
                        掷骰 {rolls} 次 · 梯 {ladders} · 蛇 {snakes}
                    </span>
                </div>
                <div className="snl-player__pos">
                    <strong key={`${index}-${positions[index]}`}>
                        {positions[index]}
                    </strong>
                    <span>格</span>
                </div>
            </div>
        );
    };

    const pips = DIE_PIPS[die ?? 1] ?? DIE_PIPS[1];

    return (
        <div className="snl-page">
            <GameNav />
            <BackBar title="蛇梯棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">蛇梯棋 · Snakes and Ladders</div>
                    <h1 className="gp-hero__title">
                        蛇梯棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        从第 1 格出发，掷骰前进。一条梯子能把你送到半程之外，
                        一个蛇头又能把你打回原点附近。规则只需要一句话，结果却永远猜不到。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">10 × 10 棋盘</span>
                        <span className="ui-tag">8 条梯子</span>
                        <span className="ui-tag">8 条蛇</span>
                        <span className="ui-tag">恰好抵达 100</span>
                        <span className="ui-tag ui-tag--gold">掷出 6 再掷</span>
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
                            positions={positions}
                            visual={visual}
                            currentPlayer={currentPlayer}
                            hintCells={hintCells}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">蓝方格数</span>
                                <strong>{positions[0]}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红方格数</span>
                                <strong>{positions[1]}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">掷骰次数</span>
                                <strong>{log.length}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">剩余格数</span>
                                <strong>{Math.max(0, CELLS - Math.max(...positions))}</strong>
                            </div>
                        </div>

                        <div className="snl-roll">
                            <div
                                className={`snl-die${rolling ? ' is-rolling' : ''}${
                                    die === null ? ' is-idle' : ''
                                }`}
                                aria-hidden="true"
                            >
                                {pips.map((position) => (
                                    <span
                                        key={position}
                                        className={`snl-pip snl-pip--${position}`}
                                    />
                                ))}
                            </div>

                            <div className="snl-roll__main">
                                <span className="snl-roll__turn">
                                    {isHumanTurn
                                        ? `轮到 ${displayName(currentPlayer)}`
                                        : thinking
                                          ? '电脑正在掷骰'
                                          : phase === 'over'
                                            ? '本局已结束'
                                            : '等待掷骰'}
                                </span>
                                <button
                                    className="ui-btn ui-btn--primary snl-roll__btn"
                                    onClick={() => performRoll(currentPlayer)}
                                    disabled={!isHumanTurn}
                                >
                                    {buttonText()}
                                </button>
                            </div>

                            <div className="snl-roll__last">
                                <span>最近一手</span>
                                <strong>{lastEvent ? rollLabel(lastEvent) : '尚未掷骰'}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点「掷骰子」前进，轮到谁由状态栏显示</span>
                            <span>踩到梯子立即上行，撞上蛇头立刻下滑</span>
                            <span>掷出 6 点可以再掷一次</span>
                            <span>必须恰好停在 100 格才算到达</span>
                            <span>金色虚框是 6 步内的梯蛇提示</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">
                                    {positions[0] === CELLS || positions[1] === CELLS
                                        ? '已有棋子抵达终点'
                                        : leader === null
                                          ? '双方暂时并驾齐驱'
                                          : `${displayName(leader)} 领先 ${Math.abs(
                                                positions[0] - positions[1]
                                            )} 格`}
                                </span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--blue" />
                                    <span>{displayName(0)}</span>
                                    <strong>{positions[0]}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>{displayName(1)}</span>
                                    <strong>{positions[1]}</strong>
                                </div>
                            </div>

                            <div className="snl-progress">
                                <span
                                    className="snl-progress__fill is-blue"
                                    style={{ width: `${(positions[0] / CELLS) * 100}%` }}
                                />
                            </div>
                            <div className="snl-progress">
                                <span
                                    className="snl-progress__fill is-red"
                                    style={{ width: `${(positions[1] / CELLS) * 100}%` }}
                                />
                            </div>

                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>对战模式</span>
                                    <strong>{mode === 'ai' ? '人机对战' : '双人对战'}</strong>
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
                                    <span>终点规则</span>
                                    <strong>恰好 100</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>梯 / 蛇</span>
                                    <strong>
                                        {blueLadders + redLadders} /{' '}
                                        {blueSnakes + redSnakes}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>6 点再掷</b> 额外获得一次掷骰机会
                                </span>
                                <span className="gp-dash__tip">
                                    <b>超出不动</b> 超过 100 点时原地停留
                                </span>
                                <span className="gp-dash__tip">
                                    <b>不做连锁</b> 梯子与蛇每次只结算一次
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
                                <div className="gp-field">
                                    <span className="gp-field__label">先手</span>
                                    <div className="ui-seg gp-seg-full">
                                        <button
                                            className={`ui-seg__item ${
                                                !computerFirst ? 'is-active' : ''
                                            }`}
                                            onClick={() => handleFirstChange('player')}
                                        >
                                            我先掷
                                        </button>
                                        <button
                                            className={`ui-seg__item ${
                                                computerFirst ? 'is-active' : ''
                                            }`}
                                            onClick={() => handleFirstChange('computer')}
                                        >
                                            电脑先掷
                                        </button>
                                    </div>
                                </div>
                            )}

                            <p className="snl-note">
                                蛇梯棋没有可决策的走法，电脑与你使用完全相同的掷骰规则；
                                蓝方先手，掷出 6 点可额外再掷一次。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">对局双方</h2>
                            <div className="snl-players">
                                {renderPlayerRow(0)}
                                {renderPlayerRow(1)}
                            </div>
                            <p className="snl-note">
                                数值为棋子当前所在的格数，起点为第 1 格，终点为第 100 格。
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
                                    开始掷骰后，每一次点数、落点、梯子与蛇都会记录在这里。
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
                                                    key={`${turnNo}-${entry.player}-${entry.to}`}
                                                    className="gp-log__item"
                                                >
                                                    <span className="gp-log__no">{turnNo}</span>
                                                    <span
                                                        className={`gp-chip gp-chip--${
                                                            PLAYER_COLORS[entry.player]
                                                        }`}
                                                    />
                                                    <span className="snl-log__die">
                                                        {entry.die}
                                                    </span>
                                                    <span className="snl-log__label">
                                                        {rollLabel(entry)}
                                                    </span>
                                                    {entry.via === 'ladder' && (
                                                        <span className="snl-log__tag is-ladder">
                                                            梯
                                                        </span>
                                                    )}
                                                    {entry.via === 'snake' && (
                                                        <span className="snl-log__tag is-snake">
                                                            蛇
                                                        </span>
                                                    )}
                                                    {entry.overshoot && (
                                                        <span className="snl-log__tag is-over">
                                                            超出
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
                            <div className="ui-eyebrow">关于蛇梯棋</div>
                            <h2 className="ui-section-title">
                                一条梯子，
                                <span className="ui-grad-text">一次反转</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                蛇梯棋是全世界流传最广的儿童棋盘游戏之一，最早可以追溯到古印度的
                                「Moksha Patam」，原本用来讲述因果与轮回。后来它随着殖民与贸易传到英国，
                                变成了今天熟悉的 Snakes and Ladders。
                            </p>
                            <p>
                                它的规则简单到不需要任何策略：掷骰、前进、爬梯、躲蛇。
                                也正因为无法计算，每一局都充满了意外。领先的人可能被一个蛇头拉回半程，
                                落后的人也可能因为一条梯子直接冲进终点区。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂蛇梯棋</h2>
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
                    <div className="ui-eyebrow">玩法心得</div>
                    <h2 className="ui-section-title">把运气玩得明白一点</h2>
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
                            <h2 className="ui-section-title">为蛇梯棋打磨的对局细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            从骰子动画到梯蛇连线的绘制，再到每一步的落点结算，
                            这里把一个纯运气游戏做得足够清楚。
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
                        <h2 className="gp-cta__title">准备好掷出第一把骰子了吗？</h2>
                        <p className="gp-cta__desc">
                            从第 1 格开始，看看这一局会是梯子先来，还是蛇头先到。
                            无论是想快速来一局，还是和朋友一起碰碰运气，蛇梯棋都很合适。
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

            <MoreGames currentId="snakes-and-ladders" />

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
                                <li>蛇梯棋</li>
                                <li>暗棋</li>
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
                names={{ black: displayName(0), white: displayName(1) }}
                variant="blue"
                onRestart={() => resetGame()}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default SnakesAndLaddersGame;
