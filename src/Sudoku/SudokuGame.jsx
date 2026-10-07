import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    SIZE,
    EMPTY,
    CELL_COUNT,
    DIFFICULTIES,
    coordLabel,
    cloneGrid,
    cloneNotes,
    generateByDifficulty,
    createGivenMask,
    countDigits,
    countFilled
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Sudoku.css';

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

/* 空白笔记结构 */
const createEmptyNotes = () =>
    Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => []));

/* 生成一局会话：题面、答案与给定数标记 */
const createSession = (difficultyId) => {
    const { puzzle, solution } = generateByDifficulty(difficultyId);
    return {
        solution,
        given: createGivenMask(puzzle),
        initial: {
            grid: cloneGrid(puzzle),
            notes: createEmptyNotes(),
            log: []
        }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null, expert: null }
};

const FAQ_ITEMS = [
    {
        q: '数独的规则是什么？',
        a: '在 9×9 的棋盘里填入 1–9，使得每一行、每一列、每一个 3×3 宫内都恰好出现一次 1 到 9，不能重复也不能遗漏。题目已经给出的数字不可修改。'
    },
    {
        q: '每一局都有唯一解吗？',
        a: '有。本页的题目由程序实时生成，生成时会逐一验证，只有保证唯一解的题面才会交给你，因此每一步推理都有确定的答案。'
    },
    {
        q: '笔记（候选数）怎么用？',
        a: '点击「笔记」进入笔记模式后，再点数字键，就会把这个数字记在当前格的候选位里，用于记录可能的答案；再次点击同一个数字可以取消。'
    },
    {
        q: '填错了会怎样？',
        a: '与正确答案不符的数字会立刻标红，并计入本局的错误次数。你仍然可以用「撤销」回到上一步，重新推理。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎给出的当前正确数字，仅用于帮你解开心结，会计入提示但不算错误。'
    },
    {
        q: '难度有什么区别？',
        a: '难度决定了题面中挖掉的空格数量：简单档给定数字多，专家档接近极限挖空。无论哪一档，解都是唯一的。'
    }
];

const RULES = [
    {
        step: '01',
        title: '填入 1–9',
        desc: '棋盘为 9×9 共 81 格，用 1 到 9 的数字把空格填满，题目已给出的数字不可更改。'
    },
    {
        step: '02',
        title: '行不重复',
        desc: '每一横向的 9 格里，1 到 9 每个数字都只能出现一次。'
    },
    {
        step: '03',
        title: '列不重复',
        desc: '每一纵向的 9 格里，1 到 9 每个数字同样只能出现一次。'
    },
    {
        step: '04',
        title: '宫不重复',
        desc: '每个 3×3 的粗线方格里也必须容纳完整的 1 到 9。三条规则同时满足即为正解。'
    }
];

const TIPS = [
    { title: '先看唯一数', desc: '若某格所在的行、列、宫已经出现了 8 个不同数字，剩下的那个就是唯一解，优先填入。' },
    { title: '找唯一位置', desc: '对某个数字，如果在一宫里只有一个格子能放得下它，那么这一格必定是它。' },
    { title: '善用笔记', desc: '把候选数用小字记下来，避免反复重新推导，也能让隐藏的规律更容易浮现。' },
    { title: '先易后难', desc: '从数字最多的行、列或宫下手，新填入的数字往往能连锁解开一大片区域。' },
    { title: '成组观察', desc: '同一数字在两行或两列中只出现在相同的两格时，可以排除这两格所在的其他位置。' },
    { title: '保持整洁', desc: '填入数字后及时清理同行、同列、同宫笔记里的对应数字，能显著减少视觉干扰。' }
];

