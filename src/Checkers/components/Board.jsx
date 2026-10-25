import { FILE_LETTERS, isDarkSquare, squareLabel } from '../utils/gameLogic';
import './Board.css';

const RANKS = Array.from({ length: 8 }, (_, index) => 8 - index);

/**
 * 西洋跳棋棋盘
 * 8 × 8 方格，只有深色格参与对局。
 * 点击自己的棋子即选中，点击高亮落点即走子（吃子路线会自动走完）。
 */
function Board({
    board,
    selected,
    destinations,
    lastMove,
    hint,
    interactive,
    onSquareClick
}) {
    const destMap = new Map();
    destinations.forEach((move) => {
        const exists = destMap.get(move.to);
        if (!exists || move.captures.length > exists.captures.length) {
            destMap.set(move.to, move);
        }
    });

    const captured = new Set();
    destinations.forEach((move) => {
        move.captures.forEach((index) => captured.add(index));
    });

    const lastFrom = lastMove ? lastMove.from : -1;
    const lastTo = lastMove ? lastMove.to : -1;
    const hintFrom = hint ? hint.from : -1;
    const hintTo = hint ? hint.to : -1;
    const hintSet = hint ? new Set(hint.path) : null;

    const cells = [];
    for (let index = 0; index < 64; index++) {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const dark = isDarkSquare(row, col);
        const piece = board[index];

        if (!dark) {
            cells.push(<div key={index} className="chk-sq is-light" aria-hidden="true" />);
            continue;
        }

        const classes = ['chk-sq', 'is-dark'];
        if (index === lastFrom) classes.push('is-last-from');
        if (index === lastTo) classes.push('is-last-to');

        const isSelected = selected && selected.index === index;
        const dest = destMap.get(index);
        const isHint = index === hintFrom || index === hintTo;
        const isHintPath = hintSet && hintSet.has(index) && !isHint;

        cells.push(
            <button
                key={index}
                type="button"
                className={classes.join(' ')}
                onClick={() => onSquareClick(index)}
                disabled={!interactive}
                aria-label={`${squareLabel(index)}${
                    piece
                        ? ` ${piece.player === 'blue' ? '蓝棋' : '红棋'}${
                              piece.king ? ' 王' : ''
                          }`
                        : ' 空位'
                }`}
            >
                {index === lastTo && <span className="chk-sq__last" aria-hidden="true" />}

                {piece && (
                    <span
                        className={`chk-piece is-${piece.player}${
                            piece.king ? ' is-king' : ''
                        }${isSelected ? ' is-selected' : ''}`}
                    >
                        {piece.king && (
                            <span className="chk-piece__crown" aria-hidden="true">
                                ♛
                            </span>
                        )}
                    </span>
                )}

                {piece && captured.has(index) && (
                    <span className="chk-victim" aria-hidden="true" />
                )}

                {dest && (
                    <span
                        className={`chk-dot${
                            dest.captures.length ? ' is-jump' : ''
                        }`}
                        aria-hidden="true"
                    />
                )}

                {isHint && <span className="chk-hint" aria-hidden="true" />}
                {isHintPath && <span className="chk-hint-dot" aria-hidden="true" />}
            </button>
        );
    }

    return (
        <div className="chk-board">
            <div className="chk-board__cols chk-board__cols--top" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`top-${letter}`}>{letter}</span>
                ))}
            </div>

            <div className="chk-board__ranks chk-board__ranks--left" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`left-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="chk-board__grid">{cells}</div>

            <div className="chk-board__ranks chk-board__ranks--right" aria-hidden="true">
                {RANKS.map((rank) => (
                    <span key={`right-${rank}`}>{rank}</span>
                ))}
            </div>

            <div className="chk-board__cols chk-board__cols--bottom" aria-hidden="true">
                {FILE_LETTERS.split('').map((letter) => (
                    <span key={`bottom-${letter}`}>{letter}</span>
                ))}
            </div>
        </div>
    );
}

export default Board;
