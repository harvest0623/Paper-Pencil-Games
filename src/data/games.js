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
        path: '/home/huarongdao',
        playable: true,
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
        path: '/home/minesweeper',
        playable: true,
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
        path: '/home/mancala',
        playable: true,
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
        path: '/home/super-tictactoe',
        playable: true,
        accent: 'indigo',
        meta: ['2 人', '15 分钟', '烧脑']
    },
    {
        id: 'connect-four',
        name: '四子棋',
        en: 'Connect Four',
        mark: '四',
        color: '#ef4444',
        description: '轮流投下棋子，率先在横竖或斜向连成四子者获胜。看似简单，却暗藏先手优势。',
        path: '/home/connect-four',
        playable: true,
        accent: 'red',
        meta: ['2 人', '5 分钟', '策略']
    },
    {
        id: 'dots-and-boxes',
        name: '点格棋',
        en: 'Dots and Boxes',
        mark: '格',
        color: '#60a5fa',
        description: '在点阵之间画线，围住一个方格就占领它。课本边角最经久不衰的纸上游戏。',
        path: '/home/dots-and-boxes',
        playable: true,
        accent: 'blue',
        meta: ['2 人', '5 分钟', '策略']
    },
    {
        id: 'battleship',
        name: '海战棋',
        en: 'Battleship',
        mark: '舰',
        color: '#38bdf8',
        description: '在网格上排布舰队并推测对手的船只位置，先击沉对方全部舰队的一方获胜。',
        path: '/home/battleship',
        playable: false,
        accent: 'sky',
        meta: ['2 人', '10 分钟', '策略']
    },
    {
        id: 'nine-mens-morris',
        name: '九子棋',
        en: "Nine Men's Morris",
        mark: '九',
        color: '#a3e635',
        description: '摆子、走子、飞子三阶段推进，先行连成三子即可吃子，古老而深邃的落子博弈。',
        path: '/home/nine-mens-morris',
        playable: false,
        accent: 'lime',
        meta: ['2 人', '15 分钟', '烧脑']
    },
    {
        id: 'nonogram',
        name: '数织',
        en: 'Nonogram',
        mark: '织',
        color: '#c084fc',
        description: '依据行列数字推理出每一格的填涂，最终会浮现出一幅隐藏的像素图案。',
        path: '/home/nonogram',
        playable: false,
        accent: 'violet',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'kakuro',
        name: '数和',
        en: 'Kakuro',
        mark: '和',
        color: '#2dd4bf',
        description: '把数字填入空格，使每段横向与纵向之和等于提示值，且同段内不重复。',
        path: '/home/kakuro',
        playable: false,
        accent: 'teal',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'slitherlink',
        name: '数回',
        en: 'Slitherlink',
        mark: '环',
        color: '#34d399',
        description: '沿着点阵连线，让每个数字格四周的线段数等于提示值，最终连成一条封闭回路。',
        path: '/home/slitherlink',
        playable: false,
        accent: 'emerald',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'game-2048',
        name: '2048',
        en: '2048',
        mark: '二',
        color: '#fbbf24',
        description: '滑动合并相同的数字，努力凑出 2048。节奏轻快，一局接一局停不下来。',
        path: '/home/2048',
        playable: false,
        accent: 'amber',
        meta: ['1 人', '10 分钟', '益智']
    },
    {
        id: 'sokoban',
        name: '推箱子',
        en: 'Sokoban',
        mark: '推',
        color: '#fb7185',
        description: '推动箱子到指定位置，走位不可撤销，每一步都考验空间规划与先见之明。',
        path: '/home/sokoban',
        playable: false,
        accent: 'rose',
        meta: ['1 人', '10 分钟', '益智']
    },
    {
        id: 'chinese-checkers',
        name: '跳棋',
        en: 'Chinese Checkers',
        mark: '跳',
        color: '#e879f9',
        description: '推动棋子一步步跳向对面阵营，借助他人之子连跳，可以一鼓作气完成长距离转移。',
        path: '/home/chinese-checkers',
        playable: false,
        accent: 'fuchsia',
        meta: ['2 人', '15 分钟', '策略']
    },
    {
        id: 'checkers',
        name: '西洋跳棋',
        en: 'Checkers',
        mark: '西',
        color: '#f59e0b',
        description: '斜向移动并跳过对手棋子将其吃掉，抵达底线即可升王，规则简单却变化万千。',
        path: '/home/checkers',
        playable: false,
        accent: 'amber',
        meta: ['2 人', '10 分钟', '策略']
    },
    {
        id: 'banqi',
        name: '暗棋',
        en: 'Banqi',
        mark: '暗',
        color: '#f87171',
        description: '棋子开局全部翻面，翻开才能行动。运气与算计交织，中国本土的经典翻棋玩法。',
        path: '/home/banqi',
        playable: false,
        accent: 'red',
        meta: ['2 人', '10 分钟', '策略']
    },
    {
        id: 'snakes-and-ladders',
        name: '蛇梯棋',
        en: 'Snakes and Ladders',
        mark: '梯',
        color: '#4ade80',
        description: '掷骰前进，踩到梯子直上、落到蛇头滑下，轻松随机的棋盘游戏，适合全家同乐。',
        path: '/home/snakes-and-ladders',
        playable: false,
        accent: 'emerald',
        meta: ['2–4 人', '10 分钟', '休闲']
    },
    {
        id: 'skyscrapers',
        name: '摩天楼',
        en: 'Skyscrapers',
        mark: '楼',
        color: '#22d3ee',
        description: '在网格里填入不同高度的楼房，让四周的提示数字恰好等于能看到的楼栋数量。',
        path: '/home/skyscrapers',
        playable: false,
        accent: 'cyan',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'hashiwokakero',
        name: '数桥',
        en: 'Hashiwokakero',
        mark: '桥',
        color: '#2dd4bf',
        description: '在岛屿之间架桥，让每座岛连接的桥数与数字一致，并且所有岛屿连成一片。',
        path: '/home/hashiwokakero',
        playable: false,
        accent: 'teal',
        meta: ['1 人', '10 分钟', '逻辑']
    },
    {
        id: 'tower-of-hanoi',
        name: '汉诺塔',
        en: 'Tower of Hanoi',
        mark: '塔',
        color: '#a78bfa',
        description: '每次只能移动一个圆盘、大盘不可压小盘，用最少步数把整座塔搬到另一根柱子上。',
        path: '/home/tower-of-hanoi',
        playable: false,
        accent: 'violet',
        meta: ['1 人', '5 分钟', '逻辑']
    },
    {
        id: 'tangram',
        name: '七巧板',
        en: 'Tangram',
        mark: '巧',
        color: '#fb923c',
        description: '用七块几何拼板拼出目标轮廓，看似自由，实则每一步角度都经过精巧设计。',
        path: '/home/tangram',
        playable: false,
        accent: 'orange',
        meta: ['1 人', '5 分钟', '益智']
    },
    {
        id: 'maze',
        name: '迷宫',
        en: 'Maze',
        mark: '迷',
        color: '#94a3b8',
        description: '在交错纵横的通道中找到唯一出口，随机关卡难度递增，考验方向感与耐心。',
        path: '/home/maze',
        playable: false,
        accent: 'slate',
        meta: ['1 人', '5 分钟', '益智']
    }
];

