import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError, type UserProfile } from "../api";
import { clearSavedTrips } from "../utils/offlineTrips";

export interface GuestUser {
  isGuest: true;
  username: string;
  id: 'guest';
  xp_points: 0;
  level: string;
}

interface AuthState {
  user: UserProfile | GuestUser | null;
  token: string | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, username: string) => Promise<{ requiresVerification: true }>;
  loginWithToken: (token: string) => Promise<void>;
  loginAsGuest: () => void;
  upgradeGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'router_auth_token';
const REFRESH_KEY = 'router_refresh_token';
const GUEST_KEY = 'router_guest_mode';
/** Last profile the server returned, so a signed-in user stays signed in with no connection. */
const CACHED_USER_KEY = 'router_cached_user';
const GUEST_USER: GuestUser = { isGuest: true, username: 'אורח', id: 'guest', xp_points: 0, level: 'אורח' };

function readCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isLoggedIn: false, isGuest: false, isLoading: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    const isGuest = localStorage.getItem(GUEST_KEY) === 'true';

    if (stored) {
      api.auth.me(stored)
        .then(user => setState({ user, token: stored, isLoggedIn: true, isGuest: false, isLoading: false }))
        .catch((err) => {
          // Only a real rejection ends the session. A network error (offline in the field) or a
          // 5xx keeps the token and uses the last profile we saw, so saved trips still open.
          const rejected = err instanceof ApiError && (err.status === 401 || err.status === 403);
          const cached = rejected ? null : readCachedUser();
          if (cached) {
            setState({ user: cached, token: stored, isLoggedIn: true, isGuest: false, isLoading: false });
            return;
          }
          localStorage.removeItem(TOKEN_KEY);
          if (isGuest) {
            setState({ user: GUEST_USER, token: null, isLoggedIn: false, isGuest: true, isLoading: false });
          } else {
            setState(s => ({ ...s, isLoading: false }));
          }
        });
    } else if (isGuest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ user: GUEST_USER, token: null, isLoggedIn: false, isGuest: true, isLoading: false });
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    if (!state.isLoggedIn || !state.user || 'isGuest' in state.user) return;
    try { localStorage.setItem(CACHED_USER_KEY, JSON.stringify(state.user)); } catch { /* storage blocked */ }
  }, [state.isLoggedIn, state.user]);

  const login = useCallback(async (email: string, password: string) => {
    const { user, token, refresh_token } = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, token); // NOSONAR S5808 — JWT stored in localStorage by design
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token); // NOSONAR S5808
    localStorage.removeItem(GUEST_KEY);
    setState({ user, token, isLoggedIn: true, isGuest: false, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, username: string) => {
    return await api.auth.register(email, password, fullName, username);
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token); // NOSONAR S5808
    localStorage.removeItem(GUEST_KEY);
    const user = await api.auth.me(token);
    setState({ user, token, isLoggedIn: true, isGuest: false, isLoading: false });
  }, []);

  const loginAsGuest = useCallback(() => {
    localStorage.setItem(GUEST_KEY, 'true');
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: GUEST_USER, token: null, isLoggedIn: false, isGuest: true, isLoading: false });
  }, []);

  const upgradeGuest = useCallback(() => {
    localStorage.removeItem(GUEST_KEY);
    setState({ user: null, token: null, isLoggedIn: false, isGuest: false, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
    clearSavedTrips();
    setState({ user: null, token: null, isLoggedIn: false, isGuest: false, isLoading: false });
  }, []);

  const value = useMemo(
    () => ({ ...state, login, register, loginWithToken, loginAsGuest, upgradeGuest, logout }),
    [state, login, register, loginWithToken, loginAsGuest, upgradeGuest, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
