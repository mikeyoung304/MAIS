# Client Authentication Quick Reference

**Print this and pin to your desk during client-side development.**

---

## Rule 1: Always Use Centralized Auth

```typescript
// ✅ CORRECT
import { getAuthToken } from '@/lib/auth';
const token = getAuthToken(); // Handles impersonation automatically

// ❌ WRONG
const token = localStorage.getItem('tenantToken'); // Breaks during impersonation
const token = localStorage.getItem('adminToken'); // Always uses admin token
```

---

## Rule 2: Don't Duplicate Auth Logic

```typescript
// ❌ WRONG: This function exists in 5 files - STOP DUPLICATING IT
function getAuthToken(): string | null {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}

// ✅ CORRECT: Use centralized version from auth.ts
import { getAuthToken } from '@/lib/auth';
```

---

## Rule 3: Use Type-Safe API Calls

### For JSON Endpoints

```typescript
// ✅ PREFERRED: ts-rest client
import { api } from '@/lib/api';
const { status, body } = await api.tenantAdmin.getPackages();

// ✅ GOOD: Type-safe fetch wrapper
import { authenticatedFetch } from '@/lib/fetch-client';
const { status, body } = await authenticatedFetch('/v1/tenant-admin/packages');

// ❌ AVOID: Direct fetch
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

### For Multipart/Form-Data

```typescript
// ✅ PREFERRED: ts-rest client (if endpoint defined)
const { status, body } = await api.tenantAdmin.uploadPhoto({ body: formData });

// ✅ GOOD: Type-safe fetch wrapper
const { status, body } = await authenticatedFetch('/v1/tenant-admin/packages/123/photos', {
  method: 'POST',
  body: formData, // Don't set Content-Type - browser handles it
});

// ❌ AVOID: Direct fetch with manual token handling
const token = getAuthToken();
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

---

## Rule 4: Impersonation is Automatic

During impersonation, `getAuthToken()` automatically returns the admin token.

**You don't need to check for impersonation yourself.**

```typescript
// ❌ WRONG: Don't check impersonation manually
const isImpersonating = localStorage.getItem('impersonationTenantKey');
if (isImpersonating) {
  // ...
}

// ✅ CORRECT: Just call getAuthToken() - it handles it
import { getAuthToken } from '@/lib/auth';
const token = getAuthToken(); // Returns admin token if impersonating
```

---

## Rule 5: Never Hardcode Token Checks

```typescript
// ❌ WRONG: This breaks if impersonation state changes
const headers = {
  Authorization: `Bearer ${localStorage.getItem('tenantToken')}`,
};

// ✅ CORRECT: Use getAuthToken() which handles all cases
import { getAuthToken } from '@/lib/auth';
const headers = {
  Authorization: `Bearer ${getAuthToken()}`,
};
```

---

## File Map: Where to Find Auth Code

| Task                     | File                                          | Function                               |
| ------------------------ | --------------------------------------------- | -------------------------------------- |
| Get auth token           | `client/src/lib/auth.ts`                      | `getAuthToken()`                       |
| Make authenticated fetch | `client/src/lib/fetch-client.ts`              | `authenticatedFetch()`                 |
| Use type-safe client     | `client/src/lib/api.ts`                       | `api.*`                                |
| Decode/validate token    | `client/src/lib/auth.ts`                      | `decodeJWT()`, `isTokenExpired()`      |
| Store/retrieve token     | `client/src/lib/auth.ts`                      | `storeToken()`, `getToken()`           |
| Get user info            | `client/src/lib/auth.ts`                      | `payloadToUser()`                      |
| Handle auth flow         | `client/src/contexts/AuthContext/services.ts` | `authenticateUser()`, `signupTenant()` |

---

## Code Patterns

### Pattern A: Component Using Photo Upload

```typescript
import { useState } from 'react';
import { packagePhotoApi } from '@/lib/package-photo-api';

export function PhotoUploader({ packageId }: { packageId: string }) {
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    try {
      // packagePhotoApi uses getAuthToken() internally
      const photo = await packagePhotoApi.uploadPhoto(packageId, file);
      console.log('Uploaded:', photo.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
      }} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Pattern B: Direct API Call (Custom Endpoint)

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';

export async function updateTenantSettings(settings: any) {
  try {
    const { status, body } = await authenticatedFetch('/v1/tenant-admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (status !== 200) {
      throw new Error('Failed to update settings');
    }

    return body;
  } catch (error) {
    console.error('Settings update failed:', error);
    throw error;
  }
}
```

