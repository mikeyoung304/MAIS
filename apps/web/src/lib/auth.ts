/**
 * NextAuth.js v5 (Auth.js) Configuration
 *
 * Configures authentication using the existing Express API backend.
 * Uses a credentials provider that validates against the /v1/auth/login endpoint.
 *
 * Key Features:
 * - Credentials provider for email/password login
 * - JWT strategy with backend token storage
 * - Extended session with role, tenantId, and impersonation data
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';
import type { User, Session } from 'next-auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Extended User type with MAIS-specific fields
 */
interface MAISUser extends User {
  id: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId?: string;
  slug?: string;
  backendToken: string;
  impersonation?: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string;
  };
}

/**
 * Extended JWT type with MAIS-specific fields
 */
interface MAISJWT extends JWT {
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId?: string;
  slug?: string;
  backendToken: string;
  impersonation?: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string;
  };
}

/**
 * Extended Session type with MAIS-specific fields
 *
 * SECURITY: backendToken is intentionally NOT included here.
 * It's stored in an HTTP-only cookie (mais_backend_token) and should
 * only be accessed server-side via getBackendToken() helper.
 */
interface MAISSession extends Session {
  user: {
    id: string;
    email: string;
    role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
    tenantId?: string;
    slug?: string;
    impersonation?: {
      tenantId: string;
      tenantSlug: string;
      tenantEmail: string;
      startedAt: string;
    };
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Used for direct token login (after signup)
        token: { label: 'Token', type: 'text' },
        role: { label: 'Role', type: 'text' },
        tenantId: { label: 'TenantId', type: 'text' },
        slug: { label: 'Slug', type: 'text' },
      },
      async authorize(credentials): Promise<MAISUser | null> {
        // If token is provided directly (used after signup), create session directly
        if (credentials?.token) {
          return {
            id: (credentials.tenantId as string) || 'user',
            email: credentials.email as string,
            role: (credentials.role as 'PLATFORM_ADMIN' | 'TENANT_ADMIN') || 'TENANT_ADMIN',
            tenantId: credentials.tenantId as string | undefined,
            slug: credentials.slug as string | undefined,
            backendToken: credentials.token as string,
          };
        }

        // Standard email/password login
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Invalid credentials');
          }

          const data = await response.json();

          // Return user with backend token
          return {
            id: data.tenantId || data.userId || 'user',
            email: data.email,
            role: data.role,
            tenantId: data.tenantId,
            slug: data.slug,
            backendToken: data.token,
          };
        } catch (error) {
          logger.error('Auth error', error instanceof Error ? error : { error });
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours - security best practice for admin access
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * JWT Callback
     * Called when JWT is created or updated
     * Store backend token and user info in JWT
     */
    async jwt({ token, user }): Promise<MAISJWT> {
      if (user) {
        const maisUser = user as MAISUser;
        return {
          ...token,
          id: maisUser.id,
          email: maisUser.email || '',
          role: maisUser.role,
          tenantId: maisUser.tenantId,
          slug: maisUser.slug,
          backendToken: maisUser.backendToken,
          impersonation: maisUser.impersonation,
        };
      }
      return token as MAISJWT;
    },

    /**
     * Session Callback
     * Called when session is checked
     * Expose necessary user info to client
     *
     * SECURITY: backendToken is intentionally NOT included here.
     * It remains in the JWT (server-side only) and should be accessed
     * via getBackendToken() helper in Server Components or API routes.
     */
    async session({ session, token }): Promise<MAISSession> {
      const maisToken = token as MAISJWT;
      return {
        ...session,
        user: {
          id: maisToken.id as string,
          email: maisToken.email || '',
          role: maisToken.role,
          tenantId: maisToken.tenantId,
          slug: maisToken.slug,
          impersonation: maisToken.impersonation,
        },
        // SECURITY: backendToken removed - kept server-side only in JWT
        // Use getBackendToken() for server-side API calls
      } as MAISSession;
    },

    /**
     * Authorized Callback
     * Determines if a request is authorized
     * Used by middleware for route protection
     */
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Protected routes
      const isProtectedRoute =
        pathname.startsWith('/tenant') || pathname.startsWith('/admin');

      if (isProtectedRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },

  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',
});

// Re-export types for use in components
export type { MAISUser, MAISJWT, MAISSession };

/**
 * Get backend token for server-side API calls
 *
 * SECURITY: This should only be used in Server Components or API routes.
 * The token is not exposed to client-side JavaScript.
 *
 * @returns The backend JWT token or null if not authenticated
 */
export async function getBackendToken(): Promise<string | null> {
  // Import getToken from next-auth/jwt for server-side JWT access
  const { getToken } = await import('next-auth/jwt');
  const { cookies, headers } = await import('next/headers');

  // Get the request cookies to pass to getToken
  const cookieStore = await cookies();
  const headerStore = await headers();

  // Create a minimal request object for getToken
  const req = {
    cookies: Object.fromEntries(
      cookieStore.getAll().map((c) => [c.name, c.value])
    ),
    headers: headerStore,
  };

  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]['req'],
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;

  return (token as MAISJWT).backendToken || null;
}
