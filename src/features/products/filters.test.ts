import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  isDefaultFilters,
  parseFilters,
  toSearchParams,
} from './filters';

describe('URL filter state', () => {
  it('reads valid values out of the query string', () => {
    const filters = parseFilters(
      new URLSearchParams('search=duck&category=ducks&inStock=true&sort=price-asc'),
    );
    expect(filters).toEqual({
      search: 'duck',
      category: 'ducks',
      inStock: true,
      sort: 'price-asc',
    });
  });

  it('ignores hostile or unknown values instead of throwing', () => {
    const filters = parseFilters(
      new URLSearchParams('category=<script>&sort=cheapest&inStock=yes&search=' + 'x'.repeat(200)),
    );
    expect(filters.category).toBe('all');
    expect(filters.sort).toBe('featured');
    expect(filters.inStock).toBe(false);
    expect(filters.search).toHaveLength(80);
  });

  it('omits defaults so shareable links stay short', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...DEFAULT_FILTERS, category: 'coffee' }).toString()).toBe(
      'category=coffee',
    );
  });

  it('round-trips a view through the URL, which is what makes refresh and Back work', () => {
    const original = {
      search: 'thock',
      category: 'keyboards' as const,
      inStock: true,
      sort: 'rating-desc' as const,
    };
    const parsed = parseFilters(new URLSearchParams(toSearchParams(original).toString()));
    expect(parsed).toEqual(original);
  });

  it('counts active filters for the "clear filters" affordance', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);

    const active = { ...DEFAULT_FILTERS, search: '  duck  ', inStock: true };
    expect(isDefaultFilters(active)).toBe(false);
    expect(activeFilterCount(active)).toBe(2);
  });
});
