# NextAuth v5 Complete Guide for MAIS

**Consolidated documentation for NextAuth v5 JWT authentication in the MAIS project.**

**Last Updated**: 2026-01-10
**Severity**: CRITICAL
**Applies To**: All authentication flows, API routes, Server Components

---

## Table of Contents

1. [Quick Reference (Print This)](#quick-reference)
2. [Project Configuration](#project-configuration)
3. [The Cookie Prefix Problem](#the-cookie-prefix-problem)
4. [API Proxy Pattern](#api-proxy-pattern)
5. [getBackendToken() Usage](#getbackendtoken-usage)
6. [Session Management](#session-management)
7. [Common Issues & Solutions](#common-issues--solutions)
8. [Code Review Checklist](#code-review-checklist)
9. [Testing Strategy](#testing-strategy)
10. [Prevention Principles](#prevention-principles)

---

## Quick Reference

**Print this section and pin it to your monitor.**

### Cookie Names by Environment

| Environment          | Protocol | Cookie Name                        | Prefix? |
| :------------------- | :------- | :--------------------------------- | :------ |
| Local dev            | HTTP     | `authjs.session-token`             | No      |
| Staging              | HTTPS    | `__Secure-authjs.session-token`    | Yes     |
| Production           | HTTPS    | `__Secure-authjs.session-token`    | Yes     |
| NextAuth v4 (legacy) | HTTPS    | `__Secure-next-auth.session-token` | Yes     |

### One-Liner Reminders

```
HTTPS = __Secure- prefix on cookies
API routes: Pass request to getBackendToken(request)
Server Components: Call getBackendToken() with no params
Client Components: Use useSession() instead
getBackendToken() returns null silently - check logs!
```

### Decision Tree

```
START: Using getBackendToken()
  |
  +-- Are you in an API route (route.ts)?
  |   +-- YES: await getBackendToken(request)
  |   +-- NO: Are you in a Server Component?
  |       +-- YES: await getBackendToken()
  |       +-- NO: You're in a Client Component
  |           +-- DON'T use getBackendToken()
  |           +-- Use useSession() instead
```

### Copy-Paste Patterns

**API Route (route.ts):**

```typescript
export async function GET(request: Request) {
  const token = await getBackendToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use token for backend API calls
  return new Response(JSON.stringify({ success: true }));
}
```

**Server Component:**

```typescript
import { getBackendToken } from '@/lib/auth';

export default async function YourPage() {
  const token = await getBackendToken();

  if (!token) {
    return <div>Not authenticated</div>;
  }

  return <div>Authenticated content</div>;
}
```

**Client Component (use useSession instead):**

```typescript
'use client';
import { useSession } from 'next-auth/react';

export function YourComponent() {
  const { data: session } = useSession();
  // Access session.user.role, session.user.email, etc.
}
```

---

## Project Configuration

### Key Files

| File                                               | Purpose                                     |
| :------------------------------------------------- | :------------------------------------------ |
| `apps/web/src/lib/auth.ts`                         | NextAuth configuration, `getBackendToken()` |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | NextAuth API route handler                  |
| `apps/web/src/middleware.ts`                       | Route protection middleware                 |
| `apps/web/src/app/api/*/[...path]/route.ts`        | API proxy routes                            |

### Environment Variables

```bash
# Required
AUTH_SECRET=<32+ char random string>  # openssl rand -hex 32
NEXTAUTH_URL=http://localhost:3000    # or https://your-domain.com

# Backend integration
API_URL=http://localhost:3001         # Express backend URL
```

### Session Structure

```typescript
interface MAISSession extends Session {
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER';
    tenantId?: string;
    // NOTE: backendToken is NOT included (server-side only)
  };
}
```

**Important**: The `backendToken` is stored in the HTTP-only JWT cookie, NOT in the session object exposed to the client. This is a security feature.

---

## The Cookie Prefix Problem

### What Happens

NextAuth v5 automatically prefixes session cookies with `__Secure-` when running on HTTPS. This is a security feature following the HTTP cookie specification.

```
HTTP (localhost)  -> authjs.session-token
HTTPS (production) -> __Secure-authjs.session-token
```

### Why This Breaks Code

Code that only checks for `authjs.session-token` will fail on production:

```typescript
// BROKEN: Only works on HTTP
const token = cookies.get('authjs.session-token')?.value;

// Works on HTTP, fails on HTTPS (production)
```

### The Fix

Check all possible cookie names, with HTTPS variants first:

```typescript
const possibleCookieNames = [
  '__Secure-authjs.session-token', // HTTPS (production) - check FIRST
  'authjs.session-token', // HTTP (development)
  '__Secure-next-auth.session-token', // Legacy v4 HTTPS
  'next-auth.session-token', // Legacy v4 HTTP
];

const cookieName = possibleCookieNames.find((name) => cookieStore.get(name)?.value !== undefined);
```

---

## API Proxy Pattern

### The Problem

Client-side components cannot access the backend token directly (it's in an HTTP-only cookie). Direct calls to the Express backend fail authentication.

### The Solution

Route all client API calls through Next.js API routes that:

1. Receive unauthenticated request from client
2. Retrieve backend token server-side via `getBackendToken()`
3. Add Authorization header with token
4. Forward request to Express backend
5. Return response to client

### Flow Diagram

```
Browser (Client Component)
  |
  +-- fetch('/api/agent/health')
      |
      +-- Next.js API Route (/api/agent/[...path]/route.ts)
          |
          +-- getBackendToken(request)  <- Reads HTTP-only cookie
          +-- Add Authorization: Bearer <token>
          |
          +-- Express Backend (http://localhost:3001/v1/agent/health)
              |
              +-- Validate Bearer token
              +-- Tenant middleware resolves tenantId
              +-- Returns response
```

### Implementation

**Client Component:**

```typescript
// Uses proxy, not direct backend call
const API_URL = '/api';

const response = await fetch(`${API_URL}/agent/health`);
// -> Proxied to: /api/agent/health
// -> Forwarded to: http://localhost:3001/v1/agent/health
```

**Proxy Route Handler:**

```typescript
// apps/web/src/app/api/agent/[...path]/route.ts
export async function GET(request: Request) {
  const token = await getBackendToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/v1/agent/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response;
}
```

---

## getBackendToken() Usage

### Function Signature

```typescript
export async function getBackendToken(request?: Request): Promise<string | null>;
```

### When to Pass Request

| Context              | Pass Request? | Example                    |
| :------------------- | :------------ | :------------------------- |
| API Route (route.ts) | YES           | `getBackendToken(request)` |
| Server Component     | NO            | `getBackendToken()`        |
| Client Component     | N/A           | Use `useSession()` instead |

### How It Works

1. **API Routes**: Uses the actual Request object for cookie parsing
2. **Server Components**: Uses `next/headers` to access cookies/headers
3. **Both**: Checks all cookie name variants (HTTPS first)
4. **Returns**: Backend JWT token string, or `null` if not authenticated

### Error Handling

```typescript
const token = await getBackendToken(request);

if (!token) {
  // User not authenticated - handle gracefully
  return new Response('Unauthorized', { status: 401 });
}

// Safe to use token now
```

---

## Session Management

### Server-Side Session Access

```typescript
import { auth } from '@/lib/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // session.user contains: id, email, role, tenantId
  // To get backend token for API calls:
  const token = await getBackendToken();
}
```

### Client-Side Session Access

```typescript
'use client';
import { useSession } from 'next-auth/react';

export function MyComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <Loading />;
  if (!session) return <LoginPrompt />;

  // Access session.user.email, session.user.role, etc.
  // DO NOT try to access backendToken here (it's not exposed)
}
```

### Security Principles

1. **Backend token stays server-side**: Never exposed to client JavaScript
2. **HTTP-only cookies**: Session stored in secure, HTTP-only JWT cookie
3. **API proxy pattern**: Client calls proxy, proxy adds auth header

---

## Common Issues & Solutions

### Issue 1: 401 Unauthorized in Production

**Symptoms:**

- API routes return 401 on production (HTTPS)
- Works fine on localhost (HTTP)
- User is logged in (can access protected routes)

**Root Cause:** Code only checks for `authjs.session-token`, missing `__Secure-` variant

**Solution:**

1. Add `__Secure-authjs.session-token` to cookie name list
2. Check HTTPS variant FIRST
3. Pass request object in API routes

### Issue 2: getBackendToken() Returns Null

**Symptoms:**

- Token lookup fails
- Logs show "No session cookie found"
- Protected pages fail to load

**Diagnosis Checklist:**

- [ ] Check browser cookies (DevTools > Application > Cookies)
- [ ] Verify cookie name matches environment (HTTP vs HTTPS)
- [ ] Check if `__Secure-` prefix is present on HTTPS
- [ ] Verify AUTH_SECRET matches between NextAuth and getToken()

### Issue 3: Chatbot Shows "Assistant Unavailable"

**Symptoms:**

- Chatbot widget displays error message
- Network tab shows 401 to `/v1/agent/*` endpoints

**Root Cause:** Client component calling Express backend directly without auth

**Solution:** Route through API proxy (`/api/agent/*` instead of direct backend URL)

### Issue 4: Token Works in API Route, Fails in Server Component

**Symptoms:**

- API routes get token successfully
- Server Components return null

**Root Cause:** Different request object handling needed

**Solution:**

- API Routes: Pass actual request parameter
- Server Components: Don't pass request, let function use `next/headers`

---

## Code Review Checklist

### Cookie Names

- [ ] `__Secure-authjs.session-token` is checked FIRST
- [ ] Fallback to `authjs.session-token` for HTTP
- [ ] Legacy variants included for backward compatibility

### Request Handling

- [ ] API routes pass `request` to `getBackendToken(request)`
- [ ] Server Components call `getBackendToken()` without params
- [ ] No mock request objects constructed in API routes

### Token Usage

- [ ] Null check before using token
- [ ] Returns 401 (not 500) when unauthenticated
- [ ] Backend token never exposed to client

### Security

- [ ] Backend token not in session object sent to client
- [ ] API proxy pattern used for client-side API calls
- [ ] HTTP-only cookies for session storage

### Testing

- [ ] Tests include HTTPS environment (`__Secure-` prefix)
- [ ] Tests include HTTP environment (no prefix)
- [ ] Staging verification planned before production deploy

---

## Testing Strategy

### Unit Tests

```typescript
describe('getBackendToken', () => {
  it('should find token with __Secure- prefix (HTTPS)', async () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: '__Secure-authjs.session-token=valid-jwt-token',
      },
    });
    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
  });

  it('should find token without prefix (HTTP)', async () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        Cookie: 'authjs.session-token=valid-jwt-token',
      },
    });
    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
  });

  it('should return null when no session cookie found', async () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Cookie: 'other-cookie=value' },
    });
    const token = await getBackendToken(request);
    expect(token).toBeNull();
  });
});
```

### Manual Testing Checklist

**Local Development (HTTP):**

1. Start dev server: `npm run dev:web`
2. Login with test credentials
3. Check cookies: `authjs.session-token` (no prefix)
4. Navigate to protected page - should work
5. Check API route: should return 200

**Staging (HTTPS):**

1. Deploy to staging
2. Login with test credentials
3. Check cookies: `__Secure-authjs.session-token` (with prefix!)
4. Navigate to protected page - should work
5. Check server logs for "No session cookie found" errors

### Pre-Deployment Checklist

```
Before Staging:
[ ] All unit tests passing
[ ] Cookie name variants checked (HTTPS first)
[ ] API routes pass request parameter

Before Production:
[ ] Staging tests passed on HTTPS
[ ] __Secure- cookie verified in browser
[ ] No "No session cookie found" in logs
[ ] Protected routes work for real users
```

---

## Prevention Principles

### Principle 1: Protocol Matters

```
HTTP  -> Cookie without __Secure- prefix
HTTPS -> Cookie WITH __Secure- prefix

This is security-by-design, not a bug.
Always test both protocols.
```

### Principle 2: Check HTTPS First

```
Order: __Secure-authjs -> authjs -> __Secure-next-auth -> next-auth

Production (HTTPS) is more common than local development.
Check production cookie name first.
```

### Principle 3: Real Over Mock

```
API routes: Use real Request object (parameter provided)
Server Components: Use real CookieStore from next/headers

Mock objects fail silently. Real objects work reliably.
```

### Principle 4: Null Is Normal

```
Missing token = user not authenticated (normal)
Missing token ≠ error (don't throw)

Return null gracefully.
Let caller decide what to do.
```

### Principle 5: Test Both Worlds

```
HTTP tests: Verify unprefixed cookie works
HTTPS tests: Verify prefixed cookie works

Local dev works ≠ production works
Test production environment explicitly.
```

---

## Common Mistakes to Avoid

### 1. Only Checking One Cookie Name

```typescript
// WRONG
const token = cookies.get('authjs.session-token')?.value;

// RIGHT
const possibleNames = ['__Secure-authjs.session-token', 'authjs.session-token'];
const cookieName = possibleNames.find((name) => cookies.get(name));
```

### 2. Not Passing Request in API Routes

```typescript
// WRONG
export async function GET(request: Request) {
  const token = await getBackendToken(); // Missing request!
}

// RIGHT
export async function GET(request: Request) {
  const token = await getBackendToken(request);
}
```

### 3. Using getBackendToken() on Client

```typescript
// WRONG
'use client';
import { getBackendToken } from '@/lib/auth';

// RIGHT
('use client');
import { useSession } from 'next-auth/react';
```

### 4. Not Handling Null Return

```typescript
// WRONG
const token = await getBackendToken();
const data = await api.call({ token }); // Crashes if null

// RIGHT
const token = await getBackendToken();
if (!token) {
  return new Response('Unauthorized', { status: 401 });
}
const data = await api.call({ token });
```

### 5. Exposing Backend Token to Client

```typescript
// WRONG - Never do this
return Response.json({ token: backendToken });

// WRONG - Never include in session
session: {
  user: {
    backendToken;
  }
} // Exposed to client!
```

---

## Related Documentation

- **CLAUDE.md**: MAIS-specific patterns and architecture
- **NextAuth.js v5 Official Docs**: https://authjs.dev/
- **MDN Set-Cookie Header**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie

---

## Troubleshooting Quick Reference

| Problem                      | Check                   | Solution                          |
| :--------------------------- | :---------------------- | :-------------------------------- |
| 401 on production            | Cookie name in DevTools | Add `__Secure-` variant           |
| Token is null                | Server logs             | Check cookie name lookup          |
| API fails, session works     | Request parameter       | Pass request to getBackendToken   |
| Chatbot unavailable          | Network tab             | Use API proxy, not direct backend |
| Works locally, fails staging | Protocol                | Test on HTTPS before deploy       |

---

**Consolidated from:**

- `nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md`
- `nextauth-v5-getbackendtoken-cookie-prefix.md`
- `NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md`
- `NEXTAUTH-V5-QUICK-REFERENCE.md`
- `NEXTAUTH-V5-CODE-REVIEW-CHECKLIST.md`
- `NEXTAUTH-V5-PREVENTION-INDEX.md`
- `NEXTAUTH-V5-TESTING-STRATEGY.md`

**Originals archived to:** `docs/archive/solutions-consolidated-20260110/topic-clusters/nextauth-v5/`
