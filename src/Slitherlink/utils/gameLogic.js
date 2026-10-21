/* ============================================================
   数回（Slitherlink）核心逻辑
   ------------------------------------------------------------
   棋盘是 n × n 个「数字格」，四周由 (n+1) × (n+1) 个点阵围成：
   - 横边 h：位于第 r 行点阵上，连接点 (r, c) 与 (r, c+1)，共 (n+1) × n 条
   - 竖边 v：位于第 c 列点阵上，连接点 (r, c) 与 (r+1, c)，共 n × (n+1) 条
   每条边有三种状态：EMPTY（未处理）/ LINE（连线）/ CROSS（打叉）。

   内部推演统一使用一维扁平数组（下标由 hIdx / vIdx 计算），
   而界面层更直观，使用 { h, v } 两个二维数组，二者通过 toFlat / fromFlat 互换。
   数字格用 0~4 表示提示值，NO_CLUE 表示该格没有提示。
   ============================================================ */

const EMPTY = 0;
const LINE = 1;
const CROSS = 2;
const NO_CLUE = -1;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/* 三档尺寸：n 为数字格的边长 */
const SIZES = [
    {
        id: 'easy',
        label: '5 × 5',
        n: 5,
        targetRemove: 14,
        minClues: 8,
        budget: 900,
        nodeLimit: 20000,
        desc: '入门尺寸，回路短、提示密，先熟悉连线与打叉的节奏。'
    },
    {
        id: 'medium',
        label: '7 × 7',
        n: 7,
        targetRemove: 34,
        minClues: 12,
        budget: 1800,
        nodeLimit: 30000,
        desc: '中等尺寸，回路开始缠绕，需要靠「四周线段数」逐步排除。'
    },
    {
        id: 'hard',
        label: '9 × 9',
        n: 9,
        targetRemove: 50,
        minClues: 20,
        budget: 2800,
        nodeLimit: 40000,
        desc: '挑战尺寸，长回路穿插全盘，推理链更长，考验耐心与全局观。'
    }
];

function getSize(id) {
    return SIZES.find((item) => item.id === id) ?? SIZES[0];
}

/* ---------------- 坐标与下标 ---------------- */

/* 横边的数量 */
function hCount(n) {
    return (n + 1) * n;
}

/* 竖边的数量 */
function vCount(n) {
    return n * (n + 1);
}

/* 边的总数 */
function edgeCount(n) {
    return 2 * n * (n + 1);
}

/* 横边 (r, c) 的扁平下标，r 取 0~n，c 取 0~n-1 */
function hIdx(n, r, c) {
    return r * n + c;
}

/* 竖边 (r, c) 的扁平下标，r 取 0~n-1，c 取 0~n */
function vIdx(n, r, c) {
    return hCount(n) + r * (n + 1) + c;
}

/* 扁平下标还原为 { t, r, c } */
function decodeEdge(n, index) {
    if (index < hCount(n)) {
        return { t: 'h', r: Math.floor(index / n), c: index % n };
    }
    const rest = index - hCount(n);
    return { t: 'v', r: Math.floor(rest / (n + 1)), c: rest % (n + 1) };
}

/* 边 { t, r, c } 对应的扁平下标 */
function encodeEdge(n, t, r, c) {
    return t === 'h' ? hIdx(n, r, c) : vIdx(n, r, c);
}

/* 两个相邻点之间的边下标 */
function edgeBetween(n, a, b) {
    const ar = Math.floor(a / (n + 1));
    const ac = a % (n + 1);
    const br = Math.floor(b / (n + 1));
    const bc = b % (n + 1);
    if (ar === br) return hIdx(n, ar, Math.min(ac, bc));
    return vIdx(n, Math.min(ar, br), ac);
}

/* 棋盘坐标标签，如 R3C4 */
function coordLabel(row, col) {
    return `R${row + 1}C${col + 1}`;
}

