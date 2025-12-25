'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AuthContextType,
  AuthState,
  User,
  UserRole,
  ImpersonationData,
  LoginResponse,
  SignupResponse,
} from './types';
import {
  AUTH_COOKIES,
  decodeJWT,
  isTokenExpired,
  payloadToUser,
  getRoleFromPayload,
  getImpersonationFromPayload,
  getCookie,
  setCookie,
  clearAuthCookies,
} from './auth-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const initialState: AuthState = {
  user: null,
  token: null,
  role: null,
  tenantId: null,
  isAuthenticated: false,
  isLoading: true,
  impersonation: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  /**
   * Restore auth state from cookies on mount
   */
  const restoreAuthState = useCallback(() => {
    // Try tenant token first (more common)
    const tenantToken = getCookie(AUTH_COOKIES.TENANT_TOKEN);
    if (tenantToken && !isTokenExpired(tenantToken)) {
      const payload = decodeJWT(tenantToken);
      if (payload) {
        const user = payloadToUser(payload);
        const role = getRoleFromPayload(payload);
        const tenantId = 'tenantId' in payload ? payload.tenantId : null;

        setState({
          user,
          token: tenantToken,
          role,
          tenantId,
          isAuthenticated: true,
          isLoading: false,
          impersonation: null,
        });
        return;
      }
    }

    // Try admin token
    const adminToken = getCookie(AUTH_COOKIES.ADMIN_TOKEN);
    if (adminToken && !isTokenExpired(adminToken)) {
      const payload = decodeJWT(adminToken);
      if (payload) {
        const user = payloadToUser(payload);
        const role = getRoleFromPayload(payload);
        const impersonation = getImpersonationFromPayload(payload);
        const tenantId = impersonation?.tenantId || null;

        setState({
          user,
          token: adminToken,
          role,
          tenantId,
          isAuthenticated: true,
          isLoading: false,
          impersonation,
        });
        return;
      }
    }

    // No valid token found
    setState({
      ...initialState,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    restoreAuthState();
  }, [restoreAuthState]);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string, targetRole: UserRole): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }

        const data: LoginResponse = await response.json();
        const payload = decodeJWT(data.token);
        if (!payload) {
          throw new Error('Invalid token received');
        }

        const user = payloadToUser(payload);
        const role = getRoleFromPayload(payload);
        const impersonation = getImpersonationFromPayload(payload);

        // Store token in appropriate cookie
        if (role === 'PLATFORM_ADMIN') {
          setCookie(AUTH_COOKIES.ADMIN_TOKEN, data.token);
        } else {
          setCookie(AUTH_COOKIES.TENANT_TOKEN, data.token);
        }

        setState({
          user,
          token: data.token,
          role,
          tenantId: data.tenantId || impersonation?.tenantId || null,
          isAuthenticated: true,
          isLoading: false,
          impersonation,
        });
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    []
  );

  /**
   * Signup as new tenant
   */
  const signup = useCallback(
    async (
      email: string,
      password: string,
      businessName: string
    ): Promise<SignupResponse> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, businessName }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Signup failed');
        }

        const data: SignupResponse = await response.json();
        const payload = decodeJWT(data.token);
        if (!payload) {
          throw new Error('Invalid token received');
        }

        const user = payloadToUser(payload);

        // Store tenant token
        setCookie(AUTH_COOKIES.TENANT_TOKEN, data.token);

        setState({
          user,
          token: data.token,
          role: 'TENANT_ADMIN',
          tenantId: data.tenantId,
          isAuthenticated: true,
          isLoading: false,
          impersonation: null,
        });

        return data;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    []
  );

  /**
   * Logout and clear all auth state
   */
  const logout = useCallback(() => {
    clearAuthCookies();
    setState({
      ...initialState,
      isLoading: false,
    });
  }, []);

  /**
   * Refresh auth state from cookies
   */
  const refreshAuth = useCallback(() => {
    restoreAuthState();
  }, [restoreAuthState]);

  /**
   * Check if user is platform admin
   */
  const isPlatformAdmin = useCallback(() => {
    return state.role === 'PLATFORM_ADMIN' && !state.impersonation;
  }, [state.role, state.impersonation]);

  /**
   * Check if user is tenant admin (or impersonating as one)
   */
  const isTenantAdmin = useCallback(() => {
    return state.role === 'TENANT_ADMIN' || !!state.impersonation;
  }, [state.role, state.impersonation]);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback(
    (role: UserRole) => {
      if (state.impersonation && role === 'TENANT_ADMIN') {
        return true;
      }
      return state.role === role;
    },
    [state.role, state.impersonation]
  );

  /**
   * Check if admin is currently impersonating a tenant
   */
  const isImpersonating = useCallback(() => {
    return !!state.impersonation;
  }, [state.impersonation]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    refreshAuth,
    isPlatformAdmin,
    isTenantAdmin,
    hasRole,
    isImpersonating,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
