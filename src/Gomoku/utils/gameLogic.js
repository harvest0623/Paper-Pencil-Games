/* ============================================================
   五子棋核心逻辑
   ============================================================ */

export const BOARD_SIZE = 15;

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

/* A ~ O */
export const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
    String.fromCharCode(65 + i)
);

/* 星位（天元与四隅） */
export const STAR_POINTS = [
    [3, 3],
    [3, 11],
    [11, 3],
    [11, 11],
    [7, 7]
];

/* 四个方向：横、竖、主对角、副对角 */
const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
];

export const inBounds = (row, col) =>
    row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

export const createEmptyBoard = () =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));

export const otherPlayer = (player) => (player === BLACK ? WHITE : BLACK);

/* 落子（返回新棋盘，不修改原对象） */
export const placeStone = (board, row, col, player) => {
    if (!inBounds(row, col) || board[row][col] !== EMPTY) return board;
    const next = board.map((line) => line.slice());
    next[row][col] = player;
    return next;
};

export const isBoardFull = (board) =>
    board.every((line) => line.every((cell) => cell !== EMPTY));

export const countStones = (board) => {
    let black = 0;
    let white = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const v = board[row][col];
            if (v === BLACK) black++;
            else if (v === WHITE) white++;
        }
    }
    return { black, white };
};

/**
 * 判断在 (row, col) 落子后是否连成五子
 * @returns {Array<{row:number,col:number}>|null} 连成一线的棋子坐标，未连成返回 null
 */
export const checkWin = (board, row, col) => {
    const player = board[row][col];
    if (player === EMPTY) return null;

    for (const [dr, dc] of DIRECTIONS) {
        const line = [{ row, col }];

        // 正方向延伸
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c) && board[r][c] === player) {
            line.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        // 反方向延伸
        r = row - dr;
        c = col - dc;
        while (inBounds(r, c) && board[r][c] === player) {
            line.unshift({ row: r, col: c });
            r -= dr;
            c -= dc;
        }

        if (line.length >= 5) return line;
    }

    return null;
};

/* 是否存在五子连线（仅判定胜负，不返回坐标） */
export const hasFive = (board, row, col) => checkWin(board, row, col) !== null;

/* 坐标标签，如 H8 */
export const coordLabel = (row, col) => `${COLUMN_LABELS[col]}${row + 1}`;