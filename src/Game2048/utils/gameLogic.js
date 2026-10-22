/* ============================================================
   2048 纯逻辑层
   ------------------------------------------------------------
   方块模型：{ id, value, row, col, isNew, isMerged }
   - id 用于 React key，保证滑动与合并动画连续
   - row / col 为 0 起始坐标
   - 所有函数都不修改传入数组，返回新的方块列表
   ============================================================ */

export const SIZES = [
    {
        id: 'small',
        label: '3×3',
        size: 3,
        target: 256,
        desc: '轻快节奏：棋盘小、落子快，适合三五分钟来一局，先凑出 256 即为达成。'
    },
    {
        id: 'classic',
        label: '4×4',
        size: 4,
        target: 2048,
        desc: '经典棋盘：2048 的本体。空间与随机性的平衡最好，凑出 2048 即为达成。'
    },
    {
        id: 'large',
        label: '5×5',
        size: 5,
        target: 4096,
        desc: '开阔挑战：格子更多、容错更高，但想凑出 4096 需要更长远的布局。'
    }
];

export const DEFAULT_SIZE_ID = 'classic';

export const getSize = (id) => SIZES.find((item) => item.id === id) ?? SIZES[1];

export const DIRECTIONS = ['up', 'down', 'left', 'right'];

export const DIR_LABELS = {
    up: '上移',
    down: '下移',
    left: '左移',
    right: '右移'
};

const VECTORS = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1]
};

/* 方块自增 id：保证同一局内唯一 */
let tileSeq = 0;
const nextTileId = () => {
    tileSeq += 1;
    return tileSeq;
};

/* 当前所有空格坐标 */
export const emptyCells = (tiles, size) => {
    const occupied = new Set(tiles.map((tile) => tile.row * size + tile.col));
    const cells = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (!occupied.has(row * size + col)) cells.push({ row, col });
        }
    }
    return cells;
};

/* 在随机空格落下一枚 2（九成）或 4（一成） */
export const spawnRandomTile = (tiles, size, random = Math.random) => {
    const cells = emptyCells(tiles, size);
    if (!cells.length) return { tiles, tile: null };

    const spot = cells[Math.floor(random() * cells.length)];
    const value = random() < 0.9 ? 2 : 4;
    const tile = {
        id: nextTileId(),
        value,
        row: spot.row,
        col: spot.col,
        isNew: true,
        isMerged: false
    };

    return { tiles: [...tiles, tile], tile };
};

/* 开局：连落两枚 */
export const createTiles = (size, random = Math.random) => {
    let tiles = [];
    tiles = spawnRandomTile(tiles, size, random).tiles;
    tiles = spawnRandomTile(tiles, size, random).tiles;
    return tiles;
};

/**
 * 向某个方向滑动并合并
 * 返回 { tiles, moved, gained, mergeCount }
 * - 每格每次移动最多只合并一次（justMerged 标记）
 * - 合并后的方块沿用滑动方的 id，便于播放位移动画
 */
export const moveTiles = (tiles, size, dir) => {
    const [dr, dc] = VECTORS[dir];
    const grid = new Map();

    tiles.forEach((tile) => {
        grid.set(tile.row * size + tile.col, {
            ...tile,
            isNew: false,
            isMerged: false
        });
    });

    /* 本步内已经合并过的格子，保证每格每步只合并一次 */
    const mergedKeys = new Set();

    const rows = Array.from({ length: size }, (_, index) => index);
    const cols = Array.from({ length: size }, (_, index) => index);
    /* 先处理最靠目标方向的一列/一行，合并顺序才符合直觉 */
    const rowOrder = dir === 'down' ? [...rows].reverse() : rows;
    const colOrder = dir === 'right' ? [...cols].reverse() : cols;

    let moved = false;
    let gained = 0;
    let mergeCount = 0;

    rowOrder.forEach((row) => {
        colOrder.forEach((col) => {
            const key = row * size + col;
            const tile = grid.get(key);
            if (!tile) return;

            /* 1. 沿方向找到最远的空格 */
            let nextRow = row;
            let nextCol = col;
            while (true) {
                const rowStep = nextRow + dr;
                const colStep = nextCol + dc;
                if (rowStep < 0 || rowStep >= size || colStep < 0 || colStep >= size) break;
                if (grid.has(rowStep * size + colStep)) break;
                nextRow = rowStep;
                nextCol = colStep;
            }

            /* 2. 最远空格的前一格若有同值方块即可合并 */
            const targetRow = nextRow + dr;
            const targetCol = nextCol + dc;
            const target =
                targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size
                    ? grid.get(targetRow * size + targetCol)
                    : null;

            if (target && target.value === tile.value && !mergedKeys.has(targetRow * size + targetCol)) {
                const value = tile.value + target.value;
                grid.delete(key);
                grid.delete(targetRow * size + targetCol);
                grid.set(targetRow * size + targetCol, {
                    id: tile.id,
                    value,
                    row: targetRow,
                    col: targetCol,
                    isNew: false,
                    isMerged: true
                });
                mergedKeys.add(targetRow * size + targetCol);
                gained += value;
                mergeCount += 1;
                moved = true;
                return;
            }

            if (nextRow !== row || nextCol !== col) {
                grid.delete(key);
                grid.set(nextRow * size + nextCol, {
                    ...tile,
                    row: nextRow,
                    col: nextCol
                });
                moved = true;
            }
        });
    });

    return {
        tiles: [...grid.values()].sort((a, b) => a.id - b.id),
        moved,
        gained,
        mergeCount
    };
};

