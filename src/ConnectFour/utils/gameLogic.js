/* ============================================================
   四子棋 · 纯逻辑层
   棋盘 7 列 × 6 行，棋子从列顶投入，落到底部或已有棋子之上
   board[row][col]：row 0 为最上一行，row ROWS-1 为最下一行
   ============================================================ */

const COLS = 7;
const ROWS = 6;
const CONNECT = 4;

const EMPTY = 0;
const RED = 1;
const YELLOW = 2;

const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/* 坐标标签，例如 D3：列字母 + 自下而上的行号 */
function coordLabel(col, row) {
    return `${COLUMN_LABELS[col]}${ROWS - row}`;
}

function otherPlayer(player) {
    return player === RED ? YELLOW : RED;
}

function createInitialBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

/* 某一列下一个可落子的行号；列已满返回 -1 */
function getDropRow(board, col) {
    if (col < 0 || col >= COLS) return -1;
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row][col] === EMPTY) return row;
    }
    return -1;
}

function canDrop(board, col) {
    return getDropRow(board, col) !== -1;
}

/* 所有仍可落子的列 */
function getValidColumns(board) {
    const cols = [];
    for (let col = 0; col < COLS; col++) {
        if (getDropRow(board, col) !== -1) cols.push(col);
    }
    return cols;
}

/* 落子：返回 { board, row }，列满或非法则返回 null */
function makeMove(board, col, player) {
    const row = getDropRow(board, col);
    if (row === -1) return null;
    const next = board.map((r) => [...r]);
    next[row][col] = player;
    return { board: next, row };
}

/* 只沿四个方向搜索即可覆盖全部连线（右、下、右下、左下） */
const DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
];

/* 返回获胜的四个格子，若无则返回空数组 */
function getWinningCells(board) {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const value = board[row][col];
            if (value === EMPTY) continue;
            for (const [dr, dc] of DIRS) {
                const cells = [];
                for (let k = 0; k < CONNECT; k++) {
                    const r = row + dr * k;
                    const c = col + dc * k;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
                    if (board[r][c] !== value) break;
                    cells.push({ row: r, col: c });
                }
                if (cells.length === CONNECT) return cells;
            }
        }
    }
    return [];
}

function checkWinner(board) {
    const cells = getWinningCells(board);
    return cells.length ? board[cells[0].row][cells[0].col] : null;
}

/* 棋盘是否已满：列自下而上填满，故只需判断最上一行 */
function isBoardFull(board) {
    return board[0].every((cell) => cell !== EMPTY);
}

function countDiscs(board, player) {
    let count = 0;
    board.forEach((r) =>
        r.forEach((cell) => {
            if (cell === player) count += 1;
        })
    );
    return count;
}

export {
    COLS,
    ROWS,
    CONNECT,
    EMPTY,
    RED,
    YELLOW,
    COLUMN_LABELS,
    coordLabel,
    otherPlayer,
    createInitialBoard,
    getDropRow,
    canDrop,
    getValidColumns,
    makeMove,
    getWinningCells,
    checkWinner,
    isBoardFull,
    countDiscs
};
