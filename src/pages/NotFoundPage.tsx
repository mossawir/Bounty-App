import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="container">
      <div className="notfound">
        <p className="notfound-code" aria-hidden="true">
          404
        </p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          This shelf does not exist
        </h1>
        <p className="muted" style={{ maxWidth: '44ch' }}>
          The page you asked for is not in the bazaar. It may have been moved, renamed, or sold out
          for good.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Link className="btn btn-primary" to="/">
            Back to the shop
          </Link>
          <Link className="btn" to="/cart">
            Your cart
          </Link>
        </div>
      </div>
    </div>
  );
}
