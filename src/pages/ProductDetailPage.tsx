import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetProductQuery, useGetProductsQuery } from '@/app/api';
import { addItem } from '@/features/cart/cartSlice';
import { selectStockOverrides } from '@/features/realtime/realtimeSlice';
import { ProductCard } from '@/components/ProductCard';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/toastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CATEGORY_META, formatCents } from '@/lib/format';
import { applyStockOverrides, stockTone } from '@/lib/products';
import { toRemoteState } from '@/lib/remoteState';
import { CheckIcon, StarIcon } from '@/components/icons';
import type { Product } from '@/types/domain';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const overrides = useAppSelector(selectStockOverrides);
  const [quantity, setQuantity] = useState(1);

  // RTK Query aborts the in-flight request when this component unmounts or `id`
  // changes, so switching products quickly can never paint a stale one.
  const query = useGetProductQuery(id ?? '', { skip: !id });
  const state = toRemoteState(query);

  const product = state.status === 'success' ? state.data : undefined;
  const stock = product ? (overrides[product.id] ?? product.stock) : 0;

  useDocumentTitle(product?.name ?? 'Product');

  useEffect(() => {
    setQuantity(1);
  }, [id]);

  useEffect(() => {
    if (quantity > stock) setQuantity(Math.max(stock, 1));
  }, [stock, quantity]);

  const related = useGetProductsQuery(
    { category: product?.category, sort: 'rating-desc', pageSize: 5 },
    { skip: !product },
  );

  const relatedItems = useMemo(
    () =>
      applyStockOverrides(related.data?.items ?? [], overrides)
        .filter((item) => item.id !== product?.id)
        .slice(0, 4),
    [related.data, overrides, product?.id],
  );

  const handleAdd = useCallback(() => {
    if (!product || stock <= 0) return;
    dispatch(addItem({ product: { ...product, stock }, quantity }));
    toast.push(`${quantity} × ${product.name} added to cart`, 'success');
  }, [dispatch, product, quantity, stock, toast]);

  const handleAddRelated = useCallback(
    (item: Product) => {
      dispatch(addItem({ product: item }));
      toast.push(`${item.name} added to cart`, 'success');
    },
    [dispatch, toast],
  );

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="container">
        <div className="detail" aria-busy="true">
          <div className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 20 }} />
          <div className="stack" style={{ paddingTop: 32 }}>
            <div className="skeleton skeleton-line" style={{ width: '30%' }} />
            <div className="skeleton" style={{ height: 44, width: '90%' }} />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            <div className="skeleton skeleton-line" style={{ width: '40%' }} />
            <span className="visually-hidden">Loading product</span>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="container" style={{ paddingBlock: 48 }}>
        <ErrorState
          error={state.error}
          title={state.error.kind === 'not_found' ? 'No such product' : 'That did not load'}
          description={
            state.error.kind === 'not_found'
              ? 'That item is not on any of our shelves. It may have sold out for good.'
              : undefined
          }
          onRetry={() => void query.refetch()}
        />
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn" to="/">
            Back to the shop
          </Link>
        </div>
      </div>
    );
  }

  // Narrowing for TypeScript: the success branch above guarantees data.
  if (!product) return null;

  const meta = CATEGORY_META[product.category];
  const soldOut = stock <= 0;
  const tone = stockTone(stock);

  return (
    <div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Shop</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/?category=${product.category}`}>{meta.short}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="detail">
        <div className="detail-media">
          <img
            src={product.imageUrl}
            alt={`${product.name} product photo`}
            width={600}
            height={600}
          />
          <div className="detail-media-foot">
            <span>
              {meta.code} · {product.id}
            </span>
            <span>Illustrated by the bazaar</span>
          </div>
        </div>

        <div>
          <span className="pill" data-tone={tone}>
            <span className="stock-dot" style={{ background: 'currentColor' }} aria-hidden="true" />
            {soldOut ? 'Sold out' : `${stock} in stock`}
          </span>

          <h1 className="detail-title">{product.name}</h1>

          <div className="row" style={{ gap: 14 }}>
            <span className="card-rating" aria-label={`Rated ${product.rating} out of 5`}>
              <StarIcon size={15} aria-hidden="true" /> {product.rating.toFixed(1)}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              {meta.label}
            </span>
          </div>

          <p className="detail-price price">
            {formatCents(product.price)}
            <small>incl. tax</small>
          </p>

          <p className="detail-blurb">{meta.blurb}</p>

          <div className="detail-buy">
            <QuantityStepper
              value={quantity}
              max={Math.max(stock, 1)}
              onChange={setQuantity}
              label={product.name}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={soldOut}
            >
              {soldOut ? 'Sold out' : `Add to cart · ${formatCents(product.price * quantity)}`}
            </button>
          </div>

          <p className="live-note" aria-live="polite">
            {soldOut
              ? 'This one is gone. The live feed will update if it comes back.'
              : `Stock is live. ${stock} available right now.`}
          </p>

          <ul className="detail-notes">
            <li>
              <CheckIcon size={16} aria-hidden="true" />
              Ships in 2–3 days from the bazaar's back room.
            </li>
            <li>
              <CheckIcon size={16} aria-hidden="true" />
              30-day returns — no questions about your switch choice.
            </li>
            <li>
              <CheckIcon size={16} aria-hidden="true" />
              Checkout is idempotent: retrying can never place a second order.
            </li>
          </ul>
        </div>
      </div>

      {relatedItems.length > 0 ? (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">More from {meta.short.toLowerCase()}</h2>
          <div className="related-grid">
            {relatedItems.map((item) => (
              <ProductCard key={item.id} product={item} onAdd={handleAddRelated} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
