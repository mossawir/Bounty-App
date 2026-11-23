import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface RealtimeState {
  status: SocketStatus;
  /** Latest stock per product, overlaid on server data at render time. */
  overrides: Record<string, number>;
  reconnects: number;
  lastTickAt: number | null;
}

const initialState: RealtimeState = {
  status: 'closed',
  overrides: {},
  reconnects: 0,
  lastTickAt: null,
};

export const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    statusChanged(state, action: PayloadAction<SocketStatus>) {
      if (state.status !== 'open' && action.payload === 'open' && state.lastTickAt !== null) {
        state.reconnects += 1;
      }
      state.status = action.payload;
    },
    stockTick(state, action: PayloadAction<{ productId: string; stock: number }>) {
      state.overrides[action.payload.productId] = action.payload.stock;
      state.lastTickAt = Date.now();
    },
    resetRealtime: () => initialState,
  },
});

export const { statusChanged, stockTick, resetRealtime } = realtimeSlice.actions;
export const realtimeReducer = realtimeSlice.reducer;

type RealtimeSliceState = { realtime: RealtimeState };

export const selectSocketStatus = (state: RealtimeSliceState): SocketStatus =>
  state.realtime.status;
export const selectStockOverrides = (state: RealtimeSliceState): Record<string, number> =>
  state.realtime.overrides;
export const selectRealtimeInfo = (state: RealtimeSliceState): RealtimeState => state.realtime;
