import { memo } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon } from '@/components/icons';
import { CATEGORY_META, formatCents } from '@/lib/format';
import { stockLabel } from '@/lib/products';
import type { Product } from '@/types/domain';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

/**
 * Presentational card. It receives data and one callback; it does not fetch or
 * dispatch. Wrapped in memo so a stock tick for one product does not re-render
 * the other 4,999.
 */
export const ProductCard = memo(function ProductCard({ product, onAdd }: ProductCardProps) {
  const meta = CATEGORY_META[product.category];
  const soldOut = product.stock <= 0;
  const low = product.stock > 0 && product.stock <= 3;
  const headingId = `product-${product.id}-name`;

  return (
    <article className="product-card" aria-labelledby={headingId}>
      <div className="card-media">
        <img
          src={product.imageUrl}
          alt=""
          width={400}
          height={300}
          loading="lazy"
          decoding="async"
        />
        <span className="card-code">{meta.code}</span>
        <span className="card-stock" data-sold-out={soldOut}>
          <span
            className="stock-dot"
            style={{
              color: soldOut ? 'var(--danger)' : low ? '#a97a10' : 'var(--ok)',
              background: 'currentColor',
            }}
          />
          {stockLabel(product.stock)}
        </span>
      </div>

      <div className="card-body">
        <span className="card-cat">{meta.short}</span>
        <h3 className="card-name" id={headingId}>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="card-foot">
          <span className="price card-price">{formatCents(product.price)}</span>
          <span className="card-rating" aria-label={`Rated ${product.rating} out of 5`}>
            <StarIcon size={12} aria-hidden="true" />
            {product.rating.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-sm card-add"
          onClick={() => onAdd(product)}
          disabled={soldOut}
          aria-label={soldOut ? `Sold out — ${product.name}` : `Add to cart — ${product.name}`}
        >
          {soldOut ? 'Sold out' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
});
