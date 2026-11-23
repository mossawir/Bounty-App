import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ProductCard } from './ProductCard';
import { useStockFocus } from '@/hooks/useStockFeed';
import type { Product } from '@/types/domain';

const GAP = 22;
const MIN_CARD_WIDTH = 224;
const MAX_COLUMNS = 5;
/** Below this, render everything: screen readers and find-in-page see the whole list. */
const VIRTUAL_THRESHOLD = 60;

interface ProductGridProps {
  products: Product[];
  onAdd: (product: Product) => void;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

/**
 * Two rendering modes:
 * - small result sets: a plain <ul> grid, fully in the DOM (best for a11y);
 * - large result sets: window-virtualized rows, so 5,000 products cost ~4 rows of DOM.
 *
 * Memoization contract: `products` is only a new array when the query result or a
 * live-stock override actually changed (see `applyStockOverrides`), and each
 * `ProductCard` is memoized. A stock tick for one product therefore re-renders one
 * card, not the 20 on screen or the 5,000 in the list.
 */
export function ProductGrid({ products, onAdd }: ProductGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [scrollMargin, setScrollMargin] = useState(0);
  const virtualize = products.length > VIRTUAL_THRESHOLD;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = (): void => {
      const width = element.clientWidth;
      // Two columns on phones, up to five on a wide desktop.
      const minCardWidth = width < 560 ? 150 : MIN_CARD_WIDTH;
      const next = Math.max(
        1,
        Math.min(MAX_COLUMNS, Math.floor((width + GAP) / (minCardWidth + GAP))),
      );
      setColumns((current) => (current === next ? current : next));
      const offset = element.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) => (Math.abs(current - offset) > 1 ? offset : current));
    };

    measure();
    window.addEventListener('resize', measure);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }

    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  const rows = useMemo(
    () => (virtualize ? chunk(products, columns) : []),
    [products, columns, virtualize],
  );

  const virtualizer = useWindowVirtualizer({
    count: virtualize ? rows.length : 0,
    estimateSize: () => 380,
    overscan: 4,
    scrollMargin,
  });

  useEffect(() => {
    virtualizer.measure();
    // Re-measure when the row count or column count changes.
  }, [virtualizer, rows.length, columns]);

  const virtualItems = virtualizer.getVirtualItems();

  const visibleIds = useMemo(() => {
    if (!virtualize) return products.slice(0, 60).map((product) => product.id);
    const ids: string[] = [];
    for (const item of virtualItems) {
      for (const product of rows[item.index] ?? []) ids.push(product.id);
    }
    return ids;
  }, [products, rows, virtualItems, virtualize]);

  useStockFocus(visibleIds);

  if (!virtualize) {
    return (
      <div className="shelf" ref={containerRef}>
        <ul className="product-grid product-grid-static">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} onAdd={onAdd} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="shelf" ref={containerRef}>
      <div
        className="product-grid"
        data-virtual="true"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((item) => {
          const row = rows[item.index] ?? [];
          const style = {
            transform: `translateY(${item.start - scrollMargin}px)`,
            '--cols': String(columns),
          } as CSSProperties;

          return (
            <div
              key={item.key}
              className="product-row"
              data-index={item.index}
              ref={virtualizer.measureElement}
              style={style}
            >
              {row.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={onAdd} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
