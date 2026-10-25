/* ============================================================
   西洋跳棋（English Draughts / Checkers）· 核心规则
   ------------------------------------------------------------
   8 × 8 棋盘，只使用深色格子，每方 12 枚棋子。
   普通棋子只能斜向前进一格；跳跃必须跨过紧邻的对方棋子，
   落到它背后的空位，并且只要还能继续跳就必须继续。
   本方回合只要有吃子机会，就必须吃子。
   棋子走到底线升为王，之后可以前后四个斜向移动与吃子。
   —— 纯函数实现，不依赖 React
   ============================================================ */

export const SIZE = 8;
export const PLAYERS = ['blue', 'red'];
export const PLAYER_LABELS = { blue: '蓝方', red: '红方' };
/* 双方连续 40 回合（共 80 手）没有吃子或升王则判和 */
export const DRAW_LIMIT = 80;

export const FILE_LETTERS = 'ABCDEFGH';

const DIAGONALS = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
];

export const otherPlayer = (player) => (player === 'blue' ? 'red' : 'blue');

/* 深色格：(row + col) 为奇数；row 0 在棋盘顶部 */
export const isDarkSquare = (row, col) => (row + col) % 2 === 1;
export const toIndex = (row, col) => row * SIZE + col;
export const rowOf = (index) => Math.floor(index / SIZE);
export const colOf = (index) => index % SIZE;
export const squareLabel = (index) =>
    `${FILE_LETTERS[colOf(index)]}${SIZE - rowOf(index)}`;

const inBoard = (row, col) =>
    row >= 0 && row < SIZE && col >= 0 && col < SIZE;

/* 普通棋子只允许向前（蓝方向上、红方向下），王可走四个斜向 */
const directionsFor = (player, king) => {
    if (king) return DIAGONALS;
    const forward = player === 'blue' ? -1 : 1;
    return DIAGONALS.filter(([dr]) => dr === forward);
};

const promotesAt = (player, index) =>
    player === 'blue' ? rowOf(index) === 0 : rowOf(index) === SIZE - 1;

/* ---------------- 开局 ---------------- */
export const createInitialState = (firstPlayer = 'blue') => {
    const board = new Array(SIZE * SIZE).fill(null);

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (isDarkSquare(row, col)) {
                board[toIndex(row, col)] = { player: 'red', king: false };
            }
        }
    }
    for (let row = SIZE - 3; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            if (isDarkSquare(row, col)) {
                board[toIndex(row, col)] = { player: 'blue', king: false };
            }
        }
    }

    return {
        board,
        turn: firstPlayer,
        winner: null,
        draw: false,
        reason: null,
        lastMove: null,
        pliesNoProgress: 0,
        log: []
    };
};

/* ---------------- 基础统计 ---------------- */
export const countPieces = (board, player) => {
    let total = 0;
    for (let i = 0; i < board.length; i++) {
        if (board[i] && board[i].player === player) total += 1;
    }
    return total;
};

export const countKings = (board, player) => {
    let total = 0;
    for (let i = 0; i < board.length; i++) {
        if (board[i] && board[i].player === player && board[i].king) total += 1;
    }
    return total;
};

export const countCaptures = (log, player) =>
    log.reduce(
        (total, entry) =>
            entry.player === player ? total + entry.captures : total,
        0
    );

/* ---------------- 跳跃连吃搜索 ---------------- */
/**
 * 从 from 出发枚举所有完整连跳路线
 * 只要还能继续跳就必须跳到底，因此只在「无路可跳」时记录终点。
 */
