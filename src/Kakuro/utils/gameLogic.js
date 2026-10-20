/* ============================================================
   数和（Kakuro）核心逻辑
   布局生成 · 线索计算 · 候选推演 · 唯一解校验 · 提示
   ------------------------------------------------------------
   棋盘约定：
   - 行 0 与列 0 全部为黑格（提示格），可填区域从第 1 行第 1 列开始，
     于是每一段横向/纵向连续白格的左上方向都有黑格可以标注线索。
   - 每个白格必然同时属于一个横向段与一个纵向段，两段长度都在 2~9 之间。
   - 内部数字表示：BLACK = -1（黑格），EMPTY = 0（未填），1~9（已填）。
   ============================================================ */

const BLACK = -1;
const EMPTY = 0;
const MAX_RUN = 9;

/* 三档尺寸：size 为棋盘边长（含顶部与左侧线索带） */
const SIZES = [
    {
        id: 'easy',
        label: '6 × 6',
        size: 6,
        density: 0.7,
        budget: 900,
        desc: '入门尺寸，段落短、交叉少，适合先熟悉数和「按和拆数」的推理方式。'
    },
    {
        id: 'medium',
        label: '8 × 8',
        size: 8,
        density: 0.72,
        budget: 1400,
        desc: '中等尺寸，段落开始交错，需要用行列互相印证稳步推进。'
    },
    {
        id: 'hard',
        label: '10 × 10',
        size: 10,
        density: 0.74,
        budget: 1800,
        desc: '挑战尺寸，长段与交叉彼此牵制，真正考验拆数与排除的功力。'
    }
];

/* 坐标标签，如 R3C4 */
function coordLabel(row, col) {
    return `R${row + 1}C${col + 1}`;
}

/* 取尺寸配置 */
function getSize(id) {
    return SIZES.find((item) => item.id === id) ?? SIZES[0];
}

/* 生成二维数组，value 可以是常量或 (r, c) => value */
function createGrid(size, value) {
    const fill = typeof value === 'function' ? value : null;
    return Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => (fill ? fill(r, c) : value))
    );
}

/* 由布局生成盘面：白格为 EMPTY，黑格为 BLACK */
function createCells(size, layout) {
    return createGrid(size, (r, c) => (layout && !layout[r][c] ? BLACK : EMPTY));
}

/* 深拷贝盘面 */
function cloneCells(cells) {
    return cells.map((row) => [...row]);
}

/* 深拷贝布局 */
function cloneLayout(layout) {
    return layout.map((row) => [...row]);
}

/* ---------------- 布局 ---------------- */

/* 一个方向上的全部连续白格段 */
function gridRuns(white, axis) {
    const size = white.length;
    const result = [];
    if (axis === 'row') {
        for (let r = 0; r < size; r++) {
            let c = 0;
            while (c < size) {
                if (!white[r][c]) {
                    c += 1;
                    continue;
                }
                const cells = [];
                while (c < size && white[r][c]) {
                    cells.push({ r, c });
                    c += 1;
                }
                result.push(cells);
            }
        }
        return result;
    }
    for (let c = 0; c < size; c++) {
        let r = 0;
        while (r < size) {
            if (!white[r][c]) {
                r += 1;
                continue;
            }
            const cells = [];
            while (r < size && white[r][c]) {
                cells.push({ r, c });
                r += 1;
            }
            result.push(cells);
        }
    }
    return result;
}

/* 段的线索格：横向段取左邻黑格，纵向段取上邻黑格 */
function clueCellOf(cells, axis) {
    const head = cells[0];
    return axis === 'row' ? { r: head.r, c: head.c - 1 } : { r: head.r - 1, c: head.c };
}

/* 由布局得到全部段落，sum 暂为 null（仅表示「同段不重复」约束） */
function runsGeometry(layout) {
    const runs = [];
    gridRuns(layout, 'row').forEach((cells) => {
        runs.push({ axis: 'row', cells, clue: clueCellOf(cells, 'row'), sum: null });
    });
    gridRuns(layout, 'col').forEach((cells) => {
        runs.push({ axis: 'col', cells, clue: clueCellOf(cells, 'col'), sum: null });
    });
    return runs;
}

/* 按答案算出每段的和值 */
function withSums(runs, solution) {
    return runs.map((run) => ({
        ...run,
        sum: run.cells.reduce((total, cell) => total + solution[cell.r][cell.c], 0)
    }));
}

