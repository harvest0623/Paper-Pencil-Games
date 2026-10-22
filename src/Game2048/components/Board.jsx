import { useRef } from 'react';
import './Board.css';

const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };

/**
 * 2048 棋盘
 * 两层结构：底槽层（静态）+ 方块层（绝对定位，按 row/col 位移）
 * 触摸滑动直接绑定在棋盘上，避免误触发页面滚动
 */
function Board({ tiles, size, hintDir, interactive = true, onMove }) {
    const startRef = useRef(null);

    const slots = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            slots.push(
                <span
                    key={`slot-${row}-${col}`}
                    className="g2048-slot"
                    style={{ '--r': row, '--c': col }}
                />
            );
        }
    }

    const handleTouchStart = (event) => {
        if (!interactive) return;
        const touch = event.touches[0];
        startRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (event) => {
        if (!interactive || !startRef.current) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startRef.current.x;
        const dy = touch.clientY - startRef.current.y;
        startRef.current = null;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) >= Math.abs(dy)) onMove(dx > 0 ? 'right' : 'left');
        else onMove(dy > 0 ? 'down' : 'up');
    };

    return (
        <div
            className="g2048-board"
            style={{ '--n': size }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
                startRef.current = null;
            }}
        >
            <div className="g2048-slots">{slots}</div>

            <div className="g2048-tiles">
                {tiles.map((tile) => {
                    const tone = tile.value > 4096 ? 'super' : tile.value;
                    const classes = ['g2048-tile', `t-${tone}`];
                    if (tile.isNew) classes.push('is-new');
                    if (tile.isMerged) classes.push('is-merged');

                    return (
                        <div
                            key={tile.id}
                            className={classes.join(' ')}
                            data-len={String(tile.value).length}
                            style={{ '--r': tile.row, '--c': tile.col }}
                        >
                            <span className="g2048-tile__face">{tile.value}</span>
                        </div>
                    );
                })}
            </div>

            {hintDir && (
                <span className={`g2048-dirhint is-${hintDir}`} aria-hidden="true">
                    {ARROWS[hintDir]}
                </span>
            )}
        </div>
    );
}

export default Board;
