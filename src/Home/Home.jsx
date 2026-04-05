import './Home.css';
import { Link } from 'react-router-dom';

// 游戏棋盘组件
const TicTacToeBoard = () => (
    <div className="game-board tictactoe-board">
        <div className="board-grid">
            <div className="board-row">
                <div className="board-cell o">O</div>
                <div className="board-cell x">X</div>
                <div className="board-cell x">X</div>
            </div>
            <div className="board-row">
                <div className="board-cell"></div>
                <div className="board-cell"></div>
                <div className="board-cell"></div>
            </div>
            <div className="board-row">
                <div className="board-cell"></div>
                <div className="board-cell"></div>
                <div className="board-cell"></div>
            </div>
        </div>
    </div>
);

const SuperTicTacToeBoard = () => (
    <div className="game-board super-tictactoe-board">
        <div className="board-grid">
            <div className="board-row">
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell x">X</div>
                        <div className="sub-board-cell o">O</div>
                        <div className="sub-board-cell x">X</div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell o">O</div>
                        <div className="sub-board-cell x">X</div>
                        <div className="sub-board-cell o">O</div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell x">X</div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
            </div>
            <div className="board-row">
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
            </div>
            <div className="board-row">
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
                <div className="sub-board">
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                    <div className="sub-board-row">
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                        <div className="sub-board-cell"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const GomokuBoard = () => (
    <div className="game-board gomoku-board">
        <div className="board-grid">
            {[...Array(7)].map((_, row) => (
                <div key={row} className="board-row">
                    {[...Array(7)].map((_, col) => {
                        let cellClass = 'board-cell';
                        // 定义棋子位置
                        const whiteStones = [[1, 2], [2, 2], [4, 2], [4, 3], [4, 4], [6, 2]];
                        const blackStones = [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]];

                        if (whiteStones.some(([r, c]) => r === row && c === col)) {
                            cellClass += ' white';
                        } else if (blackStones.some(([r, c]) => r === row && c === col)) {
                            cellClass += ' black';
                        }
                        return <div key={col} className={cellClass}></div>;
                    })}
                </div>
            ))}
        </div>
    </div>
);

const ReversiBoard = () => (
    <div className="game-board reversi-board">
        <div className="board-grid">
            {/* 顶部字母标记 */}
            <div className="reversi-labels top-labels">
                <div className="label"></div>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => (
                    <div key={letter} className="label">{letter}</div>
                ))}
                <div className="label"></div>
            </div>

            {/* 棋盘和侧边数字标记 */}
            <div className="reversi-main">
                {[...Array(8)].map((_, row) => (
                    <div key={row} className="reversi-row">
                        {/* 左侧数字 */}
                        <div className="label">{row + 1}</div>

                        {/* 棋盘格子 */}
                        <div className="board-row">
                            {[...Array(8)].map((_, col) => {
                                let cellClass = 'board-cell';
                                // 定义棋子位置
                                const blackStones = [[3, 3], [4, 4]]; // 第4行D列，第5行E列
                                const whiteStones = [[3, 4], [4, 3]]; // 第4行E列，第5行D列
                                const possibleMoves = [[2, 4], [3, 5], [4, 2], [5, 4]]; // 可能的移动位置

                                if (blackStones.some(([r, c]) => r === row && c === col)) {
                                    cellClass += ' black';
                                } else if (whiteStones.some(([r, c]) => r === row && c === col)) {
                                    cellClass += ' white';
                                } else if (possibleMoves.some(([r, c]) => r === row && c === col)) {
                                    cellClass += ' possible';
                                }
                                return <div key={col} className={cellClass}></div>;
                            })}
                        </div>

                        {/* 右侧数字 */}
                        <div className="label">{row + 1}</div>
                    </div>
                ))}
            </div>

            {/* 底部字母标记 */}
            <div className="reversi-labels bottom-labels">
                <div className="label"></div>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => (
                    <div key={letter} className="label">{letter}</div>
                ))}
                <div className="label"></div>
            </div>
        </div>
    </div>
);