/* 边的文字标签，如 A1-B1 / A1-A2 */
function edgeLabel(edge) {
    const { t, r, c } = edge;
    if (t === 'h') return `${LETTERS[c]}${r + 1}-${LETTERS[c + 1]}${r + 1}`;
    return `${LETTERS[c]}${r + 1}-${LETTERS[c]}${r + 2}`;
}

/* ---------------- 棋盘结构 ---------------- */

/* 生成一副全部为同一状态的棋盘：{ h, v } */
function createEdges(n, value = EMPTY) {
    return {
        h: Array.from({ length: n + 1 }, () => Array.from({ length: n }, () => value)),
        v: Array.from({ length: n }, () => Array.from({ length: n + 1 }, () => value))
    };
}

/* 深拷贝棋盘 */
function cloneEdges(edges) {
    return {
        h: edges.h.map((row) => [...row]),
        v: edges.v.map((row) => [...row])
    };
}

/* 界面棋盘 → 扁平数组 */
function toFlat(n, edges) {
    const flat = new Int8Array(edgeCount(n));
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) flat[hIdx(n, r, c)] = edges.h[r][c];
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) flat[vIdx(n, r, c)] = edges.v[r][c];
    }
    return flat;
}

/* 扁平数组 → 界面棋盘 */
function fromFlat(n, flat) {
    const edges = createEdges(n);
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) edges.h[r][c] = flat[hIdx(n, r, c)];
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) edges.v[r][c] = flat[vIdx(n, r, c)];
    }
    return edges;
}

/* ---------------- 预编译邻接表 ---------------- */

const ctxCache = new Map();

function buildCtx(n) {
    const E = edgeCount(n);

    /* 每个数字格的四条边 */
    const cellEdges = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            cellEdges.push([hIdx(n, r, c), hIdx(n, r + 1, c), vIdx(n, r, c), vIdx(n, r, c + 1)]);
        }
    }

    /* 每个点阵的邻近边 */
    const vertexEdges = [];
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
            const list = [];
            if (c - 1 >= 0) list.push(hIdx(n, r, c - 1));
            if (c <= n - 1) list.push(hIdx(n, r, c));
            if (r - 1 >= 0) list.push(vIdx(n, r - 1, c));
            if (r <= n - 1) list.push(vIdx(n, r, c));
            vertexEdges.push(list);
        }
    }

    /* 每条边的两个端点 */
    const edgeVertices = new Array(E);
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) {
            edgeVertices[hIdx(n, r, c)] = [r * (n + 1) + c, r * (n + 1) + c + 1];
        }
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) {
            edgeVertices[vIdx(n, r, c)] = [r * (n + 1) + c, (r + 1) * (n + 1) + c];
        }
    }

    return { n, E, cellEdges, vertexEdges, edgeVertices };
}

function getCtx(n) {
    let ctx = ctxCache.get(n);
    if (!ctx) {
        ctx = buildCtx(n);
        ctxCache.set(n, ctx);
    }
    return ctx;
}

/* ---------------- 回路结构分析 ---------------- */

/* 统计连线的度数分布、连通分量与闭环数量 */
function loopInfoFlat(n, flat, ctx) {
    const size = n + 1;
    const total = size * size;
    const deg = new Int8Array(total);
    let lineEdges = 0;

    for (let e = 0; e < ctx.E; e++) {
        if (flat[e] !== LINE) continue;
        lineEdges += 1;
        const [a, b] = ctx.edgeVertices[e];
        deg[a] += 1;
        deg[b] += 1;
    }

    if (lineEdges === 0) return { loops: 0, components: 0, lineEdges: 0 };

    const seen = new Uint8Array(total);
    let components = 0;
    let loops = 0;

    for (let start = 0; start < total; start++) {
        if (deg[start] === 0 || seen[start]) continue;
        components += 1;
        const stack = [start];
        seen[start] = 1;
        let allTwo = true;

        while (stack.length > 0) {
            const cur = stack.pop();
            if (deg[cur] !== 2) allTwo = false;
            for (const e of ctx.vertexEdges[cur]) {
                if (flat[e] !== LINE) continue;
                const [a, b] = ctx.edgeVertices[e];
                const other = a === cur ? b : a;
                if (seen[other]) continue;
                seen[other] = 1;
                stack.push(other);
            }
        }

        if (allTwo) loops += 1;
    }

    return { loops, components, lineEdges };
}

