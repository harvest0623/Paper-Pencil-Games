import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    DIFFICULTIES,
    EMPTY,
    coordLabel,
    cloneGrid,
    generatePuzzle,
    countFilled,
    countDigit,
    isSolved,
    findHintCell
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Skyscrapers.css';

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

const createSession = (difficultyId) => generatePuzzle(difficultyId);

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null }
};

const FAQ_ITEMS = [
    {
        q: '摩天楼的规则是什么？',
        a: '在 N×N 的网格里填入 1 到 N 的楼层高度，让每一行、每一列都恰好出现一次 1 到 N。棋盘四周的数字表示从该方向望过去能看见的楼栋数量，所有行列与提示同时满足即为完成。'
    },
    {
        q: '边缘数字是怎么算出来的？',
        a: '从某个方向看一排楼时，只有比之前看到的最高楼更高的楼才会露出来。提示数字就是这些「露出来」的楼栋数量。例如从一侧看 3、1、4、2，看到的依次是 3 和 4，所以提示为 2。'
    },
    {
        q: '为什么有的边缘位置是空白的？',
        a: '空白表示这一侧没有给出提示，属于难度的一部分。空白并不影响推理，本页所有题目都经过求解器验证，保证只有唯一解。'
    },
    {
        q: '填错了会怎样？',
        a: '与正确答案不符的数字会立刻标红，并计入本局的错误次数。你可以用「撤销」退回上一步，或者直接点击该格重新填入。'
    },
    {
        q: '金色虚框是什么？',
        a: '点击「提示」后，引擎会自动在最需要的一格填入正确楼层，并用金色虚框标出。提示不会计入错误次数。'
    },
    {
        q: '三个难度有什么区别？',
        a: '入门是 4×4 且所有提示可见；进阶是 5×5 并隐藏约三成提示；挑战是 6×6，隐藏四成提示，候选更多、推理链更长。'
    },
    {
        q: '可以用键盘操作吗？',
        a: '可以。点击选中格子后，直接按 1–6 填入对应楼层，按退格键或 Delete 擦除，方向键可以在格子之间移动。'
    }
];

const RULES = [
    {
        step: '01',
        title: '每格填一座楼',
        desc: '棋盘是 N×N 的网格，把 1 到 N 填入空格，数字代表楼的高度，每个数字都代表一座不同高度的楼。'
    },
    {
        step: '02',
        title: '行列不重复',
        desc: '每一横行与每一纵列都必须恰好包含一次 1 到 N，既不能重复，也不能缺少。'
    },
    {
        step: '03',
        title: '边缘提示数',
        desc: '四周的数字表示从该方向看过去能看到的楼栋数：只有比前面所有楼都更高的楼才会露出来。'
    },
    {
        step: '04',
        title: '全部吻合即完成',
        desc: '当每一行、每一列都不重复，并且四条边的提示全部吻合时，这一局就完成了。'
    }
];

const TIPS = [
    {
        title: '提示为 1',
        desc: '从这一侧只能看到一座楼，说明紧贴这一侧的第一格必须是本行最高的 N，否则更矮的楼一定会被挡住。'
    },
    {
        title: '提示为 N',
        desc: '从这一侧能看到全部 N 座楼，说明这一排从该侧开始必须严格递增，也就是依次为 1、2、3……N。'
    },
    {
        title: '最高楼一定可见',
        desc: 'N 无论从哪一侧看都必然可见，因此可以先用最高楼校验两侧提示，快速锁定它的位置范围。'
    },
    {
        title: '先紧后松',
        desc: '优先处理提示为 1 或 N 的行列，这类提示的限制最强，往往能直接确定若干格。'
    },
    {
        title: '行列交叉排除',
        desc: '某个数字在一行里可能的位置，再结合它所在列的提示与已有数字，通常可以排除到只剩一个。'
    },
    {
        title: '把提示当成约束',
        desc: '每填一个数字，都回头检查它是否让某一侧的可见数超标或不足，提前排除错误分支。'
    }
];