const FEATURES = [
    { title: '唯一解实时生成', desc: '每道题都由程序现场生成并校验唯一解，绝不出错，随时开始都是全新题目。' },
    { title: '四档难度曲线', desc: '从简单到专家循序渐进，挖空数量逐级增加，既能入门也能挑战极限。' },
    { title: '笔记与候选数', desc: '内置笔记模式，把候选数记在格子里，配合联动高亮让推理过程一目了然。' },
    { title: '智能提示引擎', desc: '卡住时一键获取当前正确数字，用金色虚框标出，帮你继续往下推导。' },
    { title: '实时纠错与撤销', desc: '填错立刻标红并记录错误次数，支持逐步撤销，随时回到想重新思考的那一步。' },
    { title: '战绩与最佳用时', desc: '自动保存完成局数与各难度最佳用时，见证你的推理速度越来越快。' }
];

/* 找到第一个还需要填写的格子 */
const findNextSpot = (grid, solution) => {
    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (grid[row][col] === EMPTY || grid[row][col] !== solution[row][col]) {
                return { row, col };
            }
        }
    }
    return null;
};

/* 棋盘是否与答案完全一致 */
const isSolved = (grid, solution) =>
    grid.every((row, r) => row.every((value, c) => value === solution[r][c]));

function SudokuGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [selected, setSelected] = useState(null);
    const [noteMode, setNoteMode] = useState(false);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [errors, setErrors] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('sd.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('sd.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { grid, notes, log } = state;

    const counts = useMemo(() => countDigits(grid), [grid]);
    const filled = useMemo(() => countFilled(grid), [grid]);
    const remaining = CELL_COUNT - filled;
    const progress = Math.round((filled / CELL_COUNT) * 100);

    const difficultyLabel =
        DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? '简单';
    const difficultyDesc =
        DIFFICULTIES.find((item) => item.id === difficulty)?.desc ?? '';

    const bestTime = record.best?.[difficulty] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('sd.record', record), [record]);
    useEffect(() => safeSet('sd.sound', soundOn), [soundOn]);
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
        setSelected(null);
        setNoteMode(false);
        setPhase('playing');
        setElapsed(0);
        setErrors(0);
        setHint(null);
        setToast('');
        setShowResult(false);
    }, []);

    /* 提交一份新的快照 */
    const commit = useCallback((nextGrid, nextNotes, logEntry) => {
        setTimeline((prev) => {
            const cur = prev[prev.length - 1];
            const nextLog = logEntry
                ? [...(cur?.log ?? []), logEntry]
                : (cur?.log ?? []);
            return [...prev, { grid: nextGrid, notes: nextNotes, log: nextLog }];
        });
    }, []);

    /* 完成一局的结算 */
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
    const handleCellClick = useCallback(
        (row, col) => {
            setSelected({ row, col });
            sound.click();
        },
        []
    );

    /* 填入数字 / 记录笔记 */
    const handleNumber = useCallback(
        (num) => {
            if (phase !== 'playing') return;
            if (!selected) {
                showToast('请先点击一个空格');
                return;
            }
            const { row, col } = selected;
            if (session.given[row][col]) {
                showToast('题目给定的数字不可修改');
                return;
            }

            /* 笔记模式：切换候选数 */
            if (noteMode) {
                if (grid[row][col] !== EMPTY) {
                    showToast('该格已有数字，先擦除后再记笔记');
                    return;
                }
                const nextNotes = cloneNotes(notes);
                const cellNotes = nextNotes[row][col];
                const has = cellNotes.includes(num);
                nextNotes[row][col] = has
                    ? cellNotes.filter((n) => n !== num)
                    : [...cellNotes, num].sort((a, b) => a - b);
                commit(grid, nextNotes, {
                    row,
                    col,
                    label: coordLabel(row, col),
                    text: has ? `取消笔记 ${num}` : `笔记 ${num}`,
                    tone: 'note'
                });
                sound.click();
                return;
            }

            if (grid[row][col] === num) return;

            const nextGrid = cloneGrid(grid);
            nextGrid[row][col] = num;

            /* 同步清理同行、同列、同宫笔记中的该数字 */
            const nextNotes = cloneNotes(notes);
            nextNotes[row][col] = [];
            for (let i = 0; i < SIZE; i++) {
                nextNotes[row][i] = nextNotes[row][i].filter((n) => n !== num);
                nextNotes[i][col] = nextNotes[i][col].filter((n) => n !== num);
            }
            const boxRow = Math.floor(row / 3) * 3;
            const boxCol = Math.floor(col / 3) * 3;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    nextNotes[boxRow + r][boxCol + c] = nextNotes[boxRow + r][
                        boxCol + c
                    ].filter((n) => n !== num);
                }
            }

            const isWrong = num !== session.solution[row][col];
            commit(nextGrid, nextNotes, {
                row,
                col,
                label: coordLabel(row, col),
                text: `填入 ${num}`,
                tone: isWrong ? 'wrong' : 'fill'
            });

            if (isWrong) {
                setErrors((v) => v + 1);
                sound.flip();
            } else {
                sound.place();
            }

            setHint(null);

            if (isSolved(nextGrid, session.solution)) finishGame();
        },
        [phase, selected, session, noteMode, grid, notes, commit, showToast, finishGame]
    );

    /* 擦除当前格 */
    const handleErase = useCallback(() => {
        if (phase !== 'playing') return;
        if (!selected) {
            showToast('请先点击一个格子');
            return;
        }
        const { row, col } = selected;
        if (session.given[row][col]) {
            showToast('题目给定的数字不可修改');
            return;
        }
        if (grid[row][col] === EMPTY && notes[row][col].length === 0) return;

        const nextGrid = cloneGrid(grid);
        nextGrid[row][col] = EMPTY;
        const nextNotes = cloneNotes(notes);
        nextNotes[row][col] = [];

        commit(nextGrid, nextNotes, {
            row,
            col,
            label: coordLabel(row, col),
            text: '擦除',
            tone: 'clear'
        });
        sound.click();
    }, [phase, selected, session, grid, notes, commit, showToast]);

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

    /* 提示：给出当前格或第一个待填格的正确数字 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        let spot = null;
        if (selected && !session.given[selected.row][selected.col]) {
            if (grid[selected.row][selected.col] !== session.solution[selected.row][selected.col]) {
                spot = selected;
            }
        }
        if (!spot) spot = findNextSpot(grid, session.solution);
        if (!spot) {
            showToast('棋盘已经完成啦');
            return;
        }

        const { row, col } = spot;
        const value = session.solution[row][col];
        const nextGrid = cloneGrid(grid);
        nextGrid[row][col] = value;
        const nextNotes = cloneNotes(notes);
        nextNotes[row][col] = [];

        commit(nextGrid, nextNotes, {
            row,
            col,
            label: coordLabel(row, col),
            text: `提示 ${value}`,
            tone: 'hint'
        });

        setSelected({ row, col });
        setHint({ row, col });
        showToast(`已为你填入 ${coordLabel(row, col)} 的正确数字`);
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);

        if (isSolved(nextGrid, session.solution)) finishGame();
    }, [phase, selected, session, grid, notes, commit, showToast, finishGame]);

    /* 键盘操作：数字填入、退格擦除、方向键移动选中 */
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (event.key >= '1' && event.key <= '9') {
                event.preventDefault();
                handleNumber(Number(event.key));
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
                    const row = Math.min(SIZE - 1, Math.max(0, base.row + dr));
                    const col = Math.min(SIZE - 1, Math.max(0, base.col + dc));
                    return { row, col };
                });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleNumber, handleErase]);

    const statusText = () => {
        if (phase === 'over') return '恭喜完成本局数独';
        if (remaining === 0) return '已完成';
        return `还剩 ${remaining} 格待填`;
    };

    const currentCellLabel = selected ? coordLabel(selected.row, selected.col) : '未选择';

    return (
        <div className="sd-page">
            <GameNav />
            <BackBar title="数独" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">纯逻辑推理 · Sudoku</div>
                    <h1 className="gp-hero__title">
                        数独 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        在 9×9 的宫格中填入 1 到 9，让每一行、每一列、每一个宫中都不重复。
                        无需运气，只靠推理——每一道题都有唯一解，
                        每填下一个数字，都是一次确定的胜利。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">9 × 9 棋盘</span>
                        <span className="ui-tag">四档难度</span>
                        <span className="ui-tag">唯一解生成</span>
                        <span className="ui-tag ui-tag--gold">笔记与提示</span>
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
                            grid={grid}
                            notes={notes}
                            given={session.given}
                            solution={session.solution}
                            selected={selected}
                            hint={hint}
                            onCellClick={handleCellClick}
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
                            <span>点击格子后用数字键填入</span>
                            <span>金色虚框是引擎给出的正确答案</span>
                            <span>每行、每列、每宫 1–9 不重复</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">完成进度</span>
                                <span className="gp-dash__lead">
                                    {filled} / {CELL_COUNT} 格 · {progress}%
                                </span>
                            </div>
                            <div className="sd-progress">
                                <span
                                    className="sd-progress__fill"
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
                                    <span>错误次数</span>
                                    <strong>{errors}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>剩余空格</span>
                                    <strong>{remaining}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>唯一数</b> 先填必定的那一格
                                </span>
                                <span className="gp-dash__tip">
                                    <b>宫排除</b> 缩小候选范围
                                </span>
                                <span className="gp-dash__tip">
                                    <b>笔记</b> 记录候选数再推理
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg sd-diff">
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
                            <p className="sd-diff__note">{difficultyDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                数字键盘
                                <span className="gp-card__count">当前 {currentCellLabel}</span>
                            </h2>
                            <div className="sd-keypad">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                    const left = 9 - counts[num];
                                    return (
                                        <button
                                            key={num}
                                            className={`sd-key ${left <= 0 ? 'is-done' : ''}`}
                                            onClick={() => handleNumber(num)}
                                            disabled={left <= 0}
                                        >
                                            <span className="sd-key__num">{num}</span>
                                            <span className="sd-key__left">{left}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="sd-keypad__actions">
                                <button className="ui-btn ui-btn--ghost" onClick={handleErase}>
                                    擦除
                                </button>
                                <button
                                    className={`ui-btn ${
                                        noteMode ? 'ui-btn--primary' : 'ui-btn--ghost'
                                    } sd-note-toggle`}
                                    onClick={() => {
                                        setNoteMode((v) => !v);
                                        sound.click();
                                    }}
                                >
                                    笔记 {noteMode ? '开' : '关'}
                                </button>
                            </div>
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
                                    <strong>{avgTime ? formatTime(avgTime) : '—'}</strong>
                                    <span>平均用时</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最佳用时按当前难度分别记录，完成后自动更新
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始推理后，每一步操作都会记录在这里。</p>
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
                                                    className={`sd-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于数独</div>
                            <h2 className="ui-section-title">
                                最安静的推理，
                                <span className="ui-grad-text">最纯粹的确定</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数独起源于十八世纪的拉丁方阵，在二十世纪后期定型为现在的样子，
                                并迅速成为全球最受欢迎的纸笔逻辑游戏之一。
                                它不需要对手，也不需要运气，
                                只要一支笔和一张纸，就能开始一场纯粹的推理之旅。
                            </p>
                            <p>
                                在 9×9 的棋盘上，每一行、每一列、每一个 3×3 宫都必须容纳
                                完整的 1 到 9。正是这三条简单的约束，
                                让每一个数字都被其他数字紧紧锁定；
                                当所有条件恰好收敛到唯一答案时，那种「必然如此」的感觉，
                                正是数独最让人上瘾的地方。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数独</h2>
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
                            我们不只是把数独搬到浏览器里，而是把笔记、提示、纠错、战绩都做成顺手的能力，
                            让你在任何设备上都能专注地享受推理本身。
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
                        <h2 className="gp-cta__title">准备好开始推理了吗？</h2>
                        <p className="gp-cta__desc">
                            无论想在通勤路上消磨十分钟，还是想在夜里安静地挑战一道专家题，
                            数独都是最合适的选择。现在就开始吧。
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

            <MoreGames currentId="sudoku" />

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
                            你用 {formatTime(elapsed)} 完成了这局「{difficultyLabel}」难度数独，
                            错误 {errors} 次。
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

export default SudokuGame;