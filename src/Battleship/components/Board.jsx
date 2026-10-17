import { SIZE, COLS, cellKey, shipAt, isSunk } from '../utils/gameLogic';
import './Board.css';

/* 一格的渲染：舰船 / 命中 / 未命中 / 击沉 / 最后一炮 / 推荐格 / 布阵预览 */
const renderCell = (side, r, c, options) => {
    const { revealShips, interactive, onFire, onHover, lastShot, hintCell, previewSet, preview } =
        options;
    const shot = side.shots[cellKey(r, c)];
    const ship = shipAt(side, r, c);
    const classes = ['bs-cell'];

    if (revealShips && ship) classes.push('is-ship');
    if (shot) classes.push(shot.hit ? 'is-hit' : 'is-miss');
    if (ship && isSunk(ship)) classes.push('is-sunk');
    if (lastShot && lastShot.r === r && lastShot.c === c) classes.push('is-last');
    if (hintCell && hintCell.r === r && hintCell.c === c) classes.push('is-hint');
    if (previewSet.has(cellKey(r, c))) {
        classes.push(preview && preview.valid ? 'is-preview' : 'is-preview-bad');
    }

    return (
        <button
            key={`cell-${r}-${c}`}
            type="button"
            className={classes.join(' ')}
            onClick={onFire ? () => onFire(r, c) : undefined}
            onMouseEnter={onHover ? () => onHover(r, c) : undefined}
            onFocus={onHover ? () => onHover(r, c) : undefined}
            disabled={!interactive || Boolean(shot)}
            aria-label={`${COLS[c]}${r + 1}${shot ? (shot.hit ? ' 已命中' : ' 未命中') : ''}`}
        >
            <span className="bs-cell__inner" />
        </button>
    );
};

/* ============================================================
   一片海域：10 x 10 网格 + 行列坐标 + 落弹标记
   revealShips 为 true 时显示己方舰船；false 时只显示已落弹的格子
   ============================================================ */
function Board({
    title,
    badge,
    subtitle,
    tone = 'blue',
    side,
    revealShips = false,
    interactive = false,
    onFire,
    onHover,
    onLeave,
    lastShot,
    hintCell,
    preview
}) {
    const previewSet = new Set((preview ? preview.cells : []).map(({ r, c }) => cellKey(r, c)));
    const options = {
        revealShips,
        interactive,
        onFire,
        onHover,
        lastShot,
        hintCell,
        previewSet,
        preview
    };

    const corners = [
        <span key="corner" className="bs-coord bs-coord--corner" />,
        ...Array.from({ length: SIZE }, (_, c) => (
            <span key={`col-${c}`} className="bs-coord bs-coord--col">
                {COLS[c]}
            </span>
        ))
    ];

    const rows = Array.from({ length: SIZE }, (_, r) => [
        <span key={`row-${r}`} className="bs-coord bs-coord--row">
            {r + 1}
        </span>,
        ...Array.from({ length: SIZE }, (_, c) => renderCell(side, r, c, options))
    ]).flat();

    return (
        <div className={`bs-board bs-board--${tone}`} onMouseLeave={onLeave}>
            <div className="bs-board__head">
                <h3 className="bs-board__title">{title}</h3>
                {badge && <span className="bs-board__badge">{badge}</span>}
            </div>
            <div className={`bs-grid ${interactive ? 'is-live' : ''}`}>
                {corners}
                {rows}
            </div>
            {subtitle && <p className="bs-board__sub">{subtitle}</p>}
        </div>
    );
}

export default Board;