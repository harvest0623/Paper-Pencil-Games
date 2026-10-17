import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import GameOverModal from '../components/GameOverModal';
import Accordion from '../components/Accordion';
import GameNav from '../components/GameNav';
import BackBar from '../components/BackBar';
import MoreGames from '../components/MoreGames';
import {
    DIR_H,
    DIR_V,
    FLEET,
    FLEET_CELLS,
    createSide,
    canPlace,
    placeShip,
    removeShip,
    clearShips,
    randomFleet,
    shipCells,
    isSunk,
    remainingShips,
    hitCount,
    fire as fireCell,
    coordLabel,
    dirLabel
} from './utils/gameLogic';
import { getAIShot } from './utils/ai';
import { sound } from '../utils/sound';
import '../styles/game-page.css';
import './Battleship.css';

const BLUE = 'blue';
const RED = 'red';
const other = (side) => (side === BLUE ? RED : BLUE);

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
        q: '舰船可以贴着放吗？',
        a: '可以。本作采用经典规则，舰船之间可以紧邻甚至并排，只要不重叠就好。这也意味着「打中一艘后向两侧延展」是有效的思路，但要留意两艘船可能正好拼在一起。'
    },
    {
        q: '为什么开局布阵这么重要？',
        a: '海战棋有一半胜负在布阵阶段就决定了。把大船放在角落、让舰队分散在棋盘的不同区域，是对手最难对付的布局；而把所有船挤在一条线上，很容易被顺着打穿。'
    },
    {
        q: '击中之后该怎么继续打？',
        a: '命中一艘船后，优先打它的上下左右，找到船身的方向后沿着这条线一路延伸，直到把这艘船打沉再换目标。这是所有海战棋高手的通用打法。'
    },
    {
        q: '为什么电脑总能很快找到我的船？',
        a: '困难档的引擎使用了棋盘奇偶性扫描：最短的驱逐舰占 2 格，因此任何舰船都必然覆盖某一种颜色的格子。先按奇偶性隔格搜索，能显著减少盲打次数。'
    },
    {
        q: '双人模式下会被对手看到吗？',
        a: '双人同屏模式两块海域都公开显示，适合面对面互相对抗、一起复盘；如果你想要保留「隐藏舰队」的悬念，切换到「玩家 vs 电脑」模式即可。'
    },
    {
        q: '悔棋会退回到哪一步？',
        a: '双人模式退回上一炮；人机对战会一直退回到你上一次开炮之前，方便你换一个目标格再试。'
    }
];

const RULES = [
    {
        step: '01',
        title: '排布舰队',
        desc: '双方各有一支由 5 艘舰船组成的舰队，共 17 格。舰船只能横放或竖放，不能重叠，也不能越出海域。'
    },
    {
        step: '02',
        title: '轮流炮击',
        desc: '蓝方先行，双方轮流开炮。点击对方海域上的任意一格即为炮击，同一格不能重复开炮。'
    },
    {
        step: '03',
        title: '命中与击沉',
        desc: '打中舰身即命中，该格显示为红色；当一艘舰船的所有格子都被命中，这艘船就被击沉。'
    },
    {
        step: '04',
        title: '全歼制胜',
        desc: '先击沉对方全部 5 艘舰船的一方获胜。这是一场关于概率与推理的较量，谁也看不到对方的海域。'
    }
];

const TIPS = [
    { title: '大船放角落', desc: '航母这类长舰放在角落或边缘，可被攻击的方向更少，对手需要更多发炮弹才能摸清它的走向。' },
    { title: '分散而非聚拢', desc: '把五艘船散落在棋盘的不同象限，避免被对手一路顺着打穿。扎堆的舰队往往会被一次追击全部解决。' },
    { title: '命中就往两边摸', desc: '打中一格后先打它的上下左右，确定船身方向后再沿直线延伸，直到击沉为止——这是效率最高的追打方式。' },
    { title: '隔格搜索', desc: '还没打中任何船时，可以按「棋盘隔一格」的方式扫描。最短的船占两格，所以隔格打一定不会漏掉全部舰船。' },
    { title: '盯住剩余舰种', desc: '当对手只剩驱逐舰（2 格）时，说明棋盘上再没有相邻三格以上的船，搜索时可以据此排除长条区域。' },
    { title: '先打中央再扫边', desc: '中央格被更多舰船走向覆盖，命中概率略高；边缘与角落虽然概率低，但一旦命中往往直接暴露整艘船的朝向。' }
];

