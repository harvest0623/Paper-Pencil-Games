import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    DIFFICULTIES,
    createSession,
    analyzeBoard,
    cycleCount,
    decreaseCount,
    partnersOf,
    findHint,
    findLinkId
} from './utils/gameLogic';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Hashiwokakero.css';

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

const DEFAULT_RECORD = {
    games: 0,
    totalTime: 0,
    best: { easy: null, medium: null, hard: null }
};

const FAQ_ITEMS = [
    {
        q: '数桥的规则是什么？',
        a: '棋盘上有若干座岛，每座岛上标着一个数字。用水平或垂直的桥把岛两两相连，使每座岛连接的桥数恰好等于它的数字，同时所有桥不能交叉、不能跨越其他岛，最终所有岛要连成一片。'
    },
    {
        q: '两座岛之间可以连几座桥？',
        a: '最多两座。一座桥就是一条线，两座桥会画成两条平行线。依次点击两座岛可以让桥数在 0、1、2 之间循环；点击已有桥则会减少一座。'
    },
    {
        q: '桥可以斜着连或者拐弯吗？',
        a: '不可以。桥只能沿水平或垂直方向直线连接两座岛，中间也不能有别的岛。斜线、折线以及跨越其他岛的桥都不允许。'
    },
    {
        q: '为什么数字都满足了还没通关？',
        a: '数字只约束每座岛的桥数，此外还要求所有桥不能交叉、所有岛连成一片。如果数字全部满足但仍有孤岛，说明某处需要改接另一条通道。'
    },
    {
        q: '岛上数字最大是多少？',
        a: '本页题目中的数字在 1 到 8 之间。数字 8 意味着这座岛上下左右四个方向都要连双桥，是最强的约束。'
    },
    {
        q: '金色虚框是什么？',
        a: '点击「提示」后，引擎会补上一座正确的桥，并用金色虚框标出；如果当前棋盘存在冲突，则会先指出多加或交叉的桥，提示你先移除。'
    },
    {
        q: '三个难度有什么区别？',
        a: '入门是 7×7 棋盘、11 座岛；进阶是 9×9、18 座岛；挑战是 11×11、26 座岛。棋盘越大，候选桥越多，推理链与交叉判断也越复杂。'
    }
];

const RULES = [
    {
        step: '01',
        title: '数字就是桥数',
        desc: '每座岛上的数字表示与它相连的桥的总数。数字 3 可以是一座单桥加一座双桥，也可以是三座不同的桥。'
    },
    {
        step: '02',
        title: '直线连接两岛',
        desc: '桥只能水平或垂直连接两座岛，不能斜连、不能拐弯，中间也不能隔着其他岛。'
    },
    {
        step: '03',
        title: '两岛最多双桥',
        desc: '同一对岛之间最多两座桥，会画成两条平行线。不能出现三座或更多桥。'
    },
    {
        step: '04',
        title: '不交叉且全连通',
        desc: '桥与桥不能交叉，所有岛必须通过桥连成一张完整的网络，才算完成。'
    }
];

const TIPS = [
    {
        title: '数字 1 的岛',
        desc: '只需要一座桥。若它只有一个可以连接的方向，就立刻把这座桥连上；若有两个方向，先判断哪个方向更可能被别的岛需要。'
    },
    {
        title: '先做 1 和 2',
        desc: '小数字的岛选择少，往往能直接确定桥的去向。每确定一座桥，邻岛的需求就减少，连锁推理会一路展开。'
    },
    {
        title: '只剩一个方向',
        desc: '当某座岛只剩一条可用的通道，而数字尚未满足时，剩余桥数只能全部压在这条通道上，注意它可能是双桥。'
    },
    {
        title: '数字 8 最特殊',
        desc: '若出现数字 8，说明四个方向都必须连双桥，可以直接把四条双桥全部画出，再由邻岛继续推导。'
    },
    {
        title: '提前检查交叉',
        desc: '画横桥时先看它是否会挡住未来可能出现的竖桥；两条桥在非岛格相交是绝对禁止的。'
    },
    {
        title: '最后看连通性',
        desc: '数字全部满足后，检查是否所有岛都连在一起。若有孤立的小网络，说明某两座岛之间应改走另一条桥路。'
    }
];

const FEATURES = [
    {
        title: '三种规格',
        desc: '7×7、9×9、11×11 逐级加大，从 11 座岛到 26 座岛，难度递进自然。'
    },
    {
        title: '唯一解题库',
        desc: '所有题目都经过求解器验证，保证只有唯一解，不会出现推理正确却无解的情况。'
    },
    {
        title: '实时冲突提示',
        desc: '岛屿桥数超出会立刻变红，交叉的桥也会高亮，帮助你在第一时间发现问题。'
    },
    {
        title: '引擎提示',
        desc: '卡住时一键补上正确的桥，并用金色虚框标出；有冲突时先提示你移除错误的桥。'
    },
    {
        title: '撤销与计时',
        desc: '每一步都可撤销，全程计时并记录操作，让你可以安心尝试不同的桥路。'
    },
    {
        title: '战绩与最佳用时',
        desc: '自动保存完成局数、各难度最佳用时与平均用时，见证推理速度的提升。'
    }
];

