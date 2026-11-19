import { createContext, useContext, type ReactNode } from 'react';
import type { LoginRequest, PublicUser, RegisterRequest } from '@collaborative-workspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from '../lib/api';

interface AuthContextValue {
  isLoading: boolean;
  user: PublicUser | null;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({
    queryKey: ['current-user'],
    queryFn: api.getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  const value: AuthContextValue = {
    isLoading: currentUser.isLoading,
    user: currentUser.data ?? null,
    async login(input) {
      const result = await api.login(input);
      queryClient.setQueryData(['current-user'], result.user);
    },
    async register(input) {
      const result = await api.register(input);
      queryClient.setQueryData(['current-user'], result.user);
    },
    async logout() {
      await api.logout();
      queryClient.clear();
      queryClient.setQueryData(['current-user'], null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
