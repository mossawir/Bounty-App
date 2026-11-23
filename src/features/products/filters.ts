import type { Category, SortOption } from '@/types/domain';
import { CATEGORIES, SORT_OPTIONS } from '@/types/domain';

export interface ProductFilters {
  search: string;
  category: Category | 'all';
  inStock: boolean;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  category: 'all',
  inStock: false,
  sort: 'featured',
};

export function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value);
}

export function isSort(value: string | null): value is SortOption {
  return value !== null && (SORT_OPTIONS as readonly string[]).includes(value);
}

/**
 * URL is the source of truth for filters: a copied link reproduces the view,
 * a refresh keeps it, and the Back button walks through filter history.
 */
export function parseFilters(params: URLSearchParams): ProductFilters {
  const category = params.get('category');
  const sort = params.get('sort');
  const search = params.get('search') ?? '';
  return {
    search: search.slice(0, 80),
    category: isCategory(category) ? category : 'all',
    inStock: params.get('inStock') === 'true',
    sort: isSort(sort) ? sort : 'featured',
  };
}

/** Defaults are omitted so the canonical URL stays short and shareable. */
export function toSearchParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set('search', search);
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  return params;
}

export function isDefaultFilters(filters: ProductFilters): boolean {
  return (
    filters.search.trim() === '' &&
    filters.category === 'all' &&
    !filters.inStock &&
    filters.sort === 'featured'
  );
}

export function activeFilterCount(filters: ProductFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.category !== 'all') count += 1;
  if (filters.inStock) count += 1;
  if (filters.sort !== 'featured') count += 1;
  return count;
}
