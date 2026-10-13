import './Home.css';
import { Link } from 'react-router-dom';
import { GAMES, MINI_GAMES } from '../data/games';
import Accordion from '../components/Accordion';

/* ---------- 游戏预览（纯 CSS 绘制） ---------- */

const PreviewTicTacToe = () => (
    <div className="pv pv--tictactoe">
        <span className="pv-cell pv-mark pv-mark--x" />
        <span className="pv-cell pv-mark pv-mark--o" />
        <span className="pv-cell" />
        <span className="pv-cell" />
        <span className="pv-cell pv-mark pv-mark--x" />
        <span className="pv-cell" />
        <span className="pv-cell pv-mark pv-mark--o" />
        <span className="pv-cell" />
        <span className="pv-cell" />
    </div>
);

const PreviewReversi = () => (
    <div className="pv pv--reversi">
        {['w', '', '', ''].map((v, i) => (
            <span key={i} className={`pv-cell ${v ? 'pv-dot pv-dot--white' : ''}`} />
        ))}
        {['', 'b', 'w', ''].map((v, i) => (
            <span
                key={`m${i}`}
                className={`pv-cell ${v ? `pv-dot pv-dot--${v === 'b' ? 'black' : 'white'}` : ''}`}
            />
        ))}
        {['', 'w', 'b', ''].map((v, i) => (
            <span
                key={`n${i}`}
                className={`pv-cell ${v ? `pv-dot pv-dot--${v === 'b' ? 'black' : 'white'}` : ''}`}
            />
        ))}
        {['', '', '', ''].map((v, i) => (
            <span key={`l${i}`} className="pv-cell" />
        ))}
    </div>
);

const PreviewGomoku = () => (
    <div className="pv pv--gomoku">
        {Array.from({ length: 36 }, (_, i) => {
            const stones = { 7: 'b', 14: 'w', 20: 'b', 21: 'w', 15: 'b' };
            const stone = stones[i];
            return (
                <span
                    key={i}
                    className={`pv-cell ${stone ? `pv-dot pv-dot--${stone === 'b' ? 'black' : 'white'}` : ''}`}
                />
            );
        })}
    </div>
);

const PreviewSudoku = () => {
    const grid = [5, 3, 0, 6, 0, 0, 0, 9, 8];
    return (
        <div className="pv pv--sudoku">
            {grid.map((n, i) => (
                <span key={i} className={`pv-cell ${n ? 'pv-num' : ''}`}>
                    {n || ''}
                </span>
            ))}
        </div>
    );
};

const PreviewHuarongdao = () => (
    <div className="pv pv--huarongdao">
        {[1, 2, 3, 4, 5, 6, 7, 8, '', 10, 11, 12, 13, 14, 15, 9].map((n, i) => (
            <span key={i} className={`pv-cell ${n ? 'pv-tile' : 'pv-gap'}`}>
                {n}
            </span>
        ))}
    </div>
);

const PreviewMinesweeper = () => {
    const cells = ['', '1', '1', '', '2', 'x', '1', '1', '1'];
    return (
        <div className="pv pv--minesweeper">
            {cells.map((c, i) => (
                <span key={i} className={`pv-cell ${c === 'x' ? 'pv-mine' : c ? 'pv-open' : 'pv-closed'}`}>
                    {c && c !== 'x' ? c : ''}
                </span>
            ))}
        </div>
    );
};

const PreviewMancala = () => (
    <div className="pv pv--mancala">
        <div className="pv-store" />
        <div className="pv-pits">
            <div className="pv-pit-row">
                {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className="pv-pit">
                        <i />
                        <i />
                        <i />
                    </span>
                ))}
            </div>
            <div className="pv-pit-row">
                {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className="pv-pit">
                        <i />
                        <i />
                    </span>
                ))}
            </div>
        </div>
        <div className="pv-store" />
    </div>
);

const PreviewSuper = () => (
    <div className="pv pv--super">
        {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`pv-mini ${i === 1 ? 'is-x' : i === 5 ? 'is-o' : ''}`} />
        ))}
    </div>
);

/* ---------- 即将上线游戏预览 ---------- */

