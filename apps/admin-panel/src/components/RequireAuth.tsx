import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/lib/authClient";

export function RequireAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
