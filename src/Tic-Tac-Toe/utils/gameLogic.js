const BOARD_SIZE = 3;

const EMPTY = 0;
const X = 1;
const O = 2;

const COLUMN_LABELS = ['A', 'B', 'C'];

/* 行列转坐标标签，例如 A1 */
function coordLabel(row, col) {
    return `${COLUMN_LABELS[col]}${row + 1}`;
}

/* 返回获胜的三个格子，若无则返回空数组 */
const LINES = [
    [0, 0, 0, 1, 0, 2],
    [1, 0, 1, 1, 1, 2],
    [2, 0, 2, 1, 2, 2],
    [0, 0, 1, 0, 2, 0],
    [0, 1, 1, 1, 2, 1],
    [0, 2, 1, 2, 2, 2],
    [0, 0, 1, 1, 2, 2],
    [0, 2, 1, 1, 2, 0]
];

function getWinningCells(board) {
    for (const [r1, c1, r2, c2, r3, c3] of LINES) {
        const value = board[r1][c1];
        if (value !== EMPTY && value === board[r2][c2] && value === board[r3][c3]) {
            return [
                { row: r1, col: c1 },
                { row: r2, col: c2 },
                { row: r3, col: c3 }
            ];
        }
    }
    return [];
}

function createInitialBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
}

function isValidPosition(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getValidMoves(board) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === EMPTY) {
                moves.push({ row, col });
            }
        }
    }
    return moves;
}

function makeMove(board, row, col, player) {
    if (!isValidPosition(row, col) || board[row][col] !== EMPTY) {
        return null;
    }

    const newBoard = board.map(row => [...row]);
    newBoard[row][col] = player;
    return newBoard;
}

function checkWinner(board) {
    // 检查行
    for (let row = 0; row < BOARD_SIZE; row++) {
        if (board[row][0] !== EMPTY && board[row][0] === board[row][1] && board[row][0] === board[row][2]) {
            return board[row][0];
        }
    }

    // 检查列
    for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[0][col] !== EMPTY && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
            return board[0][col];
        }
    }

    // 检查对角线
    if (board[0][0] !== EMPTY && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
        return board[0][0];
    }

    if (board[0][2] !== EMPTY && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
        return board[0][2];
    }

    return null;
}

function isGameOver(board) {
    const winner = checkWinner(board);
    if (winner) return true;

    // 检查是否平局（棋盘已满）
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === EMPTY) {
                return false;
            }
        }
    }

    return true;
}

export {
    BOARD_SIZE,
    EMPTY,
    X,
    O,
    COLUMN_LABELS,
    coordLabel,
    getWinningCells,
    createInitialBoard,
    getValidMoves,
    makeMove,
    checkWinner,
    isGameOver
};