/* ============================================================
   暗棋（半棋 / 翻棋）· 核心规则
   ------------------------------------------------------------
   4 × 8 棋盘，红黑双方各 16 枚棋子，开局全部背面朝上。
   任意翻开一枚暗棋即可开始，首翻者执该子颜色。
   每回合可以翻开一枚暗棋，或移动 / 吃自己的一枚明子。
   所有棋子都只能上下左右走一格；炮吃子必须隔一个棋子。
   吃子大小：帥/將 > 仕/士 > 相/象 > 俥/車 > 傌/馬 > 炮 > 兵/卒，
   但兵/卒可以吃帥/將，帥/將不能吃兵/卒，同级可以互吃。
   吃光对方全部棋子，或让对方无子可动即获胜。
   ============================================================ */

export const ROWS = 4;
export const COLS = 8;
export const SIZE = ROWS * COLS;
export const COLORS = ['red', 'black'];
export const COLOR_LABELS = { red: '红方', black: '黑方' };
/* 连续 80 手（无翻棋、无吃子）判和，避免残局无限打转 */
export const DRAW_LIMIT = 80;

export const FILE_LETTERS = 'ABCDEFGH';
export const DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];

export const otherColor = (color) => (color === 'red' ? 'black' : 'red');

/* ---------------- 棋种 ---------------- */
/* count 为每方枚数，rank 越大越能压制小棋 */
export const PIECE_TYPES = [
    { type: 'king', rank: 7, value: 56, count: 1, red: '帥', black: '將' },
    { type: 'advisor', rank: 6, value: 40, count: 2, red: '仕', black: '士' },
    { type: 'elephant', rank: 5, value: 34, count: 2, red: '相', black: '象' },
    { type: 'chariot', rank: 4, value: 28, count: 2, red: '俥', black: '車' },
    { type: 'horse', rank: 3, value: 22, count: 2, red: '傌', black: '馬' },
    { type: 'cannon', rank: 2, value: 30, count: 2, red: '炮', black: '砲' },
    { type: 'soldier', rank: 1, value: 18, count: 5, red: '兵', black: '卒' }
];

export const toIndex = (row, col) => row * COLS + col;
export const rowOf = (index) => Math.floor(index / COLS);
export const colOf = (index) => index % COLS;
export const squareLabel = (index) =>
    `${FILE_LETTERS[colOf(index)]}${ROWS - rowOf(index)}`;

const inBoard = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

const createPiece = (color, type) => ({
    color,
    type: type.type,
    rank: type.rank,
    value: type.value,
    char: type[color],
    revealed: false
});

const shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
};

/* ---------------- 开局 ---------------- */
export const createInitialState = (starter = 0) => {
    const pieces = [];
    COLORS.forEach((color) => {
        PIECE_TYPES.forEach((type) => {
            for (let i = 0; i < type.count; i++) {
                pieces.push(createPiece(color, type));
            }
        });
    });
    shuffle(pieces);

    return {
        board: pieces,
        players: [null, null],
        currentPlayer: starter,
        winner: null,
        draw: false,
        reason: null,
        lastAction: null,
        pliesNoProgress: 0,
        log: []
    };
};

/* ---------------- 基础统计 ---------------- */
export const countColor = (board, color) =>
    board.reduce((total, piece) => (piece && piece.color === color ? total + 1 : total), 0);

export const countRevealed = (board, color) =>
    board.reduce(
        (total, piece) =>
            piece && piece.color === color && piece.revealed ? total + 1 : total,
        0
    );

export const countHidden = (board) =>
    board.reduce((total, piece) => (piece && !piece.revealed ? total + 1 : total), 0);

export const countCaptures = (log, color) =>
    log.reduce(
        (total, entry) => (entry.color === color && entry.kind === 'capture' ? total + 1 : total),
        0
    );

/* ---------------- 吃子关系 ---------------- */
export const canCapture = (attacker, defender) => {
    if (!attacker || !defender) return false;
    if (attacker.color === defender.color || !defender.revealed) return false;

    /* 炮的吃法由隔子规则单独判定 */
    if (attacker.type === 'cannon') return true;
    /* 兵/卒只能吃帥/將 */
    if (attacker.type === 'soldier') return defender.type === 'king';
    /* 帥/將不能被小卒以外的棋子吃 */
    if (defender.type === 'king') return attacker.type === 'king';
    /* 帥/將不能吃兵/卒 */
    if (attacker.type === 'king') return defender.type !== 'soldier';
    /* 其余棋种同级可互吃 */
    return attacker.rank >= defender.rank;
};

/* ---------------- 合法行动 ---------------- */
/**
 * 每项：{ kind: 'flip' | 'move' | 'capture', from, to }
 * - 暗棋可以直接翻开（不能直接吃）
 * - 炮的吃子：沿直线隔恰好一个棋子，距离不限
 * - 未定色时只返回翻棋
 */
