import { FILE_LETTERS, ROWS, rowOf, squareLabel } from '../utils/gameLogic';
import './Board.css';

const RANKS = Array.from({ length: ROWS }, (_, index) => ROWS - index);

/**
 * 暗棋棋盘：4 行 × 8 列，开局全部暗置。
 * 点击暗棋即翻开；点击自己的明子选中后再点击落点行动。
 */
function Board({
    board,
    selected,
    targets,
    lastAction,
    hint,
    interactive,
    onCellClick
}) {
    const targetMap = new Map();
    targets.forEach((action) => targetMap.set(action.to, action));

    const lastFrom = lastAction && lastAction.from !== null ? lastAction.from : -1;
    const lastTo = lastAction ? lastAction.to : -1;
    const hintFrom = hint && hint.from !== null ? hint.from : -1;
    const hintTo = hint ? hint.to : -1;

    const cells = [];

    for (let index = 0; index < board.length; index++) {
        const piece = board[index];
        const row = rowOf(index);
        const classes = ['bq-cell'];
        if (row === ROWS - 1) classes.push('is-bottom');
        if (index === lastFrom) classes.push('is-last-from');
        if (index === lastTo) classes.push('is-last-to');

        const target = targetMap.get(index);
        const isSelected = selected === index;
        const isHint = index === hintFrom || index === hintTo;

        cells.push(
            <button
                key={index}
                type="button"
                className={classes.join(' ')}
                onClick={() => onCellClick(index)}
                disabled={!interactive}
                aria-label={`${squareLabel(index)}${
                    piece
                        ? piece.revealed
                            ? ` ${piece.char} ${piece.color === 'red' ? '红方' : '黑方'}`
                            : ' 暗棋'
                        : ' 空位'
                }`}
            >
                {piece ? (
                    piece.revealed ? (
                        <span
                            className={`bq-piece is-${piece.color}${
                                piece.type === 'king' ? ' is-king' : ''
                            }${isSelected ? ' is-selected' : ''}${
                                index === lastTo && lastAction && lastAction.kind === 'flip'
                                    ? ' is-revealing'
                                    : ''
                            }`}
                        >
                            {piece.char}
                        </span>
                    ) : (
                        <span className="bq-back" aria-hidden="true">
                            <span className="bq-back__pattern" />
                            <span className="bq-back__seal">弈</span>
                        </span>
                    )
                ) : (
                    <span className="bq-empty" aria-hidden="true" />
                )}

                {index === lastTo && (
                    <span className="bq-last-ring" aria-hidden="true" />
                )}

                {target && target.kind === 'move' && (
                    <span className="bq-dot" aria-hidden="true" />
                )}
                {target && target.kind === 'capture' && (
                    <span className="bq-capture-ring" aria-hidden="true" />
                )}

                {isHint && <span className="bq-hint" aria-hidden="true" />}
            </button>
        );
    }

    return (
        <div className="bq-board">
            <div className="bq-board__cols bq-board__cols--top" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`top-${letter}`}>{letter}</span>
                ))}
            </div>

            <div className="bq-board__ranks bq-board__ranks--left" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`left-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="bq-board__grid">{cells}</div>

            <div className="bq-board__ranks bq-board__ranks--right" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`right-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="bq-board__cols bq-board__cols--bottom" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`bottom-${letter}`}>{letter}</span>
                ))}
            </div>
        </div>
    );
}

export default Board;
