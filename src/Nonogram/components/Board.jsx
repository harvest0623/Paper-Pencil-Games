import { useEffect, useRef } from 'react';
import { EMPTY, FILLED, MARKED, lineDone, coordLabel } from '../utils/gameLogic';
import './Board.css';

/**
 * 数织棋盘：左侧行线索 + 顶部列线索 + 可涂黑/标记的格子
 * 左键按当前模式落笔，右键始终为标记；按住左键拖动可连续涂同一片区域
 */
function Board({
    cells,
    rowClues,
    colClues,
    size,
    solution,
    showErrors = false,
    markMode = false,
    hint = null,
    lastMove = null,
    interactive = true,
    onPaint
}) {
    const dragRef = useRef(null);

    /* 松开鼠标即结束拖动 */
    useEffect(() => {
        const stopDrag = () => {
            dragRef.current = null;
        };
        window.addEventListener('mouseup', stopDrag);
        return () => window.removeEventListener('mouseup', stopDrag);
    }, []);

    /* 从事件目标回溯到具体的格子 */
    const cellAt = (node) => {
        const el = node && node.closest ? node.closest('.np-cell') : null;
        if (!el) return null;
        return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
    };

    /* 落笔：已处于目标状态则不重复提交 */
    const paint = (row, col, value) => {
        if (cells[row][col] === value) return;
        onPaint(row, col, value);
    };

    const valueAfterClick = (row, col, mark) => {
        const current = cells[row][col];
        if (mark) return current === MARKED ? EMPTY : MARKED;
        return current === FILLED ? EMPTY : FILLED;
    };

    const handleDown = (event) => {
        if (!interactive) return;
        if (event.button !== 0 && event.button !== 2) return;
        const spot = cellAt(event.target);
        if (!spot) return;
        event.preventDefault();
        const value = valueAfterClick(spot.row, spot.col, event.button === 2 || markMode);
        dragRef.current = value;
        paint(spot.row, spot.col, value);
    };

    /* 拖动经过：mouseover 与 mousemove 都能触发连续涂色 */
    const handleDragOver = (event) => {
        if (!interactive || dragRef.current === null) return;
        const spot = cellAt(event.target);
        if (!spot) return;
        paint(spot.row, spot.col, dragRef.current);
    };

    const renderClue = (clue) =>
        clue.length === 0 ? (
            <span className="np-clue__zero">0</span>
        ) : (
            clue.map((num, index) => (
                <span key={`${num}-${index}`} className="np-clue__num">
                    {num}
                </span>
            ))
        );

    const nodes = [];

    rowClues.forEach((clue, row) => {
        const done = lineDone(cells[row], clue);
        nodes.push(
            <div
                key={`row-clue-${row}`}
                className={`np-clue np-clue--row ${done ? 'is-done' : ''}`}
                style={{ gridRow: row + 2, gridColumn: 1 }}
            >
                {renderClue(clue)}
            </div>
        );
    });

    colClues.forEach((clue, col) => {
        const done = lineDone(
            cells.map((row) => row[col]),
            clue
        );
        nodes.push(
            <div
                key={`col-clue-${col}`}
                className={`np-clue np-clue--col ${done ? 'is-done' : ''}`}
                style={{ gridRow: 1, gridColumn: col + 2 }}
            >
                {renderClue(clue)}
            </div>
        );
    });

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const value = cells[row][col];
            const classes = ['np-cell'];

            if (value === FILLED) classes.push('is-filled');
            if (value === MARKED) classes.push('is-marked');
            if (showErrors && value === FILLED && solution[row][col] === 0) {
                classes.push('is-wrong');
            }
            if (lastMove && lastMove.row === row && lastMove.col === col) {
                classes.push('is-last');
            }
            if ((col + 1) % 5 === 0 && col !== size - 1) classes.push('is-gap-right');
            if ((row + 1) % 5 === 0 && row !== size - 1) classes.push('is-gap-bottom');

            const isHint = Boolean(hint) && hint.row === row && hint.col === col;
            const stateText =
                value === FILLED ? '已涂黑' : value === MARKED ? '已标记' : '空白';

            nodes.push(
                <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    data-row={row}
                    data-col={col}
                    tabIndex={-1}
                    className={classes.join(' ')}
                    style={{ gridRow: row + 2, gridColumn: col + 2 }}
                    aria-label={`${coordLabel(row, col)} ${stateText}`}
                >
                    {isHint && <span className="np-hint-ring" />}
                </button>
            );
        }
    }

    return (
        <div
            className="np-board-wrap"
            style={{
                '--cell': `calc((var(--board) - var(--band)) / ${size})`,
                gridTemplateColumns: `var(--band) repeat(${size}, var(--cell))`,
                gridTemplateRows: `var(--band) repeat(${size}, var(--cell))`
            }}
            onContextMenu={(event) => event.preventDefault()}
            onMouseDown={handleDown}
            onMouseOver={handleDragOver}
            onMouseMove={handleDragOver}
            onMouseUp={() => {
                dragRef.current = null;
            }}
            onMouseLeave={() => {
                dragRef.current = null;
            }}
        >
            {nodes}
        </div>
    );
}

export default Board;
