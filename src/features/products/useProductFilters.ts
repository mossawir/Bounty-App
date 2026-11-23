import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZE,
  isDefaultFilters,
  parseFilters,
  toSearchParams,
  type ProductFilters,
} from './filters';

const FILTER_KEYS = ['search', 'category', 'inStock', 'sort'] as const;

/**
 * Custom hook: single owner of "view state lives in the URL".
 * Components ask for filters and call `update`; they never touch history themselves.
 *
 * Any change to a filter resets to page 1 — staying on page 7 of a result set that
 * just shrank to two pages is the classic pagination bug.
 */
export function useProductFilters(): {
  filters: ProductFilters;
  update: (patch: Partial<ProductFilters>, options?: { replace?: boolean }) => void;
  clear: () => void;
  isFiltered: boolean;
} {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const update = useCallback(
    (patch: Partial<ProductFilters>, options?: { replace?: boolean }) => {
      const next = { ...parseFilters(params), ...patch };
      const filterChanged = FILTER_KEYS.some((key) => key in patch);
      if (filterChanged && patch.page === undefined) next.page = 1;
      setParams(toSearchParams(next), { replace: options?.replace ?? false });
    },
    [params, setParams],
  );

  const clear = useCallback(() => {
    const current = parseFilters(params);
    const next = { ...DEFAULT_FILTERS, pageSize: current.pageSize };
    setParams(toSearchParams(next), { replace: false });
  }, [params, setParams]);

  return { filters, update, clear, isFiltered: !isDefaultFilters(filters) };
}

export { DEFAULT_FILTERS, DEFAULT_PAGE_SIZE };
