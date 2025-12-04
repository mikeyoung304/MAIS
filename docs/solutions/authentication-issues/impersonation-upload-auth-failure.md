---
title: Platform Admin Impersonation Upload Auth Failures
category: authentication-issues
severity: high
component: client/authentication
tags: [impersonation, file-uploads, token-management, multi-tenant, route-paths, localStorage]
date_solved: 2025-11-29
symptoms:
  - "Authentication required" errors when platform admin impersonates tenant and attempts photo uploads
  - Upload buttons fail with ApiError in console during impersonation
  - Multiple upload components affected (photos, logo, images)
root_cause: |
  Multiple client-side upload modules were checking only `localStorage.getItem('tenantToken')`
  for authentication. When a platform admin impersonates a tenant, the token is stored in
  `adminToken` with impersonation state indicated by `impersonationTenantKey`. Additionally,
  package-photo-api.ts had wrong route paths: `/v1/tenant/admin/` instead of `/v1/tenant-admin/`.
---

# Platform Admin Impersonation Upload Auth Failures

## Problem

When a Platform Admin impersonates a tenant and attempts to upload, delete, or retrieve package photos, the API calls fail with **"Authentication required"** errors (HTTP 401). This prevents admins from managing tenant resources while in impersonation mode.

**User Impact:**

- Platform admins cannot perform photo uploads for impersonated tenants
- The impersonation feature becomes partially unusable for photo management
- Console shows `ApiError: Authentication required` in upload functions

**Error trace:**

```
installHook.js:1 Failed to load package photos: ApiError: Authentication required
    at Object.getPackageWithPhotos (TenantAdminDashboard-5eOE9jz0.js:36:13065)
```

## Investigation

### Step 1: Error Trace

The browser console showed `ApiError: Authentication required` exceptions in:

- `packagePhotoApi.getPackageWithPhotos()`
- `packagePhotoApi.uploadPhoto()`

### Step 2: Authentication Token Source

Traced to `client/src/lib/package-photo-api.ts` line 69:

```typescript
// BEFORE - Only checked tenant token
function getAuthToken(): string | null {
  return localStorage.getItem('tenantToken');
}
```

This function had no awareness of the impersonation state.

### Step 3: Central API Client Analysis

The main ts-rest API client (`client/src/lib/api.ts` lines 138-154) **already handled impersonation correctly**:

```typescript
if (path.includes('/v1/tenant-admin')) {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    const token = localStorage.getItem('adminToken');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  } else {
    const token = tenantToken || localStorage.getItem('tenantToken');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }
}
```

### Step 4: Identify Direct Fetch Bypasses

Found 5 files bypassing the central API client with direct `fetch()` calls:

1. `client/src/lib/package-photo-api.ts`
2. `client/src/features/photos/hooks/usePhotoUpload.ts`
3. `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx`
4. `client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx`
5. `client/src/components/ImageUploadField.tsx`

### Step 5: Route Path Issues

Also discovered wrong route paths in `package-photo-api.ts`:

- **Wrong:** `/v1/tenant/admin/packages/...`
- **Correct:** `/v1/tenant-admin/packages/...`

## Root Cause

**Primary Cause - Missing Impersonation Logic:**
The `getAuthToken()` helper only checked for `tenantToken`. It didn't account for the impersonation state.

When a platform admin impersonates a tenant:

1. `localStorage.impersonationTenantKey` is set to the tenant's public API key
2. `localStorage.adminToken` is updated with an impersonation-context token
3. `localStorage.tenantToken` remains empty (no actual tenant login occurred)
4. Calls to `getAuthToken()` return `null`, triggering 401 errors

**Secondary Cause - Route Path Typo:**
The direct fetch calls used `/v1/tenant/admin/` instead of `/v1/tenant-admin/`, which would cause 404 errors even with correct auth.

## Solution

### Implementation

Updated `getAuthToken()` in all 5 files to check for impersonation state:

```typescript
/**
 * Get authentication token from localStorage
 * Handles both normal tenant auth and platform admin impersonation
 * @returns JWT token or null if not authenticated
 */
function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;

  // Check if platform admin is impersonating a tenant
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    // Use admin token which contains impersonation context
    return localStorage.getItem('adminToken');
  }
  // Normal tenant admin - use tenant token
  return localStorage.getItem('tenantToken');
}
```

### Route Path Fixes

