import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { useGetProductsQuery } from '@/app/api';
import { createAppStore } from '@/app/store';
import { db, setChaos } from '@/mocks/db';
import { queryProducts } from '@/lib/format';

function SearchProbe({ search }: { search: string }) {
  const { data, isFetching } = useGetProductsQuery({ search, pageSize: 5 });
  return (
    <div>
      <p data-testid="state">{isFetching ? 'loading' : 'ready'}</p>
      <ul>
        {(data?.items ?? []).map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}

function expectedNames(search: string): string[] {
  return queryProducts(db.products, { search, pageSize: 5 }).items.map((product) => product.name);
}

describe('search race conditions', () => {
  it('shows results for the latest query when an earlier response lands later', async () => {
    // The mock delays the first search in each pair so responses arrive out of order.
    setChaos({ latencyMs: 40, jitterMs: 0, outOfOrder: true });

    const store = createAppStore();
    const view = render(
      <Provider store={store}>
        <SearchProbe search="coffee" />
      </Provider>,
    );

    // Type again before the first request resolves.
    view.rerender(
      <Provider store={store}>
        <SearchProbe search="duck" />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'), {
      timeout: 4000,
    });

    const shown = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(shown).toEqual(expectedNames('duck'));
  });

  it('never renders results for a query the user has moved on from', async () => {
    setChaos({ latencyMs: 30, jitterMs: 0, outOfOrder: true });

    const store = createAppStore();
    const view = render(
      <Provider store={store}>
        <SearchProbe search="keyboard" />
      </Provider>,
    );

    view.rerender(
      <Provider store={store}>
        <SearchProbe search="sticker" />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'), {
      timeout: 4000,
    });

    const text = screen.getByRole('list').textContent ?? '';
    const stale = expectedNames('keyboard').filter(
      (name) => !expectedNames('sticker').includes(name),
    );
    for (const name of stale) {
      expect(text).not.toContain(name);
    }
  });
});
