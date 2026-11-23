import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { addItem } from '@/features/cart/cartSlice';
import { selectStockOverrides } from '@/features/realtime/realtimeSlice';
import { useGetProductsQuery } from '@/app/api';
import { FilterBar } from '@/components/FilterBar';
import { ProductGrid } from '@/components/ProductGrid';
import { SkeletonGrid, EmptyState, ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/toastContext';
import { useProductFilters } from '@/features/products/useProductFilters';
import { applyStockOverrides } from '@/lib/products';
import { toRemoteState } from '@/lib/remoteState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCents, formatCount } from '@/lib/format';
import { SparkIcon } from '@/components/icons';
import type { Product } from '@/types/domain';

/** One request for the whole filtered set; the grid virtualizes it. */
const PAGE_SIZE = 5000;

export function HomePage() {
  useDocumentTitle('Shop');
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { filters, update, clear, isFiltered } = useProductFilters();
  const overrides = useAppSelector(selectStockOverrides);

  const query = useGetProductsQuery({
    search: filters.search,
    category: filters.category,
    inStock: filters.inStock,
    sort: filters.sort,
    pageSize: PAGE_SIZE,
  });

  const state = toRemoteState(query);
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
        total={state.status === 'success' ? state.data.total : undefined}
        isLoading={state.status === 'loading' || query.isFetching}
      />

      <section className="shelf" aria-labelledby="products-heading" aria-busy={query.isFetching}>
        <h2 className="visually-hidden" id="products-heading">
          Products
        </h2>
        {state.status === 'loading' ? <SkeletonGrid count={8} /> : null}

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
          <>
            <ProductGrid products={products} onAdd={onAdd} />
            <p className="muted" style={{ marginTop: 18, fontSize: 12.5 }}>
              Showing all {formatCount(products.length)} matches. Rendered with windowed
              virtualization — scroll and the list keeps up. <Link to="/cart">Check the cart</Link>{' '}
              when you are done.
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
