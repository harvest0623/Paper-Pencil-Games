/* ============================================================
   数桥（Hashiwokakero）核心逻辑
   ------------------------------------------------------------
   - 岛屿：每个岛标注一个数字，表示与它相连的桥的总数
   - 桥：只能水平或垂直连接两座岛，配对之间最多两座桥
   - 约束：桥不能跨越其他岛、不能交叉，所有岛必须连成一片
   ============================================================ */

import { PUZZLES } from './puzzles.js';

export const EMPTY = 0;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export const DIFFICULTIES = [
    {
        id: 'easy',
        label: '入门',
        rows: 7,
        cols: 7,
        desc: '7×7 棋盘、11 座岛，桥路清晰，适合先熟悉「单击两岛建桥」的手感。'
    },
    {
        id: 'medium',
        label: '进阶',
        rows: 9,
        cols: 9,
        desc: '9×9 棋盘、18 座岛，桥路开始交错，需要留意交叉与连通性。'
    },
    {
        id: 'hard',
        label: '挑战',
        rows: 11,
        cols: 11,
        desc: '11×11 棋盘、26 座岛，长距离连线与环路并存，推理链更长。'
    }
];

export const coordLabel = (row, col) => `${LETTERS[col]}${row + 1}`;

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/* Fisher–Yates 洗牌 */
const shuffle = (list) => {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/* 构造所有候选桥：同排或同列、中间没有其他岛 */
const buildLinks = (islands) => {
    const links = [];

    for (let i = 0; i < islands.length; i += 1) {
        for (let j = i + 1; j < islands.length; j += 1) {
            const a = islands[i];
            const b = islands[j];
            let dir = null;
            let blocked = false;

            if (a.row === b.row) {
                dir = 'h';
                const lo = Math.min(a.col, b.col);
                const hi = Math.max(a.col, b.col);
                blocked = islands.some(
                    (other) =>
                        other.id !== a.id &&
                        other.id !== b.id &&
                        other.row === a.row &&
                        other.col > lo &&
                        other.col < hi
                );
            } else if (a.col === b.col) {
                dir = 'v';
                const lo = Math.min(a.row, b.row);
                const hi = Math.max(a.row, b.row);
                blocked = islands.some(
                    (other) =>
                        other.id !== a.id &&
                        other.id !== b.id &&
                        other.col === a.col &&
                        other.row > lo &&
                        other.row < hi
                );
            } else {
                continue;
            }

            if (blocked) continue;

            links.push({
                id: links.length,
                a: i,
                b: j,
                dir,
                label: `${a.label}–${b.label}`
            });
        }
    }

    return links;
};

/* 交叉关系：横桥与竖桥在非岛格相交 */
const buildCrossings = (islands, links) => {
    const pairs = [];

    for (let i = 0; i < links.length; i += 1) {
        for (let j = i + 1; j < links.length; j += 1) {
            const link = links[i];
            const other = links[j];
            if (link.dir === other.dir) continue;

            const h = link.dir === 'h' ? link : other;
            const v = link.dir === 'h' ? other : link;
            const ha = islands[h.a];
            const hb = islands[h.b];
            const va = islands[v.a];
            const vb = islands[v.b];

            const hLo = Math.min(ha.col, hb.col);
            const hHi = Math.max(ha.col, hb.col);
            const vLo = Math.min(va.row, vb.row);
            const vHi = Math.max(va.row, vb.row);

            if (
                va.col > hLo &&
                va.col < hHi &&
                ha.row > vLo &&
                ha.row < vHi
            ) {
                pairs.push([i, j]);
            }
        }
    }

    return pairs;
};

const lastIndex = { easy: -1, medium: -1, hard: -1 };

/* 创建一局：从题库抽取唯一解题目 */
export const createSession = (difficultyId = 'easy') => {
    const config =
        DIFFICULTIES.find((item) => item.id === difficultyId) ?? DIFFICULTIES[0];
    const bank = PUZZLES[config.id] ?? PUZZLES.easy;
    let index = Math.floor(Math.random() * bank.length);
    if (bank.length > 1 && index === lastIndex[config.id]) {
        index = (index + 1) % bank.length;
    }
    lastIndex[config.id] = index;

    const puzzle = bank[index];
    const islands = puzzle.islands.map(([row, col, clue], id) => ({
        id,
        row,
        col,
        clue,
        label: coordLabel(row, col)
    }));
    const links = buildLinks(islands);
    const crossings = buildCrossings(islands, links);
    const crossMap = new Map();
    links.forEach((link) => crossMap.set(link.id, []));
    crossings.forEach(([i, j]) => {
        crossMap.get(i).push(j);
        crossMap.get(j).push(i);
    });
    links.forEach((link) => {
        link.crosses = crossMap.get(link.id);
    });

    const linkBetween = new Map();
    links.forEach((link) => {
        linkBetween.set(pairKey(link.a, link.b), link.id);
    });

    const solutionByKey = new Map(
        puzzle.solution.map(([a, b, count]) => [pairKey(a, b), count])
    );

    const solutionCounts = links.map(
        (link) => solutionByKey.get(pairKey(link.a, link.b)) ?? 0
    );

    return {
        config,
        rows: puzzle.rows,
        cols: puzzle.cols,
        index,
        islands,
        links,
        crossings,
        linkBetween,
        solutionCounts,
        initial: {
            counts: Array(links.length).fill(EMPTY),
            log: []
        }
    };
};

export const createInitialState = (session) => ({
    counts: Array(session.links.length).fill(EMPTY),
    log: []
});

/* 两座岛之间的候选桥 id，不相邻时返回 null */
export const findLinkId = (session, a, b) =>
    session.linkBetween.get(pairKey(a, b)) ?? null;

/* 岛屿当前桥数 */
export const islandSums = (session, counts) => {
    const sums = Array(session.islands.length).fill(0);
    session.links.forEach((link) => {
        const value = counts[link.id] ?? 0;
        if (value > 0) {
            sums[link.a] += value;
            sums[link.b] += value;
        }
    });
    return sums;
};

/* 连通性：所有有桥的岛是否在同一片网络 */
const isConnected = (session, counts) => {
    const n = session.islands.length;
    if (n <= 1) return true;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (x) => {
        let current = x;
        while (parent[current] !== current) {
            parent[current] = parent[parent[current]];
            current = parent[current];
        }
        return current;
    };

    session.links.forEach((link) => {
        if ((counts[link.id] ?? 0) <= 0) return;
        const ra = find(link.a);
        const rb = find(link.b);
        if (ra !== rb) parent[ra] = rb;
    });

    return new Set(session.islands.map((_, i) => find(i))).size === 1;
};

/* 冲突检测：超出数字、桥交叉、连通性、是否完成 */
export const analyzeBoard = (session, counts) => {
    const sums = islandSums(session, counts);

    const overfilled = new Set();
    session.islands.forEach((island) => {
        if (sums[island.id] > island.clue) overfilled.add(island.id);
    });

    const crossingLinks = new Set();
    session.crossings.forEach(([i, j]) => {
        if ((counts[i] ?? 0) > 0 && (counts[j] ?? 0) > 0) {
            crossingLinks.add(i);
            crossingLinks.add(j);
        }
    });

    const completed = session.islands.filter(
        (island) => sums[island.id] === island.clue
    ).length;
    const allCluesMet = completed === session.islands.length;
    const connected = isConnected(session, counts);
    const bridgeCount = counts.reduce((total, value) => total + value, 0);

    return {
        sums,
        overfilled,
        crossingLinks,
        completed,
        allCluesMet,
        connected,
        bridgeCount,
        solved: allCluesMet && connected && crossingLinks.size === 0
    };
};

/* 依次单击两座岛时的桥数循环：0 → 1 → 2 → 0 */
export const cycleCount = (count) => (count + 1) % 3;

/* 点击已有桥时减少一座 */
export const decreaseCount = (count) => Math.max(0, count - 1);

/* 找到与指定岛相连的所有候选伙伴（仅用于高亮提示） */
export const partnersOf = (session, islandId) => {
    const set = new Set();
    session.links.forEach((link) => {
        if (link.a === islandId) set.add(link.b);
        if (link.b === islandId) set.add(link.a);
    });
    return set;
};

/* 与当前解不符、且多建了桥的连接 */
export const wrongLinks = (session, counts) =>
    session.links.filter(
        (link) => (counts[link.id] ?? 0) > session.solutionCounts[link.id]
    );

/* 提示：优先指出冲突，其次补一座正确的桥 */
export const findHint = (session, counts) => {
    const analysis = analyzeBoard(session, counts);

    if (analysis.overfilled.size > 0) {
        const islandId = analysis.overfilled.values().next().value;
        const island = session.islands[islandId];
        return {
            type: 'island',
            id: islandId,
            build: false,
            message: `${island.label} 的桥数超出了 ${analysis.sums[islandId] - island.clue} 座，先点击多余的桥移除`
        };
    }

    if (analysis.crossingLinks.size > 0) {
        const linkId = analysis.crossingLinks.values().next().value;
        return {
            type: 'link',
            id: linkId,
            build: false,
            message: `这里的两座桥交叉了，点击其中一座移除`
        };
    }

    const wrong = wrongLinks(session, counts);
    if (wrong.length > 0) {
        const link = wrong[0];
        return {
            type: 'link',
            id: link.id,
            build: false,
            message: `${link.label} 之间多建了桥，点击桥可以减少一座`
        };
    }

    const missing = session.links.filter(
        (link) => (counts[link.id] ?? 0) < session.solutionCounts[link.id]
    );
    if (missing.length > 0) {
        const link = shuffle(missing)[0];
        const remain =
            session.solutionCounts[link.id] - (counts[link.id] ?? 0);
        return {
            type: 'link',
            id: link.id,
            build: true,
            message: `${link.label} 还需要 ${remain} 座桥`,
            link
        };
    }

    return null;
};