const PreviewConnectFour = () => {
    const cells = [
        '', '', '', '', '', '',
        '', '', '', '', '', '',
        '', '', '', '', 'y', '',
        '', '', 'r', 'y', 'y', 'r',
        'r', 'y', 'r', 'y', 'r', 'y'
    ];
    return (
        <div className="pv pv--connect4">
            {cells.map((v, i) => (
                <span
                    key={i}
                    className={`pv-cell ${v === 'r' ? 'pv-disc--r' : v === 'y' ? 'pv-disc--y' : ''}`}
                />
            ))}
        </div>
    );
};

const PreviewDots = () => {
    const filled = { 0: 'a', 2: 'b', 4: 'a', 6: 'b', 8: 'a' };
    return (
        <div className="pv pv--dots">
            {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={`pv-cell ${filled[i] ? `is-${filled[i]}` : ''}`} />
            ))}
        </div>
    );
};

const PreviewBattleship = () => {
    const cells = [
        '', 's', 's', '', 'm',
        '', '', 's', '', '',
        'h', 's', 's', 's', '',
        '', '', '', 's', '',
        '', 'm', '', '', ''
    ];
    return (
        <div className="pv pv--battleship">
            {cells.map((v, i) => (
                <span key={i} className={`pv-cell ${v ? `pv-${v}` : ''}`} />
            ))}
        </div>
    );
};

const PreviewMorris = () => (
    <div className="pv pv--morris">
        <span className="pv-ring pv-ring--1" />
        <span className="pv-ring pv-ring--2" />
        <span className="pv-ring pv-ring--3" />
        <span className="pv-stone pv-stone--1" />
        <span className="pv-stone pv-stone--b pv-stone--2" />
        <span className="pv-stone pv-stone--3" />
    </div>
);

const PreviewNonogram = () => {
    const pattern = [
        0, 1, 1, 1, 0,
        1, 1, 1, 1, 1,
        1, 1, 1, 1, 1,
        0, 1, 1, 1, 0,
        0, 0, 1, 0, 0
    ];
    return (
        <div className="pv pv--nonogram">
            {pattern.map((v, i) => (
                <span key={i} className={`pv-cell ${v ? 'pv-fill' : ''}`} />
            ))}
        </div>
    );
};

const PreviewKakuro = () => {
    const cells = [
        'b', 'b', '4', '', '7',
        'b', '', '9', 'b', '',
        '3', '', 'b', '', '',
        '', 'b', '', '', '2',
        '', '', '', 'b', 'b'
    ];
    return (
        <div className="pv pv--kakuro">
            {cells.map((v, i) => (
                <span
                    key={i}
                    className={`pv-cell ${v === 'b' ? 'pv-block' : v ? 'pv-numcell' : ''}`}
                >
                    {v !== 'b' ? v : ''}
                </span>
            ))}
        </div>
    );
};

const PreviewSlither = () => (
    <div className="pv pv--slither">
        {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="pv-node" />
        ))}
        <span className="pv-loop" />
    </div>
);

const Preview2048 = () => {
    const cells = [2, 4, 2, 0, 8, 16, 4, 2, 32, 64, 8, 4, 128, 16, 2, 0];
    return (
        <div className="pv pv--2048">
            {cells.map((v, i) => (
                <span key={i} className={`pv-cell ${v ? `pv-t${v}` : ''}`}>
                    {v || ''}
                </span>
            ))}
        </div>
    );
};

const PreviewSokoban = () => {
    const map = 'WWWWWWW....WW.G..WW.BP.WW....WWWWWW';
    return (
        <div className="pv pv--sokoban">
            {map.split('').map((c, i) => (
                <span
                    key={i}
                    className={`pv-cell ${
                        c === 'W'
                            ? 'pv-wall'
                            : c === 'B'
                              ? 'pv-box'
                              : c === 'P'
                                ? 'pv-player'
                                : c === 'G'
                                  ? 'pv-goal'
                                  : ''
                    }`}
                />
            ))}
        </div>
    );
};

/* ---------- 新增纸笔游戏预览 ---------- */

const PreviewChineseCheckers = () => {
    const pegs = { 0: 'a', 1: 'a', 4: 'a', 3: 'b', 6: 'b', 7: 'b' };
    return (
        <div className="pv pv--checkers">
            {Array.from({ length: 16 }, (_, i) => (
                <span
                    key={i}
                    className={`pv-cell ${pegs[i] ? `pv-peg pv-peg--${pegs[i]}` : ''}`}
                />
            ))}
        </div>
    );
};