/* ============================================================
   街机小游戏（非纸笔风格，首页「随时来一局」区块使用）
   ============================================================ */

export const MINI_GAMES = [
    {
        id: 'snake',
        name: '贪吃蛇',
        en: 'Snake',
        mark: '蛇',
        color: '#4ade80',
        description: '控制小蛇吃掉果实不断变长，别撞墙也别咬到自己。',
        path: '/home/snake',
        playable: false,
        accent: 'emerald',
        meta: ['1 人', '即时', '街机']
    },
    {
        id: 'tetris',
        name: '俄罗斯方块',
        en: 'Tetris',
        mark: '块',
        color: '#22d3ee',
        description: '旋转堆叠下落的方块，消行越多分数越高。',
        path: '/home/tetris',
        playable: false,
        accent: 'cyan',
        meta: ['1 人', '即时', '街机']
    },
    {
        id: 'breakout',
        name: '打砖块',
        en: 'Breakout',
        mark: '砖',
        color: '#fb923c',
        description: '弹球击碎整片砖墙，接不住球就失一条命。',
        path: '/home/breakout',
        playable: false,
        accent: 'orange',
        meta: ['1 人', '即时', '街机']
    },
    {
        id: 'pong',
        name: '乒乓',
        en: 'Pong',
        mark: '乒',
        color: '#818cf8',
        description: '最经典的双人对拍，接住小球并让它越过对手。',
        path: '/home/pong',
        playable: false,
        accent: 'indigo',
        meta: ['2 人', '即时', '街机']
    },
    {
        id: 'memory',
        name: '记忆翻牌',
        en: 'Memory',
        mark: '忆',
        color: '#c084fc',
        description: '翻开卡片记住位置，用最少次数配齐所有对子。',
        path: '/home/memory',
        playable: false,
        accent: 'violet',
        meta: ['1 人', '休闲', '记忆']
    },
    {
        id: 'onet',
        name: '连连看',
        en: 'Onet',
        mark: '连',
        color: '#f472b6',
        description: '找到相同图案并用不超过两个转角连起来消除。',
        path: '/home/onet',
        playable: false,
        accent: 'rose',
        meta: ['1 人', '休闲', '消除']
    },
    {
        id: 'piano-tiles',
        name: '别踩白块',
        en: 'Piano Tiles',
        mark: '踩',
        color: '#facc15',
        description: '只点黑块，节奏越来越快，考验反应与手速。',
        path: '/home/piano-tiles',
        playable: false,
        accent: 'amber',
        meta: ['1 人', '即时', '反应']
    }
];

/* 取除当前游戏外的推荐项，已上线的优先 */
export const getOtherGames = (currentId, limit = 3) =>
    GAMES.filter((game) => game.id !== currentId)
        .sort((a, b) => Number(b.playable) - Number(a.playable))
        .slice(0, limit);