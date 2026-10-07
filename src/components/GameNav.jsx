import { Link } from 'react-router-dom';

/**
 * 游戏页通用顶部导航：站点标识 + 页内锚点
 */
function GameNav() {
    return (
        <nav className="ui-nav">
            <div className="ui-container ui-nav__inner">
                <div className="ui-nav__left">
                    <Link to="/home" className="ui-logo">
                        <span className="ui-logo__mark">弈</span>
                        指尖弈局
                    </Link>
                </div>

                <div className="ui-nav__links ui-nav__links--game">
                    <a className="ui-nav__link" href="#rules">
                        玩法规则
                    </a>
                    <a className="ui-nav__link" href="#tips">
                        策略技巧
                    </a>
                    <a className="ui-nav__link" href="#faq">
                        常见问题
                    </a>
                    <Link className="ui-btn ui-btn--ghost ui-btn--sm" to="/home">
                        全部游戏
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default GameNav;