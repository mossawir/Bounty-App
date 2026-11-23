import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedOut, selectUser } from '@/features/auth/authSlice';
import { selectCartCount } from '@/features/cart/cartSlice';
import { useToast } from '@/components/toastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCount } from '@/lib/format';
import { bazaarApi } from '@/app/api';

export function AccountPage() {
  useDocumentTitle('Your account');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAppSelector(selectUser);
  const cartCount = useAppSelector(selectCartCount);

  if (!user) return null;

  const handleSignOut = (): void => {
    dispatch(signedOut());
    // Drop cached server data so the next person does not see this session.
    dispatch(bazaarApi.util.resetApiState());
    toast.push('Signed out');
    navigate('/', { replace: true });
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Members of the bazaar</p>
          <h1 className="page-title">Your account</h1>
          <p className="page-sub">Session, saved cart, and the way out.</p>
        </div>
        <button type="button" className="btn btn-ink" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      <div className="account-grid">
        <section className="account-card" aria-labelledby="account-details">
          <h2 id="account-details">Who is signed in</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Account id</dt>
            <dd className="mono">{user.id}</dd>
            <dt>Session</dt>
            <dd>
              Active — the token is stored in this browser only. Read <code>docs/auth.md</code> for
              the trade-off.
            </dd>
          </dl>

          <hr className="rule" />

          <p className="muted" style={{ fontSize: 13.5 }}>
            Orders are tied to this account. The mock API keeps them in memory, so a full page
            reload of the server (or a fresh test run) clears order history — your cart and session
            survive, because they live in this browser.
          </p>
        </section>

        <section className="account-card" aria-labelledby="account-shortcuts">
          <h2 id="account-shortcuts">Shortcuts</h2>
          <div className="stack">
            <Link className="btn btn-block" to="/cart">
              Cart · {formatCount(cartCount)} {cartCount === 1 ? 'item' : 'items'}
            </Link>
            <Link className="btn btn-block" to="/">
              Browse the shelves
            </Link>
            <Link className="btn btn-block" to="/checkout">
              Checkout
            </Link>
          </div>
          <p className="summary-note">
            Tip: the header cart badge is a derived value from Redux, not a stored number, so it can
            never drift out of sync with the cart.
          </p>
        </section>
      </div>
    </div>
  );
}
