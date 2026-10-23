/* ============================================================
   推箱子纯逻辑层
   ------------------------------------------------------------
   地图字符：
     #  墙      空格  地板      .  目标点
     $  箱子    *  箱子已在目标点
     @  玩家    +  玩家站在目标点
   状态：{ player: {row,col}, boxes: [{id,row,col}] }
   ============================================================ */

export const TIERS = [
    {
        id: 'easy',
        label: '入门',
        desc: '箱子少、空间宽，先熟悉推动与绕行的基本手感，四关循序渐进。'
    },
    {
        id: 'medium',
        label: '进阶',
        desc: '箱子增多、路线开始分叉，需要提前想好先推哪一个，避免互相挡路。'
    },
    {
        id: 'hard',
        label: '挑战',
        desc: '走廊与死角并存，一步走错就可能把箱子推进无法挽回的位置。'
    }
];

export const LEVELS = [
    {
        id: 'e1',
        tier: 'easy',
        label: '第 1 关',
        name: '第一次推动',
        par: 1,
        map: [
            '#######',
            '#     #',
            '# .$  #',
            '#  @  #',
            '#     #',
            '#######'
        ]
    },
    {
        id: 'e2',
        tier: 'easy',
        label: '第 2 关',
        name: '绕过立柱',
        par: 2,
        map: [
            '#########',
            '#       #',
            '#  #    #',
            '#  $ .  #',
            '#  @    #',
            '#       #',
            '#########'
        ]
    },
    {
        id: 'e3',
        tier: 'easy',
        label: '第 3 关',
        name: '左右开弓',
        par: 2,
        map: [
            '#########',
            '#       #',
            '# .   . #',
            '# $   $ #',
            '#   @   #',
            '#       #',
            '#########'
        ]
    },
    {
        id: 'e4',
        tier: 'easy',
        label: '第 4 关',
        name: '檐下通道',
        par: 2,
        map: [
            '##########',
            '#        #',
            '#   ###  #',
            '# . $    #',
            '#   @    #',
            '#        #',
            '##########'
        ]
    },
    {
        id: 'm1',
        tier: 'medium',
        label: '第 1 关',
        name: '三箱并进',
        par: 6,
        map: [
            '##########',
            '#        #',
            '# . . .  #',
            '#        #',
            '# $ $ $  #',
            '#   @    #',
            '#        #',
            '##########'
        ]
    },
    {
        id: 'm2',
        tier: 'medium',
        label: '第 2 关',
        name: '隔墙双箱',
        par: 2,
        map: [
            '##########',
            '#        #',
            '#  ##    #',
            '#  .$    #',
            '#   @    #',
            '#  .$    #',
            '#        #',
            '##########'
        ]
    },
    {
        id: 'm3',
        tier: 'medium',
        label: '第 3 关',
        name: '向下归位',
        par: 2,
        map: [
            '##########',
            '#        #',
            '#  $ $   #',
            '#  . .   #',
            '#   @    #',
            '#        #',
            '##########'
        ]
    },
    {
        id: 'm4',
        tier: 'medium',
        label: '第 4 关',
        name: '五箱错落',
        par: 3,
        map: [
            '###########',
            '#         #',
            '#  #####  #',
            '#  .   .  #',
            '#  $   $  #',
            '#    @    #',
            '#    $    #',
            '#    .    #',
            '#         #',
            '###########'
        ]
    },
    {
        id: 'h1',
        tier: 'hard',
        label: '第 1 关',
        name: '双室三箱',
        par: 3,
        map: [
            '#########',
            '#   #   #',
            '# . # . #',
            '# $ # $ #',
            '#   #   #',
            '## ### ##',
            '#       #',
            '#   $   #',
            '#   .   #',
            '#   @   #',
            '#########'
        ]
    },
    {
        id: 'h2',
        tier: 'hard',
        label: '第 2 关',
        name: '四方对推',
        par: 4,
        map: [
            '###########',
            '#         #',
            '#  .   .  #',
            '#  $   $  #',
            '#         #',
            '#  $   $  #',
            '#  .   .  #',
            '#    @    #',
            '#         #',
            '###########'
        ]
    },
    {
        id: 'h3',
        tier: 'hard',
        label: '第 3 关',
        name: '廊道四箱',
        par: 4,
        map: [
            '############',
            '#          #',
            '#  .    .  #',
            '#  $    $  #',
            '#          #',
            '###  ##  ###',
            '#          #',
            '#  $    $  #',
            '#  .    .  #',
            '#     @    #',
            '############'
        ]
    },
    {
        id: 'h4',
        tier: 'hard',
        label: '第 4 关',
        name: '终局五箱',
        par: 5,
        map: [
            '############',
            '#          #',
            '#  . . .   #',
            '#  $ $ $   #',
            '#          #',
            '#   $ $    #',
            '#   . .    #',
            '#     @    #',
            '#          #',
            '############'
        ]
    }
];