/* ---------------- 推导（约束传播） ---------------- */

/* 所有数字格的连线数是否都符合提示 */
function cluesSatisfiedFlat(n, digits, flat, ctx) {
    for (let idx = 0; idx < ctx.cellEdges.length; idx++) {
        const d = digits[idx];
        if (d === NO_CLUE) continue;
        let line = 0;
        for (const e of ctx.cellEdges[idx]) if (flat[e] === LINE) line += 1;
        if (line !== d) return false;
    }
    return true;
}

/**
 * 约束传播：反复套用「数字格四周线段数」与「点阵度数只能是 0 或 2」两条规则，
 * 直到没有新的边被确定为止；中途只要出现矛盾就立即判失败。
 * 返回 { ok, state, solved }。
 */
function propagate(n, digits, input, ctx = getCtx(n)) {
    const state = input.slice();

    for (let pass = 0; pass < 80; pass++) {
        let changed = false;

        /* 规则一：数字格的四周线段数 */
        for (let idx = 0; idx < ctx.cellEdges.length; idx++) {
            const d = digits[idx];
            if (d === NO_CLUE) continue;
            let line = 0;
            const unknown = [];
            for (const e of ctx.cellEdges[idx]) {
                if (state[e] === LINE) line += 1;
                else if (state[e] === EMPTY) unknown.push(e);
            }
            if (line > d || line + unknown.length < d) return { ok: false, state };
            if (unknown.length === 0) continue;
            if (line === d) {
                for (const e of unknown) {
                    state[e] = CROSS;
                    changed = true;
                }
            } else if (line + unknown.length === d) {
                for (const e of unknown) {
                    state[e] = LINE;
                    changed = true;
                }
            }
        }

        /* 规则二：点阵的度数只能是 0 或 2 */
        for (let v = 0; v < ctx.vertexEdges.length; v++) {
            let line = 0;
            const unknown = [];
            for (const e of ctx.vertexEdges[v]) {
                if (state[e] === LINE) line += 1;
                else if (state[e] === EMPTY) unknown.push(e);
            }
            if (line > 2) return { ok: false, state };
            if (line === 2) {
                for (const e of unknown) {
                    state[e] = CROSS;
                    changed = true;
                }
            } else if (line === 1) {
                if (unknown.length === 0) return { ok: false, state };
                if (unknown.length === 1) {
                    state[unknown[0]] = LINE;
                    changed = true;
                }
            } else if (unknown.length === 1) {
                /* 度数为 0 时不可能只连一条边，这条边只能打叉 */
                state[unknown[0]] = CROSS;
                changed = true;
            }
        }

        /* 规则三：回路一旦提前闭合，就不允许再有别的线或未满足的数字格 */
        const info = loopInfoFlat(n, state, ctx);
        if (info.loops > 1) return { ok: false, state };
        if (info.loops === 1) {
            if (info.components > 1) return { ok: false, state };
            if (!cluesSatisfiedFlat(n, digits, state, ctx)) return { ok: false, state };
            return { ok: true, state, solved: true };
        }

        if (!changed) break;
    }

    return { ok: true, state, solved: false };
}

/* 只取连线位置作为解的特征串，用于去重 */
function lineKey(state) {
    let key = '';
    for (let e = 0; e < state.length; e++) key += state[e] === LINE ? '1' : '0';
    return key;
}

