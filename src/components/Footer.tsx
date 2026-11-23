import { Link } from 'react-router-dom';
import { CATEGORIES } from '@/types/domain';
import { CATEGORY_META } from '@/lib/format';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h2>The shop</h2>
            <p style={{ maxWidth: '34ch', fontSize: 14, color: 'var(--ink-soft)' }}>
              Developer gear, honestly priced. Rubber ducks for the silent debugging, keyboards for
              the loud kind, coffee for both.
            </p>
            <p className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
              5,000 products seeded · mock API · no real charges
            </p>
          </div>

          <div>
            <h2>Browse</h2>
            <ul>
              {CATEGORIES.map((category) => (
                <li key={category}>
                  <Link to={`/?category=${category}`}>{CATEGORY_META[category].label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2>Account</h2>
            <ul>
              <li>
                <Link to="/cart">Cart</Link>
              </li>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <Link to="/account">Your account</Link>
              </li>
              <li>
                <Link to="/?inStock=true">In-stock gear</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} The Bug Bazaar — a Week 1 bounty board, remade.</span>
          <span>Prices in USD · Tax and shipping calculated at checkout (they are free)</span>
        </div>
      </div>
    </footer>
  );
}
