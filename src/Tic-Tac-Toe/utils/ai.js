import { getValidMoves, makeMove, checkWinner, X, O, EMPTY } from './gameLogic.js';

function evaluateBoard(board, player) {
    const winner = checkWinner(board);
    if (winner === player) {
        return 10;
    } else if (winner === (player === X ? O : X)) {
        return -10;
    } else {
        return 0;
    }
}

function minimax(board, depth, isMaximizing, player) {
    const opponent = player === X ? O : X;
    const currentPlayer = isMaximizing ? player : opponent;
    const validMoves = getValidMoves(board);

    const winner = checkWinner(board);
    if (winner) {
        return evaluateBoard(board, player);
    }

    if (validMoves.length === 0) {
        return 0; // 平局
    }

    if (depth === 0) {
        return evaluateBoard(board, player);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of validMoves) {
            const newBoard = makeMove(board, move.row, move.col, player);
            const evalScore = minimax(newBoard, depth - 1, false, player);
            maxEval = Math.max(maxEval, evalScore);
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of validMoves) {
            const newBoard = makeMove(board, move.row, move.col, opponent);
            const evalScore = minimax(newBoard, depth - 1, true, player);
            minEval = Math.min(minEval, evalScore);
        }
        return minEval;
    }
}

function getEasyMove(board, player) {
    const validMoves = getValidMoves(board);
    if (validMoves.length === 0) return null;
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getMediumMove(board, player) {
    const validMoves = getValidMoves(board);
    if (validMoves.length === 0) return null;

    // 检查是否有获胜的一步
    for (const move of validMoves) {
        const newBoard = makeMove(board, move.row, move.col, player);
        if (checkWinner(newBoard) === player) {
            return move;
        }
    }

    // 检查是否需要防守
    const opponent = player === X ? O : X;
    for (const move of validMoves) {
        const newBoard = makeMove(board, move.row, move.col, opponent);
        if (checkWinner(newBoard) === opponent) {
            return move;
        }
    }

    // 否则随机选择
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getHardMove(board, player) {
    const validMoves = getValidMoves(board);
    if (validMoves.length === 0) return null;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of validMoves) {
        const newBoard = makeMove(board, move.row, move.col, player);
        const score = minimax(newBoard, 5, false, player);
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