const PreviewCheckers = () => {
    const pieces = { 1: 'w', 6: 'b', 8: 'w', 11: 'b', 12: 'w', 17: 'b' };
    return (
        <div className="pv pv--draughts">
            {Array.from({ length: 36 }, (_, i) => (
                <span
                    key={i}
                    className={`pv-cell ${pieces[i] ? `pv-piece pv-piece--${pieces[i]}` : ''}`}
                />
            ))}
        </div>
    );
};

const PreviewBanqi = () => {
    const cells = [
        'back', '', '卒', '', '', '帅', '', 'back',
        '', '车', '', '', 'back', '', '', '馬'
    ];
    return (
        <div className="pv pv--banqi">
            {cells.map((c, i) => (
                <span
                    key={i}
                    className={`pv-cell ${
                        c === 'back' ? 'pv-tile-back' : c ? 'pv-tile-up' : ''
                    }`}
                >
                    {c && c !== 'back' ? c : ''}
                </span>
            ))}
        </div>
    );
};

const PreviewSnakes = () => (
    <div className="pv pv--ladders">
        {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="pv-cell">
                {i + 1}
            </span>
        ))}
        <span className="pv-ladder" />
        <span className="pv-snake-bar" />
    </div>
);

const PreviewSkyscrapers = () => {
    const grid = [
        1, 0, 0, 0, 5,
        0, 2, 0, 4, 0,
        0, 0, 3, 0, 0,
        0, 2, 0, 4, 0,
        1, 0, 0, 0, 5
    ];
    return (
        <div className="pv pv--skyscrapers">
            {grid.map((n, i) => (
                <span key={i} className={`pv-cell ${n ? 'pv-tower' : ''}`}>
                    {n || ''}
                </span>
            ))}
        </div>
    );
};

const PreviewHashi = () => (
    <div className="pv pv--hashi">
        {[2, 0, 1, 0, 3, 0, 1, 0, 2].map((n, i) => (
            <span key={i} className={`pv-island ${n ? 'is-num' : ''}`}>
                {n || ''}
            </span>
        ))}
        <span className="pv-bridge pv-bridge--h" />
        <span className="pv-bridge pv-bridge--v" />
    </div>
);

const PreviewHanoi = () => (
    <div className="pv pv--hanoi">
        <span className="pv-rod pv-rod--1" />
        <span className="pv-rod pv-rod--2" />
        <span className="pv-rod pv-rod--3" />
        <span className="pv-disk pv-disk--a" />
        <span className="pv-disk pv-disk--b" />
        <span className="pv-disk pv-disk--c" />
        <span className="pv-base" />
    </div>
);

const PreviewTangram = () => (
    <div className="pv pv--tangram">
        <span className="pv-tg pv-tg--1" />
        <span className="pv-tg pv-tg--2" />
        <span className="pv-tg pv-tg--3" />
        <span className="pv-tg pv-tg--4" />
        <span className="pv-tg pv-tg--5" />
        <span className="pv-tg pv-tg--6" />
    </div>
);

const PreviewMaze = () => {
    const map = [
        '#######',
        '#.....#',
        '#.###.#',
        '#.#...#',
        '#.#.#.#',
        '#...#.#',
        '#####.#'
    ].join('');
    return (
        <div className="pv pv--maze">
            {map.split('').map((c, i) => (
                <span key={i} className={`pv-cell ${c === '#' ? 'pv-wall' : 'pv-path'}`} />
            ))}
        </div>
    );
};

/* ---------- 街机小游戏预览 ---------- */

const PreviewSnake = () => {
    const body = { 12: 'h', 17: 'b', 18: 'b', 19: 'b', 20: 'b', 25: 'b', 26: 'b' };
    return (
        <div className="pv pv--snake">
            {Array.from({ length: 36 }, (_, i) => (
                <span
                    key={i}
                    className={`pv-cell ${
                        body[i] ? `pv-body ${body[i] === 'h' ? 'is-head' : ''}` : ''
                    } ${i === 7 ? 'pv-food' : ''}`}
                />
            ))}
        </div>
    );
};

