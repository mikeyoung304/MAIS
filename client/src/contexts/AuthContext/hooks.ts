/**
 * Authentication Hooks
 *
 * Custom hooks for authentication functionality including role checks
 * and auth state management.
 */

import { useContext } from 'react';
import { AuthContext } from './context';
import type { AuthContextType, UserRole } from '../../types/auth';

/**
 * Hook to use auth context
 *
 * @throws Error if used outside AuthProvider
 * @returns Auth context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, login, logout, isPlatformAdmin } = useAuth();
 *
 *   if (!user) {
 *     return <LoginForm onLogin={login} />;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome, {user.email}</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

/**
 * Hook to check if current user is platform admin
 */
export function useIsPlatformAdmin(): boolean {
  const { role } = useAuth();
  return role === 'PLATFORM_ADMIN';
}

/**
 * Hook to check if current user is tenant admin
 */
export function useIsTenantAdmin(): boolean {
  const { role } = useAuth();
  return role === 'TENANT_ADMIN';
}

/**
 * Hook to check if current user has a specific role
 */
export function useHasRole(): (targetRole: UserRole) => boolean {
  const { role } = useAuth();

  return (targetRole: UserRole): boolean => {
    return role === targetRole;
  };
}

/**
 * Hook to get authentication status
 */
export function useAuthStatus(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthContextType['user'];
  role: UserRole | null;
} {
  const { isAuthenticated, isLoading, user, role } = useAuth();

  return {
    isAuthenticated,
    isLoading,
    user,
    role,
  };
}