/* 版面校验：段落长度 2~9，白格数量适中，且有足够的段落 */
function validateLayout(white, size) {
    const rowsWhite = gridRuns(white, 'row');
    const colsWhite = gridRuns(white, 'col');
    const all = [...rowsWhite, ...colsWhite];

    if (all.some((cells) => cells.length < 2 || cells.length > MAX_RUN)) return false;

    const rowCount = rowsWhite.reduce((sum, cells) => sum + cells.length, 0);
    const colCount = colsWhite.reduce((sum, cells) => sum + cells.length, 0);
    if (rowCount !== colCount) return false;

    const interior = (size - 1) * (size - 1);
    if (rowCount < interior * 0.3 || rowCount > interior * 0.85) return false;
    if (all.length < size) return false;

    return true;
}

/* 修复布局：长度为 1 的段变黑格，超过 9 的段从中截断，反复至稳定 */
function repairLayout(input, size) {
    const white = cloneLayout(input);

    for (let pass = 0; pass < 24; pass++) {
        let changed = false;

        for (let r = 1; r < size; r++) {
            let c = 1;
            while (c < size) {
                if (!white[r][c]) {
                    c += 1;
                    continue;
                }
                let end = c;
                while (end < size && white[r][end]) end += 1;
                const len = end - c;
                if (len === 1) {
                    white[r][c] = false;
                    changed = true;
                } else if (len > MAX_RUN) {
                    white[r][c + MAX_RUN] = false;
                    changed = true;
                }
                c = end;
            }
        }

        for (let c = 1; c < size; c++) {
            let r = 1;
            while (r < size) {
                if (!white[r][c]) {
                    r += 1;
                    continue;
                }
                let end = r;
                while (end < size && white[end][c]) end += 1;
                const len = end - r;
                if (len === 1) {
                    white[r][c] = false;
                    changed = true;
                } else if (len > MAX_RUN) {
                    white[r + MAX_RUN][c] = false;
                    changed = true;
                }
                r = end;
            }
        }

        if (!changed) break;
    }

    return validateLayout(white, size) ? white : null;
}

/* 随机版面：逐行铺段落（默认 2~4 格，偶尔更长），再修复纵向合法性 */
function randomLayout(size, density, random, runRange) {
    const minRun = runRange?.[0] ?? 2;
    const maxRun = runRange?.[1] ?? 4;
    const span = Math.max(1, maxRun - minRun + 1);

    for (let attempt = 0; attempt < 80; attempt++) {
        const white = createGrid(size, false);

        for (let r = 1; r < size; r++) {
            let c = 1;
            while (c < size) {
                if (random() > density) {
                    c += 1;
                    continue;
                }
                const remain = size - c;
                if (remain < 2) break;
                let run = minRun + Math.floor(random() * span);
                if (random() < 0.18) run = Math.max(run, 5 + Math.floor(random() * 4));
                run = Math.min(run, remain, MAX_RUN);
                for (let k = 0; k < run; k++) white[r][c + k] = true;
                c += run + 1;
            }
        }

        const fixed = repairLayout(white, size);
        if (fixed) return fixed;
    }

    return null;
}

/* 兜底版面：对角排布的 2×2 白块，全部段落长度为 2 */
function fallbackLayout(size) {
    const white = createGrid(size, false);
    for (let r = 1; r + 1 < size; r += 2) {
        for (let c = 1; c + 1 < size; c += 2) {
            if (((r - 1) / 2 + (c - 1) / 2) % 2 !== 0) continue;
            white[r][c] = true;
            white[r][c + 1] = true;
            white[r + 1][c] = true;
            white[r + 1][c + 1] = true;
        }
    }
    return validateLayout(white, size) ? white : null;
}

/* ---------------- 候选与推演 ---------------- */

/* 1~9 中取 count 个、和为 sum 的组合（带缓存） */
const subsetCache = new Map();

function digitSubsets(count, sum) {
    const key = `${count}|${sum}`;
    const cached = subsetCache.get(key);
    if (cached) return cached;

    const result = [];
    const build = (start, left, total, picked) => {
        if (left === 0) {
            if (total === sum) result.push(picked.slice());
            return;
        }
        for (let d = start; d <= 9; d++) {
            if (total + d > sum) break;
            /* 剩下的位至少要能取到足够大的数字 */
            if (left - 1 > 9 - d) break;
            build(d + 1, left - 1, total + d, [...picked, d]);
        }
    };
    build(1, count, 0, []);

    subsetCache.set(key, result);
    return result;
}

