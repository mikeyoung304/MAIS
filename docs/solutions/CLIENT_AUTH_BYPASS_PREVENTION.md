# Client-Side Authentication Bypass Prevention Strategy

**Issue:** Client-side code bypassed centralized API client authentication, causing auth failures during platform admin impersonation.

**Risk Level:** HIGH - Potential for authentication bypass, token confusion, and tenant data isolation failures.

---

## Root Cause Analysis

The vulnerability exists due to **code duplication** and **direct API calls** that circumvent centralized authentication logic:

### Current Vulnerable Pattern (5+ files)

```typescript
// ❌ PATTERN 1: Duplicated getAuthToken() in 5 files
// client/src/lib/package-photo-api.ts
// client/src/components/ImageUploadField.tsx
// client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx
// client/src/features/photos/hooks/usePhotoUpload.ts
// client/src/components/navigation/RoleBasedNav.tsx (possibly)

function getAuthToken(): string | null {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}

// ❌ PATTERN 2: Direct fetch() bypassing ts-rest API client
const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

### Problems with This Approach

1. **Code Duplication** - Same `getAuthToken()` logic in 5 files, increases maintenance burden and divergence risk
2. **Inconsistent Implementation** - Different files may implement impersonation check differently
3. **Bypasses Centralized Logic** - ts-rest client handles impersonation correctly in `client/src/lib/api.ts`, but direct fetch calls don't
4. **Hard to Audit** - Security review must check every file; easy to miss vulnerabilities
5. **Token Selection Bug Risk** - Direct fetch may not properly handle edge cases (token expiration, refresh, etc.)
6. **No Interception Point** - If we need to add logging, token refresh, or security checks, we must update all 5 files

---

## Prevention Strategies

### Strategy 1: Consolidate Authentication Logic (CRITICAL)

**Move all `getAuthToken()` logic into centralized auth utilities**

Current state:

- `client/src/lib/auth.ts` has token utilities (decode, validate, store)
- `client/src/lib/api.ts` has HTTP client setup with impersonation handling
- **Missing:** Public function to get the correct token for authenticated requests

**Action:**
Add to `client/src/lib/auth.ts`:

```typescript
/**
 * Get the correct authentication token for API requests
 *
 * During impersonation:
 * - Returns adminToken (contains impersonation context)
 *
 * During normal operation:
 * - Returns tenantToken or null
 *
 * CRITICAL: Use this function in ALL places that need an auth token
 * instead of directly accessing localStorage.
 *
 * @returns JWT token or null if not authenticated
 */
export function getAuthToken(): string | null {
  // Check if platform admin is impersonating a tenant
  const impersonationKey = localStorage.getItem('impersonationTenantKey');
  if (impersonationKey) {
    // Use admin token which contains impersonation context
    return localStorage.getItem('adminToken');
  }

  // Normal tenant admin - use tenant token
  return localStorage.getItem('tenantToken');
}
```

**Benefits:**

- Single source of truth
- Easy to audit: one place to check impersonation logic
- Easy to add features: token refresh, logging, expiration checks
- Consistent behavior across entire app

---

### Strategy 2: Create Type-Safe Fetch Wrapper (RECOMMENDED)

**Don't use raw fetch for authenticated endpoints; use a centralized wrapper**

Create `client/src/lib/fetch-client.ts`:

````typescript
/**
 * Type-safe fetch wrapper for authenticated API calls
 *
 * Use this instead of raw fetch() for any authenticated requests.
 * Automatically injects Authorization header with correct token.
 */

import { getAuthToken } from './auth';

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

interface FetchResponse<T> {
  status: number;
  body: T | null;
  headers: Headers;
}

/**
 * Make authenticated fetch request
 * Automatically handles token injection and impersonation
 *
 * @param url - Full URL to fetch from
 * @param options - Fetch options (method, body, etc.)
 * @returns Promise with status, body, and headers
 *
 * @example
 * ```typescript
 * const { status, body } = await authenticatedFetch(
 *   `${baseUrl}/v1/tenant-admin/packages/${id}/photos`,
 *   {
 *     method: 'POST',
 *     body: formData,
 *   }
 * );
 * ```
 */
export async function authenticatedFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse<T>> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const headers: Record<string, string> = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let body: T | null = null;
  try {
    body = (await response.json()) as T;
  } catch {
    // Response is not JSON (e.g., 204 No Content)
    body = null;
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}
````

**Benefits:**

- Centralized token injection
- Consistent error handling
- Type-safe responses
- Single audit point for token logic

---

### Strategy 3: Migrate to ts-rest API Client (LONG-TERM)

**The ts-rest client (`client/src/lib/api.ts`) already handles impersonation correctly.**

Current issue: Some endpoints use direct fetch instead of ts-rest routes.

**Action:** Define missing endpoints in contracts and use ts-rest client instead.

Example - photo upload currently uses direct fetch:

```typescript
// ❌ Current: Direct fetch
const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// ✅ Better: Use ts-rest (if endpoint defined in contracts)
const response = await api.tenantAdmin.uploadPackagePhoto({
  params: { packageId },
  body: formData,
});
```

**Benefits:**

- Full type safety
- Centralized auth handling in one place (`client/src/lib/api.ts`)
- Contract enforcement
- Easier to test and audit

**Migration Priority:**

1. High: Photo upload endpoints (currently 5 duplications)
2. Medium: Logo upload
3. Long-term: All tenant-admin routes

---

## Best Practices

### Pattern: Proper Authenticated API Calls

#### For FormData (Multipart) Requests

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';
import { getAuthToken } from '@/lib/auth';

// Do NOT set Content-Type - browser handles it with boundary
const formData = new FormData();
formData.append('photo', file);

const { status, body } = await authenticatedFetch(
  `${baseUrl}/v1/tenant-admin/packages/${id}/photos`,
  {
    method: 'POST',
    body: formData,
    // authenticatedFetch automatically adds Authorization header
  }
);

if (status !== 200) {
  throw new Error('Upload failed');
}
```

