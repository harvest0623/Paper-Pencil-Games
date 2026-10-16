import {
    DOTS,
    BOXES,
    EMPTY,
    otherPlayer,
    getLegalMoves,
    applyMove,
    adjacentBoxes,
    boxSideCount,
    countEmptyEdges
} from './gameLogic';

/* ============================================================
   点格棋 · 电脑对手
   easy   —— 随手为主，偶尔吃格
   medium —— 能吃就吃、不送三边格、被迫送格时挑最短的链
   hard   —— 在 medium 基础上，剩余线 ≤ 10 时做残局精确搜索
   ============================================================ */

const ENDGAME_LIMIT = 10;
const NODE_LIMIT = 200000;

/* 画上这条线能立刻围住几个方格（不修改原局面） */
function captureGain(board, edge) {
    let n = 0;
    adjacentBoxes(edge).forEach(({ br, bc }) => {
        if (board.boxes[br][bc] === EMPTY && boxSideCount(board, br, bc) === 3) n += 1;
    });
    return n;
}

/* 画上这条线会不会把某个方格变成「三边已成」，也就是白送对手一格 */
function givesAway(board, edge) {
    let away = false;
    adjacentBoxes(edge).forEach(({ br, bc }) => {
        if (away || board.boxes[br][bc] !== EMPTY) return;
        if (boxSideCount(board, br, bc) + 1 === 3) away = true;
    });
    return away;
}

/* 找出当前一次能吃下最多方格的线，没有可吃的返回 null */
function findCapture(board) {
    let best = null;
    let bestGain = 0;
    getLegalMoves(board).forEach((move) => {
        const gain = captureGain(board, move);
        if (gain > bestGain) {
            bestGain = gain;
            best = move;
        }
    });
    return best;
}

/* 让 player 连续吃掉所有现成可吃的方格，返回吃到的总数 */
function greedyCapture(board, player) {
    let cur = board;
    let total = 0;
    for (;;) {
        const move = findCapture(cur);
        if (!move) break;
        const res = applyMove(cur, move, player);
        cur = res.board;
        total += res.captured.length;
    }
    return total;
}

/* 被迫送格时的代价：对手顺着这条线能连锁吃下多少格 */
function sacrificeCost(board, edge, player) {
    const res = applyMove(board, edge, player);
    if (!res) return Number.MAX_SAFE_INTEGER;
    return greedyCapture(res.board, otherPlayer(player));
}

/* 局面指纹，供残局搜索记忆化使用 */
function stateKey(board, player) {
    let key = String(player);
    for (let r = 0; r < DOTS; r++) {
        for (let c = 0; c < BOXES; c++) key += board.h[r][c];
    }
    for (let r = 0; r < BOXES; r++) {
        for (let c = 0; c < DOTS; c++) key += board.v[r][c];
    }
    for (let br = 0; br < BOXES; br++) {
        for (let bc = 0; bc < BOXES; bc++) key += board.boxes[br][bc];
    }
    return key;
}

/* 负极大值搜索：返回值表示 player 从此刻起能净胜的方格数 */
function negamax(board, player, memo, counter) {
    const key = stateKey(board, player);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const moves = getLegalMoves(board);
    if (moves.length === 0) return 0;

    counter.nodes += 1;
    if (counter.nodes > NODE_LIMIT) {
        counter.aborted = true;
        return 0;
    }

    const opponent = otherPlayer(player);
    let best = -Infinity;
    for (const move of moves) {
        const res = applyMove(board, move, player);
        const gain = res.captured.length;
        const nextPlayer = res.extraTurn ? player : opponent;
        const sub = negamax(res.board, nextPlayer, memo, counter);
        const value = nextPlayer === player ? gain + sub : gain - sub;
        if (value > best) best = value;
        if (counter.aborted) return 0;
    }

    memo.set(key, best);
    return best;
}

/* 残局穷举：返回最优的一手；搜索超限中途放弃则返回 null */
function endgameMove(board, player) {
    const moves = getLegalMoves(board);
    if (moves.length === 0) return null;

    const memo = new Map();
    const counter = { nodes: 0, aborted: false };
    const opponent = otherPlayer(player);
    let best = null;
    let bestValue = -Infinity;

    for (const move of moves) {
        const res = applyMove(board, move, player);
        const gain = res.captured.length;
        const nextPlayer = res.extraTurn ? player : opponent;
        const sub = negamax(res.board, nextPlayer, memo, counter);
        if (counter.aborted) return null;
        const value = nextPlayer === player ? gain + sub : gain - sub;
        if (value > bestValue) {
            bestValue = value;
            best = move;
        }
    }
    return best;
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function easyMove(board) {
    const moves = getLegalMoves(board);
    if (moves.length === 0) return null;
    if (Math.random() < 0.75) {
        const capture = findCapture(board);
        if (capture) return capture;
    }
    return pickRandom(moves);
}

/* 中等与困难共用的稳健走法 */
function steadyMove(board, player) {
    const moves = getLegalMoves(board);
    if (moves.length === 0) return null;

    /* 一、能吃就吃（吃格后本方继续落线） */
    const capture = findCapture(board);
    if (capture) return capture;

    /* 二、安全线优先：不会把任何方格变成三边已成 */
    const safe = moves.filter((move) => !givesAway(board, move));
    if (safe.length > 0) return pickRandom(safe);

    /* 三、只能送格：挑代价最小、也就是送给对手最短的那条链 */
    let best = moves[0];
    let bestCost = Number.MAX_SAFE_INTEGER;
    for (const move of moves) {
        const cost = sacrificeCost(board, move, player);
        if (cost < bestCost) {
            bestCost = cost;
            best = move;
        }
    }
    return best;
}

function getAIMove(board, player, difficulty) {
    if (getLegalMoves(board).length === 0) return null;

    if (difficulty === 'easy') return easyMove(board);

    if (difficulty === 'hard' && countEmptyEdges(board) <= ENDGAME_LIMIT) {
        const exact = endgameMove(board, player);
        if (exact) return exact;
    }

    return steadyMove(board, player);
}

export { getAIMove };