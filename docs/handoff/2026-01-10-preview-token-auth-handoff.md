# Preview Token Auth Bug - Complete Handoff Report

**Date:** 2026-01-10
**Status:** STUCK - Root cause not yet identified
**Priority:** P1 - Blocking preview functionality

---

## Problem Statement

The preview token system in `/tenant/build` returns 401 "Missing Authorization header" errors, preventing the draft preview panel from loading correctly. The AI Assistant works intermittently but also shows 401/429 errors.

**Error message displayed:**

```
Failed to fetch preview token: {"status":"error","statusCode":401,"error":"UNAUTHORIZED","message":"Missing Authorization header","requestId":"..."}
```

---

## What We Know For Sure

1. **The error "Missing Authorization header" comes from Express backend** - not from the Next.js proxy
2. **The AI Assistant greeting DOES load** - so `getBackendToken()` works for at least some requests
3. **The preview iframe loads the storefront** - even though the preview token fetch fails
4. **Rate limiting (429) is also occurring** on `/api/agent/*` endpoints
5. **Both proxies use identical code patterns** - agent proxy and tenant-admin proxy both use `getBackendToken(request)`

---

## Everything We Tried (Chronologically)

### Attempt 1: Direct Express Call with Cookie Auth

**File:** `usePreviewToken.ts`
**What:** Added `credentials: 'include'` to send cookies directly to Express
**Result:** Failed - Express backend expects `Authorization: Bearer` header, not cookies

### Attempt 2: Read tenantToken Cookie in Hook

**File:** `usePreviewToken.ts`
**What:** Added `getCookie('tenantToken')` helper and manually added Authorization header
**Result:** Failed - `tenantToken` cookie doesn't exist; users authenticate via NextAuth which uses different cookie

### Attempt 3: Switch to Proxy Pattern

**File:** `usePreviewToken.ts`
**What:** Changed from `fetch(API_URL + '/v1/tenant-admin/preview-token')` to `fetch('/api/tenant-admin/preview-token')`
**Result:** Still fails with 401 - proxy is forwarding but somehow without Authorization header

### Attempt 4: Fixed Double URL Bug

**File:** `api.client.ts`
**What:** ts-rest was doubling URLs (`http://localhost:3001http://localhost:3001/...`) because `baseUrl` and manual `API_URL` prefix
**Result:** Fixed the double URL issue, but preview token still fails

### Attempt 5: Added Auth Header Injection to api.client.ts

**File:** `api.client.ts`
**What:** Added `getCookie()` helper and inject `Authorization: Bearer ${tenantToken}` based on route
**Result:** `tenantToken` cookie still doesn't exist; auth goes through NextAuth not direct cookies

### Attempt 6: Check/Fix Tenant-Admin Proxy

**File:** `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
**What:** Changed proxy to read `tenantToken` cookie directly instead of `getBackendToken()`
**Result:** Failed - "No tenant token found in cookies" because cookie doesn't exist

### Attempt 7: Revert Proxy to Use getBackendToken()

**File:** `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
**What:** Reverted to use `getBackendToken(request)` - same as working agent proxy
**Result:** Still fails - Express still reports "Missing Authorization header"

### Attempt 8: Clear Turbopack Cache + Restart

**Action:** `rm -rf apps/web/.next apps/web/.turbo` and restart dev server
**Result:** Server logs still showed old message "No tenant token found in cookies" initially, then new code ran. Still 401 errors.

### Attempt 9: Verified Both Proxies Are Identical

**Files:** `api/agent/[...path]/route.ts` vs `api/tenant-admin/[...path]/route.ts`
**Finding:** Both use exactly the same pattern:

```typescript
const token = await getBackendToken(request);
if (!token) {
  return 401;
}
const headers = { Authorization: `Bearer ${token}` };
fetch(backendUrl, { method, headers, body });
```

**Mystery:** Agent proxy sometimes works (AI Assistant greeting loads), tenant-admin proxy never works

---

## Current State of Modified Files

### 1. `apps/web/src/hooks/usePreviewToken.ts`

Now uses proxy pattern (correct):

```typescript
async function fetchPreviewToken(): Promise<PreviewTokenResponse> {
  const response = await fetch('/api/tenant-admin/preview-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  // ...
}
```

### 2. `apps/web/src/lib/api.client.ts`

Fixed double URL bug and added cookie-based auth injection:

```typescript
// Fixed: use path directly (ts-rest prepends baseUrl)
const response = await fetch(path, { ... });

// Added cookie reading for direct API calls
function getCookie(name: string): string | undefined { ... }
const tenantToken = getCookie(AUTH_COOKIES.TENANT_TOKEN);
if (path.includes('/v1/tenant-admin') && tenantToken) {
  requestHeaders['Authorization'] = `Bearer ${tenantToken}`;
}
```

