import { pageWindow } from '@/features/products/pageWindow';
import { formatCount } from '@/lib/format';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  const tokens = pageWindow(current, pageCount);

  if (total === 0) return null;

  return (
    <nav className="pagination" aria-label="Product pagination">
      <p className="pagination-range">
        Showing{' '}
        <strong>
          {formatCount(start)}–{formatCount(end)}
        </strong>{' '}
        of <strong>{formatCount(total)}</strong> products
      </p>

      <ul className="pagination-pages">
        <li>
          <button
            type="button"
            className="page-btn page-btn-arrow"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => onChange(current - 1)}
          >
            <span aria-hidden="true">←</span>
          </button>
        </li>

        {tokens.map((token, index) =>
          token === 'gap' ? (
            <li key={`gap-${index}`}>
              <span className="page-gap" aria-hidden="true">
                …
              </span>
            </li>
          ) : (
            <li key={token}>
              <button
                type="button"
                className="page-btn"
                aria-label={`Page ${token}`}
                aria-current={token === current ? 'page' : undefined}
                onClick={() => onChange(token)}
              >
                {token}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            className="page-btn page-btn-arrow"
            aria-label="Next page"
            disabled={current >= pageCount}
            onClick={() => onChange(current + 1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </li>
      </ul>

      <p className="pagination-status" aria-live="polite">
        Page {current} of {pageCount}
      </p>
    </nav>
  );
}