/* 方向定义，顺序与邻居表下标一致 */
export const DIRECTIONS = ['up', 'down', 'left', 'right'];

export const DIR_LABELS = {
    up: '向上',
    down: '向下',
    left: '向左',
    right: '向右'
};

export const DIR_GLYPHS = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→'
};

const OPPOSITE = [1, 0, 3, 2];

export const getTier = (id) => TIERS.find((tier) => tier.id === id) ?? TIERS[0];

export const getLevel = (id) => LEVELS.find((level) => level.id === id) ?? LEVELS[0];

export const getLevelsByTier = (tierId) => LEVELS.filter((level) => level.tier === tierId);

export const getNextLevel = (id) => {
    const index = LEVELS.findIndex((level) => level.id === id);
    return index >= 0 && index < LEVELS.length - 1 ? LEVELS[index + 1] : null;
};

/* ---------------- 地图解析 ---------------- */
const levelCache = new Map();

export const parseLevel = (weakLevel) => {
    if (levelCache.has(weakLevel.id)) return levelCache.get(weakLevel.id);

    const rows = weakLevel.map.length;
    const cols = Math.max(...weakLevel.map.map((line) => line.length));
    const walls = new Array(rows * cols).fill(true);
    const goals = new Array(rows * cols).fill(false);
    const boxes = [];
    let player = null;

    for (let row = 0; row < rows; row++) {
        const line = weakLevel.map[row];
        for (let col = 0; col < cols; col++) {
            const ch = line[col] ?? '#';
            const index = row * cols + col;
            if (ch === '#') continue;
            walls[index] = false;

            if (ch === '.' || ch === '*' || ch === '+') goals[index] = true;
            if (ch === '$' || ch === '*') {
                boxes.push({ id: `${weakLevel.id}-${boxes.length}`, row, col });
            }
            if (ch === '@' || ch === '+') player = { row, col };
        }
    }

    /* 预计算四邻下标，-1 表示越界 */
    const neighbors = new Array(rows * cols).fill(null).map(() => [-1, -1, -1, -1]);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            if (walls[index]) continue;
            if (row > 0 && !walls[(row - 1) * cols + col]) neighbors[index][0] = (row - 1) * cols + col;
            if (row < rows - 1 && !walls[(row + 1) * cols + col]) {
                neighbors[index][1] = (row + 1) * cols + col;
            }
            if (col > 0 && !walls[row * cols + col - 1]) neighbors[index][2] = row * cols + col - 1;
            if (col < cols - 1 && !walls[row * cols + col + 1]) neighbors[index][3] = row * cols + col + 1;
        }
    }

    /* 每个格子到最近目标点的步数（忽略箱子），用于启发式评估 */
    const distToGoal = new Int32Array(rows * cols).fill(-1);
    const queue = [];
    for (let index = 0; index < goals.length; index++) {
        if (goals[index]) {
            distToGoal[index] = 0;
            queue.push(index);
        }
    }
    for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        for (let d = 0; d < 4; d++) {
            const next = neighbors[current][d];
            if (next >= 0 && distToGoal[next] === -1) {
                distToGoal[next] = distToGoal[current] + 1;
                queue.push(next);
            }
        }
    }

    const parsed = {
        ...weakLevel,
        rows,
        cols,
        walls,
        goals,
        neighbors,
        distToGoal,
        initial: { player, boxes }
    };

    levelCache.set(weakLevel.id, parsed);
    return parsed;
};

export const getParsedLevel = (id) => parseLevel(getLevel(id));

