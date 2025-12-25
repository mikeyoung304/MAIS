/**
 * NextAuth.js Client Utilities
 *
 * Client-side hooks and utilities for authentication.
 * Re-exports from next-auth/react with typed session.
 */

import { useSession, signIn, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';

export type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

/**
 * Extended session type with MAIS-specific fields
 */
export interface MAISSession extends Session {
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId?: string;
    slug?: string;
    impersonation?: {
      tenantId: string;
      tenantSlug: string;
      tenantEmail: string;
      startedAt: string;
    };
  };
  backendToken: string;
}

/**
 * Hook to access the current auth session
 * Returns typed session with MAIS-specific fields
 */
export function useAuth() {
  const { data: session, status, update } = useSession();
  const maisSession = session as MAISSession | null;

  return {
    session: maisSession,
    user: maisSession?.user,
    backendToken: maisSession?.backendToken,
    role: maisSession?.user?.role,
    tenantId: maisSession?.user?.tenantId,
    slug: maisSession?.user?.slug,
    impersonation: maisSession?.user?.impersonation,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    status,
    update,

    // Helper methods
    isPlatformAdmin: () =>
      maisSession?.user?.role === 'PLATFORM_ADMIN' && !maisSession?.user?.impersonation,
    isTenantAdmin: () =>
      maisSession?.user?.role === 'TENANT_ADMIN' || !!maisSession?.user?.impersonation,
    hasRole: (role: UserRole) => {
      if (maisSession?.user?.impersonation && role === 'TENANT_ADMIN') {
        return true;
      }
      return maisSession?.user?.role === role;
    },
    isImpersonating: () => !!maisSession?.user?.impersonation,
  };
}

/**
 * Sign in with credentials
 */
export async function login(email: string, password: string) {
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  });

  if (result?.error) {
    throw new Error(result.error === 'CredentialsSignin' ? 'Invalid credentials' : result.error);
  }

  return result;
}

/**
 * Sign in with token (used after signup)
 */
export async function loginWithToken(params: {
  token: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  slug?: string;
}) {
  const result = await signIn('credentials', {
    ...params,
    redirect: false,
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Sign out
 */
export async function logout(callbackUrl = '/') {
  return signOut({ callbackUrl });
}

// Re-export for convenience
export { signIn, signOut, useSession };
