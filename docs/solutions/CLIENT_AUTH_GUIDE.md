# Client Authentication Guide

**Comprehensive guide for client-side authentication in the MAIS platform.**

**Consolidated from:** 6 separate CLIENT_AUTH documents (2026-01-10)

---

## Overview

### What is Client Auth in This Project?

Client authentication in MAIS handles two distinct scenarios:

1. **Normal Tenant Operation** - Tenant admin logs in and receives a `tenantToken` scoped to their tenant
2. **Platform Admin Impersonation** - Platform admin impersonates a tenant using an `adminToken` with impersonation context

The critical challenge: code must select the correct token based on current authentication state.

### The Vulnerability That Led to This Guide

**Issue:** Platform admin impersonation failed because client-side code duplicated `getAuthToken()` logic in 5 files, with inconsistent token selection.

**Root Cause:** Code duplication - same auth logic in multiple files led to divergent implementations.

**Impact:**

- Impersonation requests failed with 401/403 errors
- User experience broken during platform admin impersonation
- Maintenance burden (5 copies of same logic)
- Risk of security vulnerabilities

---

## Quick Reference (1-Page Cheat Sheet)

### The 5 Rules

1. **Always use centralized auth:** `import { getAuthToken } from '@/lib/auth'`
2. **Never duplicate getAuthToken():** Only one definition should exist
3. **Use type-safe API calls:** Prefer ts-rest client or `authenticatedFetch()`
4. **Impersonation is automatic:** `getAuthToken()` handles it - don't check manually
5. **Never hardcode token checks:** No direct `localStorage.getItem('tenantToken')`

### Token Selection Decision Tree

```
Does the request need authentication?
|-- NO --> Don't add Authorization header
|-- YES --> Call getAuthToken():
    |-- Is impersonationTenantKey set in localStorage?
    |   |-- YES --> Return adminToken (contains impersonation context)
    |   |-- NO --> Return tenantToken
    |-- No token available?
        |-- Throw error or redirect to login
```

### File Map

| Task                     | File                             | Function                          |
| ------------------------ | -------------------------------- | --------------------------------- |
| Get auth token           | `client/src/lib/auth.ts`         | `getAuthToken()`                  |
| Make authenticated fetch | `client/src/lib/fetch-client.ts` | `authenticatedFetch()`            |
| Use type-safe client     | `client/src/lib/api.ts`          | `api.*`                           |
| Decode/validate token    | `client/src/lib/auth.ts`         | `decodeJWT()`, `isTokenExpired()` |

### Checklist Before Commit

- [ ] No direct `localStorage.getItem('token')` in my code
- [ ] Using `getAuthToken()` from `@/lib/auth.ts` for token access
- [ ] No new `getAuthToken()` function defined in my file
- [ ] Using `authenticatedFetch()` or ts-rest `api` for all auth requests
- [ ] No manual Authorization header construction
- [ ] Impersonation state NOT checked manually in my component

---

## Implementation Patterns

### Pattern 1: Get Token (Centralized)

```typescript
import { getAuthToken } from '@/lib/auth';
const token = getAuthToken(); // Returns correct token for all scenarios
```

### Pattern 2: Make Authenticated Fetch

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';
const { status, body } = await authenticatedFetch('/api/endpoint');
```

### Pattern 3: Use API Client (Preferred)

```typescript
import { api } from '@/lib/api';
const { status, body } = await api.tenantAdmin.getPackages();
```

### Pattern 4: FormData Upload

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';

const formData = new FormData();
formData.append('photo', file);

const { status, body } = await authenticatedFetch(
  `/v1/tenant-admin/packages/${id}/photos`,
  { method: 'POST', body: formData }
  // Don't set Content-Type - browser handles it with boundary
);
```

### Pattern 5: Custom Hook with Auth

```typescript
import { useState, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/fetch-client';

export function usePackageData(packageId: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status, body } = await authenticatedFetch(`/v1/tenant-admin/packages/${packageId}`);
      if (status !== 200) throw new Error('Failed to fetch package');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  return { data, loading, error, fetch };
}
```

