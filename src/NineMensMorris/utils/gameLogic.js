/* ============================================================
   九子棋（Nine Men's Morris）· 核心规则
   —— 纯函数实现，不依赖 React，可单独测试
   ============================================================ */

export const SIZE = 24;
export const BLACK = 'black';
export const WHITE = 'white';
export const PIECES_PER_PLAYER = 9;
/* 连续 50 手没有吃子则判和，避免对局无限延续 */
export const DRAW_LIMIT = 50;

/* 7 × 7 网格坐标：外环 0-7、中环 8-15、内环 16-23（每环自左上角起顺时针） */
export const COORDS = [
    [0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3],
    [1, 1], [3, 1], [5, 1], [5, 3], [5, 5], [3, 5], [1, 5], [1, 3],
    [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3]
];

const COL_LETTERS = 'ABCDEFG';
export const POINT_LABELS = COORDS.map(([col, row]) => `${COL_LETTERS[col]}${row + 1}`);

/* ---------------- 邻接与成三线 ---------------- */
const EDGES = [];
for (let ring = 0; ring < 3; ring++) {
    const base = ring * 8;
    for (let i = 0; i < 8; i++) EDGES.push([base + i, base + ((i + 1) % 8)]);
}
/* 四条辐条各分两段：1-9-17、3-11-19、5-13-21、7-15-23 */
[[1, 9], [9, 17], [3, 11], [11, 19], [5, 13], [13, 21], [7, 15], [15, 23]].forEach((edge) =>
    EDGES.push(edge)
);

export const ADJ = Array.from({ length: SIZE }, () => []);
EDGES.forEach(([a, b]) => {
    ADJ[a].push(b);
    ADJ[b].push(a);
});

const RING_MILLS = [];
for (let ring = 0; ring < 3; ring++) {
    const base = ring * 8;
    for (let i = 0; i < 4; i++) {
        RING_MILLS.push([base + i * 2, base + i * 2 + 1, base + ((i * 2 + 2) % 8)]);
    }
}
export const MILLS = [...RING_MILLS, [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23]];

const MILLS_BY_POINT = Array.from({ length: SIZE }, () => []);
MILLS.forEach((mill) => mill.forEach((point) => MILLS_BY_POINT[point].push(mill)));

/* ---------------- 基础工具 ---------------- */
export const otherPlayer = (player) => (player === BLACK ? WHITE : BLACK);
export const pointLabel = (index) => POINT_LABELS[index];

export const countOnBoard = (points, player) =>
    points.reduce((total, point) => (point === player ? total + 1 : total), 0);

export const countPieces = (state, player) =>
    countOnBoard(state.points, player) + state.toPlace[player];

/* 手上只剩三子时进入飞子阶段，可落到任意空点 */
export const isFlying = (state, player) =>
    state.phase === 'moving' && countPieces(state, player) === 3;

/* 该点是否处在某条已连成的三线上 */
export function isInMill(points, index) {
    const owner = points[index];
    if (!owner) return false;
    return MILLS_BY_POINT[index].some((mill) => mill.every((p) => points[p] === owner));
}

/* 在 index 处新连成的三线 */
export function millsThrough(points, index, player) {
    return MILLS_BY_POINT[index].filter((mill) => mill.every((p) => points[p] === player));
}

export function countMills(state, player) {
    return MILLS.reduce(
        (total, mill) => (mill.every((p) => state.points[p] === player) ? total + 1 : total),
        0
    );
}

export function createState(firstPlayer = BLACK) {
    return {
        points: new Array(SIZE).fill(null),
        currentPlayer: firstPlayer,
        phase: 'placing',
        toPlace: { [BLACK]: PIECES_PER_PLAYER, [WHITE]: PIECES_PER_PLAYER },
        pendingCapture: false,
        mill: null,
        lastMove: null,
        movesSinceCapture: 0,
        winner: null,
        log: []
    };
}

/* 可以吃掉的对方棋子：优先吃不在三线上的子，全在三线上时才可任意吃 */
export function captureTargets(state) {
    const opponent = otherPlayer(state.currentPlayer);
    const free = [];
    const onMill = [];
    state.points.forEach((point, index) => {
        if (point !== opponent) return;
        if (isInMill(state.points, index)) onMill.push(index);
        else free.push(index);
    });
    return free.length ? free : onMill;
}

