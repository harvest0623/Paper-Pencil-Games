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
    LINE,
    CROSS,
    createEdges,
    cloneEdges,
    edgeLabel,
    countSatisfied,
    clueCount,
    countEdges,
    findLoops,
    isSolved,
    findViolations,
    autoCrossEdges,
    findLogicalHint,
    findSolutionHint,
    generateByDifficulty
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Slitherlink.css';

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

const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/* 生成一局会话：题目、答案与空盘面 */
const createSession = (sizeId) => {
    const puzzle = generateByDifficulty(sizeId);
    const edges = createEdges(puzzle.n);
    return {
        ...puzzle,
        initial: { edges, log: [] }
    };
};

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null }
};

const FAQ_ITEMS = [
    {
        q: '数回该怎么玩？',
        a: '沿着点阵画线，让每个数字格四周的线段数正好等于格子里的数字，同时所有的线要连成一条首尾相接、不自交的闭合回路。数字是线索，回路才是目标。'
    },
    {
        q: '数字 0、3 这类提示有什么特别之处？',
        a: '数字 0 表示这一格四周一条线也不能有，四条边全部打叉；数字 3 表示四条边里有三条是线，只剩一条要打叉。极端的数字往往是最好下手的地方。'
    },
    {
        q: '线段可以分叉或者交叉吗？',
        a: '都不可以。回路在每个点上要么不经过（0 条线），要么刚好经过两条线；出现三条线、或者一条线孤零零地挂在某个点上，都是不合法的状态。'
    },
    {
        q: '题目需要靠猜吗？',
        a: '不需要。每道题都由程序现场生成并校验为唯一解，而且整盘都可以用推理逐步画出来，不会出现必须猜测才能继续的局面。'
    },
    {
        q: '金色虚框代表什么？',
        a: '那是你点击「提示」后，引擎根据盘面推演出的必然边：它会直接帮你画上线或打上叉，并用金色虚框标出位置。若纯推演暂时没有结论，引擎会揭示答案中的一条边，帮你重新找回思路。'
    },
    {
        q: '「智能打叉」是什么？',
        a: '开启后，某个数字格四周的线段数一旦已经对上，它剩下还没处理的边会被自动打叉，省去逐个点击的麻烦。这个判断完全来自你自己的盘面，与答案无关。'
    }
];

const RULES = [
    {
        step: '01',
        title: '看懂数字',
        desc: '格中的数字表示「这一格四周应该有几条线段」，0 就是四条边都不能有线，3 就是只允许一条边空着。'
    },
    {
        step: '02',
        title: '画线打叉',
        desc: '点击任意一条边可以画上线；再点一次变成打叉，表示这里肯定不是线；第三次点击则清除。每一步都用「是线」和「不是线」两种判断推进。'
    },
    {
        step: '03',
        title: '守住点阵',
        desc: '每个点上经过的线段只能是 0 条或 2 条。某点已经连上两条线，它的其他边就必须打叉；只连了一条，就必须再连一条，这条规则会带出大量结论。'
    },
    {
        step: '04',
        title: '闭环即胜',
        desc: '当所有数字格都满足、并且画出的线恰好连成唯一一条闭合回路时，这一局就完成了。'
    }
];

const TIPS = [
    { title: '从 0 和 3 下手', desc: '0 的四条边全部打叉，3 的四条边里只有一条打叉，开局先解决这些极端数字，盘面立刻清晰。' },
    { title: '盯着点阵度数', desc: '某个点周围只剩两种可能时，往往能立刻定下一条线；一条线孤悬在任何点上都是不合法的。' },
    { title: '警惕提前闭合', desc: '回路一旦闭合成一个小圈，又不能包含全部数字格，就说明当前画法走进了死路，要尽早回头。' },
    { title: '数一数就排除', desc: '某个数字格四周已经布满线或叉时，剩下的边按数量一算就知道该画线还是打叉。' },
    { title: '用叉缩小范围', desc: '打叉不推进回路，却能大幅缩小可能范围；把「肯定不是线」的地方标出来，比画线更容易看出下一步。' },
    { title: '卡住就按提示', desc: '确实推不动时按一次「提示」，让引擎找出逻辑上必然的一条边，重新找回节奏。' }
];

