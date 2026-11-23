import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  clearCart,
  removeItem,
  selectCartItems,
  selectCartSubtotal,
  setQuantity,
} from '@/features/cart/cartSlice';
import { selectStockOverrides } from '@/features/realtime/realtimeSlice';
import { QuantityStepper } from '@/components/QuantityStepper';
import { EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/toastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCents } from '@/lib/format';
import { CartIcon, TrashIcon } from '@/components/icons';

export function CartPage() {
  useDocumentTitle('Cart');
  const dispatch = useAppDispatch();
  const toast = useToast();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const overrides = useAppSelector(selectStockOverrides);

  const liveStock = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.productId, overrides[item.productId] ?? item.stock]),
      ),
    [items, overrides],
  );

  if (items.length === 0) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-title">Your cart</h1>
        </div>
        <EmptyState
          title="Nothing in the cart yet"
          description="Ducks, keyboards and coffee are all one click away. The cart is saved in this browser, so you can come back to it."
          icon={<CartIcon size={24} />}
          action={
            <Link className="btn btn-primary" to="/">
              Browse the shelves
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="page-title">Your cart</h1>
          <p className="page-sub">
            {items.length} {items.length === 1 ? 'line' : 'lines'} · saved in this browser
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            dispatch(clearCart());
            toast.push('Cart cleared');
          }}
        >
          Empty the cart
        </button>
      </div>

      <div className="cart-layout">
        <ul className="cart-list" aria-label="Cart items">
          {items.map((item) => {
            const stock = liveStock[item.productId] ?? item.stock;
            const overStock = item.quantity > stock;
            const soldOut = stock <= 0;

            return (
              <li className="cart-row" key={item.productId}>
                <div className="cart-thumb">
                  <img src={item.imageUrl} alt="" width={92} height={92} loading="lazy" />
                </div>

                <div>
                  <div className="cart-line-top">
                    <h2 className="cart-line-name">
                      <Link to={`/products/${item.productId}`}>{item.name}</Link>
                    </h2>
                  </div>

                  <div className="cart-line-meta">
                    <span>{formatCents(item.price)} each</span>
                    <span aria-hidden="true">·</span>
                    <span>{soldOut ? 'Sold out' : `${stock} available`}</span>
                  </div>

                  <div className="cart-line-controls">
                    <QuantityStepper
                      value={item.quantity}
                      max={Math.max(stock, 1)}
                      onChange={(next) =>
                        dispatch(setQuantity({ productId: item.productId, quantity: next }))
                      }
                      label={item.name}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        dispatch(removeItem(item.productId));
                        toast.push(`${item.name} removed`);
                      }}
                    >
                      <TrashIcon size={14} /> Remove
                    </button>
                  </div>

                  {overStock ? (
                    <p className="cart-warning" role="status">
                      Only {stock} left — lower the quantity before checking out.
                    </p>
                  ) : null}
                </div>

                <div className="cart-line-total">{formatCents(item.price * item.quantity)}</div>
              </li>
            );
          })}
        </ul>

        <aside className="cart-summary" aria-labelledby="summary-title">
          <h2 id="summary-title">Order summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span className="mono">{formatCents(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span className="mono">Free</span>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <span className="mono">Included</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>{formatCents(subtotal)}</span>
          </div>

          <Link className="btn btn-primary btn-block" to="/checkout">
            Go to checkout
          </Link>

          <p className="summary-note">
            Checkout is protected: you will be asked to sign in if you are not already. Nothing is
            charged — this store runs against the mock API.
          </p>
        </aside>
      </div>
    </div>
  );
}
