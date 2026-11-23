import type { ReactNode } from 'react';
import { AlertIcon } from '@/components/icons';
import { messageFor } from '@/api/errors';
import type { AppError } from '@/types/domain';

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton skeleton-media" />
          <div className="skeleton-body">
            <div className="skeleton skeleton-line" style={{ width: '38%' }} />
            <div className="skeleton skeleton-line" style={{ width: '88%' }} />
            <div className="skeleton skeleton-line" style={{ width: '64%' }} />
            <div className="skeleton skeleton-line" style={{ width: '45%', height: 18 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden="true">
        {icon ?? <span style={{ fontSize: 22 }}>∅</span>}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <div className="row" style={{ justifyContent: 'center' }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
  title?: string;
  /** Shown instead of the generic copy when the screen has better context. */
  description?: string;
}

export function ErrorState({ error, onRetry, title, description }: ErrorStateProps) {
  return (
    <div className="state" role="alert">
      <div className="state-icon" data-tone="error" aria-hidden="true">
        <AlertIcon size={24} />
      </div>
      <h2>{title ?? 'That did not load'}</h2>
      <p>{description ?? messageFor(error)}</p>
      {onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="row" style={{ gap: 8 }} role="status">
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          border: '2px solid currentColor',
          borderRightColor: 'transparent',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <span>{label}</span>
    </span>
  );
}
