/* ============================================================
   数独核心逻辑：生成、求解、冲突检测与候选数计算
   ============================================================ */

const SIZE = 9;          // 棋盘边长
const BOX = 3;           // 宫的边长
const EMPTY = 0;         // 空格用 0 表示
const CELL_COUNT = SIZE * SIZE;

/* 难度配置：holes 表示需要挖掉的空格数量 */
const DIFFICULTIES = [
    { id: 'easy', label: '简单', holes: 38, desc: '给定数字较多，适合熟悉规则。' },
    { id: 'medium', label: '中等', holes: 44, desc: '需要一些基础技巧，节奏适中。' },
    { id: 'hard', label: '困难', holes: 50, desc: '候选数交错，需要耐心推理。' },
    { id: 'expert', label: '专家', holes: 55, desc: '接近极限的挖空，硬核挑战。' }
];

/* 列标签：A–I，与行号组合成坐标，如 A1 */
const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

/* 行列转坐标标签 */
function coordLabel(row, col) {
    return `${COLUMN_LABELS[col]}${row + 1}`;
}

/* Fisher–Yates 洗牌 */
function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* 生成全 0 棋盘 */
function createEmptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

/* 二维数组浅拷贝 */
function cloneGrid(grid) {
    return grid.map((row) => [...row]);
}

/* 把二维候选数/笔记结构深拷贝一份 */
function cloneNotes(notes) {
    return notes.map((row) => row.map((cell) => [...cell]));
}

/* 判断在 (row, col) 放入 value 是否不违反行、列、宫的唯一性 */
function isSafe(grid, row, col, value) {
    for (let i = 0; i < SIZE; i++) {
        if (grid[row][i] === value) return false;
        if (grid[i][col] === value) return false;
    }
    const boxRow = Math.floor(row / BOX) * BOX;
    const boxCol = Math.floor(col / BOX) * BOX;
    for (let r = 0; r < BOX; r++) {
        for (let c = 0; c < BOX; c++) {
            if (grid[boxRow + r][boxCol + c] === value) return false;
        }
    }
    return true;
}

/* 回溯填充整张棋盘（用于生成完整解） */
function fillGrid(grid) {
    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (grid[row][col] !== EMPTY) continue;
            for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                if (!isSafe(grid, row, col, value)) continue;
                grid[row][col] = value;
                if (fillGrid(grid)) return true;
                grid[row][col] = EMPTY;
            }
            return false;
        }
    }
    return true;
}

/* 找出第一个空格，没有则返回 null */
function findEmpty(grid) {
    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (grid[row][col] === EMPTY) return { row, col };
        }
    }
    return null;
}

/* 统计解的个数，最多数到 limit 个就提前结束（判定唯一解时 limit 取 2） */
function countSolutions(grid, limit = 2) {
    const board = cloneGrid(grid);
    let found = 0;

    const search = () => {
        if (found >= limit) return;
        const spot = findEmpty(board);
        if (!spot) {
            found += 1;
            return;
        }
        for (let value = 1; value <= SIZE; value++) {
            if (!isSafe(board, spot.row, spot.col, value)) continue;
            board[spot.row][spot.col] = value;
            search();
            board[spot.row][spot.col] = EMPTY;
            if (found >= limit) return;
        }
    };

    search();
    return found;
}

/* 求解，返回完整解；无解返回 null */
function solveGrid(grid) {
    const board = cloneGrid(grid);
    return fillGrid(board) ? board : null;
}

/* 生成一局：完整解 + 保证唯一解的题面 */
function generatePuzzle(holes) {
    const solution = createEmptyGrid();
    fillGrid(solution);

    const puzzle = cloneGrid(solution);
    const positions = shuffle(Array.from({ length: CELL_COUNT }, (_, i) => i));
    let removed = 0;

    for (const pos of positions) {
        if (removed >= holes) break;
        const row = Math.floor(pos / SIZE);
        const col = pos % SIZE;
        const backup = puzzle[row][col];
        if (backup === EMPTY) continue;

        puzzle[row][col] = EMPTY;
        if (countSolutions(puzzle, 2) !== 1) {
            /* 挖掉后出现多解，恢复该格 */
            puzzle[row][col] = backup;
        } else {
            removed += 1;
        }
    }

    return { puzzle, solution };
}

/* 由难度 id 生成题目 */
function generateByDifficulty(difficultyId) {
    const config =
        DIFFICULTIES.find((item) => item.id === difficultyId) ?? DIFFICULTIES[0];
    return generatePuzzle(config.holes);
}

/* 计算所有冲突格子（同行、同列或同宫出现重复数字），返回 "row-col" 集合 */
function getConflicts(grid) {
    const conflicts = new Set();

    const scan = (cells) => {
        const seen = new Map();
        cells.forEach(([row, col]) => {
            const value = grid[row][col];
            if (value === EMPTY) return;
            const key = String(value);
            if (seen.has(key)) {
                conflicts.add(seen.get(key));
                conflicts.add(`${row}-${col}`);
            } else {
                seen.set(key, `${row}-${col}`);
            }
        });
    };

    for (let i = 0; i < SIZE; i++) {
        const rowCells = [];
        const colCells = [];
        const boxCells = [];
        for (let j = 0; j < SIZE; j++) {
            rowCells.push([i, j]);
            colCells.push([j, i]);
        }
        const boxRow = Math.floor(i / BOX) * BOX;
        const boxCol = (i % BOX) * BOX;
        for (let r = 0; r < BOX; r++) {
            for (let c = 0; c < BOX; c++) {
                boxCells.push([boxRow + r, boxCol + c]);
            }
        }
        scan(rowCells);
        scan(colCells);
        scan(boxCells);
    }

    return conflicts;
}

/* 计算某格（必须为空）的候选数 */
function findCandidates(grid, row, col) {
    if (grid[row][col] !== EMPTY) return [];
    const used = new Set();
    for (let i = 0; i < SIZE; i++) {
        used.add(grid[row][i]);
        used.add(grid[i][col]);
    }
    const boxRow = Math.floor(row / BOX) * BOX;
    const boxCol = Math.floor(col / BOX) * BOX;
    for (let r = 0; r < BOX; r++) {
        for (let c = 0; c < BOX; c++) {
            used.add(grid[boxRow + r][boxCol + c]);
        }
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((value) => !used.has(value));
}

/* 棋盘是否已填满且无冲突 */
function isComplete(grid) {
    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (grid[row][col] === EMPTY) return false;
        }
    }
    return getConflicts(grid).size === 0;
}

/* 统计每个数字已填入的个数（1–9） */
function countDigits(grid) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    grid.forEach((row) =>
        row.forEach((value) => {
            if (value !== EMPTY) counts[value] += 1;
        })
    );
    return counts;
}

/* 统计已填格子数 */
function countFilled(grid) {
    let filled = 0;
    grid.forEach((row) =>
        row.forEach((value) => {
            if (value !== EMPTY) filled += 1;
        })
    );
    return filled;
}

/* 由题面生成初始给定数标记 */
function createGivenMask(puzzle) {
    return puzzle.map((row) => row.map((value) => value !== EMPTY));
}

export {
    SIZE,
    BOX,
    EMPTY,
    CELL_COUNT,
    COLUMN_LABELS,
    DIFFICULTIES,
    coordLabel,
    createEmptyGrid,
    cloneGrid,
    cloneNotes,
    isSafe,
    solveGrid,
    generatePuzzle,
    generateByDifficulty,
    getConflicts,
    findCandidates,
    isComplete,
    countDigits,
    countFilled,
    createGivenMask
};