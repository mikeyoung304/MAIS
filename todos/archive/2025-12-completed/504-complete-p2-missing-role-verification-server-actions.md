# P2: Missing Role Verification in Server Actions (Defense-in-Depth)

## Status

- **Priority:** P2 (Medium - Security)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Security Sentinel

## Problem

Server actions `createTenant`, `updateTenant`, and `deactivateTenant` only check for authentication but do NOT verify the user has `PLATFORM_ADMIN` role.

**Files:**

- `apps/web/src/app/(protected)/admin/tenants/new/actions.ts` (lines 25-26)
- `apps/web/src/app/(protected)/admin/tenants/[id]/actions.ts` (lines 22-26, 67-70)

```typescript
// Current - only checks auth
const token = await getBackendToken();
if (!token) {
  return { success: false, error: 'Not authenticated' };
}
// No role check here
```

**Note:** The backend DOES enforce admin role at `/v1/admin/tenants` routes, so this is defense-in-depth, not a critical vulnerability.

## Impact

Relies entirely on backend for authorization. If backend has a bug or misconfiguration, the Next.js layer won't catch it.

## Solution

Add explicit role verification in server actions:

```typescript
const session = await auth();
if (session?.user?.role !== 'PLATFORM_ADMIN') {
  return { success: false, error: 'Unauthorized' };
}
```

Compare to `impersonateTenant` in `actions.ts` which correctly checks role.

## Tags

`security`, `server-actions`, `defense-in-depth`
