import { useMemo } from 'react';
import { coordLabel } from '../utils/gameLogic';
import './Board.css';

/**
 * 数和棋盘：黑格以斜线分成上下两半，分别标注纵向（右上）与横向（左下）线索，
 * 白格用于填写 1~9。选中一格时会高亮它所在的整个横段与纵段，便于交叉推演。
 */
function Board({
    size,
    layout,
    cells,
    rowClues,
    colClues,
    givens,
    selected,
    conflicts,
    wrongs,
    hint,
    lastMove,
    interactive = true,
    onSelect
}) {
    /* 选中格所在的横段与纵段（用于交叉高亮） */
    const highlight = useMemo(() => {
        const set = new Set();
        if (!selected || selected.row < 1 || selected.col < 1) return set;
        const { row, col } = selected;
        if (!layout[row]?.[col]) return set;

        let start = col;
        while (start > 1 && layout[row][start - 1]) start -= 1;
        for (let c = start; c < size && layout[row][c]; c += 1) set.add(`${row},${c}`);

        let top = row;
        while (top > 1 && layout[top - 1][col]) top -= 1;
        for (let r = top; r < size && layout[r][col]; r += 1) set.add(`${r},${col}`);
        return set;
    }, [selected, layout, size]);

    const nodes = [];

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!layout[r][c]) {
                const rowClue = rowClues[r][c];
                const colClue = colClues[r][c];
                const both = rowClue != null && colClue != null;
                nodes.push(
                    <div
                        key={`clue-${r}-${c}`}
                        className={`kr-clue ${both ? 'kr-clue--both' : ''}`}
                    >
                        {colClue != null && <span className="kr-clue__col">{colClue}</span>}
                        {rowClue != null && <span className="kr-clue__row">{rowClue}</span>}
                    </div>
                );
                continue;
            }

            const value = cells[r][c];
            const isGiven = givens?.[r][c] >= 1;
            const key = `${r},${c}`;
            const classes = ['kr-cell'];

            if (value >= 1 && value <= 9) classes.push('is-filled');
            if (isGiven) classes.push('is-given');
            if (highlight.has(key)) classes.push('is-line');
            if (selected && selected.row === r && selected.col === c) classes.push('is-selected');
            if (conflicts?.has(key)) classes.push('is-conflict');
            if (wrongs?.has(key)) classes.push('is-wrong');
            if (lastMove && lastMove.row === r && lastMove.col === c) classes.push('is-last');

            const isHint = Boolean(hint) && hint.row === r && hint.col === c;
            const stateText = value >= 1 ? `已填 ${value}` : '空格';

            nodes.push(
                <button
                    key={`cell-${r}-${c}`}
                    type="button"
                    data-row={r}
                    data-col={c}
                    tabIndex={-1}
                    className={classes.join(' ')}
                    aria-label={`${coordLabel(r, c)} ${stateText}`}
                    onMouseDown={(event) => {
                        if (!interactive) return;
                        event.preventDefault();
                        onSelect?.(r, c);
                    }}
                >
                    {value >= 1 ? value : ''}
                    {isHint && <span className="kr-hint-ring" />}
                </button>
            );
        }
    }

    return (
        <div
            className="kr-board"
            style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                gridTemplateRows: `repeat(${size}, 1fr)`,
                '--cell': `calc((var(--board) - 16px) / ${size})`
            }}
            onContextMenu={(event) => event.preventDefault()}
        >
            {nodes}
        </div>
    );
}

export default Board;
