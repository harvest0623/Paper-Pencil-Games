/* ============================================================
   点格棋 · 纯逻辑层
   棋盘为 6 × 6 个点阵，围成 5 × 5 共 25 个方格（方格数为奇数，故不会出现平局）
   h[r][c]：横线，位于第 r 行点上，连接点 (r, c) 与 (r, c+1)，尺寸 6 × 5
   v[r][c]：竖线，位于第 c 列点上，连接点 (r, c) 与 (r+1, c)，尺寸 5 × 6
   boxes[br][bc]：方格归属，EMPTY 表示尚未被占领
   ============================================================ */

const DOTS = 6;
const BOXES = DOTS - 1;

const EMPTY = 0;
const P1 = 1; // 蓝方
const P2 = 2; // 红方

const H = 'h';
const V = 'v';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function createBoard() {
    return {
        h: Array.from({ length: DOTS }, () => Array(BOXES).fill(EMPTY)),
        v: Array.from({ length: BOXES }, () => Array(DOTS).fill(EMPTY)),
        boxes: Array.from({ length: BOXES }, () => Array(BOXES).fill(EMPTY))
    };
}

function otherPlayer(player) {
    return player === P1 ? P2 : P1;
}

/* 边的坐标是否在棋盘范围内 */
function isValidEdge(edge) {
    if (!edge) return false;
    const { t, r, c } = edge;
    if (t === H) return r >= 0 && r < DOTS && c >= 0 && c < BOXES;
    if (t === V) return r >= 0 && r < BOXES && c >= 0 && c < DOTS;
    return false;
}

/* 边的归属：EMPTY 表示尚未画线 */
function getEdgeOwner(board, edge) {
    const { t, r, c } = edge;
    return t === H ? board.h[r][c] : board.v[r][c];
}

/* 一条边两侧的方格（棋盘外缘只有一侧） */
function adjacentBoxes(edge) {
    const { t, r, c } = edge;
    const list = [];
    if (t === H) {
        if (r - 1 >= 0) list.push({ br: r - 1, bc: c });
        if (r < BOXES) list.push({ br: r, bc: c });
    } else {
        if (c - 1 >= 0) list.push({ br: r, bc: c - 1 });
        if (c < BOXES) list.push({ br: r, bc: c });
    }
    return list;
}

/* 方格四周已经画出的边数（0 ~ 4） */
function boxSideCount(board, br, bc) {
    let n = 0;
    if (board.h[br][bc] !== EMPTY) n += 1;
    if (board.h[br + 1][bc] !== EMPTY) n += 1;
    if (board.v[br][bc] !== EMPTY) n += 1;
    if (board.v[br][bc + 1] !== EMPTY) n += 1;
    return n;
}

/* 所有仍可画的线 */
function getLegalMoves(board) {
    const moves = [];
    for (let r = 0; r < DOTS; r++) {
        for (let c = 0; c < BOXES; c++) {
            if (board.h[r][c] === EMPTY) moves.push({ t: H, r, c });
        }
    }
    for (let r = 0; r < BOXES; r++) {
        for (let c = 0; c < DOTS; c++) {
            if (board.v[r][c] === EMPTY) moves.push({ t: V, r, c });
        }
    }
    return moves;
}

/* 剩余可画的线数 */
function countEmptyEdges(board) {
    let n = 0;
    for (let r = 0; r < DOTS; r++) {
        for (let c = 0; c < BOXES; c++) {
            if (board.h[r][c] === EMPTY) n += 1;
        }
    }
    for (let r = 0; r < BOXES; r++) {
        for (let c = 0; c < DOTS; c++) {
            if (board.v[r][c] === EMPTY) n += 1;
        }
    }
    return n;
}

/* 落线：返回 { board, captured, extraTurn }；非法或已有线返回 null */
function applyMove(board, edge, player) {
    if (!isValidEdge(edge)) return null;
    const { t, r, c } = edge;
    if (getEdgeOwner(board, edge) !== EMPTY) return null;

    const next = {
        h: board.h.map((row) => [...row]),
        v: board.v.map((row) => [...row]),
        boxes: board.boxes.map((row) => [...row])
    };
    if (t === H) next.h[r][c] = player;
    else next.v[r][c] = player;

    /* 新画的这条线只会影响它两侧的方格 */
    const captured = [];
    adjacentBoxes(edge).forEach(({ br, bc }) => {
        if (next.boxes[br][bc] === EMPTY && boxSideCount(next, br, bc) === 4) {
            next.boxes[br][bc] = player;
            captured.push({ br, bc });
        }
    });

    /* 围住方格者多得一次落线机会 */
    return { board: next, captured, extraTurn: captured.length > 0 };
}

function countBoxes(board, player) {
    let n = 0;
    board.boxes.forEach((row) =>
        row.forEach((value) => {
            if (value === player) n += 1;
        })
    );
    return n;
}

function isGameOver(board) {
    return countEmptyEdges(board) === 0;
}

/* 终局判定：方格多者胜；返回 P1 / P2 / 0（平分） */
function getWinner(board) {
    const a = countBoxes(board, P1);
    const b = countBoxes(board, P2);
    if (a === b) return 0;
    return a > b ? P1 : P2;
}

/* 边的文字标签：横线 A1-B1，竖线 A1-A2 */
function edgeLabel(edge) {
    const { t, r, c } = edge;
    if (t === H) return `${LETTERS[c]}${r + 1}-${LETTERS[c + 1]}${r + 1}`;
    return `${LETTERS[c]}${r + 1}-${LETTERS[c]}${r + 2}`;
}

export {
    DOTS,
    BOXES,
    EMPTY,
    P1,
    P2,
    H,
    V,
    LETTERS,
    createBoard,
    otherPlayer,
    isValidEdge,
    getEdgeOwner,
    adjacentBoxes,
    boxSideCount,
    getLegalMoves,
    countEmptyEdges,
    applyMove,
    countBoxes,
    isGameOver,
    getWinner,
    edgeLabel
};