#### For JSON Requests

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';

const { status, body } = await authenticatedFetch(`${baseUrl}/v1/tenant-admin/packages`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  // authenticatedFetch automatically adds Authorization header
});
```

#### For ts-rest Client (Preferred)

```typescript
import { api } from '@/lib/api';

// Automatically handles:
// - Authorization header
// - Impersonation context
// - Content-Type
// - Error handling
const { status, body } = await api.tenantAdmin.getPackages();
```

### Pattern: Custom Hooks

```typescript
// ✅ CORRECT: Hook uses centralized auth from api client
export function usePhotoUpload(packageId: string) {
  const uploadPhoto = async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    // Use ts-rest client which handles auth correctly
    const { status, body } = await api.tenantAdmin.uploadPhoto({
      params: { packageId },
      body: formData,
    });

    return body;
  };

  return { uploadPhoto };
}

// ❌ WRONG: Hook duplicates auth logic
export function usePhotoUpload(packageId: string) {
  const uploadPhoto = async (file: File) => {
    // Don't duplicate getAuthToken logic!
    const token = localStorage.getItem('adminToken') || localStorage.getItem('tenantToken');

    const response = await fetch(...);
  };

  return { uploadPhoto };
}
```

### Pattern: Token Management

```typescript
// ✅ CORRECT: Get token from centralized function
import { getAuthToken } from '@/lib/auth';

const token = getAuthToken(); // Returns correct token (admin or tenant)

// ❌ WRONG: Multiple getAuthToken definitions
function getAuthToken(): string | null {
  // This logic now duplicated in 5 files
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}
```

---

## Code Review Checklist

### When Reviewing Client-Side Code

- [ ] **No direct fetch calls for authenticated endpoints**
  - Use `authenticatedFetch()` wrapper or ts-rest client
  - Direct fetch only for public endpoints (no auth)

- [ ] **No localStorage access for tokens**
  - Use `getAuthToken()` from `client/src/lib/auth.ts`
  - Never use `localStorage.getItem('adminToken')` or `localStorage.getItem('tenantToken')` directly

- [ ] **No duplicated getAuthToken() logic**
  - Grep: `function getAuthToken` or `const getAuthToken`
  - Should only exist in `client/src/lib/auth.ts`

- [ ] **Authorization header injected correctly**
  - For direct fetch: `'Authorization': 'Bearer ' + getAuthToken()`
  - For ts-rest: Automatic (check `client/src/lib/api.ts` handles route)
  - For authenticatedFetch: Automatic

- [ ] **Impersonation handled correctly**
  - Check: Does code verify `localStorage.getItem('impersonationTenantKey')`?
  - If impersonating, should use `adminToken` (not `tenantToken`)
  - Centralized check should be in `getAuthToken()` only

- [ ] **No token selection bugs during impersonation**
  - Impersonation state persists in localStorage
  - Token selection must consider BOTH token types
  - Example bug: Only checking tenantToken during impersonation fails

- [ ] **Error handling for auth failures**
  - 401 Unauthorized: Should clear tokens and redirect to login
  - 403 Forbidden: Should show permission error
  - Token expired: Should refresh (if implemented)

### Anti-Patterns to Flag

```typescript
// ❌ ANTI-PATTERN 1: Direct localStorage access for tokens
const token = localStorage.getItem('tenantToken');
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