/* 开局状态（深拷贝，避免与缓存共享引用） */
export const createInitialState = (parsed) => ({
    player: { ...parsed.initial.player },
    boxes: parsed.initial.boxes.map((box) => ({ ...box })),
    moves: 0,
    pushes: 0,
    log: []
});

/* ---------------- 基础判定 ---------------- */
const boxAt = (boxes, index, cols) => boxes.find((box) => box.row * cols + box.col === index);

export const countOnGoal = (state, parsed) =>
    state.boxes.filter((box) => parsed.goals[box.row * parsed.cols + box.col]).length;

export const isSolved = (state, parsed) =>
    state.boxes.every((box) => parsed.goals[box.row * parsed.cols + box.col]);

/**
 * 尝试向某个方向移动一步
 * 返回 { player, boxes, pushed, boxId, boxFrom, boxTo } 或 null（被挡住）
 */
export const tryMove = (state, parsed, dir) => {
    const dirIndex = DIRECTIONS.indexOf(dir);
    if (dirIndex < 0) return null;

    const { cols } = parsed;
    const playerIndex = state.player.row * cols + state.player.col;
    const targetIndex = parsed.neighbors[playerIndex][dirIndex];
    if (targetIndex < 0) return null;

    const targetRow = Math.floor(targetIndex / cols);
    const targetCol = targetIndex % cols;
    const box = boxAt(state.boxes, targetIndex, cols);

    if (!box) {
        return {
            player: { row: targetRow, col: targetCol },
            boxes: state.boxes,
            pushed: false
        };
    }

    const beyondIndex = parsed.neighbors[targetIndex][dirIndex];
    if (beyondIndex < 0) return null;
    if (boxAt(state.boxes, beyondIndex, cols)) return null;

    const beyondRow = Math.floor(beyondIndex / cols);
    const beyondCol = beyondIndex % cols;
    return {
        player: { row: targetRow, col: targetCol },
        boxes: state.boxes.map((item) =>
            item.id === box.id ? { ...item, row: beyondRow, col: beyondCol } : item
        ),
        pushed: true,
        boxId: box.id,
        boxFrom: { row: box.row, col: box.col },
        boxTo: { row: beyondRow, col: beyondCol }
    };
};

/* 某方向是否可行（用于界面提示） */
export const canMove = (state, parsed, dir) => tryMove(state, parsed, dir) !== null;

/* ---------------- 可行走区域 ---------------- */
const reachableFrom = (parsed, startIndex, boxSet) => {
    const visited = new Uint8Array(parsed.rows * parsed.cols);
    const parents = new Int32Array(parsed.rows * parsed.cols).fill(-2);
    const queue = [startIndex];
    visited[startIndex] = 1;
    parents[startIndex] = -1;

    for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        for (let d = 0; d < 4; d++) {
            const next = parsed.neighbors[current][d];
            if (next < 0 || visited[next] || boxSet.has(next)) continue;
            visited[next] = 1;
            parents[next] = current;
            queue.push(next);
        }
    }
    return { visited, parents };
};

const buildBoxSet = (boxes, cols) => new Set(boxes.map((box) => box.row * cols + box.col));

/* ---------------- A* 推箱求解 ---------------- */
const heapPush = (heap, node) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].f <= heap[index].f) break;
        [heap[parent], heap[index]] = [heap[index], heap[parent]];
        index = parent;
    }
};

const heapPop = (heap) => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
        heap[0] = last;
        let index = 0;
        for (;;) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;
            if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left;
            if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right;
            if (smallest === index) break;
            [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
            index = smallest;
        }
    }
    return top;
};

const heuristic = (parsed, boxes) => {
    let total = 0;
    for (let i = 0; i < boxes.length; i++) {
        const dist = parsed.distToGoal[boxes[i]];
        if (dist < 0) return Number.POSITIVE_INFINITY;
        total += dist;
    }
    return total;
};

const isCornerDeadlock = (parsed, index) => {
    if (parsed.goals[index]) return false;
    const up = parsed.neighbors[index][0] < 0;
    const down = parsed.neighbors[index][1] < 0;
    const left = parsed.neighbors[index][2] < 0;
    const right = parsed.neighbors[index][3] < 0;
    return (up || down) && (left || right);
};

/**
 * 以「推动」为步长做 A*，返回最短推动序列
 * 每项：{ approach, boxFrom, boxTo, dir }
 */
