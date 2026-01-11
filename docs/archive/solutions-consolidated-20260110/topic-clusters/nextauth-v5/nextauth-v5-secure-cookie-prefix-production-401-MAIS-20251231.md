---
title: 'NextAuth v5 getBackendToken() Returns Null on Production (Vercel HTTPS) - API Proxy Auth Failure'
category: authentication-issues
tags:
  - nextauth-v5
  - auth-js
  - production
  - vercel
  - https
  - cookie-handling
  - api-proxy
  - chatbot
  - secure-cookie-prefix
severity: P1
date_solved: 2025-12-31
affected_components:
  - apps/web/src/lib/auth.ts
  - apps/web/src/app/api/tenant-admin/[...path]/route.ts
  - apps/web/src/app/api/agent/[...path]/route.ts
  - apps/web/src/app/api/tenant/landing-page/route.ts
  - CustomerChatWidget.tsx
symptoms:
  - All authenticated API routes return 401 Unauthorized on production
  - getBackendToken() returns null despite user being logged in
  - Chatbot widget displays "Assistant Unavailable" on Vercel
  - Session authentication works (user can access protected routes)
  - Local development works fine, production fails
  - Issue only occurs on HTTPS (production), not HTTP
error_messages:
  - '401 Unauthorized from API proxy routes'
  - '"Assistant Unavailable" in chatbot widget'
  - 'Health check failed, attempting session init...'
root_causes:
  - NextAuth v5 uses __Secure-authjs.session-token on HTTPS (not authjs.session-token)
  - Mock request from cookies()/headers() utilities does not work with getToken()
  - Need actual NextRequest object to properly parse cookies in API routes
environment:
  - Platform: Vercel (HTTPS)
  - Framework: Next.js 14 App Router
  - Auth: NextAuth v5 (Auth.js) beta.30
  - Backend: Express on Render
related_docs:
  - docs/solutions/integration-issues/NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md
  - docs/solutions/nextjs-chatbot-direct-api-auth-bypass-MAIS-20251230.md
  - docs/solutions/integration-issues/nextjs-client-api-proxy-authentication-MAIS-20251228.md
  - docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md
commits:
  - 9346d8a: Handle secure cookie prefix for NextAuth v5 on HTTPS
  - e31a599: Pass request object to getBackendToken in API routes
---

# NextAuth v5 Secure Cookie Prefix Production 401 Fix

## Problem Summary

After deploying to Vercel (HTTPS), all authenticated API proxy calls returned 401 Unauthorized. The chatbot showed "Assistant Unavailable" and dashboard stats failed to load. Local development (HTTP) worked perfectly.

**Key Symptom**: User was logged in (could access protected routes via middleware), but all `/api/*` proxy routes failed authentication.

## Root Cause Analysis

NextAuth v5 introduced a security feature where session cookies are automatically prefixed with `__Secure-` when running on HTTPS (production environments like Vercel). This follows the HTTP cookie specification for secure cookies.

The original `getBackendToken()` implementation had two critical issues:

### Issue 1: Cookie Name Mismatch

The function only checked for `authjs.session-token` and `next-auth.session-token`, completely missing the `__Secure-` prefixed variants:

```typescript
// BROKEN: Only checked non-prefixed names
const cookieName =
  cookieStore.get('authjs.session-token')?.value !== undefined
    ? 'authjs.session-token'
    : 'next-auth.session-token';
```

On Vercel HTTPS, the actual cookie name is `__Secure-authjs.session-token`, so the lookup always failed.

### Issue 2: Mock Request Object Limitation

The function created a synthetic request object from `cookies()`/`headers()` helpers:

```typescript
// BROKEN: Mock request didn't work with getToken()
const req = {
  cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
  headers: headerStore,
};
```

This mock object worked differently than a real NextRequest, causing NextAuth's `getToken()` function to fail internally even when the correct cookie name was found.

## Solution

### Fix 1: Check All Cookie Name Variations (Commit 9346d8a)

