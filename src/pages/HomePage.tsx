import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { addItem } from '@/features/cart/cartSlice';
import { selectStockOverrides } from '@/features/realtime/realtimeSlice';
import { useGetProductsQuery } from '@/app/api';
import { FilterBar } from '@/components/FilterBar';
import { ProductGrid } from '@/components/ProductGrid';
import { Pagination } from '@/components/Pagination';
import { SkeletonGrid, EmptyState, ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/toastContext';
import { useProductFilters } from '@/features/products/useProductFilters';
import { pageCountFor } from '@/features/products/filters';
import { applyStockOverrides } from '@/lib/products';
import { toRemoteState } from '@/lib/remoteState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCents, formatCount } from '@/lib/format';
import { SparkIcon } from '@/components/icons';
import type { Product } from '@/types/domain';

export function HomePage() {
  useDocumentTitle('Shop');
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { filters, update, clear, isFiltered } = useProductFilters();
  const overrides = useAppSelector(selectStockOverrides);
  const shelfRef = useRef<HTMLDivElement>(null);

  const query = useGetProductsQuery(filters);
  const state = toRemoteState(query);

  /** Identifies "the same shelf": page changes keep the count, filter changes do not. */
  const filterSignature = `${filters.search}|${filters.category}|${filters.inStock}|${filters.sort}`;
  const successTotal = state.status === 'success' ? state.data.total : undefined;

  // Carry the total across page changes so the count and the pager do not blink out,
  // but never reuse it for a different filter — or after an error, where a stale
  // number would claim the old shelf is still the answer.
  const [carried, setCarried] = useState<{ signature: string; total: number }>();
  useEffect(() => {
    if (successTotal === undefined) return;
    setCarried({ signature: filterSignature, total: successTotal });
  }, [successTotal, filterSignature]);

  const carriedTotal = carried?.signature === filterSignature ? carried.total : undefined;
  const total =
    state.status === 'success'
      ? state.data.total
      : state.status === 'loading'
        ? carriedTotal
        : undefined;

  const pageCount = pageCountFor(total ?? 0, filters.pageSize);

  // A filter change can shrink the result set below the current page.
  useEffect(() => {
    if (state.status !== 'success') return;
    if (filters.page > pageCount) {
      update({ page: pageCount }, { replace: true });
    }
  }, [state.status, filters.page, pageCount, update]);

  // Page changes are navigations: bring the shelf back into view and move focus
  // to its heading so keyboard and screen-reader users land in the new results.
  const lastPage = useRef(filters.page);
  useEffect(() => {
    if (lastPage.current === filters.page) return;
    lastPage.current = filters.page;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    shelfRef.current?.scrollIntoView?.({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    document.getElementById('products-heading')?.focus({ preventScroll: true });
  }, [filters.page]);

  const rawItems = query.data?.items;
  const products = useMemo(
    () => applyStockOverrides(rawItems ?? [], overrides),
    [rawItems, overrides],
  );

  const onAdd = useCallback(
    (product: Product) => {
      dispatch(addItem({ product }));
      toast.push(`${product.name} added to cart`, 'success');
    },
    [dispatch, toast],
  );

  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">A store for people who read stack traces</p>
          <h1 className="hero-title" id="hero-title">
            Gear for the <em>long</em> debug.
          </h1>
          <p className="hero-lede">
            Rubber ducks, mechanical keyboards, coffee and stickers — 5,000 products, live stock,
            and a checkout that will not double-charge you. Built for the Week 1 bounty board.
          </p>

          <dl className="hero-stats">
            <div>
              <dt>Products</dt>
              <dd>{formatCount(5000)}</dd>
            </div>
            <div>
              <dt>Shelves</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Stock updates</dt>
              <dd>Live</dd>
            </div>
            <div>
              <dt>Starting at</dt>
              <dd>{formatCents(349)}</dd>
            </div>
          </dl>
        </div>

        <aside className="hero-art" aria-label="Featured item">
          <img src="/img/ducks-1.svg" alt="A yellow rubber duck, the shop's mascot" />
          <div className="hero-art-caption">
            <span>Debug Duck · Night Shift</span>
            <span>{formatCents(1299)}</span>
          </div>
          <span className="hero-sticker" aria-hidden="true">
            Open
            <br />
            late
          </span>
        </aside>
      </section>

      <FilterBar
        filters={filters}
        onChange={update}
        onClear={clear}
        isFiltered={isFiltered}
        total={total}
        isLoading={state.status === 'loading' && total === undefined}
      />

      <section
        className="shelf"
        ref={shelfRef}
        aria-labelledby="products-heading"
        aria-busy={query.isFetching}
      >
        <h2 className="visually-hidden" id="products-heading" tabIndex={-1}>
          Products
        </h2>
        {state.status === 'loading' ? (
          <SkeletonGrid count={Math.min(filters.pageSize, 12)} />
        ) : null}

        {state.status === 'error' ? (
          <ErrorState
            error={state.error}
            title={
              state.error.kind === 'server' ? 'The shelves are out of reach' : 'That did not load'
            }
            onRetry={() => void query.refetch()}
          />
        ) : null}

        {state.status === 'success' && products.length === 0 ? (
          <EmptyState
            title={filters.search ? `Nothing matches “${filters.search}”` : 'Nothing on this shelf'}
            description={
              filters.search
                ? 'Try a shorter search, or clear the filters to see everything the bazaar has.'
                : 'The bazaar is empty right now. Clear the filters to see the whole shop.'
            }
            icon={<SparkIcon size={24} />}
            action={
              <button type="button" className="btn btn-primary" onClick={clear}>
                Clear filters
              </button>
            }
          />
        ) : null}

        {state.status === 'success' && products.length > 0 ? (
          <ProductGrid products={products} onAdd={onAdd} />
        ) : null}

        {total !== undefined && total > 0 ? (
          <Pagination
            page={Math.min(filters.page, pageCount)}
            pageSize={filters.pageSize}
            total={total}
            onChange={(page) => update({ page })}
          />
        ) : null}
      </section>
    </div>
  );
}