export const solvePushes = (parsed, state, options = {}) => {
    const maxNodes = options.maxNodes ?? 40000;
    const cols = parsed.cols;
    const goalCount = parsed.goals.filter(Boolean).length;

    if (state.boxes.length !== goalCount) return null;
    if (isSolved(state, parsed)) return [];

    const startPlayer = state.player.row * cols + state.player.col;
    const startBoxes = state.boxes
        .map((box) => box.row * cols + box.col)
        .sort((a, b) => a - b);

    const heap = [];
    const closed = new Map();
    const startKey = `${startPlayer}|${startBoxes.join(',')}`;
    heapPush(heap, {
        player: startPlayer,
        boxes: startBoxes,
        g: 0,
        f: heuristic(parsed, startBoxes),
        parent: null,
        action: null
    });
    closed.set(startKey, 0);

    let expanded = 0;
    while (heap.length) {
        const node = heapPop(heap);
        if (node.f === Number.POSITIVE_INFINITY) break;
        if (node.boxes.every((index) => parsed.goals[index])) {
            const actions = [];
            let cursor = node;
            while (cursor.action) {
                actions.push(cursor.action);
                cursor = cursor.parent;
            }
            return actions.reverse();
        }
        if (expanded++ > maxNodes) break;

        const boxSet = new Set(node.boxes);
        const { visited } = reachableFrom(parsed, node.player, boxSet);

        for (let b = 0; b < node.boxes.length; b++) {
            const boxIndex = node.boxes[b];
            for (let d = 0; d < 4; d++) {
                const approach = parsed.neighbors[boxIndex][OPPOSITE[d]];
                const boxTo = parsed.neighbors[boxIndex][d];
                if (approach < 0 || boxTo < 0) continue;
                if (!visited[approach]) continue;
                if (boxSet.has(boxTo)) continue;
                if (isCornerDeadlock(parsed, boxTo)) continue;

                const nextBoxes = node.boxes.filter((_, i) => i !== b);
                nextBoxes.push(boxTo);
                nextBoxes.sort((a, b2) => a - b2);

                const key = `${boxIndex}|${nextBoxes.join(',')}`;
                const g = node.g + 1;
                const seen = closed.get(key);
                if (seen != null && seen <= g) continue;
                closed.set(key, g);

                const h = heuristic(parsed, nextBoxes);
                if (h === Number.POSITIVE_INFINITY) continue;

                heapPush(heap, {
                    player: boxIndex,
                    boxes: nextBoxes,
                    g,
                    f: g + h,
                    parent: node,
                    action: { approach, boxFrom: boxIndex, boxTo, dir: d }
                });
            }
        }
    }

    return null;
};

/* 从玩家当前格走到目标格的第一步方向 */
const firstStepToward = (parsed, state, targetIndex) => {
    const { cols } = parsed;
    const boxSet = buildBoxSet(state.boxes, cols);
    const start = state.player.row * cols + state.player.col;
    const { parents } = reachableFrom(parsed, start, boxSet);
    if (parents[targetIndex] === -2) return null;

    let cursor = targetIndex;
    let previous = parents[cursor];
    while (previous !== -1 && previous !== start) {
        cursor = previous;
        previous = parents[cursor];
    }
    if (cursor === start) return null;

    const delta = cursor - start;
    if (delta === -cols) return 'up';
    if (delta === cols) return 'down';
    if (delta === -1) return 'left';
    return 'right';
};

/**
 * 给玩家的下一步建议：{ dir, target }
 * 优先走最短解法的第一步，找不到解法时返回 null
 */
export const findHint = (parsed, state) => {
    const actions = solvePushes(parsed, state);
    if (!actions || !actions.length) return null;

    const first = actions[0];
    const walkDir = firstStepToward(parsed, state, first.approach);
    const dir = walkDir ?? DIRECTIONS[first.dir];

    const startIndex = state.player.row * parsed.cols + state.player.col;
    const targetIndex = parsed.neighbors[startIndex][DIRECTIONS.indexOf(dir)];
    if (targetIndex < 0) return null;

    return {
        dir,
        target: {
            row: Math.floor(targetIndex / parsed.cols),
            col: targetIndex % parsed.cols
        }
    };
};
