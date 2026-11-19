import { PEG_LABELS, TARGET_PEG, topDisk } from '../utils/gameLogic';
import './Board.css';

/* 汉诺塔棋盘：三根柱子，圆盘自下而上堆叠 */
function Board({
    pegs,
    disks,
    selected,
    hint,
    lastMove,
    done = false,
    interactive = true,
    onPegClick
}) {
    return (
        <div className="hanoi-board-wrap">
            <div className={`hanoi-board ${done ? 'is-done' : ''}`}>
                <span className="hanoi-board__glow" aria-hidden="true" />
                {pegs.map((stack, index) => {
                    const isSelected = selected === index;
                    const hintFrom = hint?.from === index;
                    const hintTo = hint?.to === index;
                    const top = topDisk(pegs, index);

                    const classes = ['hanoi-peg'];
                    if (isSelected) classes.push('is-selected');
                    if (hintFrom) classes.push('is-hint-from');
                    if (hintTo) classes.push('is-hint-to');
                    if (lastMove?.to === index) classes.push('is-recent');

                    return (
                        <button
                            key={PEG_LABELS[index]}
                            type="button"
                            className={classes.join(' ')}
                            onClick={() => interactive && onPegClick(index)}
                            disabled={!interactive}
                            aria-label={`${PEG_LABELS[index]} 柱${
                                top ? `，塔顶是 ${top} 号圆盘` : '，空柱'
                            }，点击选中或放下圆盘`}
                        >
                            <span className="hanoi-peg__rod" aria-hidden="true" />
                            <span className="hanoi-peg__base" aria-hidden="true" />

                            <span className="hanoi-peg__head">
                                <span className="hanoi-peg__name">
                                    {PEG_LABELS[index]}
                                </span>
                                {index === TARGET_PEG && (
                                    <span className="hanoi-peg__goal">目标</span>
                                )}
                                {hintFrom && (
                                    <span className="hanoi-peg__hint-tag">
                                        从这里
                                    </span>
                                )}
                                {hintTo && (
                                    <span className="hanoi-peg__hint-tag is-target">
                                        放这里
                                    </span>
                                )}
                            </span>

                            <span className="hanoi-peg__stack">
                                {stack.map((size) => {
                                    const lifted = isSelected && size === top;
                                    const fresh =
                                        lastMove?.to === index &&
                                        lastMove?.disk === size;
                                    return (
                                        <span
                                            key={size}
                                            className={`hanoi-disk ${
                                                lifted ? 'is-lifted' : ''
                                            } ${fresh ? 'is-last' : ''}`}
                                            style={{
                                                width: `${28 + (size / disks) * 58}%`
                                            }}
                                            data-size={size}
                                        >
                                            <span className="hanoi-disk__num">
                                                {size}
                                            </span>
                                        </span>
                                    );
                                })}
                            </span>

                            {(hintFrom || hintTo) && (
                                <span className="hanoi-peg__ring" aria-hidden="true" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default Board;