/**
 * 选分支：返回一组「必须有一条成为连线」的候选边。
 * 两种情况都能保证至少有一条成立，因此逐个尝试即为完备搜索：
 *   ① 还没满足的数字格 —— 它至少还需要一条线；
 *   ② 度数恰好为 1 的点 —— 回路必须再连一条进来。
 * 都没有时返回 null，说明当前线形已无法补成回路。
 */
function pickBranch(n, digits, state, ctx) {
    let bestCell = null;
    for (let idx = 0; idx < ctx.cellEdges.length; idx++) {
        const d = digits[idx];
        if (d === NO_CLUE) continue;
        let line = 0;
        const unknown = [];
        for (const e of ctx.cellEdges[idx]) {
            if (state[e] === LINE) line += 1;
            else if (state[e] === EMPTY) unknown.push(e);
        }
        const need = d - line;
        if (need <= 0) continue;
        if (unknown.length < need) return null;
        if (!bestCell || unknown.length < bestCell.length) bestCell = unknown;
        if (unknown.length === need) break;
    }
    if (bestCell) return bestCell;

    let bestVertex = null;
    for (let v = 0; v < ctx.vertexEdges.length; v++) {
        let line = 0;
        const unknown = [];
        for (const e of ctx.vertexEdges[v]) {
            if (state[e] === LINE) line += 1;
            else if (state[e] === EMPTY) unknown.push(e);
        }
        if (line !== 1 || unknown.length < 2) continue;
        if (!bestVertex || unknown.length < bestVertex.length) bestVertex = unknown;
    }
    return bestVertex;
}

/**
 * 求解器：约束传播 + 深搜，最多收集 limit 个解。
 * 完备性依赖 pickBranch：它给出的候选里至少有一条在真解中成立。
 */
function countSolutions(n, digits, options = {}) {
    const ctx = getCtx(n);
    const limit = options.limit ?? 2;
    const nodeLimit = options.nodeLimit ?? 30000;
    const deadline = options.deadline ?? null;
    const solutions = [];
    const seen = new Set();
    let nodes = 0;
    let truncated = false;

    const search = (state) => {
        if (solutions.length >= limit || truncated) return;
        if (nodes > nodeLimit || (deadline && Date.now() > deadline)) {
            truncated = true;
            return;
        }
        nodes += 1;

        const result = propagate(n, digits, state, ctx);
        if (!result.ok) return;
        if (result.solved) {
            const key = lineKey(result.state);
            if (!seen.has(key)) {
                seen.add(key);
                solutions.push(result.state);
            }
            return;
        }

        const branches = pickBranch(n, digits, result.state, ctx);
        if (!branches) return;

        for (const e of branches) {
            if (solutions.length >= limit || truncated) return;
            const branch = result.state.slice();
            branch[e] = LINE;
            search(branch);
        }
    };

    search(options.state ?? new Int8Array(edgeCount(n)));
    return { solutions, nodes, truncated };
}

/* ---------------- 玩家盘面判定 ---------------- */

/* 由回路推出每个数字格的提示值 */
function digitsFromSolution(n, flat) {
    const ctx = getCtx(n);
    const digits = new Int8Array(n * n);
    for (let idx = 0; idx < ctx.cellEdges.length; idx++) {
        let line = 0;
        for (const e of ctx.cellEdges[idx]) if (flat[e] === LINE) line += 1;
        digits[idx] = line;
    }
    return digits;
}

/* 某个数字格四周已连的线段数 */
function cellLineCount(n, edges, r, c) {
    let line = 0;
    if (edges.h[r][c] === LINE) line += 1;
    if (edges.h[r + 1][c] === LINE) line += 1;
    if (edges.v[r][c] === LINE) line += 1;
    if (edges.v[r][c + 1] === LINE) line += 1;
    return line;
}

/* 提示格总数 */
function clueCount(digits) {
    let total = 0;
    for (let i = 0; i < digits.length; i++) if (digits[i] !== NO_CLUE) total += 1;
    return total;
}

