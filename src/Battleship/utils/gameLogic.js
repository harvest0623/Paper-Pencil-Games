/* ============================================================
   海战棋 · 纯逻辑层
   双方各自在 10 x 10 的海域上排布 5 艘舰船，然后轮流炮击对方海域。
   坐标：列为 A-J，行为 1-10，例如 A1、D7。
   side = {
       ships: [{ id, name, size, row, col, dir, cells: [{r,c}], hits: ['r-c'] }],
       shots: { 'r-c': { r, c, hit, shipId } }
   }
   ============================================================ */

const SIZE = 10;
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const DIR_H = 'h';
const DIR_V = 'v';

/* 经典五舰：航母 5、战列舰 4、巡洋舰 3、潜艇 3、驱逐舰 2，合计 17 格 */
const FLEET = [
    { id: 'carrier', name: '航母', size: 5 },
    { id: 'battleship', name: '战列舰', size: 4 },
    { id: 'cruiser', name: '巡洋舰', size: 3 },
    { id: 'submarine', name: '潜艇', size: 3 },
    { id: 'destroyer', name: '驱逐舰', size: 2 }
];

const FLEET_CELLS = FLEET.reduce((sum, def) => sum + def.size, 0);

const cellKey = (r, c) => `${r}-${c}`;
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/* 空海域：尚未布舰、也未落弹 */
function createSide() {
    return { ships: [], shots: {} };
}

/* 以 (row, col) 为起点、给定朝向的一艘舰所占的全部格子 */
function shipCells(row, col, dir, size) {
    const cells = [];
    for (let i = 0; i < size; i += 1) {
        cells.push(dir === DIR_V ? { r: row + i, c: col } : { r: row, c: col + i });
    }
    return cells;
}

/* 已有舰船占据的格子 */
function occupiedKeys(side) {
    const keys = new Set();
    side.ships.forEach((ship) => ship.cells.forEach(({ r, c }) => keys.add(cellKey(r, c))));
    return keys;
}

/* 舰船能否停泊：不出界，且不与已有舰船重叠 */
function canPlace(side, row, col, dir, size) {
    const cells = shipCells(row, col, dir, size);
    if (cells.some(({ r, c }) => !inBounds(r, c))) return false;
    const occupied = occupiedKeys(side);
    return cells.every(({ r, c }) => !occupied.has(cellKey(r, c)));
}

/* 落下一艘舰，非法则返回 null */
function placeShip(side, def, row, col, dir) {
    if (!canPlace(side, row, col, dir, def.size)) return null;
    return {
        ...side,
        ships: [
            ...side.ships,
            {
                id: def.id,
                name: def.name,
                size: def.size,
                row,
                col,
                dir,
                cells: shipCells(row, col, dir, def.size),
                hits: []
            }
        ]
    };
}

function removeShip(side, id) {
    return { ...side, ships: side.ships.filter((ship) => ship.id !== id) };
}

function clearShips(side) {
    return { ...side, ships: [] };
}

/* 随机生成一支合法舰队（AI 与「随机布阵」按钮共用） */
function randomFleet(rand = Math.random) {
    let side = createSide();
    FLEET.forEach((def) => {
        for (let attempt = 0; attempt < 500; attempt += 1) {
            const dir = rand() < 0.5 ? DIR_H : DIR_V;
            const row = Math.floor(rand() * SIZE);
            const col = Math.floor(rand() * SIZE);
            const next = placeShip(side, def, row, col, dir);
            if (next) {
                side = next;
                return;
            }
        }
    });
    return side;
}

function shipAt(side, r, c) {
    return (
        side.ships.find((ship) => ship.cells.some((cell) => cell.r === r && cell.c === c)) || null
    );
}

function shotAt(side, r, c) {
    return side.shots[cellKey(r, c)] || null;
}

function isSunk(ship) {
    return ship.hits.length >= ship.size;
}

function isFleetReady(side) {
    return side.ships.length === FLEET.length;
}

function sunkCount(side) {
    return side.ships.filter(isSunk).length;
}

function remainingShips(side) {
    return side.ships.length - sunkCount(side);
}

/* 是否整支舰队都被击沉 */
function allSunk(side) {
    return isFleetReady(side) && side.ships.every(isSunk);
}

function hitCount(side) {
    return Object.values(side.shots).filter((shot) => shot.hit).length;
}

function shotCount(side) {
    return Object.keys(side.shots).length;
}

/* 炮击：返回 { side, hit, sunk, shipId, shipName, allSunk }；非法或重复炮击返回 null */
function fire(side, r, c) {
    if (!inBounds(r, c) || shotAt(side, r, c)) return null;

    const ship = shipAt(side, r, c);
    let ships = side.ships;
    if (ship) {
        ships = side.ships.map((item) =>
            item.id === ship.id ? { ...item, hits: [...item.hits, cellKey(r, c)] } : item
        );
    }
    const target = ship ? ships.find((item) => item.id === ship.id) : null;
    const sunk = Boolean(target && isSunk(target));

    const next = {
        ships,
        shots: {
            ...side.shots,
            [cellKey(r, c)]: { r, c, hit: Boolean(ship), shipId: ship ? ship.id : null }
        }
    };

    return {
        side: next,
        hit: Boolean(ship),
        sunk,
        shipId: ship ? ship.id : null,
        shipName: ship ? ship.name : null,
        allSunk: allSunk(next)
    };
}

/* 尚未被炮击过的格子 */
function freeCells(side) {
    const list = [];
    for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
            if (!shotAt(side, r, c)) list.push({ r, c });
        }
    }
    return list;
}

/* 命中但所在舰船尚未沉没的格子（AI 追击用） */
function activeHits(side) {
    const list = [];
    side.ships.forEach((ship) => {
        if (isSunk(ship)) return;
        ship.hits.forEach((key) => {
            const [r, c] = key.split('-').map(Number);
            list.push({ r, c });
        });
    });
    return list;
}

const OFFSETS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];

function neighbors(r, c) {
    return OFFSETS.map(([dr, dc]) => ({ r: r + dr, c: c + dc })).filter(({ r: nr, c: nc }) =>
        inBounds(nr, nc)
    );
}

function coordLabel(r, c) {
    return `${COLS[c]}${r + 1}`;
}

function dirLabel(dir) {
    return dir === DIR_V ? '纵向' : '横向';
}

export {
    SIZE,
    COLS,
    DIR_H,
    DIR_V,
    FLEET,
    FLEET_CELLS,
    cellKey,
    inBounds,
    createSide,
    shipCells,
    canPlace,
    placeShip,
    removeShip,
    clearShips,
    randomFleet,
    shipAt,
    shotAt,
    isSunk,
    isFleetReady,
    sunkCount,
    remainingShips,
    allSunk,
    hitCount,
    shotCount,
    fire,
    freeCells,
    activeHits,
    neighbors,
    coordLabel,
    dirLabel
};