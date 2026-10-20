import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    SIZES,
    getSize,
    EMPTY,
    coordLabel,
    createCells,
    cloneCells,
    countFilled,
    cellsFilled,
    generateByDifficulty,
    isSolved,
    findLogicalHint,
    findFallbackHint,
    findDuplicates
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Kakuro.css';

const DEFAULT_SIZE = SIZES[0].id;

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

/* 生成一局会话：题目、答案与初始盘面（提示数字已就位） */
const createSession = (sizeId) => {
    const puzzle = generateByDifficulty(sizeId);
    const cells = createCells(puzzle.size, puzzle.layout);
    for (let r = 1; r < puzzle.size; r++) {
        for (let c = 1; c < puzzle.size; c++) {
            if (puzzle.givens[r][c] >= 1) cells[r][c] = puzzle.givens[r][c];
        }
    }
    return {
        ...puzzle,
        initial: { cells, log: [] }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null }
};

const FAQ_ITEMS = [
    {
        q: '数和该怎么玩？',
        a: '棋盘上的黑格写着线索，白格用来填数。每一段连续的横向白格要填入互不相同的 1~9，使它们的和正好等于这段对应的横向线索；纵向同理。把所有白格都填对，这一局就完成了。'
    },
    {
        q: '斜线两侧的两个数字分别是什么意思？',
        a: '黑格被一条对角线分成两半：右上角（青色）是它下方这一整列的纵向线索，左下角（金色）是它右侧这一整行的横向线索。若只写了一个数字，就表示这个方向没有需要填的段落。'
    },
    {
        q: '同一行或同一列里，数字可以重复吗？',
        a: '同一段（同一条横向或纵向的连续白格）内的数字不能重复，这正是「拆数和」的关键；但在不同的段落之间，数字可以重复出现。'
    },
    {
        q: '题目需要靠猜吗？',
        a: '不需要。每一道题都由程序实时生成并校验为唯一解，并且整盘都可以用推理逐步填出，不会出现必须猜测才能继续的局面。'
    },
    {
        q: '金色虚框代表什么？',
        a: '那是你点击「提示」后，引擎根据当前候选推演出的必然格，它会直接帮你填上正确的数字；若纯推演暂时没有结论，引擎会揭示答案中的一格，帮你重新找回思路。'
    },
    {
        q: '填错了会怎样？',
        a: '同一段内出现重复数字时会立刻标红。在「自动纠错」开启时，与答案不符的格子同样会标红并计入错误次数；你可以用「撤销」回到上一步，也可以关闭纠错，进入完全靠自己的纯推理模式。'
    }
];

const RULES = [
    {
        step: '01',
        title: '读懂线索',
        desc: '黑格斜线右上（青色）是纵向线索，左下（金色）是横向线索，数字表示对应段落中所有格子的和。'
    },
    {
        step: '02',
        title: '拆数填格',
        desc: '每段白格填入互不相同的 1~9，使它们的和恰好等于线索，例如「两位和为 3」只能是 1 + 2。'
    },
    {
        step: '03',
        title: '交叉印证',
        desc: '每一格同时属于一个横段与一个纵段，两条线索会互相排除数字，反复比对便能逐步锁定每一格。'
    },
    {
        step: '04',
        title: '填满即胜',
        desc: '当所有白格都填上正确的数字，且每一段的和都与线索相符时，这道数和的题目就被你解开了。'
    }
];

const TIPS = [
    { title: '先做唯一和', desc: '像两位和为 3（1+2）、和为 17（8+9）这类组合唯一的段落，可以直接把数字填死。' },
    { title: '盯紧极端值', desc: '和值贴近最小或最大值的段落，可选组合极少，往往是最容易突破的位置。' },
    { title: '长段先定大数', desc: '长度较长的段落里，最大的几个数字能落的位置通常很少，先确定它们能带出一连串结论。' },
    { title: '两格交叉排除', desc: '一格在横段中被排除的数字，拿到纵段里再比对一次，常常就只剩下唯一的可能。' },
    { title: '留意补数', desc: '同一段里先定下几个数字后，用「线索和 − 已定之和」反推出剩余格子的和，范围会立刻收窄。' },
    { title: '卡住就按提示', desc: '确实推不动时按一次「提示」，让引擎找出逻辑上必然的那一格，重新找回节奏。' }
];

