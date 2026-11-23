import type { CartItem } from '@/features/cart/cartSlice';
import type { RootState } from './store';

const STORAGE_KEY = 'bug-bazaar:v1';

interface PersistedShape {
  cart: { items: CartItem[] };
  auth: { token: string | null; user: RootState['auth']['user'] };
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number' &&
    typeof item.stock === 'number'
  );
}

export function loadPersistedState(): Pick<PersistedShape, 'cart' | 'auth'> | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    const items = Array.isArray(parsed.cart?.items) ? parsed.cart.items.filter(isCartItem) : [];
    const token = typeof parsed.auth?.token === 'string' ? parsed.auth.token : null;
    const user = parsed.auth?.user ?? null;
    return { cart: { items }, auth: { token, user } };
  } catch {
    return undefined;
  }
}

/**
 * Persist the two things that must survive a reload: the cart and the session.
 * Writes are throttled so dragging a quantity stepper does not hammer storage.
 */
export function subscribeToPersistence(store: {
  getState: () => RootState;
  subscribe: (listener: () => void) => () => void;
}): () => void {
  if (typeof localStorage === 'undefined') return () => undefined;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWritten = '';

  const flush = (): void => {
    timer = null;
    const state = store.getState();
    const payload: PersistedShape = {
      cart: { items: state.cart.items },
      auth: { token: state.auth.token, user: state.auth.user },
    };
    const serialised = JSON.stringify(payload);
    // Live stock ticks dispatch several times a second; only persist when the
    // cart or the session actually changed.
    if (serialised === lastWritten) return;
    lastWritten = serialised;
    try {
      localStorage.setItem(STORAGE_KEY, serialised);
    } catch {
      // Storage can be full or blocked; the app still works in memory.
    }
  };

  const unsubscribe = store.subscribe(() => {
    if (timer !== null) return;
    timer = setTimeout(flush, 250);
  });

  // A 250 ms throttle means an immediate reload (or a tab close) can land before
  // the pending snapshot is written, losing the last add-to-cart. Flush on the
  // lifecycle events that precede teardown.
  const flushPending = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    flush();
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') flushPending();
  };

  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (hasDom) {
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
    if (hasDom) {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

export const PERSISTENCE_KEY = STORAGE_KEY;
