import { COLUMN_LABELS, coordLabel, revealMines } from '../utils/gameLogic';
import './Board.css';

/* 旗帜图标：细旗杆 + 三角旗面 */
const FlagIcon = () => (
    <svg className="ms-ic ms-ic--flag" viewBox="0 0 24 24" aria-hidden="true">
        <path
            className="ms-ic__pole"
            d="M8 21V4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path className="ms-ic__cloth" d="M8 4.6h9.4l-2.9 4.1 2.9 4.1H8z" fill="currentColor" />
        <path className="ms-ic__base" d="M5 21h6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

/* 地雷图标：圆形雷体 + 八向尖刺 + 高光 */
const MineIcon = () => (
    <svg className="ms-ic ms-ic--mine" viewBox="0 0 24 24" aria-hidden="true">
        <g className="ms-ic__spikes" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.6v3" />
            <path d="M12 18.4v3" />
            <path d="M2.6 12h3" />
            <path d="M18.4 12h3" />
            <path d="M5.4 5.4l2.1 2.1" />
            <path d="M16.5 16.5l2.1 2.1" />
            <path d="M18.6 5.4l-2.1 2.1" />
            <path d="M7.5 16.5l-2.1 2.1" />
        </g>
        <circle cx="12" cy="12" r="5.3" fill="currentColor" />
        <circle className="ms-ic__gloss" cx="10.2" cy="10.2" r="1.5" fill="rgba(255,255,255,0.7)" />
    </svg>
);

/**
 * 扫雷棋盘
 * 采用 CSS Grid 布局，坐标列/行与四角留白保证严格对齐。
 */
function Board({
    reveal,
    flag,
    adj,
    mines,
    rows,
    cols,
    hint,
    lastMove,
    boom,
    focus,
    over,
    interactive = true,
    onReveal,
    onFlag
}) {
    const labels = COLUMN_LABELS.slice(0, cols);
    /* 失败后把所有地雷展示出来 */
    const shown = over ? revealMines(reveal, mines) : reveal;

    const isHint = (row, col) => Boolean(hint) && hint.row === row && hint.col === col;
    const isLast = (row, col) => Boolean(lastMove) && lastMove.row === row && lastMove.col === col;
    const isBoom = (row, col) => Boolean(boom) && boom.row === row && boom.col === col;
    const isFocus = (row, col) => Boolean(focus) && focus.row === row && focus.col === col;

    const nodes = [];

    /* 四角留白 */
    [1, cols + 2].forEach((col) => {
        nodes.push(
            <span key={`c-t-${col}`} className="ms-corner" style={{ gridRow: 1, gridColumn: col }} />
        );
        nodes.push(
            <span
                key={`c-b-${col}`}
                className="ms-corner"
                style={{ gridRow: rows + 2, gridColumn: col }}
            />
        );
    });

    /* 顶部 / 底部列坐标 */
    labels.forEach((label, col) => {
        nodes.push(
            <span
                key={`col-t-${label}`}
                className="ms-coord"
                style={{ gridRow: 1, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
        nodes.push(
            <span
                key={`col-b-${label}`}
                className="ms-coord"
                style={{ gridRow: rows + 2, gridColumn: col + 2 }}
            >
                {label}
            </span>
        );
    });

    for (let row = 0; row < rows; row++) {
        nodes.push(
            <span
                key={`row-l-${row}`}
                className="ms-coord"
                style={{ gridRow: row + 2, gridColumn: 1 }}
            >
                {row + 1}
            </span>
        );
        nodes.push(
            <span
                key={`row-r-${row}`}
                className="ms-coord"
                style={{ gridRow: row + 2, gridColumn: cols + 2 }}
            >
                {row + 1}
            </span>
        );

        for (let col = 0; col < cols; col++) {
            const opened = Boolean(shown[row][col]);
            const flagged = Boolean(flag[row][col]);
            const mine = Boolean(mines && mines[row][col]);
            const value = adj ? adj[row][col] : 0;

            const classes = ['ms-cell'];

            if (opened) {
                classes.push('is-open');
                if (mine) classes.push('is-mine');
                else if (value > 0) classes.push(`is-n${value}`);
            } else {
                classes.push('is-hidden');
                if (flagged) classes.push('is-flag');
                /* 失败时标出插错的旗 */
                if (over && flagged && !mine) classes.push('is-wrong-flag');
            }

            if (isBoom(row, col)) classes.push('is-boom');
            if (isLast(row, col) && !isBoom(row, col)) classes.push('is-last');
            if (isHint(row, col)) classes.push('is-hint');
            if (isFocus(row, col)) classes.push('is-focus');

            nodes.push(
                <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    className={classes.join(' ')}
                    style={{ gridRow: row + 2, gridColumn: col + 2 }}
                    onClick={() => interactive && onReveal(row, col)}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        if (interactive) onFlag(row, col);
                    }}
                    aria-label={`${coordLabel(row, col)} ${
                        opened ? (mine ? '地雷' : value || '空') : flagged ? '已插旗' : '未翻开'
                    }`}
                >
                    {!opened && flagged && <FlagIcon />}
                    {opened && mine && <MineIcon />}
                    {opened && !mine && value > 0 && (
                        <span key={`v-${value}`} className="ms-num">
                            {value}
                        </span>
                    )}
                    {isHint(row, col) && <span className="ms-hint-ring" />}
                </button>
            );
        }
    }

    return (
        <div className="ms-board-wrap" style={{ '--rows': rows, '--cols': cols }}>
            <div
                className="ms-board-bg"
                aria-hidden="true"
                style={{ gridRow: `2 / ${rows + 2}`, gridColumn: `2 / ${cols + 2}` }}
            />
            {nodes}
        </div>
    );
}

export default Board;