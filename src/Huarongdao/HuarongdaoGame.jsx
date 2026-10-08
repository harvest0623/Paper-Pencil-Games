import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    DIFFICULTIES,
    getDifficulty,
    coordLabel,
    findEmpty,
    moveTile,
    canMove,
    isSolved,
    countPlaced,
    shuffleBoard,
    suggestMove
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Huarongdao.css';

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

/* 开一局新的会话 */
const createSession = (difficultyId) => {
    const conf = getDifficulty(difficultyId);
    const board = shuffleBoard(conf.size, conf.shuffle);
    return {
        size: conf.size,
        shuffle: conf.shuffle,
        initial: { board, log: [] }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    totalMoves: 0,
    best: { easy: null, medium: null, hard: null, expert: null },
    fewest: { easy: null, medium: null, hard: null, expert: null }
};

const FAQ_ITEMS = [
    {
        q: '数字华容道的规则是什么？',
        a: '棋盘上有一个空格，只有与空格上下左右相邻的方块才能滑进空格。通过一次次滑动，把数字按 1、2、3……的顺序从左上角依次排好，最后一格留空即算还原成功。'
    },
    {
        q: '每一局都保证可以还原吗？',
        a: '保证。本页的乱序棋盘不是随机摆放数字，而是从「已还原」的状态出发做若干次合法滑动得到的，因此一定存在还原路径，绝不会出现无解局面。'
    },
    {
        q: '难度之间有什么区别？',
        a: '难度决定棋盘尺寸与打乱步数：简单为 3×3，中等为 4×4（经典十五块），困难为 5×5，专家为 6×6。尺寸越大，需要提前规划的距离就越长。'
    },
    {
        q: '步数是怎么统计的？',
        a: '每成功滑动一次记一步，非法滑动不计入。使用「撤销」会同步回退一步，方便你重新规划路线。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎推荐的一步。它会比较所有合法走法，挑出能让整体局面更接近完成的一步，并用金色虚线标出。'
    },
    {
        q: '成绩会保存下来吗？',
        a: '会。完成局数、各难度的最佳用时与最少步数都会保存在浏览器本地，随时可以回来刷新自己的纪录。'
    }
];

const RULES = [
    {
        step: '01',
        title: '认识棋盘',
        desc: '棋盘是 N×N 的方格，其中恰好有一格是空的，其余格子依次填入数字，最后一格保持为空。'
    },
    {
        step: '02',
        title: '滑动方块',
        desc: '每次只能把与空格上下左右相邻的一个方块滑进空格，斜向的方块无法移动。'
    },
    {
        step: '03',
        title: '排好顺序',
        desc: '从左上角开始，让数字按 1、2、3……的顺序一行一行地排列整齐。'
    },
    {
        step: '04',
        title: '完成还原',
        desc: '当所有数字都回到自己的位置、空格落在右下角时，本局即告完成。'
    }
];

const TIPS = [
    { title: '先排好第一行', desc: '把 1、2、3 逐个送到第一行并保持不动，第一行锁定后再处理第二行，顺序感会清晰很多。' },
    { title: '再整理第一列', desc: '第一行完成后，用同样的思路处理左侧第一列，把已经归位的方块当成「墙」绕开。' },
    { title: '逐个推进', desc: '不要同时兼顾整盘，专注还原下一个数字，已完成的区域尽量不再打乱。' },
    { title: '空位要留出通道', desc: '空格是唯一的腾挪空间，移动前先想清楚它接下来要往哪儿去，避免把自己堵死。' },
    { title: '减少来回滑动', desc: '每一步都尽量让某个数字更靠近目标位置，来回绕圈的走法会迅速推高步数。' },
    { title: '用提示检验思路', desc: '卡住时点一次「提示」，观察引擎选择的方向，往往能发现自己一直忽略的腾挪路线。' }
];

const FEATURES = [
    { title: '保证可解的打乱', desc: '乱序棋盘由合法滑动生成，每一局都必然可以还原，永远不会遇到无解的坑。' },
    { title: '四档尺寸难度', desc: '从 3×3 入门到 6×6 极限挑战，难度越高路线越长，循序渐进地提升规划能力。' },
    { title: '智能提示引擎', desc: '一键比较所有合法走法，用金色虚框标出最接近完成的那一步，帮你打开思路。' },
    { title: '撤销与步数统计', desc: '支持逐步撤销并同步回退步数，随时回到上一步重新推演，不必担心走错。' },
    { title: '最佳用时与最少步数', desc: '按难度分别记录最佳用时与最少步数，让每一次进步都看得见。' },
    { title: '键盘也能玩', desc: '方向键可以直接驱动空位移动，配合鼠标点击操作，在桌面端更加顺手。' }
];

function HuarongdaoGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [moves, setMoves] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('hr.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('hr.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { board, log } = state;

    const size = session.size;
    const totalTiles = size * size - 1;
    const placed = useMemo(() => countPlaced(board), [board]);
    const remaining = totalTiles - placed;
    const progress = totalTiles ? Math.round((placed / totalTiles) * 100) : 0;

    const difficultyLabel = getDifficulty(difficulty).label;
    const difficultyDesc = getDifficulty(difficulty).desc;

    const bestTime = record.best?.[difficulty] ?? null;
    const fewestMoves = record.fewest?.[difficulty] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('hr.record', record), [record]);
    useEffect(() => safeSet('hr.sound', soundOn), [soundOn]);
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

    /* 开始新的一局 */
    const startNewGame = useCallback((difficultyId) => {
        const nextDifficulty = difficultyId ?? 'easy';
        const next = createSession(nextDifficulty);
        recordedRef.current = false;
        setDifficulty(nextDifficulty);
        setSession(next);
        setTimeline([next.initial]);
        setPhase('playing');
        setElapsed(0);
        setMoves(0);
        setHint(null);
        setToast('');
        setShowResult(false);
    }, []);

    /* 提交一份新的快照 */
    const commit = useCallback((nextBoard, logEntry) => {
        setTimeline((prev) => {
            const cur = prev[prev.length - 1];
            const nextLog = logEntry ? [...(cur?.log ?? []), logEntry] : (cur?.log ?? []);
            return [...prev, { board: nextBoard, log: nextLog }];
        });
    }, []);

    /* 完成一局的结算 */
    const finishGame = useCallback(
        (finalMoves) => {
            if (recordedRef.current) return;
            recordedRef.current = true;
            setPhase('over');
            setShowResult(true);
            sound.win();
            setRecord((prev) => {
                const best = { ...(prev.best ?? {}) };
                const fewest = { ...(prev.fewest ?? {}) };
                const curBest = best[difficulty];
                if (curBest == null || elapsed < curBest) best[difficulty] = elapsed;
                const curFewest = fewest[difficulty];
                if (curFewest == null || finalMoves < curFewest) fewest[difficulty] = finalMoves;
                return {
                    games: (prev.games ?? 0) + 1,
                    totalTime: (prev.totalTime ?? 0) + elapsed,
                    totalMoves: (prev.totalMoves ?? 0) + finalMoves,
                    best,
                    fewest
                };
            });
        },
        [difficulty, elapsed]
    );

    /* 滑动方块 */
    const handleTileClick = useCallback(
        (row, col) => {
            if (phase !== 'playing') return;
            if (!canMove(board, row, col)) {
                showToast('只能滑动与空格相邻的方块');
                return;
            }
            const next = moveTile(board, row, col);
            if (!next) return;

            const value = board[row][col];
            const target = findEmpty(board);
            commit(next, {
                label: coordLabel(row, col),
                text: `${value} → ${coordLabel(target.row, target.col)}`,
                tone: 'move'
            });

            setMoves((v) => v + 1);
            setHint(null);
            sound.place();

            if (isSolved(next)) finishGame(moves + 1);
        },
        [phase, board, moves, commit, showToast, finishGame]
    );

    /* 撤销上一步 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        recordedRef.current = false;
        setTimeline((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        setMoves((v) => Math.max(0, v - 1));
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        sound.click();
    }, [canUndo]);

    /* 提示：推荐一步更接近完成的滑动 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        const spot = suggestMove(board);
        if (!spot) {
            showToast('当前没有可以滑动的方块');
            return;
        }
        setHint(spot);
        showToast(`试试滑动 ${board[spot.row][spot.col]} 号方块`);
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);
    }, [phase, board, showToast]);

    /* 键盘：方向键移动空位 */
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const dirs = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1]
            };
            const dir = dirs[event.key];
            if (!dir) return;
            event.preventDefault();

            const empty = findEmpty(board);
            if (!empty) return;
            const row = empty.row + dir[0];
            const col = empty.col + dir[1];
            if (row < 0 || col < 0 || row >= size || col >= size) return;
            handleTileClick(row, col);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [board, size, handleTileClick]);

    const statusText = () => {
        if (phase === 'over') return '恭喜还原完成';
        if (remaining === 0) return '已完成';
        return `还剩 ${remaining} 块未归位`;
    };

    return (
        <div className="hr-page">
            <GameNav />
            <BackBar title="数字华容道" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">指尖腾挪 · Sliding Puzzle</div>
                    <h1 className="gp-hero__title">
                        数字华容道 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        棋盘上只有一个空位，每次只能把相邻的方块滑进空位。
                        用最少的步数，把打乱的数字重新排成 1、2、3……
                        看似简单，却最能磨炼你的规划与耐心。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">保证可解</span>
                        <span className="ui-tag">四档尺寸</span>
                        <span className="ui-tag">步数统计</span>
                        <span className="ui-tag ui-tag--gold">智能提示</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span className="gp-turnbar__dot" data-player="o" />
                            <span className="gp-turnbar__text">{statusText()}</span>
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">
                                    用时 {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>

                        <Board
                            board={board}
                            size={size}
                            hint={hint}
                            onTileClick={handleTileClick}
                            interactive={phase === 'playing'}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已归位</span>
                                <strong>{placed}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">打乱步数</span>
                                <strong>{session.shuffle}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击与空位相邻的方块即可滑动</span>
                            <span>金色虚框是引擎推荐的一步</span>
                            <span>数字按顺序排好、空格落在右下角即通关</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">还原进度</span>
                                <span className="gp-dash__lead">
                                    {placed} / {totalTiles} 块 · {progress}%
                                </span>
                            </div>
                            <div className="hr-progress">
                                <span className="hr-progress__fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前难度</span>
                                    <strong>{difficultyLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>已用步数</span>
                                    <strong>{moves}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>用时</span>
                                    <strong>{formatTime(elapsed)}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>未归位</span>
                                    <strong>{remaining}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>先排一行</b> 锁定 1、2、3 再往后
                                </span>
                                <span className="gp-dash__tip">
                                    <b>空位留路</b> 别把自己堵死
                                </span>
                                <span className="gp-dash__tip">
                                    <b>提示</b> 金色虚框指引方向
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg hr-diff">
                                {DIFFICULTIES.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            difficulty === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            if (item.id === difficulty) return;
                                            startNewGame(item.id);
                                            sound.click();
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="hr-diff__note">{difficultyDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startNewGame(difficulty)}
                                >
                                    重新开始
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleUndo}
                                    disabled={!canUndo}
                                >
                                    撤销
                                </button>
                                <button className="ui-btn ui-btn--ghost" onClick={handleHint}>
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

                        <div className="gp-card">
                            <h2 className="gp-card__title">我的战绩</h2>
                            <div className="gp-record">
                                <div className="gp-record__item">
                                    <strong>{record.games}</strong>
                                    <span>完成局数</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{bestTime != null ? formatTime(bestTime) : '—'}</strong>
                                    <span>{difficultyLabel}最佳</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{fewestMoves != null ? fewestMoves : '—'}</strong>
                                    <span>最少步数</span>
                                </div>
                            </div>
                            <div className="gp-record__bar">
                                <span
                                    className="gp-record__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="gp-record__note">
                                最佳用时与最少步数按当前难度分别记录
                                {avgTime ? ` · 平均用时 ${formatTime(avgTime)}` : ''}
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始滑动后，每一步都会记录在这里。</p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => (
                                            <li
                                                key={`${entry.label}-${log.length - index}`}
                                                className="gp-log__item"
                                            >
                                                <span className="gp-log__no">
                                                    {log.length - index}
                                                </span>
                                                <span className="gp-log__label">
                                                    {entry.label}
                                                </span>
                                                <span className={`hr-log__text is-${entry.tone}`}>
                                                    {entry.text}
                                                </span>
                                            </li>
                                        ))}
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
                            <div className="ui-eyebrow">关于数字华容道</div>
                            <h2 className="ui-section-title">
                                一个空位，
                                <span className="ui-grad-text">千百种腾挪</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数字华容道的原型是十九世纪风靡欧美的「十五数码」，
                                它把方块拼图的旋转变成了滑动：棋盘上只留一个空位，
                                所有移动都必须围绕它展开。
                                规则极其简单，解法却可以深不见底。
                            </p>
                            <p>
                                正因为只有一个空位，每一步都会牵动全局。
                                先排好哪一行、把空位停在哪里、是否要暂时牺牲已有的成果，
                                都是需要提前计算的选择。
                                当最后一个数字咔哒落位时，那种秩序回归的满足感，
                                正是它经久不衰的魅力。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数字华容道</h2>
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
                    <div className="ui-eyebrow">还原技巧</div>
                    <h2 className="ui-section-title">少走弯路的六条经验</h2>
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
                            <h2 className="ui-section-title">为滑动体验打磨的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们把保证可解的打乱、智能提示、步数统计与成绩记录都做成顺手的能力，
                            让你在电脑或手机上都能专注地享受腾挪的乐趣。
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
                        <h2 className="gp-cta__title">准备好把数字归位了吗？</h2>
                        <p className="gp-cta__desc">
                            从一个空位开始，用最少的步数让整盘数字回到秩序之中。
                            无论是三分钟的热身还是半小时的钻研，数字华容道都值得一试。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                startNewGame(difficulty);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="huarongdao" />

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
                                <li>数字华容道</li>
                                <li>数独</li>
                                <li>井字棋</li>
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

            {showResult && (
                <div className="gp-modal" role="dialog" aria-modal="true">
                    <div className="gp-modal__backdrop" onClick={() => setShowResult(false)} />
                    <div className="gp-modal__card is-win">
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">恭喜还原完成！</h3>
                        <p className="gp-modal__sub">
                            你用 {moves} 步、{formatTime(elapsed)} 完成了「{difficultyLabel}」难度
                            {size}×{size} 的数字华容道。
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>
                        <div className="gp-modal__actions">
                            <button
                                className="ui-btn ui-btn--primary"
                                onClick={() => startNewGame(difficulty)}
                            >
                                再来一局
                            </button>
                            <button
                                className="ui-btn ui-btn--ghost"
                                onClick={() => setShowResult(false)}
                            >
                                查看棋盘
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HuarongdaoGame;