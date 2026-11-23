import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Category, Product } from '@/types/domain';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  category: Category;
  /** Stock known when the line was added; refreshed by the live feed. */
  stock: number;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

const initialState: CartState = { items: [] };

function clampQuantity(quantity: number, stock: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(Math.floor(quantity), Math.max(stock, 1)));
}

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<{ product: Product; quantity?: number }>) {
      const { product, quantity = 1 } = action.payload;
      if (product.stock <= 0) return;

      const existing = state.items.find((item) => item.productId === product.id);
      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + quantity, product.stock);
        existing.stock = product.stock;
        existing.price = product.price;
        return;
      }

      state.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        stock: product.stock,
        quantity: clampQuantity(quantity, product.stock),
      });
    },
    setQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const item = state.items.find((entry) => entry.productId === action.payload.productId);
      if (!item) return;
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((entry) => entry.productId !== action.payload.productId);
        return;
      }
      item.quantity = clampQuantity(action.payload.quantity, item.stock);
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.productId !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
    /** Restore a persisted cart after the store is created. */
    hydrateCart(state, action: PayloadAction<CartItem[]>) {
      state.items = action.payload;
    },
  },
});

export const { addItem, setQuantity, removeItem, clearCart, hydrateCart } = cartSlice.actions;
export const cartReducer = cartSlice.reducer;

type CartSliceState = { cart: CartState };

export const selectCartItems = (state: CartSliceState): CartItem[] => state.cart.items;

/** Derived, never stored: the header badge reads this. */
export const selectCartCount = createSelector(selectCartItems, (items) =>
  items.reduce((total, item) => total + item.quantity, 0),
);

export const selectCartSubtotal = createSelector(selectCartItems, (items) =>
  items.reduce((total, item) => total + item.price * item.quantity, 0),
);

export const selectCartDistinctCount = createSelector(selectCartItems, (items) => items.length);

/** Stable fingerprint used to scope the checkout idempotency key. */
export const selectCartSignature = createSelector(selectCartItems, (items) =>
  items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join('|'),
);

export const selectCartItemById = (productId: string) =>
  createSelector(selectCartItems, (items) => items.find((item) => item.productId === productId));
