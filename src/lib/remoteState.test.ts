import { describe, expect, it } from 'vitest';
import { toRemoteState } from '@/lib/remoteState';
import type { AppError } from '@/types/domain';

const serverError: AppError = {
  kind: 'server',
  status: 500,
  code: 'PRODUCTS_UNAVAILABLE',
  message: 'The shelves are out of reach.',
};

describe('toRemoteState', () => {
  it('maps a fulfilled query to success', () => {
    expect(toRemoteState({ data: [1, 2], isLoading: false, isError: false })).toEqual({
      status: 'success',
      data: [1, 2],
    });
  });

  it('maps a first load to loading', () => {
    expect(toRemoteState({ isLoading: true, isError: false })).toEqual({ status: 'loading' });
  });

  it('maps a rejection to error', () => {
    expect(
      toRemoteState({ error: serverError, isLoading: false, isError: true, data: undefined }),
    ).toEqual({ status: 'error', error: serverError });
  });

  it('never lets a previous payload pass as the current one', () => {
    // RTK Query keeps `data` from the last successful request when the arguments
    // change, so a failed filtered request arrives with stale data attached.
    const state = toRemoteState({
      data: [{ id: 'stale' }],
      error: serverError,
      isLoading: false,
      isError: true,
    });
    expect(state.status).toBe('error');
  });

  it('reports loading while a stale payload is still in the cache', () => {
    const state = toRemoteState({
      data: [{ id: 'stale' }],
      isLoading: true,
      isError: false,
    });
    expect(state.status).toBe('loading');
  });

  it('reports idle before the first request', () => {
    expect(toRemoteState({ isLoading: false, isError: false, isUninitialized: true })).toEqual({
      status: 'idle',
    });
  });
});
