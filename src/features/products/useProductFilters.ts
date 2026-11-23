import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_FILTERS,
  isDefaultFilters,
  parseFilters,
  toSearchParams,
  type ProductFilters,
} from './filters';

/**
 * Custom hook: single owner of "filter state lives in the URL".
 * Components ask for filters and call `update`; they never touch history themselves.
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
      setParams(toSearchParams(next), { replace: options?.replace ?? false });
    },
    [params, setParams],
  );

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: false });
  }, [setParams]);

  return { filters, update, clear, isFiltered: !isDefaultFilters(filters) };
}

export { DEFAULT_FILTERS };
