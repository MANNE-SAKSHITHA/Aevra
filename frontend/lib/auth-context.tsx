"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiError, User } from "./api";

const STORAGE_KEY = "aevra.auth";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  login: (fullName: string, password: string) => Promise<void>;
  register: (fullName: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on first load.
  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const stored: StoredAuth = JSON.parse(raw);
      api
        .me(stored.accessToken)
        .then((u) => {
          setUser(u);
          setAccessToken(stored.accessToken);
        })
        .catch(() => {
          window.localStorage.removeItem(STORAGE_KEY);
        })
        .finally(() => setLoading(false));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, []);

  const persist = (tokens: StoredAuth) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  };

  const login = useCallback(async (fullName: string, password: string) => {
    setError(null);
    try {
      const tokens = await api.login(fullName, password);
      const u = await api.me(tokens.access_token);
      persist({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      setAccessToken(tokens.access_token);
      setUser(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      throw err;
    }
  }, []);

  const register = useCallback(
    async (fullName: string, password: string) => {
      setError(null);
      try {
        await api.register({ full_name: fullName, password });
        await login(fullName, password);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        throw err;
      }
    },
    [login]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, error, login, register, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
