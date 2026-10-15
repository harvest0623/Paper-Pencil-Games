import {
    COLS,
    ROWS,
    EMPTY,
    RED,
    COLUMN_LABELS,
    getDropRow
} from '../utils/gameLogic';
import './Board.css';

function Board({
    board,
    currentPlayer,
    lastMove,
    winCells = [],
    hint,
    onColumnClick,
    interactive = true
}) {
    const isWin = (row, col) => winCells.some((cell) => cell.row === row && cell.col === col);
    const isLast = (row, col) => lastMove && lastMove.row === row && lastMove.col === col;
    const isHint = (row, col) => hint && hint.row === row && hint.col === col;

    const nodes = [];

    /* 四角留白，让坐标与棋盘严格对齐 */
    [1, COLS + 2].forEach((col) => {
        nodes.push(
            <span
                key={`corner-top-${col}`}
                className="cf-corner"
                style={{ gridRow: 1, gridColumn: col }}
            />
        );
        nodes.push(
            <span
                key={`corner-bottom-${col}`}
                className="cf-corner"
                style={{ gridRow: ROWS + 2, gridColumn: col }}
            />
        );
    });

    /* 顶部 / 底部列坐标 */
    COLUMN_LABELS.forEach((label, col) => {
        nodes.push(
            <span
                key={`col-top-${label}`}
                className="cf-coord"
                style={{ gridRow: 1, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`col-bottom-${label}`}
                className="cf-coord"
                style={{ gridRow: ROWS + 2, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
    });

    /* 左右行坐标（自下而上编号） */
    for (let row = 0; row < ROWS; row++) {
        const label = ROWS - row;
        nodes.push(
            <span
                key={`row-left-${row}`}
                className="cf-coord"
                style={{ gridRow: row + 2, gridColumn: 1 }}
            >
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`row-right-${row}`}
                className="cf-coord"
                style={{ gridRow: row + 2, gridColumn: COLS + 2 }}
            >
                {label}
            </span>
        );
    }

    /* 七列，整列可点击，棋子依次落到底部空位 */
    for (let col = 0; col < COLS; col++) {
        const dropRow = getDropRow(board, col);
        const columnPlayable = interactive && dropRow !== -1;
        const cells = [];

        for (let row = 0; row < ROWS; row++) {
            const value = board[row][col];
            const classes = ['cf-cell'];
            if (isWin(row, col)) classes.push('is-win');

            cells.push(
                <span key={`cell-${col}-${row}`} className={classes.join(' ')}>
                    {value !== EMPTY && (
                        <>
                            <span
                                className={`cf-disc cf-disc--${value === RED ? 'red' : 'yellow'}`}
                            />
                            {isLast(row, col) && <span className="cf-last" />}
                        </>
                    )}
                    {value === EMPTY && row === dropRow && columnPlayable && (
                        <span
                            className={`cf-disc cf-ghost cf-disc--${
                                currentPlayer === RED ? 'red' : 'yellow'
                            }`}
                        />
                    )}
                    {isHint(row, col) && <span className="cf-hint-ring" />}
                </span>
            );
        }

        nodes.push(
            <button
                key={`col-${col}`}
                type="button"
                className={`cf-col ${columnPlayable ? 'is-playable' : ''}`}
                style={{ gridColumn: col + 2, gridRow: `2 / ${ROWS + 2}` }}
                onClick={() => columnPlayable && onColumnClick(col)}
                disabled={!columnPlayable}
                aria-label={`${COLUMN_LABELS[col]} 列落子`}
            >
                {cells}
            </button>
        );
    }

    return (
        <div className="cf-wrap">
            <div className="cf-board" aria-hidden="true" />
            {nodes}
        </div>
    );
}

export default Board;
