import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { clearCart, selectCartItems } from '@/features/cart/cartSlice';
import { signedOut } from '@/features/auth/authSlice';
import {
  db,
  getChaos,
  resetChaos,
  setChaos,
  subscribeChaos,
  type ChaosConfig,
  type ChaosKey,
} from '@/mocks/db';
import { stockSocket } from '@/realtime/stockSocket';

/**
 * The "bug lab": every error state in the app can be triggered on demand.
 * Dev-only (or via VITE_ENABLE_DEVTOOLS=true) and never part of the shopping flow.
 */
export function DevLab() {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cartCount = cartItems.length;
  const firstLine = cartItems[0];
  const [open, setOpen] = useState(false);
  const [chaos, setChaosState] = useState<ChaosConfig>(() => getChaos());

  useEffect(() => subscribeChaos(setChaosState), []);

  const failNext = (key: ChaosKey, status: number) => {
    const failNextPatch: Partial<Record<ChaosKey, number>> = { [key]: status };
    setChaos({ failNext: failNextPatch });
  };

  return (
    <div className="bug-lab">
      {open ? (
        <div className="bug-lab-panel" role="group" aria-label="Bug lab controls">
          <h2>Bug lab</h2>
          <button type="button" onClick={() => failNext('products', 500)}>
            List → 500 error
          </button>
          <button type="button" onClick={() => failNext('product', 404)}>
            Details → 404
          </button>
          <button type="button" onClick={() => failNext('login', 401)}>
            Login → 401
          </button>
          <button type="button" onClick={() => failNext('orders', 500)}>
            Checkout → 500
          </button>
          <button
            type="button"
            disabled={!firstLine}
            onClick={() => {
              // Lower the real shelf stock below the cart quantity, so the next
              // checkout gets the server's genuine 409 (with details: productId,
              // productName, available, requested) instead of a canned error.
              if (firstLine) {
                db.setStock(firstLine.productId, Math.max(0, firstLine.quantity - 1));
              }
            }}
          >
            Sell out cart item → 409{firstLine ? ` (${firstLine.name})` : ''}
          </button>
          <button
            type="button"
            data-on={chaos.failOrdersAfterCommit}
            onClick={() => setChaos({ failOrdersAfterCommit: !chaos.failOrdersAfterCommit })}
          >
            500 after commit: {chaos.failOrdersAfterCommit ? 'on' : 'off'}
          </button>
          <button
            type="button"
            data-on={chaos.latencyMs > 700}
            onClick={() => setChaos({ latencyMs: chaos.latencyMs > 700 ? 180 : 1200 })}
          >
            Slow network: {chaos.latencyMs > 700 ? 'on' : 'off'}
          </button>
          <button
            type="button"
            data-on={chaos.emptyProducts}
            onClick={() => setChaos({ emptyProducts: !chaos.emptyProducts })}
          >
            Empty results: {chaos.emptyProducts ? 'on' : 'off'}
          </button>
          <button
            type="button"
            data-on={chaos.outOfOrder}
            onClick={() => setChaos({ outOfOrder: !chaos.outOfOrder })}
          >
            Out-of-order search: {chaos.outOfOrder ? 'on' : 'off'}
          </button>
          <button type="button" onClick={() => stockSocket.forceDrop()}>
            Drop live stock socket
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(clearCart());
              dispatch(signedOut());
            }}
          >
            Clear cart + sign out ({cartCount})
          </button>
          <button
            type="button"
            onClick={() => {
              resetChaos();
              setChaosState(getChaos());
            }}
          >
            Reset all
          </button>
          <p className="bug-lab-note">
            To see the 409: add an item, open checkout, press “Sell out cart item → 409”, then place
            the order. To see idempotency hold: enable “500 after commit”, place an order, then retry —
            the retry returns the same order id.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className="bug-lab-toggle"
        aria-expanded={open}
        data-active={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🐛</span> Bug lab
      </button>
    </div>
  );
}
