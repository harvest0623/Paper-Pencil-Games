import { LINE, CROSS, NO_CLUE, cellLineCount, edgeLabel } from '../utils/gameLogic';
import './Board.css';

/* 数回棋盘：点阵 + 边层 + 数字格层三层叠放 */
function Board({
    n,
    digits,
    edges,
    violations,
    lastMove,
    hint,
    interactive = true,
    closed = false,
    onEdgeClick
}) {
    const size = n + 1;
    const nodes = [];

    /* ---- 数字格层：显示提示值与当前连线进度 ---- */
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const digit = digits[r * n + c];
            if (digit === NO_CLUE) continue;
            const line = cellLineCount(n, edges, r, c);
            const done = line === digit;
            const bad = violations.has(`c${r},${c}`);

            nodes.push(
                <span
                    key={`cell-${r}-${c}`}
                    className={`sl-cell${done ? ' is-done' : ''}${bad ? ' is-bad' : ''}`}
                    style={{
                        left: `calc(${c + 0.5} * var(--cell))`,
                        top: `calc(${r + 0.5} * var(--cell))`
                    }}
                >
                    {digit}
                </span>
            );
        }
    }

    /* ---- 边层：横向边与纵向边都是可点击按钮 ---- */
    const renderEdge = (t, r, c) => {
        const state = t === 'h' ? edges.h[r][c] : edges.v[r][c];
        const isLast = lastMove && lastMove.t === t && lastMove.r === r && lastMove.c === c;
        const isHint = hint && hint.t === t && hint.r === r && hint.c === c;
        const label = edgeLabel({ t, r, c });

        const classes = ['sl-edge', `sl-edge--${t}`];
        if (state === LINE) classes.push('is-line');
        if (state === CROSS) classes.push('is-cross');
        if (isLast) classes.push('is-last');
        if (isHint) classes.push('is-hint');

        return (
            <button
                key={`${t}-${r}-${c}`}
                type="button"
                className={classes.join(' ')}
                data-t={t}
                data-state={state}
                style={{
                    '--x': t === 'h' ? c + 0.5 : c,
                    '--y': t === 'h' ? r : r + 0.5
                }}
                onClick={() => onEdgeClick({ t, r, c })}
                disabled={!interactive}
                aria-label={`${label} ${
                    state === LINE ? '已有连线' : state === CROSS ? '已打叉' : '可操作'
                }`}
            >
                <span className="sl-edge__bar" />
                <span className="sl-edge__cross" aria-hidden="true" />
                {isLast && <span className="sl-edge__flash" aria-hidden="true" />}
            </button>
        );
    };

    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) nodes.push(renderEdge('h', r, c));
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) nodes.push(renderEdge('v', r, c));
    }

    /* ---- 点阵层：线段的端点，连上两条线时点亮 ---- */
    const degree = Array.from({ length: size * size }, () => 0);
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) {
            if (edges.h[r][c] !== LINE) continue;
            degree[r * size + c] += 1;
            degree[r * size + c + 1] += 1;
        }
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) {
            if (edges.v[r][c] !== LINE) continue;
            degree[r * size + c] += 1;
            degree[(r + 1) * size + c] += 1;
        }
    }

    for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
            const deg = degree[r * size + c];
            const bad = violations.has(`v${r},${c}`);
            nodes.push(
                <span
                    key={`dot-${r}-${c}`}
                    className={`sl-dot${deg === 2 ? ' is-joined' : ''}${bad ? ' is-bad' : ''}`}
                    style={{
                        left: `calc(${c} * var(--cell))`,
                        top: `calc(${r} * var(--cell))`
                    }}
                />
            );
        }
    }

    /* ---- 坐标：上方列字母、左侧行号 ---- */
    const coords = [];
    for (let c = 0; c < size; c++) {
        coords.push(
            <span
                key={`col-${c}`}
                className="sl-coord sl-coord--top"
                style={{ left: `calc(${c + 0.5} * var(--cell))` }}
            >
                {String.fromCharCode(65 + c)}
            </span>
        );
    }
    for (let r = 0; r < size; r++) {
        coords.push(
            <span
                key={`row-${r}`}
                className="sl-coord sl-coord--left"
                style={{ top: `calc(${r + 0.5} * var(--cell))` }}
            >
                {r + 1}
            </span>
        );
    }

    return (
        <div
            className={`sl-board${closed ? ' is-closed' : ''}${interactive ? ' is-live' : ''}`}
            style={{ '--n': n }}
        >
            <div className="sl-canvas">
                {nodes}
                {coords}
            </div>
        </div>
    );
}

export default Board;