const FEATURES = [
    {
        title: '三种规格',
        desc: '4×4、5×5、6×6 逐级加难，从熟悉规则到长链推理，随时都能找到合适的挑战。'
    },
    {
        title: '唯一解题目',
        desc: '每道题都经过求解器验证，挑战难度使用预生成题库，打开即玩，不必等待计算。'
    },
    {
        title: '实时纠错',
        desc: '填错立刻标红并计入错误次数，撤销一步就能回到刚才的思路，不必从头再来。'
    },
    {
        title: '引擎提示',
        desc: '卡住时一键填入正确楼层，并用金色虚框标出，帮你跨过推理瓶颈继续前进。'
    },
    {
        title: '计时与撤销',
        desc: '全程计时并保留每一步操作记录，配合逐步撤销，让每一次尝试都有迹可循。'
    },
    {
        title: '战绩与最佳用时',
        desc: '自动保存完成局数、各难度最佳用时与平均用时，见证你的推理速度稳步提升。'
    }
];

function SkyscrapersGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [selected, setSelected] = useState(null);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [errors, setErrors] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('sk.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('sk.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { grid, log } = state;

    const size = session.size;
    const cellCount = size * size;
    const filled = useMemo(() => countFilled(grid), [grid]);
    const remaining = cellCount - filled;
    const progress = Math.round((filled / cellCount) * 100);
    const counts = useMemo(() => {
        const result = {};
        for (let value = 1; value <= size; value += 1) {
            result[value] = countDigit(grid, value);
        }
        return result;
    }, [grid, size]);

    const visibleClues = size * 4 - session.hidden;
    const totalClues = size * 4;

    const difficultyItem =
        DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[0];
    const difficultyLabel = difficultyItem.label;
    const bestTime = record.best?.[difficulty] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('sk.record', record), [record]);
    useEffect(() => safeSet('sk.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing') return undefined;
        const id = setInterval(() => setElapsed((value) => value + 1), 1000);
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
        toastTimer.current = setTimeout(() => setToast(''), 1900);
    }, []);

    /* 开始新的一局 */
    const startNewGame = useCallback((difficultyId) => {
        const nextDifficulty = difficultyId ?? 'easy';
        const next = createSession(nextDifficulty);
        recordedRef.current = false;
        setDifficulty(nextDifficulty);
        setSession(next);
        setTimeline([next.initial]);
        setSelected(null);
        setPhase('playing');
        setElapsed(0);
        setErrors(0);
        setHintsUsed(0);
        setHint(null);
        setToast('');
        setShowResult(false);
    }, []);

    /* 提交一份新的快照 */
    const commit = useCallback((nextGrid, logEntry) => {
        setTimeline((prev) => {
            const current = prev[prev.length - 1];
            const nextLog = logEntry
                ? [...(current?.log ?? []), logEntry]
                : (current?.log ?? []);
            return [...prev, { grid: nextGrid, log: nextLog }];
        });
    }, []);

    /* 完成一局 */
    const finishGame = useCallback(() => {
        if (recordedRef.current) return;
        recordedRef.current = true;
        setPhase('over');
        setShowResult(true);
        sound.win();
        setRecord((prev) => {
            const best = { ...(prev.best ?? {}) };
            const current = best[difficulty];
            if (current == null || elapsed < current) best[difficulty] = elapsed;
            return {
                games: (prev.games ?? 0) + 1,
                totalTime: (prev.totalTime ?? 0) + elapsed,
                best
            };
        });
    }, [difficulty, elapsed]);

    /* 选中格子 */
    const handleCellClick = useCallback((row, col) => {
        setSelected({ row, col });
        sound.click();
    }, []);

    /* 填入楼层 */
    const handleNumber = useCallback(
        (num) => {
            if (phase !== 'playing') return;
            if (!selected) {
                showToast('请先点击一个空格');
                return;
            }
            const { row, col } = selected;
            if (grid[row][col] === num) return;

            const nextGrid = cloneGrid(grid);
            nextGrid[row][col] = num;
            const wrong = num !== session.solution[row][col];

            commit(nextGrid, {
                label: coordLabel(row, col),
                text: `填入 ${num}`,
                tone: wrong ? 'wrong' : 'fill'
            });

            if (wrong) {
                setErrors((value) => value + 1);
                sound.flip();
            } else {
                sound.place();
            }

            setHint(null);

            if (isSolved(nextGrid, session.solution)) finishGame();
        },
        [phase, selected, grid, session, commit, showToast, finishGame]
    );

    /* 擦除 */
    const handleErase = useCallback(() => {
        if (phase !== 'playing') return;
        if (!selected) {
            showToast('请先点击一个格子');
            return;
        }
        const { row, col } = selected;
        if (grid[row][col] === EMPTY) return;

        const nextGrid = cloneGrid(grid);
        nextGrid[row][col] = EMPTY;
        commit(nextGrid, {
            label: coordLabel(row, col),
            text: '擦除',
            tone: 'clear'
        });
        setHint(null);
        sound.click();
    }, [phase, selected, grid, commit, showToast]);

    /* 撤销 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        recordedRef.current = false;
        setTimeline((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        setPhase('playing');
        setHint(null);
        setShowResult(false);
        sound.click();
    }, [canUndo]);

    /* 提示：填入当前格或第一个待填格的正确楼层 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        let spot = null;
        if (
            selected &&
            grid[selected.row][selected.col] !== session.solution[selected.row][selected.col]
        ) {
            spot = selected;
        }
        if (!spot) spot = findHintCell(grid, session.solution);
        if (!spot) {
            showToast('棋盘已经完成啦');
            return;
        }

        const { row, col } = spot;
        const value = session.solution[row][col];
        const nextGrid = cloneGrid(grid);
        nextGrid[row][col] = value;

        commit(nextGrid, {
            label: coordLabel(row, col),
            text: `提示 ${value}`,
            tone: 'hint'
        });

        setSelected({ row, col });
        setHint({ row, col });
        setHintsUsed((count) => count + 1);
        showToast(`${coordLabel(row, col)} 应填入 ${value}`);
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4200);

        if (isSolved(nextGrid, session.solution)) finishGame();
    }, [phase, selected, grid, session, commit, showToast, finishGame]);

    /* 键盘操作 */
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const digit = Number(event.key);
            if (event.key.length === 1 && digit >= 1 && digit <= size) {
                event.preventDefault();
                handleNumber(digit);
                return;
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                handleErase();
                return;
            }
            const moves = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1]
            };
            if (moves[event.key]) {
                event.preventDefault();
                const [dr, dc] = moves[event.key];
                setSelected((prev) => {
                    const base = prev ?? { row: 0, col: 0 };
                    const row = Math.min(size - 1, Math.max(0, base.row + dr));
                    const col = Math.min(size - 1, Math.max(0, base.col + dc));
                    return { row, col };
                });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleNumber, handleErase, size]);

    const statusText = () => {
        if (phase === 'over') return '恭喜完成本局摩天楼';
        if (remaining === 0) return '已完成';
        return `还剩 ${remaining} 格待填`;
    };

    const currentCellLabel = selected
        ? `${coordLabel(selected.row, selected.col)} · 第 ${selected.row + 1} 行第 ${selected.col + 1} 列`
        : '未选择';

    return (
        <div className="sk-page">
            <GameNav />
            <BackBar title="摩天楼" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">逻辑推理 · Skyscrapers</div>
                    <h1 className="gp-hero__title">
                        摩天楼 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        在网格中填入 1 到 N 的楼层高度，让每一行、每一列都不重复。
                        棋盘四周的数字告诉你，从那个方向望过去能看见几座楼——
                        看得见的部分，正是解开整道题的关键。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">4 / 5 / 6 阶</span>
                        <span className="ui-tag">行列不重复</span>
                        <span className="ui-tag">边缘提示</span>
                        <span className="ui-tag ui-tag--gold">唯一解与提示</span>
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
                            size={size}
                            clues={session.clues}
                            grid={grid}
                            solution={session.solution}
                            selected={selected}
                            hint={hint}
                            onSelect={handleCellClick}
                            interactive={phase === 'playing'}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已填</span>
                                <strong>{filled}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">剩余</span>
                                <strong>{remaining}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">错误</span>
                                <strong>{errors}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>边缘数字 = 从该方向能看到的楼栋数</span>
                            <span>先处理提示为 1 或 N 的行列</span>
                            <span>金色虚框是引擎给出的正确答案</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">推理进度</span>
                                <span className="gp-dash__lead">
                                    {filled} / {cellCount} 格 · {progress}%
                                </span>
                            </div>
                            <div className="sk-progress">
                                <span
                                    className="sk-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前难度</span>
                                    <strong>{difficultyLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>可见提示</span>
                                    <strong>
                                        {visibleClues} / {totalClues}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>错误次数</span>
                                    <strong>{errors}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>使用提示</span>
                                    <strong>{hintsUsed}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>提示 1</b> 靠边格必为最高楼
                                </span>
                                <span className="gp-dash__tip">
                                    <b>提示 N</b> 整排从该侧递增
                                </span>
                                <span className="gp-dash__tip">
                                    <b>交叉排除</b> 行列同时约束候选
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg sk-diff">
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
                            <p className="sk-diff__note">{difficultyItem.desc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                楼层键盘
                                <span className="gp-card__count">{currentCellLabel}</span>
                            </h2>
                            <div
                                className="sk-keypad"
                                style={{
                                    gridTemplateColumns: `repeat(${
                                        size === 4 ? 4 : 3
                                    }, minmax(0, 1fr))`
                                }}
                            >
                                {Array.from({ length: size }, (_, index) => index + 1).map(
                                    (num) => {
                                        const left = size - (counts[num] ?? 0);
                                        return (
                                            <button
                                                key={num}
                                                className={`sk-key ${
                                                    left <= 0 ? 'is-done' : ''
                                                }`}
                                                onClick={() => handleNumber(num)}
                                                disabled={left <= 0}
                                            >
                                                <span className="sk-key__num">{num}</span>
                                                <span className="sk-key__left">{left}</span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                            <button
                                className="ui-btn ui-btn--ghost sk-erase"
                                onClick={handleErase}
                            >
                                擦除当前格
                            </button>
                            <p className="sk-keypad__note">
                                键盘数字键同样可以填入，退格键擦除
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
                                    onClick={() => setSoundOn((value) => !value)}
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
                                    <strong>
                                        {bestTime != null ? formatTime(bestTime) : '—'}
                                    </strong>
                                    <span>{difficultyLabel}最佳</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{avgTime ? formatTime(avgTime) : '—'}</strong>
                                    <span>平均用时</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最佳用时按难度分别记录，完成后自动更新
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">
                                    开始推理后，每一步操作都会记录在这里。
                                </p>
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
                                                    className={`sk-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于摩天楼</div>
                            <h2 className="ui-section-title">
                                用看得见的线索，
                                <span className="ui-grad-text">推出看不见的排列</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                摩天楼（Skyscrapers）是一道典型的拉丁方阵谜题。
                                棋盘里的每个数字代表一栋楼的高度，
                                而在棋盘外面，每个方向都写着一个数字：
                                从那里望过去，你究竟能看见几栋楼。
                            </p>
                            <p>
                                高楼会挡住它身后所有更矮的楼，只有比当前最高楼更高的楼才会露出来。
                                这条简单的「遮挡规则」，配合每行每列不重复的要求，
                                就足以把整座城市的轮廓一点点锁定。
                                它不需要运气，也不依赖计算，只需要你愿意多看一眼。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂摩天楼</h2>
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
                    <div className="ui-eyebrow">解题技巧</div>
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
                            <h2 className="ui-section-title">为推理体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把摩天楼搬到浏览器里，而是把提示、纠错、撤销、计时和战绩
                            都做成顺手的能力，让你在任何设备上都能专注地推理。
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
                        <h2 className="gp-cta__title">准备好造一座城了吗？</h2>
                        <p className="gp-cta__desc">
                            从 4×4 的第一道推理开始，慢慢把整座城市的轮廓拼出来。
                            现在就开始吧。
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

            <MoreGames currentId="skyscrapers" />

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
                                <li>数独</li>
                                <li>摩天楼</li>
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

            {showResult && (
                <div className="gp-modal" role="dialog" aria-modal="true">
                    <div
                        className="gp-modal__backdrop"
                        onClick={() => setShowResult(false)}
                    />
                    <div className="gp-modal__card is-win">
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">恭喜通关！</h3>
                        <p className="gp-modal__sub">
                            你用 {formatTime(elapsed)} 完成了这局「{difficultyLabel}
                            」难度摩天楼，错误 {errors} 次，使用提示 {hintsUsed} 次。
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">错误</span>
                                <strong>{errors}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">提示</span>
                                <strong>{hintsUsed}</strong>
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

export default SkyscrapersGame;
