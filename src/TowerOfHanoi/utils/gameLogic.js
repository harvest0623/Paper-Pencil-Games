/* ============================================================
   汉诺塔（Tower of Hanoi）核心逻辑
   ------------------------------------------------------------
   - 三根柱子，圆盘由小到大编号 1…n
   - 每次只能移动一根柱子塔顶的圆盘
   - 大盘不能压在小盘上
   - 目标：把所有圆盘按小到大叠到 C 柱
   ============================================================ */

export const PEG_LABELS = ['A', 'B', 'C'];
export const PEG_NAMES = ['A 柱', 'B 柱', 'C 柱'];
export const TARGET_PEG = 2;

export const DIFFICULTIES = [
    {
        id: 'easy',
        label: '入门',
        disks: 3,
        desc: '3 个圆盘，最少 7 步。先熟悉「点柱子选中塔顶、再点另一根柱子」的操作。'
    },
    {
        id: 'medium',
        label: '进阶',
        disks: 4,
        desc: '4 个圆盘，最少 15 步。需要提前规划，别让大盘堵在辅助柱上。'
    },
    {
        id: 'hard',
        label: '挑战',
        disks: 5,
        desc: '5 个圆盘，最少 31 步。每一次搬运都要为后面的递归留出空位。'
    }
];

/* 最少步数：2^n - 1 */
export const minimumMoves = (disks) => 2 ** disks - 1;

/* 一局的状态：三根柱子，数组顺序为「自下而上」 */
export const createSession = (difficultyId = 'easy') => {
    const config =
        DIFFICULTIES.find((item) => item.id === difficultyId) ?? DIFFICULTIES[0];
    const disks = config.disks;
    const first = Array.from({ length: disks }, (_, index) => disks - index);

    return {
        config,
        disks,
        minimum: minimumMoves(disks),
        initial: {
            pegs: [first, [], []],
            log: []
        }
    };
};

/* 柱子塔顶的圆盘编号，空柱返回 0 */
export const topDisk = (pegs, index) =>
    pegs[index].length ? pegs[index][pegs[index].length - 1] : 0;

/* 是否可以合法移动 */
export const canMove = (pegs, from, to) => {
    if (from === to) return false;
    const disk = topDisk(pegs, from);
    if (!disk) return false;
    const target = topDisk(pegs, to);
    return target === 0 || disk < target;
};

/* 返回移动后的新柱子数组，不修改原状态 */
export const moveDisk = (pegs, from, to) =>
    pegs.map((stack, index) => {
        if (index === from) return stack.slice(0, -1);
        if (index === to) return [...stack, topDisk(pegs, from)];
        return [...stack];
    });

/* 是否完成：所有圆盘都在 C 柱 */
export const isSolved = (pegs, disks) => pegs[TARGET_PEG].length === disks;

/* C 柱上已经就位的圆盘数，用于进度展示 */
export const countOnTarget = (pegs) => pegs[TARGET_PEG].length;

/* 每一步的展示文案 */
export const moveLabel = (from, to) =>
    `${PEG_LABELS[from]} → ${PEG_LABELS[to]}`;

/* ---------------- 提示：BFS 求当前局面的最优下一步 ---------------- */

/* 状态编码：size 号盘所在的柱号作为三进制的一位 */
const encode = (pegs, disks) => {
    let code = 0;
    let factor = 1;
    for (let size = 1; size <= disks; size += 1) {
        let pos = 0;
        for (let peg = 0; peg < PEG_LABELS.length; peg += 1) {
            if (pegs[peg].includes(size)) {
                pos = peg;
                break;
            }
        }
        code += pos * factor;
        factor *= PEG_LABELS.length;
    }
    return code;
};

/* 三进制解码，还原成自下而上的柱子数组 */
const decode = (code, disks) => {
    const pegs = [[], [], []];
    for (let size = disks; size >= 1; size -= 1) {
        const pos =
            Math.floor(code / PEG_LABELS.length ** (size - 1)) %
            PEG_LABELS.length;
        pegs[pos].push(size);
    }
    return pegs;
};

/**
 * 用广度优先搜索找到从当前局面到目标的最短路线，
 * 返回路线的第一步 { from, to, disk }；已完成或无解时返回 null。
 */
export const findHint = (session, pegs) => {
    const disks = session.disks;
    if (isSolved(pegs, disks)) return null;

    const total = PEG_LABELS.length ** disks;
    const goal = total - 1; // 所有圆盘都在 2 号柱
    const start = encode(pegs, disks);
    if (start === goal) return null;

    const visited = new Map();
    visited.set(start, { prev: null, move: null });
    const queue = [start];
    let found = null;

    for (let head = 0; head < queue.length && found === null; head += 1) {
        const code = queue[head];
        const state = decode(code, disks);
        const tops = state.map((stack) =>
            stack.length ? stack[stack.length - 1] : 0
        );

        for (let from = 0; from < PEG_LABELS.length; from += 1) {
            if (!tops[from]) continue;
            for (let to = 0; to < PEG_LABELS.length; to += 1) {
                if (to === from) continue;
                if (tops[to] && tops[to] <= tops[from]) continue;

                const nextState = state.map((stack) => [...stack]);
                nextState[to].push(nextState[from].pop());
                const nextCode = encode(nextState, disks);
                if (visited.has(nextCode)) continue;

                visited.set(nextCode, {
                    prev: code,
                    move: { from, to, disk: tops[from] }
                });

                if (nextCode === goal) {
                    found = nextCode;
                    break;
                }
                queue.push(nextCode);
            }
            if (found !== null) break;
        }
    }

    if (found === null) return null;

    /* 从终点回溯到起点，取最靠近起点的那一步 */
    let first = null;
    let cursor = found;
    while (cursor !== null) {
        const node = visited.get(cursor);
        if (node.prev === null) break;
        first = node.move;
        cursor = node.prev;
    }

    return first;
};
