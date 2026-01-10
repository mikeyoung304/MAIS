# Preview Token Authentication Bug - Multi-Agent Analysis Summary

**Date:** 2026-01-10
**Status:** ROOT CAUSES IDENTIFIED - Ready for implementation
**Priority:** P1 - Blocking preview functionality
**Prepared For:** AI Agent Handoff

---

## Executive Summary

The preview token endpoint (`POST /api/tenant-admin/preview-token`) returns 401 "Missing Authorization header" due to **multiple compounding bugs**, not a single issue. Six specialized review agents identified distinct root causes that together explain why 9 previous fix attempts failed.

**Key Insight:** Each previous fix addressed only one layer of the problem. The bugs compound - fixing one reveals the next.

---

## Root Causes Identified (Priority Order)

### 🔴 P1-730: Empty Cookie Value Validation Bug (PRIMARY)

**Location:** `apps/web/src/lib/auth.ts`, lines 349-351

**The Bug:**

```typescript
// CURRENT (BUGGY)
const cookieName = NEXTAUTH_COOKIE_NAMES.find(
  (name) => cookieStore.get(name)?.value !== undefined // Empty string "" passes!
);

// FIXED
const cookieName = NEXTAUTH_COOKIE_NAMES.find((name) => {
  const value = cookieStore.get(name)?.value;
  return value !== undefined && value !== ''; // Reject empty strings
});
```

**Why It Fails:** Manual cookie parsing (lines 320-327) can produce empty strings for malformed cookies. Empty strings pass `!== undefined` check, causing `getToken()` to receive invalid input.

**Evidence:**

- `"authjs.session-token"` (no `=`) → stored as `""`
- `"authjs.session-token="` → stored as `""`
- Check: `"" !== undefined` → `true` (BUG)

---

### 🔴 P1-731: api.client.ts Reads Non-Existent Cookies (SECONDARY)

**Location:** `apps/web/src/lib/api.client.ts`, lines 17-20

**The Bug:**

```typescript
// CURRENT (BROKEN)
const AUTH_COOKIES = {
  ADMIN_TOKEN: 'adminToken', // ← Does NOT exist
  TENANT_TOKEN: 'tenantToken', // ← Does NOT exist
} as const;
```

**Why It Fails:** NextAuth stores the session in `authjs.session-token` (HTTP) or `__Secure-authjs.session-token` (HTTPS). The `backendToken` is INSIDE the encrypted JWT, not a separate cookie. This code reads cookies that were never created.

**Impact:** Any component using `createClientApiClient()` sends no Authorization header.

**Fix Options:**

1. Remove cookie lookup entirely (force proxy pattern)
2. Document as deprecated for authenticated routes

---

### 🟡 P2-732: Inconsistent Error Messages Between Proxies

**Locations:**

- `apps/web/src/app/api/agent/[...path]/route.ts`
- `apps/web/src/app/api/tenant-admin/[...path]/route.ts`

**The Problem:**

```typescript
// Agent proxy returns:
{ available: false, reason: 'not_authenticated', message: '...' }

// Tenant-admin proxy returns:
{ error: 'Unauthorized' }
```

**Impact:** Different error formats make debugging harder. The `reason` field leaks authentication state information.

**Fix:** Create shared error response helper for consistency.

---

### 🟡 P2-733: Rate Limiter Placement Obscures Auth Errors

**Location:** `server/src/routes/tenant-admin.routes.ts`, line 1927

**The Problem:**

```typescript
router.post(
  '/preview-token',
  draftAutosaveLimiter, // ← Runs BEFORE auth check in handler
  async (_req, res, next) => {
    const tenantId = getTenantId(res); // Auth checked HERE
    // ...
  }
);
```

**Impact:** When auth fails, rate limiter still executes (skipping), then handler returns 401. Error message doesn't indicate whether rate limiting contributed.

**Fix:** Add explicit auth middleware before rate limiter.

---

### 🟡 P2-734: Dual Code Paths in getBackendToken()

**Location:** `apps/web/src/lib/auth.ts`, lines 312-377

**The Problem:** Two completely different implementations:

- **Path 1 (with request):** Manual string parsing (buggy, error-prone)
- **Path 2 (without request):** Uses `next/headers()` API (safer, validated)

POST requests use Path 1 (buggy). Server Components use Path 2 (works).

**Fix:** Unify on `NextRequest.cookies` API or `next/headers()`.

---

### 🔵 P3-735: Missing Documentation File

**Location:** `apps/web/src/hooks/usePreviewToken.ts`, line 16

**The Problem:** References `docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md` which doesn't exist.

**Fix:** Create the documentation or update the reference.

---

## Data Flow Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT                                                          │
│ usePreviewToken.ts calls:                                       │
│   fetch('/api/tenant-admin/preview-token', { method: 'POST' })  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ NEXT.JS PROXY (tenant-admin/[...path]/route.ts)                 │
│                                                                 │
│ 1. Receives NextRequest with cookies in header                  │
│ 2. Calls getBackendToken(request)                               │
│    └─► BUGGY PATH: Manual cookie parsing                        │
│    └─► P1-730: Empty string passes validation                   │
│ 3. If token is null → returns 401                               │
│ 4. If token exists → adds Authorization header, forwards        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXPRESS BACKEND (/v1/tenant-admin/preview-token)                │
│                                                                 │
│ 1. tenantAuthMiddleware checks Authorization header             │
│    └─► If missing → throws UnauthorizedError                    │
│    └─► "Missing Authorization header" ← THIS IS THE ERROR       │
│ 2. draftAutosaveLimiter runs (P2-733)                          │
│ 3. Route handler generates preview token                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Previous Fixes Failed