const collectCaptureSequences = (board, from, player, king, path, captured, out) => {
    const row = rowOf(from);
    const col = colOf(from);
    let extended = false;

    for (const [dr, dc] of directionsFor(player, king)) {
        const midRow = row + dr;
        const midCol = col + dc;
        const landRow = row + dr * 2;
        const landCol = col + dc * 2;
        if (!inBoard(landRow, landCol)) continue;

        const midIndex = toIndex(midRow, midCol);
        const landIndex = toIndex(landRow, landCol);
        const victim = board[midIndex];
        if (!victim || victim.player === player) continue;
        if (board[landIndex]) continue;
        if (captured.includes(midIndex)) continue;

        extended = true;

        const nextBoard = board.slice();
        nextBoard[from] = null;
        nextBoard[midIndex] = null;
        nextBoard[landIndex] = { player, king };

        collectCaptureSequences(
            nextBoard,
            landIndex,
            player,
            king,
            [...path, landIndex],
            [...captured, midIndex],
            out
        );
    }

    if (!extended && captured.length) {
        out.push({
            from: path[0],
            to: from,
            path: [...path],
            captures: [...captured],
            kinged: promotesAt(player, from)
        });
    }
};

/* ---------------- 合法走法 ---------------- */
/**
 * 返回当前一方的全部合法走法
 * 每项：{ from, to, path, captures, kinged }
 * - 有吃子机会时只返回吃子路线（强制吃子）
 * - 吃子路线已经包含完整的连跳
 */
export const getLegalMoves = (state, player = state.turn) => {
    if (!player || state.winner || state.draw) return [];

    const board = state.board;
    const captures = [];
    const simples = [];

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        if (!piece || piece.player !== player) continue;

        collectCaptureSequences(board, index, player, piece.king, [index], [], captures);

        const row = rowOf(index);
        const col = colOf(index);
        for (const [dr, dc] of directionsFor(player, piece.king)) {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (!inBoard(nextRow, nextCol)) continue;
            const target = toIndex(nextRow, nextCol);
            if (board[target]) continue;
            simples.push({
                from: index,
                to: target,
                path: [index, target],
                captures: [],
                kinged: promotesAt(player, target)
            });
        }
    }

    if (captures.length) {
        /* 连吃更长的路线优先展示，便于玩家与 AI 选择 */
        return captures.sort((a, b) => b.captures.length - a.captures.length);
    }
    return simples;
};

export const getMovesFrom = (state, player, index) =>
    getLegalMoves(state, player).filter((move) => move.from === index);

/* ---------------- 落子 ---------------- */
export const applyMove = (state, move) => {
    const player = state.turn;
    const board = state.board.slice();
    const piece = board[move.from];
    if (!piece) return state;

    board[move.from] = null;
    move.captures.forEach((index) => {
        board[index] = null;
    });

    const kinged = !piece.king && promotesAt(player, move.to);
    board[move.to] = { player, king: piece.king || kinged };

    const opponent = otherPlayer(player);
    const progress = move.captures.length > 0 || kinged;
    const pliesNoProgress = progress ? 0 : state.pliesNoProgress + 1;

    const next = {
        board,
        turn: otherPlayer(player),
        winner: null,
        draw: false,
        reason: null,
        lastMove: {
            player,
            from: move.from,
            to: move.to,
            path: move.path,
            captures: move.captures,
            kinged
        },
        pliesNoProgress,
        log: [
            ...state.log,
            {
                player,
                from: move.from,
                to: move.to,
                captures: move.captures.length,
                kinged
            }
        ]
    };

    if (countPieces(board, opponent) === 0) {
        next.winner = player;
        next.reason = 'captured';
        next.turn = null;
        return next;
    }

    if (pliesNoProgress >= DRAW_LIMIT) {
        next.draw = true;
        next.turn = null;
        return next;
    }

    return next;
};

/**
 * 落子后的终局判定：如果下一方已无子可动，则判定对方获胜
 * 与 applyMove 分离，避免 AI 搜索时重复生成走法。
 */
export const finalizeState = (state) => {
    if (state.winner || state.draw || !state.turn) return state;
    if (getLegalMoves(state, state.turn).length === 0) {
        return {
            ...state,
            winner: otherPlayer(state.turn),
            reason: 'blocked',
            turn: null
        };
    }
    return state;
};

/* ---------------- 文案 ---------------- */
export const moveLabel = (move) => {
    if (!move) return '';
    return `${squareLabel(move.from)} → ${squareLabel(move.to)}`;
};

export const logLabel = (entry) =>
    `${squareLabel(entry.from)} → ${squareLabel(entry.to)}`;
