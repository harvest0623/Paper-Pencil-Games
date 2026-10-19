/* ============================================================
   数织核心逻辑：题目生成、线索计算、逐行推演与唯一解校验
   ============================================================ */

/* 格子状态：-1 未知、0 空白、1 已涂黑、2 已标记（X） */
const UNKNOWN = -1;
const EMPTY = 0;
const FILLED = 1;
const MARKED = 2;

/* 尺寸档位：size 为棋盘边长，density 为生成图案时的初始涂黑概率 */
const SIZES = [
    {
        id: 'small',
        label: '5 × 5',
        size: 5,
        density: 0.62,
        desc: '入门尺寸，线索短而清晰，适合先熟悉数织的推理节奏。'
    },
    {
        id: 'medium',
        label: '10 × 10',
        size: 10,
        density: 0.66,
        desc: '中等尺寸，线索开始交错，需要用交叉验证稳步推进。'
    },
    {
        id: 'large',
        label: '15 × 15',
        size: 15,
        density: 0.7,
        desc: '挑战尺寸，长线索彼此牵制，真正考验耐心的一档。'
    }
];

/* 格子坐标标签，如 R3C7 */
function coordLabel(row, col) {
    return `R${row + 1}C${col + 1}`;
}

/* 取尺寸配置 */
function getSize(id) {
    return SIZES.find((item) => item.id === id) ?? SIZES[0];
}

/* 生成一张全为 value 的棋盘 */
function createCells(size, value = UNKNOWN) {
    return Array.from({ length: size }, () => Array(size).fill(value));
}

/* 二维数组浅拷贝 */
function cloneCells(cells) {
    return cells.map((row) => [...row]);
}

