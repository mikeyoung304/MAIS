/**
 * Authentication Context Module
 *
 * Provides unified authentication state and methods for both platform admins and tenant admins.
 * Handles JWT token management, role-based access control, and automatic token refresh.
 *
 * @example
 * ```tsx
 * import { useAuth } from '@/contexts/AuthContext';
 *
 * function MyComponent() {
 *   const { user, role, login, logout, isPlatformAdmin } = useAuth();
 *
 *   if (isPlatformAdmin()) {
 *     return <PlatformAdminDashboard />;
 *   }
 *
 *   return <TenantAdminDashboard />;
 * }
 * ```
 */

// Export the provider
export { AuthProvider } from './AuthProvider';

// Export hooks
export { useAuth, useIsPlatformAdmin, useIsTenantAdmin, useHasRole, useAuthStatus } from './hooks';

// Export context for advanced use cases
export { AuthContext } from './context';

// Re-export types for convenience
export type {
  User,
  UserRole,
  AuthContextType,
  PlatformAdminUser,
  TenantAdminUser,
  SignupResponse,
  SignupCredentials,
} from '../../types/auth';
