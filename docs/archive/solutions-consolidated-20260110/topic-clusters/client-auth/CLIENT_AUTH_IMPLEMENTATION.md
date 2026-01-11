# Client Authentication Implementation Guide

**Implementation steps to fix the authentication bypass vulnerability.**

---

## Overview

This guide walks through the actual code changes needed to fix the client-side authentication bypass.

**Timeline:** 2-3 days
**Risk:** Low (internal refactoring, maintains behavior)
**Testing:** Unit + E2E tests provided

---

## Step 1: Add getAuthToken() to Central Auth Module

**File:** `client/src/lib/auth.ts`

Add this function at the end of the file:

````typescript
/**
 * Get the correct authentication token for API requests
 *
 * During platform admin impersonation:
 * - Returns adminToken which contains impersonation context
 *
 * During normal tenant operation:
 * - Returns tenantToken scoped to the tenant
 *
 * CRITICAL: Use this function for ALL authenticated requests
 * instead of directly accessing localStorage.
 *
 * @returns JWT token string or null if not authenticated
 * @throws Error if neither token is available but auth is required
 *
 * @example
 * ```typescript
 * const token = getAuthToken();
 * if (!token) {
 *   throw new Error('Authentication required');
 * }
 * const headers = { 'Authorization': `Bearer ${token}` };
 * ```
 */
export function getAuthToken(): string | null {
  // Check if platform admin is impersonating a tenant
  // This is the critical piece that was missing in 5 files
  const impersonationKey = localStorage.getItem('impersonationTenantKey');

  if (impersonationKey) {
    // Use admin token which contains impersonation context
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      return adminToken;
    }
  }

  // Normal tenant admin - use tenant token
  const tenantToken = localStorage.getItem('tenantToken');
  if (tenantToken) {
    return tenantToken;
  }

  // Not authenticated
  return null;
}
````

**Verify:**

```bash
# Check it compiles
npm run typecheck

# Check auth.ts exports the function
grep "export function getAuthToken" client/src/lib/auth.ts
```

---

## Step 2: Create Authenticated Fetch Wrapper

**File:** `client/src/lib/fetch-client.ts` (NEW FILE)

Create this new file:

````typescript
/**
 * Type-safe fetch wrapper for authenticated API calls
 *
 * Automatically injects Authorization header with the correct token
 * (handles both normal tenant auth and platform admin impersonation).
 *
 * Use this instead of raw fetch() for any request to authenticated endpoints.
 *
 * @example
 * ```typescript
 * import { authenticatedFetch } from '@/lib/fetch-client';
 *
 * // GET request
 * const { status, body } = await authenticatedFetch('/v1/tenant-admin/packages');
 *
 * // POST request with FormData
 * const formData = new FormData();
 * formData.append('photo', file);
 * const { status, body } = await authenticatedFetch(
 *   `/v1/tenant-admin/packages/${id}/photos`,
 *   { method: 'POST', body: formData }
 * );
 * ```
 */

import { getAuthToken } from './auth';

/**
 * Response from authenticated fetch
 */
export interface AuthenticatedFetchResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Parsed response body (null if response is not JSON or failed to parse) */
  body: T | null;
  /** Response headers */
  headers: Headers;
}

/**
 * Options for authenticated fetch (extends RequestInit)
 */
export interface AuthenticatedFetchOptions extends Omit<RequestInit, 'headers'> {
  /** Additional headers to merge with Authorization header */
  headers?: Record<string, string>;
}

/**
 * Make an authenticated fetch request
 *
 * Automatically injects the Authorization header with the correct JWT token.
 * During impersonation, uses the admin token. During normal operation, uses tenant token.
 *
 * @param url - URL to fetch from
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Response with status, parsed body, and headers
 * @throws Error if authentication is required but token is not available
 *
 * @example
 * ```typescript
 * // GET request
 * const { status, body } = await authenticatedFetch('/v1/tenant-admin/packages');
 *
 * // POST with JSON
 * const { status, body } = await authenticatedFetch('/v1/tenant-admin/settings', {
 *   method: 'PUT',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ theme: 'dark' }),
 * });
 *
 * // POST with FormData (multipart)
 * const formData = new FormData();
 * formData.append('photo', file);
 * const { status, body } = await authenticatedFetch(
 *   `/v1/tenant-admin/packages/${id}/photos`,
 *   { method: 'POST', body: formData }
 * );
 * ```
 */
