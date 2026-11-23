import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  isDefaultFilters,
  pageCountFor,
  parseFilters,
  toSearchParams,
} from './filters';

describe('URL filter and paging state', () => {
  it('reads valid values out of the query string', () => {
    const filters = parseFilters(
      new URLSearchParams('search=duck&category=ducks&inStock=true&sort=price-asc&page=3'),
    );
    expect(filters).toEqual({
      search: 'duck',
      category: 'ducks',
      inStock: true,
      sort: 'price-asc',
      page: 3,
      pageSize: 24,
    });
  });

  it('ignores hostile or unknown values instead of throwing', () => {
    const filters = parseFilters(
      new URLSearchParams(
        'category=<script>&sort=cheapest&inStock=yes&page=-4&pageSize=999&search=' +
          'x'.repeat(200),
      ),
    );
    expect(filters.category).toBe('all');
    expect(filters.sort).toBe('featured');
    expect(filters.inStock).toBe(false);
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(24);
    expect(filters.search).toHaveLength(80);
  });

  it('accepts only the offered page sizes', () => {
    expect(parseFilters(new URLSearchParams('pageSize=48')).pageSize).toBe(48);
    expect(parseFilters(new URLSearchParams('pageSize=96')).pageSize).toBe(96);
    expect(parseFilters(new URLSearchParams('pageSize=1000')).pageSize).toBe(24);
    expect(parseFilters(new URLSearchParams('pageSize=abc')).pageSize).toBe(24);
  });

  it('omits defaults so shareable links stay short', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...DEFAULT_FILTERS, category: 'coffee' }).toString()).toBe(
      'category=coffee',
    );
    expect(toSearchParams({ ...DEFAULT_FILTERS, page: 2 }).toString()).toBe('page=2');
    expect(toSearchParams({ ...DEFAULT_FILTERS, pageSize: 96 }).toString()).toBe('pageSize=96');
  });

  it('round-trips a view through the URL, which is what makes refresh and Back work', () => {
    const original = {
      search: 'thock',
      category: 'keyboards' as const,
      inStock: true,
      sort: 'rating-desc' as const,
      page: 4,
      pageSize: 48 as const,
    };
    const parsed = parseFilters(new URLSearchParams(toSearchParams(original).toString()));
    expect(parsed).toEqual(original);
  });

  it('counts active filters for the "clear filters" affordance, excluding paging', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);

    // Being on page 4 is navigation, not a filter.
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, page: 4 })).toBe(true);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, page: 4, pageSize: 96 })).toBe(0);

    const active = { ...DEFAULT_FILTERS, search: '  duck  ', inStock: true };
    expect(isDefaultFilters(active)).toBe(false);
    expect(activeFilterCount(active)).toBe(2);
  });

  it('computes page counts from the filtered total', () => {
    expect(pageCountFor(0, 24)).toBe(1);
    expect(pageCountFor(1, 24)).toBe(1);
    expect(pageCountFor(24, 24)).toBe(1);
    expect(pageCountFor(25, 24)).toBe(2);
    expect(pageCountFor(5000, 24)).toBe(209);
    expect(pageCountFor(5000, 96)).toBe(53);
  });
});