/* 已满足的数字格数量 */
function countSatisfied(n, digits, edges) {
    let total = 0;
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const d = digits[r * n + c];
            if (d === NO_CLUE) continue;
            if (cellLineCount(n, edges, r, c) === d) total += 1;
        }
    }
    return total;
}

/* 已连线 / 已打叉的边数 */
function countEdges(edges, value) {
    let total = 0;
    edges.h.forEach((row) => row.forEach((v) => (total += v === value ? 1 : 0)));
    edges.v.forEach((row) => row.forEach((v) => (total += v === value ? 1 : 0)));
    return total;
}

/* 回路结构（供界面提示「回路已闭合」使用） */
function findLoops(n, edges) {
    const info = loopInfoFlat(n, toFlat(n, edges), getCtx(n));
    return { loops: info.loops, components: info.components, lineEdges: info.lineEdges };
}

/**
 * 规则判定：所有数字格满足提示，且连线恰好构成一条闭合回路。
 * 由于题目是唯一解，满足规则即等价于与答案一致。
 */
function isSolved(n, digits, edges) {
    const flat = toFlat(n, edges);
    const ctx = getCtx(n);
    if (!cluesSatisfiedFlat(n, digits, flat, ctx)) return false;
    const info = loopInfoFlat(n, flat, ctx);
    return info.loops === 1 && info.components === 1;
}

/* 违规标记：数字格线段数超标 / 点阵出现死路 */
function findViolations(n, digits, edges) {
    const marks = new Set();
    const flat = toFlat(n, edges);
    const ctx = getCtx(n);

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const d = digits[r * n + c];
            if (d === NO_CLUE) continue;
            let line = 0;
            let unknown = 0;
            for (const e of ctx.cellEdges[r * n + c]) {
                if (flat[e] === LINE) line += 1;
                else if (flat[e] === EMPTY) unknown += 1;
            }
            if (line > d || (line < d && unknown === 0)) marks.add(`c${r},${c}`);
        }
    }

    for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
            let line = 0;
            let unknown = 0;
            for (const e of ctx.vertexEdges[r * (n + 1) + c]) {
                if (flat[e] === LINE) line += 1;
                else if (flat[e] === EMPTY) unknown += 1;
            }
            if (line > 2 || (line === 1 && unknown === 0)) marks.add(`v${r},${c}`);
        }
    }

    return marks;
}

/* ---------------- 提示 ---------------- */

/* 智能打叉：数字格四周线段数已对上时，把其余待定边全部打叉（纯由盘面推出，无需答案） */
function autoCrossEdges(n, digits, edges) {
    const marks = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const d = digits[r * n + c];
            if (d === NO_CLUE) continue;
            const spots = [
                ['h', r, c],
                ['h', r + 1, c],
                ['v', r, c],
                ['v', r, c + 1]
            ];
            let line = 0;
            const empty = [];
            for (const [t, er, ec] of spots) {
                const value = t === 'h' ? edges.h[er][ec] : edges.v[er][ec];
                if (value === LINE) line += 1;
                else if (value === EMPTY) empty.push({ t, r: er, c: ec, state: CROSS });
            }
            if (line === d && empty.length > 0) marks.push(...empty);
        }
    }
    return marks;
}

/* 逻辑提示：传播后能唯一确定的边 */
function findLogicalHint(n, digits, edges) {
    const base = toFlat(n, edges);
    const result = propagate(n, digits, base, getCtx(n));
    if (!result.ok) return null;

    let crossHint = null;
    for (let e = 0; e < base.length; e++) {
        if (base[e] !== EMPTY || result.state[e] === EMPTY) continue;
        const spot = { ...decodeEdge(n, e), state: result.state[e], logical: true };
        if (result.state[e] === LINE) return spot;
        if (!crossHint) crossHint = spot;
    }
    return crossHint;
}