export const getLegalActions = (state, playerIndex = state.currentPlayer) => {
    if (state.winner || state.draw || state.currentPlayer === null) return [];

    const board = state.board;
    const player = playerIndex ?? state.currentPlayer;
    const color = state.players[player];
    const actions = [];

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        if (piece && !piece.revealed) {
            actions.push({ kind: 'flip', from: null, to: index });
        }
    }

    if (!color) return actions;

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        if (!piece || !piece.revealed || piece.color !== color) continue;

        const row = rowOf(index);
        const col = colOf(index);

        if (piece.type === 'cannon') {
            /* 炮不吃子时只走一格空格 */
            for (const [dr, dc] of DIRECTIONS) {
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!inBoard(nextRow, nextCol)) continue;
                const target = toIndex(nextRow, nextCol);
                if (!board[target]) actions.push({ kind: 'move', from: index, to: target });
            }

            /* 炮吃子：直线方向隔一子打 */
            for (const [dr, dc] of DIRECTIONS) {
                let r = row + dr;
                let c = col + dc;
                let screened = false;
                while (inBoard(r, c)) {
                    const target = toIndex(r, c);
                    const targetPiece = board[target];
                    if (targetPiece) {
                        if (!screened) {
                            screened = true;
                        } else {
                            if (targetPiece.color !== color && targetPiece.revealed) {
                                actions.push({ kind: 'capture', from: index, to: target });
                            }
                            break;
                        }
                    }
                    r += dr;
                    c += dc;
                }
            }
            continue;
        }

        for (const [dr, dc] of DIRECTIONS) {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (!inBoard(nextRow, nextCol)) continue;
            const target = toIndex(nextRow, nextCol);
            const targetPiece = board[target];

            if (!targetPiece) {
                actions.push({ kind: 'move', from: index, to: target });
            } else if (targetPiece.revealed && canCapture(piece, targetPiece)) {
                actions.push({ kind: 'capture', from: index, to: target });
            }
        }
    }

    return actions;
};

export const getActionsFrom = (state, playerIndex, index) =>
    getLegalActions(state, playerIndex).filter(
        (action) => action.kind !== 'flip' && action.from === index
    );

/* ---------------- 执行行动 ---------------- */
export const applyAction = (state, action) => {
    if (state.winner || state.draw || state.currentPlayer === null) return state;

    const player = state.currentPlayer;
    const board = state.board.slice();
    const players = state.players.slice();
    let logEntry = null;
    let pliesNoProgress = state.pliesNoProgress;

    if (action.kind === 'flip') {
        const piece = board[action.to];
        if (!piece || piece.revealed) return state;

        board[action.to] = { ...piece, revealed: true };

        if (!players[0] && !players[1]) {
            players[player] = piece.color;
            players[1 - player] = otherColor(piece.color);
        }

        pliesNoProgress = 0;
        logEntry = {
            player,
            color: piece.color,
            kind: 'flip',
            from: null,
            to: action.to,
            char: piece.char,
            capturedChar: null
        };
    } else {
        const color = players[player];
        const moving = board[action.from];
        if (!color || !moving || !moving.revealed || moving.color !== color) return state;

        const targetPiece = board[action.to];
        if (targetPiece) {
            if (!targetPiece.revealed || targetPiece.color === color) return state;
            if (moving.type !== 'cannon' && !canCapture(moving, targetPiece)) return state;
        }

        board[action.from] = null;
        board[action.to] = moving;

        pliesNoProgress = targetPiece ? 0 : pliesNoProgress + 1;
        logEntry = {
            player,
            color,
            kind: targetPiece ? 'capture' : 'move',
            from: action.from,
            to: action.to,
            char: moving.char,
            capturedChar: targetPiece ? targetPiece.char : null
        };
    }

    const next = {
        ...state,
        board,
        players,
        currentPlayer: 1 - player,
        pliesNoProgress,
        lastAction: logEntry,
        log: [...state.log, logEntry]
    };

    const actorColor = players[player];
    const opponentColor = players[1 - player];

    if (opponentColor && countColor(board, opponentColor) === 0) {
        return {
            ...next,
            winner: actorColor,
            reason: 'captured',
            currentPlayer: null
        };
    }

    if (pliesNoProgress >= DRAW_LIMIT) {
        return { ...next, draw: true, currentPlayer: null };
    }

    return next;
};

/**
 * 行动后的困毙判定：下一方完全没有合法行动则判负。
 */
export const finalizeState = (state) => {
    if (state.winner || state.draw || state.currentPlayer === null) return state;

    const actions = getLegalActions(state, state.currentPlayer);
    if (actions.length === 0) {
        return {
            ...state,
            winner: state.players[1 - state.currentPlayer],
            reason: 'blocked',
            currentPlayer: null
        };
    }
    return state;
};

/* ---------------- 文案 ---------------- */
export const actionLabel = (entry) => {
    if (!entry) return '';
    if (entry.kind === 'flip') {
        return `翻开 ${entry.char} · ${squareLabel(entry.to)}`;
    }
    if (entry.kind === 'capture') {
        return `${entry.char} ${squareLabel(entry.from)} × ${entry.capturedChar} ${squareLabel(entry.to)}`;
    }
    return `${entry.char} ${squareLabel(entry.from)} → ${squareLabel(entry.to)}`;
};
