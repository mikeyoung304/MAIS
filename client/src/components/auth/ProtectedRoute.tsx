/**
 * ProtectedRoute - Role-based route protection
 * Ensures users can only access routes matching their role
 *
 * When a platform admin is impersonating a tenant:
 * - They are treated as TENANT_ADMIN for route access
 * - They are redirected to tenant dashboard from admin routes
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { Loading } from '../../ui/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isImpersonating } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return <Loading label="Checking authentication" />;
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle impersonation: admin acting as tenant
  const impersonating = isImpersonating();

  // If impersonating and on admin route, redirect to tenant dashboard
  if (impersonating && location.pathname.startsWith('/admin')) {
    return <Navigate to="/tenant/dashboard" replace />;
  }

  // Determine effective role (impersonating admins act as tenant admins)
  const effectiveRole: UserRole = impersonating ? 'TENANT_ADMIN' : user.role;

  // Check if user's effective role is allowed
  if (!allowedRoles.includes(effectiveRole)) {
    // Redirect to appropriate dashboard based on effective role
    if (effectiveRole === 'PLATFORM_ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (effectiveRole === 'TENANT_ADMIN') {
      return <Navigate to="/tenant/dashboard" replace />;
    }
    // Fallback to login if role not recognized
    return <Navigate to="/login" replace />;
  }

  // Authorized - render children
  return <>{children}</>;
}