### Pattern C: Custom Hook with Auth

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

      if (status !== 200) {
        throw new Error('Failed to fetch package');
      }

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

## Checklist: Before You Commit

- [ ] No direct `localStorage.getItem('token')` in my code
- [ ] Using `getAuthToken()` from `@/lib/auth.ts` for token access
- [ ] No new `getAuthToken()` function defined in my file
- [ ] Using `authenticatedFetch()` or ts-rest `api` for all auth requests
- [ ] No manual Authorization header construction
- [ ] Impersonation state NOT checked manually in my component
- [ ] All fetch calls go through wrapper (not raw fetch)

---

## Common Mistakes to Avoid

### Mistake 1: Checking Impersonation Manually

```typescript
// ❌ WRONG
const isImpersonating = localStorage.getItem('impersonationTenantKey') !== null;
if (isImpersonating) {
  token = localStorage.getItem('adminToken');
} else {
  token = localStorage.getItem('tenantToken');
}

// ✅ CORRECT
const token = getAuthToken(); // Do it once, centrally
```

### Mistake 2: Duplicating getAuthToken()

```typescript
// ❌ WRONG: In PhotoUploader.tsx
function getAuthToken() {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}

// ❌ WRONG: In LogoUploader.tsx (Same code again!)
function getAuthToken() {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}

// ✅ CORRECT: Use centralized version
import { getAuthToken } from '@/lib/auth';
```

### Mistake 3: Only Checking One Token Type

```typescript
// ❌ WRONG: Incomplete check
if (localStorage.getItem('tenantToken')) {
  // Fails during impersonation because it only checks tenantToken
  token = localStorage.getItem('tenantToken');
}

// ✅ CORRECT: Use getAuthToken() which checks both
const token = getAuthToken();
```

### Mistake 4: Direct Fetch with Token

```typescript
// ❌ WRONG: Direct fetch bypasses centralized logic
const token = getAuthToken();
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

// ✅ CORRECT: Use wrapper which handles everything
const { status, body } = await authenticatedFetch(url);
```

---

## Debug: "Auth Failed During Impersonation"

**Symptoms:** Admin can access normal routes, but impersonation requests fail with 401/403

**Checklist:**

1. **Is `impersonationTenantKey` set?**

   ```typescript
   localStorage.getItem('impersonationTenantKey'); // Should be 'pk_live_...'
   ```

2. **Is `adminToken` available?**

   ```typescript
   localStorage.getItem('adminToken'); // Should be JWT token
   ```

3. **Does `getAuthToken()` return admin token?**

   ```typescript
   getAuthToken(); // During impersonation should return adminToken
   ```

4. **Is Authorization header being set?**
   - Open DevTools → Network tab
   - Look for Authorization header: `Bearer <token>`
   - Verify it's the admin token (not tenant token)

5. **Is the token expired?**
   ```typescript
   import { isTokenExpired } from '@/lib/auth';
   isTokenExpired(token); // Should be false
   ```

---

## Migration Checklist

If you wrote code with duplicated auth logic, here's how to fix it:

1. Find all instances of `getAuthToken()` in your file
2. Delete your custom `getAuthToken()` definition
3. Add import: `import { getAuthToken } from '@/lib/auth';`
4. Replace direct fetch with `authenticatedFetch()`
5. Run tests
6. Commit with message: `refactor: centralize auth in {ComponentName}`

---

## Resources

- **Full Guide:** `docs/solutions/CLIENT_AUTH_BYPASS_PREVENTION.md`
- **Auth Utils:** `client/src/lib/auth.ts`
- **Fetch Wrapper:** `client/src/lib/fetch-client.ts`
- **API Client:** `client/src/lib/api.ts`
- **Auth Context:** `client/src/contexts/AuthContext/`

---

## Key Takeaway

**Authentication is too important to get wrong.**

**Don't roll your own auth logic.**

**Use:** `getAuthToken()` → `authenticatedFetch()` / `api.*`

That's it. That's the whole thing.