---

## Security Considerations

### Vulnerability Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Direct localStorage access for tokens
const token = localStorage.getItem('tenantToken');
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

// ANTI-PATTERN 2: Incomplete impersonation check
const isImpersonating = localStorage.getItem('impersonationTenantKey');
if (isImpersonating) {
  const token = localStorage.getItem('adminToken');
} else {
  const token = localStorage.getItem('tenantToken'); // Only checks one
}

// ANTI-PATTERN 3: Duplicated auth logic in custom function
function getMyAuthToken() {
  // Same logic as getAuthToken() from auth.ts
  // Maintenance burden + divergence risk
}

// ANTI-PATTERN 4: Manual header construction for auth routes
const headers: Record<string, string> = {};
if (path.includes('/v1/tenant-admin')) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

### Correct Implementation

The centralized `getAuthToken()` function in `auth.ts`:

```typescript
export function getAuthToken(): string | null {
  // Check if platform admin is impersonating a tenant
  const impersonationKey = localStorage.getItem('impersonationTenantKey');

  if (impersonationKey) {
    // Use admin token which contains impersonation context
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) return adminToken;
  }

  // Normal tenant admin - use tenant token
  return localStorage.getItem('tenantToken');
}
```

### Security Benefits of Centralization

1. **Single Source of Truth** - Token selection logic in one place
2. **Easy to Audit** - One place to check impersonation logic
3. **Easy to Add Features** - Token refresh, logging, expiration checks
4. **Consistent Behavior** - All parts of app handle impersonation the same way

---

## Testing Recommendations

### Unit Tests: Token Selection

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthToken } from './auth';

