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
    getLegalMoves,
    getMovesFrom,
    applyMove,
    finalizeState,
    countPieces,
    countKings,
    countCaptures,
    logLabel
} from './utils/gameLogic';
import { getAIMove, findHint } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Checkers.css';

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
        q: '有吃子机会时，必须先吃吗？',
        a: '是的。西洋跳棋采用强制吃子规则：轮到你走时，只要棋盘上存在任何一条吃子路线，所有普通移动都不允许，必须选择吃子。界面会把能吃子的棋子与落点高亮出来。'
    },
    {
        q: '连跳可以中途停下来吗？',
        a: '不可以。只要跳完之后还能继续跳，就必须一直跳到无路可跳为止。为了操作简洁，界面会标出完整连跳的终点（青色呼吸点），点一下就会自动走完整条路线并移除沿途的棋子。'
    },
    {
        q: '王棋和普通棋子有什么不同？',
        a: '普通棋子只能斜向前进一格、向前吃子；棋子走到对方的底线后会升为王，王可以沿四个斜向自由移动与吃子，进退皆可，威力大幅提升。'
    },
    {
        q: '怎样才算获胜？',
        a: '两种方式：一是吃光对方全部棋子；二是轮到对方走棋时，对方已经没有任何合法走法（被彻底堵死），同样判负。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎用困难档思路推荐的走法。起点与终点都会用金色虚框标出，若是连跳，还会用金色小点标出沿途经过的格子。'
    },
    {
        q: '为什么会出现平局？',
        a: '为了避免对局无限拖延，双方连续 40 回合（共 80 手）都没有吃子或升王时，本局自动判和。进入残局僵持后，记得主动寻找交换与突破。'
    }
];

const RULES = [
    {
        step: '01',
        title: '深格布子',
        desc: '8×8 棋盘只使用深色格。双方各 12 枚棋子，分别摆在上下各三行，蓝方在下方，红方在上方。'
    },
    {
        step: '02',
        title: '斜进一格',
        desc: '普通棋子每次只能沿斜前方走到相邻的空格。不能横走、不能后退，升王之后才获得四个方向的自由。'
    },
    {
        step: '03',
        title: '跳跃吃子',
        desc: '紧邻的斜前方有对方棋子、且它背后是空格时，就可以跳过去吃掉它。有吃子机会时必须吃，连跳也必须跳到底。'
    },
    {
        step: '04',
        title: '底线升王',
        desc: '棋子抵达对方底线即升为王，可以前后斜向移动与吃子。吃光对方棋子或让对方无子可动即获胜。'
    }
];

const TIPS = [
    {
        title: '守住自己的底线',
        desc: '后排棋子是对手升王的最后一道屏障。过早把后排棋子推出去，往往会给对方留下直达底线的通道。'
    },
    {
        title: '优先占据中路',
        desc: '中路的棋子活动范围最大，也更容易形成交叉的吃子威胁。边线的棋子虽然安全，却常常无处可去。'
    },
    {
        title: '算清每一次交换',
        desc: '吃子并不总是赚的。跳过去之后，自己的落点可能正被对手反吃。落子前先数一遍：这一换之后双方各剩多少子。'
    },
    {
        title: '主动制造二打一',
        desc: '让两枚棋子同时威胁对方同一枚棋子，对手只能挡住或放弃一边。经典的「二打一」是打开局面的关键手段。'
    },
    {
        title: '王的控制力在大斜线',
        desc: '升王后尽量让王控制长斜线，限制对手的活动范围。王不需要急着吃子，卡住路线往往更有价值。'
    },
    {
        title: '残局别急着兑子',
        desc: '残局中子力差会被放大。领先时用交换简化局面，落后时则要避免交换，把希望留给升王翻盘。'
    }
];

const FEATURES = [
    {
        title: '完整英式规则',
        desc: '强制吃子、连跳到底、底线升王与无子可动判负全部实现，规则细节一处不省。'
    },
    {
        title: '三档智能引擎',
        desc: '简单档随性落子，中等档会算交换，困难档做四层推演，越下越能感受到压力。'
    },
    {
        title: '双人同屏对弈',
        desc: '无需登录，和朋友轮流点击棋盘即可开战，蓝方与红方一目了然。'
    },
    {
        title: '必吃与连跳标记',
        desc: '有吃子机会时自动锁定吃子路线，会被吃掉的棋子用红色虚圈提示，连跳终点用青色呼吸点标出。'
    },
    {
        title: '悔棋与棋谱',
        desc: '支持逐步悔棋，人机模式会自动回到你的回合，棋谱完整记录每一手的起止格与吃子数。'
    },
    {
        title: '战绩与全端适配',
        desc: '自动统计人机战绩与胜率，手机、平板、桌面都能顺畅点击，支持触屏操作。'
    }
];

