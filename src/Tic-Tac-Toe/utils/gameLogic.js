const BOARD_SIZE = 3;

const EMPTY = 0;
const X = 1;
const O = 2;

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
    createInitialBoard,
    getValidMoves,
    makeMove,
    checkWinner,
    isGameOver
};