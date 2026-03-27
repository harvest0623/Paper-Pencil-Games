import { getValidMoves, makeMove, countPieces, BLACK, WHITE, BOARD_SIZE } from './gameLogic.js';

const CORNER_WEIGHT = 100;
const EDGE_WEIGHT = 10;
const CORNER_ADJACENT_WEIGHT = -50;

const POSITION_WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, 1, 1, 1, 1, -2, 10],
    [5, -2, 1, 1, 1, 1, -2, 5],
    [5, -2, 1, 1, 1, 1, -2, 5],
    [10, -2, 1, 1, 1, 1, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100]
];

function evaluateBoard(board, player) {
    let score = 0;
    const opponent = player === BLACK ? WHITE : BLACK;

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === player) {
                score += POSITION_WEIGHTS[row][col];
            } else if (board[row][col] === opponent) {
                score -= POSITION_WEIGHTS[row][col];
            }
        } 
    }

    return score;
}

function minimax(board, depth, isMaximizing, player, alpha, beta) {
    const opponent = player === BLACK ? WHITE : BLACK;
    const currentPlayer = isMaximizing ? player : opponent;
    const validMoves = getValidMoves(board, currentPlayer);

    if (depth === 0 || validMoves.length === 0) {
        return evaluateBoard(board, player);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of validMoves) {
            const newBoard = makeMove(board, move.row, move.col, player);
            const evalScore = minimax(newBoard, depth - 1, false, player, alpha, beta);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of validMoves) {
            const newBoard = makeMove(board, move.row, move.col, opponent);
            const evalScore = minimax(newBoard, depth - 1, true, player, alpha, beta);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getEasyMove(board, player) {
    const validMoves = getValidMoves(board, player);
    if (validMoves.length === 0) return null;
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getMediumMove(board, player) {
    const validMoves = getValidMoves(board, player);
    if (validMoves.length === 0) return null;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of validMoves) {
        const newBoard = makeMove(board, move.row, move.col, player);
        const score = evaluateBoard(newBoard, player);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

  return bestMove;
}

function getHardMove(board, player) {
    const validMoves = getValidMoves(board, player);
    if (validMoves.length === 0) return null;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of validMoves) {
        const newBoard = makeMove(board, move.row, move.col, player);
        const score = minimax(newBoard, 4, false, player, -Infinity, Infinity);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

  return bestMove;
}

function getAIMove(board, player, difficulty) {
    switch (difficulty) {
        case 'easy':
            return getEasyMove(board, player);
        case 'medium':
            return getMediumMove(board, player);
        case 'hard':
            return getHardMove(board, player);
        default:
            return getEasyMove(board, player);
    }
}

export { getAIMove };