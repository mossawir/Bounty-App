import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { statusChanged, stockTick } from '@/features/realtime/realtimeSlice';
import { stockSocket } from '@/realtime/stockSocket';

/** Connect the live stock feed once per app, and tear it down on unmount. */
export function useStockFeed(enabled = true): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!enabled || import.meta.env.MODE === 'test') return;

    const unsubscribe = stockSocket.subscribe({
      onStatus: (status) => dispatch(statusChanged(status)),
      onTick: (tick) => dispatch(stockTick(tick)),
    });
    stockSocket.connect();
    dispatch(statusChanged(stockSocket.getStatus()));

    return () => {
      unsubscribe();
      stockSocket.close();
    };
  }, [dispatch, enabled]);
}

/** Tell the socket which products are on screen, so updates feel live. */
export function useStockFocus(productIds: string[]): void {
  const key = productIds.join(',');

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const ids = key ? key.split(',') : [];
    stockSocket.setFocus(ids);
  }, [key]);
}
