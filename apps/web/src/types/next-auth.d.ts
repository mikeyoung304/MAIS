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
    backendToken: string;
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
