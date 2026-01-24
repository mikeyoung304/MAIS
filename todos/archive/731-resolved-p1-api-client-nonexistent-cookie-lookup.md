---
status: complete
priority: p1
issue_id: '731'
resolution_date: '2026-01-10'
tags:
  - code-review
  - authentication
  - data-integrity
dependencies: []
---

# P1: api.client.ts Reads Non-Existent Cookies

## Problem Statement

The `api.client.ts` file attempts to read authentication tokens from cookies (`adminToken`, `tenantToken`) that NextAuth never creates. This causes all direct API calls from client components to fail authentication silently.

## Why It Matters

- **User Impact**: Any client component using `createClientApiClient()` will fail to authenticate
- **Architecture Impact**: Contradicts the documented proxy pattern for secure API calls
- **Confusion Impact**: Identical-looking code fails for some routes, works for others

## Findings

### Root Cause (Data Integrity Guardian)

**Location**: `apps/web/src/lib/api.client.ts`, lines 17-20

```typescript
const AUTH_COOKIES = {
  ADMIN_TOKEN: 'adminToken', // ← DOESN'T EXIST
  TENANT_TOKEN: 'tenantToken', // ← DOESN'T EXIST
} as const;
```

### The Real Cookie Names

NextAuth stores session in:

- `authjs.session-token` (HTTP/development)
- `__Secure-authjs.session-token` (HTTPS/production)

The `backendToken` is stored INSIDE the encrypted JWT, not as a separate cookie.

### Impact Analysis

| Component         | Uses Cookie            | Exists? | Result              |
| ----------------- | ---------------------- | ------- | ------------------- |
| api.client.ts     | `tenantToken`          | ❌ NO   | No auth header sent |
| api.client.ts     | `adminToken`           | ❌ NO   | No auth header sent |
| getBackendToken() | `authjs.session-token` | ✅ YES  | Works correctly     |

## Proposed Solutions

### Option A: Remove cookie lookup entirely (Recommended)

**Pros**: Forces use of proxy pattern (more secure), simplifies code
**Cons**: Breaking change if anything relies on direct API calls
**Effort**: Medium (audit all usages)
**Risk**: Medium

```typescript
// Remove lines 17-66 entirely
// Client components MUST use /api/* proxy routes
export function createClientApiClient() {
  return initClient(Contracts, {
    baseUrl: '', // Relative URLs only - goes through proxy
    // No auth header injection - proxy handles it
  });
}
```

### Option B: Document and deprecate

**Pros**: Non-breaking, gives time to migrate
**Cons**: Leaves broken code in place
**Effort**: Small
**Risk**: Low

```typescript
/**
 * @deprecated DO NOT USE for authenticated routes.
 * Use /api/tenant-admin/* proxy instead which handles auth securely.
 * This client is only for public unauthenticated endpoints.
 */
export function createClientApiClient() { ... }
```

### Option C: Fix by using proper cookie name + warn

**Pros**: Might work for some scenarios
**Cons**: backendToken is encrypted in JWT, can't be read client-side anyway
**Effort**: Small
**Risk**: High (false sense of security)

NOT RECOMMENDED - backendToken is intentionally HTTP-only and encrypted.

## Recommended Action

**Option A** - Remove the broken cookie lookup. The proxy pattern is the correct architecture.

## Technical Details

### Affected Files

- `apps/web/src/lib/api.client.ts`
- Any component using `createClientApiClient()`

### Files That Use createClientApiClient

Need to audit for usages - they all need to switch to proxy pattern.

## Acceptance Criteria

- [ ] `api.client.ts` no longer attempts to read non-existent cookies
- [ ] All authenticated API calls use proxy pattern
- [ ] ESLint rule or deprecation warning added for direct API calls
- [ ] Preview token endpoint works after fix

## Work Log

| Date       | Action                                                                                                | Learnings                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-01-10 | Issue identified via multi-agent review                                                               | NextAuth stores backendToken in encrypted JWT, not separate cookie          |
| 2026-01-10 | **FIXED**: Removed broken cookie lookup (AUTH_COOKIES + getCookie). Simplified to proxy pattern only. | Added comprehensive JSDoc explaining why proxy pattern is required for auth |

## Resources

- **Related Doc**: `docs/solutions/integration-issues/NEXTAUTH-BACKEND-TOKEN-SECURITY-API-PROXY-MAIS-20251230.md`
- **Proxy Pattern**: `docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md`