const HuarongdaoBoard = () => (
    <div className="game-board huarongdao-board">
        <div className="board-grid">
            <div className="board-row">
                <div className="board-cell number">1</div>
                <div className="board-cell number">2</div>
                <div className="board-cell number">13</div>
                <div className="board-cell number">6</div>
            </div>
            <div className="board-row">
                <div className="board-cell number">8</div>
                <div className="board-cell number">15</div>
                <div className="board-cell number">9</div>
                <div className="board-cell number">10</div>
            </div>
            <div className="board-row">
                <div className="board-cell number">4</div>
                <div className="board-cell number">7</div>
                <div className="board-cell number">3</div>
                <div className="board-cell number">11</div>
            </div>
            <div className="board-row">
                <div className="board-cell number">12</div>
                <div className="board-cell number">14</div>
                <div className="board-cell number">5</div>
                <div className="board-cell"></div>
            </div>
        </div>
    </div>
);

const MancalaBoard = () => (
    <div className="game-board mancala-board">
        <div className="mancala-container">
            <div className="mancala-store"></div>
            <div className="mancala-row">
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
            </div>
            <div className="mancala-row">
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
                <div className="mancala-pit">●●●</div>
            </div>
            <div className="mancala-store"></div>
        </div>
    </div>
);

const SudokuBoard = () => (
    <div className="game-board sudoku-board">
        <div className="board-grid">
            {[...Array(9)].map((_, row) => (
                <div key={row} className="board-row">
                    {[...Array(9)].map((_, col) => {
                        let cellClass = 'board-cell';
                        const numbers = [
                            [5, 3, 0, 0, 7, 0, 0, 0, 0],
                            [6, 0, 0, 1, 9, 5, 0, 0, 0],
                            [0, 9, 8, 0, 0, 0, 0, 6, 0],
                            [8, 0, 0, 0, 6, 0, 0, 0, 3],
                            [4, 0, 0, 8, 0, 3, 0, 0, 1],
                            [7, 0, 0, 0, 2, 0, 0, 0, 6],
                            [0, 6, 0, 0, 0, 0, 2, 8, 0],
                            [0, 0, 0, 4, 1, 9, 0, 0, 5],
                            [0, 0, 0, 0, 8, 0, 0, 7, 9]
                        ];
                        const number = numbers[row][col];
                        return (
                            <div key={col} className={cellClass}>
                                {number !== 0 && number}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    </div>
);

const MinesweeperBoard = () => (
    <div className="game-board minesweeper-board">
        <div className="board-grid">
            {[...Array(5)].map((_, row) => (
                <div key={row} className="board-row">
                    {[...Array(5)].map((_, col) => {
                        let cellClass = 'board-cell';
                        let content = '';
                        // 定义雷的位置
                        const mines = [
                            [0, 0],
                            [1, 2],
                            [2, 1]
                        ];

                        // 检查当前单元格是否是雷
                        const isMine = mines.some(([r, c]) => r === row && c === col);

                        if (isMine) {
                            cellClass += ' mine';
                            content = '💣';
                        } else {
                            // 计算周围雷的数量
                            let mineCount = 0;
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    const newRow = row + dr;
                                    const newCol = col + dc;
                                    if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
                                        if (mines.some(([r, c]) => r === newRow && c === newCol)) {
                                            mineCount++;
                                        }
                                    }
                                }
                            }
                            if (mineCount > 0) {
                                content = mineCount.toString();
                            }
                        }
                        return (
                            <div key={col} className={cellClass}>
                                {content}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    </div>
);

const games = [
    {
        id: 'tictactoe',
        name: '井字棋',
        description: '经典的游戏，两名玩家轮流在3x3的网格中标记X或O，目标是连续三个相同符号。',
        board: <TicTacToeBoard />,
        color: '#4a90d9'
    },
    {
        id: 'super-tictactoe',
        name: '超级井字棋(九井棋)',
        description: '经典游戏的更复杂版本，玩法是在一个大3x3网格上，其中包含多个小3x3网格。',
        board: <SuperTicTacToeBoard />,
        color: '#7c3aed'
    },
    {
        id: 'gomoku',
        name: '五子棋',
        description: '这个游戏挑战玩家在15x15的网格上连续排列五个棋子。',
        board: <GomokuBoard />,
        color: '#059669'
    },
    {
        id: 'reversi',
        name: '黑白棋',
        description: '这是一款两人对战的战略游戏，目标是翻转尽可能多的对手棋子。',
        board: <ReversiBoard />,
        color: '#1f2937'
    },
    {
        id: 'huarongdao',
        name: '数字华容道',
        description: '这是一款逻辑拼图游戏，目标是通过移动方块，利用空格将它们按照从1到15的正确顺序排列。',
        board: <HuarongdaoBoard />,
        color: '#d97706'
    },
    {
        id: 'mancala',
        name: '曼卡拉',
        description: '一款古老的战略棋类游戏，玩家在棋盘上移动棋子，争取收集更多棋子到自己的宝库中。',
        board: <MancalaBoard />,
        color: '#dc2626'
    },
    {
        id: 'sudoku',
        name: '数独',
        description: '一种受欢迎的数字谜题游戏，你需要将数字填入 9×9 的网格中。',
        board: <SudokuBoard />,
        color: '#0891b2'
    },
    {
        id: 'minesweeper',
        name: '扫雷',
        description: '一款经典的逻辑游戏，你需要在不踩到地雷的前提下翻开棋盘上的所有格子。',
        board: <MinesweeperBoard />,
        color: '#6b7280'
    }
];

function Home() {
    return (
        <div className="home">
            <nav className="p1-nav">
                <div className="nav-content">
                    <div className="logo">指尖弈局</div>
                    <div className="nav-buttons">
                        <button className="nav-btn classic-btn">经典</button>
                        <button className="nav-btn">九井棋</button>
                        <button className="nav-btn more-btn">更多游戏 »</button>
                    </div>
                    <div className="nav-links">
                        <a href="#">文章</a>
                        <a href="#">规则</a>
                    </div>
                </div>
            </nav>

            <header className="hero">
                <div className="hero-content">
                    <h1 className="site-title">指尖弈局</h1>
                    <p className="site-subtitle">经典纸笔游戏，指尖上的智慧对决</p>
                </div>
            </header>

            <section className="games-section">
                <h2>我们提供的游戏</h2>
                <div className="games-grid">
                    {games.map((game) => (
                        <Link
                            key={game.id}
                            to={game.id === 'reversi' ? '/home/reversi' : game.id === 'tictactoe' ? '/home/tic-tac-toe' : '#'}
                            className="game-card-link"
                        >
                            <div
                                className="game-card"
                                style={{ borderColor: game.color }}
                            >
                                <div className="game-board-container" style={{ borderColor: game.color }}>
                                    {game.board}
                                </div>
                                <h3 className="game-name">{game.name}</h3>
                                <p className="game-description">{game.description}</p>
                                <button className="play-btn" style={{ backgroundColor: game.color }}>
                                    开始游戏
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="intro-section">
                <div className="intro-content">
                    <h2>为什么要玩纸笔游戏</h2>
                    <p>玩纸笔游戏有很多好处。它们非常容易设置，所需材料极少，适合所有人。这些游戏还能帮助培养战略思维和解决问题的能力，同时为日常生活提供一个休息的机会。此外，它们还非常适合促进社交互动和友好的竞争。</p>
                </div>
            </section>

            <section className="cta-section">
                <div className="cta-content">
                    <h2>尽情享受吧！</h2>
                    <p>纸笔游戏是度过时间的绝佳方式，既有趣又能激发思维。无论您是休闲玩家还是竞技爱好者，我们的经典与创新游戏合集都能让您娱乐数小时。所以，拿起您的电子笔，立即开始游戏吧！</p>
                </div>
            </section>

            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>指尖弈局</h3>
                        <p>© 2026 指尖弈局</p>
                    </div>
                    <div className="footer-section">
                        <h4>游戏</h4>
                        <ul>
                            <li>井字棋</li>
                            <li>五子棋</li>
                            <li>黑白棋</li>
                            <li>数独</li>
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>更多</h4>
                        <ul>
                            <li>关于我们</li>
                            <li>联系方式</li>
                        </ul>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Home;