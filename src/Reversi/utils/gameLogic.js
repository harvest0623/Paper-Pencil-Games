const BOARD_SIZE = 8;

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

function createInitialBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    const mid = BOARD_SIZE / 2;
    board[mid - 1][mid - 1] = WHITE;
    board[mid - 1][mid] = BLACK;
    board[mid][mid - 1] = BLACK;
    board[mid][mid] = WHITE;
    return board;
}

function isValidPosition(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getFlippedPieces(board, row, col, player) {
    if (board[row][col] !== EMPTY) return [];

    const opponent = player === BLACK ? WHITE : BLACK;
    const allFlipped = [];

    for (const [dr, dc] of DIRECTIONS) {
        const flippedInDirection = [];
        let r = row + dr;
        let c = col + dc;

        while (isValidPosition(r, c) && board[r][c] === opponent) {
            flippedInDirection.push([r, c]);
            r += dr;
            c += dc;
        }

        if (isValidPosition(r, c) && board[r][c] === player && flippedInDirection.length > 0) {
            allFlipped.push(...flippedInDirection);
        }
    }

    return allFlipped;
}

function getValidMoves(board, player) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (getFlippedPieces(board, row, col, player).length > 0) {
                moves.push({ row, col });
            }
        }
    }
    return moves;
}

function makeMove(board, row, col, player) {
    const flipped = getFlippedPieces(board, row, col, player);
    if (flipped.length === 0) return null;

    const newBoard = board.map(row => [...row]);
    newBoard[row][col] = player;
    for (const [r, c] of flipped) {
        newBoard[r][c] = player;
    }
    return newBoard;
}

function countPieces(board) {
    let black = 0;
    let white = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === BLACK) black++;
            else if (board[row][col] === WHITE) white++;
        }
    }
    return { black, white };
}

function isGameOver(board) {
    const blackMoves = getValidMoves(board, BLACK).length;
    const whiteMoves = getValidMoves(board, WHITE).length;
    return blackMoves === 0 && whiteMoves === 0;
}

export {
    BOARD_SIZE,
    EMPTY,
    BLACK,
    WHITE,
    createInitialBoard,
    getValidMoves,
    makeMove,
    countPieces,
    isGameOver,
    getFlippedPieces
};