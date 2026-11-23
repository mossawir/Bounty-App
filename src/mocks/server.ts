import { queryProducts } from '@/lib/format';
import type {
  ApiErrorBody,
  OrderDetail,
  OrderLine,
  ProductQuery,
  SortOption,
  User,
} from '@/types/domain';
import { SORT_OPTIONS } from '@/types/domain';
import { consumeFailure, db, getChaos, issueToken, revokeToken, userForToken } from './db';

export interface MockRequest {
  method: 'GET' | 'POST';
  path: string;
  query: URLSearchParams;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

class AbortError extends Error {
  constructor() {
    super('Request aborted');
    this.name = 'AbortError';
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new AbortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function fail(status: number, code: string, message: string, details?: Record<string, string>) {
  const payload: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return { status, body: payload };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let searchCallCount = 0;

function parseProductQuery(query: URLSearchParams): ProductQuery {
  const sortParam = query.get('sort');
  const page = Number(query.get('page') ?? '1');
  const pageSize = Number(query.get('pageSize') ?? '24');
  return {
    search: query.get('search') ?? '',
    category: (query.get('category') ?? 'all') as ProductQuery['category'],
    inStock: query.get('inStock') === 'true',
    sort: (SORT_OPTIONS.includes(sortParam as SortOption) ? sortParam : 'featured') as SortOption,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 24,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateOrderBody(body: unknown): {
  items: OrderLine[];
  contact: { name: string; email: string };
  idempotencyKey: string;
  details: Record<string, string>;
} {
  const details: Record<string, string> = {};
  const record = isRecord(body) ? body : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: OrderLine[] = [];

  if (rawItems.length === 0) {
    details.items = 'Your cart is empty.';
  }

  rawItems.forEach((raw, index) => {
    if (!isRecord(raw)) {
      details[`items.${index}`] = 'That cart line is not valid.';
      return;
    }
    const productId = typeof raw.productId === 'string' ? raw.productId : '';
    const quantity = typeof raw.quantity === 'number' ? raw.quantity : Number.NaN;
    if (!db.findProduct(productId)) {
      details[`items.${index}`] = 'That product is no longer for sale.';
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      details[`items.${index}`] = 'Choose at least one.';
      return;
    }
    items.push({ productId, quantity });
  });

  const contact = isRecord(record.contact) ? record.contact : {};
  const name = typeof contact.name === 'string' ? contact.name.trim() : '';
  const email = typeof contact.email === 'string' ? contact.email.trim() : '';
  if (name.length < 2) details['contact.name'] = 'Tell us who the parcel is for.';
  if (!EMAIL_PATTERN.test(email)) details['contact.email'] = 'Enter a valid email address.';

  const idempotencyKey =
    typeof record.idempotencyKey === 'string' ? record.idempotencyKey.trim() : '';
  if (idempotencyKey.length < 8) {
    details.idempotencyKey = 'A checkout attempt needs a stable idempotency key.';
  }

  return { items, contact: { name, email }, idempotencyKey, details };
}

function serialiseOrder(order: OrderDetail): OrderDetail {
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt,
  };
}

function publicUser(user: User): User {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * In-browser implementation of the shared API contract.
 * Every route, status code and error body documented in docs/api-contract.md lands here.
 */
export async function handleMockRequest(request: MockRequest): Promise<MockResponse> {
  const chaos = getChaos();
  const base = chaos.latencyMs + Math.random() * chaos.jitterMs;
  const isProductSearch = request.path === '/api/products';
  const batching = isProductSearch && chaos.outOfOrder && searchCallCount % 2 === 0;
  searchCallCount += 1;
  await sleep(base + (batching ? chaos.latencyMs + 600 : 0), request.signal);

  const path = request.path;

  /* ---------------------------------------------------------------- products */
  if (request.method === 'GET' && path === '/api/products') {
    const forced = consumeFailure('products');
    if (forced) return fail(forced, 'PRODUCTS_UNAVAILABLE', 'The shelves are out of reach.');
    if (chaos.emptyProducts) return { status: 200, body: { items: [], total: 0 } };

    const result = queryProducts(db.products, parseProductQuery(request.query));
    return { status: 200, body: result };
  }

  const productMatch = /^\/api\/products\/([^/]+)$/.exec(path);
  if (request.method === 'GET' && productMatch) {
    const forced = consumeFailure('product');
    if (forced) return fail(forced, 'PRODUCT_UNAVAILABLE', 'That item could not be loaded.');
    const product = db.findProduct(decodeURIComponent(productMatch[1] ?? ''));
    if (!product) {
      return fail(404, 'PRODUCT_NOT_FOUND', 'No product with that id.');
    }
    return { status: 200, body: product };
  }

  /* ------------------------------------------------------------------- auth */
  if (request.method === 'POST' && path === '/api/login') {
    const forced = consumeFailure('login');
    if (forced) {
      return fail(forced, 'LOGIN_FAILED', 'Sign in is temporarily unavailable.');
    }
    const body = isRecord(request.body) ? request.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const details: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email)) details.email = 'Enter a valid email address.';
    if (password.length < 6) details.password = 'Passwords are at least 6 characters.';
    if (Object.keys(details).length > 0) {
      return fail(400, 'VALIDATION_FAILED', 'Check the highlighted fields.', details);
    }

    const user = db.users.find((candidate) => candidate.email.toLowerCase() === email);
    if (!user || user.password !== password) {
      return fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    return {
      status: 200,
      body: { token: issueToken(user.id), user: publicUser(user) },
    };
  }

  if (request.method === 'GET' && path === '/api/me') {
    const forced = consumeFailure('me');
    if (forced) return fail(forced, 'SESSION_UNAVAILABLE', 'Could not check your session.');
    const user = userForToken(request.token);
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return { status: 200, body: publicUser(user) };
  }

  if (request.method === 'POST' && path === '/api/logout') {
    revokeToken(request.token);
    return { status: 204, body: null };
  }

  /* ----------------------------------------------------------------- orders */
  if (request.method === 'POST' && path === '/api/orders') {
    const forced = consumeFailure('orders');
    if (forced) return fail(forced, 'ORDER_FAILED', 'The order service did not respond.');

    const user = userForToken(request.token);
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Sign in before checking out.');

    const { items, idempotencyKey, details } = validateOrderBody(request.body);
    if (Object.keys(details).length > 0) {
      return fail(400, 'VALIDATION_FAILED', 'Check the highlighted fields.', details);
    }

    const existingId = db.orderIdByKey.get(`${user.id}:${idempotencyKey}`);
    if (existingId) {
      const existing = db.orders.get(existingId);
      if (existing) {
        return { status: 201, body: serialiseOrder(existing) };
      }
    }

    // Stock can change between the cart screen and this request.
    const requested = new Map<string, number>();
    for (const line of items) {
      requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.quantity);
    }
    for (const [productId, quantity] of requested) {
      const product = db.findProduct(productId);
      if (!product) {
        return fail(400, 'VALIDATION_FAILED', 'An item is no longer for sale.', {
          items: 'One of your items is no longer for sale.',
        });
      }
      if (product.stock < quantity) {
        return fail(409, 'OUT_OF_STOCK', 'Not enough stock for one of your items.', {
          productId,
          productName: product.name,
          available: String(product.stock),
          requested: String(quantity),
        });
      }
    }

    const orderItems = items.map((line) => {
      const product = db.findProduct(line.productId);
      return {
        productId: line.productId,
        quantity: line.quantity,
        name: product?.name ?? 'Unknown item',
        price: product?.price ?? 0,
        imageUrl: product?.imageUrl ?? '',
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const id = db.nextOrderId();
    const order: OrderDetail = {
      id,
      status: 'queued',
      items: orderItems,
      total,
      createdAt: new Date().toISOString(),
    };

    db.orders.set(id, {
      ...order,
      userId: user.id,
      idempotencyKey,
    });
    db.orderIdByKey.set(`${user.id}:${idempotencyKey}`, id);
    for (const [productId, quantity] of requested) {
      db.decrementStock(productId, quantity);
    }

    // Demonstrates why retries need idempotency: the order committed, the response did not.
    if (chaos.failOrdersAfterCommit) {
      return fail(500, 'ORDER_COMMIT_RESPONSE_LOST', `Order ${id} was created.`);
    }

    return { status: 201, body: serialiseOrder(order) };
  }

  const orderMatch = /^\/api\/orders\/([^/]+)$/.exec(path);
  if (request.method === 'GET' && orderMatch) {
    const forced = consumeFailure('order');
    if (forced) return fail(forced, 'ORDER_UNAVAILABLE', 'That order could not be loaded.');
    const user = userForToken(request.token);
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Sign in to view this order.');
    const order = db.orders.get(decodeURIComponent(orderMatch[1] ?? ''));
    if (!order || order.userId !== user.id) {
      return fail(404, 'ORDER_NOT_FOUND', 'No order with that id.');
    }
    return { status: 200, body: serialiseOrder(order) };
  }

  return fail(404, 'ROUTE_NOT_FOUND', `No mock route for ${request.method} ${path}.`);
}

/** Test helper: pretend stock changed on the server. */
export function emitStockChange(productId: string, stock: number): void {
  db.setStock(productId, stock);
}

/** Test helper: read the number of orders currently stored. */
export function orderCount(): number {
  return db.orders.size;
}