/* 匈牙利算法：这些格子能否与给定的一组互不相同的数字一一配对 */
function matchingExists(cellList, cands, digits, forced) {
    const count = cellList.length;
    if (digits.length !== count) return false;

    const allowed = new Set(digits);
    let reservedCell = -1;
    let reservedDigit = null;

    if (forced) {
        reservedCell = forced.index;
        reservedDigit = forced.digit;
        if (!allowed.has(reservedDigit)) return false;
        const cell = cellList[reservedCell];
        if (!cands[cell.r][cell.c].has(reservedDigit)) return false;
    }

    const owner = new Map();
    if (reservedDigit !== null) owner.set(reservedDigit, reservedCell);

    /* 用标记数组代替 Set，避免在深搜里反复分配对象 */
    const visited = new Int8Array(10);
    let stamp = 0;

    const augment = (index) => {
        const cell = cellList[index];
        for (const digit of cands[cell.r][cell.c]) {
            if (!allowed.has(digit)) continue;
            if (reservedDigit !== null && digit === reservedDigit && index !== reservedCell) continue;
            if (visited[digit] === stamp) continue;
            visited[digit] = stamp;
            const holder = owner.get(digit);
            if (holder === undefined || augment(holder)) {
                owner.set(digit, index);
                return true;
            }
        }
        return false;
    };

    for (let index = 0; index < count; index++) {
        if (index === reservedCell) continue;
        stamp += 1;
        if (!augment(index)) return false;
    }
    return true;
}

/* 初始化候选：白格为 1~9，并剔除同段已填的数字 */
function initCandidates(layout, runs, size, digits) {
    const cands = createGrid(size, null);
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            cands[r][c] = layout[r][c] ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]) : null;
        }
    }

    for (const run of runs) {
        for (const cell of run.cells) {
            const value = digits[cell.r][cell.c];
            if (value < 1 || value > 9) continue;
            run.cells.forEach((other) => {
                if (other === cell) return;
                const set = cands[other.r][other.c];
                if (set) set.delete(value);
            });
        }
    }

    for (const run of runs) {
        for (const cell of run.cells) {
            if (digits[cell.r][cell.c] !== EMPTY) continue;
            if (cands[cell.r][cell.c].size === 0) return null;
        }
    }

    return cands;
}

/* 每格所属的横向段与纵向段 */
function indexRuns(runs, size) {
    const index = createGrid(size, () => ({ row: null, col: null }));
    runs.forEach((run) => {
        run.cells.forEach((cell) => {
            index[cell.r][cell.c][run.axis] = run;
        });
    });
    return index;
}

/* 落定一个数字，并同步从同段其他格的候选中剔除 */
function assignDigit(ctx, r, c, value) {
    ctx.digits[r][c] = value;
    const entry = ctx.runIndex[r][c];
    if (!entry) return;
    [entry.row, entry.col].forEach((run) => {
        if (!run) return;
        run.cells.forEach((cell) => {
            if (cell.r === r && cell.c === c) return;
            const set = ctx.cands[cell.r][cell.c];
            if (set) set.delete(value);
        });
    });
}

/* 单段过滤：按「剩余格数 + 剩余和值」枚举可行组合，修剪候选并落定唯一值 */
function filterRun(ctx, run) {
    const empty = [];
    let fixedSum = 0;

    run.cells.forEach((cell) => {
        const value = ctx.digits[cell.r][cell.c];
        if (value >= 1 && value <= 9) fixedSum += value;
        else empty.push(cell);
    });

    /* 只约束「同段不重复」时无需按和值推导 */
    if (run.sum === null) {
        for (const cell of empty) {
            if (ctx.cands[cell.r][cell.c].size === 0) return { ok: false, changed: false };
        }
        return { ok: true, changed: false };
    }

    const need = run.sum - fixedSum;
    if (empty.length === 0) return { ok: need === 0, changed: false };
    if (need <= 0) return { ok: false, changed: false };

    const subsets = digitSubsets(empty.length, need);
    if (subsets.length === 0) return { ok: false, changed: false };

    const feasible = subsets.filter((subset) => matchingExists(empty, ctx.cands, subset));
    if (feasible.length === 0) return { ok: false, changed: false };

    let changed = false;

    /* 粗修剪：不在任何可行组合里的数字一律剔除 */
    const union = new Set();
    feasible.forEach((subset) => subset.forEach((digit) => union.add(digit)));

    for (const cell of empty) {
        const set = ctx.cands[cell.r][cell.c];
        for (const digit of [...set]) {
            if (union.has(digit)) continue;
            set.delete(digit);
            changed = true;
        }
        if (set.size === 0) return { ok: false, changed: false };
    }

    /* 精修剪：逐格逐数确认能否被安置（短段才做，长段交给深搜） */
    if (empty.length <= 5 && feasible.length <= 12) {
        empty.forEach((cell, index) => {
            const set = ctx.cands[cell.r][cell.c];
            for (const digit of [...set]) {
                const usable = feasible.some(
                    (subset) =>
                        subset.includes(digit) &&
                        matchingExists(empty, ctx.cands, subset, { index, digit })
                );
                if (!usable) {
                    set.delete(digit);
                    changed = true;
                }
            }
        });
    }

    /* 候选唯一则落定 */
    for (const cell of empty) {
        const set = ctx.cands[cell.r][cell.c];
        if (set.size === 0) return { ok: false, changed };
        if (set.size === 1) {
            assignDigit(ctx, cell.r, cell.c, [...set][0]);
            changed = true;
        }
    }

    return { ok: true, changed };
}

