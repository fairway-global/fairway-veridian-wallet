import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../index";

export type DashboardUserRole = "admin" | "issuer" | "verifier";
export type DashboardMode = "admin" | "issuer" | "verifier";

export interface DashboardUser {
  id: string;
  issuerId: string;
  issuerCode: string;
  email: string;
  role: DashboardUserRole;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: DashboardUser | null;
}

interface AuthSessionPayload {
  accessToken: string;
  refreshToken: string;
  user: DashboardUser;
}

const STORAGE_KEY = "credential_server_ui_auth_v2";

function loadInitialAuthState(): AuthState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
      };
    }
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
      };
    }
    return parsed;
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }
}

function persistAuthState(state: AuthState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors in constrained environments.
  }
}

const initialState: AuthState = loadInitialAuthState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<AuthSessionPayload>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      persistAuthState(state);
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      persistAuthState(state);
    },
    clearSession: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      persistAuthState(state);
    },
  },
});

export const { clearSession, setAccessToken, setSession } = authSlice.actions;

export const getAuthState = (state: RootState) => state.auth;
export const getCurrentUser = (state: RootState) => state.auth.user;
export const getAccessToken = (state: RootState) => state.auth.accessToken;
export const getRefreshToken = (state: RootState) => state.auth.refreshToken;
export const getIsAuthenticated = (state: RootState) =>
  Boolean(state.auth.accessToken && state.auth.user);
export const getDashboardMode = (state: RootState): DashboardMode =>
  state.auth.user?.role === "admin"
    ? "admin"
    : state.auth.user?.role === "verifier"
      ? "verifier"
      : "issuer";
export const getIsVerifier = (state: RootState) =>
  state.auth.user?.role === "verifier";
export const getIsIssuer = (state: RootState) =>
  state.auth.user?.role === "issuer";
export const getIsAdmin = (state: RootState) => state.auth.user?.role === "admin";

export default authSlice.reducer;
