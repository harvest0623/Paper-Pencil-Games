import { coordLabel } from '../utils/gameLogic';
import './Board.css';

/* 数桥棋盘：网格底纹 + 桥接层 + 岛屿层 */
function Board({
    rows,
    cols,
    islands,
    links,
    counts,
    sums,
    selected,
    hint,
    targets,
    overfilled,
    crossingLinks,
    lastLink,
    interactive = true,
    onIslandClick,
    onBridgeClick
}) {
    const centerX = (col) => ((col + 0.5) / cols) * 100;
    const centerY = (row) => ((row + 0.5) / rows) * 100;

    const bridges = [];
    links.forEach((link) => {
        const count = counts[link.id] ?? 0;
        if (count <= 0) return;

        const a = islands[link.a];
        const b = islands[link.b];
        const isHint = hint?.type === 'link' && hint.id === link.id;
        const classes = [
            'hk-bridge',
            `is-${link.dir}`,
            `is-count-${count}`
        ];
        if (isHint) classes.push('is-hint');
        if (crossingLinks.has(link.id)) classes.push('is-crossing');
        if (lastLink === link.id) classes.push('is-last');

        let style;
        if (link.dir === 'h') {
            style = {
                left: `${(centerX(a.col) + centerX(b.col)) / 2}%`,
                top: `${centerY(a.row)}%`,
                width: `${Math.abs(b.col - a.col) / cols * 100}%`
            };
        } else {
            style = {
                left: `${centerX(a.col)}%`,
                top: `${(centerY(a.row) + centerY(b.row)) / 2}%`,
                height: `${Math.abs(b.row - a.row) / rows * 100}%`
            };
        }

        bridges.push(
            <button
                key={`bridge-${link.id}`}
                type="button"
                className={classes.join(' ')}
                style={style}
                onClick={() => interactive && onBridgeClick(link.id)}
                disabled={!interactive}
                aria-label={`${link.label} 现有 ${count} 座桥，点击减少一座`}
            >
                <span className="hk-bridge__bar" />
                <span className="hk-bridge__bar" />
                {isHint && <span className="hk-bridge__hint" aria-hidden="true" />}
            </button>
        );
    });

    const nodes = islands.map((island) => {
        const sum = sums[island.id] ?? 0;

        const classes = ['hk-island'];
        if (sum === island.clue) classes.push('is-complete');
        if (overfilled.has(island.id)) classes.push('is-over');
        if (selected === island.id) classes.push('is-selected');
        if (targets.has(island.id)) classes.push('is-target');
        if (hint?.type === 'island' && hint.id === island.id) classes.push('is-hint');

        return (
            <button
                key={`island-${island.id}`}
                type="button"
                className={classes.join(' ')}
                style={{
                    left: `${centerX(island.col)}%`,
                    top: `${centerY(island.row)}%`
                }}
                onClick={() => interactive && onIslandClick(island.id)}
                disabled={!interactive}
                aria-label={`${coordLabel(island.row, island.col)} 需要 ${
                    island.clue
                } 座桥，当前 ${sum} 座`}
                title={`${coordLabel(island.row, island.col)} · ${sum} / ${island.clue}`}
            >
                <span className="hk-island__num">{island.clue}</span>
                {hint?.type === 'island' && (
                    <span className="hk-island__ring" aria-hidden="true" />
                )}
            </button>
        );
    });

    return (
        <div className="hk-board-wrap">
            <div
                className="hk-board"
                style={{
                    '--cols': cols,
                    '--rows': rows,
                    aspectRatio: `${cols} / ${rows}`
                }}
            >
                <span className="hk-board__grid" aria-hidden="true" />
                <span className="hk-board__glow" aria-hidden="true" />
                {bridges}
                {nodes}
            </div>
        </div>
    );
}

export default Board;
