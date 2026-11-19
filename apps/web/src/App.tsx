import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { WorkspaceHome } from './components/WorkspaceHome';
import { WorkspaceShell } from './components/WorkspaceShell';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f7f8f6] text-stone-500">
        <div className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Loading your workspace…
        </div>
      </div>
    );
  }
  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthScreen mode="login" />} />
        <Route path="/register" element={<AuthScreen mode="register" />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkspaceHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspaces/:workspaceId"
          element={
            <ProtectedRoute>
              <WorkspaceShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspaces/:workspaceId/pages/:pageId"
          element={
            <ProtectedRoute>
              <WorkspaceShell />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
