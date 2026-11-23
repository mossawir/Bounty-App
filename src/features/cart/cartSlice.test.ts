import { describe, expect, it } from 'vitest';
import {
  addItem,
  cartReducer,
  clearCart,
  removeItem,
  selectCartCount,
  selectCartDistinctCount,
  selectCartSignature,
  selectCartSubtotal,
  setQuantity,
  type CartItem,
  type CartState,
} from '@/features/cart/cartSlice';
import { createCatalog } from '@/mocks/catalog';
import type { Product } from '@/types/domain';

const [duck] = createCatalog(20) as [Product];

function stateWith(items: CartItem[]): CartState {
  return { items };
}

function item(overrides: Partial<CartItem>): CartItem {
  return {
    productId: 'p-0001',
    name: 'Debug Duck',
    price: 1299,
    imageUrl: '/img/ducks-1.svg',
    category: 'ducks',
    stock: 10,
    quantity: 1,
    ...overrides,
  };
}

describe('cart reducer', () => {
  it('adds a product and merges repeat adds', () => {
    let state = cartReducer(undefined, { type: '@@init' });
    state = cartReducer(state, addItem({ product: duck, quantity: 2 }));
    state = cartReducer(state, addItem({ product: duck, quantity: 1 }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.quantity).toBe(3);
  });

  it('caps quantity at the available stock', () => {
    const limited: Product = { ...duck, stock: 2 };
    const state = cartReducer({ items: [] }, addItem({ product: limited, quantity: 5 }));
    expect(state.items[0]?.quantity).toBe(2);
  });

  it('never adds an out-of-stock product', () => {
    const soldOut: Product = { ...duck, stock: 0 };
    const state = cartReducer({ items: [] }, addItem({ product: soldOut }));
    expect(state.items).toHaveLength(0);
  });

  it('removes a line when the quantity reaches zero', () => {
    const start = stateWith([item({ quantity: 2 })]);
    const state = cartReducer(start, setQuantity({ productId: 'p-0001', quantity: 0 }));
    expect(state.items).toHaveLength(0);
  });

  it('ignores quantity updates for products that are not in the cart', () => {
    const state = cartReducer(stateWith([]), setQuantity({ productId: 'nope', quantity: 3 }));
    expect(state.items).toHaveLength(0);
  });

  it('removes a line and clears the cart', () => {
    const start = stateWith([item({ productId: 'a' }), item({ productId: 'b' })]);
    const removed = cartReducer(start, removeItem('a'));
    expect(removed.items.map((entry) => entry.productId)).toEqual(['b']);
    expect(cartReducer(removed, clearCart()).items).toEqual([]);
  });
});

describe('cart selectors', () => {
  const state = stateWith([
    item({ productId: 'a', price: 1000, quantity: 2 }),
    item({ productId: 'b', price: 250, quantity: 4 }),
  ]);

  it('derives the total unit count for the header badge', () => {
    expect(selectCartCount({ cart: state })).toBe(6);
  });

  it('derives the distinct line count', () => {
    expect(selectCartDistinctCount({ cart: state })).toBe(2);
  });

  it('derives the subtotal from cents', () => {
    expect(selectCartSubtotal({ cart: state })).toBe(3000);
  });

  it('produces a stable signature regardless of line order', () => {
    const reordered = stateWith([...state.items].reverse());
    expect(selectCartSignature({ cart: state })).toBe(selectCartSignature({ cart: reordered }));
    expect(selectCartSignature({ cart: state })).toContain('a:2');
  });

  it('changes the signature when a quantity changes, which re-scopes idempotency', () => {
    const changed = cartReducer(state, setQuantity({ productId: 'a', quantity: 1 }));
    expect(selectCartSignature({ cart: changed })).not.toBe(selectCartSignature({ cart: state }));
  });
});
