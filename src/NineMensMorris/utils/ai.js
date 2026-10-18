import { SIZE, MILLS, ADJ, otherPlayer, legalMoves, applyMove, countPieces } from './gameLogic';

/* ============================================================
   九子棋 · 电脑对手
   easy   —— 随机为主，成三与吃子偶尔不放过
   medium —— 两层搜索：先成三、再挡对方的成三线
   hard   —— 四层 alpha-beta（含吃子延伸），兼顾子力、成三与机动性
   ============================================================ */

const WIN = 100000;
const NODE_LIMIT = 40000;
const BRANCH = 10;

function countMills(points, player) {
    let total = 0;
    for (const mill of MILLS) {
        if (mill.every((point) => points[point] === player)) total += 1;
    }
    return total;
}

/* 一条线上已有两子、第三点尚空 —— 潜在的三线数量 */
function millPotential(points, player) {
    let total = 0;
    for (const mill of MILLS) {
        let mine = 0;
        let empty = 0;
        for (const point of mill) {
            if (points[point] === player) mine += 1;
            else if (!points[point]) empty += 1;
        }
        if (mine === 2 && empty === 1) total += 1;
    }
    return total;
}

/* 可动步数（飞子阶段按空点数计） */
function mobility(points, player) {
    const empty = points.reduce((total, point) => (point ? total : total + 1), 0);
    let onBoard = 0;
    for (let i = 0; i < SIZE; i++) {
        if (points[i] === player) onBoard += 1;
    }
    const flying = onBoard === 3;
    let total = 0;
    for (let i = 0; i < SIZE; i++) {
        if (points[i] !== player) continue;
        if (flying) {
            total += empty;
        } else {
            ADJ[i].forEach((to) => {
                if (!points[to]) total += 1;
            });
        }
    }
    return total;
}

function evaluate(state, player) {
    const opponent = otherPlayer(player);
    const mine = countPieces(state, player);
    const theirs = countPieces(state, opponent);
    if (mine < 3) return -WIN;
    if (theirs < 3) return WIN;

    let score = (mine - theirs) * 8;
    score += (countMills(state.points, player) - countMills(state.points, opponent)) * 14;
    score += (millPotential(state.points, player) - millPotential(state.points, opponent)) * 4;
    if (state.phase !== 'placing') {
        score += (mobility(state.points, player) - mobility(state.points, opponent)) * 1.5;
    }
    return score;
}

/* 一步棋的快速估值，用于走法排序 */
function quickScore(state, move) {
    const child = applyMove(state, move);
    let score = evaluate(child, state.currentPlayer);
    if (child.phase === 'over') {
        if (child.winner === state.currentPlayer) score += WIN;
        else if (child.winner !== null) score -= WIN;
    }
    if (child.pendingCapture) score += 55;
    if (move.type === 'capture') score += 35;
    return score;
}

function orderMoves(state, moves) {
    if (moves.length <= 1) return moves;
    return moves
        .map((move) => ({ move, score: quickScore(state, move) }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.move);
}

function search(state, depth, alpha, beta, me, counter) {
    if (state.phase === 'over') {
        if (state.winner === me) return WIN + depth;
        if (state.winner === null) return 0;
        return -WIN - depth;
    }

    const maximizing = state.currentPlayer === me;
    const moves = legalMoves(state);
    if (moves.length === 0) return maximizing ? -WIN - depth : WIN + depth;
    if (depth <= 0) return evaluate(state, me);

    counter.nodes += 1;
    if (counter.nodes > NODE_LIMIT) return evaluate(state, me);

    const ordered = orderMoves(state, moves).slice(0, BRANCH);
    let best = maximizing ? -Infinity : Infinity;
    for (const move of ordered) {
        const value = search(applyMove(state, move), depth - 1, alpha, beta, me, counter);
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

function easyMove(state, moves) {
    if (!state.pendingCapture) {
        const forming = moves.filter((move) => applyMove(state, move).pendingCapture);
        if (forming.length && Math.random() < 0.6) {
            return forming[Math.floor(Math.random() * forming.length)];
        }
    }
    return moves[Math.floor(Math.random() * moves.length)];
}

/* ============================================================
   对外接口：返回当前局面下最合适的一手
   ============================================================ */
export function getAIMove(state, player, difficulty = 'medium') {
    const moves = legalMoves(state);
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];
    if (difficulty === 'easy') return easyMove(state, moves);

    const depth = difficulty === 'hard' ? 4 : 2;
    const branch = difficulty === 'hard' ? BRANCH : 14;
    const ordered = orderMoves(state, moves).slice(0, branch);
    const counter = { nodes: 0 };

    let best = ordered[0];
    let bestValue = -Infinity;
    let alpha = -Infinity;
    for (const move of ordered) {
        const value = search(applyMove(state, move), depth - 1, alpha, Infinity, player, counter);
        if (value > bestValue) {
            bestValue = value;
            best = move;
        }
        if (value > alpha) alpha = value;
    }
    return best;
}

export default getAIMove;
