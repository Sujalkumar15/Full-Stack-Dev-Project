import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../lib/api";
import type { LoginInput, RegisterInput, User, Workspace } from "../types/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<{ user: User; workspace: Workspace }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiRequest<{ data: { user: User } }>("/auth/me");
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: async (input) => {
      const response = await apiRequest<{ data: { user: User } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setUser(response.data.user);
      return response.data.user;
    },
    register: async (input) => {
      const response = await apiRequest<{ data: { user: User; workspace: Workspace } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setUser(response.data.user);
      return response.data;
    },
    logout: async () => {
      await apiRequest<{ data: { message: string } }>("/auth/logout", { method: "POST" });
      setUser(null);
      localStorage.removeItem("selectedWorkspaceId");
    },
    refreshSession,
  }), [isLoading, refreshSession, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
