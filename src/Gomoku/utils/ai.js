/* ============================================================
   五子棋 AI
   ------------------------------------------------------------
   思路：以「棋型评分」为核心。
   对每个候选点分别计算：
     · attack  —— 我方在此落子后形成的棋型价值
     · defense —— 对手若在此落子形成的棋型价值（即封堵价值）
   难度差异：
     easy   —— 只用简化评估，并在靠前候选中随机挑选
     medium —— 攻守兼备的启发式评估
     hard   —— 在启发式基础上增加一层预判，规避对手的强反击
   ============================================================ */

import {
    BOARD_SIZE,
    EMPTY,
    BLACK,
    WHITE,
    inBounds,
    placeStone
} from './gameLogic';

/* 棋型分值 */
const WIN_SCORE = 1000000;

const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
];

/* 依据「连子数 + 开放端」给出棋型价值 */
const patternScore = (count, openEnds) => {
    if (count >= 5) return WIN_SCORE;
    if (openEnds === 0) return 0;
    if (count === 4) return openEnds === 2 ? 100000 : 12000;
    if (count === 3) return openEnds === 2 ? 9000 : 900;
    if (count === 2) return openEnds === 2 ? 320 : 60;
    return openEnds === 2 ? 18 : 4;
};

/* 评估 player 在空格 (row,col) 落子后的整体棋型价值 */
const evaluatePoint = (board, row, col, player) => {
    let total = 0;

    for (const [dr, dc] of DIRECTIONS) {
        let count = 1;
        let openEnds = 0;

        // 正方向
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c) && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        if (inBounds(r, c) && board[r][c] === EMPTY) openEnds++;

        // 反方向
        r = row - dr;
        c = col - dc;
        while (inBounds(r, c) && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        if (inBounds(r, c) && board[r][c] === EMPTY) openEnds++;

        total += patternScore(count, openEnds);
    }

    return total;
};

/* 候选点：已有棋子附近 2 格内的空位；空盘则取天元 */
const getCandidates = (board) => {
    const cells = [];
    let hasStone = false;

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] !== EMPTY) {
                hasStone = true;
                break;
            }
        }
        if (hasStone) break;
    }

    if (!hasStone) {
        const center = Math.floor(BOARD_SIZE / 2);
        return [{ row: center, col: center }];
    }

    const seen = new Set();
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === EMPTY) continue;

            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const nr = row + dr;
                    const nc = col + dc;
                    if (!inBounds(nr, nc) || board[nr][nc] !== EMPTY) continue;

                    const key = nr * BOARD_SIZE + nc;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    cells.push({ row: nr, col: nc });
                }
            }
        }
    }

    return cells;
};

/**
 * 计算电脑落子
 * @param {number[][]} board 当前棋盘
 * @param {number} player 电脑执子（BLACK / WHITE）
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {{row:number,col:number}|null}
 */
export const getAIMove = (board, player, difficulty = 'medium') => {
    const candidates = getCandidates(board);
    if (candidates.length === 0) return null;

    const opponent = player === BLACK ? WHITE : BLACK;

    const scored = candidates.map(({ row, col }) => ({
        row,
        col,
        attack: evaluatePoint(board, row, col, player),
        defense: evaluatePoint(board, row, col, opponent)
    }));

    /* 能赢就赢 */
    const winMove = scored.find((m) => m.attack >= WIN_SCORE);
    if (winMove) return { row: winMove.row, col: winMove.col };

    /* 对手下一手能赢就堵 */
    const blockMove = scored.find((m) => m.defense >= WIN_SCORE);
    if (blockMove) return { row: blockMove.row, col: blockMove.col };

    /* 简单：从靠前的候选中带随机地挑一个 */
    if (difficulty === 'easy') {
        scored.sort(
            (a, b) => b.attack + b.defense * 0.5 - (a.attack + a.defense * 0.5)
        );
        const pool = scored.slice(0, Math.min(6, scored.length));
        const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
        return { row: pick.row, col: pick.col };
    }

    /* 中等 / 困难：综合攻守，困难档追加一层预判 */
    const weight = difficulty === 'hard' ? 0.9 : 0.7;
    scored.sort((a, b) => b.attack + b.defense * weight - (a.attack + a.defense * weight));

    const top = scored.slice(0, difficulty === 'hard' ? 10 : 6);
    let best = top[0];
    let bestScore = -Infinity;

    for (const move of top) {
        let score = move.attack + move.defense * weight;

        if (difficulty === 'hard') {
            const nextBoard = placeStone(board, move.row, move.col, player);
            // 落子后对手的最强反击价值
            let oppBest = 0;
            for (const cell of candidates) {
                if (cell.row === move.row && cell.col === move.col) continue;
                const value = evaluatePoint(nextBoard, cell.row, cell.col, opponent);
                if (value > oppBest) oppBest = value;
            }
            score -= oppBest * 0.85;
        }

        /* 极小扰动，避免每局走法完全雷同 */
        score += Math.random() * 0.8;

        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }

    return { row: best.row, col: best.col };
};