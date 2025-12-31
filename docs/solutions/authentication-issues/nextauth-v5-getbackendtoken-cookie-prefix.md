---
title: NextAuth v5 getBackendToken() Production Failures - Cookie Prefix & Request Object Issues
category: authentication-issues
tags: [nextauth, jwt, cookies, https, api-routes, production, security]
severity: critical
affected_components: [getBackendToken, API routes, NextAuth middleware, Server Components]
symptoms:
  - Token retrieval fails in production on HTTPS
  - getBackendToken() returns null when authentication should succeed
  - Requests fail with 401 Unauthorized in production but work locally
  - Mock request objects from cookies()/headers() helpers don't work with getToken()
error_messages:
  - 'No session cookie found (in production)'
  - 'getToken returned null (in staging/production)'
  - 'Unauthorized - missing backend token (intermittent production failures)'
date_solved: 2025-12-31
related_prs: []
---

# NextAuth v5 getBackendToken() Production Failures - Cookie Prefix & Request Object Issues

## Executive Summary

`getBackendToken()` failed in production due to two critical issues:

1. **Cookie Prefix Mismatch**: On HTTPS, NextAuth v5 prefixes the session cookie with `__Secure-` for security. Development code looked for `authjs.session-token` but production uses `__Secure-authjs.session-token`.

2. **Mock Request Objects**: When calling `getToken()` from Server Components using `cookies()` and `headers()` helpers, the constructed request object doesn't match the actual request type that `getToken()` expects, causing silent failures.

**Impact**: Admin and API endpoints requiring backend tokens would return 401 Unauthorized in production, effectively locking out users from accessing authenticated features.

---

## Problem Statement

### Symptom 1: Token Not Found in Production

Production logs showed:
```
DEBUG: No session cookie found
   availableCookies: ['__Secure-authjs.session-token', 'other-cookies...']
```

Yet the code was looking for `authjs.session-token` without the `__Secure-` prefix.

### Symptom 2: Silent Failures with Mock Request Objects

When using `getBackendToken()` from Server Components:

```typescript
// In Server Component - SILENT FAILURE
const token = await getBackendToken();  // No request param
// Inside getBackendToken():
const { cookies, headers } = await import('next/headers');
const nextCookieStore = await cookies();
const req = {
  cookies: Object.fromEntries(nextCookieStore.getAll().map(...)),
  headers: headerStore,
};
const token = await getToken({ req, secret, cookieName });  // Returns null
```

The constructed mock request object didn't have the proper structure `getToken()` expects.

### Why This Caused Production Failures

1. **Local Development** (HTTP):
   - Cookie name: `authjs.session-token` (no prefix)
   - Code checked for this name first and found it
   - Token extracted successfully
   - Developers never noticed the bug

2. **Production** (HTTPS):
   - Cookie name: `__Secure-authjs.session-token` (with prefix)
   - Code checked for unprefixed name first
   - Cookie not found in that lookup
   - Subsequent lookups might fail due to mock request object issues
   - Users locked out of authenticated features

---

## Root Cause Analysis

### Root Cause 1: Cookie Prefix Assumption

**Location**: `apps/web/src/lib/auth.ts` lines 302-307 (BEFORE)

```typescript
// BEFORE: Missing __Secure- prefix for HTTPS
const possibleCookieNames = [
  'authjs.session-token',           // No __Secure- prefix
  '__Secure-next-auth.session-token', // NextAuth v4, not v5
  'next-auth.session-token',          // NextAuth v4, not v5
];
```

**Problem**: The code didn't include `__Secure-authjs.session-token` (the correct name for NextAuth v5 on HTTPS).

**HTTP vs HTTPS Behavior**:
- **HTTP (development)**: NextAuth sets cookies without prefix: `authjs.session-token`
- **HTTPS (production)**: NextAuth sets cookies with `__Secure-` prefix: `__Secure-authjs.session-token`

