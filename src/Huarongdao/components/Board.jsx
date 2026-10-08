import { COLUMN_LABELS, EMPTY, coordLabel, isTilePlaced } from '../utils/gameLogic';
import './Board.css';

/**
 * 数字华容道棋盘
 * 方块使用绝对定位 + transform 位移，便于 CSS 过渡实现滑动动画
 */
function Board({ board, size, hint, onTileClick, interactive = true }) {
    const labels = COLUMN_LABELS.slice(0, size);

    const isHint = (row, col) =>
        Boolean(hint) && hint.row === row && hint.col === col;

    /* 空格位置：用于判断哪些方块可以滑动 */
    let emptyRow = -1;
    let emptyCol = -1;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === EMPTY) {
                emptyRow = row;
                emptyCol = col;
            }
        }
    }

    const isMovable = (row, col) =>
        interactive &&
        Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;

    const tiles = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const value = board[row][col];
            /* 空格画成一个凹槽占位 */
            if (value === EMPTY) {
                tiles.push(
                    <div
                        key="hole"
                        className="hr-hole"
                        style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
                        aria-hidden="true"
                    />
                );
                continue;
            }

            const classes = ['hr-tile'];
            if (isTilePlaced(board, row, col)) classes.push('is-placed');
            if (isMovable(row, col)) classes.push('is-movable');
            if (isHint(row, col)) classes.push('is-hint');

            tiles.push(
                <button
                    key={value}
                    type="button"
                    className={classes.join(' ')}
                    style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
                    onClick={() => onTileClick(row, col)}
                    aria-label={`${coordLabel(row, col)} 数字 ${value}`}
                >
                    <span className="hr-tile__face">
                        <span className="hr-tile__num">{value}</span>
                    </span>
                </button>
            );
        }
    }

    return (
        <div className="hr-board-wrap" style={{ '--cols': size }}>
            <div className="hr-coord-row">
                {labels.map((label) => (
                    <span key={`top-${label}`} className="hr-coord">
                        {label}
                    </span>
                ))}
            </div>

            <div className="hr-board-mid">
                <div className="hr-coord-col">
                    {Array.from({ length: size }, (_, row) => (
                        <span key={`left-${row}`} className="hr-coord">
                            {row + 1}
                        </span>
                    ))}
                </div>

                <div className="hr-board">{tiles}</div>

                <div className="hr-coord-col">
                    {Array.from({ length: size }, (_, row) => (
                        <span key={`right-${row}`} className="hr-coord">
                            {row + 1}
                        </span>
                    ))}
                </div>
            </div>

            <div className="hr-coord-row">
                {labels.map((label) => (
                    <span key={`bottom-${label}`} className="hr-coord">
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default Board;
