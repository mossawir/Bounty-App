import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HomePage } from '@/pages/HomePage';
import { db, setChaos } from '@/mocks/db';
import { renderWithProviders } from '@/test/utils';
import { pageCountFor } from '@/features/products/filters';
import { queryProducts } from '@/lib/format';

const panelRegion = () => screen.getByRole('region', { name: 'Search and filter products' });

describe('HomePage states', () => {
  it('shows a retryable error when a filtered request fails, not the previous shelf', async () => {
    // Regression: RTK Query keeps the last successful `data` when the arguments
    // change, so a failed filter request used to render the old, unfiltered list
    // as if it were the answer — no error, no retry, wrong products.
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { route: '/' });

    await waitFor(() => expect(panelRegion()).toHaveTextContent('5,000 products on the shelves'), {
      timeout: 5000,
    });

    setChaos({ failNext: { products: 500 } });
    await user.click(screen.getByRole('button', { name: 'Keyboards' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/out of reach/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // The stale count must not keep claiming the old result.
    expect(panelRegion()).not.toHaveTextContent('5,000 products after filtering');
    expect(panelRegion()).toHaveTextContent('Stock count unavailable');
    // Nor may the previous shelf's pagination stay on screen.
    expect(
      screen.queryByRole('navigation', { name: 'Product pagination' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(panelRegion()).toHaveTextContent('products after filtering');
  });

  it('renders the empty state with a way out when nothing matches', async () => {
    renderWithProviders(<HomePage />, { route: '/?search=zzzzzzz' });

    expect(await screen.findByRole('heading', { name: /Nothing matches/i })).toBeInTheDocument();
    // The filter bar's own button plus the empty state's escape hatch.
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(2);
  });
});

describe('HomePage pagination', () => {
  it('loads only one page of products and reports the range', async () => {
    renderWithProviders(<HomePage />, { route: '/?page=2' });

    expect(await screen.findByText('Page 2 of 209', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(24);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 25–48 of 5,000 products');
  });

  it('moves between pages without loading the whole catalogue', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('Page 1 of 209', {}, { timeout: 5000 });
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–24 of 5,000 products');

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(await screen.findByText('Page 2 of 209', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 25–48 of 5,000 products');
    expect(screen.getAllByRole('article')).toHaveLength(24);
  });

  it('returns to page 1 when a filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { route: '/?page=3' });

    await screen.findByText('Page 3 of 209', {}, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Ducks' }));

    const duckTotal = queryProducts(db.products, { category: 'ducks' }).total;
    const duckPages = pageCountFor(duckTotal, 24);
    expect(
      await screen.findByText(`Page 1 of ${duckPages}`, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('lets the shopper change the page size', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('Page 1 of 209', {}, { timeout: 5000 });
    await user.selectOptions(screen.getByLabelText('Per page'), '48');

    expect(await screen.findByText('Page 1 of 105', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(48);
  });

  it('keeps the page in the URL so a refresh and a copied link reproduce the view', async () => {
    renderWithProviders(<HomePage />, { route: '/?category=coffee&page=2' });

    const coffeeTotal = queryProducts(db.products, { category: 'coffee' }).total;
    const coffeePages = pageCountFor(coffeeTotal, 24);

    expect(
      await screen.findByText(`Page 2 of ${coffeePages}`, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coffee' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides pagination when nothing matches', async () => {
    renderWithProviders(<HomePage />, { route: '/?search=zzzzzzz' });

    await screen.findByText(/Nothing matches/, {}, { timeout: 5000 });
    expect(
      screen.queryByRole('navigation', { name: 'Product pagination' }),
    ).not.toBeInTheDocument();
  });
});
