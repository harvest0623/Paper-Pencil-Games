/* ============================================================
   海战棋 · 电脑引擎
   简单：完全随机扫描
   中等：命中后优先攻击相邻格，命中成线后沿两端延展
   困难：在中等的追打之上，搜索期使用棋盘奇偶性筛选（最短舰为 2 格，
         因此敌舰必然覆盖一半的棋盘格），效率明显更高
   ============================================================ */

import { freeCells, activeHits, neighbors, shotAt, inBounds } from './gameLogic';

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

/* 搜索期：纯随机 / 奇偶筛选 */
function huntShot(enemySide, parity) {
    const free = freeCells(enemySide);
    if (!free.length) return null;
    if (parity) {
        const even = free.filter(({ r, c }) => (r + c) % 2 === 0);
        if (even.length) return pickRandom(even);
    }
    return pickRandom(free);
}

/* 追打期：围绕尚未击沉的命中格继续开火 */
function targetShot(enemySide) {
    const hits = activeHits(enemySide);
    if (!hits.length) return null;

    const rows = new Map();
    const cols = new Map();
    hits.forEach(({ r, c }) => {
        if (!rows.has(r)) rows.set(r, []);
        rows.get(r).push(c);
        if (!cols.has(c)) cols.set(c, []);
        cols.get(c).push(r);
    });

    /* 同一行或同一列已有两处命中：说明敌舰正沿该线延伸，优先打线的两端 */
    const lineCandidates = [];
    const ends = (list) => [Math.min(...list) - 1, Math.max(...list) + 1];
    rows.forEach((list, r) => {
        if (list.length < 2) return;
        ends(list).forEach((c) => {
            if (inBounds(r, c) && !shotAt(enemySide, r, c)) lineCandidates.push({ r, c });
        });
    });
    cols.forEach((list, c) => {
        if (list.length < 2) return;
        ends(list).forEach((r) => {
            if (inBounds(r, c) && !shotAt(enemySide, r, c)) lineCandidates.push({ r, c });
        });
    });
    if (lineCandidates.length) return pickRandom(lineCandidates);

    /* 只有单点命中：优先打四周，并按奇偶性过滤（未被命中的邻格多为偶数格） */
    const near = [];
    hits.forEach(({ r, c }) => {
        neighbors(r, c).forEach(({ r: nr, c: nc }) => {
            if (!shotAt(enemySide, nr, nc)) near.push({ r: nr, c: nc });
        });
    });
    if (near.length) return pickRandom(near);

    return null;
}

/* 输出一炮的目标格；enemySide 为对手海域（含全部命中记录） */
export function getAIShot(enemySide, difficulty = 'medium') {
    if (difficulty === 'easy') return huntShot(enemySide, false);
    const chase = targetShot(enemySide);
    if (chase) return chase;
    return huntShot(enemySide, difficulty === 'hard');
}