// ❌ ANTI-PATTERN 2: Incomplete impersonation check
const isImpersonating = localStorage.getItem('impersonationTenantKey');
if (isImpersonating) {
  const token = localStorage.getItem('adminToken'); // ← Good
} else {
  const token = localStorage.getItem('tenantToken'); // ← Only checks one
}

// ❌ ANTI-PATTERN 3: Duplicated auth logic in custom function
function getMyAuthToken() {
  // Same logic as getAuthToken() from auth.ts
  // Maintenance burden + divergence risk
}

// ❌ ANTI-PATTERN 4: Manual header construction for auth routes
const headers: Record<string, string> = {};
if (path.includes('/v1/tenant-admin')) {
  headers['Authorization'] = `Bearer ${token}`;
}
// Should be in centralized fetch wrapper instead
```

---

## Testing Recommendations

### Unit Tests: Auth Token Selection

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAuthToken } from '@/lib/auth';

describe('getAuthToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when not authenticated', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('returns tenantToken for normal tenant admin', () => {
    localStorage.setItem('tenantToken', 'tenant_token_123');
    expect(getAuthToken()).toBe('tenant_token_123');
  });

  it('returns adminToken during impersonation', () => {
    localStorage.setItem('adminToken', 'admin_token_123');
    localStorage.setItem('impersonationTenantKey', 'pk_live_...');
    expect(getAuthToken()).toBe('admin_token_123');
  });

  it('prefers adminToken when both tokens exist and impersonating', () => {
    localStorage.setItem('tenantToken', 'tenant_token_123');
    localStorage.setItem('adminToken', 'admin_impersonation_token_456');
    localStorage.setItem('impersonationTenantKey', 'pk_live_...');
    expect(getAuthToken()).toBe('admin_impersonation_token_456');
  });

  it('returns tenantToken when both exist but not impersonating', () => {
    localStorage.setItem('tenantToken', 'tenant_token_123');
    localStorage.setItem('adminToken', 'admin_token_456');
    localStorage.removeItem('impersonationTenantKey');
    expect(getAuthToken()).toBe('tenant_token_123');
  });
});
```

### Integration Tests: Fetch Wrapper

```typescript
describe('authenticatedFetch', () => {
  it('injects Authorization header with token', async () => {
    localStorage.setItem('tenantToken', 'test_token_123');

    const { status } = await authenticatedFetch('/api/test', {
      method: 'GET',
    });

    // Mock fetch should verify Authorization header was set
    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test_token_123',
        }),
      })
    );
  });

  it('throws error when not authenticated', async () => {
    localStorage.clear();

    await expect(authenticatedFetch('/api/test', { method: 'GET' })).rejects.toThrow(
      'Authentication required'
    );
  });

  it('handles impersonation token', async () => {
    localStorage.setItem('adminToken', 'admin_impersonation_token');
    localStorage.setItem('impersonationTenantKey', 'pk_live_...');

    await authenticatedFetch('/api/test', { method: 'GET' });

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin_impersonation_token',
        }),
      })
    );
  });
});
```

### E2E Tests: Impersonation Scenarios

