import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useCreateOrderMutation } from '@/app/api';
import {
  clearCart,
  selectCartItems,
  selectCartSignature,
  selectCartSubtotal,
} from '@/features/cart/cartSlice';
import { selectUser } from '@/features/auth/authSlice';
import { CHECKOUT_FIELD_IDS, validateContact } from '@/features/checkout/validation';
import { ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/toastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCents } from '@/lib/format';
import { createId } from '@/lib/id';
import { normalizeError, messageFor } from '@/api/errors';
import { AlertIcon, LockIcon } from '@/components/icons';
import type { AppError, OrderContact } from '@/types/domain';

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAppSelector(selectUser);
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const signature = useAppSelector(selectCartSignature);

  const [contact, setContact] = useState<OrderContact>({
    name: user?.name ?? '',
    email: user?.email ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [createOrder, { isLoading }] = useCreateOrderMutation();

  /**
   * The idempotency key is scoped to the cart contents, not to the click.
   * A retry after a 500 reuses it, so the server can recognise the duplicate.
   */
  const keyRef = useRef(createId());
  useEffect(() => {
    keyRef.current = createId();
  }, [signature]);

  const conflictItem = serverError?.conflictProductId
    ? items.find((item) => item.productId === serverError.conflictProductId)
    : undefined;

  const focusFirstError = (errors: Record<string, string>): void => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    const fieldId = CHECKOUT_FIELD_IDS[firstKey];
    if (fieldId) document.getElementById(fieldId)?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isLoading) return;

    const localErrors = validateContact(contact);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setServerError(null);
      focusFirstError(localErrors);
      return;
    }

    setFieldErrors({});
    setServerError(null);

    try {
      const order = await createOrder({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        contact,
        idempotencyKey: keyRef.current,
      }).unwrap();

      dispatch(clearCart());
      toast.push(`Order ${order.id} placed`, 'success');
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (error) {
      const appError = normalizeError(error);
      setServerError(appError);
      // Only 400 responses carry field-level copy; 409 details describe the product,
      // not a form field, so they belong in the banner.
      const mapped =
        appError.kind === 'bad_request'
          ? Object.fromEntries(
              Object.entries(appError.fieldErrors ?? {}).filter(
                ([key]) => key in CHECKOUT_FIELD_IDS,
              ),
            )
          : {};
      setFieldErrors(mapped);
      if (Object.keys(mapped).length > 0) focusFirstError(mapped);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container">
        <div className="page-head">
          <h1 className="page-title">Checkout</h1>
        </div>
        <ErrorState
          error={{ kind: 'bad_request', status: 400, code: 'EMPTY_CART', message: 'Cart is empty' }}
          title="There is nothing to check out"
          description="Add something to the cart first, then come back. Your cart is saved in this browser."
        />
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn btn-primary" to="/">
            Browse the shelves
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Step 2 of 2</p>
          <h1 className="page-title">Checkout</h1>
          <p className="page-sub">
            Signed in as {user?.email ?? 'a guest'} · nothing is charged in this demo
          </p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/cart">
          Back to cart
        </Link>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Where should it go?</h2>
            <span className="pill">
              <LockIcon size={12} aria-hidden="true" /> Mock checkout
            </span>
          </div>

          {serverError && Object.keys(fieldErrors).length === 0 ? (
            <div className="form-error" role="alert">
              <AlertIcon size={18} aria-hidden="true" />
              <div>
                <p>{checkoutMessage(serverError, conflictItem?.name)}</p>
                {serverError.kind === 'conflict' ? (
                  <p style={{ fontWeight: 500, marginTop: 6 }}>
                    {conflictItem ? (
                      <>
                        <Link to="/cart">Update the cart</Link> — {conflictItem.name} has{' '}
                        {conflictItem.quantity} in your cart but no longer enough stock.
                      </>
                    ) : null}
                  </p>
                ) : null}
                {serverError.kind === 'server' ? (
                  <p style={{ fontWeight: 500, marginTop: 6 }}>
                    Pressing “Place order” again sends the same idempotency key, so it cannot
                    double-charge you.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="contact-name">Full name</label>
            <input
              id="contact-name"
              className="input"
              name="name"
              autoComplete="name"
              value={contact.name}
              onChange={(event) => {
                setContact((current) => ({ ...current, name: event.target.value }));
                setFieldErrors((current) => ({ ...current, 'contact.name': '' }));
              }}
              aria-invalid={Boolean(fieldErrors['contact.name'])}
              aria-describedby={fieldErrors['contact.name'] ? 'contact-name-error' : undefined}
              placeholder="Ada Lovelace"
            />
            {fieldErrors['contact.name'] ? (
              <p className="field-error" id="contact-name-error" role="alert">
                <AlertIcon size={14} aria-hidden="true" />
                {fieldErrors['contact.name']}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="contact-email">Delivery email</label>
            <input
              id="contact-email"
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={contact.email}
              onChange={(event) => {
                setContact((current) => ({ ...current, email: event.target.value }));
                setFieldErrors((current) => ({ ...current, 'contact.email': '' }));
              }}
              aria-invalid={Boolean(fieldErrors['contact.email'])}
              aria-describedby={
                fieldErrors['contact.email'] ? 'contact-email-error' : 'contact-email-hint'
              }
              placeholder="you@example.com"
            />
            {fieldErrors['contact.email'] ? (
              <p className="field-error" id="contact-email-error" role="alert">
                <AlertIcon size={14} aria-hidden="true" />
                {fieldErrors['contact.email']}
              </p>
            ) : (
              <p className="field-hint" id="contact-email-hint">
                Order updates go here. We do not send marketing email.
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? 'Placing order…' : `Place order · ${formatCents(subtotal)}`}
          </button>

          <p className="field-hint">
            By placing this order you agree that the bazaar may keep a duck for itself. Retrying a
            failed checkout reuses the same idempotency key.
          </p>
        </form>

        <aside className="cart-summary" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary">In this order</h2>
          <ul className="order-mini">
            {items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.name} <span className="qty-note">× {item.quantity}</span>
                </span>
                <span className="mono">{formatCents(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row" style={{ marginTop: 12 }}>
            <span>Items</span>
            <span className="mono">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span className="mono">Free</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>{formatCents(subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function checkoutMessage(error: AppError, itemName?: string): string {
  switch (error.kind) {
    case 'conflict':
      return itemName
        ? `${itemName} just sold out at that quantity.`
        : 'One of your items just sold out.';
    case 'server':
      return 'Our stockroom hit an error. Your order may already exist — retry and we will return the same order instead of creating another.';
    case 'network':
      return "We couldn't reach the bazaar. Check your connection and retry.";
    default:
      return messageFor(error);
  }
}
