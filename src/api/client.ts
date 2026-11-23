import { createId } from '@/lib/id';
import { handleMockRequest } from '@/mocks/server';
import { HttpError, toHttpError } from './errors';

/**
 * The only module allowed to touch the network. Components never call fetch:
 * they go through RTK Query, whose baseQuery calls `request`.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const USE_MOCK = BASE_URL === '';

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

function buildPath(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Deep copy mock responses so the "server" keeps sole ownership of its objects. */
function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, token, signal } = options;
  const requestId = createId();
  const url = buildPath(path, query);

  if (USE_MOCK) {
    const [, rawQuery = ''] = url.split('?');
    const response = await handleMockRequest({
      method,
      path,
      query: new URLSearchParams(rawQuery),
      body,
      token: token ?? null,
      ...(signal ? { signal } : {}),
    });

    if (response.status >= 200 && response.status < 300) {
      // A real API sends a copy over the wire; without cloning here the mock's
      // mutable database objects would end up (frozen) inside the RTK Query cache.
      return clone(response.body) as T;
    }

    const payload = response.body as {
      error?: { code?: string; message?: string; details?: Record<string, string> };
    };
    throw new HttpError({
      status: response.status,
      code: payload.error?.code ?? 'HTTP_ERROR',
      message: payload.error?.message ?? `Request failed with ${response.status}`,
      requestId,
      ...(payload.error?.details ? { fieldErrors: payload.error.details } : {}),
      ...(payload.error?.details?.productId
        ? { conflictProductId: payload.error.details.productId }
        : {}),
    });
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers: {
        Accept: 'application/json',
        'x-request-id': requestId,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new HttpError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network request failed',
      requestId,
    });
  }

  if (!response.ok) {
    throw await toHttpError(response, requestId);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const isMockMode = USE_MOCK;
