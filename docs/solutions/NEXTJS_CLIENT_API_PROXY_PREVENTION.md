# Next.js Client Component API Proxy Prevention Strategy

**Status:** Critical Security & DX Pattern
**Created:** 2025-12-30
**Updated:** 2025-12-30

---

## Problem: Direct Express API Calls from Client Components

Client components calling the Express backend directly instead of through the Next.js API proxy causes:

1. **Missing Authentication** - Client can't add `Authorization` header (no token access)
2. **CORS & Credentials Issues** - Browser blocks cross-origin requests with `credentials: 'include'`
3. **Token Exposure Risk** - Temptation to expose `NEXT_PUBLIC_API_URL` with backend token
4. **DX Confusion** - Developers uncertain where to make API calls
5. **Inconsistent Error Handling** - Different error messages across the app

## The Root Cause

The MAIS architecture uses:

- **Express API** (port 3001) - Backend with JWT authentication
- **Next.js App** (port 3000) - Frontend with NextAuth.js + HTTP-only cookies

**Client components cannot directly access the backend token.** The token lives in:

- `JWT` stored in HTTP-only cookie (server-side only)
- Retrieved via `getBackendToken()` (server-side only)

**This is intentional security design.** Next.js API routes act as a middleware bridge.

---

## Code Review Checklist

When reviewing React/Next.js components that make API calls:

### Red Flag 1: Direct `NEXT_PUBLIC_API_URL` Usage in Client Components

