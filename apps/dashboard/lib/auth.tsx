"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface AuthState {
  token: string | null;
  isLoading: boolean;
}

interface AuthContext extends AuthState {
  setToken: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("tg_token");
    setTokenState(stored);
    setIsLoading(false);
  }, []);

  const setToken = useCallback((t: string) => {
    localStorage.setItem("tg_token", t);
    setTokenState(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("tg_token");
    setTokenState(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        token,
        isLoading,
        setToken,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
