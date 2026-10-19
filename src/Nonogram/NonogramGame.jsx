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
    FILLED,
    MARKED,
    coordLabel,
    createCells,
    cloneCells,
    countFilled,
    countDoneLines,
    generateByDifficulty,
    isSolved,
    findLogicalHint,
    findFallbackHint
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Nonogram.css';

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

/* 生成一局会话：题目、答案与初始盘面 */
const createSession = (sizeId) => {
    const puzzle = generateByDifficulty(sizeId);
    return {
        ...puzzle,
        initial: {
            cells: createCells(puzzle.size),
            log: []
        }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { small: null, medium: null, large: null }
};

const FAQ_ITEMS = [
    {
        q: '数织的规则是什么？',
        a: '棋盘上方的数字是每一列的线索，左侧的数字是每一行的线索。它们描述的是这一行（列）中「连续涂黑格」的长度与顺序，把数字与格子一一对应地填出来，最终会浮现出一幅完整的像素图案。'
    },
    {
        q: '行列的数字该怎么读？',
        a: '比如某一行写着「3 1 2」，就表示这一行从左到右依次有三段连续涂黑的格子，长度分别是 3 格、1 格、2 格，段与段之间至少隔着一个空格。数字的先后顺序是固定的，不能调换。'
    },
    {
        q: '每一局都有唯一解吗？',
        a: '有。每道题都由程序实时生成并做唯一解校验，只有答案唯一的题面才会交给你，因此每一步推理都有确定的结论，绝不需要靠猜。'
    },
    {
        q: '怎么涂黑、怎么标记？',
        a: '左键按当前模式落笔（涂黑或标记 X），右键始终是打叉。按住左键横向或纵向拖动，可以连续涂一整片区域；标记 X 用来表示「这一格必定留白」。'
    },
    {
        q: '金色虚框是什么？',
        a: '那是你点击「提示」后，引擎根据当前线索推出的必然格：该涂黑的会直接帮你涂上，该留白的会替你打上叉。如果纯靠推演暂时得不到结论，引擎会直接揭示图案中的一格，帮你继续往下走。'
    },
    {
        q: '涂错了会怎样？',
        a: '在「自动纠错」开启时，与图案不符的涂黑格会立刻标红，并计入本局的错误次数；你可以用「撤销」回到上一步，或在设置里关闭纠错，进入完全靠自己的纯推理模式。'
    }
];

const RULES = [
    {
        step: '01',
        title: '读懂线索',
        desc: '左侧数字描述每一行的涂黑段，顶部数字描述每一列的涂黑段，数字即连续长度，顺序不可调换。'
    },
    {
        step: '02',
        title: '涂黑格子',
        desc: '左键按当前模式落笔，把符合线索的格子涂黑；按住拖动可以连续涂一整行或一整列。'
    },
    {
        step: '03',
        title: '标记留白',
        desc: '右键（或切到「标记」模式）给必定空白的格子打上叉，帮助自己缩小范围、理清思路。'
    },
    {
        step: '04',
        title: '还原图案',
        desc: '当每一行、每一列的涂黑段都与线索完全吻合时，整幅图案就被你还原出来了。'
    }
];

const TIPS = [
    { title: '从满行入手', desc: '线索数字之和加上间隔刚好等于行长时，这一行的涂黑位置是完全确定的，先填这些。' },
    { title: '盯住大数字', desc: '一行里最大的那个数字，无论怎么摆都会覆盖中间的若干格，这些交集就是必然要涂的位置。' },
    { title: '善用边界', desc: '线索正好抵住边界时（例如 15 格的最后一段是 4），可以直接从边缘开始数，省去大量试探。' },
    { title: '先标记再涂', desc: '把确定空白的格子先打上叉，剩下的涂黑位置会变得一目了然，也避免重复推演。' },
    { title: '交叉验证', desc: '行推不出来的位置，往往能由列线索确定；行列轮流推演，线索会像滚雪球一样连锁解开。' },
    { title: '卡住就用提示', desc: '确实推不动时按一次「提示」，让引擎找出逻辑上必然的那一格，重新找回节奏。' }
];

const FEATURES = [
    { title: '唯一解实时生成', desc: '每道题都由程序现场生成并校验唯一解，随时开始都是全新的图案，绝不出错。' },
    { title: '三档尺寸曲线', desc: '从 5×5 入门到 15×15 挑战，线索长度与交织程度逐级提升，循序渐进地进阶。' },
    { title: '拖动连续涂色', desc: '按住左键横向或纵向拖动即可连续涂一整片区域，还原大图案时手感顺滑。' },
    { title: '智能提示引擎', desc: '基于行列线索实时推演出逻辑上必然的格子，用金色虚框标出，卡住时也能继续。' },
    { title: '实时纠错与撤销', desc: '涂错立刻标红并记录错误次数，支持逐步撤销，随时回到想重新思考的那一步。' },
    { title: '战绩与最佳用时', desc: '自动保存完成局数与各尺寸最佳用时，见证自己的推理速度越来越快。' }
];

function NonogramGame() {
    const [sizeId, setSizeId] = useState('small');
    const [session, setSession] = useState(() => createSession('small'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [errors, setErrors] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [markMode, setMarkMode] = useState(false);
    const [showErrors, setShowErrors] = useState(true);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('np.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('np.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { cells, log } = state;

    /* 最新盘面的镜像：连续落笔（拖动）时以它为准，避免闭包过期导致后一笔覆盖前一笔。
       这里用 layout effect 同步对齐，被动 effect 可能滞后于下一次点击而把盘面回退 */
    const cellsRef = useRef(cells);
    useLayoutEffect(() => {
        cellsRef.current = state.cells;
    }, [state]);

    const { size, rowClues, colClues, solution, target } = session;

    const filled = useMemo(() => countFilled(cells), [cells]);
    const doneLines = useMemo(
        () => countDoneLines(cells, rowClues, colClues),
        [cells, rowClues, colClues]
    );
    const progress = Math.min(100, Math.round((filled / (target || 1)) * 100));

    const sizeLabel = getSize(sizeId).label;
    const sizeDesc = getSize(sizeId).desc;

    const bestTime = record.best?.[sizeId] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('np.record', record), [record]);
    useEffect(() => safeSet('np.sound', soundOn), [soundOn]);
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
    const startNewGame = useCallback((id) => {
        const nextSize = id ?? 'small';
        const next = createSession(nextSize);
        recordedRef.current = false;
        setSizeId(nextSize);
        setSession(next);
        setTimeline([next.initial]);
        setPhase('playing');
        setElapsed(0);
        setErrors(0);
        setHint(null);
        setLastMove(null);
        setToast('');
        setShowResult(false);
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

    /* 落笔：涂黑、标记或清除 */
    const handlePaint = useCallback(
        (row, col, value) => {
            if (phase !== 'playing') return;
            if (cellsRef.current[row][col] === value) return;

            const isWrong = showErrors && value === FILLED && solution[row][col] === 0;
            const tone = isWrong
                ? 'wrong'
                : value === FILLED
                  ? 'fill'
                  : value === MARKED
                    ? 'mark'
                    : 'clear';
            const text = value === FILLED ? '涂黑' : value === MARKED ? '标记' : '清除';

            const next = applyChanges([{ row, col, value }], {
                label: coordLabel(row, col),
                text,
                tone
            });
            setLastMove({ row, col });
            setHint(null);

            if (isWrong) {
                setErrors((v) => v + 1);
                sound.flip();
            } else if (value === FILLED) {
                sound.place();
            } else {
                sound.click();
            }

            if (isSolved(next, solution)) finishGame();
        },
        [phase, showErrors, solution, applyChanges, finishGame]
    );

    /* 撤销 */
    const canUndo = timeline.length > 1;
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        recordedRef.current = false;
        setTimeline((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        setPhase('playing');
        setHint(null);
        setLastMove(null);
        setShowResult(false);
        sound.click();
    }, [canUndo]);

    /* 提示：优先给出逻辑上必然的格子 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;

        const spot =
            findLogicalHint(cellsRef.current, rowClues, colClues, size) ??
            findFallbackHint(cellsRef.current, solution);

        if (!spot) {
            showToast('图案已经完整啦');
            return;
        }

        const next = applyChanges([{ row: spot.row, col: spot.col, value: spot.value }], {
            label: coordLabel(spot.row, spot.col),
            text: spot.value === FILLED ? '提示·涂黑' : '提示·留白',
            tone: 'hint'
        });

        setHint({ row: spot.row, col: spot.col });
        setLastMove({ row: spot.row, col: spot.col });
        showToast(
            spot.value === FILLED
                ? `已为你涂出 ${coordLabel(spot.row, spot.col)}，这一格必定要涂`
                : `已为你标记 ${coordLabel(spot.row, spot.col)}，这一格必定留白`
        );
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);

        if (isSolved(next, solution)) finishGame();
    }, [phase, rowClues, colClues, size, solution, applyChanges, showToast, finishGame]);

    const statusText = () => {
        if (phase === 'over') return '恭喜，整幅图案已还原';
        if (filled > target) return `已涂 ${filled} 格 · 比图案多了 ${filled - target} 格`;
        if (filled === target) return '已涂格数与图案一致，检查一下位置';
        return `已涂 ${filled} / ${target} 格 · 还需涂黑 ${target - filled} 格`;
    };

    return (
        <div className="np-page">
            <GameNav />
            <BackBar title="数织" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">像素推理 · Nonogram</div>
                    <h1 className="gp-hero__title">
                        数织 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        每一行、每一列的数字，都是这一段涂黑格长度的线索。
                        顺着线索把格子一格一格地填出来，一幅藏在网格里的像素图案会慢慢浮出水面——
                        这就是数织最迷人的时刻。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">三档尺寸</span>
                        <span className="ui-tag">唯一解生成</span>
                        <span className="ui-tag">拖动连续涂色</span>
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
                            cells={cells}
                            rowClues={rowClues}
                            colClues={colClues}
                            size={size}
                            solution={solution}
                            showErrors={showErrors}
                            markMode={markMode}
                            hint={hint}
                            lastMove={lastMove}
                            interactive={phase === 'playing'}
                            onPaint={handlePaint}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已涂</span>
                                <strong>{filled}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">目标</span>
                                <strong>{target}</strong>
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
                            <span>左键落笔 · 右键标记，按住拖动可连续涂</span>
                            <span>数字是连续涂黑格的长度，顺序不可调换</span>
                            <span>金色虚框是引擎推出的必然格</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">还原进度</span>
                                <span className="gp-dash__lead">
                                    {filled} / {target} 格 · {progress}%
                                </span>
                            </div>
                            <div className="np-progress">
                                <span
                                    className="np-progress__fill"
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
                                    <span>完成行</span>
                                    <strong>
                                        {doneLines.rows} / {size}
                                    </strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>完成列</span>
                                    <strong>
                                        {doneLines.cols} / {size}
                                    </strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>满行</b> 线索之和等于行长时可一次填满
                                </span>
                                <span className="gp-dash__tip">
                                    <b>大数字</b> 覆盖的交集必定要涂
                                </span>
                                <span className="gp-dash__tip">
                                    <b>标记</b> 先确定留白，再涂黑
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">尺寸设置</h2>
                            <div className="ui-seg np-sizes">
                                {SIZES.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`ui-seg__item ${
                                            sizeId === item.id ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            if (item.id === sizeId) return;
                                            startNewGame(item.id);
                                            sound.click();
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <p className="np-diff__note">{sizeDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">落笔方式</h2>
                            <div className="gp-field">
                                <span className="gp-field__label">左键行为</span>
                                <div className="ui-seg gp-seg-full">
                                    <button
                                        className={`ui-seg__item ${
                                            !markMode ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setMarkMode(false);
                                            sound.click();
                                        }}
                                    >
                                        涂黑
                                    </button>
                                    <button
                                        className={`ui-seg__item ${markMode ? 'is-active' : ''}`}
                                        onClick={() => {
                                            setMarkMode(true);
                                            sound.click();
                                        }}
                                    >
                                        标记
                                    </button>
                                </div>
                            </div>
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
                            <p className="np-mode__note">
                                右键始终为标记；按住左键拖动可连续涂同一片区域。关闭自动纠错即进入纯推理模式，涂错的格子不再标红。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button
                                    className="ui-btn ui-btn--primary"
                                    onClick={() => startNewGame(sizeId)}
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
                                    <strong>
                                        {bestTime != null ? formatTime(bestTime) : '—'}
                                    </strong>
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
                                <p className="gp-log__empty">开始推演后，每一步操作都会记录在这里。</p>
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
                                                    className={`np-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于数织</div>
                            <h2 className="ui-section-title">
                                一支笔就能画出的
                                <span className="ui-grad-text">藏图游戏</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数织诞生于 1987 年的日本，最初以「图画逻辑」的名字发表，
                                后来在欧美报刊上以 Nonogram、Griddlers 的名字广为流传。
                                它不需要对手，也不需要运气，
                                只要一支笔和一张方格纸，就能安静地推演下去。
                            </p>
                            <p>
                                它的妙处在于「藏」：题目给出的只是一串串数字，
                                可当每一行、每一列的涂黑段都被你一一对上，
                                原本零散的格子会突然连成一片，显出一幅完整的图案。
                                那一刻的惊喜，正是数织几十年来始终让人着迷的原因。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数织</h2>
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
                            <h2 className="ui-section-title">为藏图体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把数织搬到浏览器里，而是把拖动涂色、标记、提示、纠错与战绩
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
                        <h2 className="gp-cta__title">准备好揭开图案了吗？</h2>
                        <p className="gp-cta__desc">
                            想用五分钟找回专注，还是想安静地挑战一张 15×15 的藏图，
                            数织都能给你一段只属于推理的时间。现在就开始吧。
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

            <MoreGames currentId="nonogram" />

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
                                <li>数织</li>
                                <li>数独</li>
                                <li>扫雷</li>
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
                    <div className="gp-modal__card is-win">
                        <div className="gp-modal__badge" aria-hidden="true">
                            <span className="gp-modal__badge-ring" />
                        </div>
                        <h3 className="gp-modal__title">恭喜，图案还原完成！</h3>
                        <p className="gp-modal__sub">
                            你用 {formatTime(elapsed)} 完成了这局「{sizeLabel}」数织，
                            错误 {errors} 次，共 {log.length} 步。
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

export default NonogramGame;
