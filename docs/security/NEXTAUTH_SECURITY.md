# NextAuth.js v5 Security Guide

**Document:** NextAuth.js Security Implementation
**Last Updated:** December 25, 2025
**Status:** Active

---

## Overview

MAIS uses NextAuth.js v5 (Auth.js) for tenant admin authentication in the Next.js app (`apps/web`). This document covers security patterns, token handling, and best practices.

## Architecture

### Authentication Flow

```
1. User submits credentials → NextAuth Credentials Provider
2. Provider calls Express backend → POST /v1/auth/login
3. Backend validates credentials → Returns JWT + user data
4. NextAuth creates session → Backend token stored in JWT (server-side only)
5. Client receives session → Role/tenantId only (no token)
```

### Token Isolation (Critical)

Backend tokens are **never exposed to the client**:

```typescript
// apps/web/src/lib/auth.ts

callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.backendToken = user.backendToken; // Stored in JWT
      token.role = user.role;
      token.tenantId = user.tenantId;
    }
    return token;
  },

  async session({ session, token }) {
    // SECURITY: Never include backendToken in session
    return {
      ...session,
      user: {
        role: token.role,
        tenantId: token.tenantId,
        // backendToken: EXCLUDED - would be visible via useSession()
      },
    };
  },
},
```

### Accessing Backend Token (Server-Side Only)

```typescript
// apps/web/src/lib/auth.ts

import { getToken } from 'next-auth/jwt';

interface MAISJWT {
  backendToken?: string;
  role?: string;
  tenantId?: string;
}

/**
 * Get backend token for API calls (server-side only)
 * NEVER call this from Client Components
 */
export async function getBackendToken(): Promise<string | null> {
  const token = await getToken({
    req: headers() as unknown as NextRequest,
    secret: process.env.AUTH_SECRET,
  });
  return (token as MAISJWT)?.backendToken || null;
}
```

## Configuration

### Required Environment Variables

```bash
# apps/web/.env.local

# NextAuth secret (generate: openssl rand -base64 32)
AUTH_SECRET=your-secret-here

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth URL (for callback URLs)
NEXTAUTH_URL=http://localhost:3000
```

### Session Configuration

```typescript
// apps/web/src/lib/auth.ts

session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours (OWASP recommended for admin)
},
```

**Session Duration Guidelines:**

| User Type       | Max Age  | Rationale                             |
| --------------- | -------- | ------------------------------------- |
| Platform Admin  | 4 hours  | High privilege, smaller attack window |
| Tenant Admin    | 24 hours | Standard admin access                 |
| Public Sessions | 7 days   | Read-only, low risk                   |

## Security Patterns

### 1. Credentials Provider Pattern

```typescript
import Credentials from 'next-auth/providers/credentials';

Credentials({
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    // Always delegate to backend for validation
    const response = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      // Log attempt but don't leak details
      logger.warn('Login failed', { email: credentials.email });
      return null;
    }

    const data = await response.json();
    return {
      id: data.tenantId,
      email: data.email,
      role: data.role,
      backendToken: data.token,
    };
  },
}),
```

### 2. Protected Routes

Use middleware to protect routes:

```typescript
// apps/web/src/middleware.ts

import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Protected routes
  if (pathname.startsWith('/(protected)') && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.url));
  }

  return null;
});

export const config = {
  matcher: ['/(protected)/:path*'],
};
```

### 3. Server Component Auth Check

```typescript
// In a Server Component
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function TenantDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Safe to access session.user.role, session.user.tenantId
  // Backend token accessed via getBackendToken() for API calls
}
```

### 4. API Route Protection

```typescript
// apps/web/src/app/api/tenant/route.ts

import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/auth';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getBackendToken();
  if (!token) {
    return Response.json({ error: 'No backend token' }, { status: 401 });
  }

  // Make authenticated request to Express backend
  const response = await fetch(`${API_URL}/v1/tenant-admin/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return Response.json(await response.json());
}
```

## Common Mistakes to Avoid

### 1. Exposing Backend Token in Session

```typescript
// ❌ WRONG - Token visible to client
async session({ session, token }) {
  return {
    ...session,
    user: { ...token, backendToken: token.backendToken }, // EXPOSED!
  };
}

// ✅ CORRECT - Token stays server-side
async session({ session, token }) {
  return {
    ...session,
    user: { role: token.role, tenantId: token.tenantId }, // Safe metadata
  };
}
```

### 2. Calling getBackendToken in Client Components

```typescript
// ❌ WRONG - Server function in Client Component
'use client';
import { getBackendToken } from '@/lib/auth';

export function ClientComponent() {
  const token = await getBackendToken(); // Will fail!
}

// ✅ CORRECT - Use Server Action or API route
('use client');

async function fetchData() {
  const response = await fetch('/api/my-data'); // API route handles auth
}
```

### 3. Long Session Duration

```typescript
// ❌ WRONG - Too long for admin access
session: {
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

// ✅ CORRECT - Risk-appropriate duration
session: {
  maxAge: 24 * 60 * 60, // 24 hours for tenant admins
}
```

### 4. Missing AUTH_SECRET

```typescript
// ❌ WRONG - Hardcoded or missing secret
export default NextAuth({
  secret: 'hardcoded-secret', // Never do this
});

// ✅ CORRECT - Environment variable
export default NextAuth({
  secret: process.env.AUTH_SECRET,
});
```

## Security Checklist

When working with NextAuth in MAIS:

- [ ] Backend token never included in session callback
- [ ] `getBackendToken()` only called in Server Components/API routes
- [ ] Session duration appropriate for risk level (24h for admins)
- [ ] `AUTH_SECRET` set in environment (not hardcoded)
- [ ] Protected routes use middleware or `auth()` check
- [ ] Login failures logged but details not exposed
- [ ] HTTPS enforced in production

## Logging

Use structured logging for auth events:

```typescript
import { logger } from '@/lib/logger';

// Login attempt
logger.info('Login attempt', { email: credentials.email });

// Login failure (don't log password or detailed reason)
logger.warn('Login failed', { email: credentials.email });

// Login success
logger.info('Login success', { email: user.email, role: user.role });

// Session refresh
logger.debug('Session refreshed', { tenantId: token.tenantId });
```

## Related Documents

- [ADR-014: Next.js App Router Migration](../adrs/ADR-014-nextjs-app-router-migration.md)
- [Migration Lessons Learned](../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## References

- [NextAuth.js v5 Documentation](https://authjs.dev/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
