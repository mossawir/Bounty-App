import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SearchIcon } from '@/components/icons';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CATEGORIES, SORT_OPTIONS, type SortOption } from '@/types/domain';
import { CATEGORY_META, formatCount, pluralize } from '@/lib/format';
import { activeFilterCount, type ProductFilters } from '@/features/products/filters';

const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Highest rated',
  'name-asc': 'Name: A to Z',
};

interface FilterBarProps {
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
  isFiltered: boolean;
  total: number | undefined;
  isLoading: boolean;
}

export function FilterBar({
  filters,
  onChange,
  onClear,
  isFiltered,
  total,
  isLoading,
}: FilterBarProps) {
  const [draft, setDraft] = useState(filters.search);
  const debounced = useDebouncedValue(draft, 350);
  /**
   * Only a keystroke may push the draft into the URL. Without this guard,
   * clearing the filters (or pressing Back) updates the URL, and the debounced
   * draft then writes the old search straight back — the empty state could
   * never be escaped.
   */
  const draftFromUser = useRef(false);

  // Adopt URL changes that did not come from typing (Back, Clear, a pasted link).
  useEffect(() => {
    draftFromUser.current = false;
    setDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (!draftFromUser.current) return;
    if (debounced === filters.search) return;
    onChange({ search: debounced }, { replace: true });
  }, [debounced, filters.search, onChange]);

  const applyNow = (event: FormEvent) => {
    event.preventDefault();
    onChange({ search: draft }, { replace: true });
  };

  const activeCount = activeFilterCount(filters);

  return (
    <section className="filters" aria-label="Search and filter products">
      <div className="filters-main">
        <form className="filters-search" role="search" onSubmit={applyNow}>
          <label className="filters-label" htmlFor="product-search">
            Search
          </label>
          <input
            id="product-search"
            className="input"
            type="search"
            name="search"
            placeholder="Search ducks, keyboards, coffee…"
            value={draft}
            autoComplete="off"
            onChange={(event) => {
              draftFromUser.current = true;
              setDraft(event.target.value);
            }}
          />
          <SearchIcon className="filters-search-icon" size={17} />
        </form>

        <div className="filters-sort">
          <label htmlFor="product-sort">Sort by</label>
          <select
            id="product-sort"
            className="select"
            value={filters.sort}
            onChange={(event) => onChange({ sort: event.target.value as SortOption })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="chip-row" role="group" aria-label="Categories">
        <button
          type="button"
          className="chip"
          aria-pressed={filters.category === 'all'}
          onClick={() => onChange({ category: 'all' })}
        >
          All gear
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className="chip"
            aria-pressed={filters.category === category}
            onClick={() => onChange({ category })}
          >
            {CATEGORY_META[category].short}
          </button>
        ))}
      </div>

      <div className="filters-meta">
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={filters.inStock}
            onClick={() => onChange({ inStock: !filters.inStock })}
          >
            <span className="switch-track" aria-hidden="true" />
            In stock only
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClear}
            disabled={!isFiltered}
          >
            Clear filters
          </button>
          {activeCount > 0 ? (
            <span className="pill" aria-hidden="true">
              {activeCount} {pluralize(activeCount, 'filter')} on
            </span>
          ) : null}
        </div>

        <p aria-live="polite" aria-atomic="true">
          {isLoading ? (
            'Counting stock…'
          ) : total === undefined ? (
            'Stock count unavailable'
          ) : (
            <>
              Showing <strong>{formatCount(total)}</strong> {pluralize(total, 'product')}
              {isFiltered ? ' after filtering' : ''}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
