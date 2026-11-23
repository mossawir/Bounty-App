import { describe, expect, it, vi } from 'vitest';
import { PERSISTENCE_KEY, subscribeToPersistence } from '@/app/persist';
import { createAppStore } from '@/app/store';
import { addItem } from '@/features/cart/cartSlice';
import type { Product } from '@/types/domain';

const product: Product = {
  id: 'p-0001',
  name: 'Sprint Blend — Ground 250g',
  price: 2199,
  category: 'coffee',
  stock: 5,
  rating: 4.2,
  imageUrl: '/img/coffee-1.svg',
};

describe('persistence', () => {
  it('throttles writes but flushes the pending cart when the page goes away', () => {
    vi.useFakeTimers();
    const store = createAppStore();
    const unsubscribe = subscribeToPersistence(store);

    store.dispatch(addItem({ product }));
    // Still inside the 250 ms window: nothing on disk yet.
    expect(localStorage.getItem(PERSISTENCE_KEY)).toBeNull();

    window.dispatchEvent(new Event('pagehide'));

    const saved = JSON.parse(localStorage.getItem(PERSISTENCE_KEY) ?? 'null') as {
      cart: { items: { productId: string; quantity: number }[] };
    };
    expect(saved.cart.items).toHaveLength(1);
    expect(saved.cart.items[0]?.quantity).toBe(1);

    unsubscribe();
    vi.useRealTimers();
  });

  it('writes once the throttle window elapses', () => {
    vi.useFakeTimers();
    const store = createAppStore();
    const unsubscribe = subscribeToPersistence(store);

    store.dispatch(addItem({ product }));
    vi.advanceTimersByTime(250);

    expect(localStorage.getItem(PERSISTENCE_KEY)).toContain('p-0001');

    unsubscribe();
    vi.useRealTimers();
  });
});