/* 反复推演直到稳定 */
function propagate(layout, runs, size, input) {
    const digits = cloneCells(input);
    const cands = initCandidates(layout, runs, size, digits);
    if (!cands) return { ok: false, digits, cands: null, solved: false };

    const ctx = { digits, cands, runIndex: indexRuns(runs, size) };

    let stable = false;
    let guard = 0;

    while (guard < 40) {
        guard += 1;
        let changed = false;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!layout[r][c] || digits[r][c] !== EMPTY) continue;
                const set = cands[r][c];
                if (!set || set.size === 0) {
                    return { ok: false, digits, cands, solved: false };
                }
                if (set.size === 1) {
                    assignDigit(ctx, r, c, [...set][0]);
                    changed = true;
                }
            }
        }

        for (const run of runs) {
            const result = filterRun(ctx, run);
            if (!result.ok) return { ok: false, digits, cands, solved: false };
            if (result.changed) changed = true;
        }

        if (!changed) {
            stable = true;
            break;
        }
    }

    const complete = !layout.some((row, r) =>
        row.some((isWhite, c) => isWhite && digits[r][c] === EMPTY)
    );

    /* 全部填满且未有冲突即视为解出 */
    return { ok: true, digits, cands, solved: stable && complete };
}

/* 深搜求解：最多收集 limit 个解 */
function countSolutions(layout, runs, size, input, options = {}) {
    const limit = options.limit ?? 2;
    const nodeLimit = options.nodeLimit ?? 40000;
    const deadline = options.deadline ?? null;

    const solutions = [];
    let nodes = 0;
    let truncated = false;

    const search = (digits) => {
        if (solutions.length >= limit || truncated) return;
        if ((deadline && Date.now() > deadline) || nodes > nodeLimit) {
            truncated = true;
            return;
        }
        nodes += 1;

        const result = propagate(layout, runs, size, digits);
        if (!result.ok) return;

        if (result.solved) {
            solutions.push(cloneCells(result.digits));
            return;
        }

        let best = null;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!layout[r][c] || result.digits[r][c] !== EMPTY) continue;
                const set = result.cands[r][c];
                if (!set || set.size === 0) return;
                if (!best || set.size < best.values.length) best = { r, c, values: [...set] };
            }
        }
        if (!best) return;

        for (const value of best.values) {
            if (solutions.length >= limit || truncated) return;
            const branch = cloneCells(result.digits);
            branch[best.r][best.c] = value;
            search(branch);
        }
    };

    search(cloneCells(input));

    return { solutions, truncated, nodes };
}

/* 随机找一个满足「同段不重复」的填法，用来产出答案 */
function findAnySolution(layout, geometry, size, random, deadline) {
    const search = (digits, depth) => {
        if (depth > size * size) return null;
        if (deadline && Date.now() > deadline) return null;

        const result = propagate(layout, geometry, size, digits);
        if (!result.ok) return null;
        if (result.solved) return result.digits;

        let best = null;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!layout[r][c] || result.digits[r][c] !== EMPTY) continue;
                const set = result.cands[r][c];
                if (!set || set.size === 0) return null;
                if (!best || set.size < best.values.length) best = { r, c, values: [...set] };
            }
        }
        if (!best) return null;

        const values = best.values
            .map((value) => ({ value, order: random() }))
            .sort((a, b) => a.order - b.order)
            .map((item) => item.value);

        for (const value of values) {
            const branch = cloneCells(result.digits);
            branch[best.r][best.c] = value;
            const found = search(branch, depth + 1);
            if (found) return found;
        }
        return null;
    };

    return search(createCells(size, layout), 0);
}

