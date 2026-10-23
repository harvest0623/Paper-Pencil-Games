import { useRef } from 'react';
import { DIR_GLYPHS } from '../utils/gameLogic';
import './Board.css';

/**
 * 推箱子棋盘
 * 静态层：墙体 / 地板 / 目标点
 * 动态层：箱子与玩家（绝对定位 + transform 位移，CSS 过渡形成滑动动画）
 */
function Board({ parsed, state, hint, interactive = true, onMove }) {
    const startRef = useRef(null);
    const { rows, cols, walls, goals } = parsed;
    const { player, boxes } = state;

    const cells = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            if (walls[index]) {
                cells.push(
                    <span
                        key={`wall-${index}`}
                        className="sk-cell is-wall"
                        style={{ '--r': row, '--c': col }}
                    />
                );
                continue;
            }
            cells.push(
                <span
                    key={`floor-${index}`}
                    className={`sk-cell is-floor${goals[index] ? ' is-goal' : ''}`}
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
            className="sk-board"
            style={{ '--cols': cols, '--rows': rows }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
                startRef.current = null;
            }}
        >
            <div className="sk-cells">{cells}</div>

            {boxes.map((box) => {
                const done = goals[box.row * cols + box.col];
                return (
                    <span
                        key={box.id}
                        className={`sk-box${done ? ' is-done' : ''}`}
                        style={{ '--r': box.row, '--c': box.col }}
                        aria-hidden="true"
                    >
                        <span className="sk-box__face" />
                    </span>
                );
            })}

            <span
                className="sk-player"
                data-dir={hint?.dir ?? 'down'}
                style={{ '--r': player.row, '--c': player.col }}
                aria-hidden="true"
            >
                <span className="sk-player__token" />
            </span>

            {hint && (
                <span
                    className="sk-hint"
                    style={{ '--r': hint.target.row, '--c': hint.target.col }}
                    aria-hidden="true"
                >
                    <span className="sk-hint__glyph">{DIR_GLYPHS[hint.dir]}</span>
                </span>
            )}
        </div>
    );
}

export default Board;
