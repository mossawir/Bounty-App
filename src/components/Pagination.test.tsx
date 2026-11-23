import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';
import { pageWindow } from '@/features/products/pageWindow';

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first, last and neighbours, collapsing the rest', () => {
    expect(pageWindow(10, 42)).toEqual([1, 'gap', 9, 10, 11, 'gap', 42]);
  });

  it('does not collapse near the start or the end', () => {
    expect(pageWindow(2, 42)).toEqual([1, 2, 3, 4, 'gap', 42]);
    expect(pageWindow(41, 42)).toEqual([1, 'gap', 39, 40, 41, 42]);
  });
});

describe('Pagination', () => {
  it('describes the visible range and marks the current page', () => {
    render(<Pagination page={2} pageSize={24} total={500} onChange={() => undefined} />);

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 25–48 of 500 products');
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Page 2 of 21')).toBeInTheDocument();
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={24} total={500} onChange={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    rerender(<Pagination page={21} pageSize={24} total={500} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('reports the page the shopper picks', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} pageSize={24} total={500} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('renders nothing when there is nothing to page through', () => {
    const { container } = render(
      <Pagination page={1} pageSize={24} total={0} onChange={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
