function GameOverModal({ open, result, names, onRestart, onClose, variant = 'stone' }) {
    if (!open || !result) return null;

    const { tone, title, sub, scores } = result;

    const chip = (side) =>
        variant === 'mark' ? (
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

                <div className="gp-modal__score">
                    <div className="gp-modal__score-item">
                        {chip(variant === 'mark' ? 'x' : 'black')}
                        <span className="gp-modal__name">{names.black}</span>
                        <strong>{scores.black}</strong>
                    </div>
                    <span className="gp-modal__vs">:</span>
                    <div className="gp-modal__score-item">
                        {chip(variant === 'mark' ? 'o' : 'white')}
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