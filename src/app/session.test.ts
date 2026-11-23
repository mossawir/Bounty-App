import { describe, expect, it } from 'vitest';
import { createOrder, getProducts, login } from '@/app/api';
import { createAppStore } from '@/app/store';
import { setChaos } from '@/mocks/db';
import type { CreateOrderRequest } from '@/types/domain';

const order: CreateOrderRequest = {
  items: [{ productId: 'p-0001', quantity: 1 }],
  contact: { name: 'Ada Lovelace', email: 'ada@example.com' },
  idempotencyKey: 'test-idempotency-key',
};

function storeWithSession() {
  return createAppStore({
    auth: {
      token: 'bb.u-1001.persisted',
      user: { id: 'u-1001', email: 'demo@bugbazaar.dev', name: 'Demo Shopper' },
    },
  });
}

describe('session handling', () => {
  it('clears the session when any endpoint answers 401, and says why', async () => {
    const store = storeWithSession();
    expect(store.getState().auth.token).not.toBeNull();

    setChaos({ failNext: { orders: 401 } });
    await store.dispatch(createOrder.initiate(order));

    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.notice).toMatch(/session ended/i);
  });

  it('does not sign the shopper out when a different endpoint fails', async () => {
    const store = storeWithSession();

    setChaos({ failNext: { products: 500 } });
    await store.dispatch(getProducts.initiate({ pageSize: 5 }));

    expect(store.getState().auth.token).toBe('bb.u-1001.persisted');
    expect(store.getState().auth.notice).toBeNull();
  });

  it('leaves a login 401 alone so the form can show its own copy', async () => {
    const store = createAppStore();
    setChaos({ failNext: { login: 401 } });

    await store.dispatch(
      login.initiate({ email: 'demo@bugbazaar.dev', password: 'wrong-password' }),
    );

    expect(store.getState().auth.notice).toBeNull();
  });
});
