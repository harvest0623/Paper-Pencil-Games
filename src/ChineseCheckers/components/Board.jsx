import './Board.css';

/**
 * 跳棋棋盘
 * 121 个棋位按三角点阵排布，棋子与提示标记都用绝对定位渲染。
 * 点击事件统一由棋位按钮接收：点自己的棋子即选中，点高亮点即落子。
 */
function Board({ board, state, selected, destinations, lastMove, hint, interactive, onCellClick }) {
    const destMap = new Map();
    destinations.forEach((move) => {
        const exists = destMap.get(move.to);
        if (!exists || move.jumps > exists.jumps) destMap.set(move.to, move);
    });

    const lastFrom = lastMove ? lastMove.from : -1;
    const lastTo = lastMove ? lastMove.to : -1;

    const cellClass = (cell) => {
        const classes = ['cc-cell'];
        if (board.triangles.top.includes(cell.id)) classes.push('is-home-blue');
        if (board.triangles.bottom.includes(cell.id)) classes.push('is-home-red');
        if (cell.id === lastFrom) classes.push('is-last-from');
        if (cell.id === lastTo) classes.push('is-last-to');
        if (interactive) classes.push('is-active');
        return classes.join(' ');
    };

    const pieces = [];
    ['blue', 'red'].forEach((player) => {
        state.pieces[player].forEach((cellId, index) => {
            const cell = board.cells[cellId];
            const isSelected =
                selected && selected.player === player && selected.piece === index;
            pieces.push(
                <span
                    key={`${player}-${index}`}
                    className={`cc-piece is-${player}${isSelected ? ' is-selected' : ''}`}
                    style={{ '--x': cell.x, '--y': cell.y }}
                    aria-hidden="true"
                >
                    <span className="cc-piece__face" />
                </span>
            );
        });
    });

    return (
        <div className="cc-board">
            <div className="cc-cells">
                {board.cells.map((cell) => {
                    const dest = destMap.get(cell.id);
                    const isHint = hint && hint.to === cell.id;
                    return (
                        <button
                            key={cell.id}
                            type="button"
                            className={cellClass(cell)}
                            style={{ '--x': cell.x, '--y': cell.y }}
                            onClick={() => onCellClick(cell.id)}
                            disabled={!interactive}
                            aria-label={`第 ${cell.row + 1} 行棋位`}
                        >
                            {dest && (
                                <span
                                    className={`cc-cell__dot${
                                        dest.jumps > 0 ? ' is-jump' : ''
                                    }`}
                                />
                            )}
                            {isHint && <span className="cc-cell__hint" />}
                        </button>
                    );
                })}
            </div>

            <div className="cc-pieces">{pieces}</div>
        </div>
    );
}

export default Board;