export async function authenticatedFetch<T = unknown>(
  url: string,
  options: AuthenticatedFetchOptions = {}
): Promise<AuthenticatedFetchResponse<T>> {
  // Get the correct token (handles impersonation automatically)
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  // Build headers: merge user headers with Authorization
  const headers: Record<string, string> = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Parse response body
  let body: T | null = null;
  try {
    // Try to parse as JSON
    body = (await response.json()) as T;
  } catch {
    // Response is not JSON (e.g., 204 No Content) - body stays null
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}
````

**Verify:**

```bash
# Check it compiles
npm run typecheck

# Check it's exported
grep "export" client/src/lib/fetch-client.ts
```

---

## Step 3: Update package-photo-api.ts

**File:** `client/src/lib/package-photo-api.ts`

Remove the duplicated `getAuthToken()` function and update to use centralized version:

```typescript
// At the top, add import
import { getAuthToken } from './auth';

// Remove this function entirely (lines 65-78):
// function getAuthToken(): string | null {
//   const isImpersonating = localStorage.getItem('impersonationTenantKey');
//   if (isImpersonating) {
//     return localStorage.getItem('adminToken');
//   }
//   return localStorage.getItem('tenantToken');
// }

// Keep everything else the same - getAuthToken() is now imported from auth.ts
```

**Verify:**

```bash
# Count getAuthToken definitions
grep -n "function getAuthToken\|const getAuthToken" client/src/lib/package-photo-api.ts
# Should return 0

# Check import added
grep "import.*getAuthToken" client/src/lib/package-photo-api.ts
# Should show the import

# Check it compiles
npm run typecheck
```

---

## Step 4: Update ImageUploadField.tsx

**File:** `client/src/components/ImageUploadField.tsx`

Remove duplicated `getAuthToken()` function:

```typescript
// At the top, add import
import { getAuthToken } from '@/lib/auth';

// Remove this function entirely (lines 34-40):
// function getAuthToken(): string | null {
//   const isImpersonating = localStorage.getItem('impersonationTenantKey');
//   if (isImpersonating) {
//     return localStorage.getItem('adminToken');
//   }
//   return localStorage.getItem('tenantToken');
// }

// Keep everything else the same
```

**Verify:**

```bash
grep -n "function getAuthToken" client/src/components/ImageUploadField.tsx
# Should return 0

grep "import.*getAuthToken" client/src/components/ImageUploadField.tsx
# Should show the import
```

---

## Step 5: Update LogoUploadButton.tsx

**File:** `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx`

Remove duplicated `getAuthToken()` function:

```typescript
// At the top, add import
import { getAuthToken } from '@/lib/auth';

// Remove this function entirely (lines 9-15):
// function getAuthToken(): string | null {
//   const isImpersonating = localStorage.getItem("impersonationTenantKey");
//   if (isImpersonating) {
//     return localStorage.getItem("adminToken");
//   }
//   return localStorage.getItem("tenantToken");
// }

// Keep everything else the same
```

**Verify:**

```bash
grep -n "function getAuthToken" client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx
# Should return 0
```

---

## Step 6: Update usePhotoUpload.ts Hook

**File:** `client/src/features/photos/hooks/usePhotoUpload.ts`

Remove duplicated `getAuthToken()` function:

```typescript
// At the top, add import
import { getAuthToken } from '@/lib/auth';

// Remove this function entirely (lines 37-45):
// function getAuthToken(providedToken?: string): string | null {
//   if (providedToken) return providedToken;
//   const isImpersonating = localStorage.getItem('impersonationTenantKey');
//   if (isImpersonating) {
//     return localStorage.getItem('adminToken');
//   }
//   return localStorage.getItem('tenantToken');
// }

// Update the hook signature - remove the tenantToken prop since we get it from getAuthToken():
// OLD: function getAuthToken(providedToken?: string): string | null
// NEW: Just use: const token = getAuthToken();

// In the uploadPhoto() function, change:
// const token = getAuthToken(tenantToken);
// To:
// const token = getAuthToken();

// In the deletePhoto() function, change:
// const token = getAuthToken(tenantToken);
// To:
// const token = getAuthToken();
```

**Verify:**

```bash
grep -n "function getAuthToken" client/src/features/photos/hooks/usePhotoUpload.ts
# Should return 0
```

---

## Step 7: Search for Any Other Occurrences

Before moving to testing, verify no other files have duplicated auth logic:

```bash
# Search for all getAuthToken definitions (should find only auth.ts)
grep -r "function getAuthToken\|const getAuthToken" client/src --include="*.ts" --include="*.tsx"

# Should only show:
# client/src/lib/auth.ts:export function getAuthToken():

# If others appear, fix them the same way (remove duplicate, import from auth.ts)
```

---

## Step 8: Run Tests

### Unit Tests

```bash
# Run auth module tests
npm test -- client/src/lib/auth.test.ts

# Run fetch wrapper tests
npm test -- client/src/lib/fetch-client.test.ts

# Run all client tests
npm test -- --run client/src
```

### Create Missing Tests

If tests don't exist, create them. Example: `client/src/lib/auth.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthToken } from './auth';

describe('getAuthToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when not authenticated', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('returns tenantToken during normal tenant operation', () => {
    localStorage.setItem('tenantToken', 'tenant_token_test_123');
    expect(getAuthToken()).toBe('tenant_token_test_123');
  });

  it('returns adminToken during impersonation', () => {
    localStorage.setItem('adminToken', 'admin_token_with_impersonation');
    localStorage.setItem('impersonationTenantKey', 'pk_live_test_123');
    expect(getAuthToken()).toBe('admin_token_with_impersonation');
  });

  it('prefers adminToken when both tokens exist and impersonating', () => {
    localStorage.setItem('tenantToken', 'old_tenant_token');
    localStorage.setItem('adminToken', 'admin_impersonation_token');
    localStorage.setItem('impersonationTenantKey', 'pk_live_test_123');
    expect(getAuthToken()).toBe('admin_impersonation_token');
  });

  it('returns tenantToken when both tokens exist but NOT impersonating', () => {
    localStorage.setItem('tenantToken', 'tenant_token_123');
    localStorage.setItem('adminToken', 'some_admin_token');
    // impersonationTenantKey NOT set
    expect(getAuthToken()).toBe('tenant_token_123');
  });
});
```

### E2E Tests

Run existing E2E tests to verify nothing broke:

```bash
# Run E2E tests
npm run test:e2e

