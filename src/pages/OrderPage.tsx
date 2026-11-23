import { Link, useParams } from 'react-router-dom';
import { useGetOrderQuery } from '@/app/api';
import { ErrorState } from '@/components/StateViews';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCents } from '@/lib/format';
import { toRemoteState } from '@/lib/remoteState';
import { CheckIcon } from '@/components/icons';
import type { OrderStatus } from '@/types/domain';

const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'queued', label: 'Queued' },
  { status: 'packing', label: 'Packing' },
  { status: 'shipped', label: 'Shipped' },
];

export function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const query = useGetOrderQuery(id ?? '', { skip: !id });
  const state = toRemoteState(query);
  useDocumentTitle('Order confirmed');

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="container">
        <div className="order-page" aria-busy="true">
          <div className="skeleton" style={{ height: 64, width: '70%' }} />
          <div className="skeleton" style={{ height: 200, marginTop: 24, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="container">
        <div className="order-page">
          <ErrorState
            error={state.error}
            title={state.error.kind === 'not_found' ? 'No such order' : 'That order did not load'}
            description={
              state.error.kind === 'not_found'
                ? 'We have no record of that order for this account.'
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
      </div>
    );
  }

  const order = state.data;
  const currentIndex = STEPS.findIndex((step) => step.status === order.status);
  const placedAt = new Date(order.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="container">
      <div className="order-page">
        <div className="order-hero">
          <span className="order-check" aria-hidden="true">
            <CheckIcon size={26} />
          </span>
          <div>
            <p className="eyebrow">Order {order.id}</p>
            <h1>Thanks — your order is queued</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              Placed {placedAt}. Nothing was charged; this is the mock API.
            </p>
          </div>
        </div>

        <ol className="timeline" aria-label="Order progress">
          {STEPS.map((step, index) => (
            <li
              key={step.status}
              className="timeline-step"
              data-done={index <= currentIndex}
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>

        <ul className="order-items" aria-label="Items in this order">
          {order.items.map((item) => (
            <li className="order-item" key={item.productId}>
              <img src={item.imageUrl} alt="" width={56} height={56} />
              <div>
                <p style={{ fontWeight: 600, fontSize: 14.5 }}>{item.name}</p>
                <p className="muted mono" style={{ fontSize: 11.5 }}>
                  {formatCents(item.price)} × {item.quantity}
                </p>
              </div>
              <span className="mono" style={{ fontWeight: 700 }}>
                {formatCents(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="order-total">
          <span>Total paid (in spirit)</span>
          <span>{formatCents(order.total)}</span>
        </div>

        <div className="row" style={{ marginTop: 22 }}>
          <Link className="btn btn-primary" to="/">
            Keep shopping
          </Link>
          <Link className="btn" to="/cart">
            View cart
          </Link>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Retrying a checkout reuses the same idempotency key — this order can never duplicate.
          </span>
        </div>
      </div>
    </div>
  );
}
