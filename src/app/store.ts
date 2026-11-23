import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { bazaarApi } from './api';
import type { AuthState } from '@/features/auth/authSlice';
import { authReducer, hydrateSession } from '@/features/auth/authSlice';
import type { CartState } from '@/features/cart/cartSlice';
import { cartReducer, hydrateCart } from '@/features/cart/cartSlice';
import { realtimeReducer } from '@/features/realtime/realtimeSlice';
import type { User } from '@/types/domain';
import { loadPersistedState, subscribeToPersistence } from './persist';

export interface PreloadedAppState {
  cart?: CartState;
  auth?: Pick<AuthState, 'token' | 'user'> & { user: User | null };
}

export function createAppStore(preloaded?: PreloadedAppState) {
  const appStore = configureStore({
    reducer: {
      cart: cartReducer,
      auth: authReducer,
      realtime: realtimeReducer,
      [bazaarApi.reducerPath]: bazaarApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(bazaarApi.middleware),
    devTools: import.meta.env.MODE !== 'production',
  });

  // Hydrate through actions instead of `preloadedState`: the store's state type
  // stays exactly what the reducers produce, and the restore path is testable.
  if (preloaded?.cart) appStore.dispatch(hydrateCart(preloaded.cart.items));
  if (preloaded?.auth) {
    appStore.dispatch(hydrateSession({ token: preloaded.auth.token, user: preloaded.auth.user }));
  }

  return appStore;
}

const persisted = loadPersistedState();

export const store = createAppStore(
  persisted ? { cart: persisted.cart, auth: persisted.auth } : undefined,
);

setupListeners(store.dispatch);
subscribeToPersistence(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = ReturnType<typeof createAppStore>;
