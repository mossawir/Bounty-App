import { describe, expect, it } from 'vitest';
import { bazaarApi } from '@/app/api';
import { createAppStore } from '@/app/store';
import { request } from '@/api/client';
import { db, resetDb } from '@/mocks/db';
import type { Product } from '@/types/domain';

/**
 * Regression tests for the transport boundary. The bug these exist for:
 * the mock used to hand its own objects to RTK Query, Immer froze them, and the
 * next stock write threw "Cannot assign to read only property 'stock'".
 */
describe('api client boundary', () => {
  it('returns a copy, never the mock database object', async () => {
    const product = db.products[0];
    if (!product) throw new Error('empty catalogue');

    const body = await request<Product>(`/api/products/${product.id}`);

    expect(body).toEqual(product);
    expect(body).not.toBe(product);
  });

  it('keeps the mock database mutable after a query has cached the response', async () => {
    const product = db.products[0];
    if (!product) throw new Error('empty catalogue');

    resetDb();
    const store = createAppStore();
    const result = await store
      .dispatch(bazaarApi.endpoints.getProducts.initiate({ pageSize: 5 }))
      .unwrap();

    expect(result.items.length).toBeGreaterThan(0);

    // If the cache held the database's own objects, Immer would have frozen them
    // and this write would throw.
    expect(() => db.setStock(product.id, 1)).not.toThrow();
    expect(db.findProduct(product.id)?.stock).toBe(1);
  });

  it('normalises a failed mock request into an AppError with a status', async () => {
    await expect(request('/api/products/does-not-exist')).rejects.toMatchObject({
      status: 404,
      code: 'PRODUCT_NOT_FOUND',
    });
  });
});
