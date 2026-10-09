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
    createGrid,
    cloneGrid,
    coordLabel,
    placeMines,
    computeAdj,
    countFlags,
    countRevealedSafe,
    isWin,
    floodReveal,
    chordCells,
    findHint
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Minesweeper.css';

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

/* 统计已翻开的格子数量 */
const countOpened = (grid) => grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

/* 生成一局会话：地雷在首次点击后才布置，因此初始为 null */
const createSession = (difficultyId) => {
    const conf = getDifficulty(difficultyId);
    return {
        rows: conf.rows,
        cols: conf.cols,
        mineCount: conf.mines,
        mines: null,
        adj: null,
        initial: {
            reveal: createGrid(conf.rows, conf.cols, false),
            flag: createGrid(conf.rows, conf.cols, false),
            log: []
        }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    wins: 0,
    losses: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null, expert: null }
};

const FAQ_ITEMS = [
    {
        q: '扫雷的规则是什么？',
        a: '棋盘上藏着若干地雷，点开格子时，若是空地会显示周围八格中的雷数；如果点到了地雷，本局就失败了。把除地雷以外的所有格子全部翻开，就算获胜。'
    },
    {
        q: '第一次点击会踩雷吗？',
        a: '不会。本页地雷是在你第一次点开格子之后才布置的，并且会避开你点的这一格以及它周围的八格，所以开局必定安全，放心点。'
    },
    {
        q: '怎么插旗？',
        a: '在格子上点右键即可插旗或取消旗，用来标记你怀疑有雷的位置；也可以切换到「插旗」模式，用左键点击。旗子数量不会超过总雷数，帮助你锁定目标。'
    },
    {
        q: '数字代表什么？',
        a: '数字表示这个格子周围八格中地雷的数量。比如显示 3，就说明它的八邻域里恰有 3 颗雷，其余相邻格子都是安全的。'
    },
    {
        q: '一键展开是怎么用的？',
        a: '当你把一个数字周围的雷都插好旗之后，再点击这个数字格，就会自动翻开它周围所有还没翻开的格子。如果旗插错了，也可能因此踩雷，务必先确认。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎根据当前棋盘推算出的结果：若某个格子必定安全，会直接帮你翻开；若某格必定是雷，会替你插上旗。推不出来时会提示你换个区域。'
    }
];

const RULES = [
    {
        step: '01',
        title: '翻开格子',
        desc: '左键点开一个格子。首点及其周围八格保证没有雷，开局永远安全。'
    },
    {
        step: '02',
        title: '读懂数字',
        desc: '数字表示周围八格里的地雷数量。数字越大，周围的雷就越密集。'
    },
    {
        step: '03',
        title: '插旗标记',
        desc: '右键在可疑的格子上插旗。旗子用完就不能再插，可以用来约束判断。'
    },
    {
        step: '04',
        title: '清空雷区',
        desc: '把所有没有雷的格子全部翻开即获胜；点开任意一颗地雷，本局立即失败。'
    }
];

const TIPS = [
    { title: '从零开始扩散', desc: '点开一个周围没有雷的格子时，会自动展开一整片空地，这是最有效率的开局方式。' },
    { title: '数字就是约束', desc: '把数字当作条件：周围雷数已满就说明其余邻格安全，邻格数等于雷数就说明它们全是雷。' },
    { title: '先标确定的雷', desc: '遇到「隐藏格数量刚好等于剩余雷数」的情形，先插旗锁定，往往能连锁推出更多安全格。' },
    { title: '善用一键展开', desc: '旗插准之后点击数字格一键展开，能大幅减少重复点击，也更快逼近胜利。' },
    { title: '避免盲目猜测', desc: '尽量不要随机乱点。多处线索互相印证之后，绝大多数局面都能纯靠推理破解。' },
    { title: '卡住就用提示', desc: '确实推不动时按一次「提示」，让引擎帮你找出必定安全或必定有雷的格子，重新找到节奏。' }
];

