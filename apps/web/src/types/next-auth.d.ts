/**
 * NextAuth.js Type Extensions
 *
 * Extends the default NextAuth types to include MAIS-specific fields.
 * See: https://next-auth.js.org/getting-started/typescript
 */

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extended User interface with MAIS-specific fields
   */
  interface User {
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
   * Extended Session interface with MAIS-specific fields
   *
   * SECURITY: backendToken is intentionally NOT included here.
   * It's stored server-side only in the JWT and should be accessed
   * via getBackendToken() helper in Server Components or API routes.
   */
  interface Session {
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
    // SECURITY: backendToken removed from client-accessible session
    // Use getBackendToken() from auth.ts for server-side API calls
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT interface with MAIS-specific fields
   */
  interface JWT {
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
}