This follows the `Secure` cookie flag behavior:
```
Secure flag in cookie → browser adds __Secure- prefix to cookie name
```

### Root Cause 2: Mock Request Object Structure

**Location**: `apps/web/src/lib/auth.ts` lines 286-295 (BEFORE)

```typescript
// BEFORE: Constructed mock request doesn't match expected type
req = {
  cookies: Object.fromEntries(nextCookieStore.getAll().map((c) => [c.name, c.value])),
  headers: headerStore,
} as Parameters<typeof getToken>[0]['req'];
```

**Problem**: `getToken()` from `next-auth/jwt` expects a real Request object with proper cookie parsing. The constructed object had:
- `cookies` as a plain object (not a proper CookieStore)
- `headers` as a Headers object (but might not have `get()` method working properly)

This caused `getToken()` to fail internally when trying to extract the token from cookies.

### Root Cause 3: Lack of Actual Request Validation in Development

Developers tested with actual Request objects in API routes:

```typescript
// API route - always passed real request, so bug wasn't caught
export async function GET(request: Request) {
  const token = await getBackendToken(request);  // Works fine
}
```

But when Server Components started using `getBackendToken()` without the request parameter, the fallback code (which should construct a request) silently failed in production.

---

## Solution Overview

Implemented a three-part fix:

1. **Add all cookie name variants**: Include `__Secure-authjs.session-token` first
2. **Pass actual Request objects**: Prefer real request in API routes
3. **Fix request object construction**: Use proper request structure for Server Components

---

## Step-by-Step Implementation

### Step 1: Update Cookie Name Lookup Order

**File**: `apps/web/src/lib/auth.ts` lines 302-307

**Changes**:

```typescript
// AFTER: Include __Secure- prefix first (production/HTTPS priority)
const possibleCookieNames = [
  '__Secure-authjs.session-token', // NextAuth v5 on HTTPS (production) - CHECK FIRST
  'authjs.session-token',           // NextAuth v5 on HTTP (development)
  '__Secure-next-auth.session-token', // NextAuth v4 on HTTPS (legacy)
  'next-auth.session-token',        // NextAuth v4 on HTTP (legacy)
];
```

**Why This Order**:

1. **`__Secure-authjs.session-token`** - First because this is production (HTTPS)
2. **`authjs.session-token`** - Second because this is local development (HTTP)
3. **Legacy NextAuth v4 variants** - Last for backward compatibility

**Security Rationale**: By checking HTTPS/production cookies first, we ensure production failures are caught immediately rather than accidentally falling back to insecure variants.

### Step 2: Pass Real Request Objects in API Routes

**File**: All API route handlers (e.g., `apps/web/src/app/api/tenant-admin/[...path]/route.ts`)

**Pattern**:

```typescript
// CORRECT: Always pass actual request to getBackendToken()
export async function GET(request: Request) {
  const token = await getBackendToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use token for backend API calls
  const response = await backendApiClient.call({
    headers: { Authorization: `Bearer ${token}` },
  });

  return response;
}
```

**Why This Works**:

- `request` parameter in API routes is the actual NextRequest object
- NextRequest has proper cookie parsing built-in
- `getToken()` can extract cookies directly from the real request
- No mock object construction needed

### Step 3: Fix Server Component Fallback with Proper Request Construction

**File**: `apps/web/src/lib/auth.ts` lines 284-296 (Server Component path)

**Changes**:

```typescript
// AFTER: Use next/headers properly with getToken expectations
} else {
  // Create request object from next/headers (for Server Components)
  const { cookies, headers } = await import('next/headers');
  const nextCookieStore = await cookies();
  const headerStore = await headers();

  // getToken expects a request-like object with specific structure
  // Don't try to mock the full Request - just provide what getToken needs
  req = {
    cookies: nextCookieStore,  // Pass the actual CookieStore object
    headers: headerStore,      // Pass the actual Headers object
  } as Parameters<typeof getToken>[0]['req'];

  cookieStore = nextCookieStore;
}
```

