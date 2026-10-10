import React from 'react';
import {
    PLAYER_1,
    PLAYER_2,
    P1_STORE,
    P2_STORE,
    ownerOfPit,
    pitLabel
} from '../utils/gameLogic';
import './Board.css';

/* 每个坑/宝库最多渲染的小圆点数量（超出以数字为准） */
const MAX_DOTS = 12;

const renderDots = (count) => {
    const visible = Math.min(count, MAX_DOTS);
    const dots = [];
    for (let i = 0; i < visible; i++) {
        dots.push(<span key={i} className="mc-dot" />);
    }
    return dots;
};

/* 上方一行（玩家2）从左到右的坑位下标：12 … 7 */
const P2_ROW = [12, 11, 10, 9, 8, 7];
/* 下方一行（玩家1）从左到右的坑位下标：0 … 5 */
const P1_ROW = [0, 1, 2, 3, 4, 5];

function Board({
    board,
    currentPlayer,
    lastIndex,
    hint,
    onPitClick,
    interactive = true
}) {
    const renderPit = (index) => {
        const stones = board[index];
        const owner = ownerOfPit(index);
        const clickable = interactive && owner === currentPlayer && stones > 0;
        const classes = [
            'mc-pit',
            owner === PLAYER_1 ? 'is-p1' : 'is-p2',
            stones === 0 ? 'is-empty' : '',
            clickable ? 'is-clickable' : '',
            lastIndex === index ? 'is-last' : '',
            hint === index ? 'is-hint' : ''
        ];

        return (
            <button
                type="button"
                key={index}
                className={classes.join(' ')}
                onClick={() => clickable && onPitClick(index)}
                disabled={!clickable}
                aria-label={`坑 ${pitLabel(index)}，${stones} 粒石子`}
            >
                <span className="mc-pit__coord">{pitLabel(index)}</span>
                <span className="mc-pit__stones">{renderDots(stones)}</span>
                <span className="mc-pit__count">{stones}</span>
                {hint === index && <span className="mc-pit__hint" aria-hidden="true" />}
            </button>
        );
    };

    const renderStore = (player) => {
        const isP1 = player === PLAYER_1;
        const count = board[isP1 ? P1_STORE : P2_STORE];
        return (
            <div className={`mc-store ${isP1 ? 'mc-store--p1' : 'mc-store--p2'}`}>
                <span className="mc-store__label">{isP1 ? '宝库 1' : '宝库 2'}</span>
                <span className="mc-store__stones">{renderDots(count)}</span>
                <span className="mc-store__count">{count}</span>
            </div>
        );
    };

    return (
        <div className="mc-board-wrap">
            <div className="mc-board">
                {renderStore(PLAYER_2)}
                <div className="mc-pits">
                    <div className="mc-row mc-row--top">{P2_ROW.map(renderPit)}</div>
                    <div className="mc-row mc-row--bottom">{P1_ROW.map(renderPit)}</div>
                </div>
                {renderStore(PLAYER_1)}
            </div>
        </div>
    );
}

export default Board;