const createInitial = () => createInitialState('blue');

function CheckersGame() {
    const [mode, setMode] = useState('ai'); // ai | pvp
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);
    const [timeline, setTimeline] = useState(() => [createInitial()]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [names, setNames] = useState(() => safeGet('chk.names', { blue: '玩家', red: '玩家' }));
    const [record, setRecord] = useState(() =>
        safeGet('chk.record', { win: 0, loss: 0, draw: 0 })
    );
    const [soundOn, setSoundOn] = useState(() => safeGet('chk.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);

    const state = timeline[timeline.length - 1];
    const { board, turn, winner, draw, lastMove, log } = state;

    const aiPlayer = computerFirst ? 'blue' : 'red';
    const humanPlayer = computerFirst ? 'red' : 'blue';

    const thinking = phase === 'playing' && mode === 'ai' && turn === aiPlayer;
    const isHumanTurn =
        phase === 'playing' && turn && (mode === 'pvp' || turn === humanPlayer);

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

    const blueCount = countPieces(board, 'blue');
    const redCount = countPieces(board, 'red');
    const blueKings = countKings(board, 'blue');
    const redKings = countKings(board, 'red');
    const blueCaptures = countCaptures(log, 'blue');
    const redCaptures = countCaptures(log, 'red');

    const legalMoves = useMemo(() => getLegalMoves(state, turn), [state, turn]);
    const mustCapture = legalMoves.length > 0 && legalMoves[0].captures.length > 0;

    /* ---------------- 持久化与音效 ---------------- */
    useEffect(() => safeSet('chk.names', names), [names]);
    useEffect(() => safeSet('chk.record', record), [record]);
    useEffect(() => safeSet('chk.sound', soundOn), [soundOn]);
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

    const resetGame = useCallback(() => {
        setTimeline([createInitial()]);
        setPhase('playing');
        setElapsed(0);
        setToast('');
        setHint(null);
        setSelected(null);
        setShowResult(false);
        sound.click();
    }, []);

    /* ---------------- 落子 ---------------- */
    const commitMove = useCallback(
        (move) => {
            const cur = timeline[timeline.length - 1];
            if (!cur.turn || cur.winner || cur.draw) return;

            const next = finalizeState(applyMove(cur, move));
            setTimeline((prev) => [...prev, next]);
            setSelected(null);
            setHint(null);

            if (move.captures.length) sound.flip(Math.min(move.captures.length, 6));
            else sound.place();

            if (next.winner || next.draw) {
                setPhase('over');
                setShowResult(true);

                if (mode === 'ai') {
                    if (next.draw) {
                        setRecord((prev) => ({ ...prev, draw: prev.draw + 1 }));
                    } else if (next.winner === humanPlayer) {
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

            if (move.kinged) showToast('棋子抵达底线，升王成功');
            else if (move.captures.length > 1) showToast(`连跳吃子 ${move.captures.length} 枚`);
        },
        [timeline, mode, humanPlayer, showToast]
    );

    /* ---------------- 电脑回合 ---------------- */
    useEffect(() => {
        if (phase !== 'playing' || mode !== 'ai' || turn !== aiPlayer) return undefined;

        const timer = window.setTimeout(() => {
            const move = getAIMove(state, aiPlayer, difficulty);
            if (move) commitMove(move);
        }, 640);

        return () => window.clearTimeout(timer);
    }, [phase, mode, turn, aiPlayer, state, difficulty, commitMove]);

    /* ---------------- 点击格子 ---------------- */
    const destinations = useMemo(() => {
        if (!selected || !isHumanTurn || selected.player !== turn) return [];
        return legalMoves.filter((move) => move.from === selected.index);
    }, [selected, isHumanTurn, legalMoves, turn]);

    const handleSquareClick = useCallback(
        (index) => {
            if (!isHumanTurn) return;

            if (selected) {
                const move = destinations.find((item) => item.to === index);
                if (move) {
                    commitMove(move);
                    return;
                }
            }

            const piece = board[index];
            if (piece && piece.player === turn) {
                if (selected && selected.index === index) {
                    setSelected(null);
                    return;
                }
                setSelected({ player: turn, index });
                if (!getMovesFrom(state, turn, index).length) {
                    showToast(
                        mustCapture
                            ? '本回合必须吃子，请选择能跳跃的棋子'
                            : '这枚棋子暂时没有可走的位置'
                    );
                }
                sound.click();
                return;
            }

            if (selected) setSelected(null);
        },
        [
            isHumanTurn,
            selected,
            destinations,
            board,
            turn,
            state,
            mustCapture,
            commitMove,
            showToast
        ]
    );

    /* ---------------- 悔棋 ---------------- */
    const canUndo = timeline.length > 1 && phase !== 'over' && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let next = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (next.length > 1 && next[next.length - 1].turn !== humanPlayer) {
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
    }, [canUndo, timeline, mode, humanPlayer]);

    /* ---------------- 提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!isHumanTurn) return;
        const move = findHint(state, turn);
        if (!move) {
            showToast('暂时没有可走的路线');
            return;
        }
        setHint(move);
        setSelected({ player: turn, index: move.from });
        showToast(
            move.captures.length
                ? `推荐这条路线：连吃 ${move.captures.length} 枚`
                : '推荐落点已用金色虚框标出'
        );
        sound.click();

        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(null), 5000);
    }, [isHumanTurn, state, turn, showToast]);

    /* ---------------- 设置 ---------------- */
    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        resetGame();
    };

    const handleFirstChange = (first) => {
        const value = first === 'computer';
        if (value === computerFirst) return;
        setComputerFirst(value);
        resetGame();
    };

    /* ---------------- 派生数据 ---------------- */
    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const difficultyLabel =
        DIFFICULTY_OPTIONS.find((option) => option.id === difficulty)?.label ?? '—';

    const totalPieces = blueCount + redCount;
    const bluePct = totalPieces ? (blueCount / totalPieces) * 100 : 50;
    const redPct = 100 - bluePct;
    const leadText =
        totalPieces === 0
            ? '棋盘已空'
            : blueCount === redCount
              ? '双方子力持平'
              : `${nameOf(blueCount > redCount ? 'blue' : 'red')} 子力领先`;

    const statusText = () => {
        if (phase === 'over') {
            if (draw) return '本局平局';
            return `${nameOf(winner)} 获胜`;
        }
        if (thinking) return '电脑正在推演吃子路线…';
        return `${nameOf(turn)} ${mustCapture ? '必须吃子' : '走棋'}`;
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
                onChange={(e) =>
                    setNames((prev) => ({ ...prev, [player]: e.target.value }))
                }
                aria-label={`${player === 'blue' ? '蓝方' : '红方'}名字`}
            />
        );
    };

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (phase !== 'over') return null;
        const scores = { black: blueCount, white: redCount };

        if (draw) {
            return {
                tone: 'draw',
                title: '平局',
                sub: `双方连续 40 回合没有吃子或升王，本局以和棋收场。`,
                scores
            };
        }

        const winnerSide = winner;
        const how = state.reason === 'blocked' ? '让对方无子可动' : '吃光了对方的棋子';

        if (mode === 'ai') {
            const humanWon = winner === humanPlayer;
            return {
                scores,
                winnerSide,
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你${how}，用 ${log.length} 手、${formatTime(elapsed)} 拿下本局。`
                    : `电脑${how}，本局共 ${log.length} 手，用时 ${formatTime(elapsed)}。`
            };
        }

        return {
            scores,
            winnerSide,
            tone: 'win',
            title: `${nameOf(winner)} 获胜`,
            sub: `${nameOf(winner)}${how}，本局共 ${log.length} 手。`
        };
    }, [phase, draw, winner, blueCount, redCount, state.reason, mode, humanPlayer, log.length, elapsed, nameOf]);

    return (
        <div className="chk-page">
            <GameNav />
            <BackBar title="西洋跳棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">英式跳棋 · English Draughts</div>
                    <h1 className="gp-hero__title">
                        西洋跳棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        斜走一格，跳过吃子，走到对方底线即可升王。
                        强制吃子与连跳规则让每一步都带着代价，
                        看似安静的棋盘上，往往在三五手之内就分出高下。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">8 × 8 棋盘</span>
                        <span className="ui-tag">每方 12 子</span>
                        <span className="ui-tag">3 档 AI</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">升王规则</span>
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
                            board={board}
                            selected={selected}
                            destinations={destinations}
                            lastMove={lastMove}
                            hint={hint}
                            interactive={isHumanTurn}
                            onSquareClick={handleSquareClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">蓝方棋子</span>
                                <strong>{blueCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">红方棋子</span>
                                <strong>{redCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">升王（蓝 : 红）</span>
                                <strong>
                                    {blueKings} : {redKings}
                                </strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">手数</span>
                                <strong>{log.length}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点自己的棋子，再点高亮落点走子</span>
                            <span>白点普通走子，青色点吃子或连跳终点</span>
                            <span>红色虚圈是被吃掉的棋子</span>
                            <span>金色虚框是引擎推荐</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">局势</span>
                                <span className="gp-dash__lead">{leadText}</span>
                            </div>
                            <div className="gp-dash__sides">
                                <div className="gp-dash__side">
                                    <span className="gp-chip gp-chip--blue" />
                                    <span>{nameOf('blue')}</span>
                                    <strong>{blueCount}</strong>
                                </div>
                                <div className="gp-dash__side gp-dash__side--right">
                                    <span className="gp-chip gp-chip--red" />
                                    <span>{nameOf('red')}</span>
                                    <strong>{redCount}</strong>
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
                                    <span>吃子（蓝 : 红）</span>
                                    <strong>
                                        {blueCaptures} : {redCaptures}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>强制吃子</b> 有吃子机会就不能走普通步
                                </span>
                                <span className="gp-dash__tip">
                                    <b>连跳到底</b> 跳完还能跳就必须继续
                                </span>
                                <span className="gp-dash__tip">
                                    <b>底线升王</b> 王可以前后四个斜向行动
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
                                        <p className="chk-first-note">
                                            蓝方位于棋盘下方并先行；选择「电脑先手」时，电脑执蓝方开局。
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
                                    <strong key={`b-${blueCount}`} className="gp-score__value">
                                        {blueCount}
                                    </strong>
                                </div>
                                <div
                                    className={`gp-score__item ${
                                        turn === 'red' && phase === 'playing' ? 'is-active' : ''
                                    }`}
                                >
                                    <span className="gp-chip gp-chip--red" />
                                    {renderNameArea('red')}
                                    <strong key={`r-${redCount}`} className="gp-score__value">
                                        {redCount}
                                    </strong>
                                </div>
                            </div>
                            <p className="chk-note">
                                数字代表棋盘上剩余的棋子数，吃光对方或让对方无子可动即获胜。
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
                                    开始走棋后，每一手的起止格与吃子数都会记录在这里。
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
                                                    key={`${entry.from}-${entry.to}-${turnNo}`}
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
                                                    {entry.captures > 0 && (
                                                        <span className="chk-log__tag is-capture">
                                                            吃 {entry.captures}
                                                        </span>
                                                    )}
                                                    {entry.kinged && (
                                                        <span className="chk-log__tag is-king">
                                                            升王
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
                            <div className="ui-eyebrow">关于西洋跳棋</div>
                            <h2 className="ui-section-title">
                                一半的棋盘，
                                <span className="ui-grad-text">双倍的算计</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                西洋跳棋（English Draughts，常简称 Checkers）源自 12 世纪的法国，
                                由更古老的 Alquerque 棋演变而来。它在 8×8 的棋盘上只使用深色格，
                                双方各 12 枚棋子，规则简单到几句话就能讲完。
                            </p>
                            <p>
                                但强制吃子让这盘棋完全不同：你不能只挑想走的步子，
                                只要存在吃子路线，就必须走上去。于是每一次跳跃都可能把棋子送进对方的反吃范围，
                                每一次交换都要提前算清。简单规则之下，藏着非常纯粹的攻防计算。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂西洋跳棋</h2>
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
                            <h2 className="ui-section-title">为跳棋打磨的对局细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            强制吃子、连跳路线、升王与 AI 推演都在同一页里，
                            让你把注意力留给计算本身。
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
                        <h2 className="gp-cta__title">准备好走出第一步了吗？</h2>
                        <p className="gp-cta__desc">
                            从一次斜走开始，慢慢把棋子推进到可以升王的位置。
                            无论是想快速来一局，还是想和朋友认真对弈，西洋跳棋都很合适。
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

            <MoreGames currentId="checkers" />

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
                                <li>西洋跳棋</li>
                                <li>跳棋</li>
                                <li>九子棋</li>
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
                names={{ black: nameOf('blue'), white: nameOf('red') }}
                variant="blue"
                onRestart={resetGame}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default CheckersGame;
