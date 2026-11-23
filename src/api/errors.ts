import type { ApiErrorBody, AppError, ErrorKind } from '@/types/domain';

/** Thrown by the transport for any non-2xx response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  readonly conflictProductId?: string;
  readonly requestId?: string;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    conflictProductId?: string;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'HttpError';
    this.status = init.status;
    this.code = init.code;
    if (init.fieldErrors) this.fieldErrors = init.fieldErrors;
    if (init.conflictProductId) this.conflictProductId = init.conflictProductId;
    if (init.requestId) this.requestId = init.requestId;
  }
}

function kindForStatus(status: number): ErrorKind {
  if (status === 0) return 'network';
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** Turn anything thrown into the one shape the UI and store understand. */
export function normalizeError(error: unknown): AppError {
  // RTK Query hands back the already-normalised error; never re-wrap it as network.
  if (isAppError(error)) return error;

  if (error instanceof HttpError) {
    return {
      kind: kindForStatus(error.status),
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      ...(error.conflictProductId ? { conflictProductId: error.conflictProductId } : {}),
      ...(error.requestId ? { requestId: error.requestId } : {}),
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      kind: 'unknown',
      status: 0,
      code: 'ABORTED',
      message: 'The request was cancelled.',
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return { kind: 'network', status: 0, code: 'NETWORK_ERROR', message };
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'status' in error &&
    'code' in error
  );
}

/**
 * Screen copy. Raw server strings never get rendered: we map the error to copy
 * we wrote, and only field-level messages (which are meant to be read) pass through.
 */
export function messageFor(error: AppError): string {
  switch (error.kind) {
    case 'network':
      return "We couldn't reach the bazaar. Check your connection and try again.";
    case 'bad_request':
      return 'Some details need another look. Check the highlighted fields.';
    case 'unauthorized':
      return 'Your session has ended. Sign in again to continue.';
    case 'not_found':
      return "We couldn't find that. It may have been moved or sold out.";
    case 'conflict':
      return 'Someone bought the last one while you were shopping.';
    case 'server':
      return 'Our stockroom hit an error. Nothing was charged — please try again.';
    case 'unknown':
    default:
      return 'Something unexpected happened. Please try again.';
  }
}

export function fieldErrorsFor(error: AppError | undefined): Record<string, string> {
  return error?.fieldErrors ?? {};
}

export function isFieldError(error: AppError | undefined, field: string): boolean {
  return Boolean(error?.fieldErrors?.[field]);
}

/** Parse a failed JSON response body into an HttpError. */
export async function toHttpError(response: Response, requestId: string): Promise<HttpError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = {};
  }
  const details = body.error?.details;
  return new HttpError({
    status: response.status,
    code: body.error?.code ?? 'HTTP_ERROR',
    message: body.error?.message ?? `Request failed with ${response.status}`,
    requestId,
    ...(details ? { fieldErrors: details } : {}),
    ...(details?.productId ? { conflictProductId: details.productId } : {}),
  });
}