### 3. `apps/web/src/app/api/tenant-admin/[...path]/route.ts`

Uses getBackendToken (same as agent proxy):

```typescript
const token = await getBackendToken(request);
if (!token) {
  logger.debug('Tenant admin proxy: No backend token in session');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const headers: HeadersInit = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
};
```

---

## Key Observations & Mysteries

### Mystery 1: Agent Proxy Works, Tenant-Admin Doesn't

- Both proxies use `getBackendToken(request)`
- Both add `Authorization: Bearer ${token}` header
- AI Assistant greeting loads (uses agent proxy)
- Preview token fails (uses tenant-admin proxy)
- **Why would identical code produce different results?**

### Mystery 2: Express Error vs Proxy Error

- If `getBackendToken()` returned null, the proxy would return `{ error: 'Unauthorized' }` (our message)
- But we see `{ message: 'Missing Authorization header' }` (Express message)
- This means the request IS reaching Express, but without the header
- **Implies token exists but header not being set somehow?**

### Mystery 3: Inconsistent Behavior

- Sometimes agent endpoints work (AI greeting shows)
- Sometimes they fail (429 rate limit or "Assistant Unavailable")
- Could be timing/race condition related to session cookie availability

---

## Hypotheses To Investigate

### Hypothesis A: POST vs GET Difference

- Preview token uses POST to `/api/tenant-admin/preview-token`
- Agent health uses GET to `/api/agent/health`
- Maybe POST requests handle cookies differently in Next.js App Router?

### Hypothesis B: Cookie Name Mismatch

- `getBackendToken()` searches for cookies in order: `__Secure-authjs.session-token`, `authjs.session-token`, etc.
- Maybe the cookie name varies between secure/non-secure contexts
- Maybe localhost has different cookie behavior

### Hypothesis C: Token Extraction Bug

- `getBackendToken()` line 376: `return (token as MAISJWT).backendToken || null;`
- If `backendToken` is empty string, this returns null → proxy returns its own 401
- But we see Express error → token exists but is invalid?

### Hypothesis D: NextAuth Session Not Fully Established

- User is logged in (can see dashboard, AI greeting)
- But JWT token extraction might fail for certain request patterns
- Maybe the session cookie isn't being sent with POST requests from client components?

### Hypothesis E: Content-Type Header Issue

- Preview token POST sends `Content-Type: application/json`
- Maybe this affects how cookies are sent?
- Agent GET requests don't send Content-Type

---

## Files To Investigate

1. **`apps/web/src/lib/auth.ts`** - `getBackendToken()` function, cookie name lookup
2. **`apps/web/src/lib/auth-constants.ts`** - `NEXTAUTH_COOKIE_NAMES` array
3. **`server/src/middleware/tenant.ts`** - Express auth middleware that generates error
4. **`server/src/routes/tenant-admin.routes.ts`** - preview-token endpoint handler
5. **Network tab in browser** - Check if cookies are being sent with the request

---

## Test Credentials

- **Email:** demo@handled-demo.com
- **Password:** demo123!
- **URL:** http://localhost:3000/tenant/build

---

## Recommended Next Steps

1. **Add verbose logging to `getBackendToken()`** - Log exactly what cookies are present, what token is returned
2. **Add logging to tenant-admin proxy BEFORE fetch** - Log the headers object to confirm Authorization is set
3. **Check browser Network tab** - See if cookies are being sent with the POST request to `/api/tenant-admin/preview-token`
4. **Compare request headers** - Use browser dev tools to compare headers between working agent request and failing tenant-admin request
5. **Check if it's a POST-specific issue** - Try changing preview-token to GET temporarily

---

## Server Logs (Recent)

Shows requests reaching Express but returning 401:

```
[35murl[39m: "/v1/tenant-admin/preview-token"
[35mstatusCode[39m: 401
```

Also shows rate limiting:

```
GET /api/agent/health 429 in 15ms
GET /api/agent/session 429 in 16ms
```

---

## Related Documentation

- `docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md` - Proxy pattern
- `docs/solutions/integration-issues/NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md` - Auth architecture
- `docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md` - Cache issues

---

## Summary

We've verified the code is correctly structured (proxy pattern, getBackendToken, Authorization header) but something is preventing the Authorization header from reaching Express on tenant-admin requests specifically, while agent requests sometimes work. The root cause remains unknown - could be cookie handling, POST vs GET, session timing, or something else entirely.

**The next agent should focus on adding detailed logging to trace exactly what happens between:**

1. Client makes request to `/api/tenant-admin/preview-token`
2. Proxy receives request
3. `getBackendToken()` is called
4. What token (if any) is returned
5. What headers are set on the fetch to Express
6. What Express receives
