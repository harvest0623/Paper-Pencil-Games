/* ============================================================
   曼卡拉（Mancala / Kalah）核心逻辑
   ------------------------------------------------------------
   棋盘用长度 14 的一维数组表示：
     0 - 5   玩家1（下方）的 6 个坑，从「左 → 右」
     6       玩家1的宝库（右端竖直长条）
     7 - 12  玩家2（上方）的 6 个坑，从「右 → 左」（7 紧邻右端，12 紧邻左端）
     13      玩家2的宝库（左端竖直长条）
   播种顺序即数组下标顺序 0→1→…→13→0，恰好对应棋盘上的
   「逆时针」方向，并天然跳过对方宝库。
   ============================================================ */

export const PIT_COUNT = 6;
export const INITIAL_STONES = 4;
export const BOARD_LENGTH = 14;

export const PLAYER_1 = 1; // 下方（先手方所在的一侧）
export const PLAYER_2 = 2; // 上方

export const P1_PITS = [0, 1, 2, 3, 4, 5];
export const P1_STORE = 6;
export const P2_PITS = [7, 8, 9, 10, 11, 12];
export const P2_STORE = 13;

export const pitsOf = (player) => (player === PLAYER_1 ? P1_PITS : P2_PITS);
export const storeOf = (player) => (player === PLAYER_1 ? P1_STORE : P2_STORE);
export const otherPlayer = (player) => (player === PLAYER_1 ? PLAYER_2 : PLAYER_1);

/* 该下标属于哪位玩家的坑；宝库返回 0 */
export const ownerOfPit = (index) => {
    if (index >= 0 && index <= 5) return PLAYER_1;
    if (index >= 7 && index <= 12) return PLAYER_2;
    return 0;
};

/* 正对面的坑（仅对坑位有效：0↔12、5↔7 …） */
export const oppositeOf = (index) => 12 - index;

/* 坑位坐标标签：下方 A–F（左→右），上方 1–6（左→右） */
export const pitLabel = (index) => {
    if (index >= 0 && index <= 5) return String.fromCharCode(65 + index);
    if (index >= 7 && index <= 12) return String(13 - index);
    return index === P1_STORE ? '宝库 1' : '宝库 2';
};

export const createInitialBoard = () => {
    const board = new Array(BOARD_LENGTH).fill(0);
    for (const pit of [...P1_PITS, ...P2_PITS]) board[pit] = INITIAL_STONES;
    return board;
};

export const getValidMoves = (board, player) =>
    pitsOf(player).filter((pit) => board[pit] > 0);

export const isPitsEmpty = (board, player) =>
    pitsOf(player).every((pit) => board[pit] === 0);

export const isGameOver = (board) =>
    isPitsEmpty(board, PLAYER_1) || isPitsEmpty(board, PLAYER_2);

/* 双方宝库石子数 */
export const getScores = (board) => ({ p1: board[P1_STORE], p2: board[P2_STORE] });

/* 全盘石子总数（恒为 48，用于守恒校验） */
export const countAllStones = (board) => board.reduce((sum, n) => sum + n, 0);

/* 某一方坑内剩余石子数 */
export const countPitStones = (board, player) =>
    pitsOf(player).reduce((sum, pit) => sum + board[pit], 0);

/**
 * 播种：从 pitIndex 取出全部石子，沿下标顺序逐格放置。
 * · 经过己方宝库会放子
 * · 跳过对方宝库
 * · 最后一粒落在己方宝库 → extraTurn
 * · 最后一粒落在己方空坑 → 捕获正对面坑的全部石子
 * @returns {null|{board,player,pit,lastIndex,extraTurn,captured,capturedFrom,stones}}
 */
export const applyMove = (board, pitIndex) => {
    const player = ownerOfPit(pitIndex);
    if (!player || board[pitIndex] <= 0) return null;

    const next = board.slice();
    let stones = next[pitIndex];
    const stoneCount = stones;
    next[pitIndex] = 0;

    const ownStore = storeOf(player);
    const oppStore = storeOf(otherPlayer(player));

    let pos = pitIndex;
    while (stones > 0) {
        pos = (pos + 1) % BOARD_LENGTH;
        if (pos === oppStore) continue; // 跳过对方宝库
        next[pos] += 1;
        stones -= 1;
    }

    const lastIndex = pos;
    let extraTurn = false;
    let captured = 0;
    let capturedFrom = null;

    /* 先判定是否落入己方宝库（额外回合），再判定捕获 */
    if (lastIndex === ownStore) {
        extraTurn = true;
    } else if (ownerOfPit(lastIndex) === player && next[lastIndex] === 1) {
        const opp = oppositeOf(lastIndex);
        if (next[opp] > 0) {
            /* 己方该空坑的这粒 + 正对面对方的全部石子，一起收入宝库 */
            captured = next[opp];
            capturedFrom = opp;
            const landedStone = next[lastIndex];
            next[lastIndex] = 0;
            next[opp] = 0;
            next[ownStore] += landedStone + captured;
        }
    }

    return {
        board: next,
        player,
        pit: pitIndex,
        lastIndex,
        extraTurn,
        captured,
        capturedFrom,
        stones: stoneCount
    };
};

/* 终局清坑：双方坑中剩余石子全部归入各自宝库 */
export const sweepRemaining = (board) => {
    const next = board.slice();
    for (const player of [PLAYER_1, PLAYER_2]) {
        const store = storeOf(player);
        for (const pit of pitsOf(player)) {
            next[store] += next[pit];
            next[pit] = 0;
        }
    }
    return next;
};