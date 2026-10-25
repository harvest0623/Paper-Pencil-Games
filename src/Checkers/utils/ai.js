/* ============================================================
   西洋跳棋 · 电脑对手
   easy   —— 随机落子，偶尔挑一条更长的吃子路线
   medium —— 两层搜索，优先吃子与升王
   hard   —— 四层 alpha-beta，兼顾子力、升王进度与站位
   ============================================================ */

import { SIZE, getLegalMoves, applyMove, rowOf, colOf } from './gameLogic';

const WIN = 100000;
const NODE_LIMIT = 22000;
const BRANCH = 12;

const MAN_VALUE = 100;
const KING_VALUE = 178;

/* ---------------- 局面评估 ---------------- */
const evaluate = (state, me) => {
    if (state.winner) return state.winner === me ? WIN : -WIN;
    if (state.draw) return 0;

    const board = state.board;
    let score = 0;

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        if (!piece) continue;

        const sign = piece.player === me ? 1 : -1;
        const row = rowOf(index);
        const col = colOf(index);

        if (piece.king) {
            score += sign * KING_VALUE;
            /* 王在中路更具控制力 */
            if (col >= 2 && col <= 5) score += sign * 8;
            continue;
        }

        score += sign * MAN_VALUE;

        /* 越接近升王线越有价值 */
        const advance = piece.player === 'blue' ? SIZE - 1 - row : row;
        score += sign * advance * 6;

        /* 守住自己底线，可以延缓对手升王 */
        const backRow = piece.player === 'blue' ? SIZE - 1 : 0;
        if (row === backRow) score += sign * 10;

        /* 中路与边线的位置价值 */
        if (col >= 2 && col <= 5) score += sign * 4;
        if (col === 0 || col === SIZE - 1) score += sign * 3;
    }

    return score;
};

/* ---------------- 走法估值与排序 ---------------- */
const quickScore = (state, move) => {
    const child = applyMove(state, move);
    let score = evaluate(child, state.turn);
    score += move.captures.length * 16;
    if (move.kinged) score += 24;
    return score;
};

const orderMoves = (state, moves) => {
    if (moves.length <= 1) return moves;
    return moves
        .map((move) => ({ move, score: quickScore(state, move) }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.move);
};

/* ---------------- alpha-beta ---------------- */
function search(state, depth, alpha, beta, me, counter) {
    if (state.winner) return state.winner === me ? WIN + depth : -WIN - depth;
    if (state.draw) return 0;

    const moves = getLegalMoves(state);
    if (moves.length === 0) {
        return state.turn === me ? -WIN - depth : WIN + depth;
    }
    if (depth <= 0) return evaluate(state, me);

    counter.nodes += 1;
    if (counter.nodes > NODE_LIMIT) return evaluate(state, me);

    const maximizing = state.turn === me;
    const ordered = orderMoves(state, moves).slice(0, BRANCH);
    let best = maximizing ? -Infinity : Infinity;

    for (const move of ordered) {
        const value = search(
            applyMove(state, move),
            depth - 1,
            alpha,
            beta,
            me,
            counter
        );
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
}

/* ---------------- 简单档 ---------------- */
const easyMove = (moves) => {
    if (Math.random() < 0.4) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    const scored = moves.map((move) => ({
        move,
        score: move.captures.length * 10 + (move.kinged ? 8 : 0)
    }));
    const best = Math.max(...scored.map((item) => item.score));
    const top = scored.filter((item) => item.score === best);
    return top[Math.floor(Math.random() * top.length)].move;
};

/* ---------------- 对外接口 ---------------- */
export function getAIMove(state, player, difficulty = 'medium') {
    const moves = getLegalMoves(state, player);
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];
    if (difficulty === 'easy') return easyMove(moves);

    const depth = difficulty === 'hard' ? 4 : 2;
    const branch = difficulty === 'hard' ? BRANCH : 14;
    const ordered = orderMoves(state, moves).slice(0, branch);
    const counter = { nodes: 0 };

    let best = ordered[0];
    let bestValue = -Infinity;
    let alpha = -Infinity;

    for (const move of ordered) {
        const value = search(
            applyMove(state, move),
            depth - 1,
            alpha,
            Infinity,
            player,
            counter
        );
        if (value > bestValue) {
            bestValue = value;
            best = move;
        }
        if (value > alpha) alpha = value;
    }

    return best;
}

export const findHint = (state, player) => getAIMove(state, player, 'hard');
