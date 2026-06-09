import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, type UserProfile } from "../api";

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
const GUEST_KEY = 'router_guest_mode';
const GUEST_USER: GuestUser = { isGuest: true, username: 'אורח', id: 'guest', xp_points: 0, level: 'אורח' };

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
        .catch(() => {
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

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(GUEST_KEY);
    setState({ user, token, isLoggedIn: true, isGuest: false, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, username: string) => {
    return await api.auth.register(email, password, fullName, username);
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
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
    localStorage.removeItem(GUEST_KEY);
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