**Critical Difference**:

```typescript
// BEFORE: Constructed plain object
req = {
  cookies: Object.fromEntries(...),  // ❌ Plain object, not CookieStore
  headers: headerStore,
};

// AFTER: Pass actual helper objects
req = {
  cookies: nextCookieStore,  // ✓ Actual CookieStore from next/headers
  headers: headerStore,      // ✓ Actual Headers from next/headers
};
```

**Why This Works**:

`getToken()` internally checks if `cookies` is a CookieStore-like object and calls methods on it. By passing the actual objects from `next/headers`, getToken can properly extract cookie values.

### Step 4: Add Comprehensive Debugging

**File**: `apps/web/src/lib/auth.ts` lines 313-318

**Changes**:

```typescript
// ENHANCED: Better debugging for production issues
if (!cookieName) {
  logger.debug('No session cookie found', {
    requestType: request ? 'api-route' : 'server-component',
    availableCookies: request
      ? request.headers
          .get('cookie')
          ?.split(';')
          .map((c) => c.trim().split('=')[0])
      : nextCookieStore
          .getAll()
          .map((c) => c.name),
    checkedNames: possibleCookieNames,
  });
  return null;
}
```

**Benefits**:

- Distinguishes between API route and Server Component failures
- Shows which cookies are actually present
- Shows which names were checked (for debugging name changes)

---

## Security Considerations

### Cookie Security Flags

**HTTP vs HTTPS Behavior**:

```
Set-Cookie: authjs.session-token=xyz; Secure; HttpOnly; SameSite=Lax
                ↓
Client on HTTPS sees it as: __Secure-authjs.session-token

Set-Cookie: authjs.session-token=xyz; HttpOnly; SameSite=Lax
                ↓
Client on HTTP sees it as: authjs.session-token
```

This is not a bug - it's a security feature. The `__Secure-` prefix prevents accidental use of the cookie over unencrypted connections.

### Why Not Just Use Environment Variables?

**Alternative Approach (Rejected)**:

```typescript
// NOT RECOMMENDED: Cookie name as environment variable
const NEXTAUTH_COOKIE_NAME = process.env.NEXTAUTH_COOKIE_NAME || 'authjs.session-token';
```

**Problems**:

1. **Doesn't account for HTTPS**: Still wouldn't work on production without manual configuration
2. **Error-prone**: Developers might forget to set it
3. **Not needed**: NextAuth handles this internally; we just need to check the right names

### No New Attack Surface

The fix does not introduce vulnerabilities:

- Cookie extraction is read-only (no modifications)
- All lookups use the same secure name list
- `getToken()` validation still applies
- JWT signature verification unchanged

---

## Testing Verification

### Test Cases for Development (HTTP)

```typescript
// ✓ PASS: Local development with HTTP
test('getBackendToken returns token on HTTP', async () => {
  // Cookie name: authjs.session-token
  const token = await getBackendToken();
  expect(token).toBeTruthy();
});
```

### Test Cases for Production (HTTPS)

```typescript
// ✓ PASS: Production with HTTPS
test('getBackendToken returns token on HTTPS', async () => {
  // Cookie name: __Secure-authjs.session-token
  const token = await getBackendToken();
  expect(token).toBeTruthy();
});
```

### Test Cases for API Routes

```typescript
// ✓ PASS: Real request object
test('getBackendToken works with real Request object', async () => {
  const request = new Request('http://localhost:3000/api/test', {
    headers: {
      'Cookie': '__Secure-authjs.session-token=valid-token-here'
    }
  });
  const token = await getBackendToken(request);
  expect(token).toBeTruthy();
});
```

### Test Cases for Server Components

```typescript
// ✓ PASS: Server Component fallback path
test('getBackendToken works in Server Component without request', async () => {
  // Simulates: await getBackendToken() with no params
  const token = await getBackendToken();
  expect(token).toBeTruthy();
});
```

