/**
 * Authentication Provider Component
 *
 * Wraps the app to provide authentication state and methods.
 * Automatically restores auth state from localStorage on mount.
 * Checks for token expiration on mount and periodically.
 */

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthContext } from './context';
import { authenticateUser, signupTenant, logoutUser, restoreAuthState } from './services';
import { useTokenExpiration } from './useTokenExpiration';
import type {
  User,
  UserRole,
  AuthContextType,
  ImpersonationData,
  SignupResponse,
} from '../../types/auth';

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Refresh authentication state from localStorage
   * Called on mount and after login
   */
  const refreshAuth = useCallback(() => {
    const authState = restoreAuthState();

    if (authState) {
      setUser(authState.user);
      setToken(authState.token);
      setRole(authState.role);
      setTenantId(authState.tenantId);
      setImpersonation(authState.impersonation);
    } else {
      setUser(null);
      setToken(null);
      setRole(null);
      setTenantId(null);
      setImpersonation(null);
    }

    setIsLoading(false);
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  /**
   * Login method
   */
  const login = useCallback(
    async (email: string, password: string, targetRole: UserRole): Promise<void> => {
      setIsLoading(true);

      try {
        const result = await authenticateUser(email, password, targetRole);

        // Update state
        setUser(result.user);
        setToken(result.token);
        setRole(result.role);
        setTenantId(result.tenantId);
        setImpersonation(result.impersonation);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Signup method
   */
  const signup = useCallback(
    async (email: string, password: string, businessName: string): Promise<SignupResponse> => {
      setIsLoading(true);

      try {
        const result = await signupTenant(email, password, businessName);

        // Refresh auth state after signup to populate user data
        refreshAuth();

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAuth]
  );

  /**
   * Logout method
   */
  const logout = () => {
    logoutUser();

    // Clear state
    setUser(null);
    setToken(null);
    setRole(null);
    setTenantId(null);
    setImpersonation(null);
  };

  /**
   * Check if current user is platform admin
   */
  const isPlatformAdmin = (): boolean => {
    return role === 'PLATFORM_ADMIN';
  };

  /**
   * Check if current user is tenant admin
   */
  const isTenantAdmin = (): boolean => {
    return role === 'TENANT_ADMIN';
  };

  /**
   * Check if current user has specific role
   */
  const hasRole = (targetRole: UserRole): boolean => {
    return role === targetRole;
  };

  /**
   * Check if currently impersonating a tenant
   */
  const isImpersonating = (): boolean => {
    return impersonation !== null;
  };

  /**
   * Periodically check for token expiration
   */
  useTokenExpiration(token, logout);

  const value: AuthContextType = {
    user,
    role,
    tenantId,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    impersonation,
    login,
    signup,
    logout,
    isPlatformAdmin,
    isTenantAdmin,
    hasRole,
    refreshAuth,
    isImpersonating,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