const FEATURES = [
    { title: '唯一解实时生成', desc: '每道题都由程序现场生成并校验为唯一解，答案确定、不需要靠猜，随时开始都是新题。' },
    { title: '三档尺寸曲线', desc: '从 5×5 入门到 9×9 挑战，回路长度与绕行复杂度逐级提升，循序渐进地进阶。' },
    { title: '三段点击循环', desc: '同一条边「画线 → 打叉 → 清除」一键循环，配合悬停预览与最后一步高亮，落笔干净利落。' },
    { title: '智能提示引擎', desc: '基于约束传播实时推演出逻辑上必然的边，直接用金色虚框标出并帮你落下，卡住时也能继续。' },
    { title: '智能打叉与违规提醒', desc: '数字格一旦满足就自动叉掉多余的边；连线数超标或出现死路的点会立刻标红，让错误无处藏身。' },
    { title: '战绩与最佳用时', desc: '自动保存完成局数与各尺寸最佳用时，见证自己的推理速度越来越快。' }
];

function SlitherlinkGame() {
    const [sizeId, setSizeId] = useState(DEFAULT_SIZE);
    const [session, setSession] = useState(() => createSession(DEFAULT_SIZE));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [phase, setPhase] = useState('playing');
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [showViolations, setShowViolations] = useState(true);
    const [autoCross, setAutoCross] = useState(false);

    const [record, setRecord] = useState(() => safeGet('sl.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('sl.sound', true));

    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { edges, log } = state;

    /* 最新盘面的镜像：连续点击时以它为准，避免闭包过期把前面的操作覆盖 */
    const edgesRef = useRef(edges);
    useLayoutEffect(() => {
        edgesRef.current = state.edges;
    }, [state]);

    const { n, digits, solution } = session;

    const totalClues = useMemo(() => clueCount(digits), [digits]);
    const satisfied = useMemo(() => countSatisfied(n, digits, edges), [n, digits, edges]);
    const lines = useMemo(() => countEdges(edges, LINE), [edges]);
    const crosses = useMemo(() => countEdges(edges, CROSS), [edges]);
    const progress = Math.min(100, Math.round((satisfied / (totalClues || 1)) * 100));

    const loops = useMemo(() => findLoops(n, edges), [n, edges]);
    const closed = loops.loops === 1 && loops.components === 1;
    const violations = useMemo(() => {
        if (!showViolations) return new Set();
        return findViolations(n, digits, edges);
    }, [n, digits, edges, showViolations]);

    const sizeLabel = getSize(sizeId).label;
    const sizeDesc = getSize(sizeId).desc;

    const bestTime = record.best?.[sizeId] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;

    useEffect(() => safeSet('sl.record', record), [record]);
    useEffect(() => safeSet('sl.sound', soundOn), [soundOn]);
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
        toastTimer.current = setTimeout(() => setToast(''), 2000);
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
            setHintsUsed(0);
            setHint(null);
            setLastMove(null);
            setToast('');
            setShowResult(false);
            setBusy(false);
        }, 30);
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

    /* 提交一组边的改动：以最新盘面为基准，返回改动后的盘面 */
    const applyChanges = useCallback((changes, logEntry) => {
        const board = edgesRef.current;
        const next = cloneEdges(board);
        changes.forEach(({ t, r, c, state: value }) => {
            if (t === 'h') next.h[r][c] = value;
            else next.v[r][c] = value;
        });
        edgesRef.current = next;

        setTimeline((prev) => {
            const cur = prev[prev.length - 1];
            const nextEdges = cloneEdges(cur.edges);
            changes.forEach(({ t, r, c, state: value }) => {
                if (t === 'h') nextEdges.h[r][c] = value;
                else nextEdges.v[r][c] = value;
            });
            return [...prev, { edges: nextEdges, log: [...(cur?.log ?? []), logEntry] }];
        });

        return next;
    }, []);

    /* 点击一条边：画线 → 打叉 → 清除 */
    const handleEdgeClick = useCallback(
        (edge) => {
            if (phase !== 'playing' || busy) return;
            const { t, r, c } = edge;
            const board = edgesRef.current;
            const current = t === 'h' ? board.h[r][c] : board.v[r][c];
            const nextState = current === EMPTY ? LINE : current === LINE ? CROSS : EMPTY;

            const changes = [{ t, r, c, state: nextState }];

            /* 智能打叉：改完之后，把已经满足的数字格其余待定边一并打叉 */
            if (autoCross && nextState !== EMPTY) {
                const preview = cloneEdges(board);
                changes.forEach(({ t: ct, r: cr, c: cc, state: value }) => {
                    if (ct === 'h') preview.h[cr][cc] = value;
                    else preview.v[cr][cc] = value;
                });
                const extra = autoCrossEdges(n, digits, preview).filter(
                    (item) => !(item.t === t && item.r === r && item.c === c)
                );
                changes.push(...extra);
            }

            const tone = nextState === LINE ? 'line' : nextState === CROSS ? 'cross' : 'clear';
            const text = nextState === LINE ? '画线' : nextState === CROSS ? '打叉' : '清除';
            const next = applyChanges(changes, { label: edgeLabel({ t, r, c }), text, tone });

            setLastMove({ t, r, c });
            setHint(null);

            if (nextState === LINE) sound.place();
            else sound.click();

            if (isSolved(n, digits, next)) finishGame();
        },
        [phase, busy, n, digits, autoCross, applyChanges, finishGame]
    );

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

    /* 提示：优先给出逻辑上必然的边 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing' || busy) return;

        const board = edgesRef.current;
        const spot = findLogicalHint(n, digits, board) ?? findSolutionHint(n, solution, board);

        if (!spot) {
            showToast('盘面已经没有需要处理的边啦');
            return;
        }

        const next = applyChanges([{ t: spot.t, r: spot.r, c: spot.c, state: spot.state }], {
            label: edgeLabel(spot),
            text: spot.state === LINE ? '提示·画线' : '提示·打叉',
            tone: 'hint'
        });

        setHint({ t: spot.t, r: spot.r, c: spot.c, state: spot.state });
        setLastMove({ t: spot.t, r: spot.r, c: spot.c });
        setHintsUsed((v) => v + 1);
        showToast(
            spot.state === LINE
                ? `${edgeLabel(spot)} 必定是连线`
                : `${edgeLabel(spot)} 不可能是连线`
        );
        sound.click();

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4000);

        if (isSolved(n, digits, next)) finishGame();
    }, [phase, busy, n, digits, solution, applyChanges, showToast, finishGame]);

    const statusText = () => {
        if (busy) return '正在生成题目…';
        if (phase === 'over') return '回路已闭合成环，本题完成';
        if (closed) return `回路已闭合，但仍有 ${totalClues - satisfied} 个数字格不符`;
        return `已连线 ${lines} 条 · 满足数字格 ${satisfied} / ${totalClues}`;
    };

    return (
        <div className="sl-page">
            <GameNav />
            <BackBar title="数回" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">一笔画回路 · Slitherlink</div>
                    <h1 className="gp-hero__title">
                        数回 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        沿着点阵画线，让每个数字格四周的线段数正好等于格子里的数字，
                        最后所有的线要连成一条首尾相接、既不自交也不分叉的闭合回路——
                        数回把「一笔画」的古老趣味，做成了一整盘可以慢慢推敲的逻辑题。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">三档尺寸</span>
                        <span className="ui-tag">唯一解生成</span>
                        <span className="ui-tag">三段点击循环</span>
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
                            n={n}
                            digits={digits}
                            edges={edges}
                            violations={violations}
                            lastMove={lastMove}
                            hint={hint}
                            closed={closed}
                            interactive={phase === 'playing' && !busy}
                            onEdgeClick={handleEdgeClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已连线</span>
                                <strong>{lines}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已打叉</span>
                                <strong>{crosses}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">满足数字格</span>
                                <strong>{satisfied}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">提示次数</span>
                                <strong>{hintsUsed}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>点击线段：画线 → 打叉 → 清除</span>
                            <span>数字格四周的线段数要等于格中数字，0 与 3 最值得先下手</span>
                            <span>金色虚框是引擎推出的必然边</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">解题进度</span>
                                <span className="gp-dash__lead">
                                    {satisfied} / {totalClues} 个数字格 · {progress}%
                                </span>
                            </div>
                            <div className="sl-progress">
                                <span
                                    className="sl-progress__fill"
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
                                    <span>已连线</span>
                                    <strong>{lines} 条</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>回路状态</span>
                                    <strong>{closed ? '已闭合成环' : '尚未闭合'}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>0 与 3</b> 极端数字往往一步就能定下四条边
                                </span>
                                <span className="gp-dash__tip">
                                    <b>点阵度数</b> 每个点上的线段只能是 0 条或 2 条
                                </span>
                                <span className="gp-dash__tip">
                                    <b>提前闭合</b> 回路圈住的范围必须容得下全部数字格
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">尺寸设置</h2>
                            <div className="ui-seg sl-sizes">
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
                            <p className="sl-note">{sizeDesc}</p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">画线方式</h2>
                            <ul className="sl-steps">
                                <li>
                                    <b>第 1 次点击</b>
                                    <span>在这里画上线</span>
                                </li>
                                <li>
                                    <b>第 2 次点击</b>
                                    <span>打叉，表示肯定不是线</span>
                                </li>
                                <li>
                                    <b>第 3 次点击</b>
                                    <span>清除标记，回到待定状态</span>
                                </li>
                            </ul>
                            <p className="sl-note">
                                鼠标悬停在边上会浮现淡淡的预览线，帮你判断落点。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">辅助设置</h2>
                            <div className="gp-field">
                                <span className="gp-field__label">违规提醒</span>
                                <div className="ui-seg gp-seg-full">
                                    <button
                                        className={`ui-seg__item ${
                                            showViolations ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setShowViolations(true);
                                            sound.click();
                                        }}
                                    >
                                        开启
                                    </button>
                                    <button
                                        className={`ui-seg__item ${
                                            !showViolations ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setShowViolations(false);
                                            sound.click();
                                        }}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                            <div className="gp-field">
                                <span className="gp-field__label">智能打叉</span>
                                <div className="ui-seg gp-seg-full">
                                    <button
                                        className={`ui-seg__item ${
                                            autoCross ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setAutoCross(true);
                                            sound.click();
                                        }}
                                    >
                                        开启
                                    </button>
                                    <button
                                        className={`ui-seg__item ${
                                            !autoCross ? 'is-active' : ''
                                        }`}
                                        onClick={() => {
                                            setAutoCross(false);
                                            sound.click();
                                        }}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                            <p className="sl-note">
                                违规提醒会把线段数超标的数字格、出现死路的点标红；智能打叉则在数字格满足后自动叉掉多余的边。
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
                                <p className="gp-log__empty">开始画线后，每一步操作都会记录在这里。</p>
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
                                                    className={`sl-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于数回</div>
                            <h2 className="ui-section-title">
                                用数字推理
                                <span className="ui-grad-text">画出一条环</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数回（Slitherlink）最早由日本出版社 Nikoli 推广开来，
                                它把「一笔画」的趣味与数字推理巧妙地捏在了一起：
                                格中的数字不告诉你线在哪里，只告诉你线有几条，
                                剩下的每一段都要靠推理一点点逼出来。
                            </p>
                            <p>
                                它的妙处在于两条规则互相咬合——
                                数字约束着格子四周的线段数，点阵又约束着线的走向。
                                当你把一个个「确定不是线」的地方打上叉，
                                那条唯一正确的回路就会自己从盘面中浮现出来。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数回</h2>
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
                            <h2 className="ui-section-title">为画线推理而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们不只是把数回搬到浏览器里，而是把三段点击、悬停预览、智能打叉、提示与战绩
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
                        <h2 className="gp-cta__title">准备好画出一条回路了吗？</h2>
                        <p className="gp-cta__desc">
                            想用五分钟练练手感，还是想安静地挑战一张 9×9 的难题，
                            数回都能给你一段只属于推理的时间。现在就开始吧。
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

            <MoreGames currentId="slitherlink" />

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
                                <li>数回</li>
                                <li>数和</li>
                                <li>数织</li>
                                <li>数独</li>
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
                        <h3 className="gp-modal__title">恭喜，回路闭合成环！</h3>
                        <p className="gp-modal__sub">
                            你用 {formatTime(elapsed)} 完成了这局「{sizeLabel}」数回，
                            提示 {hintsUsed} 次，共画下 {lines} 条线、{log.length} 步操作。
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
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

export default SlitherlinkGame;
