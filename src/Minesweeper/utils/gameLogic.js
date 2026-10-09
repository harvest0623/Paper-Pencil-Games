/* ============================================================
   扫雷：核心逻辑
   棋盘由「地雷 / 数字 / 未翻开 / 已插旗」组成。
   首次点击必定安全：地雷在第一次点开之后才布置，并避开首点及其八邻域。
   ============================================================ */

export const COLUMN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/* 难度配置：行列、雷数与说明 */
export const DIFFICULTIES = [
    {
        id: 'easy',
        label: '简单',
        rows: 9,
        cols: 9,
        mines: 10,
        desc: '9×9 共 10 颗雷，适合熟悉规则与手感。'
    },
    {
        id: 'medium',
        label: '中等',
        rows: 12,
        cols: 12,
        mines: 24,
        desc: '12×12 共 24 颗雷，开始需要一点推理。'
    },
    {
        id: 'hard',
        label: '困难',
        rows: 16,
        cols: 16,
        mines: 50,
        desc: '16×16 共 50 颗雷，雷的密度明显提升。'
    },
    {
        id: 'expert',
        label: '专家',
        rows: 16,
        cols: 24,
        mines: 80,
        desc: '16×24 共 80 颗雷，接近经典专家局，请谨慎挑战。'
    }
];

export const getDifficulty = (id) => DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[0];

/* 坐标标签，如 C7 */
export const coordLabel = (row, col) => `${COLUMN_LABELS[col] ?? col + 1}${row + 1}`;

/* 生成同尺寸的二维数组，并用同一初始值填充 */
export const createGrid = (rows, cols, value = 0) =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));

export const cloneGrid = (grid) => grid.map((row) => [...row]);

/* 某一格的八邻域（自动裁剪边界） */
export const getNeighbors = (row, col, rows, cols) => {
    const list = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && c >= 0 && r < rows && c < cols) list.push({ row: r, col: c });
        }
    }
    return list;
};

/* Fisher–Yates 洗牌 */
const shuffle = (list) => {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/* 布雷：首点及其八邻域保持安全 */
export const placeMines = (rows, cols, mineCount, safeRow, safeCol) => {
    const forbidden = new Set();
    if (safeRow != null && safeCol != null) {
        forbidden.add(`${safeRow}-${safeCol}`);
        getNeighbors(safeRow, safeCol, rows, cols).forEach(({ row, col }) =>
            forbidden.add(`${row}-${col}`)
        );
    }

    const candidates = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (!forbidden.has(`${row}-${col}`)) candidates.push({ row, col });
        }
    }

    const mines = createGrid(rows, cols, false);
    shuffle(candidates)
        .slice(0, Math.min(mineCount, candidates.length))
        .forEach(({ row, col }) => {
            mines[row][col] = true;
        });
    return mines;
};

/* 计算每格周围的雷数（雷格本身记为 0） */
export const computeAdj = (mines, rows, cols) => {
    const adj = createGrid(rows, cols, 0);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (mines[row][col]) continue;
            adj[row][col] = getNeighbors(row, col, rows, cols).filter(
                (n) => mines[n.row][n.col]
            ).length;
        }
    }
    return adj;
};

/* 统计已插旗数量 */
export const countFlags = (flag) =>
    flag.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

/* 统计已翻开的安全格数量 */
export const countRevealedSafe = (reveal, mines) => {
    if (!mines) return 0;
    let count = 0;
    for (let row = 0; row < reveal.length; row++) {
        for (let col = 0; col < reveal[row].length; col++) {
            if (reveal[row][col] && !mines[row][col]) count += 1;
        }
    }
    return count;
};

/* 安全格总数（非雷格） */
export const countSafeTotal = (mines) => {
    if (!mines) return 0;
    let count = 0;
    for (let row = 0; row < mines.length; row++) {
        for (let col = 0; col < mines[row].length; col++) {
            if (!mines[row][col]) count += 1;
        }
    }
    return count;
};

/* 是否获胜：所有非雷格子都被翻开 */
export const isWin = (reveal, mines) => {
    for (let row = 0; row < mines.length; row++) {
        for (let col = 0; col < mines[row].length; col++) {
            if (!mines[row][col] && !reveal[row][col]) return false;
        }
    }
    return true;
};

/* 空白区洪水填充：翻开某一格，若其周围 0 雷则继续展开相邻格 */
export const floodReveal = (reveal, flag, adj, mines, row, col, rows, cols) => {
    const next = cloneGrid(reveal);
    const stack = [{ row, col }];
    while (stack.length) {
        const { row: r, col: c } = stack.pop();
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        if (next[r][c]) continue;
        if (flag[r][c]) continue;
        /* 洪水不揭开地雷：踩雷只由显式操作触发 */
        if (mines[r][c]) continue;
        next[r][c] = true;
        if (adj[r][c] === 0) {
            getNeighbors(r, c, rows, cols).forEach((n) => {
                if (!next[n.row][n.col] && !flag[n.row][n.col]) stack.push(n);
            });
        }
    }
    return next;
};

/* 把棋盘上所有地雷标记为已翻开（用于失败后展示） */
export const revealMines = (reveal, mines) => {
    if (!mines) return reveal;
    const next = cloneGrid(reveal);
    for (let row = 0; row < mines.length; row++) {
        for (let col = 0; col < mines[row].length; col++) {
            if (mines[row][col]) next[row][col] = true;
        }
    }
    return next;
};

/* 一键展开：已翻开的数字格周围旗数达标时，返回其余需要翻开的隐藏邻格 */
export const chordCells = (reveal, flag, adj, row, col, rows, cols) => {
    if (!reveal[row][col]) return [];
    const value = adj[row][col];
    if (!value) return [];
    const neighbors = getNeighbors(row, col, rows, cols);
    const flagged = neighbors.filter((n) => flag[n.row][n.col]).length;
    if (flagged !== value) return [];
    return neighbors.filter((n) => !reveal[n.row][n.col] && !flag[n.row][n.col]);
};

/* 引擎提示：优先给出可确定的安全格；没有时给出可确定的雷格 */
export const findHint = (reveal, flag, adj, mines, rows, cols) => {
    let mineCell = null;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (!reveal[row][col] || mines[row][col]) continue;
            const value = adj[row][col];
            if (!value) continue;
            const neighbors = getNeighbors(row, col, rows, cols);
            const hidden = neighbors.filter((n) => !reveal[n.row][n.col] && !flag[n.row][n.col]);
            if (hidden.length === 0) continue;
            const flagged = neighbors.filter((n) => flag[n.row][n.col]).length;
            /* 周围旗数已经等于数字 → 其余隐藏格必定安全 */
            if (flagged === value) {
                return { type: 'safe', row: hidden[0].row, col: hidden[0].col };
            }
            /* 隐藏格数量刚好等于剩余雷数 → 它们必定全是雷 */
            if (hidden.length === value - flagged && !mineCell) {
                mineCell = { type: 'mine', row: hidden[0].row, col: hidden[0].col };
            }
        }
    }
    return mineCell;
};

/* 生成一份可读的棋盘文本快照（用于调试） */
export const boardToText = (reveal, flag, adj, mines) =>
    reveal
        .map((row, r) =>
            row
                .map((open, c) => {
                    if (!open) return flag[r][c] ? 'F' : '·';
                    if (mines[r][c]) return '*';
                    return adj[r][c] === 0 ? ' ' : String(adj[r][c]);
                })
                .join(' ')
        )
        .join('\n');