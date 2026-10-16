import { DOTS, BOXES, EMPTY, P1, H, V, LETTERS, edgeLabel } from '../utils/gameLogic';
import './Board.css';

/* 5 = BOXES，与 gameLogic.js 中的 DOTS - 1 保持一致 */
function Board({ board, currentPlayer, lastMove, hint, onEdgeClick, interactive = true }) {
    const pos = (n) => `calc(${n} * var(--cell))`;

    /* 被围住的方格：淡入所属方的颜色 */
    const nodes = [];
    for (let br = 0; br < BOXES; br++) {
        for (let bc = 0; bc < BOXES; bc++) {
            const owner = board.boxes[br][bc];
            if (owner === EMPTY) continue;
            const side = owner === P1 ? 'p1' : 'p2';
            nodes.push(
                <span
                    key={`box-${br}-${bc}`}
                    className={`db-box db-box--${side}`}
                    style={{
                        left: `calc(${bc} * var(--cell) + var(--boxpad))`,
                        top: `calc(${br} * var(--cell) + var(--boxpad))`,
                        width: 'calc(var(--cell) - var(--boxpad) * 2)',
                        height: 'calc(var(--cell) - var(--boxpad) * 2)'
                    }}
                >
                    <span className="db-box__mark" />
                </span>
            );
        }
    }

    /* 可点击的线：横线在前、竖线在后 */
    const renderLine = (t, r, c) => {
        const owner = t === H ? board.h[r][c] : board.v[r][c];
        const drawn = owner !== EMPTY;
        const isLast =
            lastMove && lastMove.edge.t === t && lastMove.edge.r === r && lastMove.edge.c === c;
        const isHint = !drawn && hint && hint.t === t && hint.r === r && hint.c === c;

        const classes = ['db-line', `db-line--${t}`];
        if (drawn) classes.push('is-drawn', owner === P1 ? 'db-line--p1' : 'db-line--p2');
        if (isLast) classes.push('is-last');
        if (isHint) classes.push('is-hint');

        return (
            <button
                key={`${t}-${r}-${c}`}
                type="button"
                className={classes.join(' ')}
                data-t={t}
                style={{ left: pos(c), top: pos(r) }}
                onClick={() => onEdgeClick({ t, r, c })}
                disabled={drawn || !interactive}
                aria-label={`${edgeLabel({ t, r, c })} 画线`}
            >
                <span className="db-line__bar" />
                {isLast && <span className="db-last" aria-hidden="true" />}
            </button>
        );
    };

    for (let r = 0; r < DOTS; r++) {
        for (let c = 0; c < BOXES; c++) nodes.push(renderLine(H, r, c));
    }
    for (let r = 0; r < BOXES; r++) {
        for (let c = 0; c < DOTS; c++) nodes.push(renderLine(V, r, c));
    }

    /* 点阵压在线上方，作为线的端点 */
    for (let r = 0; r < DOTS; r++) {
        for (let c = 0; c < DOTS; c++) {
            nodes.push(
                <span key={`dot-${r}-${c}`} className="db-dot" style={{ left: pos(c), top: pos(r) }} />
            );
        }
    }

    /* 坐标：上方为列字母，左侧为行号，与棋谱中的 A1-B1 一一对应 */
    const labels = LETTERS.slice(0, DOTS).map((letter, c) => (
        <span
            key={`col-${letter}`}
            className="db-coord db-coord--top"
            style={{ left: `calc(var(--coord) + ${c} * var(--cell))` }}
        >
            {letter}
        </span>
    ));
    for (let r = 0; r < DOTS; r++) {
        labels.push(
            <span
                key={`row-${r}`}
                className="db-coord db-coord--left"
                style={{ top: `calc(var(--coord) + ${r} * var(--cell))` }}
            >
                {r + 1}
            </span>
        );
    }

    return (
        <div
            className={`db-wrap ${interactive ? 'is-live' : ''}`}
            data-cur={currentPlayer === P1 ? 'p1' : 'p2'}
        >
            <div className="db-board">{nodes}</div>
            {labels}
        </div>
    );
}

export default Board;