```typescript
import { test, expect } from '@playwright/test';

test('platform admin can impersonate tenant and upload photo', async ({ page }) => {
  // 1. Login as platform admin
  await page.goto('/admin/login');
  await page.fill('[name="email"]', 'admin@platform.com');
  await page.fill('[name="password"]', 'admin_password');
  await page.click('button:has-text("Login")');

  await page.waitForURL('/admin/dashboard');

  // 2. Impersonate tenant
  await page.click('button:has-text("Impersonate")');
  await page.fill('[name="tenantId"]', 'tenant_123');
  await page.click('button:has-text("Start Impersonation")');

  // localStorage now contains:
  // - adminToken: (with impersonation context)
  // - impersonationTenantKey: pk_live_...

  // 3. Upload photo as impersonated tenant
  await page.goto('/admin/impersonation/packages');
  await page.click('button:has-text("Upload Photo")');

  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('test-photo.jpg');

  // 4. Verify upload succeeds with admin token (not tenant token)
  const response = await page.waitForResponse('/v1/tenant-admin/packages/*/photos');

  expect(response.status()).toBe(200);
  expect(response.request().headers()['authorization']).toContain('admin_impersonation_token');
});

test('impersonation token is NOT tenant token', async ({ page }) => {
  // Verify we never use tenantToken during impersonation

  // Setup: Impersonation active
  await page.evaluate(() => {
    localStorage.setItem('adminToken', 'admin_impersonation_token');
    localStorage.setItem('impersonationTenantKey', 'pk_live_...');
    localStorage.setItem('tenantToken', 'old_tenant_token'); // from previous session
  });

  // Make request
  let requestToken: string | null = null;
  page.on('request', (request) => {
    const auth = request.headers()['authorization'];
    if (auth?.includes('Bearer')) {
      requestToken = auth.split(' ')[1];
    }
  });

  await page.click('button:has-text("Action")');

  // Verify it uses admin token, not tenant token
  expect(requestToken).toBe('admin_impersonation_token');
  expect(requestToken).not.toBe('old_tenant_token');
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

- [ ] Add `getAuthToken()` to `client/src/lib/auth.ts`
- [ ] Create `client/src/lib/fetch-client.ts` with `authenticatedFetch()`
- [ ] Add unit tests for both functions
- [ ] Update documentation

### Phase 2: Migration (Week 2-3)

- [ ] Migrate `packagePhotoApi` to use `authenticatedFetch()`
- [ ] Migrate `ImageUploadField` component
- [ ] Migrate `LogoUploadButton` component
- [ ] Migrate `usePhotoUpload` hook
- [ ] Remove all duplicated `getAuthToken()` functions
- [ ] Run full test suite

### Phase 3: Long-Term (Ongoing)

- [ ] Define missing endpoints in contracts
- [ ] Migrate remaining endpoints to ts-rest client
- [ ] Remove `authenticatedFetch()` wrapper (not needed if all on ts-rest)

### Phase 4: Hardening

- [ ] Add token refresh logic if needed
- [ ] Add request/response logging for security audit
- [ ] Add rate limiting for auth endpoints
- [ ] Consider adding token rotation

---

## Files Requiring Updates

| File                                                                        | Issue                      | Solution                |
| --------------------------------------------------------------------------- | -------------------------- | ----------------------- |
| `client/src/lib/package-photo-api.ts`                                       | Duplicate `getAuthToken()` | Use centralized version |
| `client/src/components/ImageUploadField.tsx`                                | Duplicate `getAuthToken()` | Use centralized version |
| `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` | Duplicate `getAuthToken()` | Use centralized version |
| `client/src/features/photos/hooks/usePhotoUpload.ts`                        | Duplicate `getAuthToken()` | Use centralized version |
| (Unknown - TBD)                                                             | Possibly more instances    | Grep for all instances  |

---

## Quick Reference: Token Selection

### Decision Tree

```
Does the request need authentication?
├─ NO → Don't add Authorization header
└─ YES → Get token:
   ├─ Is platform admin impersonating?
   │  ├─ YES (impersonationTenantKey in localStorage)
   │  │  └─ Use adminToken (contains impersonation context)
   │  └─ NO
   │     └─ Use tenantToken
   └─ No token available?
      └─ Throw error or redirect to login
```

### Code Pattern

```typescript
import { getAuthToken } from '@/lib/auth';

// ALWAYS use this function
const token = getAuthToken();
if (!token) {
  throw new Error('Authentication required - redirect to login');
}

// Then inject into request
headers['Authorization'] = `Bearer ${token}`;
```

---

## Security Implications

### Vulnerability Fixed

**Authentication Bypass During Impersonation**

- Platform admin impersonating tenant could use old tenantToken
- Old tenantToken would fail authentication (belongs to different tenant)
- Confused API would return 401/403, breaking impersonation experience

### Improved With These Changes

1. **Single Source of Truth**
   - Token selection logic centralized
   - Easier to spot bugs during code review

2. **Audit Trail**
   - All authenticated requests go through one function
   - Can add logging/monitoring in one place

3. **Consistency**
   - All parts of app handle impersonation the same way
   - Reduces risk of divergent behavior

4. **Maintainability**
   - Token refresh logic only needs to be added once
   - Token rotation only needs to be added once
   - Secret rotation only needs to be added once

---

## Glossary

- **impersonationTenantKey**: localStorage flag indicating platform admin is impersonating
- **adminToken**: JWT with platform admin role, may contain impersonation context
- **tenantToken**: JWT with tenant admin role, scoped to specific tenant
- **Token Confusion**: Using wrong token type for current operation
- **Centralized Auth**: Authentication logic in one place, used everywhere
- **Direct Fetch**: Using raw fetch() instead of API client wrapper
