/* ============================================================
   超级井字棋 · 电脑 AI
   简单：带随机性的贪心（立即赢下子棋盘 / 封堵）
   中等 / 困难：Minimax + Alpha-Beta（走法排序 + 节点数与耗时上限）
   ============================================================ */

import { EMPTY, X, O, DRAW, otherPlayer } from './gameLogic.js';

/* 子棋盘内八条连线（格子下标 0..8，行优先） */
const LOCAL_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

/* 大棋盘八条连线（子棋盘下标 0..8） */
const BIG_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

/* 每个子棋盘所属的大连线，用于快速判断整局连线 */
const BIG_LINES_BY_SUB = Array.from({ length: 9 }, () => []);
for (const line of BIG_LINES) {
    for (const sub of line) BIG_LINES_BY_SUB[sub].push(line);
}

/* 静态偏好：中心格 / 角 / 边，以及中心子棋盘 */
const CELL_BIAS = [3, 2, 3, 2, 4, 2, 3, 2, 3];
const SUB_BIAS = [1, 2, 1, 2, 4, 2, 1, 2, 1];

const WIN_SCORE = 1000000;

const CONFIG = {
    medium: { maxDepth: 3, timeLimit: 320, nodeLimit: 60000 },
    hard: { maxDepth: 7, timeLimit: 700, nodeLimit: 800000 }
};

/* ---------------- 内部扁平表示（board: 81 格，subs: 9 子棋盘） ---------------- */

function buildPos(state) {
    const board = new Int8Array(81);
    for (let sub = 0; sub < 9; sub++) {
        const cells = state.board[sub];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                board[sub * 9 + row * 3 + col] = cells[row][col];
            }
        }
    }
    const subs = new Int8Array(9);
    for (let sub = 0; sub < 9; sub++) subs[sub] = state.subWinners[sub];
    return {
        board,
        subs,
        forced: state.forcedSub === null || state.forcedSub === undefined ? -1 : state.forcedSub
    };
}

function decodeMove(move) {
    const sub = (move / 9) | 0;
    const cell = move % 9;
    return { sub, row: (cell / 3) | 0, col: cell % 3 };
}

function subFull(board, sub) {
    const base = sub * 9;
    for (let i = 0; i < 9; i++) {
        if (board[base + i] === EMPTY) return false;
    }
    return true;
}

function localWinnerOf(board, sub) {
    const base = sub * 9;
    for (const line of LOCAL_LINES) {
        const value = board[base + line[0]];
        if (
            value !== EMPTY &&
            value === board[base + line[1]] &&
            value === board[base + line[2]]
        ) {
            return value;
        }
    }
    return EMPTY;
}

function bigLineWin(subs, sub, player) {
    for (const line of BIG_LINES_BY_SUB[sub]) {
        if (subs[line[0]] === player && subs[line[1]] === player && subs[line[2]] === player) {
            return true;
        }
    }
    return false;
}

function legalMoves(pos) {
    const { board, subs, forced } = pos;
    const moves = [];
    if (forced >= 0) {
        const base = forced * 9;
        for (let i = 0; i < 9; i++) {
            if (board[base + i] === EMPTY) moves.push(base + i);
        }
        return moves;
    }
    for (let sub = 0; sub < 9; sub++) {
        if (subs[sub] !== EMPTY) continue;
        const base = sub * 9;
        for (let i = 0; i < 9; i++) {
            if (board[base + i] === EMPTY) moves.push(base + i);
        }
    }
    return moves;
}

function makeMove(pos, move, player) {
    const { board, subs } = pos;
    const sub = (move / 9) | 0;
    const prevSub = subs[sub];
    board[move] = player;

    const localWinner = localWinnerOf(board, sub);
    let bigWin = false;
    if (localWinner === player) {
        subs[sub] = player;
        bigWin = bigLineWin(subs, sub, player);
    } else if (subFull(board, sub)) {
        subs[sub] = DRAW;
    } else {
        subs[sub] = EMPTY;
    }

    const cell = move % 9;
    const target = ((cell / 3) | 0) * 3 + (cell % 3);
    const prevForced = pos.forced;
    pos.forced = bigWin ? -1 : subs[target] === EMPTY ? target : -1;
    pos.player = otherPlayer(player);

    return { sub, prevSub, prevForced, bigWin };
}

function unmakeMove(pos, move, undo) {
    pos.board[move] = EMPTY;
    pos.subs[undo.sub] = undo.prevSub;
    pos.forced = undo.prevForced;
    pos.player = otherPlayer(pos.player);
}

/* ---------------- 评估函数（站在 player 视角） ---------------- */

function evaluate(board, subs, player) {
    const opp = otherPlayer(player);
    let score = 0;
    let pSubs = 0;
    let oSubs = 0;
    for (let sub = 0; sub < 9; sub++) {
        if (subs[sub] === player) pSubs++;
        else if (subs[sub] === opp) oSubs++;
    }
    score += (pSubs - oSubs) * 280;

    /* 大棋盘连线潜力 */
    for (const line of BIG_LINES) {
        let p = 0;
        let o = 0;
        for (const sub of line) {
            if (subs[sub] === player) p++;
            else if (subs[sub] === opp) o++;
        }
        if (p > 0 && o > 0) continue;
        const open = 3 - p - o;
        if (p === 2 && open === 1) score += 240;
        else if (p === 1 && open === 2) score += 30;
        else if (o === 2 && open === 1) score -= 240;
        else if (o === 1 && open === 2) score -= 30;
    }

    /* 未结束子棋盘内的局部形势 */
    for (let sub = 0; sub < 9; sub++) {
        if (subs[sub] !== EMPTY) continue;
        const base = sub * 9;
        for (const line of LOCAL_LINES) {
            let p = 0;
            let o = 0;
            for (const i of line) {
                const value = board[base + i];
                if (value === player) p++;
                else if (value === opp) o++;
            }
            if (p > 0 && o > 0) continue;
            if (p === 2) score += 8;
            else if (o === 2) score -= 8;
        }
    }

    /* 中心子棋盘的归属 */
    if (subs[4] === player) score += 25;
    else if (subs[4] === opp) score -= 25;

    return score;
}

