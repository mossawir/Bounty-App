import { describe, expect, it } from 'vitest';
import { formatCents, formatCount, pluralize, queryProducts } from '@/lib/format';
import type { Product } from '@/types/domain';

function product(overrides: Partial<Product> & Pick<Product, 'id'>): Product {
  return {
    name: `Product ${overrides.id}`,
    price: 1000,
    category: 'ducks',
    stock: 5,
    rating: 4.5,
    imageUrl: '/img/ducks-1.svg',
    ...overrides,
  };
}

const catalogue: Product[] = [
  product({ id: 'p1', name: 'Caffeine Duck', category: 'ducks', price: 1200, rating: 4.9 }),
  product({ id: 'p2', name: 'Clackwell 65%', category: 'keyboards', price: 18900, rating: 4.2 }),
  product({ id: 'p3', name: 'Byte Roast', category: 'coffee', price: 1500, rating: 4.7, stock: 0 }),
  product({ id: 'p4', name: 'Debug Duck', category: 'ducks', price: 900, rating: 3.9 }),
];

describe('money formatting', () => {
  it('renders cents as dollars with two decimals', () => {
    expect(formatCents(1299)).toBe('$12.99');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(24900)).toBe('$249.00');
  });

  it('never renders a bare number for a bad value', () => {
    expect(formatCents(Number.NaN)).toBe('$0.00');
  });

  it('formats counts and plurals', () => {
    expect(formatCount(5000)).toBe('5,000');
    expect(pluralize(1, 'product')).toBe('product');
    expect(pluralize(2, 'product')).toBe('products');
  });
});

describe('queryProducts', () => {
  it('returns the documented list shape with a total', () => {
    const result = queryProducts(catalogue, { pageSize: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(4);
  });

  it('filters by search across name and category', () => {
    expect(queryProducts(catalogue, { search: 'duck' }).total).toBe(2);
    expect(queryProducts(catalogue, { search: 'coffee' }).total).toBe(1);
  });

  it('filters by category and stock', () => {
    expect(queryProducts(catalogue, { category: 'ducks' }).total).toBe(2);
    expect(queryProducts(catalogue, { inStock: true }).total).toBe(3);
    expect(queryProducts(catalogue, { category: 'ducks', inStock: true }).total).toBe(2);
  });

  it('sorts by price and rating', () => {
    expect(queryProducts(catalogue, { sort: 'price-asc' }).items.map((p) => p.id)).toEqual([
      'p4',
      'p1',
      'p3',
      'p2',
    ]);
    const topRated = queryProducts(catalogue, { sort: 'rating-desc' }).items[0];
    expect(topRated?.id).toBe('p1');
  });

  it('paginates without losing the total', () => {
    const first = queryProducts(catalogue, { page: 1, pageSize: 3 });
    const second = queryProducts(catalogue, { page: 2, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(1);
    expect(second.total).toBe(4);
  });

  it('keeps the catalogue order for "featured"', () => {
    expect(queryProducts(catalogue, { sort: 'featured' }).items.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
  });
});
