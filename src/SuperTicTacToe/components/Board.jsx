import {
    BOARD_SIZE,
    COLUMN_LABELS,
    EMPTY,
    X,
    O,
    DRAW,
    coordLabel,
    subCoordLabel,
    isSubPlayable,
    getLocalWinningCells
} from '../utils/gameLogic';
import './Board.css';

/* 子棋盘在大棋盘中的坐标标签（行列各三个） */
const ROW_LABELS = ['1', '2', '3'];

function Board({
    board,
    subWinners,
    forcedSub,
    currentPlayer,
    lastMove,
    winSubs = [],
    hint,
    onCellClick,
    interactive = true,
    finished = false
}) {
    /* forcedSub 若指向已结束 / 已下满的子棋盘，则视为自由落子 */
    const forced =
        forcedSub !== null &&
        forcedSub !== undefined &&
        isSubPlayable(board, subWinners, forcedSub)
            ? forcedSub
            : null;

    const isFree = forced === null;
    const isWinSub = (sub) => winSubs.includes(sub);
    const isLast = (sub, row, col) =>
        lastMove && lastMove.sub === sub && lastMove.row === row && lastMove.col === col;
    const isHint = (sub, row, col) =>
        hint && hint.sub === sub && hint.row === row && hint.col === col;

    const nodes = [];

    /* 四角留白，让坐标与棋盘严格对齐 */
    [1, BOARD_SIZE + 2].forEach((col) => {
        nodes.push(
            <span
                key={`corner-top-${col}`}
                className="st-corner"
                style={{ gridRow: 1, gridColumn: col }}
            />
        );
        nodes.push(
            <span
                key={`corner-bottom-${col}`}
                className="st-corner"
                style={{ gridRow: BOARD_SIZE + 2, gridColumn: col }}
            />
        );
    });

    /* 顶部 / 底部列坐标（大棋盘列） */
    COLUMN_LABELS.forEach((label, col) => {
        nodes.push(
            <span
                key={`col-top-${label}`}
                className="st-coord"
                style={{ gridRow: 1, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`col-bottom-${label}`}
                className="st-coord"
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
                className="st-coord"
                style={{ gridRow: row + 2, gridColumn: 1 }}
            >
                {ROW_LABELS[row]}
            </span>
        );
        nodes.push(
            <span
                key={`row-right-${row}`}
                className="st-coord"
                style={{ gridRow: row + 2, gridColumn: BOARD_SIZE + 2 }}
            >
                {ROW_LABELS[row]}
            </span>
        );
    }

    /* 九个嵌套子棋盘 */
    for (let sub = 0; sub < 9; sub++) {
        const subRow = Math.floor(sub / BOARD_SIZE);
        const subCol = sub % BOARD_SIZE;
        const winner = subWinners[sub];
        const decided = winner !== EMPTY;
        const target = !finished && !decided && (isFree || forced === sub);
        const playable = interactive && target;
        const localWin = decided && winner !== DRAW ? getLocalWinningCells(board[sub]) : null;

        const subClasses = ['st-sub'];
        if (decided) subClasses.push('is-decided');
        if (winner === X) subClasses.push('is-x');
        else if (winner === O) subClasses.push('is-o');
        else if (winner === DRAW) subClasses.push('is-draw');
        if (target) subClasses.push('is-active');
        if (!finished && !decided && !target) subClasses.push('is-locked');
        if (isWinSub(sub)) subClasses.push('is-winning');

        const cells = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const value = board[sub][row][col];
                const cellPlayable = playable && value === EMPTY;
                const cellClasses = ['st-cell'];
                if (cellPlayable) cellClasses.push('is-playable');
                if (localWin && localWin.cells.some((c) => c.row === row && c.col === col)) {
                    cellClasses.push('is-win');
                }

                cells.push(
                    <button
                        key={`cell-${sub}-${row}-${col}`}
                        type="button"
                        className={cellClasses.join(' ')}
                        onClick={() => cellPlayable && onCellClick(sub, row, col)}
                        disabled={!cellPlayable}
                        aria-label={`子棋盘 ${subCoordLabel(sub)} 的 ${coordLabel(row, col)}`}
                    >
                        {value !== EMPTY ? (
                            <>
                                <span
                                    className={`st-mark st-mark--${value === X ? 'x' : 'o'}`}
                                />
                                {isLast(sub, row, col) && <span className="st-last" />}
                            </>
                        ) : (
                            cellPlayable && (
                                <>
                                    <span className="st-dot" />
                                    <span
                                        className={`st-mark st-ghost st-mark--${
                                            currentPlayer === X ? 'x' : 'o'
                                        }`}
                                    />
                                </>
                            )
                        )}
                        {isHint(sub, row, col) && <span className="st-hint-ring" />}
                    </button>
                );
            }
        }

        nodes.push(
            <div
                key={`sub-${sub}`}
                className={subClasses.join(' ')}
                style={{ gridRow: subRow + 2, gridColumn: subCol + 2 }}
            >
                <span className="st-sub__tag">{subCoordLabel(sub)}</span>
                <div className="st-sub__grid">{cells}</div>
                {decided && (
                    <span
                        className={`st-sub__watermark st-sub__watermark--${
                            winner === X ? 'x' : winner === DRAW ? 'draw' : 'o'
                        }`}
                        aria-hidden="true"
                    >
                        {winner === DRAW ? '平' : ''}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="st-wrap">
            <div className="st-board" aria-hidden="true" />
            {nodes}
        </div>
    );
}

export default Board;