```typescript
const possibleCookieNames = [
  '__Secure-authjs.session-token', // NextAuth v5 on HTTPS (production)
  'authjs.session-token', // NextAuth v5 on HTTP (development)
  '__Secure-next-auth.session-token', // NextAuth v4 on HTTPS
  'next-auth.session-token', // NextAuth v4 on HTTP
];

// Find which cookie name is actually present
const cookieName = possibleCookieNames.find((name) => cookieStore.get(name)?.value !== undefined);
```

### Fix 2: Pass Real Request Object (Commit e31a599)

Modified `getBackendToken()` to accept an optional `Request` parameter:

```typescript
export async function getBackendToken(request?: Request): Promise<string | null> {
  let req: Parameters<typeof getToken>[0]['req'];
  let cookieStore: { get: (name: string) => { value: string } | undefined };

  if (request) {
    // Use the actual request object from API route handlers
    req = request as Parameters<typeof getToken>[0]['req'];
    // Parse cookies directly from request headers
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
    // Fallback for Server Components (no request available)
    const { cookies, headers } = await import('next/headers');
    const nextCookieStore = await cookies();
    const headerStore = await headers();
    req = {
      cookies: Object.fromEntries(nextCookieStore.getAll().map((c) => [c.name, c.value])),
      headers: headerStore,
    } as Parameters<typeof getToken>[0]['req'];
    cookieStore = nextCookieStore;
  }
  // ... rest uses same cookie name detection
}
```

### Fix 3: Update API Route Handlers

All API routes now pass the request object:

```typescript
// Before (broken)
const token = await getBackendToken();

// After (fixed)
const token = await getBackendToken(request);
```

## Prevention Strategies

### Prevention Checklist

When implementing NextAuth JWT access:

- [ ] Always check both `__Secure-` prefixed and non-prefixed cookie names
- [ ] Pass actual `NextRequest` object in API route handlers
- [ ] Test on HTTPS (production-like) environment before deploying
- [ ] Add debug logging for cookie detection failures

### Code Review Checklist

When reviewing code that uses `getToken()` or `getBackendToken()`:

- [ ] Verify cookie name handles secure prefix variants
- [ ] Check if API routes pass request object
- [ ] Look for mock request object creation that may not work with NextAuth

### Quick Reference

| Environment                | Cookie Name                        |
| -------------------------- | ---------------------------------- |
| Development (HTTP)         | `authjs.session-token`             |
| Production (HTTPS)         | `__Secure-authjs.session-token`    |
| Legacy NextAuth v4 (HTTP)  | `next-auth.session-token`          |
| Legacy NextAuth v4 (HTTPS) | `__Secure-next-auth.session-token` |

### One-Liners

- "NextAuth v5 on HTTPS: Cookie is `__Secure-authjs.session-token`"
- "API routes: Always pass `request` to `getBackendToken(request)`"
- "Session works but API fails? Check cookie prefix!"

## Verification

The fix was verified by:

1. Logging out and back in on production
2. Confirming chatbot displays greeting message instead of "Assistant Unavailable"
3. Dashboard stats (packages, bookings) loading correctly
4. No more 401 errors in browser console

## Files Modified

| File                                                   | Change                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `apps/web/src/lib/auth.ts`                             | Added cookie name variations, optional request parameter |
| `apps/web/src/app/api/tenant-admin/[...path]/route.ts` | Pass request to getBackendToken                          |
| `apps/web/src/app/api/agent/[...path]/route.ts`        | Pass request to getBackendToken                          |
| `apps/web/src/app/api/tenant/landing-page/route.ts`    | Pass request to getBackendToken                          |

## Related Documentation

- [NextAuth Backend Token Security](../integration-issues/NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md) - HTTP-only JWT cookie design
- [Next.js Chatbot Direct API Auth Bypass](../nextjs-chatbot-direct-api-auth-bypass-MAIS-20251230.md) - Why client components can't access tokens
- [Next.js Client API Proxy Authentication](../integration-issues/nextjs-client-api-proxy-authentication-MAIS-20251228.md) - API proxy pattern
- [Quick Reference](../NEXTJS_CLIENT_API_QUICK_REFERENCE.md) - Handy desk reference