/* ---------------- 走法排序 ---------------- */

function moveScore(pos, move, player, opp) {
    const board = pos.board;
    const sub = (move / 9) | 0;
    const cell = move % 9;
    const base = sub * 9;
    let score = CELL_BIAS[cell] * 4 + SUB_BIAS[sub];

    let ownTwo = 0;
    let oppTwo = false;
    for (const line of LOCAL_LINES) {
        if (!line.includes(cell)) continue;
        let p = 0;
        let o = 0;
        for (const i of line) {
            if (i === cell) continue;
            const value = board[base + i];
            if (value === player) p++;
            else if (value === opp) o++;
        }
        if (p === 2) ownTwo = 2;
        else if (p === 1) ownTwo = Math.max(ownTwo, 1);
        if (o === 2) oppTwo = true;
    }
    if (ownTwo === 2) score += 100000;
    else if (ownTwo === 1) score += 60;
    if (oppTwo) score += 20000;
    return score;
}

function orderMoves(pos, moves, player) {
    const opp = otherPlayer(player);
    return moves
        .map((move) => ({ move, score: moveScore(pos, move, player, opp) }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.move);
}

/* ---------------- 搜索 ---------------- */

function negamax(ctx, pos, player, depth, alpha, beta, ply) {
    if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
        ctx.aborted = true;
        return 0;
    }
    ctx.nodes++;
    if (ctx.nodes > ctx.nodeLimit) {
        ctx.aborted = true;
        return 0;
    }

    const moves = legalMoves(pos);
    if (moves.length === 0) return 0;
    if (depth <= 0) return evaluate(pos.board, pos.subs, player);

    const ordered = ply <= 1 ? orderMoves(pos, moves, player) : moves;
    let best = -Infinity;
    for (const move of ordered) {
        const undo = makeMove(pos, move, player);
        const score = undo.bigWin
            ? WIN_SCORE - ply
            : -negamax(ctx, pos, otherPlayer(player), depth - 1, -beta, -alpha, ply + 1);
        unmakeMove(pos, move, undo);

        if (ctx.aborted) return best === -Infinity ? 0 : best;
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
    }
    return best;
}

function searchMove(state, player, opts) {
    const ctx = {
        nodes: 0,
        deadline: Date.now() + opts.timeLimit,
        nodeLimit: opts.nodeLimit,
        aborted: false
    };
    const pos = buildPos(state);
    const moves = legalMoves(pos);
    if (moves.length === 0) return null;

    /* 能直接赢下整局就立刻收下 */
    for (const move of moves) {
        const undo = makeMove(pos, move, player);
        const wins = undo.bigWin;
        unmakeMove(pos, move, undo);
        if (wins) return decodeMove(move);
    }

    let ordered = orderMoves(pos, moves, player);
    let best = ordered[0];

    for (let depth = 1; depth <= opts.maxDepth; depth++) {
        let localBest = null;
        let localBestScore = -Infinity;
        let alpha = -Infinity;
        let complete = true;

        for (const move of ordered) {
            const undo = makeMove(pos, move, player);
            const score = undo.bigWin
                ? WIN_SCORE
                : -negamax(ctx, pos, otherPlayer(player), depth - 1, -Infinity, -alpha, 1);
            unmakeMove(pos, move, undo);

            if (ctx.aborted) {
                complete = false;
                break;
            }
            if (score > localBestScore) {
                localBestScore = score;
                localBest = move;
                alpha = score;
            }
        }

        if (complete && localBest !== null) {
            best = localBest;
            ordered = [best, ...ordered.filter((move) => move !== best)];
        }
        if (ctx.aborted) break;
        if (complete && localBestScore >= WIN_SCORE / 2) break;
        if (Date.now() > ctx.deadline) break;
    }

    return decodeMove(best);
}

/* ---------------- 简单档：带随机性的贪心 ---------------- */

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function easyMove(state, player) {
    const pos = buildPos(state);
    const moves = legalMoves(pos);
    if (moves.length === 0) return null;
    const opp = otherPlayer(player);

    const wins = [];
    const blocks = [];
    for (const move of moves) {
        const sub = (move / 9) | 0;

        let undo = makeMove(pos, move, player);
        const canWin = undo.bigWin || pos.subs[sub] === player;
        unmakeMove(pos, move, undo);

        undo = makeMove(pos, move, opp);
        const mustBlock = undo.bigWin || pos.subs[sub] === opp;
        unmakeMove(pos, move, undo);

        if (canWin) wins.push(move);
        else if (mustBlock) blocks.push(move);
    }

    if (wins.length && Math.random() < 0.9) return decodeMove(pick(wins));
    if (blocks.length && Math.random() < 0.75) return decodeMove(pick(blocks));

    const attractive = moves.filter((move) => CELL_BIAS[move % 9] >= 3);
    const pool = attractive.length && Math.random() < 0.7 ? attractive : moves;
    return decodeMove(pick(pool));
}

function getAIMove(state, player, difficulty = 'medium') {
    if (!player) return null;
    if (difficulty === 'easy') return easyMove(state, player);
    const opts = CONFIG[difficulty] || CONFIG.medium;
    return searchMove(state, player, opts);
}

export { getAIMove, evaluate };