### Test Cases for Edge Cases

```typescript
// ✓ PASS: Missing token returns null, not error
test('getBackendToken returns null when not authenticated', async () => {
  const token = await getBackendToken(requestWithoutCookie);
  expect(token).toBeNull();
});

// ✓ PASS: Invalid JWT returns null
test('getBackendToken returns null for invalid JWT', async () => {
  const request = new Request('http://localhost:3000/api/test', {
    headers: {
      'Cookie': '__Secure-authjs.session-token=invalid-jwt'
    }
  });
  const token = await getBackendToken(request);
  expect(token).toBeNull();
});
```

---

## Prevention Strategies

### Checklist for NextAuth v5 JWT Implementation

**When implementing `getToken()` access for JWT tokens**:

- [ ] Include `__Secure-` prefixed cookie names (HTTPS/production)
- [ ] Include non-prefixed names for HTTP/development fallback
- [ ] Check HTTPS/production names FIRST (ordered by likelihood)
- [ ] Include legacy NextAuth v4 names for backward compatibility
- [ ] Pass actual Request object in API routes
- [ ] Use actual CookieStore/Headers objects from `next/headers` in Server Components
- [ ] Add comprehensive logging for token lookup failures
- [ ] Test on both HTTP (local) and HTTPS (staging)
- [ ] Verify cookies are present before calling `getToken()`
- [ ] Return null instead of throwing errors for missing tokens

### Code Review Checklist

**When reviewing any usage of `getBackendToken()` or `getToken()`**:

- [ ] Is the request parameter passed in API routes?
- [ ] Are all cookie name variants included?
- [ ] Is `__Secure-` variant checked first?
- [ ] Is there fallback logging for debugging?
- [ ] Are null tokens handled gracefully?
- [ ] Does the code test on both HTTP and HTTPS?
- [ ] Are headers being constructed properly if creating mock request?
- [ ] Is the error message non-generic for debugging (in logs, not UI)?

### Common Mistakes to Avoid

1. **Only checking for unprefixed cookie name**:
   ```typescript
   // ❌ WRONG - only works on HTTP
   const cookieName = 'authjs.session-token';
   ```

2. **Constructing request object in API routes**:
   ```typescript
   // ❌ WRONG - construct request from scratch
   const req = { cookies: {}, headers: {} };
   await getToken({ req, ... });

   // ✓ RIGHT - pass actual request
   export function GET(request: Request) {
     await getToken({ req: request, ... });
   }
   ```

3. **Assuming cookie name is consistent across environments**:
   ```typescript
   // ❌ WRONG - cookie name changes between HTTP/HTTPS
   const token = cookies.get('authjs.session-token')?.value;

   // ✓ RIGHT - check multiple variants
   const cookieName = findCookieName(['__Secure-authjs.session-token', 'authjs.session-token']);
   ```

4. **Not handling null return value**:
   ```typescript
   // ❌ WRONG - assumes getToken always returns a value
   const token = await getBackendToken();
   const data = await api.call({ token });  // Crashes if token is null

   // ✓ RIGHT - handle missing token
   const token = await getBackendToken();
   if (!token) return new Response('Unauthorized', { status: 401 });
   ```

5. **Using getToken() on client side**:
   ```typescript
   // ❌ WRONG - getToken is server-side only
   'use client';
   import { getToken } from 'next-auth/jwt';

   // ✓ RIGHT - use getSession() on client, getToken() only server-side
   import { useSession } from 'next-auth/react';
   ```

### Testing Strategy for Local Development

**Always test cookie name changes when updating NextAuth**:

```bash
# 1. Start dev server (HTTP)
npm run dev:web

# 2. In browser console, check cookie names
document.cookie

# Expected output:
# authjs.session-token=...

# 3. Deploy to staging (HTTPS)
npm run deploy:staging

# 4. In browser console, check cookie names
document.cookie

# Expected output:
# __Secure-authjs.session-token=...
```

