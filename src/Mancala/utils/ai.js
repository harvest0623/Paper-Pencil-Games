/* ============================================================
   曼卡拉 AI
   ------------------------------------------------------------
   简单  —— 带随机性的贪心（优先额外回合与捕获，再随机挑一个）
   中等  —— Minimax + Alpha-Beta 剪枝（深度 5）
   困难  —— Minimax + Alpha-Beta 剪枝，搜索更深（深度 9）
   搜索过程中正确考虑「额外回合」（落进己方宝库后仍由同一方行动）。
   ============================================================ */

import {
    pitsOf,
    storeOf,
    otherPlayer,
    getValidMoves,
    applyMove,
    isGameOver,
    sweepRemaining
} from './gameLogic.js';

const WIN_SCORE = 100000;

/* 中间局面的启发式评估：站在 player 视角，宝库差 + 坑内潜力差 */
const evaluate = (board, player) => {
    const opp = otherPlayer(player);
    const storeDiff = board[storeOf(player)] - board[storeOf(opp)];

    let mine = 0;
    let theirs = 0;
    for (const pit of pitsOf(player)) mine += board[pit];
    for (const pit of pitsOf(opp)) theirs += board[pit];

    return storeDiff * 8 + (mine - theirs) * 1.2;
};

/* 终局评估：清坑后按宝库差值给分，胜负给极大的正负分 */
const terminalScore = (board, player) => {
    const finalBoard = sweepRemaining(board);
    const diff = finalBoard[storeOf(player)] - finalBoard[storeOf(otherPlayer(player))];
    if (diff > 0) return diff * 100 + WIN_SCORE;
    if (diff < 0) return diff * 100 - WIN_SCORE;
    return 0;
};

/* 单步即时收益：宝库增量 + 捕获量 + 额外回合奖励 */
const moveGain = (board, pit, player) => {
    const res = applyMove(board, pit);
    if (!res) return -Infinity;
    const store = storeOf(player);
    let score = (res.board[store] - board[store]) * 3 + res.captured * 2;
    if (res.extraTurn) score += 1.5;
    return score;
};

/* 走法排序：收益高的优先，提升 Alpha-Beta 剪枝效率 */
const orderMoves = (board, moves, player) =>
    moves
        .map((pit) => ({ pit, gain: moveGain(board, pit, player) }))
        .sort((a, b) => b.gain - a.gain)
        .map((item) => item.pit);

const minimax = (board, depth, current, aiPlayer, alpha, beta) => {
    if (isGameOver(board)) return terminalScore(board, aiPlayer);
    if (depth === 0) return evaluate(board, aiPlayer);

    const moves = getValidMoves(board, current);
    if (moves.length === 0) {
        return minimax(board, depth - 1, otherPlayer(current), aiPlayer, alpha, beta);
    }

    const maximizing = current === aiPlayer;
    const ordered = orderMoves(board, moves, current);

    let best = maximizing ? -Infinity : Infinity;
    for (const pit of ordered) {
        const res = applyMove(board, pit);
        const nextPlayer = res.extraTurn ? current : otherPlayer(current);
        const value = minimax(res.board, depth - 1, nextPlayer, aiPlayer, alpha, beta);

        if (maximizing) {
            if (value > best) best = value;
            if (best > alpha) alpha = best;
        } else {
            if (value < best) best = value;
            if (best < beta) beta = best;
        }
        if (beta <= alpha) break;
    }
    return best;
};

const easyMove = (board, player, moves) => {
    const scored = moves
        .map((pit) => ({
            pit,
            score: moveGain(board, pit, player) + Math.random() * 2.4
        }))
        .sort((a, b) => b.score - a.score);

    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].pit;
};

const searchMove = (board, player, depth) => {
    const moves = getValidMoves(board, player);
    if (moves.length === 0) return null;

    const ordered = orderMoves(board, moves, player);
    let bestPit = ordered[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;

    for (const pit of ordered) {
        const res = applyMove(board, pit);
        const nextPlayer = res.extraTurn ? player : otherPlayer(player);
        const value = minimax(res.board, depth - 1, nextPlayer, player, alpha, Infinity);
        if (value > bestScore) {
            bestScore = value;
            bestPit = pit;
        }
        if (value > alpha) alpha = value;
    }
    return bestPit;
};

/**
 * 计算电脑落子
 * @param {number[]} board 当前棋盘（长度 14）
 * @param {number} player 电脑执子（PLAYER_1 / PLAYER_2）
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {number|null} 建议播种的坑位下标
 */
export const getAIMove = (board, player, difficulty = 'medium') => {
    const moves = getValidMoves(board, player);
    if (moves.length === 0) return null;

    if (difficulty === 'easy') return easyMove(board, player, moves);
    return searchMove(board, player, difficulty === 'hard' ? 9 : 5);
};