# Look for tests involving:
# - Platform admin login
# - Impersonation start
# - Tenant operations during impersonation
# - Photo uploads
# - Logo uploads
```

---

## Step 9: Verify in Development

Start the app and test manually:

```bash
# Terminal 1: Start API
ADAPTERS_PRESET=mock npm run dev:api

# Terminal 2: Start client
npm run dev:client

# Browser: Open http://localhost:5173
```

### Test Scenarios

1. **Normal Tenant Operation**
   - [ ] Tenant logs in
   - [ ] Can upload photo to package
   - [ ] Can upload logo
   - [ ] All requests use tenantToken

2. **Platform Admin Impersonation**
   - [ ] Platform admin logs in
   - [ ] Platform admin impersonates tenant
   - [ ] Can upload photo (using admin token with impersonation context)
   - [ ] Can upload logo (using admin token)
   - [ ] All requests use adminToken (not tenantToken)
   - [ ] Can stop impersonation and return to normal admin view

3. **Token Selection During Impersonation**
   - [ ] Check localStorage:
     ```javascript
     localStorage.getItem('adminToken'); // Should be set
     localStorage.getItem('impersonationTenantKey'); // Should be set
     localStorage.getItem('tenantToken'); // May or may not exist
     ```
   - [ ] Call getAuthToken():
     ```javascript
     // In console:
     import { getAuthToken } from './lib/auth.js';
     getAuthToken(); // Should return the adminToken
     ```

---

## Step 10: Code Review Checklist

Before committing, verify:

- [ ] All duplicate `getAuthToken()` functions removed
- [ ] All files import `getAuthToken` from `@/lib/auth`
- [ ] No direct `localStorage.getItem('token')` in component/hook code
- [ ] No manual token selection logic in components
- [ ] All authenticated fetches use centralized approach
- [ ] Tests pass: `npm test -- --run`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] App starts without errors: `ADAPTERS_PRESET=mock npm run dev:all`
- [ ] Manual testing of impersonation works

---

## Step 11: Commit and Deploy

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "refactor: centralize client authentication to prevent token confusion

- Remove duplicated getAuthToken() from 5 files
- Add centralized getAuthToken() to auth.ts
- Add authenticatedFetch() wrapper for type-safe requests
- Update packagePhotoApi to use centralized auth
- Update ImageUploadField to use centralized auth
- Update LogoUploadButton to use centralized auth
- Update usePhotoUpload to use centralized auth
- Add unit tests for token selection during impersonation
- Fixes: Client-side auth bypass during platform admin impersonation"

# Push to branch and create PR
git push origin feat/client-auth-centralization
```

