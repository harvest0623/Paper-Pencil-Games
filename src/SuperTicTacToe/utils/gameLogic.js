/* ============================================================
   超级井字棋 · 纯逻辑层
   大棋盘 = 3×3 个子棋盘（下标 0..8，行优先）
   每个子棋盘 = 3×3 的格子；全盘 81 格
   ============================================================ */

const BOARD_SIZE = 3;
const SUB_COUNT = 9;

const EMPTY = 0;
const X = 1;
const O = 2;
/* 子棋盘已下满且无人连线 */
const DRAW = -1;

const COLUMN_LABELS = ['A', 'B', 'C'];

/* 子棋盘在大棋盘中的位置名，下标行优先 */
const SUB_LABELS = ['左上', '中上', '右上', '左中', '中央', '右中', '左下', '中下', '右下'];

/* 子棋盘内的八条连线（[行, 列]） */
const LINES = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]]
];

/* 大棋盘上「赢下的子棋盘」组成的八条连线 */
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

function otherPlayer(player) {
    return player === X ? O : X;
}

function coordLabel(row, col) {
    return `${COLUMN_LABELS[col]}${row + 1}`;
}

function subLabel(sub) {
    return SUB_LABELS[sub];
}

/* 子棋盘在大棋盘中的坐标，例如 A1 */
function subCoordLabel(sub) {
    return coordLabel(Math.floor(sub / BOARD_SIZE), sub % BOARD_SIZE);
}

function createInitialBoard() {
    return Array.from({ length: SUB_COUNT }, () =>
        Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY))
    );
}

/* 返回子棋盘内的获胜方与对应三格，若无则 null */
function getLocalWinningCells(cells) {
    for (const line of LINES) {
        const value = cells[line[0][0]][line[0][1]];
        if (
            value !== EMPTY &&
            value === cells[line[1][0]][line[1][1]] &&
            value === cells[line[2][0]][line[2][1]]
        ) {
            return {
                player: value,
                cells: line.map(([row, col]) => ({ row, col }))
            };
        }
    }
    return null;
}

function getLocalWinner(cells) {
    const res = getLocalWinningCells(cells);
    return res ? res.player : null;
}

function isSubFull(cells) {
    return cells.every((row) => row.every((value) => value !== EMPTY));
}

/* 大棋盘上是否已有连线，返回 { player, subs } */
function getBigWinningSubs(subWinners) {
    for (const line of BIG_LINES) {
        const value = subWinners[line[0]];
        if (
            value !== EMPTY &&
            value !== DRAW &&
            value === subWinners[line[1]] &&
            value === subWinners[line[2]]
        ) {
            return { player: value, subs: [...line] };
        }
    }
    return null;
}

function getBigWinner(subWinners) {
    const res = getBigWinningSubs(subWinners);
    return res ? res.player : null;
}

/* 子棋盘是否还能落子（未分出胜负、未下满） */
function isSubPlayable(board, subWinners, sub) {
    return subWinners[sub] === EMPTY && !isSubFull(board[sub]);
}

/* 落点所在的格子决定对手下一步的目标子棋盘；目标已结束或已满则返回 null（自由落子） */
function computeForcedSub(board, subWinners, row, col) {
    const target = row * BOARD_SIZE + col;
    return isSubPlayable(board, subWinners, target) ? target : null;
}

function isFreeForced(forcedSub) {
    return forcedSub === null || forcedSub === undefined;
}

/* 当前状态下所有合法落点 */
function getLegalMoves(state) {
    const { board, subWinners, forcedSub } = state;
    const moves = [];
    const forced = !isFreeForced(forcedSub) && isSubPlayable(board, subWinners, forcedSub)
        ? forcedSub
        : null;

    const subs = forced === null ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [forced];
    for (const sub of subs) {
        if (!isSubPlayable(board, subWinners, sub)) continue;
        const cells = board[sub];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (cells[row][col] === EMPTY) moves.push({ sub, row, col });
            }
        }
    }
    return moves;
}

function isLegalMove(state, sub, row, col) {
    const { board, subWinners, forcedSub } = state;
    if (state.bigWinner || state.draw) return false;
    if (sub < 0 || sub >= SUB_COUNT) return false;
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (!isSubPlayable(board, subWinners, sub)) return false;
    if (board[sub][row][col] !== EMPTY) return false;

    const forced = !isFreeForced(forcedSub) && isSubPlayable(board, subWinners, forcedSub)
        ? forcedSub
        : null;
    if (forced !== null && forced !== sub) return false;
    return true;
}

function createInitialState(firstPlayer = X) {
    return {
        board: createInitialBoard(),
        subWinners: Array(SUB_COUNT).fill(EMPTY),
        currentPlayer: firstPlayer,
        lastMove: null,
        forcedSub: null,
        bigWinner: null,
        draw: false,
        log: []
    };
}

/* 落子并返回新状态；非法落子返回 null */
function applyMove(state, sub, row, col) {
    if (!isLegalMove(state, sub, row, col)) return null;
    const player = state.currentPlayer;

    const board = state.board.map((cells) => cells.map((r) => [...r]));
    board[sub][row][col] = player;
    const subWinners = state.subWinners.slice();

    const local = getLocalWinningCells(board[sub]);
    let subWon = false;
    let subDrawn = false;
    if (local && local.player === player) {
        subWinners[sub] = player;
        subWon = true;
    } else if (isSubFull(board[sub])) {
        subWinners[sub] = DRAW;
        subDrawn = true;
    }

    const big = getBigWinningSubs(subWinners);
    let bigWinner = null;
    let draw = false;
    let nextForced = null;
    let nextPlayer = otherPlayer(player);

    if (big) {
        bigWinner = big.player;
        nextPlayer = null;
    } else {
        nextForced = computeForcedSub(board, subWinners, row, col);
        if (getLegalMoves({ board, subWinners, forcedSub: nextForced }).length === 0) {
            draw = true;
            nextPlayer = null;
        }
    }

    const entry = {
        player,
        sub,
        row,
        col,
        label: `${subLabel(sub)} ${coordLabel(row, col)}`,
        coords: `${subCoordLabel(sub)} · ${coordLabel(row, col)}`,
        free: isFreeForced(state.forcedSub),
        subWon,
        subDrawn
    };

    return {
        board,
        subWinners,
        currentPlayer: nextPlayer,
        lastMove: { sub, row, col, player },
        forcedSub: isFreeForced(nextForced) || bigWinner || draw ? null : nextForced,
        bigWinner,
        draw,
        log: [...state.log, entry]
    };
}

function countSubWins(subWinners, player) {
    let count = 0;
    for (let sub = 0; sub < SUB_COUNT; sub++) {
        if (subWinners[sub] === player) count += 1;
    }
    return count;
}

export {
    BOARD_SIZE,
    SUB_COUNT,
    EMPTY,
    X,
    O,
    DRAW,
    COLUMN_LABELS,
    SUB_LABELS,
    LINES,
    BIG_LINES,
    otherPlayer,
    coordLabel,
    subLabel,
    subCoordLabel,
    createInitialBoard,
    getLocalWinningCells,
    getLocalWinner,
    isSubFull,
    getBigWinningSubs,
    getBigWinner,
    isSubPlayable,
    computeForcedSub,
    getLegalMoves,
    isLegalMove,
    createInitialState,
    applyMove,
    countSubWins
};