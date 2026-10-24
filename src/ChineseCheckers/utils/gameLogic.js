/* ============================================================
   中国跳棋（Chinese Checkers）纯逻辑层
   ------------------------------------------------------------
   棋盘由 17 行组成，长度依次为 1,2,3,4,13,12,11,10,9,10,11,12,13,4,3,2,1，
   共 121 个棋位。相邻两行的棋位在水平方向错开半格，
   因此每个棋位最多有 6 个相邻棋位（三角格点）。

   坐标采用 (row, x2)，其中 x2 是水平坐标的两倍，始终为整数。
   棋子用「棋位下标」表示，同一玩家的 10 枚棋子用数组下标区分。
   默认两方对弈：蓝方在上方三角，红方在下方三角，
   目标是把 10 枚棋子全部送进对面的三角。
   ============================================================ */

export const ROW_LENGTHS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];

export const PLAYERS = ['blue', 'red'];

export const PLAYER_LABELS = {
    blue: '蓝方',
    red: '红方'
};

export const otherPlayer = (player) => (player === 'blue' ? 'red' : 'blue');

/* 六个方向：左、右、左上、右上、左下、右下 */
const DIRS = [
    { dr: 0, dx: -2 },
    { dr: 0, dx: 2 },
    { dr: -1, dx: -1 },
    { dr: -1, dx: 1 },
    { dr: 1, dx: -1 },
    { dr: 1, dx: 1 }
];

/* 六个星角的棋位范围：[行, 最小 x2, 最大 x2] */
const TRIANGLE_RANGES = {
    top: [[0, 12, 12], [1, 11, 13], [2, 10, 14], [3, 9, 15]],
    bottom: [[13, 9, 15], [14, 10, 14], [15, 11, 13], [16, 12, 12]],
    upperLeft: [[4, 0, 6], [5, 1, 5], [6, 2, 4], [7, 3, 3]],
    upperRight: [[4, 18, 24], [5, 19, 23], [6, 20, 22], [7, 21, 21]],
    lowerLeft: [[12, 0, 6], [11, 1, 5], [10, 2, 4], [9, 3, 3]],
    lowerRight: [[12, 18, 24], [11, 19, 23], [10, 20, 22], [9, 21, 21]]
};

/* 两方对弈：蓝方主场在上、目标在下；红方相反 */
const HOME = { blue: 'top', red: 'bottom' };
const GOAL = { blue: 'bottom', red: 'top' };

/* ---------------- 棋盘构建（进程内只算一次） ---------------- */
let boardCache = null;

export const getBoard = () => {
    if (boardCache) return boardCache;

    const cells = [];
    const indexOf = new Map();

    ROW_LENGTHS.forEach((length, row) => {
        const startX2 = 12 - (length - 1);
        for (let i = 0; i < length; i++) {
            const x2 = startX2 + i * 2;
            const id = cells.length;
            cells.push({
                id,
                row,
                x2,
                /* 用于 CSS 定位：水平单位坐标与竖直单位坐标 */
                x: x2 / 2,
                y: row * (Math.sqrt(3) / 2)
            });
            indexOf.set(`${row}:${x2}`, id);
        }
    });

    /* 六个方向的相邻棋位 */
    const neighbors = cells.map((cell) =>
        DIRS.map(({ dr, dx }) => {
            const key = `${cell.row + dr}:${cell.x2 + dx}`;
            const found = indexOf.get(key);
            return found == null ? -1 : found;
        })
    );

    const pickTriangle = (ranges) =>
        ranges.flatMap(([row, minX2, maxX2]) => {
            const list = [];
            const startX2 = 12 - (ROW_LENGTHS[row] - 1);
            for (let i = 0; i < ROW_LENGTHS[row]; i++) {
                const x2 = startX2 + i * 2;
                if (x2 >= minX2 && x2 <= maxX2) list.push(indexOf.get(`${row}:${x2}`));
            }
            return list;
        });

    const triangles = Object.fromEntries(
        Object.entries(TRIANGLE_RANGES).map(([name, ranges]) => [name, pickTriangle(ranges)])
    );

    /* 每个棋位到某个星角的最短跳数（忽略棋子阻挡），用于 AI 评估 */
    const distanceToTriangle = (triangle) => {
        const dist = new Int16Array(cells.length).fill(-1);
        const queue = [...triangle];
        queue.forEach((cell) => {
            dist[cell] = 0;
        });
        for (let head = 0; head < queue.length; head++) {
            const current = queue[head];
            for (let dir = 0; dir < 6; dir++) {
                const next = neighbors[current][dir];
                if (next >= 0 && dist[next] === -1) {
                    dist[next] = dist[current] + 1;
                    queue.push(next);
                }
            }
        }
        return dist;
    };

    const dist = {};
    Object.entries(triangles).forEach(([name, cellsOfTriangle]) => {
        dist[name] = distanceToTriangle(cellsOfTriangle);
    });

    boardCache = {
        cells,
        neighbors,
        triangles,
        home: { blue: triangles[HOME.blue], red: triangles[HOME.red] },
        goal: { blue: triangles[GOAL.blue], red: triangles[GOAL.red] },
        dist,
        goalSet: {
            blue: new Set(triangles[GOAL.blue]),
            red: new Set(triangles[GOAL.red])
        }
    };
    return boardCache;
};

/* ---------------- 开局 ---------------- */
export const createInitialState = (firstPlayer = 'blue') => {
    const board = getBoard();
    return {
        pieces: {
            blue: [...board.home.blue],
            red: [...board.home.red]
        },
        turn: firstPlayer,
        winner: null,
        lastMove: null,
        log: []
    };
};

