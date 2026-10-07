import { BOARD_SIZE, COLUMN_LABELS, EMPTY, X, coordLabel } from '../utils/gameLogic';
import './Board.css';

function Board({
    board,
    currentPlayer,
    lastMove,
    winCells = [],
    hint,
    onCellClick,
    interactive = true
}) {
    const isWin = (row, col) => winCells.some((cell) => cell.row === row && cell.col === col);
    const isLast = (row, col) => lastMove && lastMove.row === row && lastMove.col === col;
    const isHint = (row, col) => hint && hint.row === row && hint.col === col;

    const nodes = [];

    /* 四角留白，让坐标与棋盘严格对齐 */
    [1, BOARD_SIZE + 2].forEach((col) => {
        nodes.push(
            <span
                key={`corner-top-${col}`}
                className="tt-corner"
                style={{ gridRow: 1, gridColumn: col }}
            />
        );
        nodes.push(
            <span
                key={`corner-bottom-${col}`}
                className="tt-corner"
                style={{ gridRow: BOARD_SIZE + 2, gridColumn: col }}
            />
        );
    });

    /* 顶部 / 底部列坐标 */
    COLUMN_LABELS.forEach((label, col) => {
        nodes.push(
            <span
                key={`col-top-${label}`}
                className="tt-coord"
                style={{ gridRow: 1, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`col-bottom-${label}`}
                className="tt-coord"
                style={{ gridRow: BOARD_SIZE + 2, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
    });

    for (let row = 0; row < BOARD_SIZE; row++) {
        nodes.push(
            <span
                key={`row-left-${row}`}
                className="tt-coord"
                style={{ gridRow: row + 2, gridColumn: 1 }}
            >
                {row + 1}
            </span>
        );
        nodes.push(
            <span
                key={`row-right-${row}`}
                className="tt-coord"
                style={{ gridRow: row + 2, gridColumn: BOARD_SIZE + 2 }}
            >
                {row + 1}
            </span>
        );

        for (let col = 0; col < BOARD_SIZE; col++) {
            const value = board[row][col];
            const playable = value === EMPTY && interactive;
            const classes = ['tt-cell'];
            if (playable) classes.push('is-playable');
            if (isWin(row, col)) classes.push('is-win');

            nodes.push(
                <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    className={classes.join(' ')}
                    style={{ gridRow: row + 2, gridColumn: col + 2 }}
                    onClick={() => playable && onCellClick(row, col)}
                    disabled={!playable}
                    aria-label={coordLabel(row, col)}
                >
                    {value !== EMPTY ? (
                        <>
                            <span
                                className={`tt-mark tt-mark--${
                                    value === X ? 'x' : 'o'
                                }`}
                            />
                            {isLast(row, col) && <span className="tt-last" />}
                        </>
                    ) : (
                        playable && (
                            <>
                                <span className="tt-dot" />
                                <span
                                    className={`tt-mark tt-ghost tt-mark--${
                                        currentPlayer === X ? 'x' : 'o'
                                    }`}
                                />
                            </>
                        )
                    )}
                    {isHint(row, col) && <span className="tt-hint-ring" />}
                </button>
            );
        }
    }

    return (
        <div className="tt-board-wrap">
            <div className="tt-board" aria-hidden="true" />
            {nodes}
        </div>
    );
}

export default Board;