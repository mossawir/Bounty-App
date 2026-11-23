import type { OrderDetail, Product, User } from '@/types/domain';
import { createCatalog } from './catalog';

export interface DemoUser extends User {
  password: string;
}

export const DEMO_USER: DemoUser = {
  id: 'u-1001',
  email: 'demo@bugbazaar.dev',
  name: 'Demo Shopper',
  password: 'bazaar123',
};

export interface OrderRecord extends OrderDetail {
  userId: string;
  idempotencyKey: string;
}

/** The whole "server" state. Resets between tests through `resetDb()`. */
const products: Product[] = createCatalog(5000);
const pristineStock = new Map(products.map((product) => [product.id, product.stock]));
const orders = new Map<string, OrderRecord>();
const orderIdByKey = new Map<string, string>();
let orderSequence = 0;

export const db = {
  products,
  users: [DEMO_USER] as DemoUser[],
  orders,
  orderIdByKey,
  nextOrderId(): string {
    orderSequence += 1;
    return `ord_${String(orderSequence).padStart(5, '0')}`;
  },
  findProduct(id: string): Product | undefined {
    return products.find((product) => product.id === id);
  },
  decrementStock(id: string, quantity: number): void {
    const product = db.findProduct(id);
    if (!product) return;
    product.stock = Math.max(0, product.stock - quantity);
  },
  setStock(id: string, stock: number): void {
    const product = db.findProduct(id);
    if (!product) return;
    product.stock = Math.max(0, Math.min(999, Math.round(stock)));
  },
};

export function resetDb(): void {
  orders.clear();
  orderIdByKey.clear();
  orderSequence = 0;
  products.forEach((product) => {
    product.stock = pristineStock.get(product.id) ?? product.stock;
  });
  resetChaos();
}

/* ------------------------------------------------------------------ chaos -- */

export type ChaosKey = 'products' | 'product' | 'login' | 'me' | 'orders' | 'order';

export interface ChaosConfig {
  /** Base artificial round-trip time in ms. */
  latencyMs: number;
  jitterMs: number;
  /** Make the next request for a key fail with the given status. */
  failNext: Partial<Record<ChaosKey, number>>;
  /** Commit the order, then return 500 — the classic "did my order go through?" bug. */
  failOrdersAfterCommit: boolean;
  /** Return an empty product list with 200 to force the empty state. */
  emptyProducts: boolean;
  /** Delay the first of two product searches so responses can land out of order. */
  outOfOrder: boolean;
}

const defaultChaos = (): ChaosConfig => ({
  latencyMs: import.meta.env.MODE === 'test' ? 0 : 180,
  jitterMs: import.meta.env.MODE === 'test' ? 0 : 140,
  failNext: {},
  failOrdersAfterCommit: false,
  emptyProducts: false,
  outOfOrder: false,
});

let chaos: ChaosConfig = defaultChaos();
const chaosListeners = new Set<(config: ChaosConfig) => void>();

export function getChaos(): ChaosConfig {
  return chaos;
}

export function setChaos(patch: Partial<ChaosConfig>): ChaosConfig {
  chaos = { ...chaos, ...patch, failNext: { ...chaos.failNext, ...(patch.failNext ?? {}) } };
  chaosListeners.forEach((listener) => listener(chaos));
  return chaos;
}

export function resetChaos(): void {
  chaos = defaultChaos();
  chaosListeners.forEach((listener) => listener(chaos));
}

export function subscribeChaos(listener: (config: ChaosConfig) => void): () => void {
  chaosListeners.add(listener);
  return () => chaosListeners.delete(listener);
}

/** Reads and clears a one-shot failure trigger. */
export function consumeFailure(key: ChaosKey): number | undefined {
  const status = chaos.failNext[key];
  if (status === undefined) return undefined;
  const next = { ...chaos.failNext };
  delete next[key];
  chaos = { ...chaos, failNext: next };
  chaosListeners.forEach((listener) => listener(chaos));
  return status;
}

/* ------------------------------------------------------------------ tokens -- */

const tokens = new Map<string, string>();

export function issueToken(userId: string): string {
  const token = `bb.${userId}.${Math.random().toString(36).slice(2, 12)}`;
  tokens.set(token, userId);
  return token;
}

export function userForToken(token: string | null | undefined): DemoUser | undefined {
  if (!token) return undefined;
  const known = tokens.get(token);
  if (known) return db.users.find((user) => user.id === known);
  // Stateless fallback so a reload does not silently sign the demo user out.
  const [, userId] = token.split('.');
  return db.users.find((user) => user.id === userId);
}

export function revokeToken(token: string | null | undefined): void {
  if (token) tokens.delete(token);
}