function HashiwokakeroGame() {
    const [difficulty, setDifficulty] = useState('easy');
    const [session, setSession] = useState(() => createSession('easy'));
    const [timeline, setTimeline] = useState(() => [session.initial]);
    const [selected, setSelected] = useState(null);
    const [phase, setPhase] = useState('playing');
    const [elapsed, setElapsed] = useState(0);
    const [conflictEvents, setConflictEvents] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState('');
    const [hint, setHint] = useState(null);
    const [lastLink, setLastLink] = useState(null);
    const [showResult, setShowResult] = useState(false);

    const [record, setRecord] = useState(() => safeGet('hk.record', DEFAULT_RECORD));
    const [soundOn, setSoundOn] = useState(() => safeGet('hk.sound', true));

    const timelineRef = useRef(timeline);
    const toastTimer = useRef(null);
    const hintTimer = useRef(null);
    const lastTimer = useRef(null);
    const recordedRef = useRef(false);

    const state = timeline[timeline.length - 1] ?? session.initial;
    const { counts, log } = state;

    const analysis = useMemo(
        () => analyzeBoard(session, counts),
        [session, counts]
    );
    const targets = useMemo(
        () =>
            selected === null
                ? new Set()
                : partnersOf(session, selected),
        [session, selected]
    );

    const difficultyItem =
        DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[0];
    const difficultyLabel = difficultyItem.label;
    const bestTime = record.best?.[difficulty] ?? null;
    const avgTime = record.games ? Math.round(record.totalTime / record.games) : 0;
    const totalIslands = session.islands.length;
    const progress = Math.round((analysis.completed / totalIslands) * 100);
    const selectedLabel =
        selected !== null ? session.islands[selected]?.label ?? '—' : '未选择';

    useEffect(() => {
        timelineRef.current = timeline;
    }, [timeline]);

    useEffect(() => safeSet('hk.record', record), [record]);
    useEffect(() => safeSet('hk.sound', soundOn), [soundOn]);
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
            if (lastTimer.current) clearTimeout(lastTimer.current);
        },
        []
    );

    /* Esc 取消选中 */
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setSelected(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 2100);
    }, []);

    const armHintTimer = useCallback(() => {
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 4500);
    }, []);

    /* 开始新的一局 */
    const startNewGame = useCallback((difficultyId) => {
        const next = createSession(difficultyId ?? 'easy');
        recordedRef.current = false;
        if (hintTimer.current) clearTimeout(hintTimer.current);
        if (lastTimer.current) clearTimeout(lastTimer.current);
        timelineRef.current = [next.initial];
        setDifficulty(next.config.id);
        setSession(next);
        setTimeline([next.initial]);
        setSelected(null);
        setPhase('playing');
        setElapsed(0);
        setConflictEvents(0);
        setHintsUsed(0);
        setToast('');
        setHint(null);
        setLastLink(null);
        setShowResult(false);
    }, []);

    /* 提交一份新的桥面快照 */
    const commitCounts = useCallback((nextCounts, entry, linkId) => {
        const history = timelineRef.current;
        const current = history[history.length - 1];
        const nextState = {
            counts: nextCounts,
            log: entry ? [...current.log, entry] : current.log
        };
        timelineRef.current = [...history, nextState];
        setTimeline(timelineRef.current);
        if (linkId != null) {
            setLastLink(linkId);
            if (lastTimer.current) clearTimeout(lastTimer.current);
            lastTimer.current = setTimeout(() => setLastLink(null), 650);
        }
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

    /* 修改指定桥的数量 */
    const applyMove = useCallback(
        (linkId, nextValue, text) => {
            if (phase !== 'playing') return;
            const history = timelineRef.current;
            const current = history[history.length - 1];
            const nextCounts = current.counts.map((value, index) =>
                index === linkId ? nextValue : value
            );
            const link = session.links[linkId];
            commitCounts(
                nextCounts,
                { label: link.label, text, tone: nextValue > 0 ? 'bridge' : 'clear' },
                linkId
            );

            setHint(null);
            const result = analyzeBoard(session, nextCounts);
            const conflicted =
                result.overfilled.has(link.a) ||
                result.overfilled.has(link.b) ||
                result.crossingLinks.has(linkId);
            if (conflicted) setConflictEvents((value) => value + 1);

            if (nextValue > 0) sound.place();
            else sound.click();

            if (result.solved) {
                finishGame();
                return;
            }
            if (result.allCluesMet && !result.connected) {
                showToast('数字都满足了，但还有岛屿没有连通');
            }
        },
        [phase, session, commitCounts, finishGame, showToast]
    );

    /* 点击岛屿：先选中，再点第二座建桥 */
    const handleIslandClick = useCallback(
        (islandId) => {
            if (phase !== 'playing') return;

            if (selected === null) {
                setSelected(islandId);
                sound.click();
                return;
            }
            if (selected === islandId) {
                setSelected(null);
                sound.click();
                return;
            }

            const linkId = findLinkId(session, selected, islandId);
            if (linkId === null) {
                setSelected(islandId);
                sound.click();
                return;
            }

            const history = timelineRef.current;
            const current = history[history.length - 1];
            const currentCount = current.counts[linkId] ?? 0;
            const nextCount = cycleCount(currentCount);
            applyMove(
                linkId,
                nextCount,
                nextCount === 0 ? '清除' : nextCount === 2 ? '双桥' : '单桥'
            );
        },
        [phase, selected, session, applyMove]
    );

    /* 点击桥：减少一座 */
    const handleBridgeClick = useCallback(
        (linkId) => {
            if (phase !== 'playing') return;
            const history = timelineRef.current;
            const current = history[history.length - 1];
            const currentCount = current.counts[linkId] ?? 0;
            if (currentCount <= 0) return;
            applyMove(
                linkId,
                decreaseCount(currentCount),
                currentCount === 2 ? '减为单桥' : '移除桥'
            );
        },
        [phase, applyMove]
    );

    /* 撤销 */
    const canUndo = timeline.length > 1 && phase === 'playing';
    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        const history = timelineRef.current;
        if (history.length <= 1) return;
        const next = history.slice(0, -1);
        timelineRef.current = next;
        setTimeline(next);
        setHint(null);
        setSelected(null);
        sound.click();
    }, [canUndo]);

    /* 提示：先解决冲突，否则补一座正确的桥 */
    const handleHint = useCallback(() => {
        if (phase !== 'playing') return;
        const history = timelineRef.current;
        const current = history[history.length - 1];
        const suggestion = findHint(session, current.counts);

        if (!suggestion) {
            showToast('当前没有可用的提示');
            return;
        }

        if (!suggestion.build) {
            setHint({ type: suggestion.type, id: suggestion.id });
            setSelected(suggestion.type === 'island' ? suggestion.id : null);
            showToast(suggestion.message);
            armHintTimer();
            sound.click();
            return;
        }

        const link = suggestion.link;
        const nextValue = (current.counts[link.id] ?? 0) + 1;
        const nextCounts = current.counts.map((value, index) =>
            index === link.id ? nextValue : value
        );

        commitCounts(
            nextCounts,
            { label: link.label, text: '提示 +1', tone: 'hint' },
            link.id
        );
        setHintsUsed((value) => value + 1);
        setHint({ type: 'link', id: link.id });
        showToast(suggestion.message);
        armHintTimer();
        sound.place();

        if (analyzeBoard(session, nextCounts).solved) finishGame();
    }, [
        phase,
        session,
        commitCounts,
        finishGame,
        showToast,
        armHintTimer
    ]);

    const statusText = () => {
        if (phase === 'over') return '恭喜完成本局数桥';
        return `已完成 ${analysis.completed} / ${totalIslands} 座岛 · 已建 ${analysis.bridgeCount} 座桥`;
    };

    return (
        <div className="hk-page">
            <GameNav />
            <BackBar title="数桥" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">逻辑推理 · Hashiwokakero</div>
                    <h1 className="gp-hero__title">
                        数桥 <span className="ui-grad-text">在线挑战</span>
                    </h1>
                    <p className="gp-hero__desc">
                        在岛屿之间架起横向与纵向的桥，让每座岛连接的桥数恰好等于岛上的数字。
                        桥不能交叉、不能跨越其他岛，最终所有岛要连成一片。
                        线索都摆在明面上，缺的只是一条条推下去的思路。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">7 / 9 / 11 阶</span>
                        <span className="ui-tag">数字即桥数</span>
                        <span className="ui-tag">禁止交叉</span>
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
                            rows={session.rows}
                            cols={session.cols}
                            islands={session.islands}
                            links={session.links}
                            counts={counts}
                            sums={analysis.sums}
                            selected={selected}
                            hint={hint}
                            targets={targets}
                            overfilled={analysis.overfilled}
                            crossingLinks={analysis.crossingLinks}
                            lastLink={lastLink}
                            interactive={phase === 'playing'}
                            onIslandClick={handleIslandClick}
                            onBridgeClick={handleBridgeClick}
                        />

                        <div className="gp-boardstats">
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">完成岛屿</span>
                                <strong>
                                    {analysis.completed}/{totalIslands}
                                </strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">已建桥</span>
                                <strong>{analysis.bridgeCount}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">冲突</span>
                                <strong>{conflictEvents}</strong>
                            </div>
                            <div className="gp-boardstat">
                                <span className="gp-boardstat__label">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                        </div>

                        <p className="gp-stage__hint">
                            <span>依次点击两座岛即可建桥</span>
                            <span>再点一次变双桥，第三次清除</span>
                            <span>点击已有桥可减少一座</span>
                        </p>

                        <div className="gp-dash">
                            <div className="gp-dash__head">
                                <span className="gp-dash__title">连通进度</span>
                                <span className="gp-dash__lead">
                                    {analysis.completed} / {totalIslands} 座岛 · {progress}%
                                </span>
                            </div>
                            <div className="hk-progress">
                                <span
                                    className="hk-progress__fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="gp-dash__meta">
                                <div className="gp-dash__cell">
                                    <span>当前难度</span>
                                    <strong>{difficultyLabel}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>已建桥</span>
                                    <strong>{analysis.bridgeCount}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>提示次数</span>
                                    <strong>{hintsUsed}</strong>
                                </div>
                                <div className="gp-dash__cell">
                                    <span>冲突次数</span>
                                    <strong>{conflictEvents}</strong>
                                </div>
                            </div>
                            <div className="gp-dash__tips">
                                <span className="gp-dash__tip">
                                    <b>数字 1</b> 通常只有一条路
                                </span>
                                <span className="gp-dash__tip">
                                    <b>最多双桥</b> 同一对岛最多两座
                                </span>
                                <span className="gp-dash__tip">
                                    <b>全岛连通</b> 数字满足后还要检查
                                </span>
                            </div>
                        </div>
                    </div>

                    <aside className="gp-stage__panel">
                        <div className="gp-card">
                            <h2 className="gp-card__title">难度设置</h2>
                            <div className="ui-seg hk-diff">
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
                            <p className="hk-diff__note">{difficultyItem.desc}</p>
                            <p className="hk-note">
                                单点一座岛选中它，再点同排或同列的另一座岛即可建桥；
                                重复点击同一对岛会在单桥、双桥、无桥之间循环。
                            </p>
                        </div>

                        <div className="gp-card">
                            <h2 className="gp-card__title">
                                操作
                                <span className="gp-card__count">已选 {selectedLabel}</span>
                            </h2>
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
                                    开始建桥后，每一步操作都会记录在这里。
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
                                                    className={`hk-log__text is-${entry.tone}`}
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
                            <div className="ui-eyebrow">关于数桥</div>
                            <h2 className="ui-section-title">
                                用一座座桥，
                                <span className="ui-grad-text">把散落的岛连成大陆</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                数桥（Hashiwokakero，又称「桥」）起源于日本，是一道以连接为核心的逻辑谜题。
                                棋盘上散布着若干座岛，每座岛上的数字就是它需要连接的桥的数量。
                                你要做的，是用水平或垂直的直线桥把岛两两相连。
                            </p>
                            <p>
                                看似自由的建桥，其实处处受限：同一对岛最多两座桥，桥不能斜连、
                                不能跨越其他岛、也不能互相交叉，最后所有岛还必须连成一片。
                                每画下一座桥，邻岛的需求就少一分，整张网络的形状也随之清晰。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂数桥</h2>
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
                            我们不只是把数桥搬到浏览器里，而是把冲突提示、撤销、计时和战绩
                            都做成顺手的能力，让你在任何设备上都能专注地架桥。
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
                        <h2 className="gp-cta__title">准备好把岛连起来了吗？</h2>
                        <p className="gp-cta__desc">
                            从 7×7 的第一座桥开始，让散落的岛慢慢连成一片。
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

            <MoreGames currentId="hashiwokakero" />

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
                                <li>数桥</li>
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
                        <h3 className="gp-modal__title">恭喜完成！</h3>
                        <p className="gp-modal__sub">
                            你用 {formatTime(elapsed)} 完成了这局「{difficultyLabel}
                            」难度数桥，建成 {analysis.bridgeCount} 座桥，使用提示{' '}
                            {hintsUsed} 次。
                        </p>
                        <div className="gp-modal__score">
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">用时</span>
                                <strong>{formatTime(elapsed)}</strong>
                            </div>
                            <span className="gp-modal__vs">·</span>
                            <div className="gp-modal__score-item">
                                <span className="gp-modal__name">桥梁</span>
                                <strong>{analysis.bridgeCount}</strong>
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

export default HashiwokakeroGame;