const PreviewTetris = () => {
    const grid = [
        '........',
        '........',
        '.....p..',
        '.....pp.',
        '..c..pp.',
        '..cc....',
        '.yy.....',
        'yyy.....'
    ].join('');
    return (
        <div className="pv pv--tetris">
            {grid.split('').map((c, i) => (
                <span
                    key={i}
                    className={`pv-cell ${c !== '.' ? `pv-block pv-block--${c}` : ''}`}
                />
            ))}
        </div>
    );
};

const PreviewBreakout = () => (
    <div className="pv pv--breakout">
        {Array.from({ length: 24 }, (_, i) => (
            <span
                key={i}
                className={`pv-brick pv-brick--${['a', 'b', 'c'][Math.floor(i / 8)]} ${
                    i === 5 || i === 13 ? 'is-hit' : ''
                }`}
            />
        ))}
        <span className="pv-paddle" />
        <span className="pv-ball" />
    </div>
);

const PreviewPong = () => (
    <div className="pv pv--pong">
        <span className="pv-pong__net" />
        <span className="pv-pong__paddle pv-pong__paddle--l" />
        <span className="pv-pong__paddle pv-pong__paddle--r" />
        <span className="pv-pong__ball" />
    </div>
);

const PreviewMemory = () => {
    const cards = ['★', '', '●', '', '', '▲', '', '◆', '★', '', '', '', '', '◆', '■', ''];
    return (
        <div className="pv pv--memory">
            {cards.map((c, i) => (
                <span key={i} className={`pv-cell ${c ? 'pv-face' : 'pv-back'}`}>
                    {c}
                </span>
            ))}
        </div>
    );
};

const PreviewOnet = () => {
    const tiles = ['★', '●', '▲', '■', '◆', '▲', '', '●', '■', '', '●', '▲', '★', '◆', '▲', '★'];
    return (
        <div className="pv pv--onet">
            {tiles.map((c, i) => (
                <span key={i} className={`pv-cell ${c ? 'pv-tile' : 'pv-empty'}`}>
                    {c}
                </span>
            ))}
        </div>
    );
};

const PreviewPiano = () => {
    const blacks = [1, 3, 0, 2, 1];
    return (
        <div className="pv pv--piano">
            {Array.from({ length: 20 }, (_, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const black = blacks[row] === col;
                return (
                    <span
                        key={i}
                        className={`pv-cell ${black ? 'pv-black is-key' : ''} ${
                            row === 3 && black ? 'is-hit' : ''
                        }`}
                    />
                );
            })}
        </div>
    );
};

const previews = {
    reversi: <PreviewReversi />,
    tictactoe: <PreviewTicTacToe />,
    gomoku: <PreviewGomoku />,
    sudoku: <PreviewSudoku />,
    huarongdao: <PreviewHuarongdao />,
    minesweeper: <PreviewMinesweeper />,
    mancala: <PreviewMancala />,
    'super-tictactoe': <PreviewSuper />,
    'connect-four': <PreviewConnectFour />,
    'dots-and-boxes': <PreviewDots />,
    battleship: <PreviewBattleship />,
    'nine-mens-morris': <PreviewMorris />,
    nonogram: <PreviewNonogram />,
    kakuro: <PreviewKakuro />,
    slitherlink: <PreviewSlither />,
    'game-2048': <Preview2048 />,
    sokoban: <PreviewSokoban />,
    'chinese-checkers': <PreviewChineseCheckers />,
    checkers: <PreviewCheckers />,
    banqi: <PreviewBanqi />,
    'snakes-and-ladders': <PreviewSnakes />,
    skyscrapers: <PreviewSkyscrapers />,
    hashiwokakero: <PreviewHashi />,
    'tower-of-hanoi': <PreviewHanoi />,
    tangram: <PreviewTangram />,
    maze: <PreviewMaze />
};

const arcadePreviews = {
    snake: <PreviewSnake />,
    tetris: <PreviewTetris />,
    breakout: <PreviewBreakout />,
    pong: <PreviewPong />,
    memory: <PreviewMemory />,
    onet: <PreviewOnet />,
    'piano-tiles': <PreviewPiano />
};

const games = GAMES.map((game) => ({ ...game, preview: previews[game.id] }));
const miniGames = MINI_GAMES.map((game) => ({ ...game, preview: arcadePreviews[game.id] }));
const playableCount = games.filter((game) => game.playable).length;

