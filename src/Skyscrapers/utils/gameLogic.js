/* ============================================================
   摩天楼核心逻辑：随机生成、边缘提示、唯一解校验与求解
   ============================================================ */

import { HARD_PUZZLES_6 } from './puzzles6.js';

export const EMPTY = 0;

/* 三种规格：尺寸越大、隐藏提示越多，难度越高 */
export const DIFFICULTIES = [
    {
        id: 'easy',
        label: '入门',
        size: 4,
        hideRatio: 0,
        desc: '4×4 棋盘，四周提示全部可见，适合熟悉「看得见几座楼」的计数方式。'
    },
    {
        id: 'medium',
        label: '进阶',
        size: 5,
        hideRatio: 0.28,
        desc: '5×5 棋盘，隐藏约三成边缘提示，需要结合行、列不重复来推理。'
    },
    {
        id: 'hard',
        label: '挑战',
        size: 6,
        hideRatio: 0.42,
        desc: '6×6 棋盘，隐藏四成以上提示，候选范围更大，适合静下心来做长链推理。'
    }
];

export const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* 行列转坐标标签，如 C3 */
export const coordLabel = (row, col) => `${COLUMN_LABELS[col]}${row + 1}`;

/* Fisher–Yates 洗牌 */
const shuffle = (list) => {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

export const cloneGrid = (grid) => grid.map((row) => [...row]);

export const createEmptyGrid = (size) =>
    Array.from({ length: size }, () => Array(size).fill(EMPTY));

export const countFilled = (grid) =>
    grid.reduce(
        (total, row) => total + row.filter((value) => value !== EMPTY).length,
        0
    );

export const countDigit = (grid, value) =>
    grid.reduce(
        (total, row) => total + row.filter((cell) => cell === value).length,
        0
    );

export const isSolved = (grid, solution) =>
    grid.every((row, r) => row.every((value, c) => value === solution[r][c]));

/* 从一侧看过去能看到的楼栋数：只有比当前最高楼更高的楼才可见 */
export const visibleCount = (line) => {
    let highest = 0;
    let count = 0;
    for (const value of line) {
        if (value > highest) {
            highest = value;
            count += 1;
        }
    }
    return count;
};

export const visibleFromEnd = (line) => visibleCount([...line].reverse());

/* 由完整解计算四条边的提示数字 */
export const computeClues = (grid) => {
    const size = grid.length;
    const columns = Array.from({ length: size }, (_, col) =>
        grid.map((row) => row[col])
    );
    return {
        top: columns.map((column) => visibleCount(column)),
        bottom: columns.map((column) => visibleFromEnd(column)),
        left: grid.map((row) => visibleCount(row)),
        right: grid.map((row) => visibleFromEnd(row))
    };
};

/* 随机生成一个拉丁方阵：逐行回溯填数，保证每行每列都是 1..size 的排列 */
export const createLatinSquare = (size) => {
    const grid = createEmptyGrid(size);
    const colUsed = Array.from({ length: size }, () =>
        Array(size + 1).fill(false)
    );

    const fillRow = (row) => {
        if (row === size) return true;
        const rowUsed = Array(size + 1).fill(false);

        const fillCol = (col) => {
            if (col === size) return true;
            for (const value of shuffle(
                Array.from({ length: size }, (_, index) => index + 1)
            )) {
                if (rowUsed[value] || colUsed[col][value]) continue;
                grid[row][col] = value;
                rowUsed[value] = true;
                colUsed[col][value] = true;
                if (fillCol(col + 1)) return true;
                grid[row][col] = EMPTY;
                rowUsed[value] = false;
                colUsed[col][value] = false;
            }
            return false;
        };

        if (!fillCol(0)) return false;
        if (fillRow(row + 1)) return true;

        for (let col = 0; col < size; col += 1) {
            colUsed[col][grid[row][col]] = false;
            grid[row][col] = EMPTY;
        }
        return false;
    };

    fillRow(0);
    return grid;
};

/* 统计解的个数，最多数到 limit 个；nodeLimit 防止极端情况下长时间卡住 */
export const solveCount = (clues, size, limit = 2, nodeLimit = 400000) => {
    const grid = createEmptyGrid(size);
    const colUsed = Array.from({ length: size }, () =>
        Array(size + 1).fill(false)
    );
    const colMax = Array(size).fill(0);
    const colVisible = Array(size).fill(0);

    const top = clues.top.map((value) => value || null);
    const bottom = clues.bottom.map((value) => value || null);
    const left = clues.left.map((value) => value || null);
    const right = clues.right.map((value) => value || null);

    let count = 0;
    let nodes = 0;
    let aborted = false;

    const search = (row, col, rowUsed, rowMax, rowVisible) => {
        if (aborted) return;

        if (row === size) {
            for (let c = 0; c < size; c += 1) {
                if (
                    bottom[c] &&
                    visibleFromEnd(grid.map((line) => line[c])) !== bottom[c]
                ) {
                    return;
                }
            }
            count += 1;
            if (count >= limit) aborted = true;
            return;
        }

        if (col === size) {
            if (left[row] && rowVisible !== left[row]) return;
            if (right[row] && visibleFromEnd(grid[row]) !== right[row]) return;
            search(row + 1, 0, Array(size + 1).fill(false), 0, 0);
            return;
        }

        nodes += 1;
        if (nodes > nodeLimit) {
            aborted = true;
            return;
        }

        for (let value = 1; value <= size; value += 1) {
            if (rowUsed[value] || colUsed[col][value]) continue;

            const nextRowVisible = value > rowMax ? rowVisible + 1 : rowVisible;
            if (left[row] && nextRowVisible > left[row]) continue;
            if (
                left[row] &&
                nextRowVisible + (size - col - 1) < left[row]
            ) {
                continue;
            }

            const nextColVisible =
                value > colMax[col] ? colVisible[col] + 1 : colVisible[col];
            if (top[col] && nextColVisible > top[col]) continue;
            if (
                top[col] &&
                nextColVisible + (size - 1 - row) < top[col]
            ) {
                continue;
            }

            grid[row][col] = value;
            rowUsed[value] = true;
            colUsed[col][value] = true;
            const prevColMax = colMax[col];
            const prevColVisible = colVisible[col];
            if (value > prevColMax) {
                colMax[col] = value;
                colVisible[col] = prevColVisible + 1;
            }

            search(
                row,
                col + 1,
                rowUsed,
                Math.max(rowMax, value),
                nextRowVisible
            );

            grid[row][col] = EMPTY;
            rowUsed[value] = false;
            colUsed[col][value] = false;
            colMax[col] = prevColMax;
            colVisible[col] = prevColVisible;

            if (aborted) return;
        }
    };

    search(0, 0, Array(size + 1).fill(false), 0, 0);
    return { count, aborted, nodes };
};

/* 复制一份提示结构 */
const cloneClues = (clues) => ({
    top: [...clues.top],
    bottom: [...clues.bottom],
    left: [...clues.left],
    right: [...clues.right]
});

const allSlots = (size) => {
    const sides = ['top', 'bottom', 'left', 'right'];
    const slots = [];
    sides.forEach((side) => {
        for (let index = 0; index < size; index += 1) {
            slots.push({ side, index });
        }
    });
    return slots;
};

export const countVisibleClues = (clues) =>
    clues.top.filter(Boolean).length +
    clues.bottom.filter(Boolean).length +
    clues.left.filter(Boolean).length +
    clues.right.filter(Boolean).length;

/* 挑战难度直接抽取预生成题库，避免 6×6 现场计算唯一解时卡顿 */
let lastHardIndex = -1;

const buildSession = (size, solution, clues) => ({
    size,
    solution,
    clues,
    hidden: size * 4 - countVisibleClues(clues),
    initial: {
        grid: createEmptyGrid(size),
        log: []
    }
});

/* 生成一道保证唯一解的题目；必要时隐藏部分边缘提示 */
export const generatePuzzle = (difficultyId = 'easy') => {
    const config =
        DIFFICULTIES.find((item) => item.id === difficultyId) ?? DIFFICULTIES[0];

    if (config.id === 'hard') {
        let index = Math.floor(Math.random() * HARD_PUZZLES_6.length);
        if (HARD_PUZZLES_6.length > 1 && index === lastHardIndex) {
            index = (index + 1) % HARD_PUZZLES_6.length;
        }
        lastHardIndex = index;
        const puzzle = HARD_PUZZLES_6[index];
        return buildSession(
            config.size,
            cloneGrid(puzzle.solution),
            cloneClues(puzzle.clues)
        );
    }

    const size = config.size;
    const targetHidden = Math.floor(size * 4 * config.hideRatio);

    for (let attempt = 0; attempt < 40; attempt += 1) {
        const solution = createLatinSquare(size);
        const fullClues = computeClues(solution);
        const check = solveCount(fullClues, size, 2);
        if (check.count !== 1 || check.aborted) continue;

        const clues = cloneClues(fullClues);
        if (targetHidden > 0) {
            const slots = shuffle(allSlots(size));
            let hidden = 0;
            for (const slot of slots) {
                if (hidden >= targetHidden) break;
                const backup = clues[slot.side][slot.index];
                clues[slot.side][slot.index] = 0;
                const result = solveCount(clues, size, 2);
                if (result.count === 1 && !result.aborted) {
                    hidden += 1;
                } else {
                    clues[slot.side][slot.index] = backup;
                }
            }
        }

        return buildSession(size, solution, clues);
    }

    /* 兜底：使用完整提示，保证至少可以正常开始 */
    const solution = createLatinSquare(size);
    return buildSession(size, solution, computeClues(solution));
};

/* 找到第一个待填或填错的格子，供提示使用 */
export const findHintCell = (grid, solution) => {
    for (let row = 0; row < grid.length; row += 1) {
        for (let col = 0; col < grid.length; col += 1) {
            if (grid[row][col] !== solution[row][col]) return { row, col };
        }
    }
    return null;
};
