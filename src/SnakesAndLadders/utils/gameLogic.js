/* ============================================================
   蛇梯棋（Snakes and Ladders）· 核心规则
   ------------------------------------------------------------
   10 × 10 共 100 格，从第 1 格出发，轮流掷骰前进。
   棋盘呈蛇形编号：第 1 行从左到右 1–10，第 2 行从右到左 11–20，依此类推。
   踩到梯子起点立即上升，踩到蛇头立即下滑，一次移动只结算一次。
   必须恰好停在 100 格才算抵达；超过 100 时原地不动。
   掷出 6 点可以再掷一次（本局未结束的前提下）。
   —— 纯函数实现，不依赖 React
   ============================================================ */

export const BOARD_ROWS = 10;
export const BOARD_COLS = 10;
export const CELLS = BOARD_ROWS * BOARD_COLS;
export const START = 1;

export const PLAYER_COLORS = ['blue', 'red'];
export const PLAYER_LABELS = { blue: '蓝方', red: '红方' };

/* 梯子：起点 → 终点（向上） */
export const LADDERS = [
    [4, 14],
    [9, 31],
    [21, 42],
    [28, 84],
    [36, 44],
    [51, 67],
    [71, 91],
    [80, 100]
];

/* 蛇：蛇头（高处）→ 蛇尾（低处） */
export const SNAKES = [
    [17, 7],
    [54, 34],
    [62, 19],
    [64, 60],
    [87, 24],
    [93, 73],
    [95, 75],
    [98, 79]
];

const LADDER_MAP = new Map(LADDERS);
const SNAKE_MAP = new Map(SNAKES);

export const otherPlayer = (index) => (index === 0 ? 1 : 0);

/* ---------------- 开局 ---------------- */
export const createInitialState = (starter = 0) => ({
    positions: [START, START],
    currentPlayer: starter,
    winner: null,
    lastRoll: null,
    lastEvent: null,
    log: []
});

/* ---------------- 掷骰与落点 ---------------- */
export const rollDie = (random = Math.random) =>
    Math.floor(random() * 6) + 1;

/**
 * 计算一次移动的最终落点
 * @returns {{ position, landing, via, overshoot, raw }}
 * - landing 为骰子直接走到的格子（梯子/蛇的触发器）
 * - via 为 'ladder' | 'snake' | null
 */
export const resolveLanding = (from, steps) => {
    const raw = from + steps;

    if (raw > CELLS) {
        return { position: from, landing: from, via: null, overshoot: true, raw };
    }
    if (LADDER_MAP.has(raw)) {
        return {
            position: LADDER_MAP.get(raw),
            landing: raw,
            via: 'ladder',
            overshoot: false,
            raw
        };
    }
    if (SNAKE_MAP.has(raw)) {
        return {
            position: SNAKE_MAP.get(raw),
            landing: raw,
            via: 'snake',
            overshoot: false,
            raw
        };
    }
    return { position: raw, landing: raw, via: null, overshoot: false, raw };
};

export const applyRoll = (state, die) => {
    const player = state.currentPlayer;
    if (player === null || state.winner) return state;

    const from = state.positions[player];
    const result = resolveLanding(from, die);

    const positions = state.positions.slice();
    positions[player] = result.position;

    const entry = {
        player,
        die,
        from,
        landing: result.landing,
        to: result.position,
        via: result.via,
        overshoot: result.overshoot,
        extra: die === 6 && result.position !== CELLS
    };

    const won = result.position === CELLS;
    const extraTurn = !won && die === 6;

    return {
        ...state,
        positions,
        currentPlayer: won ? null : extraTurn ? player : otherPlayer(player),
        winner: won ? player : null,
        lastRoll: die,
        lastEvent: entry,
        log: [...state.log, entry]
    };
};

/* ---------------- 统计 ---------------- */
export const countRolls = (log, player) =>
    log.reduce((total, entry) => (entry.player === player ? total + 1 : total), 0);

export const countLadders = (log, player) =>
    log.reduce(
        (total, entry) =>
            entry.player === player && entry.via === 'ladder' ? total + 1 : total,
        0
    );

export const countSnakes = (log, player) =>
    log.reduce(
        (total, entry) =>
            entry.player === player && entry.via === 'snake' ? total + 1 : total,
        0
    );

/* ---------------- 坐标与路线 ---------------- */
/* 第 1 行从下往上；返回棋盘行（0 为最底行）与从左数第几列 */
export const cellCoords = (number) => {
    const row = Math.floor((number - 1) / BOARD_COLS);
    const offset = (number - 1) % BOARD_COLS;
    const col = row % 2 === 0 ? offset : BOARD_COLS - 1 - offset;
    return { row, col };
};

/* 找出当前位置往前 6 步内最近的梯子或蛇 */
export const findNextLink = (position, steps = 6) => {
    for (let i = 1; i <= steps; i++) {
        const number = position + i;
        if (number > CELLS) break;
        if (LADDER_MAP.has(number)) {
            return { number, kind: 'ladder', target: LADDER_MAP.get(number), steps: i };
        }
        if (SNAKE_MAP.has(number)) {
            return { number, kind: 'snake', target: SNAKE_MAP.get(number), steps: i };
        }
    }
    return null;
};

/* ---------------- 文案 ---------------- */
export const rollLabel = (entry) => {
    if (!entry) return '';
    if (entry.overshoot) return `${entry.from} 格 · 超出不动`;
    if (entry.via === 'ladder') return `${entry.landing} ↑ ${entry.to}`;
    if (entry.via === 'snake') return `${entry.landing} ↓ ${entry.to}`;
    return `${entry.from} → ${entry.to}`;
};
