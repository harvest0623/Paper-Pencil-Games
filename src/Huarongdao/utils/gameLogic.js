/* ============================================================
   数字华容道：核心逻辑
   棋盘为 N×N 的方格，其中有一格是空格，其余格子填入 1 到 N²-1。
   目标：通过滑动与空格相邻的方块，把数字还原成从左到右、从上到下的顺序。
   ============================================================ */

/* 空格用 0 表示 */
export const EMPTY = 0;

export const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* 难度配置：尺寸与打乱步数 */
export const DIFFICULTIES = [
    {
        id: 'easy',
        label: '简单',
        size: 3,
        shuffle: 20,
        desc: '3×3 共八块，打乱步数少，适合熟悉滑动规则。'
    },
    {
        id: 'medium',
        label: '中等',
        size: 4,
        shuffle: 60,
        desc: '经典的 4×4 十五块，需要一点顺序意识。'
    },
    {
        id: 'hard',
        label: '困难',
        size: 5,
        shuffle: 120,
        desc: '5×5 二十四块，路线更长，考验耐心与规划。'
    },
    {
        id: 'expert',
        label: '专家',
        size: 6,
        shuffle: 200,
        desc: '6×6 三十五块，接近极限，请谨慎挑战。'
    }
];

export const getDifficulty = (id) => DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[0];

/* 坐标标签，如 A1 */
export const coordLabel = (row, col) => `${COLUMN_LABELS[col] ?? col + 1}${row + 1}`;

/* 生成完成态：1..n²-1 依次排列，最后一格为空 */
export const createSolvedBoard = (size) => {
    const total = size * size;
    const board = Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));
    for (let i = 0; i < total - 1; i++) {
        board[Math.floor(i / size)][i % size] = i + 1;
    }
    return board;
};

/* 深拷贝棋盘 */
export const cloneBoard = (board) => board.map((row) => [...row]);

/* 找到空格位置 */
export const findEmpty = (board) => {
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === EMPTY) return { row, col };
        }
    }
    return null;
};

/* 空格四周可移动的方向 */
const DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];

/* 与空格相邻的所有位置 */
export const getMovableCells = (board) => {
    const empty = findEmpty(board);
    if (!empty) return [];
    const size = board.length;
    return DIRECTIONS.map(([dr, dc]) => ({ row: empty.row + dr, col: empty.col + dc }))
        .filter(({ row, col }) => row >= 0 && col >= 0 && row < size && col < size);
};

/* 判断某个格子是否可以移动到空格 */
export const canMove = (board, row, col) => {
    const empty = findEmpty(board);
    if (!empty) return false;
    return Math.abs(empty.row - row) + Math.abs(empty.col - col) === 1;
};

/* 执行一次移动，返回新棋盘（不合法则返回 null） */
export const moveTile = (board, row, col) => {
    if (!canMove(board, row, col)) return null;
    const empty = findEmpty(board);
    const next = cloneBoard(board);
    next[empty.row][empty.col] = next[row][col];
    next[row][col] = EMPTY;
    return next;
};

/* 按数字查找它在棋盘上的位置 */
export const findValue = (board, value) => {
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === value) return { row, col };
        }
    }
    return null;
};

/* 生成保证可解的乱序棋盘：从完成态出发做 N 次逆向移动，且不立即回退 */
export const shuffleBoard = (size, steps) => {
    let board = createSolvedBoard(size);
    let prevEmpty = null;

    for (let i = 0; i < steps; i++) {
        const empty = findEmpty(board);
        const candidates = DIRECTIONS.map(([dr, dc]) => ({ row: empty.row + dr, col: empty.col + dc })).filter(
            ({ row, col }) =>
                row >= 0 &&
                col >= 0 &&
                row < size &&
                col < size &&
                !(prevEmpty && prevEmpty.row === row && prevEmpty.col === col)
        );

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const next = cloneBoard(board);
        next[empty.row][empty.col] = next[pick.row][pick.col];
        next[pick.row][pick.col] = EMPTY;
        prevEmpty = empty;
        board = next;
    }

    /* 极小概率恰好回到完成态，重新打乱一次 */
    if (isSolved(board)) return shuffleBoard(size, steps);
    return board;
};

/* 按难度生成一局 */
export const generateByDifficulty = (difficultyId) => {
    const { size, shuffle } = getDifficulty(difficultyId);
    return shuffleBoard(size, shuffle);
};

/* 是否已经完全还原 */
export const isSolved = (board) => {
    const size = board.length;
    let expected = 1;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            /* 最后一格必须是空格 */
            if (row === size - 1 && col === size - 1) return board[row][col] === EMPTY;
            if (board[row][col] !== expected) return false;
            expected += 1;
        }
    }
    return true;
};

/* 某个数字当前是否已经归位（空格不算） */
export const isTilePlaced = (board, row, col) => {
    const size = board.length;
    const value = board[row][col];
    if (value === EMPTY) return false;
    return value === row * size + col + 1;
};

/* 统计已归位的方块数量 */
export const countPlaced = (board) => {
    let placed = 0;
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (isTilePlaced(board, row, col)) placed += 1;
        }
    }
    return placed;
};

/* 归位进度百分比 */
export const getProgress = (board) => {
    const size = board.length;
    const total = size * size - 1;
    return Math.round((countPlaced(board) / total) * 100);
};

/* 曼哈顿距离之和，用于提示与评分 */
export const manhattan = (board) => {
    const size = board.length;
    let sum = 0;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const value = board[row][col];
            if (value === EMPTY) continue;
            const targetRow = Math.floor((value - 1) / size);
            const targetCol = (value - 1) % size;
            sum += Math.abs(targetRow - row) + Math.abs(targetCol - col);
        }
    }
    return sum;
};

/* 提示：在所有合法走法中，挑选能让总曼哈顿距离最小的一步 */
export const suggestMove = (board) => {
    const movable = getMovableCells(board);
    if (movable.length === 0) return null;

    let best = null;
    let bestScore = Infinity;
    movable.forEach(({ row, col }) => {
        const next = moveTile(board, row, col);
        if (!next) return;
        const score = manhattan(next);
        if (score < bestScore) {
            bestScore = score;
            best = { row, col };
        }
    });
    return best;
};

/* 生成一份可读的棋盘文本快照（用于调试与记录） */
export const boardToText = (board) =>
    board.map((row) => row.map((value) => (value === EMPTY ? '·' : value)).join(' ')).join('\n');
