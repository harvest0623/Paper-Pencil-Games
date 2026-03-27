import React from 'react';
import { BOARD_SIZE, EMPTY, BLACK, WHITE } from '../utils/gameLogic';
import './Board.css';

function Board({ board, validMoves, currentPlayer, onCellClick }) {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const rows = ['1', '2', '3', '4', '5', '6', '7', '8'];

    const isValidMove = (row, col) => {
        return validMoves.some(move => move.row === row && move.col === col);
    };

    const renderCell = (row, col) => {
        const cellValue = board[row][col];
        const isMoveValid = isValidMove(row, col);

        let cellClass = 'cell';
        if (isMoveValid) {
            cellClass += ' valid-move';
        }

        return (
            <div
                key={`${row}-${col}`}
                className={cellClass}
                onClick={() => isMoveValid && onCellClick(row, col)}
            >
                {cellValue !== EMPTY && (
                    <div className={`piece ${cellValue === BLACK ? 'black' : 'white'}`}></div>
                )}
                {cellValue === EMPTY && isMoveValid && (
                    <div className={`hint ${currentPlayer === BLACK ? 'black-hint' : 'white-hint'}`}></div>
                )}
            </div>
        );
    };

    const renderBoard = () => {
        const boardRows = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            const cells = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                cells.push(renderCell(row, col));
            }
            boardRows.push(
                <div key={row} className="board-row">
                    {cells}
                </div>
            );
        }
        return boardRows;
    };

    const renderTopLabels = () => {
        return (
            <div className="labels top-labels">
                <div className="label-corner"></div>
                {columns.map((col, index) => (
                    <div key={index} className="label">{col}</div>
                ))}
                <div className="label-corner"></div>
            </div>
        );
    };

    const renderBottomLabels = () => {
        return (
            <div className="labels bottom-labels">
                <div className="label-corner"></div>
                {columns.map((col, index) => (
                    <div key={index} className="label">{col}</div>
                ))}
                <div className="label-corner"></div>
            </div>
        );
    };

    const renderBoardWithSideLabels = () => {
        const boardRows = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            const cells = [];
            cells.push(<div key={`left-${row}`} className="label left-label">{rows[row]}</div>);
            for (let col = 0; col < BOARD_SIZE; col++) {
                cells.push(renderCell(row, col));
            }
            cells.push(<div key={`right-${row}`} className="label right-label">{rows[row]}</div>);
            boardRows.push(
                <div key={row} className="board-row">
                    {cells}
                </div>
            );
        }
        return boardRows;
    };

    return (
        <div className="board-wrapper">
            {renderTopLabels()}
            <div className="board">
                {renderBoardWithSideLabels()}
            </div>
            {renderBottomLabels()}
        </div>
    );
}

export default Board;