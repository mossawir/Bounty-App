import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HomePage } from '@/pages/HomePage';
import { setChaos } from '@/mocks/db';
import { renderWithProviders } from '@/test/utils';

const filterPanel = () => within(screen.getByRole('region', { name: 'Search and filter products' }));

describe('HomePage states', () => {
  it('shows a retryable error when a filtered request fails, not the previous shelf', async () => {
    // Regression: RTK Query keeps the last successful `data` when the arguments
    // change, so a failed filter request used to render the old, unfiltered list
    // as if it were the answer — no error, no retry, wrong products.
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { route: '/' });

    expect(await filterPanel().findByText(/Showing/)).toHaveTextContent('Showing 5,000 products');

    setChaos({ failNext: { products: 500 } });
    await user.click(screen.getByRole('button', { name: 'Keyboards' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/out of reach/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // The stale count must not keep claiming the old result.
    expect(screen.queryByText(/Showing 5,000 products after filtering/)).not.toBeInTheDocument();
    expect(filterPanel().getByText('Stock count unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(filterPanel().getByText(/Showing/)).toHaveTextContent('after filtering');
  });

  it('renders the empty state with a way out when nothing matches', async () => {
    renderWithProviders(<HomePage />, { route: '/?search=zzzzzzz' });

    expect(await screen.findByRole('heading', { name: /Nothing matches/i })).toBeInTheDocument();
    // The filter bar's own button plus the empty state's escape hatch.
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(2);
  });
});
