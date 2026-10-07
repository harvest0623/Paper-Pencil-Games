/* ============================================================
   游戏目录（首页卡片墙与游戏页「更多游戏」共用）
   ============================================================ */

export const GAMES = [
    {
        id: 'reversi',
        name: '黑白棋',
        en: 'Reversi',
        mark: '翻',
        color: '#34d399',
        description: '翻转对手的棋子，占领更多格子。规则一分钟学会，策略却能钻研很久。',
        path: '/home/reversi',
        playable: true,
        accent: 'emerald',
        meta: ['2 人', '5–10 分钟', '策略']
    },
    {
        id: 'tictactoe',
        name: '井字棋',
        en: 'Tic-Tac-Toe',
        mark: '井',
        color: '#7c5cff',
        description: '三子连线即获胜。最经典的入门对弈，适合随时来一局快速分胜负。',
        path: '/home/tic-tac-toe',
        playable: true,
        accent: 'violet',
        meta: ['2 人', '1 分钟', '休闲']
    },
    {
        id: 'gomoku',
        name: '五子棋',
        en: 'Gomoku',
        mark: '五',
        color: '#f5c451',
        description: '在纵横交错的棋盘上连成五子。攻防转换之间考验你的全局眼光。',
        path: '/home/gomoku',
        playable: true,
        accent: 'amber',
        meta: ['2 人', '10 分钟', '进阶']
    },
    {
        id: 'sudoku',
        name: '数独',
        en: 'Sudoku',
        mark: '数',
        color: '#22d3ee',
        description: '用 1 到 9 填满九宫格，每行每列每个宫都不重复。纯粹的逻辑推理。',
        path: '/home/sudoku',
        playable: true,
        accent: 'cyan',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'huarongdao',
        name: '数字华容道',
        en: 'Sliding Puzzle',
        mark: '华',
        color: '#f472b6',
        description: '滑动方块将数字还原成一到十五的排列，考验步数与耐心。',
        path: null,
        playable: false,
        accent: 'rose',
        meta: ['1 人', '5 分钟', '益智']
    },
    {
        id: 'minesweeper',
        name: '扫雷',
        en: 'Minesweeper',
        mark: '雷',
        color: '#94a3b8',
        description: '根据数字提示推导地雷位置，在不开雷的前提下清空整片棋盘。',
        path: null,
        playable: false,
        accent: 'slate',
        meta: ['1 人', '5 分钟', '逻辑']
    },
    {
        id: 'mancala',
        name: '曼卡拉',
        en: 'Mancala',
        mark: '播',
        color: '#fb923c',
        description: '古老的播种式棋类游戏，把棋子一粒粒送进自己的宝库。',
        path: null,
        playable: false,
        accent: 'orange',
        meta: ['2 人', '10 分钟', '策略']
    },
    {
        id: 'super-tictactoe',
        name: '超级井字棋',
        en: 'Ultimate TTT',
        mark: '超',
        color: '#818cf8',
        description: '九个井字棋嵌套成一个大棋盘，一步棋决定对手下一步的战场。',
        path: null,
        playable: false,
        accent: 'indigo',
        meta: ['2 人', '15 分钟', '烧脑']
    }
];

/* 取除当前游戏外的推荐项，已上线的优先 */
export const getOtherGames = (currentId, limit = 3) =>
    GAMES.filter((game) => game.id !== currentId)
        .sort((a, b) => Number(b.playable) - Number(a.playable))
        .slice(0, limit);