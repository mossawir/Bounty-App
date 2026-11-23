import { describe, expect, it } from 'vitest';
import { handleMockRequest, orderCount } from '@/mocks/server';
import { db, DEMO_USER, issueToken, setChaos } from '@/mocks/db';

const token = issueToken(DEMO_USER.id);

function request(
  path: string,
  init: {
    method?: 'GET' | 'POST';
    query?: string;
    body?: unknown;
    token?: string | null;
  } = {},
) {
  return handleMockRequest({
    method: init.method ?? 'GET',
    path,
    query: new URLSearchParams(init.query ?? ''),
    body: init.body,
    token: init.token === undefined ? token : init.token,
  });
}

function inStockProduct() {
  const product = db.products.find((candidate) => candidate.stock > 5);
  if (!product) throw new Error('catalogue has no stock');
  return product;
}

describe('mock API contract: products', () => {
  it('GET /api/products returns { items, total } and honours filters', async () => {
    const response = await request('/api/products', { query: 'pageSize=7&category=ducks' });
    expect(response.status).toBe(200);
    const body = response.body as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(7);
    expect(body.total).toBeGreaterThan(100);
  });

  it('GET /api/products/:id returns a product, or 404 in the documented shape', async () => {
    const product = inStockProduct();
    const found = await request(`/api/products/${product.id}`);
    expect(found.status).toBe(200);
    expect((found.body as { id: string }).id).toBe(product.id);

    const missing = await request('/api/products/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { code: 'PRODUCT_NOT_FOUND', message: expect.any(String) },
    });
  });

  it('exposes one trigger for every error the UI has to handle', async () => {
    setChaos({ failNext: { products: 500 } });
    expect((await request('/api/products')).status).toBe(500);
    // one-shot: the next call is healthy again
    expect((await request('/api/products')).status).toBe(200);
  });
});

describe('mock API contract: auth', () => {
  it('rejects a malformed login with 400 and field details', async () => {
    const response = await request('/api/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '123' },
      token: null,
    });
    expect(response.status).toBe(400);
    const body = response.body as { error: { code: string; details?: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details?.email).toBeTruthy();
    expect(body.error.details?.password).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const response = await request('/api/login', {
      method: 'POST',
      body: { email: DEMO_USER.email, password: 'wrong-password' },
      token: null,
    });
    expect(response.status).toBe(401);
  });

  it('signs the demo user in and returns { token, user }', async () => {
    const response = await request('/api/login', {
      method: 'POST',
      body: { email: DEMO_USER.email, password: DEMO_USER.password },
      token: null,
    });
    expect(response.status).toBe(200);
    const body = response.body as { token: string; user: { email: string } };
    expect(body.token).toMatch(/^bb\./);
    expect(body.user.email).toBe(DEMO_USER.email);
  });

  it('GET /api/me returns 401 without a token and the user with one', async () => {
    expect((await request('/api/me', { token: null })).status).toBe(401);

    const me = await request('/api/me');
    expect(me.status).toBe(200);
    expect((me.body as { id: string }).id).toBe(DEMO_USER.id);
  });
});

describe('mock API contract: orders', () => {
  const contact = { name: 'Demo Shopper', email: 'demo@bugbazaar.dev' };

  function orderBody(productId: string, quantity: number, key: string) {
    return { items: [{ productId, quantity }], contact, idempotencyKey: key };
  }

  it('rejects an anonymous checkout with 401', async () => {
    const response = await request('/api/orders', {
      method: 'POST',
      body: orderBody('p-0001', 1, 'key-anonymous-1'),
      token: null,
    });
    expect(response.status).toBe(401);
  });

  it('validates the body with 400 + field errors', async () => {
    const response = await request('/api/orders', {
      method: 'POST',
      body: { items: [], contact: { name: '', email: 'nope' }, idempotencyKey: 'short' },
    });
    expect(response.status).toBe(400);
    const body = response.body as { error: { details?: Record<string, string> } };
    expect(body.error.details?.items).toBeTruthy();
    expect(body.error.details?.['contact.name']).toBeTruthy();
  });

  it('returns 409 naming the product when stock runs out', async () => {
    const product = inStockProduct();
    db.setStock(product.id, 1);
    const response = await request('/api/orders', {
      method: 'POST',
      body: orderBody(product.id, 4, 'key-out-of-stock'),
    });
    expect(response.status).toBe(409);
    const body = response.body as { error: { details?: Record<string, string> } };
    expect(body.error.details?.productId).toBe(product.id);
    expect(body.error.details?.available).toBe('1');
  });

  it('creates a queued order, decrements stock, and never duplicates on retry', async () => {
    const product = inStockProduct();
    const stockBefore = product.stock;
    const key = 'checkout-attempt-key-1';

    const first = await request('/api/orders', {
      method: 'POST',
      body: orderBody(product.id, 2, key),
    });
    expect(first.status).toBe(201);
    const firstBody = first.body as { id: string; status: string };
    expect(firstBody.status).toBe('queued');
    expect(orderCount()).toBe(1);
    expect(db.findProduct(product.id)?.stock).toBe(stockBefore - 2);

    const retry = await request('/api/orders', {
      method: 'POST',
      body: orderBody(product.id, 2, key),
    });
    expect(retry.status).toBe(201);
    expect((retry.body as { id: string }).id).toBe(firstBody.id);
    expect(orderCount()).toBe(1);
  });

  it('GET /api/orders/:id is scoped to the signed-in user', async () => {
    const product = inStockProduct();
    const created = await request('/api/orders', {
      method: 'POST',
      body: orderBody(product.id, 1, 'order-lookup-key'),
    });
    const id = (created.body as { id: string }).id;

    const found = await request(`/api/orders/${id}`);
    expect(found.status).toBe(200);

    const anonymous = await request(`/api/orders/${id}`, { token: null });
    expect(anonymous.status).toBe(401);

    db.users.push({
      id: 'u-2002',
      email: 'someone@else.dev',
      name: 'Someone Else',
      password: 'password123',
    });
    const other = await request(`/api/orders/${id}`, { token: issueToken('u-2002') });
    expect(other.status).toBe(404);
  });
});
