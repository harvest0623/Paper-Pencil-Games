import { COORDS, POINT_LABELS, BLACK } from '../utils/gameLogic';
import './Board.css';

/* ============================================================
   九子棋棋盘：三环 24 点
   —— SVG 画环与辐条，24 个落点用按钮按百分比定位
   SVG 的 viewBox 预留了坐标留白，因此按钮位置统一由 toPct 换算
   ============================================================ */

const MARGIN = 48;
const GRID = 600;
const SPAN = GRID + MARGIN * 2;
const LETTERS = 'ABCDEFG';

const toPct = (value) => ((value + MARGIN) / SPAN) * 100;

const RINGS = [
    { key: 'outer', x: 0, y: 0, size: 600 },
    { key: 'middle', x: 100, y: 100, size: 400 },
    { key: 'inner', x: 200, y: 200, size: 200 }
];

/* 四条辐条：上 1-9-17、右 3-11-19、下 5-13-21、左 7-15-23 */
const SPOKES = [
    { key: 'top', x1: 300, y1: 0, x2: 300, y2: 200 },
    { key: 'right', x1: 600, y1: 300, x2: 400, y2: 300 },
    { key: 'bottom', x1: 300, y1: 600, x2: 300, y2: 400 },
    { key: 'left', x1: 0, y1: 300, x2: 200, y2: 300 }
];

function Board({
    points,
    mill,
    lastMove,
    hint,
    selected,
    targets,
    onPointClick,
    interactive
}) {
    const { selectable, destinations, captures } = targets;
    const hintFrom = hint && hint.type === 'move' ? hint.from : null;
    const hintTo = hint ? hint.to : null;
    const millPoints = new Set(mill || []);

    const nodes = POINT_LABELS.map((label, index) => {
        const [col, row] = COORDS[index];
        const owner = points[index];
        const isHint = index === hintTo || index === hintFrom;
        const isCapture = captures.has(index);

        const classes = ['nm-node'];
        if (owner === BLACK) classes.push('is-black');
        else if (owner) classes.push('is-white');
        if (index === selected) classes.push('is-selected');
        if (lastMove && lastMove.to === index) classes.push('is-last');
        if (millPoints.has(index)) classes.push('is-mill');
        if (selectable.has(index)) classes.push('is-selectable');

        return (
            <button
                key={label}
                type="button"
                className={classes.join(' ')}
                style={{ left: `${toPct(col * 100)}%`, top: `${toPct(row * 100)}%` }}
                onClick={() => onPointClick(index)}
                disabled={!interactive}
                aria-label={`${label}${owner ? (owner === BLACK ? ' 黑棋' : ' 白棋') : ' 空位'}`}
            >
                {owner && <span className="nm-stone" />}
                {isHint && <span className="nm-ring nm-ring--hint" />}
                {isCapture && <span className="nm-ring nm-ring--capture" />}
                {lastMove && lastMove.to === index && <span className="nm-ring nm-ring--last" />}
                {!owner && destinations.has(index) && <span className="nm-dot" />}
            </button>
        );
    });

    return (
        <div className="nm-board">
            <svg
                className="nm-board__grid"
                viewBox={`${-MARGIN} ${-MARGIN} ${SPAN} ${SPAN}`}
                aria-hidden="true"
            >
                {RINGS.map((ring) => (
                    <rect
                        key={ring.key}
                        className="nm-board__ring"
                        x={ring.x}
                        y={ring.y}
                        width={ring.size}
                        height={ring.size}
                    />
                ))}
                {SPOKES.map((spoke) => (
                    <line
                        key={spoke.key}
                        className="nm-board__line"
                        x1={spoke.x1}
                        y1={spoke.y1}
                        x2={spoke.x2}
                        y2={spoke.y2}
                    />
                ))}
                {mill && (
                    <polyline
                        className="nm-board__mill"
                        points={mill
                            .map((point) => `${COORDS[point][0] * 100},${COORDS[point][1] * 100}`)
                            .join(' ')}
                    />
                )}
                {LETTERS.split('').map((letter, col) => (
                    <text
                        key={`col-${letter}`}
                        className="nm-board__coord"
                        x={col * 100}
                        y={-20}
                        textAnchor="middle"
                    >
                        {letter}
                    </text>
                ))}
                {LETTERS.split('').map((_, row) => (
                    <text
                        key={`row-${row}`}
                        className="nm-board__coord"
                        x={-22}
                        y={row * 100}
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        {row + 1}
                    </text>
                ))}
            </svg>
            {nodes}
        </div>
    );
}

export default Board;
