import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/use-auth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  fallbackPath?: string;
}

export default function RoleGuard({ children, allowedRoles, fallbackPath }: RoleGuardProps) {
  const { role, roles, loading, isClient, session } = useAuth();

  // Only show spinner on initial load. If we already have roles resolved,
  // keep rendering children during background token refreshes to prevent
  // unmounting active pages (e.g. Dialer mid-call).
  if (loading && !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role && !session) {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.some((userRole) => allowedRoles.includes(userRole))) {
    if (import.meta.env.DEV) console.log("[RoleGuard] Access denied. User roles:", roles, "Allowed roles:", allowedRoles);
    const redirect = fallbackPath || (isClient ? "/client-portal" : "/");
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
