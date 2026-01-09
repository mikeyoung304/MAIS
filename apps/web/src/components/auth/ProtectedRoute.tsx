'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/lib/auth-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

/**
 * Protected Route Component
 *
 * Wraps content that requires authentication.
 * Uses NextAuth.js session for authentication state.
 * Redirects to login if not authenticated.
 * Redirects to appropriate dashboard if role not allowed.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasRole, isImpersonating, role } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Redirect to login
      const currentPath = window.location.pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check if user has any of the allowed roles
    const hasAllowedRole = allowedRoles.some((r) => hasRole(r));

    if (!hasAllowedRole) {
      // Redirect to appropriate home page
      if (isImpersonating()) {
        // Admin impersonating should go to tenant build (primary workspace)
        router.push('/tenant/build');
      } else if (role === 'PLATFORM_ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'TENANT_ADMIN') {
        // Tenant admins go to build mode as primary workspace
        router.push('/tenant/build');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, hasRole, isImpersonating, role, router, allowedRoles]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sage border-t-transparent mx-auto" />
          <p className="mt-4 text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or wrong role
  if (!isAuthenticated) {
    return null;
  }

  const hasAllowedRole = allowedRoles.some((r) => hasRole(r));
  if (!hasAllowedRole) {
    return null;
  }

  return <>{children}</>;
}