const occupiedSet = (pieces) => new Set([...pieces.blue, ...pieces.red]);

/* ---------------- 走法生成 ---------------- */
/**
 * 生成当前一方的全部合法走法
 * 每项：{ piece, from, to, path, jumps }
 * - 单步：只能走到相邻空位，jumps 为 0
 * - 连跳：跨过相邻棋子落到其后方空位，允许连续变向，jumps 为跳跃次数
 */
export const getLegalMoves = (state, player = state.turn) => {
    const board = getBoard();
    const occupied = occupiedSet(state.pieces);
    const moves = [];

    state.pieces[player].forEach((start, piece) => {
        /* 单步 */
        for (let dir = 0; dir < 6; dir++) {
            const target = board.neighbors[start][dir];
            if (target >= 0 && !occupied.has(target)) {
                moves.push({ piece, from: start, to: target, path: [start, target], jumps: 0 });
            }
        }

        /* 连跳：BFS 搜索所有可落点，并保留路径用于显示 */
        const visited = new Set([start]);
        const queue = [{ cell: start, path: [start] }];

        for (let head = 0; head < queue.length; head++) {
            const { cell, path } = queue[head];
            for (let dir = 0; dir < 6; dir++) {
                const middle = board.neighbors[cell][dir];
                if (middle < 0 || !occupied.has(middle)) continue;

                const landing = board.neighbors[middle][dir];
                if (landing < 0 || occupied.has(landing) || visited.has(landing)) continue;

                visited.add(landing);
                const nextPath = [...path, landing];
                moves.push({
                    piece,
                    from: start,
                    to: landing,
                    path: nextPath,
                    jumps: nextPath.length - 1
                });
                queue.push({ cell: landing, path: nextPath });
            }
        }
    });

    return moves;
};

/* 某枚棋子可选的落点（用于高亮） */
export const getMovesFrom = (state, player, cell) =>
    getLegalMoves(state, player).filter((move) => move.from === cell);

/* ---------------- 落子 ---------------- */
export const applyMove = (state, move) => {
    const player = state.turn;
    const pieces = {
        blue: [...state.pieces.blue],
        red: [...state.pieces.red]
    };
    pieces[player][move.piece] = move.to;

    const next = {
        pieces,
        turn: otherPlayer(player),
        winner: null,
        lastMove: {
            player,
            piece: move.piece,
            from: move.from,
            to: move.to,
            path: move.path,
            jumps: move.jumps
        },
        log: [
            ...state.log,
            {
                player,
                piece: move.piece,
                from: move.from,
                to: move.to,
                jumps: move.jumps
            }
        ]
    };

    if (isWinner(next.pieces, player)) {
        next.winner = player;
        next.turn = null;
    }
    return next;
};

export const isWinner = (pieces, player) => {
    const board = getBoard();
    const goal = board.goalSet[player];
    return pieces[player].every((cell) => goal.has(cell));
};

export const countOnGoal = (pieces, player) => {
    const board = getBoard();
    const goal = board.goalSet[player];
    return pieces[player].filter((cell) => goal.has(cell)).length;
};

export const countInHome = (pieces, player) => {
    const home = new Set(getBoard().home[player]);
    return pieces[player].filter((cell) => home.has(cell)).length;
};

/* ---------------- AI ---------------- */
/* 距离越小越好，进入目标三角额外加分 */
const progressOf = (pieces, player) => {
    const board = getBoard();
    const dist = board.dist[GOAL[player]];
    let distance = 0;
    let onGoal = 0;
    pieces[player].forEach((cell) => {
        distance += dist[cell];
        if (board.goalSet[player].has(cell)) onGoal += 1;
    });
    return -distance + onGoal * 18;
};

const evaluate = (state, me) => progressOf(state.pieces, me) - progressOf(state.pieces, otherPlayer(me));

const shuffled = (list) => {
    const array = [...list];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * 选择一步走法
 * - easy：随机，但有一半概率优先选跳跃
 * - medium：贪心，选即时评估最高的一步
 * - hard：在候选中模拟对手的最佳回应，做一层前瞻
 */
export const getAIMove = (state, player, difficulty = 'medium') => {
    const moves = getLegalMoves(state, player);
    if (!moves.length) return null;

    if (difficulty === 'easy') {
        const jumps = moves.filter((move) => move.jumps > 0);
        const pool = jumps.length && Math.random() < 0.5 ? jumps : moves;
        return shuffled(pool)[0];
    }

    const scored = moves
        .map((move) => ({
            move,
            score: evaluate(applyMove(state, move), player)
        }))
        .sort((a, b) => b.score - a.score);

    if (difficulty === 'medium') {
        const best = scored[0].score;
        const top = scored.filter((item) => item.score >= best - 0.5);
        return shuffled(top)[0].move;
    }

    /* hard：对前若干个候选再做一层对手回应推演 */
    const candidates = scored.slice(0, 10);
    let bestMove = candidates[0].move;
    let bestValue = Number.NEGATIVE_INFINITY;

    candidates.forEach(({ move }) => {
        const after = applyMove(state, move);
        const replies = getLegalMoves(after, after.turn);
        let worst = evaluate(after, player);
        replies.forEach((reply) => {
            const value = evaluate(applyMove(after, reply), player);
            if (value < worst) worst = value;
        });
        const value = evaluate(after, player) * 0.4 + worst * 0.6;
        if (value > bestValue) {
            bestValue = value;
            bestMove = move;
        }
    });

    return bestMove;
};

/* 提示：等同困难档的一步推荐 */
export const findHint = (state, player) => getAIMove(state, player, 'hard');