/* 是否还有可移动的方向：有空格，或存在相邻同值 */
export const hasMoves = (tiles, size) => {
    if (tiles.length < size * size) return true;

    const values = new Map();
    tiles.forEach((tile) => values.set(tile.row * size + tile.col, tile.value));

    for (const tile of tiles) {
        if (
            tile.col + 1 < size &&
            values.get(tile.row * size + tile.col + 1) === tile.value
        ) {
            return true;
        }
        if (
            tile.row + 1 < size &&
            values.get((tile.row + 1) * size + tile.col) === tile.value
        ) {
            return true;
        }
    }
    return false;
};

/* 盘面最大方块 */
export const maxTileValue = (tiles) =>
    tiles.reduce((max, tile) => Math.max(max, tile.value), 0);

/* 盘面空格数 */
export const countEmpty = (tiles, size) => size * size - tiles.length;

const log2 = (value) => (value > 0 ? Math.log2(value) : 0);

/* 局面评估：空格、可合并对、平滑度、单调性、大数占角 */
const evaluate = (tiles, size) => {
    if (!hasMoves(tiles, size)) return -Infinity;

    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    tiles.forEach((tile) => {
        grid[tile.row][tile.col] = tile.value;
    });

    let smooth = 0;
    let mergePairs = 0;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const value = grid[row][col];
            if (!value) continue;

            if (col + 1 < size && grid[row][col + 1]) {
                const diff = Math.abs(log2(value) - log2(grid[row][col + 1]));
                smooth -= diff;
                if (diff === 0) mergePairs += 1;
            }
            if (row + 1 < size && grid[row + 1][col]) {
                const diff = Math.abs(log2(value) - log2(grid[row + 1][col]));
                smooth -= diff;
                if (diff === 0) mergePairs += 1;
            }
        }
    }

    /* 单调性：同一行/列尽量沿一个方向递增，避免大数被小数夹住 */
    let mono = 0;
    for (let row = 0; row < size; row++) {
        let inc = 0;
        let dec = 0;
        for (let col = 0; col < size - 1; col++) {
            if (!grid[row][col] || !grid[row][col + 1]) continue;
            const a = log2(grid[row][col]);
            const b = log2(grid[row][col + 1]);
            if (a > b) dec += b - a;
            else inc += a - b;
        }
        mono += Math.max(inc, dec);
    }
    for (let col = 0; col < size; col++) {
        let inc = 0;
        let dec = 0;
        for (let row = 0; row < size - 1; row++) {
            if (!grid[row][col] || !grid[row + 1][col]) continue;
            const a = log2(grid[row][col]);
            const b = log2(grid[row + 1][col]);
            if (a > b) dec += b - a;
            else inc += a - b;
        }
        mono += Math.max(inc, dec);
    }

    /* 最大方块待在四角更利于长期发展 */
    const maxValue = maxTileValue(tiles);
    const corners = [grid[0][0], grid[0][size - 1], grid[size - 1][0], grid[size - 1][size - 1]];
    const cornerBonus = corners.includes(maxValue) ? log2(maxValue) * 6 : 0;

    const empty = size * size - tiles.length;
    return empty * 150 + mergePairs * 34 + smooth * 12 + mono * 10 + cornerBonus;
};

/* 提示：模拟四个方向，返回评估得分最高的方向 */
export const findHint = (tiles, size) => {
    let bestDir = null;
    let bestScore = -Infinity;

    DIRECTIONS.forEach((dir) => {
        const result = moveTiles(tiles, size, dir);
        if (!result.moved) return;
        const score = evaluate(result.tiles, size);
        if (score > bestScore) {
            bestScore = score;
            bestDir = dir;
        }
    });

    return bestDir;
};
