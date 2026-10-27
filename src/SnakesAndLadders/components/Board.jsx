import {
    BOARD_COLS,
    BOARD_ROWS,
    LADDERS,
    SNAKES,
    cellCoords
} from '../utils/gameLogic';
import './Board.css';

const FILE_LETTERS = 'ABCDEFGHIJ';
const RANKS = Array.from({ length: BOARD_ROWS }, (_, index) => BOARD_ROWS - index);

const LADDER_STARTS = new Set(LADDERS.map(([start]) => start));
const LADDER_ENDS = new Set(LADDERS.map(([, end]) => end));
const SNAKE_HEADS = new Set(SNAKES.map(([head]) => head));
const SNAKE_TAILS = new Set(SNAKES.map(([, tail]) => tail));

/* 格子中心在 0–100 的百分比坐标系中的位置 */
const centerOf = (number) => {
    const { row, col } = cellCoords(number);
    return {
        x: col * 10 + 5,
        y: (BOARD_ROWS - 1 - row) * 10 + 5
    };
};

const ladderGeometry = (start, end) => {
    const a = centerOf(start);
    const b = centerOf(end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const width = 0.95;

    const rails = [
        [
            { x: a.x + nx * width, y: a.y + ny * width },
            { x: b.x + nx * width, y: b.y + ny * width }
        ],
        [
            { x: a.x - nx * width, y: a.y - ny * width },
            { x: b.x - nx * width, y: b.y - ny * width }
        ]
    ];

    const rungCount = Math.max(3, Math.round(length / 7));
    const rungs = Array.from({ length: rungCount }, (_, index) => {
        const t = (index + 1) / (rungCount + 1);
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;
        return {
            x1: cx + nx * width,
            y1: cy + ny * width,
            x2: cx - nx * width,
            y2: cy - ny * width
        };
    });

    return { a, b, rails, rungs };
};

const snakeGeometry = (head, tail) => {
    const h = centerOf(head);
    const t = centerOf(tail);
    const dx = t.x - h.x;
    const dy = t.y - h.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const amplitude = Math.min(4.4, length * 0.16);

    const c1 = {
        x: h.x + dx * 0.32 + nx * amplitude,
        y: h.y + dy * 0.32 + ny * amplitude
    };
    const c2 = {
        x: h.x + dx * 0.68 - nx * amplitude,
        y: h.y + dy * 0.68 - ny * amplitude
    };

    const dirX = dx / length;
    const dirY = dy / length;
    const eyeBase = {
        x: h.x + dirX * 0.5,
        y: h.y + dirY * 0.5
    };

    return {
        path: `M ${h.x} ${h.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${t.x} ${t.y}`,
        head: h,
        tail: t,
        eyes: [
            { x: eyeBase.x + nx * 0.55, y: eyeBase.y + ny * 0.55 },
            { x: eyeBase.x - nx * 0.55, y: eyeBase.y - ny * 0.55 }
        ]
    };
};

/**
 * 蛇梯棋棋盘
 * 10 × 10 蛇形编号，叠加梯子与蛇的 SVG 连线，以及双方棋子。
 * 该棋盘不接收点击，行动通过页面上的掷骰子按钮完成。
 */
function Board({ positions, visual, currentPlayer, hintCells = [] }) {
    const shown = positions.slice();
    if (visual) shown[visual.player] = visual.position;

    const sameCell = shown[0] === shown[1];
    const hintSet = new Set(hintCells);

    const cells = [];
    for (let visualRow = 0; visualRow < BOARD_ROWS; visualRow++) {
        const row = BOARD_ROWS - 1 - visualRow;
        for (let col = 0; col < BOARD_COLS; col++) {
            const number =
                row * BOARD_COLS + (row % 2 === 0 ? col + 1 : BOARD_COLS - col);

            const classes = ['snl-cell'];
            if ((row + col) % 2 === 1) classes.push('is-tint');
            if (LADDER_STARTS.has(number)) classes.push('is-ladder-start');
            if (LADDER_ENDS.has(number)) classes.push('is-ladder-end');
            if (SNAKE_HEADS.has(number)) classes.push('is-snake-head');
            if (SNAKE_TAILS.has(number)) classes.push('is-snake-tail');
            if (number === 100) classes.push('is-finish');
            if (hintSet.has(number)) classes.push('is-hint');

            cells.push(
                <div
                    key={number}
                    className={classes.join(' ')}
                    aria-label={`第 ${number} 格`}
                >
                    <span className="snl-cell__no">{number}</span>
                    {number === 100 && (
                        <span className="snl-cell__flag" aria-hidden="true">
                            ★
                        </span>
                    )}
                </div>
            );
        }
    }

    const tokenStyle = (playerIndex) => {
        const number = shown[playerIndex];
        const { row, col } = cellCoords(number);
        const shift = sameCell ? (playerIndex === 0 ? -34 : 34) : 0;
        return {
            left: `${col * 10 + 5}%`,
            top: `${(BOARD_ROWS - 1 - row) * 10 + 5}%`,
            '--shift': `${shift}%`
        };
    };

    return (
        <div className="snl-board">
            <div className="snl-board__cols snl-board__cols--top" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`top-${letter}`}>{letter}</span>
                ))}
            </div>

            <div className="snl-board__ranks snl-board__ranks--left" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`left-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="snl-board__grid">
                <div className="snl-board__cells">{cells}</div>

                <svg
                    className="snl-board__links"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {LADDERS.map(([start, end]) => {
                        const ladder = ladderGeometry(start, end);
                        return (
                            <g key={`ladder-${start}`} className="snl-ladder">
                                {ladder.rails.map(([from, to], index) => (
                                    <line
                                        key={`rail-${start}-${index}`}
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        strokeWidth="0.55"
                                    />
                                ))}
                                {ladder.rungs.map((rung, index) => (
                                    <line
                                        key={`rung-${start}-${index}`}
                                        x1={rung.x1}
                                        y1={rung.y1}
                                        x2={rung.x2}
                                        y2={rung.y2}
                                        strokeWidth="0.28"
                                    />
                                ))}
                            </g>
                        );
                    })}

                    {SNAKES.map(([head, tail]) => {
                        const snake = snakeGeometry(head, tail);
                        return (
                            <g key={`snake-${head}`} className="snl-snake">
                                <path
                                    d={snake.path}
                                    fill="none"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d={snake.path}
                                    className="snl-snake__shine"
                                    fill="none"
                                    strokeWidth="0.45"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={snake.head.x}
                                    cy={snake.head.y}
                                    r="1.75"
                                    className="snl-snake__head"
                                />
                                {snake.eyes.map((eye, index) => (
                                    <circle
                                        key={`eye-${head}-${index}`}
                                        cx={eye.x}
                                        cy={eye.y}
                                        r="0.32"
                                        className="snl-snake__eye"
                                    />
                                ))}
                                <circle
                                    cx={snake.tail.x}
                                    cy={snake.tail.y}
                                    r="0.75"
                                    className="snl-snake__tail"
                                />
                            </g>
                        );
                    })}
                </svg>

                {[0, 1].map((playerIndex) => (
                    <div
                        key={`token-${playerIndex}`}
                        className={`snl-token ${
                            visual && visual.player === playerIndex ? 'is-moving' : ''
                        }${visual && visual.jump && visual.player === playerIndex ? ' is-jumping' : ''}`}
                        style={tokenStyle(playerIndex)}
                    >
                        <span
                            className={`snl-token__chip ${
                                playerIndex === 0 ? 'is-blue' : 'is-red'
                            }${
                                currentPlayer === playerIndex ? ' is-active' : ''
                            }`}
                        >
                            {playerIndex + 1}
                        </span>
                    </div>
                ))}
            </div>

            <div className="snl-board__ranks snl-board__ranks--right" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`right-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="snl-board__cols snl-board__cols--bottom" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`bottom-${letter}`}>{letter}</span>
                ))}
            </div>
        </div>
    );
}

export default Board;
