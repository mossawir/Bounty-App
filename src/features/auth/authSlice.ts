import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types/domain';

export interface AuthState {
  token: string | null;
  user: User | null;
  /** Copy shown after a forced sign-out, e.g. a 401 from any endpoint. */
  notice: string | null;
}

const initialState: AuthState = { token: null, user: null, notice: null };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.notice = null;
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      state.notice = null;
    },
    /** Any 401 lands here: there is exactly one way a session ends. */
    sessionExpired(state) {
      const wasSignedIn = Boolean(state.token);
      state.token = null;
      state.user = null;
      state.notice = wasSignedIn ? 'Your session ended. Sign in again to continue.' : null;
    },
    clearNotice(state) {
      state.notice = null;
    },
    /** Restore a persisted session after the store is created. */
    hydrateSession(state, action: PayloadAction<{ token: string | null; user: User | null }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.notice = null;
    },
  },
});

export const { signedIn, signedOut, sessionExpired, clearNotice, hydrateSession } =
  authSlice.actions;
export const authReducer = authSlice.reducer;

type AuthSliceState = { auth: AuthState };

export const selectAuth = (state: AuthSliceState): AuthState => state.auth;
export const selectUser = (state: AuthSliceState): User | null => state.auth.user;
export const selectToken = (state: AuthSliceState): string | null => state.auth.token;
export const selectIsAuthenticated = (state: AuthSliceState): boolean => Boolean(state.auth.token);
export const selectAuthNotice = (state: AuthSliceState): string | null => state.auth.notice;