const benefits = [
    {
        title: '零门槛开局',
        desc: '不需要下载、不用注册，打开网页就能立刻开始一局，随时暂停随时回来。'
    },
    {
        title: '锻炼思维能力',
        desc: '从预判对手到权衡得失，每一次落子都是一次小型的战略推演训练。'
    },
    {
        title: '适合社交互动',
        desc: '支持双人同屏，和朋友、家人面对面来一场友好的智力较量。'
    }
];

/* 平台特色 */
const platformFeatures = [
    {
        mark: '智',
        title: '三档 AI 难度',
        desc: '从入门陪练到近似不会失误的强敌，随时切换，找到刚好有挑战性的那一档。'
    },
    {
        mark: '示',
        title: '站内提示引擎',
        desc: '每一步都能请求引擎给出推荐落点，用金色标记直观看到「最优一手」在哪里。'
    },
    {
        mark: '谱',
        title: '完整棋谱复盘',
        desc: '逐手记录坐标与落点，制胜一手会被特别标注，方便赛后回看整局的思路。'
    },
    {
        mark: '绩',
        title: '战绩与胜率',
        desc: '自动统计胜、负、平与胜率曲线，数据保存在本地，下次打开依然延续。'
    },
    {
        mark: '双',
        title: '双人同屏对战',
        desc: '同一台设备就能轮流落子，适合课堂、通勤与家庭场景的轻量对局。'
    },
    {
        mark: '端',
        title: '全端自适应',
        desc: '手机、平板、桌面端均自动适配棋盘尺寸，触屏与鼠标操作同样顺滑。'
    }
];

/* 首页常见问题 */
const homeFaq = [
    {
        q: '需要注册账号或者下载安装吗？',
        a: '都不需要。所有游戏都在浏览器中运行，打开网页即可开始对局，关闭页面后名字与战绩会保存在本机浏览器中。'
    },
    {
        q: '手机上可以正常玩吗？',
        a: '可以。棋盘尺寸会根据屏幕宽度自动缩放，布局在手机、平板与桌面端分别做了适配，支持触屏点击操作。'
    },
    {
        q: '能和朋友在同一台设备上对战吗？',
        a: '可以。在游戏页把模式切换为「双人对战」，双方轮流在同一块棋盘上落子即可，无需联网匹配。'
    },
    {
        q: '下错了可以悔棋吗？',
        a: '支持。每个游戏页都提供悔棋按钮，人机模式会自动回退到你的上一步之前，双人模式则回退一手。'
    },
    {
        q: '会记录我的历史战绩吗？',
        a: '会。人机对战的胜、负、平与胜率会保存在浏览器本地存储中，换设备或清除浏览器数据后才会重置。'
    },
    {
        q: '后续还会上线哪些游戏？',
        a: '对弈与推理方面有四子棋、点格棋、海战棋、跳棋、数织、数桥等正在开发中；首页「随时来一局」区块还会陆续上线贪吃蛇、俄罗斯方块、打砖块等街机小游戏，全部沿用同一套操作习惯。'
    }
];

