/**
 * Minimal logger: keeps an in-memory ring buffer for the console, and forwards
 * errors to VITE_ERROR_REPORT_URL when one is configured.
 *
 * It is deliberately dependency-free: monitoring should not be the thing that
 * takes the store down.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEvent {
  id: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

type Sink = (event: LogEvent) => void;

const MAX_ENTRIES = 50;
const entries: LogEvent[] = [];
const sinks = new Set<Sink>();

function nextId(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): LogEvent {
  const event: LogEvent = {
    id: nextId(),
    level,
    message,
    ...(context ? { context } : {}),
    timestamp: new Date().toISOString(),
  };

  entries.push(event);
  if (entries.length > MAX_ENTRIES) entries.shift();

  if (level === 'error') console.error(`[bug-bazaar] ${message}`, context ?? '');
  else if (level === 'warn') console.warn(`[bug-bazaar] ${message}`, context ?? '');
  else console.info(`[bug-bazaar] ${message}`, context ?? '');

  sinks.forEach((sink) => {
    try {
      sink(event);
    } catch {
      // A broken sink must never break the caller.
    }
  });

  return event;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    return emit('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    return emit('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    return emit('error', message, context);
  },
  addSink(sink: Sink): () => void {
    sinks.add(sink);
    return () => sinks.delete(sink);
  },
  entries(): readonly LogEvent[] {
    return entries;
  },
  clear(): void {
    entries.length = 0;
  },
};

const REPORT_URL = import.meta.env.VITE_ERROR_REPORT_URL;

/** Fire-and-forget transport for the error endpoint. */
logger.addSink((event) => {
  if (event.level !== 'error' || !REPORT_URL || import.meta.env.MODE === 'test') return;
  void fetch(REPORT_URL, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => undefined);
});

export function reportError(error: unknown, context?: Record<string, unknown>): LogEvent {
  const message = error instanceof Error ? error.message : String(error);
  return logger.error(message, {
    ...context,
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

/** Catch what React cannot: unhandled promise rejections and window errors. */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onError = (event: ErrorEvent): void => {
    reportError(event.error ?? new Error(event.message), { source: 'window.error' });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    reportError(event.reason, { source: 'unhandledrejection' });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