/* ---------------- 线索与判定 ---------------- */

/* 由段落生成线索网格 */
function buildClueGrids(runs, size) {
    const rowClues = createGrid(size, null);
    const colClues = createGrid(size, null);
    runs.forEach((run) => {
        if (run.axis === 'row') rowClues[run.clue.r][run.clue.c] = run.sum;
        else colClues[run.clue.r][run.clue.c] = run.sum;
    });
    return { rowClues, colClues };
}

/* 可填格数量 */
function countPlayable(layout) {
    return layout.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

/* 已填格数量 */
function countFilled(cells) {
    return cells.reduce(
        (sum, row) => sum + row.filter((value) => value >= 1 && value <= 9).length,
        0
    );
}

/* 统计提示格数量 */
function cellsFilled(grid) {
    return grid.reduce(
        (sum, row) => sum + row.filter((value) => value >= 1 && value <= 9).length,
        0
    );
}

/* 是否已按答案填满 */
function isSolved(cells, solution) {
    for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells.length; c++) {
            const answer = solution[r][c];
            if (answer < 1 || answer > 9) continue;
            if (cells[r][c] !== answer) return false;
        }
    }
    return true;
}

/* 找出与答案不符的第一格（含未填与填错） */
function findMismatch(cells, solution) {
    for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells.length; c++) {
            const answer = solution[r][c];
            if (answer < 1 || answer > 9) continue;
            if (cells[r][c] !== answer) return { r, c };
        }
    }
    return null;
}

/* 同段内重复数字的位置集合（用于冲突标记） */
function findDuplicates(runs, cells) {
    const marks = new Set();
    runs.forEach((run) => {
        const seen = new Map();
        run.cells.forEach((cell) => {
            const value = cells[cell.r][cell.c];
            if (value < 1 || value > 9) return;
            if (seen.has(value)) {
                const prev = seen.get(value);
                marks.add(`${prev.r},${prev.c}`);
                marks.add(`${cell.r},${cell.c}`);
            }
            seen.set(value, cell);
        });
    });
    return marks;
}

/* 取某格所在的某方向段落 */
function runAt(runs, axis, r, c) {
    return runs.find(
        (run) => run.axis === axis && run.cells.some((cell) => cell.r === r && cell.c === c)
    );
}

/* ---------------- 提示 ---------------- */

/* 逻辑提示：推演能确定的空格 */
function findLogicalHint(layout, runs, size, cells) {
    const result = propagate(layout, runs, size, cells);
    if (!result.ok) return null;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!layout[r][c]) continue;
            if (cells[r][c] >= 1 && cells[r][c] <= 9) continue;
            const value = result.digits[r][c];
            if (value >= 1 && value <= 9) return { row: r, col: c, value, logical: true };
        }
    }
    return null;
}

/* 兜底提示：直接揭示答案中与当前盘面不符的一格 */
function findFallbackHint(cells, solution) {
    const spot = findMismatch(cells, solution);
    if (!spot) return null;
    return { row: spot.r, col: spot.c, value: solution[spot.r][spot.c], logical: false };
}

/* ---------------- 生成 ---------------- */

/* 逐步补充最少的提示格，直到整盘能被推演逐步填满。
   推演的每一步都是必要条件，因此「推演填满」即等价于「唯一解」，
   比反复清点解数更快，也更贴近玩家真实的推理路径。 */
