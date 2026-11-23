import { Link, NavLink } from 'react-router-dom';
import { CartIcon, DuckMark, UserIcon } from '@/components/icons';
import { useAppSelector } from '@/app/hooks';
import { selectCartCount } from '@/features/cart/cartSlice';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import { SocketStatusChip } from '@/components/SocketStatusChip';

export function Header() {
  const cartCount = useAppSelector(selectCartCount);
  const signedIn = useAppSelector(selectIsAuthenticated);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" to="/" aria-label="The Bug Bazaar — home">
          <span className="brand-mark">
            <DuckMark size={30} />
          </span>
          <span className="brand-text">
            <span>Est. week one</span>
            <span>The Bug Bazaar</span>
          </span>
        </Link>

        <div className="spacer" />

        <SocketStatusChip />

        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" end className="nav-link nav-shop">
            <span className="nav-label">Shop</span>
          </NavLink>
          <span className="nav-divider" aria-hidden="true" />
          <NavLink
            to={signedIn ? '/account' : '/login'}
            className="nav-link"
            aria-label={signedIn ? 'Your account' : 'Sign in'}
          >
            <UserIcon size={17} />
            <span className="nav-label">{signedIn ? 'Account' : 'Sign in'}</span>
          </NavLink>
          <NavLink
            to="/cart"
            className="nav-link cart-link"
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
          >
            <CartIcon size={17} />
            <span className="nav-label">Cart</span>
            {cartCount > 0 ? (
              <span className="cart-badge" aria-hidden="true">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