const FEATURES = [
    { title: '首点必定安全', desc: '地雷在首次点击后才布置并避开首点与八邻域，开局不会因运气直接阵亡。' },
    { title: '四档经典难度', desc: '从 9×9 入门到 16×24 专家局，雷数与密度逐级提升，循序渐进地挑战。' },
    { title: '插旗与一键展开', desc: '支持右键插旗、旗数约束，以及数字周围自动展开，操作贴近经典扫雷的手感。' },
    { title: '智能提示引擎', desc: '一键推算必定安全的格子或必定有雷的格子，用金色虚框标出，卡住时也能继续。' },
    { title: '撤销与计时', desc: '支持逐步撤销并自动回退步数，配合自动计时，随时复盘自己的判断过程。' },
    { title: '战绩与胜率', desc: '完成局数、胜率与各难度最佳用时都保存在本地，一步步见证自己变强。' }
];

function MinesweeperGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [phase, setPhase] = useState('idle');
    const [result, setResult] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [moves, setMoves] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [boom, setBoom] = useState(null);
    const [focus, setFocus] = useState(null);
    const [flagMode, setFlagMode] = useState(false);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('ms.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('ms.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { reveal, flag, log } = state;

    const { rows, cols, mineCount, mines, adj } = session;

    const flagsUsed = useMemo(() => countFlags(flag), [flag]);
    const remainingMines = Math.max(0, mineCount - flagsUsed);
    const openedSafe = useMemo(() => countRevealedSafe(reveal, mines), [reveal, mines]);
    const safeTotal = rows * cols - mineCount;
    const progress = safeTotal ? Math.round((openedSafe / safeTotal) * 100) : 0;

    const difficultyLabel = getDifficulty(difficulty).label;
    const difficultyDesc = getDifficulty(difficulty).desc;

    const bestTime = record.best?.[difficulty] ?? null;
    const winRate = record.games ? Math.round((record.wins / record.games) * 100) : 0;

    useEffect(() => safeSet('ms.record', record), [record]);
    useEffect(() => safeSet('ms.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时：首次点击之后才开始 */
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
        setPhase('idle');
        setResult(null);
        setElapsed(0);
        setMoves(0);
        setHint(null);
        setLastMove(null);
        setBoom(null);
        setFocus(null);
        setFlagMode(false);
        setToast('');
        setShowResult(false);
    }, []);

    /* 提交一份新的快照 */
    const commit = useCallback((nextReveal, nextFlag, logEntry) => {
        setTimeline((prev) => {
            const cur = prev[prev.length - 1];
            const nextLog = logEntry ? [...(cur?.log ?? []), logEntry] : (cur?.log ?? []);
            return [...prev, { reveal: nextReveal, flag: nextFlag, log: nextLog }];
        });
    }, []);

    /* 结算 */
    const finishGame = useCallback(
        (won) => {
            if (recordedRef.current) return;
            recordedRef.current = true;
            setPhase('over');
            setResult(won ? 'win' : 'lose');
            setShowResult(true);
            if (won) sound.win();
            else sound.lose();

            setRecord((prev) => {
                const best = { ...(prev.best ?? {}) };
                if (won) {
                    const current = best[difficulty];
                    if (current == null || elapsed < current) best[difficulty] = elapsed;
                }
                return {
                    games: (prev.games ?? 0) + 1,
                    wins: (prev.wins ?? 0) + (won ? 1 : 0),
                    losses: (prev.losses ?? 0) + (won ? 0 : 1),
                    totalTime: (prev.totalTime ?? 0) + (won ? elapsed : 0),
                    best
                };
            });
        },
        [difficulty, elapsed]
    );

    /* 插旗 / 取消旗 */
    const handleFlag = useCallback(
        (row, col) => {
            if (phase === 'over') return;
            if (reveal[row][col]) return;
            const used = countFlags(flag);
            if (!flag[row][col] && used >= mineCount) {
                showToast('旗子已经用完，先取消一面旗');
                return;
            }
            const nextFlag = cloneGrid(flag);
            nextFlag[row][col] = !nextFlag[row][col];
            commit(reveal, nextFlag, {
                label: coordLabel(row, col),
                text: nextFlag[row][col] ? '插旗' : '取消旗',
                tone: 'flag'
            });
            setMoves((v) => v + 1);
            setFocus({ row, col });
            sound.click();
        },
        [phase, reveal, flag, mineCount, commit, showToast]
    );

    /* 一键展开：旗数达标的数字格，翻开其余隐藏邻格 */
    const handleChord = useCallback(
        (row, col) => {
            if (!mines) return;
            const cells = chordCells(reveal, flag, adj, row, col, rows, cols);
            if (cells.length === 0) return;

            const hit = cells.find((c) => mines[c.row][c.col]);
            if (hit) {
                const nextReveal = cloneGrid(reveal);
                nextReveal[hit.row][hit.col] = true;
                commit(nextReveal, flag, {
                    label: coordLabel(row, col),
                    text: '一键展开踩雷',
                    tone: 'boom'
                });
                setBoom(hit);
                setMoves((v) => v + 1);
                finishGame(false);
                return;
            }

            let nextReveal = reveal;
            cells.forEach((c) => {
                nextReveal = floodReveal(
                    nextReveal,
                    flag,
                    adj,
                    mines,
                    c.row,
                    c.col,
                    rows,
                    cols
                );
            });
            commit(nextReveal, flag, {
                label: coordLabel(row, col),
                text: `一键展开 ${cells.length} 格`,
                tone: 'open'
            });
            setMoves((v) => v + 1);
            setLastMove({ row, col });
            setHint(null);
            sound.flip(cells.length);
            if (isWin(nextReveal, mines)) finishGame(true);
        },
        [mines, reveal, flag, adj, rows, cols, commit, finishGame]
    );

    /* 翻开格子 */
    const handleReveal = useCallback(
        (row, col) => {
            if (phase === 'over') return;

            /* 插旗模式下，左键等同插旗 */
            if (flagMode) {
                handleFlag(row, col);
                return;
            }
            /* 已翻开的数字格：尝试一键展开 */
            if (reveal[row][col]) {
                handleChord(row, col);
                return;
            }
            if (flag[row][col]) {
                showToast('这一格已经插旗，右键可取消');
                return;
            }

            /* 首次点击：布置地雷，并保证首点及其八邻域安全 */
            let nextMines = mines;
            let nextAdj = adj;
            if (!nextMines) {
                nextMines = placeMines(rows, cols, mineCount, row, col);
                nextAdj = computeAdj(nextMines, rows, cols);
                setSession((prev) => ({ ...prev, mines: nextMines, adj: nextAdj }));
            }

            setFocus({ row, col });

            if (nextMines[row][col]) {
                const nextReveal = cloneGrid(reveal);
                nextReveal[row][col] = true;
                commit(nextReveal, flag, {
                    label: coordLabel(row, col),
                    text: '踩雷',
                    tone: 'boom'
                });
                setBoom({ row, col });
                setMoves((v) => v + 1);
                finishGame(false);
                return;
            }

            const nextReveal = floodReveal(
                reveal,
                flag,
                nextAdj,
                nextMines,
                row,
                col,
                rows,
                cols
            );
            const openedCount = countOpened(nextReveal) - countOpened(reveal);
            commit(nextReveal, flag, {
                label: coordLabel(row, col),
                text: openedCount > 1 ? `翻开 ${openedCount} 格` : '翻开',
                tone: 'open'
            });

            setMoves((v) => v + 1);
            setLastMove({ row, col });
            setHint(null);
            setBoom(null);
            if (phase === 'idle') setPhase('playing');
            sound.place();

            if (isWin(nextReveal, nextMines)) finishGame(true);
        },
        [phase, flagMode, reveal, flag, mines, adj, rows, cols, mineCount, commit, showToast, handleFlag, handleChord, finishGame]
    );

    /* 撤销 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        const nextLen = timeline.length - 1;
        recordedRef.current = false;
        setTimeline((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        setPhase(nextLen <= 1 ? 'idle' : 'playing');
        if (nextLen <= 1) {
            /* 回到开局：撤掉已布置的地雷，首点安全重新生效 */
            setSession((prev) => ({ ...prev, mines: null, adj: null }));
            setElapsed(0);
        }
        setMoves((v) => Math.max(0, v - 1));
        setHint(null);
        setBoom(null);
        setResult(null);
        setShowResult(false);
        sound.click();
    }, [canUndo, timeline.length]);

    /* 提示 */
    const handleHint = useCallback(() => {
        if (phase === 'over') return;
        if (!mines) {
            showToast('先点开任意一格，系统会为你布置安全的开局');
            return;
        }
        const found = findHint(reveal, flag, adj, mines, rows, cols);
        if (!found) {
            showToast('这一片暂时推不出确定结论，换个区域再试试');
            return;
        }

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);
        setHint({ row: found.row, col: found.col });
        setFocus({ row: found.row, col: found.col });

        if (found.type === 'safe') {
            const nextReveal = floodReveal(
                reveal,
                flag,
                adj,
                mines,
                found.row,
                found.col,
                rows,
                cols
            );
            commit(nextReveal, flag, {
                label: coordLabel(found.row, found.col),
                text: '提示·安全格',
                tone: 'hint'
            });
            setMoves((v) => v + 1);
            setLastMove({ row: found.row, col: found.col });
            showToast(`已为你翻开 ${coordLabel(found.row, found.col)}，这一格必定安全`);
            sound.place();
            if (isWin(nextReveal, mines)) finishGame(true);
            return;
        }

        const nextFlag = cloneGrid(flag);
        nextFlag[found.row][found.col] = true;
        commit(reveal, nextFlag, {
            label: coordLabel(found.row, found.col),
            text: '提示·雷格',
            tone: 'hint'
        });
        setMoves((v) => v + 1);
        showToast(`已为你标记 ${coordLabel(found.row, found.col)}，这一格必定是雷`);
        sound.click();
    }, [phase, mines, reveal, flag, adj, rows, cols, commit, showToast, finishGame]);

    /* 键盘：方向键移动光标，空格翻开，F 插旗 */
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const arrows = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1]
            };
            if (arrows[event.key]) {
                event.preventDefault();
                const [dr, dc] = arrows[event.key];
                setFocus((prev) => {
                    const base = prev ?? { row: 0, col: 0 };
                    return {
                        row: Math.min(rows - 1, Math.max(0, base.row + dr)),
                        col: Math.min(cols - 1, Math.max(0, base.col + dc))
                    };
                });
                return;
            }
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                if (focus) handleReveal(focus.row, focus.col);
                return;
            }
            if (event.key === 'f' || event.key === 'F') {
                event.preventDefault();
                if (focus) handleFlag(focus.row, focus.col);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [focus, rows, cols, handleReveal, handleFlag]);

    const statusText = () => {
        if (phase === 'over') {
            return result === 'win' ? '恭喜，整片雷区已清除' : '很遗憾，踩到了地雷';
        }
        if (phase === 'idle') return '点击任意格子开始（首点必定安全）';
        return `剩余 ${remainingMines} 颗雷 · 已翻开 ${openedSafe} 格`;
    };

    return (
        <div className="ms-page">
            <GameNav />
            <BackBar title="扫雷" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典推理 · Minesweeper</div>
                    <h1 className="gp-hero__title">
                        扫雷 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        根据数字提示一步步推导地雷的位置，在不点开任何一颗雷的前提下清空整片棋盘。
                        开局首点必定安全，剩下的，就交给你的推理。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">四档难度</span>
                        <span className="ui-tag">首点安全</span>
                        <span className="ui-tag">插旗与一键展开</span>
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
                            reveal={reveal}
                            flag={flag}
                            adj={adj}
                            mines={mines}
                            rows={rows}
                            cols={cols}
                            hint={hint}
                            lastMove={lastMove}
                            boom={boom}
                            focus={focus}
                            over={phase === 'over' && result === 'lose'}
                            interactive={phase !== 'over'}
                            onReveal={handleReveal}
                            onFlag={handleFlag}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">剩余雷数</span>
                                <strong>{remainingMines}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已插旗</span>
                                <strong>{flagsUsed}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">步数</span>
                                <strong>{moves}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>左键翻开 · 右键插旗</span>
                            <span>金色虚框是引擎推断的确定格</span>
                            <span>翻开所有安全格即获胜</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">排雷进度</span>
                                <span className="gp-dash__lead">
                                    {openedSafe} / {safeTotal} 格 · {progress}%
                                </span>
                            </div>
                            <div className="ms-progress">
                                <span
                                    className="ms-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前难度</span>
                                    <strong>{difficultyLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>用时</span>
                                    <strong>{formatTime(elapsed)}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>剩余雷数</span>
                                    <strong>{remainingMines}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>总步数</span>
                                    <strong>{moves}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>数字</b> 即周围八格的雷数
                                </span>
                                <span className="gp-dash__tip">
                                    <b>一键展开</b> 旗数达标时点数字格
                                </span>
                                <span className="gp-dash__tip">
                                    <b>首点</b> 必定安全，放心开局
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg ms-diff">
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
                            <p className="ms-diff__note">{difficultyDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">点击模式</h2>
                            <div className="ui-seg ms-mode">
                                <button
                                    className={`ui-seg__item ${!flagMode ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setFlagMode(false);
                                        sound.click();
                                    }}
                                >
                                    翻开
                                </button>
                                <button
                                    className={`ui-seg__item ${flagMode ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setFlagMode(true);
                                        sound.click();
                                    }}
                                >
                                    插旗
                                </button>
                            </div>
                            <p className="ms-mode__note">
                                左键点击按当前模式执行，右键始终为插旗；点击已翻开的数字格可一键展开。
                            </p>
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
                                    <strong>{record.wins}</strong>
                                    <span>胜局</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{winRate}%</strong>
                                    <span>胜率</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{bestTime != null ? formatTime(bestTime) : '—'}</strong>
                                    <span>{difficultyLabel}最佳</span>
                                </div>
                            </div>
                            <div className="gp-record__bar">
                                <span
                                    className="gp-record__fill"
                                    style={{ width: `${winRate}%` }}
                                />
                            </div>
                            <p className="gp-record__note">
                                共 {record.games} 局 · 胜 {record.wins} / 负 {record.losses}，最佳用时按难度分别记录
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始排雷后，每一步操作都会记录在这里。</p>
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
                                                <span
                                                    className={`ms-log__text is-${entry.tone}`}
                                                >
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
                            <div className="ui-eyebrow">关于扫雷</div>
                            <h2 className="ui-section-title">
                                最简单的规则，
                                <span className="ui-grad-text">最耐推敲的逻辑</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                扫雷诞生于上世纪六十年代，随着操作系统自带的小游戏走进千家万户，
                                成为无数人接触「逻辑推理」的第一课。
                                它的规则一句话就能说完：别点到雷。
                                可真正玩进去才发现，每一次点击背后都有可以验证的推理。
                            </p>
                            <p>
                                一个数字就是一条约束，一面旗子就是一次判断。
                                当你把周围的线索逐个拼合，安全与危险的边界会逐渐清晰；
                                那种「原来它必然在这里」的瞬间，
                                正是扫雷历经几十年依然让人着迷的原因。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂扫雷</h2>
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
                    <div className="ui-eyebrow">排雷技巧</div>
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
                            <h2 className="ui-section-title">为排雷体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把扫雷搬到浏览器里，而是把首点安全、插旗、一键展开、提示与战绩
                            都做成顺手的能力，让你把注意力全部留给推理本身。
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
                        <h2 className="gp-cta__title">准备好开始排雷了吗？</h2>
                        <p className="gp-cta__desc">
                            无论是想在几分钟内快速来一局，还是想挑战 16×24 的专家雷区，
                            扫雷都能立刻给你一场安静的推理。现在就开始吧。
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

            <MoreGames currentId="minesweeper" />

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
                                <li>扫雷</li>
                                <li>数独</li>
                                <li>数字华容道</li>
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

            {showResult && (
                <div className="gp-modal" role="dialog" aria-modal="true">
                    <div className="gp-modal__backdrop" onClick={() => setShowResult(false)} />
                    <div className={`gp-modal__card ${result === 'win' ? 'is-win' : 'is-lose'}`}>
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">
                            {result === 'win' ? '恭喜，雷区已清空！' : '很遗憾，踩到雷了'}
                        </h3>
                        <p className="gp-modal__sub">
                            {result === 'win'
                                ? `你用 ${formatTime(elapsed)} 完成了这局「${difficultyLabel}」难度扫雷，共 ${moves} 步。`
                                : `这局「${difficultyLabel}」难度扫雷在第 ${moves} 步触雷，再接再厉。`}
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">步数</span>
                                <strong>{moves}</strong>
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

export default MinesweeperGame;