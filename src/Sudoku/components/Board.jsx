import { SIZE, COLUMN_LABELS, EMPTY, coordLabel } from '../utils/gameLogic';
import './Board.css';

/**
 * 数独棋盘：9×9 网格 + 3×3 宫分隔线 + 坐标标签
 */
function Board({
    grid,
    notes,
    given,
    solution,
    selected,
    hint,
    onCellClick,
    interactive = true
}) {
    const selectedValue = selected ? grid[selected.row][selected.col] : EMPTY;

    /* 与选中格同行、同列或同宫 */
    const isPeer = (row, col) => {
        if (!selected) return false;
        if (row === selected.row && col === selected.col) return false;
        const sameRow = row === selected.row;
        const sameCol = col === selected.col;
        const sameBox =
            Math.floor(row / 3) === Math.floor(selected.row / 3) &&
            Math.floor(col / 3) === Math.floor(selected.col / 3);
        return sameRow || sameCol || sameBox;
    };

    /* 与选中格数字相同 */
    const isSame = (row, col) =>
        selectedValue !== EMPTY && grid[row][col] === selectedValue;

    /* 用户填入但与该格正确答案不同 */
    const isWrong = (row, col) => {
        const value = grid[row][col];
        if (value === EMPTY || given[row][col]) return false;
        return value !== solution[row][col];
    };

    const isSelected = (row, col) =>
        Boolean(selected) && selected.row === row && selected.col === col;

    const isHint = (row, col) =>
        Boolean(hint) && hint.row === row && hint.col === col;

    const nodes = [];

    /* 四角留白，保证坐标与棋盘严格对齐 */
    [1, SIZE + 2].forEach((col) => {
        nodes.push(
            <span key={`corner-top-${col}`} className="sd-corner" style={{ gridRow: 1, gridColumn: col }} />
        );
        nodes.push(
            <span
                key={`corner-bottom-${col}`}
                className="sd-corner"
                style={{ gridRow: SIZE + 2, gridColumn: col }}
            />
        );
    });

    /* 顶部 / 底部列坐标 A–I */
    COLUMN_LABELS.forEach((label, col) => {
        nodes.push(
            <span key={`col-top-${label}`} className="sd-coord" style={{ gridRow: 1, gridColumn: col + 2 }}>
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`col-bottom-${label}`}
                className="sd-coord"
                style={{ gridRow: SIZE + 2, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
    });

    for (let row = 0; row < SIZE; row++) {
        nodes.push(
            <span key={`row-left-${row}`} className="sd-coord" style={{ gridRow: row + 2, gridColumn: 1 }}>
                {row + 1}
            </span>
        );
        nodes.push(
            <span
                key={`row-right-${row}`}
                className="sd-coord"
                style={{ gridRow: row + 2, gridColumn: SIZE + 2 }}
            >
                {row + 1}
            </span>
        );

        for (let col = 0; col < SIZE; col++) {
            const value = grid[row][col];
            const wrong = isWrong(row, col);
            const classes = ['sd-cell'];

            if (col % 3 === 2) classes.push('is-box-right');
            if (row % 3 === 2) classes.push('is-box-bottom');
            if (col % 3 === 0) classes.push('is-box-left');
            if (row % 3 === 0) classes.push('is-box-top');
            if (isPeer(row, col)) classes.push('is-peer');
            if (isSame(row, col)) classes.push('is-same');
            if (wrong) classes.push('is-wrong');
            if (isSelected(row, col)) classes.push('is-selected');
            if (!given[row][col] && value !== EMPTY) classes.push('is-user');

            nodes.push(
                <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    className={classes.join(' ')}
                    style={{ gridRow: row + 2, gridColumn: col + 2 }}
                    onClick={() => interactive && onCellClick(row, col)}
                    aria-label={`${coordLabel(row, col)} ${value !== EMPTY ? value : '空'}`}
                >
                    {value !== EMPTY ? (
                        <span key={`v-${value}`} className="sd-value">
                            {value}
                        </span>
                    ) : (
                        notes[row][col].length > 0 && (
                            <span className="sd-notes">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                    <span
                                        key={n}
                                        className={notes[row][col].includes(n) ? 'is-on' : ''}
                                    >
                                        {n}
                                    </span>
                                ))}
                            </span>
                        )
                    )}
                    {isHint(row, col) && <span className="sd-hint-ring" />}
                </button>
            );
        }
    }

    return (
        <div className="sd-board-wrap">
            <div className="sd-board-bg" aria-hidden="true" />
            {nodes}
        </div>
    );
}

export default Board;