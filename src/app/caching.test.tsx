import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { bazaarApi, useGetProductQuery } from '@/app/api';
import { createAppStore } from '@/app/store';
import { db, DEMO_USER } from '@/mocks/db';

function DetailProbe({ id }: { id: string }) {
  const { data, isFetching } = useGetProductQuery(id);
  return (
    <div>
      <span data-testid="fetching">{String(isFetching)}</span>
      <span data-testid="name">{data?.name ?? 'none'}</span>
      <span data-testid="stock">{data?.stock ?? -1}</span>
    </div>
  );
}

const authedStore = () =>
  createAppStore({
    auth: {
      token: `bb.${DEMO_USER.id}.cache-test`,
      user: { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name },
    },
  });

describe('caching (D3-5)', () => {
  it('reuses cached product data when a screen is revisited', async () => {
    const product = db.products[3];
    if (!product) throw new Error('catalogue empty');

    const store = createAppStore();
    const first = render(
      <Provider store={store}>
        <DetailProbe id={product.id} />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent(product.name));
    first.unmount();

    // Revisit immediately: keepUnusedDataFor is 10 minutes, so the data is present
    // on the first render and no request is in flight.
    render(
      <Provider store={store}>
        <DetailProbe id={product.id} />
      </Provider>,
    );

    expect(screen.getByTestId('name')).toHaveTextContent(product.name);
    expect(screen.getByTestId('fetching')).toHaveTextContent('false');
  });

  it('refreshes stock after an order invalidates the product tag', async () => {
    const product = db.products.find((candidate) => candidate.stock > 2);
    if (!product) throw new Error('catalogue has no stock');
    const stockBefore = product.stock;

    const store = authedStore();
    render(
      <Provider store={store}>
        <DetailProbe id={product.id} />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('stock')).toHaveTextContent(String(stockBefore)));

    await store
      .dispatch(
        bazaarApi.endpoints.createOrder.initiate({
          items: [{ productId: product.id, quantity: 1 }],
          contact: { name: 'Demo Shopper', email: 'demo@bugbazaar.dev' },
          idempotencyKey: 'cache-invalidation-key-1',
        }),
      )
      .unwrap();

    await waitFor(() =>
      expect(screen.getByTestId('stock')).toHaveTextContent(String(stockBefore - 1)),
    );
  });
});
