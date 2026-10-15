function GameOverModal({ open, result, names, onRestart, onClose, variant = 'stone' }) {
    if (!open || !result) return null;

    const { tone, title, sub, scores, winnerSide } = result;

    const isMark = variant === 'mark';
    const isDisc = variant === 'disc';

    /* 胜方颜色标注：棋子类显示「黑棋/白棋」，井字棋显示「X/O」，四子棋显示「红棋/黄棋」 */
    const sideLabel = winnerSide
        ? isMark
            ? `${winnerSide === 'x' ? 'X' : 'O'} 获胜`
            : isDisc
              ? `${winnerSide === 'red' ? '红棋' : '黄棋'}获胜`
              : `${winnerSide === 'black' ? '黑棋' : '白棋'}获胜`
        : null;

    /* 左右两侧的筹码标识 */
    const leftSide = isMark ? 'x' : isDisc ? 'red' : 'black';
    const rightSide = isMark ? 'o' : isDisc ? 'yellow' : 'white';

    const chip = (side) =>
        isMark ? (
            <span className={`gp-chip gp-chip--mark gp-chip--${side}`}>
                {side === 'x' ? 'X' : 'O'}
            </span>
        ) : (
            <span className={`gp-chip gp-chip--${side}`} />
        );

    return (
        <div className="gp-modal" role="dialog" aria-modal="true">
            <div className="gp-modal__backdrop" onClick={onClose} />
            <div className={`gp-modal__card is-${tone}`}>
                <div className="gp-modal__badge" aria-hidden="true">
                    <span className="gp-modal__badge-ring" />
                </div>
                <h3 className="gp-modal__title">{title}</h3>
                <p className="gp-modal__sub">{sub}</p>

                {sideLabel && (
                    <span className={`gp-modal__side gp-modal__side--${winnerSide}`}>
                        {sideLabel}
                    </span>
                )}

                <div className="gp-modal__score">
                    <div className="gp-modal__score-item">
                        {chip(leftSide)}
                        <span className="gp-modal__name">{names.black}</span>
                        <strong>{scores.black}</strong>
                    </div>
                    <span className="gp-modal__vs">:</span>
                    <div className="gp-modal__score-item">
                        {chip(rightSide)}
                        <span className="gp-modal__name">{names.white}</span>
                        <strong>{scores.white}</strong>
                    </div>
                </div>

                <div className="gp-modal__actions">
                    <button className="ui-btn ui-btn--primary" onClick={onRestart}>
                        再来一局
                    </button>
                    <button className="ui-btn ui-btn--ghost" onClick={onClose}>
                        查看棋盘
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GameOverModal;