const FEATURES = [
    { title: '三档智能引擎', desc: '简单档纯随机扫描，中等档懂得命中和追击，困难档使用奇偶性搜索与方向延展，越打越准。' },
    { title: '一键随机布阵', desc: '懒得排兵布阵时，点一下就能得到一份合法且分散的随机舰队，也可以随时清空重排。' },
    { title: '双海域同屏', desc: '左边对手海域负责开炮，右边己方海域随时查看挨打情况，每一步都看得清清楚楚。' },
    { title: '站内提示引擎', desc: '卡住时一键取回引擎推荐的目标格，用金色虚线标出，边打边体会海战棋的推理思路。' },
    { title: '悔棋与棋谱', desc: '支持逐步悔棋，完整记录每一炮的坐标与结果，命中、未命中、击沉一目了然。' },
    { title: '全设备自适应', desc: '手机、平板、桌面端均可清爽开玩，两块海域会自动换行排布，不会横向溢出。' }
];

function BattleshipGame() {
    const [mode, setMode] = useState('ai');
    const [difficulty, setDifficulty] = useState('medium');
    const [computerFirst, setComputerFirst] = useState(false);

    /* 布阵阶段：fleets 保存两支舰队的初始排布 */
    const [fleets, setFleets] = useState(() => ({ blue: createSide(), red: createSide() }));
    const [placing, setPlacing] = useState({ side: BLUE, dir: DIR_H, selected: FLEET[0].id });
    const [hover, setHover] = useState(null);

    /* 对战阶段：timeline 中每个元素都是一炮之后的完整局面，悔棋只需回退一格 */
    const [timeline, setTimeline] = useState([]);
    const [phase, setPhase] = useState('placing');
    const [hint, setHint] = useState(null);
    const [toast, setToast] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const [names, setNames] = useState(() =>
        safeGet('bs.names', { blue: '玩家', red: '电脑', p1: '玩家 1', p2: '玩家 2' })
    );
    const [record, setRecord] = useState(() => safeGet('bs.record', { win: 0, loss: 0, draw: 0 }));
    const [soundOn, setSoundOn] = useState(() => safeGet('bs.sound', true));

    const toastTimer = useRef(null);

    const battle = timeline.length ? timeline[timeline.length - 1] : null;
    const sides = battle ? battle.sides : fleets;
    const blueSide = sides.blue;
    const redSide = sides.red;
    const turn = battle ? battle.turn : null;
    const log = battle ? battle.log : [];

    const humanSide = BLUE; // 人机模式中玩家执蓝方
    const aiSide = RED;
    const thinking = phase === 'battle' && mode === 'ai' && turn === aiSide;
    const canPlay = phase === 'battle' && !thinking && (mode === 'pvp' || turn === humanSide);
    const revealRed = mode === 'pvp';
    const canFireAt = (side) => canPlay && turn !== null && other(turn) === side;

    /* 布阵阶段的派生状态 */
    const placeSide = placing.side;
    const placeFleet = fleets[placeSide];
    const placedIds = useMemo(() => new Set(placeFleet.ships.map((ship) => ship.id)), [placeFleet]);
    const pendingDefs = FLEET.filter((def) => !placedIds.has(def.id));
    const selectedDef = FLEET.find((def) => def.id === placing.selected) || null;
    const activeDef =
        selectedDef && !placedIds.has(selectedDef.id) ? selectedDef : pendingDefs[0] || null;
    const placeReady = pendingDefs.length === 0;

    const preview = useMemo(() => {
        if (phase !== 'placing' || !hover || !activeDef) return null;
        return {
            cells: shipCells(hover.r, hover.c, placing.dir, activeDef.size),
            valid: canPlace(placeFleet, hover.r, hover.c, placing.dir, activeDef.size)
        };
    }, [phase, hover, activeDef, placing.dir, placeFleet]);

    /* ---------------- 音效 / 名字 / 战绩持久化 ---------------- */
    useEffect(() => {
        sound.setEnabled(soundOn);
        safeSet('bs.sound', soundOn);
    }, [soundOn]);

    useEffect(() => {
        safeSet('bs.names', names);
    }, [names]);

    useEffect(() => {
        safeSet('bs.record', record);
    }, [record]);

    const showToast = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2000);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    /* ---------------- 计时：本局用时，重开时归零 ---------------- */
    useEffect(() => {
        if (phase === 'over') return undefined;
        const timer = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => window.clearInterval(timer);
    }, [phase]);

    const playerName = useCallback(
        (side) => {
            if (mode === 'ai') {
                return side === humanSide ? names.blue : names.red;
            }
            return side === BLUE ? names.p1 : names.p2;
        },
        [mode, humanSide, names]
    );

    const startBattle = useCallback(
        (nextFleets) => {
            setFleets(nextFleets);
            const first = mode === 'ai' ? (computerFirst ? aiSide : humanSide) : BLUE;
            setTimeline([
                {
                    sides: { blue: nextFleets.blue, red: nextFleets.red },
                    turn: first,
                    log: [],
                    lastShot: null
                }
            ]);
            setPhase('battle');
            setHint(null);
            setHover(null);
            setElapsed(0);
            showToast('舰队已就位，开始炮击');
        },
        [mode, computerFirst, aiSide, humanSide, showToast]
    );

    /* ---------------- 布阵 ---------------- */
    const toggleDir = useCallback(() => {
        setPlacing((prev) => ({ ...prev, dir: prev.dir === DIR_H ? DIR_V : DIR_H }));
        sound.click();
    }, []);

    useEffect(() => {
        if (phase !== 'placing') return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'r' || event.key === 'R') toggleDir();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [phase, toggleDir]);

    const handleShipButton = useCallback(
        (def) => {
            const placed = fleets[placeSide].ships.some((ship) => ship.id === def.id);
            if (placed) {
                setFleets((prev) => ({ ...prev, [placeSide]: removeShip(prev[placeSide], def.id) }));
                setPlacing((prev) => ({ ...prev, selected: def.id }));
                setHover(null);
                showToast(`已收回「${def.name}」，重新选择位置`);
                sound.click();
                return;
            }
            setPlacing((prev) => ({ ...prev, selected: def.id }));
            sound.click();
        },
        [fleets, placeSide, showToast]
    );

    const handlePlaceClick = useCallback(
        (r, c) => {
            const fleet = fleets[placeSide];
            if (!activeDef) {
                showToast('五艘舰船都已就位，点击「开始对战」');
                return;
            }
            const next = placeShip(fleet, activeDef, r, c, placing.dir);
            if (!next) {
                showToast(`「${activeDef.name}」放不下，换个格子或切换朝向`);
                return;
            }
            setFleets((prev) => ({ ...prev, [placeSide]: next }));
            sound.place();
            const rest = FLEET.filter((def) => !next.ships.some((ship) => ship.id === def.id));
            setPlacing((prev) => ({ ...prev, selected: rest.length ? rest[0].id : prev.selected }));
            if (!rest.length) showToast('舰队已就位，点击「开始对战」');
        },
        [fleets, placeSide, activeDef, placing.dir, showToast]
    );

    const handleRandomFleet = useCallback(() => {
        setFleets((prev) => ({ ...prev, [placeSide]: randomFleet() }));
        setHover(null);
        sound.flip(2);
        showToast('已随机布阵，可点舰船收回重排');
    }, [placeSide, showToast]);

    const handleClearFleet = useCallback(() => {
        setFleets((prev) => ({ ...prev, [placeSide]: clearShips(prev[placeSide]) }));
        setHover(null);
        sound.click();
        showToast('已清空海域，重新布阵');
    }, [placeSide, showToast]);

    const handleConfirmPlacement = useCallback(() => {
        if (!placeReady) {
            showToast('还有舰船没有布好');
            return;
        }
        sound.click();
        if (placeSide === BLUE) {
            if (mode === 'ai') {
                startBattle({ blue: fleets.blue, red: randomFleet() });
            } else {
                setFleets((prev) => ({ ...prev, red: createSide() }));
                setPlacing({ side: RED, dir: DIR_H, selected: FLEET[0].id });
                showToast('轮到玩家 2 布阵');
            }
            return;
        }
        startBattle({ blue: fleets.blue, red: fleets.red });
    }, [placeReady, placeSide, mode, fleets, startBattle, showToast]);
    /* ---------------- 开炮 ---------------- */
    const fireAt = useCallback(
        (r, c) => {
            const cur = timeline[timeline.length - 1];
            if (!cur || !cur.turn) return;
            const attacker = cur.turn;
            const defender = other(attacker);
            const res = fireCell(cur.sides[defender], r, c);
            if (!res) return;

            const label = coordLabel(r, c);
            const byHuman = mode === 'pvp' || attacker === humanSide;

            setTimeline((prev) => [
                ...prev,
                {
                    sides: { ...cur.sides, [defender]: res.side },
                    turn: res.allSunk ? null : defender,
                    log: [
                        ...cur.log,
                        { by: attacker, r, c, hit: res.hit, sunk: res.sunk, shipName: res.shipName }
                    ],
                    lastShot: { r, c, by: attacker, hit: res.hit, sunk: res.sunk }
                }
            ]);
            setHint(null);

            if (res.sunk) {
                sound.flip(2);
                showToast(
                    byHuman ? `击沉对方「${res.shipName}」！` : `你的「${res.shipName}」被击沉了`
                );
            } else if (res.hit) {
                sound.place();
                showToast(byHuman ? `${label} 命中！` : `对方击中了你的 ${label}`);
            } else {
                sound.click();
            }

            if (res.allSunk) {
                setPhase('over');
                setShowResult(true);
                if (mode === 'ai') {
                    if (attacker === humanSide) {
                        setRecord((prev) => ({ ...prev, win: prev.win + 1 }));
                        sound.win();
                    } else {
                        setRecord((prev) => ({ ...prev, loss: prev.loss + 1 }));
                        sound.lose();
                    }
                } else {
                    sound.win();
                }
            }
        },
        [timeline, mode, humanSide, showToast]
    );

    /* ---------------- 电脑开炮 ---------------- */
    useEffect(() => {
        if (phase !== 'battle' || mode !== 'ai' || turn !== aiSide) return undefined;
        const enemySide = sides[other(aiSide)];
        const lastShot = battle ? battle.lastShot : null;
        const chasing = Boolean(
            lastShot && lastShot.by === aiSide && lastShot.hit && !lastShot.sunk
        );
        const timer = window.setTimeout(
            () => {
                const aim = getAIShot(enemySide, difficulty);
                if (aim) fireAt(aim.r, aim.c);
            },
            chasing ? 520 : 780
        );
        return () => window.clearTimeout(timer);
    }, [phase, mode, turn, aiSide, sides, battle, difficulty, fireAt]);

    /* ---------------- 重开与设置 ---------------- */
    const resetAll = useCallback(() => {
        setFleets({ blue: createSide(), red: createSide() });
        setTimeline([]);
        setPlacing({ side: BLUE, dir: DIR_H, selected: FLEET[0].id });
        setPhase('placing');
        setHover(null);
        setHint(null);
        setToast('');
        setShowResult(false);
        setElapsed(0);
        sound.click();
    }, []);

    const handleModeChange = useCallback(
        (next) => {
            setMode(next);
            resetAll();
        },
        [resetAll]
    );

    const handleComputerFirstChange = useCallback(
        (next) => {
            setComputerFirst(next);
            resetAll();
        },
        [resetAll]
    );

    /* ---------------- 悔棋 ---------------- */
    const canUndo =
        (phase === 'battle' || phase === 'over') && timeline.length > 1 && !thinking;

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        let next = timeline.slice(0, -1);
        if (mode === 'ai') {
            while (next.length > 1 && next[next.length - 1].turn !== humanSide) {
                next = next.slice(0, -1);
            }
        }
        setTimeline(next);
        setPhase('battle');
        setShowResult(false);
        setHint(null);
        setToast('');
        sound.click();
    }, [canUndo, timeline, mode, humanSide]);

    /* ---------------- 提示 ---------------- */
    const handleHint = useCallback(() => {
        if (!canPlay || turn === null) return;
        const aim = getAIShot(sides[other(turn)], 'hard');
        if (!aim) return;
        setHint(aim);
        showToast(`推荐炮击 ${coordLabel(aim.r, aim.c)}`);
        sound.click();
    }, [canPlay, turn, sides, showToast]);

    /* ---------------- 名字编辑 ---------------- */
    const handleNameChange = useCallback((key, value) => {
        setNames((prev) => ({ ...prev, [key]: value }));
    }, []);

    /* ---------------- 结算 ---------------- */
    const result = useMemo(() => {
        if (phase !== 'over' || !battle || !battle.lastShot) return null;
        const winner = battle.lastShot.by;
        const loser = other(winner);
        const winnerHits = hitCount(sides[loser]);
        const loserHits = hitCount(sides[winner]);
        const scores = { black: hitCount(redSide), white: hitCount(blueSide) };
        const winnerSide = winner;
        const winnerName = playerName(winner);

        if (mode === 'ai') {
            const humanWon = winner === humanSide;
            return {
                tone: humanWon ? 'win' : 'lose',
                title: humanWon ? '你赢了！' : '电脑获胜',
                sub: humanWon
                    ? `你击沉了对方全部 ${FLEET.length} 艘舰船，命中数 ${winnerHits} : ${loserHits}。`
                    : `电脑击沉了你的全部舰船，命中数 ${winnerHits} : ${loserHits}，换个布阵再来一局吧。`,
                scores,
                winnerSide
            };
        }
        return {
            tone: 'win',
            title: `${winnerName} 获胜`,
            sub: `${winnerName} 击沉了对手全部 ${FLEET.length} 艘舰船，命中数 ${winnerHits} : ${loserHits}。`,
            scores,
            winnerSide
        };
    }, [phase, battle, sides, redSide, blueSide, mode, humanSide, playerName]);

    /* ---------------- 统计 ---------------- */
    const blueHits = hitCount(redSide);
    const redHits = hitCount(blueSide);
    const blueRemaining = remainingShips(blueSide);
    const redRemaining = remainingShips(redSide);
    const placedCells = placeFleet.ships.reduce((sum, ship) => sum + ship.size, 0);
    const totalHits = blueHits + redHits;
    const bluePct = totalHits ? Math.round((blueHits / totalHits) * 100) : 50;
    const redPct = 100 - bluePct;

    const leadText =
        totalHits === 0
            ? '尚未有舰船中弹'
            : blueHits === redHits
              ? '双方命中数持平'
              : `${blueHits > redHits ? playerName(BLUE) : playerName(RED)} 命中领先`;

    const totalGames = record.win + record.loss + record.draw;
    const winRate = totalGames ? Math.round((record.win / totalGames) * 100) : 0;
    const difficultyLabel = DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? '—';

    const turnLabel =
        phase === 'placing'
            ? `布阵阶段 · ${playerName(placeSide)} 排列舰队`
            : thinking
              ? '电脑正在推算炮击格…'
              : phase === 'over'
                ? '本局已结束'
                : `轮到 ${playerName(turn)} 炮击`;

    const statLabels =
        mode === 'ai'
            ? { own: '我方剩余', foe: '敌方剩余', hit: '我方命中', shots: '总炮数' }
            : { own: '蓝方剩余', foe: '红方剩余', hit: '蓝方命中', shots: '总炮数' };

    const lastShotFor = (side) =>
        battle && battle.lastShot && other(battle.lastShot.by) === side ? battle.lastShot : null;

    const renderNameArea = (side) => {
        const isAiSide = mode === 'ai' && side === aiSide;
        if (isAiSide) {
            return <span className="gp-score__name-static">{names[side]}</span>;
        }
        const key = mode === 'pvp' ? (side === BLUE ? 'p1' : 'p2') : side;
        return (
            <input
                className="gp-name-input"
                value={names[key]}
                maxLength={8}
                onChange={(e) => handleNameChange(key, e.target.value)}
                aria-label={`${side === BLUE ? '蓝方' : '红方'}名字`}
            />
        );
    };

    const fleetCard = (side) => (
        <div className="bsp-fleet">
            <div className="bsp-fleet__head">
                <span className={`gp-chip gp-chip--${side}`} />
                <span className="bsp-fleet__name">{playerName(side)}</span>
                <strong className="bsp-fleet__left">
                    {remainingShips(sides[side])} / {FLEET.length}
                </strong>
            </div>
            <ul className="bsp-fleet__list">
                {FLEET.map((def) => {
                    const ship = sides[side].ships.find((item) => item.id === def.id);
                    const sunk = Boolean(ship && isSunk(ship));
                    const damage = ship ? ship.hits.length : 0;
                    const showDamage = side === BLUE || mode === 'pvp';
                    return (
                        <li
                            key={def.id}
                            className={`bsp-ship ${sunk ? 'is-sunk' : ''} ${
                                ship ? '' : 'is-missing'
                            }`}
                        >
                            <span className="bsp-ship__name">{def.name}</span>
                            <span className="bsp-ship__pips">
                                {Array.from({ length: def.size }).map((_, index) => (
                                    <i
                                        key={index}
                                        className={`bsp-ship__pip ${
                                            showDamage && index < damage ? 'is-hit' : ''
                                        }`}
                                    />
                                ))}
                            </span>
                            <span className="bsp-ship__state">
                                {sunk ? '击沉' : ship ? '在航' : '未布'}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
    const confirmLabel =
        placeSide === BLUE && mode === 'pvp'
            ? '玩家 1 布阵完成'
            : placeReady
              ? '开始对战'
              : `还需布置 ${pendingDefs.length} 艘`;

    const redSub =
        mode === 'ai'
            ? '未炮击的格子保持空白，命中会亮起红点，击沉的舰船会被打上红叉。'
            : '红方舰队，双人同屏模式下双方都可查看。';
    const blueSub =
        mode === 'ai'
            ? '你的舰队，被击中的格子会变红，整艘船全部命中即被击沉。'
            : '蓝方舰队，双人同屏模式下双方都可查看。';

    return (
        <div className="bsp-page">
            <GameNav />
            <BackBar title="海战棋" />

            <header className="gp-hero">
                <div className="ui-container">
                    <div className="ui-eyebrow">经典对弈 · Battleship</div>
                    <h1 className="gp-hero__title">
                        海战棋 <span className="ui-grad-text">在线对弈</span>
                    </h1>
                    <p className="gp-hero__desc">
                        先在自己的海域里悄悄排布五艘舰船，再靠一次次炮击去推测对手的舰队藏在哪。
                        10 × 10 的海面上没有任何提示，只有概率、推理与一点直觉——
                        纸笔时代最让人入迷的推理游戏，现在随时都能来一局。
                    </p>
                    <div className="gp-hero__tags">
                        <span className="ui-tag ui-tag--brand">10 × 10 海域</span>
                        <span className="ui-tag">5 艘舰船 · 17 格</span>
                        <span className="ui-tag">3 档 AI 难度</span>
                        <span className="ui-tag">双人同屏</span>
                        <span className="ui-tag ui-tag--gold">随机布阵</span>
                    </div>
                </div>
            </header>

            <section className="gp-stage">
                <div className="ui-container gp-stage__inner">
                    <div className="gp-stage__board-col">
                        <div className="gp-turnbar">
                            <span
                                className="gp-turnbar__dot"
                                data-player={
                                    phase === 'placing'
                                        ? placeSide
                                        : turn || (mode === 'ai' ? humanSide : BLUE)
                                }
                            />
                            <span className="gp-turnbar__text">{turnLabel}</span>
                            {thinking && <span className="gp-turnbar__spinner" aria-hidden="true" />}
                            <span className="gp-turnbar__right">
                                {toast && <span className="gp-turnbar__toast">{toast}</span>}
                                <span className="gp-turnbar__timer">用时 {formatTime(elapsed)}</span>
                            </span>
                        </div>

                        {phase === 'placing' ? (
                            <>
                                <Board
                                    title={`${playerName(placeSide)} 海域`}
                                    badge="布阵中"
                                    tone={placeSide}
                                    side={placeFleet}
                                    revealShips
                                    interactive
                                    onFire={handlePlaceClick}
                                    onHover={(r, c) => setHover({ r, c })}
                                    onLeave={() => setHover(null)}
                                    preview={preview}
                                />

                                <div className="bsp-picks">
                                    <div className="bsp-picks__head">
                                        <span className="bsp-picks__title">舰队布阵</span>
                                        <span className="bsp-picks__note">
                                            点舰船选中，再点海域落位；点已放置的舰船可收回
                                        </span>
                                    </div>
                                    <div className="bsp-picks__list">
                                        {FLEET.map((def) => {
                                            const placed = placedIds.has(def.id);
                                            const active =
                                                !placed && activeDef && activeDef.id === def.id;
                                            return (
                                                <button
                                                    key={def.id}
                                                    type="button"
                                                    className={`bsp-pick ${placed ? 'is-placed' : ''} ${
                                                        active ? 'is-active' : ''
                                                    }`}
                                                    onClick={() => handleShipButton(def)}
                                                >
                                                    <span className="bsp-pick__name">{def.name}</span>
                                                    <span className="bsp-pick__pips">
                                                        {Array.from({ length: def.size }).map(
                                                            (_, index) => (
                                                                <i key={index} />
                                                            )
                                                        )}
                                                    </span>
                                                    <span className="bsp-pick__state">
                                                        {placed ? '已布 · 可收回' : active ? '待放置' : '待布'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="bsp-picks__actions">
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--ghost ui-btn--sm"
                                            onClick={toggleDir}
                                        >
                                            朝向：{dirLabel(placing.dir)}（按 R 切换）
                                        </button>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--ghost ui-btn--sm"
                                            onClick={handleRandomFleet}
                                        >
                                            随机布阵
                                        </button>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--ghost ui-btn--sm"
                                            onClick={handleClearFleet}
                                            disabled={placeFleet.ships.length === 0}
                                        >
                                            清空
                                        </button>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--primary ui-btn--sm"
                                            onClick={handleConfirmPlacement}
                                            disabled={!placeReady}
                                        >
                                            {confirmLabel}
                                        </button>
                                    </div>
                                </div>

                                <div className="gp-boardstats">
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">已布舰船</span>
                                        <strong>
                                            {placeFleet.ships.length} / {FLEET.length}
                                        </strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">待布舰船</span>
                                        <strong>{pendingDefs.length}</strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">已占格数</span>
                                        <strong>
                                            {placedCells} / {FLEET_CELLS}
                                        </strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">当前舰船</span>
                                        <strong>{activeDef ? activeDef.name : '—'}</strong>
                                    </div>
                                </div>

                                <p className="gp-stage__hint">
                                    <span>点海域落位，蓝色预览表示可以放下</span>
                                    <span>按 R 或点「朝向」按钮切换横竖</span>
                                    <span>五艘舰船就位后即可开始对战</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="bs-pair">
                                    <Board
                                        title={`${playerName(RED)} 海域`}
                                        badge={canFireAt(RED) ? '点击炮击' : mode === 'ai' ? '敌方' : '红方'}
                                        tone="red"
                                        side={redSide}
                                        revealShips={revealRed}
                                        interactive={canFireAt(RED)}
                                        onFire={fireAt}
                                        lastShot={lastShotFor(RED)}
                                        hintCell={canFireAt(RED) ? hint : null}
                                        subtitle={redSub}
                                    />
                                    <Board
                                        title={`${playerName(BLUE)} 海域`}
                                        badge={canFireAt(BLUE) ? '点击炮击' : mode === 'ai' ? '我方' : '蓝方'}
                                        tone="blue"
                                        side={blueSide}
                                        revealShips
                                        interactive={canFireAt(BLUE)}
                                        onFire={fireAt}
                                        lastShot={lastShotFor(BLUE)}
                                        hintCell={canFireAt(BLUE) ? hint : null}
                                        subtitle={blueSub}
                                    />
                                </div>

                                <div className="gp-boardstats">
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">{statLabels.own}</span>
                                        <strong>{blueRemaining}</strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">{statLabels.foe}</span>
                                        <strong>{redRemaining}</strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">{statLabels.hit}</span>
                                        <strong>{blueHits}</strong>
                                    </div>
                                    <div className="gp-boardstat">
                                        <span className="gp-boardstat__label">{statLabels.shots}</span>
                                        <strong>{log.length}</strong>
                                    </div>
                                </div>

                                <p className="gp-stage__hint">
                                    <span>点击对方海域的格子开炮</span>
                                    <span>金色虚线是引擎推荐的目标格</span>
                                    <span>打中后沿舰身方向延伸，直到击沉</span>
                                </p>

                                <div className="gp-dash">
                                    <div className="gp-dash__head">
                                        <span className="gp-dash__title">局势</span>
                                        <span className="gp-dash__lead">{leadText}</span>
                                    </div>
                                    <div className="gp-dash__sides">
                                        <div className="gp-dash__side">
                                            <span className="gp-chip gp-chip--blue" />
                                            <span>{playerName(BLUE)}</span>
                                            <strong>{blueHits}</strong>
                                        </div>
                                        <div className="gp-dash__side gp-dash__side--right">
                                            <span className="gp-chip gp-chip--red" />
                                            <span>{playerName(RED)}</span>
                                            <strong>{redHits}</strong>
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
                                            <span>已发炮</span>
                                            <strong>{log.length} 发</strong>
                                        </div>
                                    </div>
                                    <div className="gp-dash__tips">
                                        <span className="gp-dash__tip">
                                            <b>命中追击</b> 沿舰身方向延伸
                                        </span>
                                        <span className="gp-dash__tip">
                                            <b>隔格扫描</b> 不漏过最短的船
                                        </span>
                                        <span className="gp-dash__tip">
                                            <b>剩余舰种</b> 决定搜索的形状
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>                    <aside className="gp-stage__panel">
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
                                            {DIFFICULTY_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    className={`ui-seg__item ${
                                                        difficulty === opt.id ? 'is-active' : ''
                                                    }`}
                                                    onClick={() => {
                                                        setDifficulty(opt.id);
                                                        sound.click();
                                                    }}
                                                >
                                                    {opt.label}
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
                                                onClick={() => handleComputerFirstChange(false)}
                                            >
                                                我先手
                                            </button>
                                            <button
                                                className={`ui-seg__item ${
                                                    computerFirst ? 'is-active' : ''
                                                }`}
                                                onClick={() => handleComputerFirstChange(true)}
                                            >
                                                电脑先手
                                            </button>
                                        </div>
                                        <p className="bsp-first-note">
                                            先手决定谁先开炮。布阵阶段始终由你先排布，电脑的舰队会在开局时自动随机生成。
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {phase === 'battle' || phase === 'over' ? (
                            <div className="gp-card">
                                <h2 className="gp-card__title">比分板</h2>
                                <div className="gp-score">
                                    <div
                                        className={`gp-score__item ${
                                            turn === BLUE && phase === 'battle' ? 'is-active' : ''
                                        }`}
                                    >
                                        <span className="gp-chip gp-chip--blue" />
                                        {renderNameArea(BLUE)}
                                        <strong key={`b-${blueHits}`} className="gp-score__value">
                                            {blueHits}
                                        </strong>
                                    </div>
                                    <div
                                        className={`gp-score__item ${
                                            turn === RED && phase === 'battle' ? 'is-active' : ''
                                        }`}
                                    >
                                        <span className="gp-chip gp-chip--red" />
                                        {renderNameArea(RED)}
                                        <strong key={`r-${redHits}`} className="gp-score__value">
                                            {redHits}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="gp-card">
                                <h2 className="gp-card__title">布阵提示</h2>
                                <div className="bsp-notes">
                                    <p>大船优先考虑角落与边缘，可被攻击的方向更少。</p>
                                    <p>把五艘船分散到海域的不同区域，避免被一路打穿。</p>
                                    <p>双人模式下记得让对手暂避视线，布好再交换位置。</p>
                                </div>
                            </div>
                        )}

                        <div className="gp-card">
                            <h2 className="gp-card__title">操作</h2>
                            <div className="gp-controls">
                                <button className="ui-btn ui-btn--primary" onClick={resetAll}>
                                    {phase === 'placing' ? '重新布阵' : '重新开始'}
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
                                    disabled={!canPlay}
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
                            <h2 className="gp-card__title">舰队状态</h2>
                            {fleetCard(BLUE)}
                            {fleetCard(RED)}
                        </div>

                        {phase !== 'placing' && (
                            <div className="gp-card">
                                <h2 className="gp-card__title">
                                    棋谱
                                    <span className="gp-card__count">{log.length} 炮</span>
                                </h2>
                                {log.length === 0 ? (
                                    <p className="gp-log__empty">
                                        开炮后将在这里记录每一炮的坐标与结果。
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
                                                        key={`${entry.r}-${entry.c}-${turnNo}`}
                                                        className="gp-log__item"
                                                    >
                                                        <span className="gp-log__no">{turnNo}</span>
                                                        <span
                                                            className={`gp-chip gp-chip--${entry.by}`}
                                                        />
                                                        <span className="gp-log__label">
                                                            {coordLabel(entry.r, entry.c)}
                                                        </span>
                                                        <span
                                                            className={`bsp-log__tag ${
                                                                entry.sunk
                                                                    ? 'is-sunk'
                                                                    : entry.hit
                                                                      ? 'is-hit'
                                                                      : 'is-miss'
                                                            }`}
                                                        >
                                                            {entry.sunk
                                                                ? `击沉 ${entry.shipName}`
                                                                : entry.hit
                                                                  ? '命中'
                                                                  : '未命中'}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                    </ol>
                                )}
                            </div>
                        )}
                    </aside>
                </div>
            </section>            <section className="ui-section gp-prose" id="about">
                <div className="ui-container">
                    <div className="gp-prose__grid">
                        <div>
                            <div className="ui-eyebrow">关于海战棋</div>
                            <h2 className="ui-section-title">
                                一张纸、两支舰队，
                                <span className="ui-grad-text">一整局的推理</span>
                            </h2>
                        </div>
                        <div className="gp-prose__body">
                            <p>
                                海战棋诞生于第一次世界大战期间的纸笔游戏，双方各自在网格上画出舰队，
                                然后交替报出坐标，用「命中」与「未命中」的反馈推断对方舰船的位置。
                                它没有棋子，也不需要复杂的规则，靠的全是推理与概率直觉。
                            </p>
                            <p>
                                很多人第一次玩都会随手乱猜，很快发现效率极低；而当你知道要先隔格搜索、
                                命中后沿方向追击、并随时盯住对手还剩哪些舰种时，
                                同一片海域的胜负就完全不同了。这正是海战棋能流传一百多年的原因。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ui-section gp-rules" id="rules">
                <div className="ui-container">
                    <div className="ui-eyebrow">玩法规则</div>
                    <h2 className="ui-section-title">四步读懂海战棋</h2>
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
                            <h2 className="ui-section-title">为推理体验而生的细节</h2>
                        </div>
                        <p className="ui-section-sub">
                            我们把布阵、开炮、追打、复盘都做成了顺手的操作，让你能把注意力全放在推演上。
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
                        <h2 className="gp-cta__title">准备好排布你的舰队了吗？</h2>
                        <p className="gp-cta__desc">
                            五艘舰船、十七格海面，一炮一炮把对手的舰队逼出水面。
                            现在就开始，试试你能不能比电脑先找到全部敌舰。
                        </p>
                        <button
                            className="ui-btn ui-btn--primary gp-cta__btn"
                            onClick={() => {
                                resetAll();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            立即开始游戏
                        </button>
                    </div>
                </div>
            </section>

            <MoreGames currentId="battleship" />

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
                                <li>海战棋</li>
                                <li>点格棋</li>
                                <li>四子棋</li>
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

            <GameOverModal
                open={showResult}
                result={result}
                names={{ black: playerName(BLUE), white: playerName(RED) }}
                variant="blue"
                onRestart={resetAll}
                onClose={() => setShowResult(false)}
            />
        </div>
    );
}

export default BattleshipGame;