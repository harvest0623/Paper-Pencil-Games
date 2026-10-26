/* ============================================================
   暗棋 · 电脑对手
   ------------------------------------------------------------
   电脑只使用「已经翻开」的信息做判断，暗棋的颜色与棋种
   对 AI 而言同样是未知的，不会借引擎偷看底牌。

   easy   —— 多数随机，偶尔优先吃子
   medium —— 一层评估，偏好子力与吃子
   hard   —— 额外计算对手的即时反吃，做两层推演
   ============================================================ */

import {
    getLegalActions,
    applyAction,
    finalizeState,
    DIRECTIONS,
    ROWS,
    COLS,
    rowOf,
    colOf
} from './gameLogic';

const WIN = 100000;

const inBoard = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

/* ---------------- 局面评估（仅明子） ---------------- */
const evaluateFor = (state, color) => {
    if (state.winner) return state.winner === color ? WIN : -WIN;
    if (state.draw) return 0;

    const board = state.board;
    let score = 0;

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        if (!piece || !piece.revealed) continue;

        const sign = piece.color === color ? 1 : -1;
        score += sign * piece.value;

        /* 机动性：可走的空格或可吃的明子 */
        const row = rowOf(index);
        const col = colOf(index);
        let mobility = 0;
        for (const [dr, dc] of DIRECTIONS) {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (!inBoard(nextRow, nextCol)) continue;
            const neighbour = board[nextRow * COLS + nextCol];
            if (!neighbour || (neighbour.revealed && neighbour.color !== piece.color)) {
                mobility += 1;
            }
        }
        score += sign * mobility * 1.5;

        /* 将帅被对方的兵/卒贴身，非常危险 */
        if (piece.type === 'king') {
            for (const [dr, dc] of DIRECTIONS) {
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!inBoard(nextRow, nextCol)) continue;
                const neighbour = board[nextRow * COLS + nextCol];
                if (
                    neighbour &&
                    neighbour.revealed &&
                    neighbour.color !== piece.color &&
                    neighbour.type === 'soldier'
                ) {
                    score -= sign * 16;
                }
            }
        }
    }

    return score;
};

/* ---------------- 翻棋估值 ---------------- */
/* 翻棋的结果未知，只按「获得信息 + 位置」估价，绝不读取暗子身份 */
const flipScore = (state, index, color) => {
    const row = rowOf(index);
    const col = colOf(index);
    /* 以当前已知局面的评估为基准，翻棋本身不改变已明子力 */
    let score = (color ? evaluateFor(state, color) : 0) + 7;

    const isEdgeRow = row === 0 || row === ROWS - 1;
    const isEdgeCol = col === 0 || col === COLS - 1;
    if (isEdgeRow && isEdgeCol) score += 3;
    else if (isEdgeRow || isEdgeCol) score += 1;

    /* 未定色时略微偏向翻靠近中间的位置，让后续有更多接触 */
    const centerDistance = Math.abs(col - 3.5) + Math.abs(row - 1.5);
    score += (4 - centerDistance) * 0.6;

    /* 稳定但多样的打散，避免每次都翻同一格 */
    score += ((index * 7 + state.log.length * 5) % 5) * 0.8;

    return score;
};

const actionScore = (state, action, color, difficulty) => {
    if (action.kind === 'flip') {
        return flipScore(state, action.to, color);
    }

    const child = finalizeState(applyAction(state, action));
    if (child.winner) {
        return child.winner === color ? WIN : -WIN;
    }
    if (child.draw) return 0;

    let score = evaluateFor(child, color);
    if (action.kind === 'capture') score += 12;

    if (difficulty === 'hard' && child.currentPlayer !== null) {
        const replies = getLegalActions(child, child.currentPlayer).filter(
            (reply) => reply.kind === 'capture'
        );
        let worst = score;
        for (const reply of replies.slice(0, 12)) {
            const after = finalizeState(applyAction(child, reply));
            const value = evaluateFor(after, color);
            if (value < worst) worst = value;
        }
        score = worst;
    }

    return score;
};

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

export function getAIAction(state, playerIndex, difficulty = 'medium') {
    const actions = getLegalActions(state, playerIndex);
    if (actions.length === 0) return null;
    if (actions.length === 1) return actions[0];

    const color = state.players[playerIndex];

    /* 未定色的首手：只翻棋，简单挑一个位置 */
    if (!color) {
        if (difficulty === 'easy') return pickRandom(actions);
        return actions
            .map((action) => ({ action, value: flipScore(state, action.to, null) }))
            .sort((a, b) => b.value - a.value)[0].action;
    }

    if (difficulty === 'easy') {
        if (Math.random() < 0.5) return pickRandom(actions);
        const capture = actions.filter((action) => action.kind === 'capture');
        if (capture.length && Math.random() < 0.65) return pickRandom(capture);
        return pickRandom(actions);
    }

    const ranked = actions
        .map((action) => ({
            action,
            value:
                actionScore(state, action, color, difficulty) +
                (difficulty === 'medium' ? (Math.random() - 0.5) * 12 : 0)
        }))
        .sort((a, b) => b.value - a.value);

    if (difficulty === 'medium' && ranked.length > 2 && Math.random() < 0.18) {
        return pickRandom(ranked.slice(0, 3)).action;
    }

    return ranked[0].action;
}

export const findHint = (state, playerIndex) =>
    getAIAction(state, playerIndex, 'hard');
