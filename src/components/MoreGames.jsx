import { Link } from 'react-router-dom';
import { getOtherGames } from '../data/games';

/**
 * 游戏页底部的「更多游戏」推荐区
 */
function MoreGames({
    currentId,
    title = '继续挑战',
    sub = '换一款经典纸笔游戏，让大脑换个方式运转。'
}) {
    const items = getOtherGames(currentId, 3);

    return (
        <section className="ui-section gp-more">
            <div className="ui-container">
                <div className="gp-more__head">
                    <div>
                        <div className="ui-eyebrow">更多游戏</div>
                        <h2 className="ui-section-title">{title}</h2>
                        <p className="ui-section-sub">{sub}</p>
                    </div>
                    <Link className="ui-btn ui-btn--ghost ui-btn--sm" to="/home">
                        查看全部
                    </Link>
                </div>

                <div className="gp-more__grid">
                    {items.map((game) => {
                        const inner = (
                            <>
                                <span
                                    className="gp-more-card__mark"
                                    style={{ '--accent': game.color }}
                                    aria-hidden="true"
                                >
                                    {game.mark}
                                </span>
                                <div className="gp-more-card__body">
                                    <h3 className="gp-more-card__name">
                                        {game.name}
                                        <span className="gp-more-card__en">{game.en}</span>
                                    </h3>
                                    <p className="gp-more-card__desc">{game.description}</p>
                                </div>
                                <span className="gp-more-card__tag">
                                    {game.playable ? '立即开玩 →' : '敬请期待'}
                                </span>
                            </>
                        );

                        return game.playable ? (
                            <Link key={game.id} to={game.path} className="gp-more-card">
                                {inner}
                            </Link>
                        ) : (
                            <div key={game.id} className="gp-more-card is-soon">
                                {inner}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default MoreGames;