/* 兜底提示：直接揭示答案中的一条边 */
function findSolutionHint(n, solution, edges) {
    const base = toFlat(n, edges);
    for (let e = 0; e < base.length; e++) {
        if (solution[e] === LINE && base[e] !== LINE) {
            return { ...decodeEdge(n, e), state: LINE, logical: false };
        }
    }
    for (let e = 0; e < base.length; e++) {
        if (solution[e] !== LINE && base[e] === LINE) {
            return { ...decodeEdge(n, e), state: CROSS, logical: false };
        }
    }
    return null;
}

/* ---------------- 题目生成 ---------------- */

/* 打乱数组（Fisher-Yates） */
function shuffle(list, random) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* 兜底回路：居中矩形，保证一定有可用回路 */
function rectangleLoop(n) {
    const flat = new Int8Array(edgeCount(n));
    const r0 = n >= 3 ? 1 : 0;
    const c0 = r0;
    const r1 = n >= 3 ? n - 1 : 1;
    const c1 = r1;
    for (let c = c0; c < c1; c++) {
        flat[hIdx(n, r0, c)] = LINE;
        flat[hIdx(n, r1, c)] = LINE;
    }
    for (let r = r0; r < r1; r++) {
        flat[vIdx(n, r, c0)] = LINE;
        flat[vIdx(n, r, c1)] = LINE;
    }
    return flat;
}

/**
 * 随机找一条「不自交、不自触」的闭合回路：
 * 从随机点出发做带剪枝的深搜，走一步就避开所有已访问点旁边的位置，
 * 于是路径天然不会自己贴上来，闭合时必然是一条干净的回路。
 */
function randomLoop(n, random, nodeBudget, deadline) {
    const size = n + 1;
    const total = size * size;
    const minLen = Math.max(8, Math.round(3.2 * n));

    const neighbors = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const list = [];
            if (r > 0) list.push((r - 1) * size + c);
            if (r < size - 1) list.push((r + 1) * size + c);
            if (c > 0) list.push(r * size + c - 1);
            if (c < size - 1) list.push(r * size + c + 1);
            neighbors.push(list);
        }
    }

    for (let attempt = 0; attempt < 24; attempt++) {
        if (deadline && Date.now() > deadline) return null;

        const start = Math.floor(random() * total);
        const visited = new Uint8Array(total);
        const path = [start];
        visited[start] = 1;
        let nodes = 0;

        const visitedNeighborCount = (v) => {
            let k = 0;
            for (const u of neighbors[v]) if (visited[u]) k += 1;
            return k;
        };

        const onwardCount = (v) => {
            let k = 0;
            for (const u of neighbors[v]) {
                if (visited[u]) continue;
                if (visitedNeighborCount(u) === 1) k += 1;
            }
            return k;
        };

        const dfs = () => {
            if (nodes > nodeBudget) return null;
            nodes += 1;

            const cur = path[path.length - 1];

            /* 候选：
               ① 只挨着当前点的未访问点 —— 正常向前走；
               ② 同时挨着当前点与起点的未访问点 —— 走上去即可闭合回路 */
            const cands = [];
            for (const u of neighbors[cur]) {
                if (visited[u]) continue;
                let k = 0;
                let touchesStart = false;
                for (const w of neighbors[u]) {
                    if (!visited[w]) continue;
                    k += 1;
                    if (w === start) touchesStart = true;
                }
                if (k === 1) cands.push({ u, close: false });
                else if (k === 2 && touchesStart && path.length + 1 >= minLen) {
                    cands.push({ u, close: true });
                }
            }

            /* 优先走向「后续选择最少」的点（Warnsdorff 思想），能闭合时优先闭合 */
            const ordered = cands
                .map((item) => ({
                    ...item,
                    score: (item.close ? -1 : onwardCount(item.u)) + random() * 0.01
                }))
                .sort((a, b) => a.score - b.score);

            for (const item of ordered) {
                path.push(item.u);
                visited[item.u] = 1;
                if (item.close) return path.slice();
                const found = dfs();
                if (found) return found;
                path.pop();
                visited[item.u] = 0;
            }
            return null;
        };

        const loopPath = dfs();
        if (!loopPath || loopPath.length < minLen) continue;

        const flat = new Int8Array(edgeCount(n));
        for (let i = 0; i < loopPath.length; i++) {
            const a = loopPath[i];
            const b = loopPath[(i + 1) % loopPath.length];
            flat[edgeBetween(n, a, b)] = LINE;
        }
        return flat;
    }

    return null;
}