---

## Rollback Plan (if needed)

If something breaks, it's simple to rollback:

```bash
# Restore original state
git reset --hard HEAD~1

# But you shouldn't need this - changes are backwards compatible
```

---

## Files Modified Summary

| File                                                                        | Change                            | Impact                                 |
| --------------------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
| `client/src/lib/auth.ts`                                                    | Add `getAuthToken()`              | LOW - new export, backwards compatible |
| `client/src/lib/fetch-client.ts`                                            | NEW FILE                          | LOW - new utility, opt-in              |
| `client/src/lib/package-photo-api.ts`                                       | Remove duplicate `getAuthToken()` | NONE - same behavior, cleaner code     |
| `client/src/components/ImageUploadField.tsx`                                | Remove duplicate `getAuthToken()` | NONE - same behavior, cleaner code     |
| `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` | Remove duplicate `getAuthToken()` | NONE - same behavior, cleaner code     |
| `client/src/features/photos/hooks/usePhotoUpload.ts`                        | Remove duplicate `getAuthToken()` | NONE - same behavior, cleaner code     |

---

## Timeline

| Phase          | Duration       | Tasks                                                        |
| -------------- | -------------- | ------------------------------------------------------------ |
| Implementation | 1 hour         | Add auth.ts function, create fetch-client.ts, update 4 files |
| Testing        | 30 min         | Run unit tests, run E2E tests, manual testing                |
| Code Review    | 30 min         | Self-review, verify checklist items                          |
| Deployment     | 15 min         | Commit, push, create PR, merge                               |
| **TOTAL**      | **~2.5 hours** | Done                                                         |

---

## Troubleshooting During Implementation

### Problem: TypeScript compilation error in auth.ts

**Error:** `getAuthToken is not exported`

**Solution:**

```bash
# Make sure you added `export` keyword
grep "export function getAuthToken" client/src/lib/auth.ts

# Should show:
# export function getAuthToken(): string | null {
```

### Problem: Tests fail with "Cannot find module '@/lib/fetch-client'"

**Error:** Module resolution issue

**Solution:**

```bash
# Verify file was created
ls -la client/src/lib/fetch-client.ts

# Check tsconfig paths
grep "@/lib" client/tsconfig.json

# Rebuild
npm run typecheck
```

### Problem: 401 errors during impersonation test

**Debug:**

```javascript
// In browser console during impersonation
localStorage.getItem('adminToken'); // Should be set
localStorage.getItem('impersonationTenantKey'); // Should be set

// Import and test
import { getAuthToken } from './lib/auth.js';
const token = getAuthToken();
console.log(token); // Should be adminToken

// Check if it's in request headers
// Open DevTools → Network tab → click request → Headers
// Look for: Authorization: Bearer <token>
```

### Problem: "getAuthToken is not defined" in runtime

**Error:** Import statement missing

**Solution:**

```typescript
// Make sure to add import at top of file
import { getAuthToken } from '@/lib/auth'; // ← Don't forget this

// Then use it
const token = getAuthToken();
```

---

## Next Steps After Merge

Once this PR is merged:

1. **Monitor:** Watch for auth-related errors in logs for 24 hours
2. **Document:** Add to CLAUDE.md if there are new patterns to follow
3. **Plan Phase 2:** Migrate remaining endpoints to ts-rest client (removes need for fetch-client.ts)

---

## Related Documentation

- `docs/solutions/CLIENT_AUTH_BYPASS_PREVENTION.md` - Full prevention strategy
- `docs/solutions/CLIENT_AUTH_QUICK_REFERENCE.md` - Quick reference guide for developers
- `client/src/lib/auth.ts` - Auth utilities
- `client/src/lib/api.ts` - ts-rest API client