Corrected all 4 API endpoint paths in `package-photo-api.ts`:

```diff
- `${baseUrl}/v1/tenant/admin/packages/${packageId}/photos`
+ `${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`
```

## Code Changes

### Files Modified

| File                                                                        | Changes                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------- |
| `client/src/lib/package-photo-api.ts`                                       | Updated `getAuthToken()` + fixed 4 route paths |
| `client/src/features/photos/hooks/usePhotoUpload.ts`                        | Added `getAuthToken()` helper                  |
| `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` | Added `getAuthToken()` helper                  |
| `client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx`    | Added `getAuthToken()` helper                  |
| `client/src/components/ImageUploadField.tsx`                                | Added `getAuthToken()` helper                  |

### Example Diff (package-photo-api.ts)

```diff
function getAuthToken(): string | null {
+ // Check if platform admin is impersonating a tenant
+ const isImpersonating = localStorage.getItem('impersonationTenantKey');
+ if (isImpersonating) {
+   // Use admin token which contains impersonation context
+   return localStorage.getItem('adminToken');
+ }
+ // Normal tenant admin - use tenant token
  return localStorage.getItem('tenantToken');
}
```

## Prevention Strategies

### What Patterns to Avoid

1. **Direct `localStorage.getItem('tenantToken')` without impersonation check**

   ```typescript
   // BAD - Ignores impersonation
   const token = localStorage.getItem('tenantToken');
   ```

2. **Direct `fetch()` calls to tenant-admin routes**

   ```typescript
   // BAD - Bypasses centralized auth
   fetch(`${baseUrl}/v1/tenant-admin/...`, { headers: { Authorization: token } });
   ```

3. **Duplicating auth logic across files**
   - Creates maintenance burden
   - Risk of inconsistent updates

### What Patterns to Follow

1. **Use centralized API client for tenant-admin routes**

   ```typescript
   // GOOD - Uses ts-rest client with automatic auth
   const result = await api.tenantAdminGetPackages();
   ```

2. **If direct fetch is required, import centralized helper**
   ```typescript
   // GOOD - Centralized auth logic
   import { getAuthToken } from '@/lib/auth';
   const token = getAuthToken();
   ```

### Code Review Checklist

- [ ] No direct `localStorage.getItem('tenantToken')` without impersonation check
- [ ] Direct `fetch()` calls to `/v1/tenant-admin/` use proper auth helper
- [ ] Route paths use `/v1/tenant-admin/` (hyphen, not slash)
- [ ] New API endpoints added to ts-rest contracts when possible
- [ ] Auth logic not duplicated - imported from central location

### Testing Recommendations

**E2E Test Scenario:**

```typescript
test('platform admin can upload photo while impersonating tenant', async ({ page }) => {
  // 1. Login as platform admin
  await loginAsPlatformAdmin(page);

  // 2. Navigate to tenants, click impersonate
  await page.click('[data-testid="impersonate-tenant-btn"]');

  // 3. Navigate to package photos
  await page.goto('/tenant/dashboard');
  await page.click('[data-testid="packages-tab"]');

  // 4. Upload a photo
  await page.setInputFiles('input[type="file"]', 'test-image.jpg');

  // 5. Verify success (no auth errors)
  await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
});
```

## Related Documentation

- `docs/solutions/ui-bugs/impersonation-sidebar-navigation-bug.md` - Related impersonation navigation fix
- `docs/prevention-strategies/IMPERSONATION_PREVENTION_SUMMARY.md` - Impersonation prevention overview
- `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Multi-tenant architecture
- `client/src/contexts/AuthContext/AuthProvider.tsx` - Auth context with `isImpersonating()`

## See Also

### Similar Issues

- Components using `user.role` without `isImpersonating()` check
- Cache keys without `tenantId` causing cross-tenant leakage
- Email case sensitivity in authentication

### Follow-up Tasks (P2)

- `todos/071-pending-p2-getauthtoken-code-duplication.md` - Centralize `getAuthToken()` in `auth.ts`
- `todos/072-pending-p2-direct-fetch-bypasses-api-client.md` - Migrate to ts-rest client

## Verification

**Before Fix:**

- Admin impersonates tenant → Upload fails with 401

**After Fix:**

- Admin impersonates tenant → `getAuthToken()` detects `impersonationTenantKey` → returns `adminToken` → Upload succeeds