```typescript
// ❌ RED FLAG: Direct API URL in client component
'use client';

export function MyComponent() {
  const handleClick = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/tenant-admin/packages`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }, // WHERE IS TOKEN?
    });
  };
}
```

**Issues:**

- Component can't access backend token (it's HTTP-only)
- Will fail with 401 "Unauthorized"
- CORS error if configured with credentials

**Solution:** Use `/api/*` proxy instead

---

### Red Flag 2: `credentials: 'include'` With Direct Backend URL

```typescript
// ❌ RED FLAG: CORS credentials request to express API
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/agent/health`, {
  method: 'GET',
  credentials: 'include', // Browser sends cookies to Express
});
```

**Issues:**

- Express API on localhost:3001 won't accept credentials from localhost:3000
- Browser blocks request with CORS error
- Even if CORS allowed, Express doesn't validate Next.js auth cookies

**Solution:** Use `/api/agent/health` proxy that runs on same origin

---

### Red Flag 3: Missing Error Handling for 401 Responses

```typescript
// ❌ RED FLAG: No authentication check
'use client';
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/chat/message`);
const data = await response.json();
setMessages([...messages, data]); // If 401, data is { error: 'Unauthorized' }
```

**Issues:**

- Silent failures when user not authenticated
- Component crashes when parsing error response
- User sees broken UI instead of "sign in" message

**Solution:** Check response.ok and auth status via proxy

---

### Red Flag 4: Token Hardcoding or localStorage Access in Client

```typescript
// ❌ RED FLAG: Trying to access backend token in client
'use client';
const token = localStorage.getItem('backendToken'); // Doesn't exist
const token = sessionStorage.getItem('adminToken'); // Security risk if it did

// ❌ RED FLAG: Trying to read HTTP-only cookie
const token = document.cookie.split('; ').find((row) => row.startsWith('mais_backend_token')); // Can't read HTTP-only
```

**Issues:**

- Backend token is intentionally NOT in localStorage/sessionStorage
- HTTP-only cookies are not readable from JavaScript
- Developers frustrated that "where is my token?"

**Solution:** Use API proxy which already has token from session

---

### Red Flag 5: `createClientApiClient()` Calling Express Directly

```typescript
// ❌ RED FLAG: Client API client calling Express instead of proxy
'use client';
import { createClientApiClient } from '@/lib/api';

function MyComponent() {
  const api = createClientApiClient();
  const packages = await api.getPackages(); // Calls localhost:3001 directly!
}
```

**Issues:**

- `createClientApiClient()` is for SSR-safe library usage, not Express auth
- Client can't add backend token to requests
- Requests bypass NextAuth.js middleware

**Solution:** Use API proxy routes for authenticated calls, not direct client API

---

## Best Practices

### Pattern 1: Client Component → /api/\* Proxy → Express API

```typescript
// ✅ CORRECT: Client component using Next.js proxy
'use client';

import { useState } from 'react';

export function PackageManager() {
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = async () => {
    try {
      // Call Next.js proxy route (same origin)
      const response = await fetch('/api/tenant-admin/packages', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Check if authenticated (proxy returns 401 if not)
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to continue');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch packages');
      }

      const data = await response.json();
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <button onClick={fetchPackages}>Load Packages</button>
      {error && <div className="error">{error}</div>}
      <ul>
        {packages.map(p => <li key={p.id}>{p.name}</li>)}
      </ul>
    </div>
  );
}
```

**Key Points:**

- URL is `/api/tenant-admin/packages` (Next.js proxy)
- No `Authorization` header needed (proxy adds it)
- Check response.ok before parsing JSON
- Proxy handles 401 gracefully

---

### Pattern 2: React Query with Proxy

```typescript
// ✅ CORRECT: React Query using proxy
'use client';

import { useQuery } from '@tanstack/react-query';

export function PackageList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/packages');

      // Handle 401 (not authenticated)
      if (response.status === 401) {
        throw new Error('Please sign in');
      }

      if (!response.ok) {
        throw new Error('Failed to load packages');
      }

      return response.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="error">{error.message}</div>;

  return (
    <ul>
      {data?.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

---

### Pattern 3: Server Component (Direct API Call)

```typescript
// ✅ CORRECT: Server component can call Express directly
// No 'use client' directive
import { createServerApiClient } from '@/lib/api';

export async function PackageList() {
  const api = await createServerApiClient();
  const response = await api.getPackages();

  if (!response.ok) {
    return <div>Failed to load packages</div>;
  }

  const packages = response.body;

  return (
    <ul>
      {packages?.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

**Key Difference:**

- No `'use client'` directive = Server Component
- Can call Express API directly (has backend token from session)
- No CORS issues (server-to-server communication)
- Better performance (rendering happens on server)

---

## Decision Tree: Where to Make API Calls

```
Are you in a Client Component ('use client')?
│
├─ YES
│  │
│  └─ Use /api/[...path] proxy routes
│     ├─ /api/tenant-admin/* → Express /v1/tenant-admin/*
│     ├─ /api/agent/* → Express /v1/agent/*
│     └─ Does proxy return 401? → User not authenticated, show login
│
└─ NO (Server Component or Server Action)
   │
   └─ Call Express API directly
      ├─ Use createServerApiClient()
      ├─ Or use custom server-side fetch with getBackendToken()
      └─ No CORS issues, token added automatically
```

---

## Proxy Route Reference

### Available Proxy Routes (Next.js)

| Proxy Route               | Backend Route      | Use For                                   |
| ------------------------- | ------------------ | ----------------------------------------- |
| `/api/tenant-admin/*`     | `/v1/tenant-admin` | Admin dashboard API calls (authenticated) |
| `/api/agent/*`            | `/v1/agent`        | Growth Assistant API (authenticated)      |
| `/api/auth/[...nextauth]` | N/A                | NextAuth.js handlers (login/logout/etc)   |

### How Proxy Routes Work

**File:** `/apps/web/src/app/api/tenant-admin/[...path]/route.ts`

```typescript
// Inside proxy route (server-side)
const token = await getBackendToken(); // Get from HTTP-only session
const headers = {
  Authorization: `Bearer ${token}`, // Add token to backend request
};
const response = await fetch(`${API_BASE_URL}/v1/tenant-admin/${pathString}`, {
  headers, // ← Token is here
});
```

**From Client:**

```typescript
// Client doesn't need to add token
const response = await fetch('/api/tenant-admin/packages'); // Proxy adds token
```

---

## Common Mistakes & Fixes

### Mistake 1: Exposing Backend URL in Client Code

```typescript
// ❌ WRONG
const API_URL = process.env.NEXT_PUBLIC_API_URL; // = 'http://localhost:3001'
const response = await fetch(`${API_URL}/v1/chat/message`);

// ✅ CORRECT
const response = await fetch('/api/agent/message');
```

**Why:**

- `NEXT_PUBLIC_*` variables are embedded in client JavaScript
- Anyone can see your backend URL in browser
- But they still can't authenticate (no token)

---

### Mistake 2: Trying to Access Backend Token

```typescript
// ❌ WRONG: HTTP-only cookie is invisible to JavaScript
const token = document.cookie; // Can't read HTTP-only cookies
const token = localStorage.getItem('backendToken'); // Doesn't exist

// ✅ CORRECT: Proxy handles token transparently
const response = await fetch('/api/tenant-admin/packages'); // Already has token
```

**Why:**

- HTTP-only cookies are JavaScript-protected for security
- The token lives in `mais_backend_token` HTTP-only cookie
- Only the server (Next.js proxy) can read it

---

### Mistake 3: CORS Error with `credentials: 'include'`

```typescript
// ❌ WRONG: Sending credentials to different origin
const response = await fetch('http://localhost:3001/v1/chat/message', {
  credentials: 'include', // Browser sends cookies to localhost:3001
});
// CORS error: localhost:3000 sending to localhost:3001

// ✅ CORRECT: Same origin (localhost:3000 to localhost:3000)
const response = await fetch('/api/agent/message', {
  // credentials: 'include' is NOT needed for same-origin
});
```

**Why:**

- Express API doesn't recognize Next.js auth cookies
- CORS blocks credentials to different origins
- Proxy is same-origin, so no credentials header needed

---

### Mistake 4: Forgetting 401 Check

```typescript
// ❌ WRONG: Assumes always authenticated
const response = await fetch('/api/tenant-admin/packages');
const data = await response.json(); // If 401, data = { error: 'Unauthorized' }
setPackages(data); // Crash when trying to map array

// ✅ CORRECT: Check response.ok first
const response = await fetch('/api/tenant-admin/packages');
if (!response.ok) {
  if (response.status === 401) {
    // User not authenticated, redirect to login
    window.location.href = '/login';
  }
  return;
}
const data = await response.json();
setPackages(data);
```

---

## Quick Reference: Auth Pattern

### For Client Components (Authenticated)

```typescript
'use client';

// 1. Fetch from /api/* proxy
const response = await fetch('/api/tenant-admin/packages');

// 2. Check if authenticated
if (response.status === 401) {
  // User not logged in
  return <LoginPrompt />;
}

// 3. Parse and use data
const data = await response.json();
```

### For Server Components (Authenticated)

```typescript
// No 'use client'

// 1. Use server API client
const api = await createServerApiClient();

// 2. Call backend directly
const response = await api.getPackages();

// 3. Check response
if (!response.ok) return <Error />;

// 4. Use data in RSC
const packages = response.body;
```

### For Public Pages (Unauthenticated)

```typescript
// Tenant storefronts don't need authentication
const response = await fetch(`${API_BASE_URL}/v1/public/tenant/${slug}`);
const data = await response.json();
```

---

## Troubleshooting: Common Errors

### Error 1: "unavailable" or {"available": false}

```json
{
  "available": false,
  "reason": "not_authenticated",
  "message": "Please sign in to access your assistant."
}
```

**Diagnosis:** User not authenticated (401 response)

**Fix:**

```typescript
const response = await fetch('/api/agent/health');
if (response.status === 401) {
  return <LoginPrompt />;
}
```

---

### Error 2: CORS Error

```
Access to fetch at 'http://localhost:3001/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Diagnosis:** Calling Express directly from client component

**Fix:** Use proxy route instead

```typescript
// ❌ Wrong
const response = await fetch('http://localhost:3001/v1/...');

// ✅ Correct
const response = await fetch('/api/tenant-admin/...'); // Proxy
```

---

### Error 3: 401 Unauthorized

```
{ "error": "Unauthorized", "status": 401 }
```

**Diagnosis:**

- Proxy returned 401 (user not authenticated)
- OR missing Authorization header in custom request

**For proxy route:**

```typescript
if (response.status === 401) {
  // User not logged in, show login
  window.location.href = '/login';
}
```

---

### Error 4: "token is undefined"

```typescript
// ❌ WRONG: Trying to access token in client
const token = localStorage.getItem('backendToken'); // undefined
const token = sessionStorage.getItem('adminToken'); // undefined
```

**Diagnosis:** Backend token isn't stored client-side (intentional)

**Fix:** Use proxy which has token automatically

```typescript
// ✅ Correct
const response = await fetch('/api/tenant-admin/packages');
// Proxy adds token internally
```

---

## Prevention Rules (Pin to Desk)

1. **Client components use `/api/*` proxies**
   - Never call `NEXT_PUBLIC_API_URL` directly
   - Proxy adds authentication automatically

2. **Server components call Express directly**
   - Use `createServerApiClient()`
   - Token is in HTTP-only cookie

3. **Check response.ok or status 401**
   - Client components must handle unauthenticated state
   - Show login prompt, not error crash

4. **Never hardcode tokens**
   - Don't try to access HTTP-only cookies
   - Don't store backend token in localStorage
   - Let the proxy handle it

5. **Use correct proxy route**
   - `/api/tenant-admin/*` → Express `/v1/tenant-admin`
   - `/api/agent/*` → Express `/v1/agent`
   - Wrong proxy = 404

---

## Related Files

| File                                                   | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `apps/web/src/app/api/tenant-admin/[...path]/route.ts` | Proxy for authenticated tenant admin API |
| `apps/web/src/app/api/agent/[...path]/route.ts`        | Proxy for authenticated agent API        |
| `apps/web/src/lib/api.ts`                              | SSR-aware ts-rest client (server use)    |
| `apps/web/src/lib/auth.ts`                             | NextAuth.js + getBackendToken()          |
| `server/src/middleware/tenant.ts`                      | Backend tenant validation                |

---

## Code Review Checklist

Before approving a PR with API calls:

- [ ] Client components use `/api/*` proxy, not direct `NEXT_PUBLIC_API_URL`
- [ ] No hardcoded `Authorization` headers in client code
- [ ] No access to `localStorage.getItem('backendToken')` or similar
- [ ] 401 responses handled (check response.status === 401)
- [ ] Server components use `createServerApiClient()`
- [ ] No CORS errors in browser console
- [ ] Error handling includes auth failures
- [ ] No credential leaks in network tab (no tokens in URLs/headers)

---

## Key Insight

**The proxy pattern is not bureaucracy—it's a security boundary.**

- Client components can't access backend tokens (security)
- Proxy adds token server-side (safe)
- Client sees consistent error handling (DX)
- No CORS headaches (same origin)

**When developers say "why can't I call the API directly?"**

Answer: **"You can't, because the browser can't access the token. The proxy bridges that gap securely."**

---

## Resources

- **Apps/Web README:** `apps/web/README.md` (SSR-aware API client section)
- **NextAuth.js Docs:** https://authjs.dev/getting-started (HTTP-only cookies)
- **Next.js API Routes:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers (BFF pattern)
- **CORS Guide:** `docs/guides/CORS_AND_AUTHENTICATION.md` (if exists)
