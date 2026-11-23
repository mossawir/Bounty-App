import type { Product } from '@/types/domain';

/**
 * Overlay live stock from the feed onto server data at read time.
 * The cache keeps what the server said; the socket is only a hint layer.
 */
export function applyStockOverrides(
  products: Product[],
  overrides: Record<string, number>,
): Product[] {
  if (Object.keys(overrides).length === 0) return products;

  let changed = false;
  const next = products.map((product) => {
    const stock = overrides[product.id];
    if (stock === undefined || stock === product.stock) return product;
    changed = true;
    return { ...product, stock };
  });

  return changed ? next : products;
}

export function stockTone(stock: number): 'ok' | 'warn' | 'out' {
  if (stock <= 0) return 'out';
  if (stock <= 3) return 'warn';
  return 'ok';
}

export function stockLabel(stock: number): string {
  if (stock <= 0) return 'Sold out';
  if (stock <= 3) return `Only ${stock} left`;
  return `${stock} in stock`;
}
