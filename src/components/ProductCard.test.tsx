import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from '@/components/ProductCard';
import { renderWithProviders } from '@/test/utils';
import type { Product } from '@/types/domain';

const product: Product = {
  id: 'p-0001',
  name: 'Debug Duck · Night Shift',
  price: 1299,
  category: 'ducks',
  stock: 7,
  rating: 4.6,
  imageUrl: '/img/ducks-1.svg',
};

describe('ProductCard', () => {
  it('shows the name, cents-formatted price and stock', () => {
    renderWithProviders(<ProductCard product={product} onAdd={() => undefined} />);

    expect(screen.getByRole('heading', { name: product.name })).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
    expect(screen.getByText('7 in stock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: product.name })).toHaveAttribute(
      'href',
      '/products/p-0001',
    );
  });

  it('calls onAdd with the product when the button is used', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProductCard product={product} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^Add to cart — Debug Duck/ }));
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  it('disables the action and says so when the item is sold out', () => {
    renderWithProviders(<ProductCard product={{ ...product, stock: 0 }} onAdd={() => undefined} />);

    const button = screen.getByRole('button', { name: /^Sold out — Debug Duck/ });
    expect(button).toBeDisabled();
    expect(screen.getAllByText('Sold out').length).toBeGreaterThan(0);
  });
});
