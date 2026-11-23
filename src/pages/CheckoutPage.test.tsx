import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { renderWithProviders } from '@/test/utils';
import { db, DEMO_USER, setChaos } from '@/mocks/db';
import { orderCount } from '@/mocks/server';
import type { CartItem } from '@/features/cart/cartSlice';
import type { Product } from '@/types/domain';

const user = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  name: DEMO_USER.name,
};

const token = `bb.${DEMO_USER.id}.test-token`;

let product: Product;

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    category: product.category,
    stock: product.stock,
    quantity: 2,
    ...overrides,
  };
}

function setup(items: CartItem[] = [cartItem()]) {
  return renderWithProviders(<CheckoutPage />, {
    route: '/checkout',
    preloaded: {
      cart: { items },
      auth: { token, user },
    },
  });
}

beforeEach(() => {
  const candidate = db.products.find((entry) => entry.stock > 8);
  if (!candidate) throw new Error('catalogue has no well-stocked product');
  product = candidate;
});

describe('CheckoutPage', () => {
  it('places an order, clears the cart and sends the shopper to the confirmation', async () => {
    const userEventApi = userEvent.setup();
    const { store } = setup();

    await userEventApi.click(screen.getByRole('button', { name: /Place order/ }));

    await waitFor(() => expect(store.getState().cart.items).toHaveLength(0));
    expect(orderCount()).toBe(1);
    expect(await screen.findByText(/Order ord_\d+ placed/)).toBeInTheDocument();
  });

  it('surfaces a 409 that names the item and keeps the cart intact', async () => {
    const userEventApi = userEvent.setup();
    const { store } = setup();

    // Stock drops after the cart was filled — the classic race.
    db.setStock(product.id, 1);

    await userEventApi.click(screen.getByRole('button', { name: /Place order/ }));

    expect(
      await screen.findByText(`${product.name} just sold out at that quantity.`),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Update the cart/);
    expect(store.getState().cart.items).toHaveLength(1);
    expect(orderCount()).toBe(0);
  });

  it('retries with the same idempotency key and never creates a second order', async () => {
    const userEventApi = userEvent.setup();
    const { store } = setup();

    // The order commits, then the response is lost: the worst-case retry scenario.
    setChaos({ failOrdersAfterCommit: true });

    await userEventApi.click(screen.getByRole('button', { name: /Place order/ }));
    expect(await screen.findByText(/may already exist/)).toBeInTheDocument();
    expect(orderCount()).toBe(1);

    setChaos({ failOrdersAfterCommit: false });
    await userEventApi.click(screen.getByRole('button', { name: /Place order/ }));

    await waitFor(() => expect(store.getState().cart.items).toHaveLength(0));
    expect(orderCount()).toBe(1);
  });

  it('cannot create two orders when the form is submitted twice in one tick', async () => {
    const { store } = setup();
    const form = screen.getByRole('button', { name: /Place order/ }).closest('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(store.getState().cart.items).toHaveLength(0));
    expect(orderCount()).toBe(1);
  });

  it('validates contact fields before calling the API and focuses the first problem', async () => {
    const userEventApi = userEvent.setup();
    setup();

    const name = screen.getByLabelText('Full name');
    await userEventApi.clear(name);
    await userEventApi.click(screen.getByRole('button', { name: /Place order/ }));

    expect(
      await screen.findByText('Tell us who the parcel is for (at least 2 characters).'),
    ).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(orderCount()).toBe(0);
  });
});
