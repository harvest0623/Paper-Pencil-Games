import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 路由切换时回到页面顶部，避免沿用上一页的滚动位置
 */
function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

export default ScrollToTop;