describe('getAuthToken', () => {
  beforeEach(() => localStorage.clear());

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

### Integration Tests: Fetch Wrapper

```typescript
describe('authenticatedFetch', () => {
  it('injects Authorization header with token', async () => {
    localStorage.setItem('tenantToken', 'test_token_123');

    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    });

    await authenticatedFetch('/api/packages');

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
    await expect(authenticatedFetch('/api/test')).rejects.toThrow('Authentication required');
  });

  it('handles impersonation token', async () => {
    localStorage.setItem('adminToken', 'admin_impersonation_token');
    localStorage.setItem('impersonationTenantKey', 'pk_live_...');

    await authenticatedFetch('/api/test');

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

### E2E Tests: Impersonation Flow

```typescript
test('platform admin can impersonate and upload photo', async ({ page }) => {
  // 1. Login as platform admin
  await page.goto('/admin/login');
  await page.fill('[name="email"]', 'admin@platform.com');
  await page.fill('[name="password"]', 'admin_password');
  await page.click('button:has-text("Login")');
  await page.waitForURL('/admin/dashboard');

  // 2. Start impersonation
  await page.click('button:has-text("Impersonate")');
  await page.fill('[name="tenantId"]', 'tenant_123');
  await page.click('button:has-text("Start Impersonation")');

  // 3. Verify localStorage state
  const authState = await page.evaluate(() => ({
    adminToken: localStorage.getItem('adminToken'),
    impersonationTenantKey: localStorage.getItem('impersonationTenantKey'),
  }));
  expect(authState.adminToken).toBeTruthy();
  expect(authState.impersonationTenantKey).toBeTruthy();

  // 4. Upload photo as impersonated tenant
  await page.goto('/admin/impersonation/packages');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('test-photo.jpg');

  // 5. Verify upload uses admin token
  const uploadResponse = await page.waitForResponse(
    (response) => response.url().includes('/photos') && response.request().method() === 'POST'
  );
  expect(uploadResponse.status()).toBe(200);

  const authHeader = uploadResponse.request().headers()['authorization'];
  expect(authHeader).toContain('Bearer');
});
```

### Manual Testing Checklist

- [ ] Tenant can upload photo (uses tenantToken)
- [ ] Admin can impersonate tenant
- [ ] Can upload while impersonating (uses adminToken)
- [ ] Impersonation doesn't use old tenantToken
- [ ] Can stop impersonation and return to admin view
- [ ] Multiple uploads work during impersonation
- [ ] 401 errors handled correctly
- [ ] Expired token detected properly

---

## Code Review Checklist

### When Reviewing Client-Side Auth Code

- [ ] **No direct fetch calls for authenticated endpoints** - Use `authenticatedFetch()` or ts-rest client
- [ ] **No localStorage access for tokens** - Use `getAuthToken()` from `@/lib/auth.ts`
- [ ] **No duplicated getAuthToken() logic** - Should only exist in `@/lib/auth.ts`
- [ ] **Authorization header injected correctly** - Via wrapper or ts-rest, not manually
- [ ] **Impersonation handled correctly** - Check uses centralized function, not manual checks
- [ ] **Error handling for auth failures** - 401 should clear tokens/redirect; 403 should show permission error
- [ ] **Tests cover impersonation scenarios** - Both normal and impersonation paths tested

### Quick Grep Checks

```bash
# Find duplicate getAuthToken definitions (should only find auth.ts)
grep -r "function getAuthToken\|const getAuthToken" client/src --include="*.ts" --include="*.tsx"

# Find direct localStorage token access (should find none in components)
grep -r "localStorage.getItem.*Token" client/src/components --include="*.tsx"

# Find direct fetch with Authorization (should be minimal)
grep -r "Authorization.*Bearer" client/src/components --include="*.tsx"
```

---

## Data Flow Diagrams

### Normal Tenant Operation

```
Tenant logs in
      |
      v
AuthContext.login() --> storeToken(token, role)
      |
      v
localStorage:
  tenantToken: "eyJ..."
  adminToken: null
  impersonationTenantKey: null
      |
      v
Component calls getAuthToken()
      |
      v
Returns: tenantToken
      |
      v
Authorization: Bearer eyJ... (tenantToken)
      |
      v
Server validates --> Request succeeds
```

### Platform Admin Impersonation

```
Platform admin logs in --> localStorage: adminToken set
      |
      v
Admin clicks "Impersonate tenant 123"
      |
      v
API call to /v1/auth/impersonate
      |
      v
Server returns new token with impersonation context
      |
      v
localStorage:
  adminToken: "eyJ..." (with impersonation context)
  impersonationTenantKey: "pk_live_..."
      |
      v
Component calls getAuthToken()
  - Checks: impersonationTenantKey? YES
  - Returns: adminToken
      |
      v
Authorization: Bearer eyJ... (adminToken with context)
      |
      v
Server validates:
  - Token is ADMIN role
  - Token has impersonation context
  - Request succeeds with tenant context
```

---

## Glossary

- **getAuthToken()** - Centralized function that returns the correct token (admin or tenant)
- **authenticatedFetch()** - Wrapper around fetch that auto-injects Authorization header
- **Impersonation** - Platform admin temporarily acting as a tenant
- **impersonationTenantKey** - localStorage flag indicating active impersonation
- **Token Confusion** - Bug where wrong token type is selected for current operation
- **adminToken** - JWT with platform admin role, may contain impersonation context
- **tenantToken** - JWT with tenant admin role, scoped to specific tenant

---

## Related Documentation

- **CLAUDE.md** - Multi-tenant patterns and project architecture
- **API Contracts** - `packages/contracts/src/`
- **Server-Side Auth** - `server/src/middleware/auth.ts`
- **API Client** - `client/src/lib/api.ts`

---

## Archived Source Documents

The following documents were consolidated into this guide and archived to `docs/archive/solutions-consolidated-20260110/topic-clusters/client-auth/`:

- `CLIENT_AUTH_INDEX.md` - Document navigation and overview
- `CLIENT_AUTH_QUICK_REFERENCE.md` - Developer cheat sheet
- `CLIENT_AUTH_BYPASS_PREVENTION.md` - Full prevention strategy
- `CLIENT_AUTH_IMPLEMENTATION.md` - Step-by-step implementation guide
- `CLIENT_AUTH_TESTING.md` - Complete test examples
- `CLIENT_AUTH_VISUAL_OVERVIEW.md` - Visual diagrams and architecture
