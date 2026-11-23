# API contract

This is the contract from the brief, plus the few fields this implementation adds. Prices are
**always integer cents**; only the render edge converts them to dollars (`formatCents`).

The mock server lives in [`src/mocks/server.ts`](../src/mocks/server.ts) and every route below can
be exercised without a backend. Swapping in a real API means setting `VITE_API_BASE_URL` — the
client, store and components do not change.

## Base URL

| Mode         | Base                     |
| ------------ | ------------------------ |
| Default      | `/api` (in-browser mock) |
| Real backend | `VITE_API_BASE_URL`      |

## Types

```ts
type Product = {
  id: string;
  name: string;
  price: number; // cents
  category: 'keyboards' | 'ducks' | 'coffee' | 'stickers';
  stock: number;
  rating: number;
  imageUrl: string;
};

type ApiError = {
  error: {
    code: string;
    message: string; // diagnostics only; never rendered verbatim
    details?: Record<string, string>;
  };
};
```

## Endpoints

### `GET /api/products`

| Query      | Type                                                                     | Default    | Notes                                         |
| ---------- | ------------------------------------------------------------------------ | ---------- | --------------------------------------------- |
| `search`   | string                                                                   | `''`       | case-insensitive match on name + category     |
| `category` | `keyboards` \| `ducks` \| `coffee` \| `stickers` \| `all`                | `all`      | unknown values fall back to `all`             |
| `inStock`  | `true` \| `false`                                                        | `false`    | drops `stock <= 0`                            |
| `sort`     | `featured` \| `price-asc` \| `price-desc` \| `rating-desc` \| `name-asc` | `featured` | invalid values fall back                      |
| `page`     | integer ≥ 1                                                              | `1`        |                                               |
| `pageSize` | integer 1–5000                                                           | `24`       | **extension**; the browse grid asks for 5,000 |

**200**

```json
{
  "items": [{ "id": "p-0001", "name": "Sprint Blend — Ground 250g", "price": 2199, "...": "..." }],
  "total": 5000
}
```

`total` is the count **after filtering**, before pagination. `featured` means catalogue order
(curated), not a rating sort.

**500** `{ "error": { "code": "PRODUCTS_UNAVAILABLE", "message": "..." } }`

### `GET /api/products/:id`

- **200** `Product`
- **404** `PRODUCT_NOT_FOUND`

### `POST /api/login`

```json
{ "email": "demo@bugbazaar.dev", "password": "bazaar123" }
```

- **200** `{ "token": "bb.u-1001.…", "user": { "id": "u-1001", "email": "...", "name": "..." } }`
- **400** `VALIDATION_FAILED` with `details: { email?, password? }`
- **401** `INVALID_CREDENTIALS`

### `GET /api/me`

Requires `Authorization: Bearer <token>` (the mock reads a token passed by the client).

- **200** `User`
- **401** `UNAUTHENTICATED`

### `POST /api/logout` — extension

- **204** no body. Revokes the token in the mock session table.

### `POST /api/orders`

```json
{
  "items": [{ "productId": "p-0001", "quantity": 2 }],
  "contact": { "name": "Demo Shopper", "email": "demo@bugbazaar.dev" },
  "idempotencyKey": "0f1c2d7e-…"
}
```

`contact` and `idempotencyKey` are **extensions**. The contract fixes the success/error shapes;
the body shape was ours to design. `contact` exists so a real 400 with field errors can be
demonstrated, and `idempotencyKey` is what makes retries safe.

- **201** `{ "id": "ord_00001", "status": "queued", "items": [...], "total": 4398, "createdAt": "..." }`
  (the documented `{ id, status }` plus the lines needed by the confirmation screen)
- **400** `VALIDATION_FAILED` with `details` keyed by field (`items`, `contact.name`, …)
- **401** `UNAUTHENTICATED`
- **409** `OUT_OF_STOCK` with
  `details: { productId, productName, available, requested }` — this is what the cart screen uses to
  name the item that ran out
- **500** `ORDER_COMMIT_RESPONSE_LOST` (only when the bug lab's "500 after commit" switch is on):
  the order **was created**. Retrying with the same key returns the same order.

Idempotency rule: `(userId, idempotencyKey)` is unique. A repeat returns `201` with the original
order id and does not touch stock again. See [`orders.md`](./orders.md).

### `GET /api/orders/:id`

- **200** `OrderDetail` (`{ id, status, items, total, createdAt }`)
- **401** `UNAUTHENTICATED`
- **404** `ORDER_NOT_FOUND` — also returned for another user's order, so ids do not leak

## Status codes actually implemented

| Code | When                                        |
| ---- | ------------------------------------------- |
| 200  | list, product, login, me, order lookup      |
| 201  | order created (and idempotent replay)       |
| 204  | logout                                      |
| 400  | malformed login or order body               |
| 401  | missing/expired session, wrong password     |
| 404  | unknown product, unknown order, wrong owner |
| 409  | requested quantity exceeds stock            |
| 500  | forced failure (see below)                  |

## Triggering each error on purpose

Every error can be produced without editing code:

- **500 on the list** — Bug lab → “List → 500 error”, or `?` any search after enabling it.
- **404 on details** — visit `/products/nope`.
- **400 on login** — submit an invalid email or a password under 6 characters.
- **401 on login** — wrong password. **401 on any protected call** — sign out in another tab.
- **409 on checkout** — put the last units of an item in the cart, open the bug lab and press
  **“Sell out cart item → 409”** (it lowers that product's real shelf stock below your quantity), then
  place the order. The banner names the item and links back to the cart.
- **500 after commit** — Bug lab → “500 after commit”, then place an order and retry it.
- **Empty state** — search for `zzzzzzz`, or toggle “Empty results”.
- **Out-of-order search** — toggle “Out-of-order search” and type quickly.

The bug lab is dev-only (`import.meta.env.DEV`) and can be forced in a production build with
`VITE_ENABLE_DEVTOOLS=true`.

## Contract tests

[`src/api/mockServer.test.ts`](../src/api/mockServer.test.ts) asserts the shapes, status codes,
field errors, the 409 details and the idempotent replay. Those tests run on every PR.