/* 找一个「数字格密度足够」的回路，保证题目不太空 */
function randomPuzzleLoop(n, random, deadline) {
    const gate = Math.max(4, Math.round(0.26 * n * n));
    for (let attempt = 0; attempt < 12; attempt++) {
        if (deadline && Date.now() > deadline) break;
        const flat = randomLoop(n, random, 24000, deadline);
        if (!flat) continue;
        const digits = digitsFromSolution(n, flat);
        if (clueCount(digits) >= gate) return flat;
    }
    return rectangleLoop(n);
}

/**
 * 逐个尝试去掉数字格：只有「去掉后依然唯一解」才会真的去掉，
 * 因此无论何时中断，得到的题目都保证唯一。
 */
function removeClues(n, digits, config, deadline, maxRemove) {
    const work = digits.slice();
    const order = shuffle(
        Array.from({ length: n * n }, (_, i) => i),
        Math.random
    );
    let removed = 0;

    for (const idx of order) {
        if (removed >= maxRemove) break;
        if (Date.now() > deadline) break;
        const old = work[idx];
        if (old === NO_CLUE) continue;

        work[idx] = NO_CLUE;
        const check = countSolutions(n, work, {
            limit: 2,
            nodeLimit: config.nodeLimit,
            deadline: Math.min(deadline, Date.now() + 900)
        });
        if (check.solutions.length === 1 && !check.truncated) removed += 1;
        else work[idx] = old;
    }

    return { digits: work, removed };
}

/* 按尺寸档位生成一道题目 */
function generateByDifficulty(id) {
    const config = getSize(id);
    const n = config.n;
    const maxRemove = config.targetRemove;
    const deadline = Date.now() + config.budget;

    let best = null;

    for (let attempt = 0; attempt < 4 && Date.now() < deadline; attempt++) {
        const flat = randomPuzzleLoop(n, Math.random, deadline);
        if (!flat) continue;
        const digits = digitsFromSolution(n, flat);
        const built = removeClues(n, digits, config, deadline, maxRemove);

        if (!best || built.removed > best.removed) {
            best = {
                n,
                solution: flat,
                digits: built.digits,
                removed: built.removed,
                clueCount: clueCount(built.digits)
            };
        }
        if (best.removed >= maxRemove) break;
    }

    if (!best) {
        const flat = rectangleLoop(n);
        const digits = digitsFromSolution(n, flat);
        const built = removeClues(n, digits, config, Date.now() + 1200, maxRemove);
        best = {
            n,
            solution: flat,
            digits: built.digits,
            removed: built.removed,
            clueCount: clueCount(built.digits)
        };
    }

    return best;
}

export {
    EMPTY,
    LINE,
    CROSS,
    NO_CLUE,
    LETTERS,
    SIZES,
    getSize,
    hCount,
    vCount,
    edgeCount,
    hIdx,
    vIdx,
    encodeEdge,
    decodeEdge,
    edgeBetween,
    coordLabel,
    edgeLabel,
    createEdges,
    cloneEdges,
    toFlat,
    fromFlat,
    getCtx,
    loopInfoFlat,
    propagate,
    countSolutions,
    digitsFromSolution,
    cellLineCount,
    clueCount,
    countSatisfied,
    countEdges,
    findLoops,
    isSolved,
    findViolations,
    autoCrossEdges,
    findLogicalHint,
    findSolutionHint,
    rectangleLoop,
    randomLoop,
    generateByDifficulty
};
