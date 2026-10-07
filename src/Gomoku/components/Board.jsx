import React from 'react';
import {
    BOARD_SIZE,
    COLUMN_LABELS,
    STAR_POINTS,
    EMPTY,
    BLACK
} from '../utils/gameLogic';
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
    const isWin = (row, col) =>
        winCells.some((cell) => cell.row === row && cell.col === col);

    const isLast = (row, col) => lastMove && lastMove.row === row && lastMove.col === col;

    const isHint = (row, col) => hint && hint.row === row && hint.col === col;

    const renderPoint = (row, col) => {
        const value = board[row][col];
        const win = isWin(row, col);
        const last = isLast(row, col) && !win;
        const hintHere = isHint(row, col);
        const clickable = interactive && value === EMPTY;

        return (
            <div
                key={`${row}-${col}`}
                className={`gm-point ${clickable ? 'is-clickable' : ''}`}
                onClick={() => clickable && onCellClick(row, col)}
                role={clickable ? 'button' : undefined}
                aria-label={`${COLUMN_LABELS[col]}${row + 1}`}
            >
                {value !== EMPTY ? (
                    <div
                        className={[
                            'gm-stone',
                            value === BLACK ? 'is-black' : 'is-white',
                            last ? 'is-last' : '',
                            win ? 'is-win' : ''
                        ].join(' ')}
                    />
                ) : (
                    clickable && (
                        <div
                            className={`gm-ghost ${
                                currentPlayer === BLACK ? 'is-black' : 'is-white'
                            }`}
                        />
                    )
                )}
                {hintHere && <span className="gm-hint-ring" />}
            </div>
        );
    };

    const renderPoints = () => {
        const points = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                points.push(renderPoint(row, col));
            }
        }
        return points;
    };

    return (
        <div className="gm-board-wrap">
            <div className="gm-coords gm-coords--top">
                <span className="gm-corner" />
                {COLUMN_LABELS.map((label) => (
                    <span key={label} className="gm-coord">
                        {label}
                    </span>
                ))}
                <span className="gm-corner" />
            </div>

            <div className="gm-board-mid">
                <div className="gm-coords gm-coords--side">
                    {Array.from({ length: BOARD_SIZE }, (_, i) => (
                        <span key={i} className="gm-coord">
                            {i + 1}
                        </span>
                    ))}
                </div>

                <div className="gm-board">
                    {STAR_POINTS.map(([row, col]) => (
                        <span
                            key={`star-${row}-${col}`}
                            className="gm-star"
                            style={{
                                left: `calc((${col} + 0.5) * var(--cell))`,
                                top: `calc((${row} + 0.5) * var(--cell))`
                            }}
                        />
                    ))}
                    <div className="gm-points">{renderPoints()}</div>
                </div>

                <div className="gm-coords gm-coords--side">
                    {Array.from({ length: BOARD_SIZE }, (_, i) => (
                        <span key={i} className="gm-coord">
                            {i + 1}
                        </span>
                    ))}
                </div>
            </div>

            <div className="gm-coords gm-coords--bottom">
                <span className="gm-corner" />
                {COLUMN_LABELS.map((label) => (
                    <span key={label} className="gm-coord">
                        {label}
                    </span>
                ))}
                <span className="gm-corner" />
            </div>
        </div>
    );
}

export default Board;