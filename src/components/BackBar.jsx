import { Link } from 'react-router-dom';

/**
 * 游戏页左上角返回条：独立于顶部导航栏，属于页面自身的一部分
 */
function BackBar({ title }) {
    return (
        <div className="gp-topbar">
            <div className="ui-container gp-topbar__inner">
                <Link to="/home" className="ui-back" aria-label="返回首页">
                    <span className="ui-back__arrow" aria-hidden="true" />
                    <span className="ui-back__text">返回首页</span>
                </Link>
                {title && (
                    <nav className="gp-topbar__crumb" aria-label="当前位置">
                        <Link to="/home">首页</Link>
                        <span aria-hidden="true">/</span>
                        <span className="gp-topbar__current">{title}</span>
                    </nav>
                )}
            </div>
        </div>
    );
}

export default BackBar;