function refineWithGivens(layout, runs, size, solution, deadline) {
    const givens = createGrid(size, 0);
    const playable = countPlayable(layout);
    const limitRounds = playable + 4;

    const withGivens = () => {
        const input = createCells(size, layout);
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (givens[r][c] >= 1 && givens[r][c] <= 9) input[r][c] = givens[r][c];
            }
        }
        return input;
    };

    for (let round = 0; round < limitRounds; round++) {
        if (deadline && Date.now() > deadline) break;

        const result = propagate(layout, runs, size, withGivens());
        if (!result.ok) break;
        if (result.solved) return { givens, solution, exact: true };

        /* 固定「候选最少」的那一格：它正是推演卡住的地方，补上后最容易带出一连串必然格 */
        let pick = null;
        for (let r = 1; r < size; r++) {
            for (let c = 1; c < size; c++) {
                if (!layout[r][c] || result.digits[r][c] !== EMPTY) continue;
                const set = result.cands?.[r]?.[c];
                if (!set || set.size === 0) continue;
                if (!pick || set.size < pick.size) pick = { r, c, size: set.size };
            }
        }
        if (!pick) break;
        givens[pick.r][pick.c] = solution[pick.r][pick.c];
    }

    /* 兜底：仍不收敛时把剩余空格全部固定，必然唯一（实际几乎不会走到这里） */
    for (let r = 1; r < size; r++) {
        for (let c = 1; c < size; c++) {
            if (layout[r][c] && !givens[r][c]) givens[r][c] = solution[r][c];
        }
    }

    const final = propagate(layout, runs, size, withGivens());
    return { givens, solution, exact: Boolean(final.ok && final.solved) };
}

/* 按尺寸档位生成一道题目：优先挑「提示格最少」的那一个 */
function generateByDifficulty(id) {
    const config = getSize(id);
    const size = config.size;
    const deadline = Date.now() + config.budget;
    const spareDeadline = Date.now() + config.budget + 2500;

    let best = null;
    let spare = null;

    const assemble = (layout) => {
        const geometry = runsGeometry(layout);
        const solution = findAnySolution(layout, geometry, size, Math.random, spareDeadline);
        if (!solution) return null;
        const runs = withSums(geometry, solution);
        return {
            size,
            layout,
            runs,
            solution,
            ...buildClueGrids(runs, size),
            playable: countPlayable(layout)
        };
    };

    const finalize = (item, givens) => ({ ...item, givens, solvable: false });

    for (let attempt = 0; attempt < 26 && Date.now() < deadline; attempt++) {
        const layout = randomLayout(size, config.density, Math.random);
        if (!layout) continue;

        const item = assemble(layout);
        if (!item) continue;

        /* 完全靠推演即可解出：最理想，一格提示都不需要 */
        const pure = propagate(layout, item.runs, size, createCells(size, layout));
        if (pure.ok && pure.solved) {
            return { ...finalize(item, createGrid(size, 0)), solvable: true };
        }

        spare = item;

        const refined = refineWithGivens(layout, item.runs, size, item.solution, deadline);
        if (!refined.exact) continue;

        const count = cellsFilled(refined.givens);
        if (!best || count < best.count) {
            best = { ...finalize(item, refined.givens), count };
        }
        if (best.count <= 1) break;
    }

    if (best) {
        const { count, ...rest } = best;
        return { ...rest, fallbackUsed: count > 0 };
    }

    /* 极端兜底：本轮没能挑出合适版面时，沿用兜底版面并补足提示格 */
    const layout =
        spare?.layout ?? fallbackLayout(size) ?? randomLayout(size, config.density, Math.random);
    const built = assemble(layout);
    if (built) {
        const refined = refineWithGivens(
            built.layout,
            built.runs,
            size,
            built.solution,
            Date.now() + 4000
        );
        return { ...finalize(built, refined.givens), fallbackUsed: true };
    }

    /* 理论上不会到达：直接以兜底版面构造最小可玩题目 */
    const forced = fallbackLayout(size);
    const geometry = runsGeometry(forced);
    const solution = findAnySolution(forced, geometry, size, Math.random, Date.now() + 3000);
    const runs = withSums(geometry, solution);
    return {
        size,
        layout: forced,
        runs,
        solution,
        givens: createGrid(size, 0),
        ...buildClueGrids(runs, size),
        solvable: false,
        playable: countPlayable(forced),
        fallbackUsed: true
    };
}

export {
    BLACK,
    EMPTY,
    SIZES,
    getSize,
    coordLabel,
    createGrid,
    createCells,
    cloneCells,
    gridRuns,
    runsGeometry,
    withSums,
    validateLayout,
    repairLayout,
    randomLayout,
    fallbackLayout,
    digitSubsets,
    matchingExists,
    initCandidates,
    indexRuns,
    assignDigit,
    filterRun,
    propagate,
    countSolutions,
    findAnySolution,
    buildClueGrids,
    countPlayable,
    countFilled,
    cellsFilled,
    isSolved,
    findMismatch,
    findDuplicates,
    runAt,
    findLogicalHint,
    findFallbackHint,
    refineWithGivens,
    generateByDifficulty
};
