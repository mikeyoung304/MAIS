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
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import type { User, Session } from 'next-auth';
import { logger } from '@/lib/logger';
import { NEXTAUTH_COOKIE_NAMES } from '@/lib/auth-constants';

// Re-export for backward compatibility
export { NEXTAUTH_COOKIE_NAMES } from '@/lib/auth-constants';

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

// Ensure consistent secret across NextAuth and getBackendToken
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!authSecret) {
  throw new Error(
    'AUTH_SECRET or NEXTAUTH_SECRET environment variable must be configured. ' +
      'Generate one with: openssl rand -base64 32'
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Used for direct token login (after signup or impersonation)
        token: { label: 'Token', type: 'text' },
        role: { label: 'Role', type: 'text' },
        tenantId: { label: 'TenantId', type: 'text' },
        slug: { label: 'Slug', type: 'text' },
        // Used for impersonation - JSON stringified impersonation data
        impersonation: { label: 'Impersonation', type: 'text' },
      },
      async authorize(credentials): Promise<MAISUser | null> {
        // If token is provided directly (used after signup or impersonation), create session directly
        if (credentials?.token) {
          return {
            id: (credentials.tenantId as string) || 'user',
            email: credentials.email as string,
            role: (credentials.role as 'PLATFORM_ADMIN' | 'TENANT_ADMIN') || 'TENANT_ADMIN',
            tenantId: credentials.tenantId as string | undefined,
            slug: credentials.slug as string | undefined,
            backendToken: credentials.token as string,
            impersonation: credentials.impersonation
              ? (() => {
                  try {
                    return JSON.parse(credentials.impersonation as string);
                  } catch {
                    const impersonationValue = credentials.impersonation as string | undefined;
                    logger.warn('Failed to parse impersonation data', {
                      dataLength: impersonationValue?.length ?? 0,
                      dataType: typeof credentials.impersonation,
                    });
                    return undefined;
                  }
                })()
              : undefined,
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
      const isProtectedRoute = pathname.startsWith('/tenant') || pathname.startsWith('/admin');

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
 * Get backend token for server-side API calls.
 *
 * Retrieves the JWT session token from cookies, supporting both NextAuth v5
 * and v4 cookie naming conventions across HTTP and HTTPS environments.
 *
 * SECURITY: This should only be used in Server Components or API routes.
 * The token is not exposed to client-side JavaScript.
 *
 * @version Tested with next-auth@5.x (Auth.js beta.30)
 * @see https://authjs.dev/reference/core#cookies for cookie naming
 *
 * MAINTENANCE NOTE: Cookie names change between NextAuth versions.
 * When upgrading NextAuth, verify cookie names haven't changed.
 * See NEXTAUTH_COOKIE_NAMES constant for the current lookup order.
 *
 * @param request - REQUIRED for API routes (Next.js Route Handlers).
 *                  OMIT for Server Components and Server Actions.
 * @returns The backend JWT token or null if not authenticated
 */
export async function getBackendToken(request?: Request): Promise<string | null> {
  let req: Parameters<typeof getToken>[0]['req'];
  let cookieStore: { get: (name: string) => { value: string } | undefined };

  if (request) {
    // Use the actual request object from API route handlers
    req = request as Parameters<typeof getToken>[0]['req'];
    // Parse cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name) {
        cookieMap.set(name, valueParts.join('='));
      }
    });
    cookieStore = {
      get: (name: string) => {
        const value = cookieMap.get(name);
        return value !== undefined ? { value } : undefined;
      },
    };
  } else {
    // Create request object from next/headers (for Server Components)
    const { cookies, headers } = await import('next/headers');
    const nextCookieStore = await cookies();
    const headerStore = await headers();

    req = {
      cookies: Object.fromEntries(nextCookieStore.getAll().map((c) => [c.name, c.value])),
      headers: headerStore,
    } as Parameters<typeof getToken>[0]['req'];

    cookieStore = nextCookieStore;
  }

  // Find which cookie name is actually present (checks in priority order)
  const cookieName = NEXTAUTH_COOKIE_NAMES.find(
    (name) => cookieStore.get(name)?.value !== undefined
  );

  if (!cookieName) {
    logger.debug('No session cookie found', {
      availableCookies: request
        ? request.headers
            .get('cookie')
            ?.split(';')
            .map((c) => c.trim().split('=')[0])
        : 'unknown',
    });
    return null;
  }

  const token = await getToken({
    req,
    secret: authSecret,
    cookieName,
  });

  if (!token) {
    logger.debug('getToken returned null', { cookieName });
    return null;
  }

  return (token as MAISJWT).backendToken || null;
}