export function legalMoves(state) {
    if (state.phase === 'over') return [];

    if (state.pendingCapture) {
        return captureTargets(state).map((to) => ({ type: 'capture', to }));
    }

    if (state.phase === 'placing') {
        const moves = [];
        for (let i = 0; i < SIZE; i++) {
            if (!state.points[i]) moves.push({ type: 'place', to: i });
        }
        return moves;
    }

    const player = state.currentPlayer;
    const flying = isFlying(state, player);
    const moves = [];
    for (let from = 0; from < SIZE; from++) {
        if (state.points[from] !== player) continue;
        if (flying) {
            for (let to = 0; to < SIZE; to++) {
                if (!state.points[to]) moves.push({ type: 'move', from, to });
            }
        } else {
            ADJ[from].forEach((to) => {
                if (!state.points[to]) moves.push({ type: 'move', from, to });
            });
        }
    }
    return moves;
}

/* 轮到 player 时是否已无子可动 */
export function isBlocked(state, player) {
    if (state.phase !== 'moving') return false;
    if (isFlying(state, player)) return false;
    for (let i = 0; i < SIZE; i++) {
        if (state.points[i] !== player) continue;
        if (ADJ[i].some((to) => !state.points[to])) return false;
    }
    return true;
}

const logEntry = (move, player) => {
    if (move.type === 'place') {
        return { player, type: 'place', to: move.to, label: POINT_LABELS[move.to] };
    }
    if (move.type === 'capture') {
        return { player, type: 'capture', to: move.to, label: POINT_LABELS[move.to] };
    }
    return {
        player,
        type: 'move',
        from: move.from,
        to: move.to,
        label: `${POINT_LABELS[move.from]} → ${POINT_LABELS[move.to]}`
    };
};

export function applyMove(state, move) {
    const player = state.currentPlayer;
    const points = state.points.slice();
    let toPlace = state.toPlace;
    let mill = null;
    let pendingCapture = false;
    let lastMove;

    if (move.type === 'capture') {
        points[move.to] = null;
        lastMove = { type: 'capture', player, from: null, to: move.to, captured: move.to };
    } else {
        if (move.type === 'place') {
            points[move.to] = player;
            toPlace = { ...state.toPlace, [player]: state.toPlace[player] - 1 };
        } else {
            points[move.from] = null;
            points[move.to] = player;
        }
        const formed = millsThrough(points, move.to, player);
        if (formed.length) {
            mill = formed[0];
            pendingCapture = true;
        }
        lastMove = {
            type: move.type,
            player,
            from: move.from ?? null,
            to: move.to,
            captured: null
        };
    }

    let phase = state.phase;
    if (phase === 'placing' && toPlace[BLACK] === 0 && toPlace[WHITE] === 0) phase = 'moving';

    const next = {
        points,
        currentPlayer: pendingCapture ? player : otherPlayer(player),
        phase,
        toPlace,
        pendingCapture,
        mill,
        lastMove,
        movesSinceCapture: move.type === 'capture' ? 0 : state.movesSinceCapture + 1,
        winner: null,
        log: [...state.log, logEntry(move, player)]
    };

    if (pendingCapture) return next;

    const opponent = otherPlayer(player);
    if (countPieces(next, opponent) < 3) {
        return { ...next, phase: 'over', winner: player, reason: 'pieces' };
    }
    if (isBlocked(next, opponent)) {
        return { ...next, phase: 'over', winner: player, reason: 'blocked' };
    }
    if (next.movesSinceCapture >= DRAW_LIMIT) {
        return { ...next, phase: 'over', winner: null, reason: 'draw' };
    }
    return next;
}

/* 当前局面的胜负：未结束返回 null，平局返回 0 */
export function winnerOf(state) {
    if (state.phase === 'over') return state.winner ?? 0;
    const opponent = otherPlayer(state.currentPlayer);
    if (countPieces(state, opponent) < 3) return state.currentPlayer;
    if (isBlocked(state, opponent)) return state.currentPlayer;
    return null;
}

/* 阶段文案：飞子是走子阶段的特殊状态 */
export function phaseLabel(state) {
    if (state.phase === 'placing') return '布子';
    if (state.phase === 'moving') return isFlying(state, state.currentPlayer) ? '飞子' : '走子';
    return '结束';
}

export function moveLabel(move) {
    if (!move) return '';
    if (move.type === 'place') return `布子 ${POINT_LABELS[move.to]}`;
    if (move.type === 'capture') return `吃掉 ${POINT_LABELS[move.to]}`;
    return `${POINT_LABELS[move.from]} → ${POINT_LABELS[move.to]}`;
}
