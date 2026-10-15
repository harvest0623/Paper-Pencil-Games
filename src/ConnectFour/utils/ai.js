import {
    ROWS,
    COLS,
    CONNECT,
    EMPTY,
    RED,
    YELLOW,
    otherPlayer,
    getValidColumns,
    makeMove,
    getWinningCells
} from './gameLogic';

/* 评估分值：胜负极大，三连、二连依次递减 */
const SCORE_WIN = 1e7;
const SCORE_THREE = 120;
const SCORE_TWO = 14;
const SCORE_ONE = 1;

/* 预先枚举所有长度为 4 的窗口（横、竖、两条斜线） */
function collectWindows() {
    const windows = [];
    const push = (cells) => windows.push(cells);
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col + CONNECT <= COLS; col++) {
            push(Array.from({ length: CONNECT }, (_, k) => [row, col + k]));
        }
    }
    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row + CONNECT <= ROWS; row++) {
            push(Array.from({ length: CONNECT }, (_, k) => [row + k, col]));
        }
    }
    for (let row = 0; row + CONNECT <= ROWS; row++) {
        for (let col = 0; col + CONNECT <= COLS; col++) {
            push(Array.from({ length: CONNECT }, (_, k) => [row + k, col + k]));
        }
    }
    for (let row = 0; row + CONNECT <= ROWS; row++) {
        for (let col = CONNECT - 1; col < COLS; col++) {
            push(Array.from({ length: CONNECT }, (_, k) => [row + k, col - k]));
        }
    }
    return windows;
}

const WINDOWS = collectWindows();
const CENTER_COL = Math.floor(COLS / 2);

/* 局面评估：以 player 为视角，累加所有窗口的态势分 */
function evaluate(board, player) {
    const opponent = otherPlayer(player);
    let score = 0;

    for (let i = 0; i < WINDOWS.length; i++) {
        const window = WINDOWS[i];
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < CONNECT; k++) {
            const value = board[window[k][0]][window[k][1]];
            if (value === player) mine += 1;
            else if (value === opponent) theirs += 1;
        }
        if (mine && theirs) continue;
        if (mine === 4) score += SCORE_WIN;
        else if (theirs === 4) score -= SCORE_WIN;
        else if (mine === 3) score += SCORE_THREE;
        else if (theirs === 3) score -= SCORE_THREE;
        else if (mine === 2) score += SCORE_TWO;
        else if (theirs === 2) score -= SCORE_TWO;
        else if (mine === 1) score += SCORE_ONE;
        else if (theirs === 1) score -= SCORE_ONE;
    }

    /* 中心列更灵活，给予轻微偏好 */
    for (let row = 0; row < ROWS; row++) {
        if (board[row][CENTER_COL] === player) score += 4;
        else if (board[row][CENTER_COL] === opponent) score -= 4;
    }

    return score;
}

/* 走法排序：越靠近中心越先搜索，提高剪枝效率 */
function orderColumns(cols) {
    return [...cols].sort((a, b) => Math.abs(a - CENTER_COL) - Math.abs(b - CENTER_COL));
}

/* 找出一步制胜的列，没有则返回 -1 */
function findWinningColumn(board, player) {
    for (const col of getValidColumns(board)) {
        const move = makeMove(board, col, player);
        if (move && getWinningCells(move.board).length) return col;
    }
    return -1;
}

/* 极大极小 + Alpha-Beta 剪枝，返回以 player 为视角的分值 */
function minimax(board, depth, alpha, beta, maximizing, player, counter) {
    const opponent = otherPlayer(player);
    const win = getWinningCells(board);
    if (win.length) {
        const winner = board[win[0].row][win[0].col];
        return winner === player ? SCORE_WIN + depth * 100 : -SCORE_WIN - depth * 100;
    }

    const valid = getValidColumns(board);
    if (valid.length === 0) return 0;
    if (depth === 0) return evaluate(board, player);

    counter.nodes += 1;
    /* 安全阀：节点过多时直接返回评估值，避免卡住界面 */
    if (counter.nodes > counter.limit) return evaluate(board, player);

    if (maximizing) {
        let best = -Infinity;
        for (const col of orderColumns(valid)) {
            const move = makeMove(board, col, player);
            best = Math.max(best, minimax(move.board, depth - 1, alpha, beta, false, player, counter));
            alpha = Math.max(alpha, best);
            if (alpha >= beta) break;
        }
        return best;
    }

    let best = Infinity;
    for (const col of orderColumns(valid)) {
        const move = makeMove(board, col, opponent);
        best = Math.min(best, minimax(move.board, depth - 1, alpha, beta, true, player, counter));
        beta = Math.min(beta, best);
        if (alpha >= beta) break;
    }
    return best;
}

/* 在给定深度下搜索最优列 */
function searchBestColumn(board, player, depth, limit) {
    const valid = getValidColumns(board);
    if (valid.length === 0) return null;

    let bestCol = valid[0];
    let bestScore = -Infinity;
    const counter = { nodes: 0, limit };

    for (const col of orderColumns(valid)) {
        const move = makeMove(board, col, player);
        const score = minimax(move.board, depth - 1, -Infinity, Infinity, false, player, counter);
        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }
    return bestCol;
}

function getEasyMove(board, player) {
    const valid = getValidColumns(board);
    if (valid.length === 0) return null;
    if (Math.random() < 0.7) {
        const win = findWinningColumn(board, player);
        if (win !== -1) return win;
    }
    if (Math.random() < 0.35) {
        const block = findWinningColumn(board, otherPlayer(player));
        if (block !== -1) return block;
    }
    return valid[Math.floor(Math.random() * valid.length)];
}

function getMediumMove(board, player) {
    if (getValidColumns(board).length === 0) return null;

    const win = findWinningColumn(board, player);
    if (win !== -1) return win;
    const block = findWinningColumn(board, otherPlayer(player));
    if (block !== -1) return block;

    return searchBestColumn(board, player, 4, 200000);
}

function getHardMove(board, player) {
    if (getValidColumns(board).length === 0) return null;

    const win = findWinningColumn(board, player);
    if (win !== -1) return win;
    const block = findWinningColumn(board, otherPlayer(player));
    if (block !== -1) return block;

    return searchBestColumn(board, player, 7, 600000);
}

/* 对外入口：返回列号（0..6），无合法落点返回 null */
function getAIMove(board, player, difficulty) {
    switch (difficulty) {
        case 'easy':
            return getEasyMove(board, player);
        case 'hard':
            return getHardMove(board, player);
        case 'medium':
        default:
            return getMediumMove(board, player);
    }
}

export { getAIMove, RED, YELLOW, EMPTY };
