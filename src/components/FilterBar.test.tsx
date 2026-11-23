import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from '@/components/FilterBar';
import { DEFAULT_FILTERS } from '@/features/products/filters';
import { renderWithProviders } from '@/test/utils';

const noop = () => undefined;

describe('FilterBar', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the result count and reflects the active category', () => {
    renderWithProviders(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onChange={noop}
        onClear={noop}
        isFiltered={false}
        total={5000}
        isLoading={false}
      />,
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 5,000 products');
    expect(screen.getByRole('button', { name: 'All gear' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('emits a category change when a chip is pressed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onChange={onChange}
        onClear={noop}
        isFiltered={false}
        total={10}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Coffee' }));
    expect(onChange).toHaveBeenCalledWith({ category: 'coffee' });
  });

  it('debounces typing so the URL is not rewritten on every keystroke', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderWithProviders(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onChange={onChange}
        onClear={noop}
        isFiltered={false}
        total={10}
        isLoading={false}
      />,
    );

    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'd' } });
    fireEvent.change(input, { target: { value: 'du' } });
    fireEvent.change(input, { target: { value: 'duck' } });

    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ search: 'duck' }, { replace: true });
  });

  it('adopts an external clear instead of pushing the stale draft back', () => {
    // Regression: pressing "Clear filters" while a search was still in the box
    // used to let the debounced draft rewrite the old term into the URL, so the
    // empty state could not be escaped.
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, search: 'duck' }}
        onChange={onChange}
        onClear={noop}
        isFiltered
        total={0}
        isLoading={false}
      />,
    );

    rerender(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onChange={onChange}
        onClear={noop}
        isFiltered={false}
        total={5000}
        isLoading={false}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('toggles the in-stock switch with an accessible switch role', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, inStock: true }}
        onChange={onChange}
        onClear={noop}
        isFiltered
        total={10}
        isLoading={false}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /In stock only/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ inStock: false });
  });

  it('enables "Clear filters" only when something is filtered', () => {
    renderWithProviders(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onChange={noop}
        onClear={noop}
        isFiltered={false}
        total={10}
        isLoading={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('enables "Clear filters" when a search is active', () => {
    renderWithProviders(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, search: 'duck' }}
        onChange={noop}
        onClear={noop}
        isFiltered
        total={10}
        isLoading={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
  });
});
