import NavLink from './nav-link';
import AuthNav from './auth-nav';
import CartBadge from './cart-badge';
export default function SiteHeader() { return <header className="site-header"><div className="site-header__inner"><NavLink href="/" className="brand">BeautyShop</NavLink><nav className="nav" aria-label="Điều hướng chính"><NavLink href="/" className="nav__link">Trang chủ</NavLink><NavLink href="/cart" className="nav__link">Giỏ hàng</NavLink></nav><div className="header-actions"><CartBadge/><AuthNav/></div></div></header>; }
