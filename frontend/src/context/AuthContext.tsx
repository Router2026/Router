import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type UserProfile } from '../api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    username: string
  ) => Promise<{ requiresVerification: true }>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'router_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      api.auth
        .me(stored)
        .then((user) => setState({ user, token: stored, isLoggedIn: true, isLoading: false }))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setState((s) => ({ ...s, isLoading: false }));
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setState({ user, token, isLoggedIn: true, isLoading: false });
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string, username: string) => {
      return await api.auth.register(email, password, fullName, username);
    },
    []
  );

  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    const user = await api.auth.me(token);
    setState({ user, token, isLoggedIn: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, token: null, isLoggedIn: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithToken, logout }}>
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
