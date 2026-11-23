import type { RemoteState } from '@/types/domain';
import { normalizeError } from '@/api/errors';

interface QueryLike<T> {
  data?: T;
  error?: unknown;
  isLoading: boolean;
  isError: boolean;
  isUninitialized?: boolean;
}

/**
 * Adapter from RTK Query's flag bag to our discriminated union.
 * Components switch on `state.status`, so the impossible combinations simply do not exist.
 *
 * Order matters. RTK Query's `data` is the last successful result for the hook, and it
 * survives a change of arguments. Reading `data` first therefore rendered the previous
 * list (or the previous product) as if it were the answer whenever a new request failed:
 * a 500 on a filtered shelf looked like a successful unfiltered one, with no retry
 * offered. Error and loading are checked first, so the stale payload can never pose as
 * the current one.
 */
export function toRemoteState<T>(query: QueryLike<T>): RemoteState<T> {
  if (query.isError) {
    return { status: 'error', error: normalizeError(query.error) };
  }
  if (query.isLoading) return { status: 'loading' };
  if (query.data !== undefined) return { status: 'success', data: query.data };
  return { status: 'idle' };
}
