import type {
  Category,
  Product,
  ProductListResponse,
  ProductQuery,
  SortOption,
} from '@/types/domain';

const DIGITS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cents -> "$12.99". Single source of truth for money rendering. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return DIGITS.format(0);
  return DIGITS.format(cents / 100);
}

/** 1299 -> "12.99" (for <input type="text"> style editing, unused for display). */
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function formatCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(count);
}

export function sortProducts(items: Product[], sort: SortOption): Product[] {
  const copy = [...items];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'rating-desc':
      return copy.sort((a, b) => b.rating - a.rating);
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'featured':
    default:
      // "Featured" is the buyer's curated shelf order: a stable mix of categories,
      // not a rating sort, so the first screen is not 4,000 identical stickers.
      return copy;
  }
}

export interface DerivedList {
  items: Product[];
  total: number;
}

/** Pure filter/sort/page used by the mock API and by unit tests. */
export function queryProducts(products: Product[], query: ProductQuery): ProductListResponse {
  const search = (query.search ?? '').trim().toLowerCase();
  const category = query.category ?? 'all';
  const pageSize = Math.min(Math.max(query.pageSize ?? 24, 1), 5000);
  const page = Math.max(query.page ?? 1, 1);

  const filtered = products.filter((product) => {
    if (category !== 'all' && product.category !== category) return false;
    if (query.inStock && product.stock <= 0) return false;
    if (search) {
      const haystack = `${product.name} ${product.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const sorted = sortProducts(filtered, query.sort ?? 'featured');
  const start = (page - 1) * pageSize;
  return { items: sorted.slice(start, start + pageSize), total: sorted.length };
}

export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; blurb: string; code: string }
> = {
  keyboards: {
    label: 'Mechanical keyboards',
    short: 'Keyboards',
    blurb: 'Thocky, hot-swappable, and built to survive a thousand force pushes.',
    code: 'KBD',
  },
  ducks: {
    label: 'Rubber ducks',
    short: 'Ducks',
    blurb: 'Silent pair-programming partners. They never ask why you did that.',
    code: 'DCK',
  },
  coffee: {
    label: 'Coffee',
    short: 'Coffee',
    blurb: 'Roasted for late deploys and early stand-ups. Ship it or sip it.',
    code: 'CFE',
  },
  stickers: {
    label: 'Stickers',
    short: 'Stickers',
    blurb: 'Die-cut vinyl for laptops that have seen things.',
    code: 'STK',
  },
};