function Home() {
    return (
        <div className="home">
            <nav className="ui-nav">
                <div className="ui-container ui-nav__inner">
                    <Link to="/home" className="ui-logo">
                        <span className="ui-logo__mark">弈</span>
                        指尖弈局
                    </Link>
                    <div className="ui-nav__links">
                        <a className="ui-nav__link" href="#games">
                            全部游戏
                        </a>
                        <a className="ui-nav__link" href="#arcade">
                            小游戏
                        </a>
                        <a className="ui-nav__link" href="#features">
                            平台特色
                        </a>
                        <a className="ui-nav__link" href="#why">
                            为什么玩
                        </a>
                        <a className="ui-nav__link" href="#faq">
                            常见问题
                        </a>
                        <a className="ui-btn ui-btn--primary ui-btn--sm ui-nav__cta" href="#games">
                            立即开玩
                        </a>
                    </div>
                </div>
            </nav>

            <header className="hero">
                <div className="ui-container hero__inner">
                    <div className="ui-eyebrow">Paper &amp; Pencil · 经典纸笔游戏</div>
                    <h1 className="hero__title">
                        指尖上的
                        <span className="ui-grad-text">智力对弈</span>
                    </h1>
                    <p className="hero__desc">
                        把棋纸和铅笔都搬进屏幕。精选经典纸笔游戏，配以现代的对局体验——
                        即时提示、复盘棋谱、战绩统计，一应俱全。
                    </p>
                    <div className="hero__actions">
                        <a className="ui-btn ui-btn--primary" href="#games">
                            开始探索
                        </a>
                        <Link className="ui-btn ui-btn--ghost" to="/home/reversi">
                            直接下黑白棋
                        </Link>
                    </div>
                    <div className="hero__stats">
                        <div className="hero__stat">
                            <strong>{games.length + miniGames.length}</strong>
                            <span>款游戏可探索</span>
                        </div>
                        <div className="hero__stat">
                            <strong>{playableCount}</strong>
                            <span>款可立即开玩</span>
                        </div>
                        <div className="hero__stat">
                            <strong>3</strong>
                            <span>档 AI 难度</span>
                        </div>
                        <div className="hero__stat">
                            <strong>0</strong>
                            <span>成本 / 无需注册</span>
                        </div>
                    </div>

                    <div className="hero__quick">
                        {games
                            .filter((game) => game.playable)
                            .map((game) => (
                                <Link key={game.id} to={game.path} className="hero__chip">
                                    <span
                                        className="hero__chip-mark"
                                        style={{ '--accent': game.color }}
                                    >
                                        {game.mark}
                                    </span>
                                    {game.name}
                                </Link>
                            ))}
                    </div>
                </div>
            </header>

            <section className="ui-section games-section" id="games">
                <div className="ui-container">
                    <div className="games-head">
                        <div>
                            <div className="ui-eyebrow">游戏合集</div>
                            <h2 className="ui-section-title">挑一款，立即开玩</h2>
                        </div>
                        <p className="ui-section-sub">
                            从一分钟就能上手的井字棋，到需要长线布局的黑白棋，
                            每个人都能找到适合自己的那一局。
                        </p>
                    </div>

                    <div className="games-grid">
                        {games.map((game) => {
                            const card = (
                                <div className={`game-card accent-${game.accent} ${game.playable ? '' : 'is-soon'}`}>
                                    <div className="game-card__preview">{game.preview}</div>
                                    <div className="game-card__body">
                                        <div className="game-card__head">
                                            <div>
                                                <h3 className="game-card__name">{game.name}</h3>
                                                <span className="game-card__en">{game.en}</span>
                                            </div>
                                            {game.playable ? (
                                                <span className="ui-tag ui-tag--brand">可开玩</span>
                                            ) : (
                                                <span className="ui-tag">即将上线</span>
                                            )}
                                        </div>
                                        <p className="game-card__desc">{game.description}</p>
                                        <div className="game-card__meta">
                                            {game.meta.map((m) => (
                                                <span key={m} className="ui-tag">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                        {game.playable ? (
                                            <span className="ui-btn ui-btn--primary game-card__cta">
                                                开始游戏
                                            </span>
                                        ) : (
                                            <span className="ui-btn ui-btn--ghost game-card__cta is-disabled">
                                                敬请期待
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );

                            return game.playable ? (
                                <Link key={game.id} to={game.path} className="game-card-link">
                                    {card}
                                </Link>
                            ) : (
                                <div key={game.id} className="game-card-link is-soon">
                                    {card}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="ui-section arcade-section" id="arcade">
                <div className="ui-container">
                    <div className="games-head">
                        <div>
                            <div className="ui-eyebrow">街机小游戏</div>
                            <h2 className="ui-section-title">随时来一局</h2>
                        </div>
                        <p className="ui-section-sub">
                            除了纸上对弈，也准备了这些轻快的街机小品。打开就能玩，
                            一局只要几分钟，碎片时间也能随手放松一下。
                        </p>
                    </div>

                    <div className="games-grid games-grid--mini">
                        {miniGames.map((game) => (
                            <div
                                key={game.id}
                                className={`game-card accent-${game.accent} is-soon`}
                            >
                                <div className="game-card__preview">{game.preview}</div>
                                <div className="game-card__body">
                                    <div className="game-card__head">
                                        <div>
                                            <h3 className="game-card__name">{game.name}</h3>
                                            <span className="game-card__en">{game.en}</span>
                                        </div>
                                        <span className="ui-tag">即将上线</span>
                                    </div>
                                    <p className="game-card__desc">{game.description}</p>
                                    <div className="game-card__meta">
                                        {game.meta.map((m) => (
                                            <span key={m} className="ui-tag">
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="ui-btn ui-btn--ghost game-card__cta is-disabled">
                                        敬请期待
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section why-section" id="why">
                <div className="ui-container">
                    <div className="ui-eyebrow">为什么选择指尖弈局</div>
                    <h2 className="ui-section-title">纸笔游戏的魅力</h2>
                    <p className="ui-section-sub">
                        纸笔游戏材料极简、规则清晰，却能带来持久的乐趣。它们既是放松的出口，
                        也是思维与社交的训练场。
                    </p>
                    <div className="why-grid">
                        {benefits.map((b, i) => (
                            <div key={b.title} className="why-card">
                                <span className="why-card__index">{String(i + 1).padStart(2, '0')}</span>
                                <h3 className="why-card__title">{b.title}</h3>
                                <p className="why-card__desc">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section features-section" id="features">
                <div className="ui-container">
                    <div className="features-head">
                        <div>
                            <div className="ui-eyebrow">平台特色</div>
                            <h2 className="ui-section-title">不只是把棋盘搬进浏览器</h2>
                        </div>
                        <p className="ui-section-sub">
                            提示、复盘、战绩、音效、双人同屏——每一款游戏都标配同一套顺手的能力，
                            让你把注意力留给思考本身。
                        </p>
                    </div>
                    <div className="features-grid">
                        {platformFeatures.map((item) => (
                            <div key={item.title} className="feature-card">
                                <span className="feature-card__mark">{item.mark}</span>
                                <h3 className="feature-card__title">{item.title}</h3>
                                <p className="feature-card__desc">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="ui-section faq-section" id="faq">
                <div className="ui-container faq-section__inner">
                    <div className="faq-section__head">
                        <div className="ui-eyebrow">常见问题</div>
                        <h2 className="ui-section-title">开始之前，你可能想知道</h2>
                        <p className="ui-section-sub">
                            如果没有找到答案，直接进入任意一局游戏，边玩边体会会更快。
                        </p>
                    </div>
                    <Accordion items={homeFaq} />
                </div>
            </section>

            <section className="home-cta">
                <div className="ui-container">
                    <div className="home-cta__card">
                        <h2 className="home-cta__title">尽情享受吧！</h2>
                        <p className="home-cta__desc">
                            无论你是休闲玩家还是竞技爱好者，这里都有值得你反复琢磨的对局。
                            拿起你的电子笔，现在就选一款开始吧。
                        </p>
                        <Link className="ui-btn ui-btn--primary" to="/home/reversi">
                            进入黑白棋
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="ui-footer">
                <div className="ui-container">
                    <div className="ui-footer__grid">
                        <div>
                            <div className="ui-logo" style={{ marginBottom: 14 }}>
                                <span className="ui-logo__mark">弈</span>
                                指尖弈局
                            </div>
                            <p className="ui-footer__text">
                                现代化在线纸笔游戏平台，把经典对弈搬到你的指尖。
                            </p>
                        </div>
                        <div>
                            <h3 className="ui-footer__title">游戏</h3>
                            <ul className="ui-footer__list">
                                <li>
                                    <Link to="/home/reversi">黑白棋</Link>
                                </li>
                                <li>
                                    <Link to="/home/gomoku">五子棋</Link>
                                </li>
                                <li>
                                    <Link to="/home/tic-tac-toe">井字棋</Link>
                                </li>
                                <li>
                                    <Link to="/home/mancala">曼卡拉</Link>
                                </li>
                                <li>
                                    <Link to="/home/super-tictactoe">超级井字棋</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="ui-footer__title">更多</h3>
                            <ul className="ui-footer__list">
                                <li>关于我们</li>
                                <li>
                                    <a href="#why">为什么玩</a>
                                </li>
                                <li>联系方式</li>
                            </ul>
                        </div>
                    </div>
                    <div className="ui-footer__bottom">
                        <span>© 2026 指尖弈局 · 保留所有权利</span>
                        <span>用心做好每一局对弈</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Home;