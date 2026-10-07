import React from 'react';
import { BOARD_SIZE, COLUMN_LABELS, EMPTY, BLACK } from '../utils/gameLogic';
import './Board.css';

function Board({
    board,
    validMoves = [],
    currentPlayer,
    lastMove,
    flippedCells = [],
    hint,
    onCellClick,
    interactive = true
}) {
    const isValidMove = (row, col) =>
        validMoves.some((move) => move.row === row && move.col === col);

    const isFlipped = (row, col) =>
        flippedCells.some((cell) => cell.row === row && cell.col === col);

    const isLast = (row, col) =>
        lastMove && lastMove.row === row && lastMove.col === col;

    const isHint = (row, col) => hint && hint.row === row && hint.col === col;

    const renderCell = (row, col) => {
        const cellValue = board[row][col];
        const valid = isValidMove(row, col);
        const flipped = isFlipped(row, col);
        const last = isLast(row, col);
        const hintHere = isHint(row, col);

        const classes = ['rv-cell'];
        if (valid) classes.push('is-valid');
        if (hintHere) classes.push('is-hint-target');

        return (
            <div
                key={`${row}-${col}`}
                className={classes.join(' ')}
                onClick={() => interactive && valid && onCellClick(row, col)}
                role={valid ? 'button' : undefined}
                aria-label={valid ? `${COLUMN_LABELS[col]}${row + 1}` : undefined}
            >
                {cellValue !== EMPTY ? (
                    <div
                        className={[
                            'rv-piece',
                            cellValue === BLACK ? 'is-black' : 'is-white',
                            flipped ? 'is-flipping' : '',
                            last ? 'is-last' : ''
                        ].join(' ')}
                    />
                ) : (
                    valid && (
                        <div
                            className={`rv-hint ${
                                currentPlayer === BLACK ? 'is-black' : 'is-white'
                            }`}
                        />
                    )
                )}
                {hintHere && <span className="rv-hint-ring" />}
            </div>
        );
    };

    const renderBoard = () => {
        const rows = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            const cells = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                cells.push(renderCell(row, col));
            }
            rows.push(
                <div key={row} className="rv-row">
                    {cells}
                </div>
            );
        }
        return rows;
    };

    return (
        <div className="rv-board-wrap">
            <div className="rv-coords rv-coords--top">
                <span className="rv-corner" />
                {COLUMN_LABELS.map((label) => (
                    <span key={label} className="rv-coord">
                        {label}
                    </span>
                ))}
                <span className="rv-corner" />
            </div>

            <div className="rv-board-mid">
                <div className="rv-coords rv-coords--side">
                    {Array.from({ length: BOARD_SIZE }, (_, i) => (
                        <span key={i} className="rv-coord">
                            {i + 1}
                        </span>
                    ))}
                </div>

                <div className="rv-board">
                    <div className="rv-board__grid">{renderBoard()}</div>
                </div>

                <div className="rv-coords rv-coords--side">
                    {Array.from({ length: BOARD_SIZE }, (_, i) => (
                        <span key={i} className="rv-coord">
                            {i + 1}
                        </span>
                    ))}
                </div>
            </div>

            <div className="rv-coords rv-coords--bottom">
                <span className="rv-corner" />
                {COLUMN_LABELS.map((label) => (
                    <span key={label} className="rv-coord">
                        {label}
                    </span>
                ))}
                <span className="rv-corner" />
            </div>
        </div>
    );
}

export default Board;