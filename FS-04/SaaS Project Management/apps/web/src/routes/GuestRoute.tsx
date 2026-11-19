import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LoadingScreen } from "../components/LoadingScreen";

export function GuestRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/workspaces" replace />;
  return <Outlet />;
}