| Attempt | What Was Tried                                  | Why It Failed                                    |
| ------- | ----------------------------------------------- | ------------------------------------------------ |
| 1       | Direct Express call with `credentials: include` | Express expects Bearer header, not cookies       |
| 2       | Read `tenantToken` cookie                       | Cookie doesn't exist (P1-731)                    |
| 3       | Switch to proxy pattern                         | Proxy forwards but cookie parsing fails (P1-730) |
| 4       | Fixed double URL bug                            | Unrelated to auth issue                          |
| 5       | Added auth header injection to api.client.ts    | Still reading non-existent cookies               |
| 6       | Changed proxy to read cookie directly           | Cookie doesn't exist                             |
| 7       | Reverted to getBackendToken()                   | Still has empty string bug                       |
| 8       | Cleared Turbopack cache                         | Bug is in code, not cache                        |
| 9       | Verified proxies are identical                  | Code is identical, but cookie parsing is buggy   |

**Pattern:** Each fix addressed a symptom, not the root cause. The empty cookie validation bug (P1-730) was never identified.

---

## Implementation Plan

### Phase 1: Fix P1 Issues (Blocks Functionality)

**Step 1.1:** Fix empty cookie validation in `getBackendToken()`

```typescript
// File: apps/web/src/lib/auth.ts
// Line: 349-351

// BEFORE
const cookieName = NEXTAUTH_COOKIE_NAMES.find((name) => cookieStore.get(name)?.value !== undefined);

// AFTER
const cookieName = NEXTAUTH_COOKIE_NAMES.find((name) => {
  const value = cookieStore.get(name)?.value;
  if (value === '') {
    logger.debug('Found empty cookie value', { cookieName: name });
  }
  return value !== undefined && value !== '';
});
```

**Step 1.2:** Remove broken cookie lookup from `api.client.ts`

```typescript
// File: apps/web/src/lib/api.client.ts
// Action: Remove lines 17-66 (AUTH_COOKIES constant and getCookie function)
// All authenticated calls should use /api/* proxy pattern
```

**Step 1.3:** Test the fix

```bash
# Start dev servers
npm run dev:all

# Login and navigate to /tenant/build
# Preview panel should load without 401 errors
# Check Network tab: /api/tenant-admin/preview-token → 200
```

### Phase 2: Fix P2 Issues (Reliability)

**Step 2.1:** Unify error response format (P2-732)
**Step 2.2:** Move auth check before rate limiter (P2-733)
**Step 2.3:** Unify cookie parsing code paths (P2-734)

### Phase 3: Documentation (P3)

**Step 3.1:** Create or update referenced documentation file

---

## Files to Modify

| Priority | File                                                   | Change                                    |
| -------- | ------------------------------------------------------ | ----------------------------------------- |
| P1       | `apps/web/src/lib/auth.ts`                             | Fix empty cookie validation (line 349)    |
| P1       | `apps/web/src/lib/api.client.ts`                       | Remove broken cookie lookup (lines 17-66) |
| P2       | `apps/web/src/app/api/agent/[...path]/route.ts`        | Standardize error format                  |
| P2       | `apps/web/src/app/api/tenant-admin/[...path]/route.ts` | Standardize error format                  |
| P2       | `server/src/routes/tenant-admin.routes.ts`             | Add auth check before rate limiter        |
| P3       | `docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md`  | Create missing doc                        |

---

## Verification Checklist

After implementing fixes:

- [ ] `getBackendToken()` rejects empty cookie values
- [ ] `api.client.ts` no longer attempts to read non-existent cookies
- [ ] Preview token endpoint returns 200 for authenticated users
- [ ] Preview iframe loads draft content correctly
- [ ] AI Assistant greeting still loads (regression check)
- [ ] No 401 errors in browser console on /tenant/build page
- [ ] Rate limiting still works for unauthenticated requests

---

## Todo Files Created

All findings are tracked in the `todos/` directory:

```
todos/730-pending-p1-preview-token-empty-cookie-validation.md
todos/731-pending-p1-api-client-nonexistent-cookie-lookup.md
todos/732-pending-p2-inconsistent-error-messages-proxies.md
todos/733-pending-p2-rate-limiter-on-authenticated-endpoint.md
todos/734-pending-p2-dual-code-paths-getbackendtoken.md
todos/735-pending-p3-missing-documentation-file.md
```

---

## Test Credentials

- **Email:** demo@handled-demo.com
- **Password:** demo123!
- **URL:** http://localhost:3000/tenant/build

---

## Related Documentation

- `docs/handoff/2026-01-10-preview-token-auth-handoff.md` - Original handoff (9 failed attempts)
- `docs/solutions/integration-issues/NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md` - Auth architecture
- `docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md` - Related patterns

---

## Agent Instructions

**For the next AI agent:**

1. **Start with P1-730** - This is the primary bug. Fix the empty cookie validation.
2. **Then fix P1-731** - Remove the broken cookie lookup code.
3. **Test after each fix** - The bugs compound, so test incrementally.
4. **Use the todo files** - Each has detailed implementation guidance.
5. **Mark todos complete** - Update status in todo files as you fix each issue.

**Expected outcome:** Preview token endpoint returns 200, preview iframe loads draft content.

---

## Summary

The preview token 401 error is caused by **5 compounding bugs**:

1. Empty cookie values pass validation (P1)
2. Reading non-existent cookies (P1)
3. Inconsistent error messages (P2)
4. Rate limiter placement (P2)
5. Dual code paths for cookie parsing (P2)

Previous fixes failed because they addressed symptoms, not root causes. Fix P1-730 first (empty cookie validation), then P1-731 (remove broken api.client.ts code). The preview should work after these two fixes.