const FEATURES = [
    { title: '唯一解实时生成', desc: '每道题都由程序现场生成并校验为唯一解，答案确定、不需要靠猜，随时开始都是新题。' },
    { title: '三档尺寸曲线', desc: '从 6×6 入门到 10×10 挑战，段落长度与交叉密度逐级提升，循序渐进地进阶。' },
    { title: '双通道输入', desc: '既可用屏幕数字键盘，也可直接用实体键盘的 1~9、退格与方向键，全程手不离键。' },
    { title: '智能提示引擎', desc: '基于候选与和值实时推演出逻辑上必然的格子，用金色虚框标出，卡住时也能继续。' },
    { title: '实时纠错与撤销', desc: '同段重复立即标红，与答案不符的格子也会被标出，支持逐步撤销回到任意一步。' },
    { title: '战绩与最佳用时', desc: '自动保存完成局数与各尺寸最佳用时，见证自己的拆数速度越来越快。' }
];

function KakuroGame() {
    const [sizeId, setSizeId] = useState(DEFAULT_SIZE);
    const [session, setSession] = useState(() => createSession(DEFAULT_SIZE));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [phase, setPhase] = useState('playing');
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [errors, setErrors] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [selected, setSelected] = useState(null);
    const [showErrors, setShowErrors] = useState(true);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('kr.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('kr.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { cells, log } = state;

    /* 最新盘面的镜像：连续输入时以它为准，避免闭包过期把前面的操作覆盖 */
    const cellsRef = useRef(cells);
    useLayoutEffect(() => {
        cellsRef.current = state.cells;
    }, [state]);

    const { size, layout, runs, solution, givens, rowClues, colClues, playable } = session;

    const givenCount = useMemo(() => cellsFilled(givens), [givens]);
    const filled = useMemo(() => countFilled(cells), [cells]);
    const progress = Math.min(100, Math.round((filled / (playable || 1)) * 100));

    const conflicts = useMemo(() => findDuplicates(runs, cells), [runs, cells]);
    const wrongs = useMemo(() => {
        const set = new Set();
        if (!showErrors) return set;
        for (let r = 1; r < size; r++) {
            for (let c = 1; c < size; c++) {
                if (!layout[r][c]) continue;
                const value = cells[r][c];
                if (value >= 1 && value <= 9 && value !== solution[r][c]) set.add(`${r},${c}`);
            }
        }
        return set;
    }, [cells, solution, layout, size, showErrors]);

    /* 已填满的横段 / 纵段 */
    const doneRuns = useMemo(() => {
        let row = 0;
        let col = 0;
        let rowTotal = 0;
        let colTotal = 0;
        runs.forEach((run) => {
            const complete = run.cells.every((cell) => cells[cell.r][cell.c] >= 1);
            if (run.axis === 'row') {
                rowTotal += 1;
                if (complete) row += 1;
            } else {
                colTotal += 1;
                if (complete) col += 1;
            }
        });
        return { row, col, rowTotal, colTotal };
    }, [runs, cells]);

    const sizeLabel = getSize(sizeId).label;
    const sizeDesc = getSize(sizeId).desc;

    const bestTime = record.best?.[sizeId] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('kr.record', record), [record]);
    useEffect(() => safeSet('kr.sound', soundOn), [soundOn]);
    useEffect(() => sound.setEnabled(soundOn), [soundOn]);

    /* 对局计时 */
    useEffect(() => {
        if (phase !== 'playing' || busy) return;
        const id = setInterval(() => setElapsed((v) => v + 1), 1000);
        return () => clearInterval(id);
    }, [phase, busy]);

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

    /* 开始新的一局（生成题目较重，先让界面渲染出提示再计算） */
    const startNewGame = useCallback((id) => {
        const nextSize = id ?? DEFAULT_SIZE;
        setBusy(true);
        window.setTimeout(() => {
            const next = createSession(nextSize);
            recordedRef.current = false;
            setSizeId(nextSize);
            setSession(next);
            setTimeline([next.initial]);
            setPhase('playing');
            setElapsed(0);
            setErrors(0);
            setHintsUsed(0);
            setHint(null);
            setLastMove(null);
            setSelected(null);
            setToast('');
            setShowResult(false);
            setBusy(false);
        }, 30);
    }, []);

    /* 提交一步操作：以最新盘面为基准改格，返回改动后的盘面 */
    const applyChanges = useCallback((changes, logEntry) => {
        const board = cellsRef.current;
        const next = cloneCells(board);
        changes.forEach(({ row, col, value }) => {
            next[row][col] = value;
        });
        cellsRef.current = next;

        setTimeline((prev) => {
            const cur = prev[prev.length - 1];
            const nextCells = cloneCells(cur.cells);
            changes.forEach(({ row, col, value }) => {
                nextCells[row][col] = value;
            });
            return [...prev, { cells: nextCells, log: [...(cur?.log ?? []), logEntry] }];
        });

        return next;
    }, []);

    /* 完成一局的结算 */
    const finishGame = useCallback(() => {
        if (recordedRef.current) return;
        recordedRef.current = true;
        setPhase('over');
        setShowResult(true);
        setSelected(null);
        sound.win();
        setRecord((prev) => {
            const best = { ...(prev.best ?? {}) };
            const current = best[sizeId];
            if (current == null || elapsed < current) best[sizeId] = elapsed;
            return {
                games: (prev.games ?? 0) + 1,
                totalTime: (prev.totalTime ?? 0) + elapsed,
                best
            };
        });
    }, [sizeId, elapsed]);

    /* 输入一个数字 */
    const handleInput = useCallback(
        (digit) => {
            if (phase !== 'playing' || busy || !selected) return;
            const { row, col } = selected;
            if (!layout[row]?.[col]) return;
            if (givens[row][col] >= 1) {
                showToast('这一格是题目自带的数字');
                return;
            }
            if (cellsRef.current[row][col] === digit) return;

            const isWrong = showErrors && digit !== solution[row][col];
            applyChanges([{ row, col, value: digit }], {
                label: coordLabel(row, col),
                text: isWrong ? `填入 ${digit}·有误` : `填入 ${digit}`,
                tone: isWrong ? 'wrong' : 'fill'
            });
            setLastMove({ row, col });
            setHint(null);

            if (isWrong) {
                setErrors((v) => v + 1);
                sound.flip();
            } else {
                sound.place();
            }

            if (isSolved(cellsRef.current, solution)) finishGame();
        },
        [phase, busy, selected, layout, givens, showErrors, solution, applyChanges, showToast, finishGame]
    );

    /* 清除当前格 */
    const handleClear = useCallback(() => {
        if (phase !== 'playing' || busy || !selected) return;
        const { row, col } = selected;
        if (!layout[row]?.[col] || givens[row][col] >= 1) return;
        if (cellsRef.current[row][col] === EMPTY) return;

        applyChanges([{ row, col, value: EMPTY }], {
            label: coordLabel(row, col),
            text: '清除',
            tone: 'clear'
        });
        setLastMove({ row, col });
        setHint(null);
        sound.click();
    }, [phase, busy, selected, layout, givens, applyChanges]);

    /* 方向键：沿该方向找下一个白格 */
    const moveSelection = useCallback(
        (dr, dc) => {
            if (busy) return;
            const from = selected ?? { row: 1, col: 1 };
            let r = from.row + dr;
            let c = from.col + dc;
            while (r >= 1 && r < size && c >= 1 && c < size) {
                if (layout[r][c]) {
                    setSelected({ row: r, col: c });
                    return;
                }
                r += dr;
                c += dc;
            }
        },
        [busy, selected, size, layout]
    );

    /* 实体键盘输入 */
    useEffect(() => {
        const onKey = (event) => {
            if (phase !== 'playing' || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key >= '1' && event.key <= '9') {
                event.preventDefault();
                handleInput(Number(event.key));
                return;
            }
            if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                handleClear();
                return;
            }
            const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            const move = moves[event.key];
            if (move) {
                event.preventDefault();
                moveSelection(move[0], move[1]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, handleInput, handleClear, moveSelection]);

    /* 撤销 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (!canUndo || busy) return;
        recordedRef.current = false;
        setTimeline((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        setPhase('playing');
        setHint(null);
        setLastMove(null);
        setShowResult(false);
        sound.click();
    }, [canUndo, busy]);

    /* 提示：优先给出逻辑上必然的格子 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing' || busy) return;

        const spot =
            findLogicalHint(layout, runs, size, cellsRef.current) ??
            findFallbackHint(cellsRef.current, solution);

        if (!spot) {
            showToast('题目已经填完啦');
            return;
        }

        applyChanges([{ row: spot.row, col: spot.col, value: spot.value }], {
            label: coordLabel(spot.row, spot.col),
            text: spot.logical ? `提示·必然 ${spot.value}` : `提示·揭示 ${spot.value}`,
            tone: 'hint'
        });
        setHint({ row: spot.row, col: spot.col });
        setLastMove({ row: spot.row, col: spot.col });
        setSelected({ row: spot.row, col: spot.col });
        setHintsUsed((v) => v + 1);
        showToast(
            spot.logical
                ? `${coordLabel(spot.row, spot.col)} 必定是 ${spot.value}`
                : `暂时没有必然格，已为你揭示 ${coordLabel(spot.row, spot.col)}`
        );
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);

        if (isSolved(cellsRef.current, solution)) finishGame();
    }, [phase, busy, layout, runs, size, solution, applyChanges, showToast, finishGame]);

    const statusText = () => {
        if (busy) return '正在生成题目…';
        if (phase === 'over') return '恭喜，本题已完成';
        if (filled >= playable) return '全部填满，正在核对每段之和';
        return `已填 ${filled} / ${playable} 格 · 还剩 ${playable - filled} 格`;
    };

    return (
        <div className="kr-page">
            <GameNav />
            <BackBar title="数和" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">数字拆解 · Kakuro</div>
                    <h1 className="gp-hero__title">
                        数和 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        黑格斜线两侧的数字，是这一行、这一列片段的和。
                        把互不相同的数字填进白格，让每一段的和都严丝合缝地对上线索——
                        数与数之间的排除与印证，正是数和最耐人寻味的地方。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">三档尺寸</span>
                        <span className="ui-tag">唯一解生成</span>
                        <span className="ui-tag">键盘输入</span>
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
                            size={size}
                            layout={layout}
                            cells={cells}
                            rowClues={rowClues}
                            colClues={colClues}
                            givens={givens}
                            selected={selected}
                            conflicts={conflicts}
                            wrongs={wrongs}
                            hint={hint}
                            lastMove={lastMove}
                            interactive={phase === 'playing' && !busy}
                            onSelect={setSelected}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已填</span>
                                <strong>{filled}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">待填</span>
                                <strong>{Math.max(0, playable - filled)}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">提示数字</span>
                                <strong>{givenCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">错误</span>
                                <strong>{errors}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点选白格后按 1~9 填数，退格或 0 清除</span>
                            <span>同一段内数字不可重复，段与段之间可以重复</span>
                            <span>金色虚框是引擎推出的必然格</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">填数进度</span>
                                <span className="gp-dash__lead">
                                    {filled} / {playable} 格 · {progress}%
                                </span>
                            </div>
                            <div className="kr-progress">
                                <span
                                    className="kr-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前尺寸</span>
                                    <strong>{sizeLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>用时</span>
                                    <strong>{formatTime(elapsed)}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>完成横段</span>
                                    <strong>
                                        {doneRuns.row} / {doneRuns.rowTotal}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>完成纵段</span>
                                    <strong>
                                        {doneRuns.col} / {doneRuns.colTotal}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>唯一和</b> 如两位和为 3 只能是 1+2
                                </span>
                                <span className="gp-dash__tip">
                                    <b>交叉排除</b> 横段与纵段对照可锁定单格
                                </span>
                                <span className="gp-dash__tip">
                                    <b>补数</b> 用线索和减去已定之和收窄范围
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">尺寸设置</h2>
                            <div className="ui-seg kr-sizes">
                                {SIZES.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            sizeId === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            if (item.id === sizeId || busy) return;
                                            startNewGame(item.id);
                                            sound.click();
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="kr-diff__note">{sizeDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                数字键盘
                                <span className="gp-card__count">
                                    {selected
                                        ? coordLabel(selected.row, selected.col)
                                        : '未选中'}
                                </span>
                            </h2>
                            <div className="kr-pad">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                                    <button
                                        key={digit}
                                        className="kr-pad__key"
                                        disabled={phase !== 'playing' || busy || !selected}
                                        onClick={() => handleInput(digit)}
                                    >
                                        {digit}
                                    </button>
                                ))}
                                <button
                                    className="kr-pad__key kr-pad__key--erase"
                                    disabled={phase !== 'playing' || busy || !selected}
                                    onClick={handleClear}
                                >
                                    擦除
                                </button>
                            </div>
                            <p className="kr-pad__note">
                                也可以用实体键盘直接输入：1~9 填数，退格或 0 清除，方向键移动选区。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">辅助设置</h2>
                            <div className="gp-field">
                                <span className="gp-field__label">自动纠错</span>
                                <div className="ui-seg gp-seg-full">
                                    <button
                                        className={`ui-seg__item ${
                                            showErrors ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setShowErrors(true);
                                            sound.click();
                                        }}
                                    >
                                        开启
                                    </button>
                                    <button
                                        className={`ui-seg__item ${
                                            !showErrors ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setShowErrors(false);
                                            sound.click();
                                        }}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                            <p className="kr-mode__note">
                                开启后，与答案不符的数字会立刻标红并计入错误次数；关闭即进入纯推理模式，只提示同段重复。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startNewGame(sizeId)}
                                    disabled={busy}
                                >
                                    重新开始
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleUndo}
                                    disabled={!canUndo || busy}
                                >
                                    撤销
                                </button>
                                <button
                                    className="ui-btn ui-btn--ghost"
                                    onClick={handleHint}
                                    disabled={busy}
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

                        <div className="gp-card">
                            <h2 className="gp-card__title">我的战绩</h2>
                            <div className="gp-record">
                                <div className="gp-record__item">
                                    <strong>{record.games}</strong>
                                    <span>完成局数</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{bestTime != null ? formatTime(bestTime) : '—'}</strong>
                                    <span>{sizeLabel}最佳</span>
                                </div>
                                <div className="gp-record__item">
                                    <strong>{avgTime ? formatTime(avgTime) : '—'}</strong>
                                    <span>平均用时</span>
                                </div>
                            </div>
                            <p className="gp-record__note">
                                最佳用时按当前尺寸分别记录，完成后自动更新
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作记录
                                <span className="gp-card__count">{log.length} 步</span>
                            </h2>
                            {log.length === 0 ? (
                                <p className="gp-log__empty">开始填数后，每一步操作都会记录在这里。</p>
                            ) : (
                                <ol className="gp-log">
                                    {[...log]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((entry, index) => (
                                            <li
                                                key={`${entry.label}-${entry.text}-${log.length - index}`}
                                                className="gp-log__item"
                                            >
                                                <span className="gp-log__no">
                                                    {log.length - index}
                                                </span>
                                                <span className="gp-log__label">
                                                    {entry.label}
                                                </span>
                                                <span
                                                    className={`kr-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于数和</div>
                            <h2 className="ui-section-title">
                                把数字拆开
                                <span className="ui-grad-text">再重新拼合</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数和（Kakuro）常被称为「填字的数独」，它把数学里最古老的一件事——
                                把和拆成若干互不相同的部分——做成了一整盘棋。
                                棋盘上的每一段白格都要凑出线索上的那个和，
                                而每一格又同时受着横向与纵向两条线索的牵制。
                            </p>
                            <p>
                                它的乐趣在于「严丝合缝」：一个数字被排除、被锁定、又带出下一格的答案，
                                推理像链条一样一节节咬合。
                                当你把最后一格填上，回头再看整盘数字各归其位，
                                那种秩序感正是数和让人上瘾的地方。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数和</h2>
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
                    <div className="ui-eyebrow">推理技巧</div>
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
                            <h2 className="ui-section-title">为拆数体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把数和搬到浏览器里，而是把键盘输入、交叉高亮、提示、纠错与战绩
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
                        <h2 className="gp-cta__title">准备好开始拆数了吗？</h2>
                        <p className="gp-cta__desc">
                            想用五分钟练练手感，还是想安静地挑战一张 10×10 的难题，
                            数和都能给你一段只属于推理的时间。现在就开始吧。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                startNewGame(sizeId);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="kakuro" />

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
                                <li>数和</li>
                                <li>数织</li>
                                <li>数独</li>
                                <li>扫雷</li>
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
                        <h3 className="gp-modal__title">恭喜，本题完成！</h3>
                        <p className="gp-modal__sub">
                            你用 {formatTime(elapsed)} 完成了这局「{sizeLabel}」数和，
                            提示 {hintsUsed} 次、错误 {errors} 次，共 {log.length} 步。
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
                                onClick={() => startNewGame(sizeId)}
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

export default KakuroGame;
