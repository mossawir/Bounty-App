import type { Category, SortOption } from '@/types/domain';
import { CATEGORIES, SORT_OPTIONS } from '@/types/domain';

export const PAGE_SIZES = [24, 48, 96] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 24;

export interface ProductFilters {
  search: string;
  category: Category | 'all';
  inStock: boolean;
  sort: SortOption;
  /** 1-based page number. Pagination is part of the URL like any other view state. */
  page: number;
  pageSize: PageSize;
}

export const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  category: 'all',
  inStock: false,
  sort: 'featured',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value);
}

export function isSort(value: string | null): value is SortOption {
  return value !== null && (SORT_OPTIONS as readonly string[]).includes(value);
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), 10_000);
}

/**
 * URL is the source of truth for filters and paging: a copied link reproduces the
 * view, a refresh keeps it, and the Back button walks through it.
 */
export function parseFilters(params: URLSearchParams): ProductFilters {
  const category = params.get('category');
  const sort = params.get('sort');
  const search = params.get('search') ?? '';
  const sizeParam = parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE);
  return {
    search: search.slice(0, 80),
    category: isCategory(category) ? category : 'all',
    inStock: params.get('inStock') === 'true',
    sort: isSort(sort) ? sort : 'featured',
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: isPageSize(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE,
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
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(filters.pageSize));
  return params;
}

/** Paging is navigation, not a filter: it does not light up "Clear filters". */
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

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
}
