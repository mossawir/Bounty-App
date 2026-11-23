/**
 * Types that mirror the shared API contract from the brief.
 * Anything sent over the wire is declared here once and imported everywhere else.
 */

export const CATEGORIES = ['keyboards', 'ducks', 'coffee', 'stickers'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  id: string;
  name: string;
  /** Price in cents. Formatting to dollars happens only at the render edge. */
  price: number;
  category: Category;
  stock: number;
  rating: number;
  imageUrl: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export const SORT_OPTIONS = [
  'featured',
  'price-asc',
  'price-desc',
  'rating-desc',
  'name-asc',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface ProductQuery {
  search?: string;
  category?: Category | 'all';
  inStock?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OrderLine {
  productId: string;
  quantity: number;
}

/** Extension to the contract: `contact` lets the mock return real 400 field errors. */
export interface OrderContact {
  name: string;
  email: string;
}

export interface CreateOrderRequest {
  items: OrderLine[];
  contact: OrderContact;
  /** Retrying with the same key must never create a second order. */
  idempotencyKey: string;
}

export type OrderStatus = 'queued' | 'packing' | 'shipped';

export interface OrderSummary {
  id: string;
  status: OrderStatus;
}

export interface OrderItem extends OrderLine {
  name: string;
  price: number;
  imageUrl: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  total: number;
  createdAt: string;
}

export type ErrorKind =
  'network' | 'bad_request' | 'unauthorized' | 'not_found' | 'conflict' | 'server' | 'unknown';

/**
 * Normalised failure shape used by every layer above the transport.
 * `message` is for logs/diagnostics only — screens render copy derived from `kind`.
 */
export interface AppError {
  kind: ErrorKind;
  status: number;
  code: string;
  message: string;
  /** 400 responses: field name -> message, intended to be shown next to the field. */
  fieldErrors?: Record<string, string>;
  /** 409 responses: which product ran out. */
  conflictProductId?: string;
  /** Correlation id echoed by the mock, useful when reading logs. */
  requestId?: string;
}

/**
 * The result of a request as the UI sees it. A discriminated union, so
 * "loading and errored at the same time" or "success with no data" cannot be built.
 */
export type RemoteState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'success'; data: T };
