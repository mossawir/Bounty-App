import { db } from '@/mocks/db';
import type { SocketStatus } from '@/features/realtime/realtimeSlice';

export interface StockTick {
  productId: string;
  stock: number;
}

type TickListener = (tick: StockTick) => void;
type StatusListener = (status: SocketStatus) => void;

/**
 * Stand-in for a WebSocket server. The contract is the same one a real socket
 * would expose (connect, subscribe, status, reconnect with backoff), so swapping
 * this class for `new WebSocket(...)` is a one-file change.
 */
export class StockSocket {
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private tickListeners = new Set<TickListener>();
  private statusListeners = new Set<StatusListener>();
  private status: SocketStatus = 'closed';
  private focusIds: string[] = [];
  private attempt = 0;
  private ticksSinceConnect = 0;

  getStatus(): SocketStatus {
    return this.status;
  }

  subscribe(listener: { onTick?: TickListener; onStatus?: StatusListener }): () => void {
    if (listener.onTick) this.tickListeners.add(listener.onTick);
    if (listener.onStatus) this.statusListeners.add(listener.onStatus);
    return () => {
      if (listener.onTick) this.tickListeners.delete(listener.onTick);
      if (listener.onStatus) this.statusListeners.delete(listener.onStatus);
    };
  }

  /** The grid calls this with the ids currently on screen, so ticks stay relevant. */
  setFocus(ids: string[]): void {
    this.focusIds = ids.slice(0, 60);
  }

  connect(): void {
    if (this.status === 'connecting' || this.status === 'open' || this.status === 'reconnecting') {
      return;
    }
    this.setStatus('connecting');
    this.statusTimer = setTimeout(() => this.open(), 320);
  }

  close(): void {
    this.clearTimers();
    this.attempt = 0;
    this.setStatus('closed');
  }

  /** Demo control: pretend the network dropped. */
  forceDrop(): void {
    if (this.status === 'open') this.drop();
  }

  private clearTimers(): void {
    if (this.tickTimer !== null) clearTimeout(this.tickTimer);
    if (this.statusTimer !== null) clearTimeout(this.statusTimer);
    this.tickTimer = null;
    this.statusTimer = null;
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private open(): void {
    this.setStatus('open');
    this.attempt = 0;
    this.ticksSinceConnect = 0;
    this.scheduleTick();
  }

  private scheduleTick(): void {
    const delay = 1300 + Math.random() * 2100;
    this.tickTimer = setTimeout(() => {
      if (this.status !== 'open') return;
      this.ticksSinceConnect += 1;
      // Roughly one disconnect every ~25 ticks so recovery is demonstrable.
      if (Math.random() < 0.04 && this.ticksSinceConnect > 4) {
        this.drop();
        return;
      }
      this.emitTick();
      this.scheduleTick();
    }, delay);
  }

  private emitTick(): void {
    const candidates = this.focusIds.length > 0 && Math.random() < 0.7 ? this.focusIds : [];
    const productId =
      candidates.length > 0
        ? (candidates[Math.floor(Math.random() * candidates.length)] ?? '')
        : (db.products[Math.floor(Math.random() * db.products.length)]?.id ?? '');

    const product = db.findProduct(productId);
    if (!product) return;

    const restock = Math.random() < 0.22;
    const nextStock = restock
      ? Math.floor(12 + Math.random() * 28)
      : Math.max(0, product.stock - Math.floor(1 + Math.random() * 3));

    if (nextStock === product.stock) return;
    db.setStock(productId, nextStock);
    const tick: StockTick = { productId, stock: nextStock };
    this.tickListeners.forEach((listener) => listener(tick));
  }

  private drop(): void {
    this.clearTimers();
    this.setStatus('reconnecting');
    this.attempt += 1;
    const backoff = Math.min(600 * 2 ** (this.attempt - 1), 6000);
    this.statusTimer = setTimeout(() => this.open(), backoff);
  }
}

/** One socket per tab, shared by whatever is mounted. */
export const stockSocket = new StockSocket();
