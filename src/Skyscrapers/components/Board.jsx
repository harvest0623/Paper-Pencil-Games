import { EMPTY, coordLabel } from '../utils/gameLogic';
import './Board.css';

/**
 * 摩天楼棋盘：四周边缘提示 + 中间 size×size 网格
 * 每个格子点击后由页面上的数字键盘填入楼层高度。
 */
function Board({
    size,
    clues,
    grid,
    solution,
    selected,
    hint,
    onSelect,
    interactive = true
}) {
    const selectedValue = selected ? grid[selected.row][selected.col] : EMPTY;

    /* 与选中格同一行或同一列 */
    const isPeer = (row, col) => {
        if (!selected) return false;
        if (row === selected.row && col === selected.col) return false;
        return row === selected.row || col === selected.col;
    };

    /* 与选中格数字相同 */
    const isSame = (row, col) =>
        selectedValue !== EMPTY && grid[row][col] === selectedValue;

    /* 用户填入但与答案不同 */
    const isWrong = (row, col) => {
        const value = grid[row][col];
        return value !== EMPTY && value !== solution[row][col];
    };

    const isSelected = (row, col) =>
        Boolean(selected) && selected.row === row && selected.col === col;

    const isHint = (row, col) =>
        Boolean(hint) && hint.row === row && hint.col === col;

    const nodes = [];

    /* 四角留白 */
    [
        [1, 1],
        [1, size + 2],
        [size + 2, 1],
        [size + 2, size + 2]
    ].forEach(([row, col], index) => {
        nodes.push(
            <span
                key={`corner-${index}`}
                className="sk-corner"
                style={{ gridRow: row, gridColumn: col }}
            />
        );
    });

    /* 顶部与底部提示：第 col 列从上方 / 下方看到的楼栋数 */
    Array.from({ length: size }).forEach((_, col) => {
        const topValue = clues.top[col];
        const bottomValue = clues.bottom[col];
        const active = selected?.col === col;

        nodes.push(
            <span
                key={`clue-top-${col}`}
                className={`sk-clue sk-clue--top ${active ? 'is-active' : ''} ${
                    topValue ? '' : 'is-hidden'
                }`}
                style={{ gridRow: 1, gridColumn: col + 2 }}
                aria-label={
                    topValue
                        ? `第 ${col + 1} 列顶部提示：可见 ${topValue} 座楼`
                        : `第 ${col + 1} 列顶部没有提示`
                }
            >
                {topValue || ''}
            </span>
        );
        nodes.push(
            <span
                key={`clue-bottom-${col}`}
                className={`sk-clue sk-clue--bottom ${active ? 'is-active' : ''} ${
                    bottomValue ? '' : 'is-hidden'
                }`}
                style={{ gridRow: size + 2, gridColumn: col + 2 }}
                aria-label={
                    bottomValue
                        ? `第 ${col + 1} 列底部提示：可见 ${bottomValue} 座楼`
                        : `第 ${col + 1} 列底部没有提示`
                }
            >
                {bottomValue || ''}
            </span>
        );
    });

    Array.from({ length: size }).forEach((_, row) => {
        const leftValue = clues.left[row];
        const rightValue = clues.right[row];
        const active = selected?.row === row;

        nodes.push(
            <span
                key={`clue-left-${row}`}
                className={`sk-clue sk-clue--left ${active ? 'is-active' : ''} ${
                    leftValue ? '' : 'is-hidden'
                }`}
                style={{ gridRow: row + 2, gridColumn: 1 }}
                aria-label={
                    leftValue
                        ? `第 ${row + 1} 行左侧提示：可见 ${leftValue} 座楼`
                        : `第 ${row + 1} 行左侧没有提示`
                }
            >
                {leftValue || ''}
            </span>
        );
        nodes.push(
            <span
                key={`clue-right-${row}`}
                className={`sk-clue sk-clue--right ${active ? 'is-active' : ''} ${
                    rightValue ? '' : 'is-hidden'
                }`}
                style={{ gridRow: row + 2, gridColumn: size + 2 }}
                aria-label={
                    rightValue
                        ? `第 ${row + 1} 行右侧提示：可见 ${rightValue} 座楼`
                        : `第 ${row + 1} 行右侧没有提示`
                }
            >
                {rightValue || ''}
            </span>
        );

        Array.from({ length: size }).forEach((__, col) => {
            const value = grid[row][col];
            const classes = ['sk-cell'];

            if (col === size - 1) classes.push('is-last-col');
            if (row === size - 1) classes.push('is-last-row');
            if (isPeer(row, col)) classes.push('is-peer');
            if (isSame(row, col)) classes.push('is-same');
            if (isWrong(row, col)) classes.push('is-wrong');
            if (isSelected(row, col)) classes.push('is-selected');

            nodes.push(
                <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    className={classes.join(' ')}
                    style={{ gridRow: row + 2, gridColumn: col + 2 }}
                    onClick={() => interactive && onSelect(row, col)}
                    aria-label={`${coordLabel(row, col)} ${
                        value !== EMPTY ? `楼高 ${value}` : '空'
                    }`}
                >
                    {value !== EMPTY && (
                        <span key={`value-${value}`} className="sk-value">
                            {value}
                        </span>
                    )}
                    {isHint(row, col) && <span className="sk-hint-ring" />}
                </button>
            );
        });
    });

    return (
        <div className="sk-board-wrap">
            <div
                className="sk-board"
                style={{
                    '--n': size,
                    gridTemplateColumns: `var(--clue) repeat(${size}, 1fr) var(--clue)`,
                    gridTemplateRows: `var(--clue) repeat(${size}, 1fr) var(--clue)`
                }}
            >
                <span
                    className="sk-board__bg"
                    aria-hidden="true"
                    style={{
                        gridRow: `2 / span ${size}`,
                        gridColumn: `2 / span ${size}`
                    }}
                />
                {nodes}
            </div>
        </div>
    );
}

export default Board;
