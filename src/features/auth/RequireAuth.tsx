import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth/authSlice';

/**
 * Guard for /checkout, /orders/:id and /account. The intended destination rides
 * along in `?next=` so signing in drops the shopper exactly where they were.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const signedIn = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!signedIn) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