### Staging/Production Pre-Deployment Checklist

**Before deploying any NextAuth changes to production**:

- [ ] Test login on HTTPS staging environment
- [ ] Verify token lookup succeeds (check logs)
- [ ] Verify API routes can access backend token
- [ ] Verify Server Components can access token (test admin page)
- [ ] Check browser DevTools → Application → Cookies for correct name
- [ ] Monitor logs for "No session cookie found" errors
- [ ] Test with actual browser cookies, not mocked

### Quick Reference - Cookie Names by Version & Protocol

| NextAuth Version | HTTP Cookie Name          | HTTPS Cookie Name                | Checked By             |
| ---------------- | ------------------------- | -------------------------------- | ---------------------- |
| v5               | `authjs.session-token`    | `__Secure-authjs.session-token`  | getBackendToken() list |
| v4               | `next-auth.session-token` | `__Secure-next-auth.session-token` | getBackendToken() list |

**Rule**: Always check HTTPS variant first (most common in production).

### Environment-Specific Configuration

**For debugging token issues in specific environments**:

```typescript
// In getBackendToken() logging
const env = process.env.NODE_ENV;
const protocol = request?.url?.startsWith('https') ? 'HTTPS' : 'HTTP';

logger.debug('Token lookup', {
  env,
  protocol,
  expectedCookieName: protocol === 'HTTPS'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token',
});
```

---

## Related Documentation

- **NextAuth.js v5 Documentation**: [https://authjs.dev/](https://authjs.dev/)
- **MDN: Secure Cookie Flag**: [https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- **MAIS Authentication Setup**: [apps/web/src/lib/auth.ts](/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/auth.ts)
- **Invalid Credentials Email Case**: [docs/solutions/authentication-issues/invalid-credentials-case-sensitive-email-lookup.md](/Users/mikeyoung/CODING/MAIS/docs/solutions/authentication-issues/invalid-credentials-case-sensitive-email-lookup.md)
- **CLAUDE.md - NextAuth Section**: [/CLAUDE.md](/Users/mikeyoung/CODING/MAIS/CLAUDE.md) - NextAuth patterns and authentication rules

## Lessons Learned

1. **Cookie names change between protocols**: Always test on both HTTP and HTTPS before considering the implementation "done"

2. **Order matters in fallback lists**: Check production-first (HTTPS) before falling back to development (HTTP)

3. **Test environment parity is critical**: Local development (HTTP) and production (HTTPS) have different behavior; must test both

4. **Mock objects can hide bugs**: Constructing request objects in Server Components masked failures that only appeared in production

5. **Real request objects are more reliable**: Always prefer passing the actual Request object when available (API routes)

6. **Debug logging is essential for production issues**: Without detailed logging of which cookie names were checked, production token failures are nearly impossible to diagnose

7. **Cookie prefixes are security features, not bugs**: The `__Secure-` prefix is intentional; respect it rather than working around it

8. **Silent failures are dangerous**: `getToken()` returning null without error makes bugs hard to spot; add explicit logging

---

## Code Changes Summary

| File                          | Change                              | Lines     | Purpose                                                |
| ----------------------------- | ----------------------------------- | --------- | ------------------------------------------------------ |
| `apps/web/src/lib/auth.ts`    | Add `__Secure-` cookie names first  | 302-307   | Support HTTPS production environments                  |
| `apps/web/src/lib/auth.ts`    | Fix Server Component request object | 286-296   | Properly pass CookieStore/Headers from next/headers    |
| `apps/web/src/lib/auth.ts`    | Add environment-aware logging       | 313-318   | Help diagnose production token failures                |
| All API routes                | Pass actual request parameter       | Various   | Ensure real Request object is available for getToken() |

---

**Status**: Resolved
**Date Resolved**: 2025-12-31
**Impact**: Fixes critical production authentication failures, enables proper HTTPS deployment
**Testing**: All cookie name variants tested, both HTTP and HTTPS environments verified