/* 判断两个数字数组是否完全相同 */
function sameList(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

/* 一行涂黑格连续段长度，即该行线索 */
function lineClue(line) {
    const clue = [];
    let run = 0;
    for (const value of line) {
        if (value === FILLED) {
            run += 1;
        } else if (run > 0) {
            clue.push(run);
            run = 0;
        }
    }
    if (run > 0) clue.push(run);
    return clue;
}

/* 由图案计算全部行列线索 */
function computeClues(pattern) {
    const size = pattern.length;
    const rowClues = pattern.map((line) => lineClue(line));
    const colClues = [];
    for (let col = 0; col < size; col++) {
        colClues.push(lineClue(pattern.map((row) => row[col])));
    }
    return { rowClues, colClues };
}

/* 某一行的涂黑段是否已经与线索完全吻合（未知格视作空白） */
function lineDone(line, clue) {
    return sameList(lineClue(line), clue);
}

/* 线索全部吻合的行数 / 列数 */
function countDoneLines(cells, rowClues, colClues) {
    const size = cells.length;
    let rows = 0;
    let cols = 0;
    for (let i = 0; i < size; i++) {
        if (lineDone(cells[i], rowClues[i])) rows += 1;
        if (lineDone(cells.map((row) => row[i]), colClues[i])) cols += 1;
    }
    return { rows, cols };
}

/* 线索在给定长度下的所有摆法，同一条线索只算一次 */
const possibilityCache = new Map();

function linePossibilities(clue, length) {
    const key = `${length}|${clue.join(',')}`;
    const cached = possibilityCache.get(key);
    if (cached) return cached;

    const runs = clue.filter((n) => n > 0);
    const result = [];

    const build = (index, pos, starts) => {
        if (index === runs.length) {
            const line = new Array(length).fill(EMPTY);
            starts.forEach((start, i) => {
                for (let k = 0; k < runs[i]; k++) line[start + k] = FILLED;
            });
            result.push(line);
            return;
        }
        const rest = runs.slice(index + 1).reduce((sum, n) => sum + n + 1, 0);
        const limit = length - rest - runs[index];
        for (let start = pos; start <= limit; start++) {
            build(index + 1, start + runs[index] + 1, [...starts, start]);
        }
    };

    build(0, 0, []);
    possibilityCache.set(key, result);
    return result;
}

/* 在已知部分格子的前提下，仍与线索吻合的所有摆法 */
function consistentPossibilities(line, clue) {
    return linePossibilities(clue, line.length).filter((item) =>
        line.every(
            (value, index) =>
                value === UNKNOWN || (value === FILLED) === (item[index] === FILLED)
        )
    );
}

/* 单行推演：返回该行在逻辑上可以确定的格子 */
function deduceLine(line, clue) {
    const possibilities = consistentPossibilities(line, clue);
    if (possibilities.length === 0) return { ok: false, changed: false, line };

    const next = line.map((value, index) => {
        const allFilled = possibilities.every((item) => item[index] === FILLED);
        if (allFilled) return FILLED;
        const allEmpty = possibilities.every((item) => item[index] !== FILLED);
        if (allEmpty) return value === FILLED ? FILLED : EMPTY;
        return value;
    });

    return {
        ok: true,
        changed: next.some((value, index) => value !== line[index]),
        line: next
    };
}

/* 反复推演行列，直到没有新的格子可确定 */
function propagate(cells, rowClues, colClues, size) {
    let cur = cloneCells(cells);
    let changed = false;
    let guard = 0;

    while (guard < 200) {
        guard += 1;
        let local = false;

        for (let i = 0; i < size; i++) {
            const rowResult = deduceLine(cur[i], rowClues[i]);
            if (!rowResult.ok) {
                return { ok: false, cells: cur, changed, solved: false };
            }
            if (rowResult.changed) {
                cur[i] = rowResult.line;
                local = true;
            }

            const colLine = cur.map((row) => row[i]);
            const colResult = deduceLine(colLine, colClues[i]);
            if (!colResult.ok) {
                return { ok: false, cells: cur, changed, solved: false };
            }
            if (colResult.changed) {
                colResult.line.forEach((value, r) => {
                    cur[r][i] = value;
                });
                local = true;
            }
        }

        if (local) changed = true;
        else break;
    }

    return {
        ok: true,
        cells: cur,
        changed,
        solved: !cur.some((row) => row.includes(UNKNOWN))
    };
}

/* 统计解的个数（数到 limit 即停），用于唯一解校验 */
function countSolutions(rowClues, colClues, size, limit = 2, nodeLimit = 3000) {
    let count = 0;
    let first = null;
    let nodes = 0;

    const search = (cells) => {
        if (count >= limit || nodes > nodeLimit) return;
        nodes += 1;

        const result = propagate(cells, rowClues, colClues, size);
        if (!result.ok) return;
        const cur = result.cells;

        /* 选出候选摆法最少的一条未完成线进行分支 */
        let best = null;
        for (let i = 0; i < size; i++) {
            if (cur[i].includes(UNKNOWN)) {
                const possibilities = consistentPossibilities(cur[i], rowClues[i]);
                if (possibilities.length > 1 && (!best || possibilities.length < best.possibilities.length)) {
                    best = { axis: 'row', index: i, possibilities };
                }
            }
            const colLine = cur.map((row) => row[i]);
            if (colLine.includes(UNKNOWN)) {
                const possibilities = consistentPossibilities(colLine, colClues[i]);
                if (possibilities.length > 1 && (!best || possibilities.length < best.possibilities.length)) {
                    best = { axis: 'col', index: i, possibilities };
                }
            }
        }

        if (!best) {
            count += 1;
            if (!first) first = cloneCells(cur);
            return;
        }

        for (const item of best.possibilities) {
            if (count >= limit || nodes > nodeLimit) return;
            const branch = cloneCells(cur);
            if (best.axis === 'row') {
                branch[best.index] = item.slice();
            } else {
                item.forEach((value, r) => {
                    branch[r][best.index] = value;
                });
            }
            search(branch);
        }
    };

    search(createCells(size));
    return { count, solution: first, truncated: nodes > nodeLimit && count < limit };
}

/* 随机生成一幅左右对称的图案，看起来更像真正藏起来的图形 */
function randomPattern(size, density) {
    const half = Math.ceil(size / 2);
    const pattern = [];
    for (let row = 0; row < size; row++) {
        const line = new Array(size).fill(EMPTY);
        for (let col = 0; col < half; col++) {
            const value = Math.random() < density ? FILLED : EMPTY;
            line[col] = value;
            line[size - 1 - col] = value;
        }
        pattern.push(line);
    }
    return pattern;
}

/* 统计涂黑格数量 */
function countFilled(cells) {
    return cells.reduce(
        (sum, row) => sum + row.filter((value) => value === FILLED).length,
        0
    );
}

/* 由图案、线索打包成一道题 */
function packPuzzle(size, rowClues, colClues, pattern) {
    return {
        size,
        rowClues,
        colClues,
        solution: pattern.map((row) => row.map((value) => (value === FILLED ? 1 : 0))),
        target: countFilled(pattern)
    };
}

/* 兜底题面：一块足够大的实心矩形，其行列线索本身就能唯一确定答案 */
function createRectPuzzle(size) {
    const minSpan = Math.ceil(size * 0.6);
    const span = minSpan + Math.floor(Math.random() * (size - minSpan + 1));
    const start = Math.floor(Math.random() * (size - span + 1));
    const pattern = createCells(size, EMPTY).map((row, r) =>
        row.map((value, c) => (r >= start && r < start + span && c >= start && c < start + span ? FILLED : 0))
    );
    const { rowClues, colClues } = computeClues(pattern);
    return packPuzzle(size, rowClues, colClues, pattern);
}

/* 按尺寸档位生成一道保证唯一解的题目 */
function generateByDifficulty(id) {
    const config = getSize(id);
    const size = config.size;
    const started = Date.now();

    for (let attempt = 0; attempt < 90; attempt++) {
        if (Date.now() - started > 1800) break;

        const density = Math.min(0.86, config.density + attempt * 0.004);
        const pattern = randomPattern(size, density);
        const filled = countFilled(pattern);
        if (filled < size * size * 0.2 || filled > size * size * 0.86) continue;

        const { rowClues, colClues } = computeClues(pattern);

        /* 先看能否只靠行列推演直接解出，这样可以保证提示永远推得动 */
        const pure = propagate(createCells(size), rowClues, colClues, size);
        if (pure.ok && pure.solved) {
            return packPuzzle(size, rowClues, colClues, pattern);
        }

        const result = countSolutions(rowClues, colClues, size, 2, 3000);
        if (!result.truncated && result.count === 1) {
            return packPuzzle(size, rowClues, colClues, pattern);
        }
    }

    /* 极端情况下的兜底题面 */
    return createRectPuzzle(size);
}

/* 当前涂黑结果是否与图案完全一致 */
function isSolved(cells, solution) {
    return cells.every((row, r) =>
        row.every((value, c) => (value === FILLED ? 1 : 0) === solution[r][c])
    );
}

/* 由当前盘面找一个可以确定的格子：优先给出逻辑上必然的格子 */
function findLogicalHint(cells, rowClues, colClues, size) {
    const result = propagate(cells, rowClues, colClues, size);
    if (!result.ok) return null;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            /* 推演结果里非涂黑即留白，统一映射成游戏内的两种标记 */
            const value = result.cells[row][col] === FILLED ? FILLED : MARKED;
            /* 只返回能真正改变盘面的一格，避免给出原地不动的提示 */
            if (cells[row][col] !== value) {
                return { row, col, value, logical: true };
            }
        }
    }
    return null;
}

/* 推不出必然结论时，退而揭示图案中与当前盘面不符的一格 */
function findFallbackHint(cells, solution) {
    for (let row = 0; row < solution.length; row++) {
        for (let col = 0; col < solution.length; col++) {
            const current = cells[row][col] === FILLED ? 1 : 0;
            if (current !== solution[row][col]) {
                return {
                    row,
                    col,
                    value: solution[row][col] === 1 ? FILLED : MARKED,
                    logical: false
                };
            }
        }
    }
    return null;
}

export {
    UNKNOWN,
    EMPTY,
    FILLED,
    MARKED,
    SIZES,
    getSize,
    coordLabel,
    createCells,
    cloneCells,
    lineClue,
    computeClues,
    lineDone,
    countDoneLines,
    linePossibilities,
    consistentPossibilities,
    deduceLine,
    propagate,
    countSolutions,
    randomPattern,
    countFilled,
    createRectPuzzle,
    generateByDifficulty,
    isSolved,
    findLogicalHint,
    findFallbackHint
};
