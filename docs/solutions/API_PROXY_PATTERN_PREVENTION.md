# API Proxy Pattern Prevention Guide

**Problem:** Client components calling backend API directly without proper authentication, exposing backend tokens or causing 401/403 errors.

**Root Cause:** Next.js + Express architecture requires secure token exchange. NextAuth manages sessions on Next.js side, but Express API requires JWT in Authorization header. Client components can't access backend tokens directly (security).

**Solution:** Use API proxy pattern - server-side routes that bridge authentication between NextAuth session and Express backend.

---

## The Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Next.js App                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Client Component (use client)                          │
│       ↓                                                 │
│  fetch('/api/tenant-admin/packages')                   │
│       ↓                                                 │
│  /api/tenant-admin/[...path]/route.ts (Proxy)          │
│       │                                                 │
│       ├─→ getBackendToken() [Server-side]              │
│       │   └─→ Gets JWT from NextAuth session           │
│       │                                                 │
│       └─→ fetch(Express API + token)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Express Backend API                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  /v1/tenant-admin/packages (Protected)                 │
│  └─→ Validates Authorization: Bearer {token}           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Benefit:** Backend token NEVER exposed to client-side JavaScript. It flows:

1. Express → NextAuth session (secure, server-side)
2. NextAuth session → `getBackendToken()` (server-side helper)
3. `getBackendToken()` → Proxy route (server-side)
4. Proxy route → Client fetch (no token in client)

---

## When to Use API Proxy

Use API proxy when:

1. **Client component needs backend data** - 'use client' component calling Express API
2. **Authentication required** - Endpoint requires JWT in Authorization header
3. **No Server Component alternative** - Data can't be fetched in Server Component
4. **Token management needed** - Client can't know about backend token

Do NOT use API proxy when:

1. **Server Component available** - Fetch data in Server Component instead
2. **No authentication** - Public endpoints can be called directly from client
3. **You can use ts-rest client** - Contracts may already route via proxy internally

---

## How to Create an API Proxy

### Step 1: Create the Proxy Route File

Create `/apps/web/src/app/api/{feature}/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Get backend token from NextAuth session
    const token = await getBackendToken();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract path and query string
    const { path } = await params;
    const pathString = path.join('/');
    const url = new URL(request.url);
    const queryString = url.search;

    // Build backend URL
    const backendUrl = `${API_BASE_URL}/v1/{feature}/${pathString}${queryString}`;

    // Prepare headers
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    // Handle request body for mutations
    const method = request.method;
    let body: string | undefined;

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      body = await request.text();
    }

    // Forward request to backend
    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
    });

    // Parse response
    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Not JSON - return as-is
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    logger.error('API proxy error', {
      error,
      method: request.method,
      url: request.url,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export handler for all HTTP methods
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}
```

### Step 2: Call from Client Component

```typescript
'use client';

import { useEffect, useState } from 'react';

export function PackageList() {
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPackages() {
      try {
        // Call proxy route, NOT backend directly
        const response = await fetch('/api/tenant-admin/packages');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setPackages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      }
    }

    fetchPackages();
  }, []);

  if (error) return <div className="error">{error}</div>;
  return <div>{packages.length} packages</div>;
}
```

---

## Architecture Patterns to Follow

### Pattern 1: Query Data (GET)

**Flow:** Client Component → Proxy (GET) → Backend (GET) → Return data

```typescript
// Client Component (use client)
const response = await fetch('/api/tenant-admin/packages');
const packages = await response.json();

// Proxy Route
const backendUrl = `${API_BASE_URL}/v1/tenant-admin/packages${queryString}`;
const response = await fetch(backendUrl, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` },
});
```

**Status Codes:**

- 200: Success
- 401: Not authenticated (getBackendToken returned null)
- 404: Resource not found (backend returned 404)
- 500: Server error

### Pattern 2: Mutate Data (POST/PUT/PATCH)

**Flow:** Client Component → Proxy (POST body) → Backend (POST body) → Return result

```typescript
// Client Component (use client)
const response = await fetch('/api/tenant-admin/packages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Package' }),
});

// Proxy Route
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': contentType };
const body = await request.text(); // Copy exact request body
const response = await fetch(backendUrl, {
  method: 'POST',
  headers,
  body,
});
```

**Status Codes:**

- 201: Created
- 200: Updated
- 400: Validation error
- 409: Conflict (e.g., duplicate booking)
- 500: Server error

### Pattern 3: Delete Data (DELETE)

**Flow:** Client Component → Proxy (DELETE) → Backend (DELETE) → Confirm

```typescript
// Client Component (use client)
const response = await fetch('/api/tenant-admin/packages/123', {
  method: 'DELETE',
});

// Proxy Route
const response = await fetch(backendUrl, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
```

**Status Codes:**

- 200: Success / 204: No Content
- 404: Not found
- 500: Server error

---

## Code Review Checklist

Use this checklist when reviewing pull requests with API changes:

### Authentication Security

- [ ] Proxy route calls `getBackendToken()` before making backend request
- [ ] No hardcoded tokens in proxy route
- [ ] No token exposure in client-side code
- [ ] Returns 401 if `getBackendToken()` returns null
- [ ] Authorization header uses `Bearer ${token}` format

### Request/Response Handling

- [ ] Proxy preserves original HTTP method (GET, POST, PUT, DELETE)
- [ ] Proxy preserves request body (for POST/PUT/PATCH)
- [ ] Proxy preserves Content-Type header
- [ ] Proxy forwards query strings (`?sort=name&limit=10`)
- [ ] Response headers preserved where needed (Content-Type)
- [ ] Non-JSON responses handled (return as-is)

### Error Handling

- [ ] 401 returned when token unavailable
- [ ] Backend errors (4xx, 5xx) forwarded to client
- [ ] Proxy errors logged with context (method, URL, error)
- [ ] User-friendly error messages (not stack traces)
- [ ] No token leakage in error messages

### Next.js Specifics

- [ ] Uses `NextRequest` and `NextResponse` (not Express Request/Response)
- [ ] Async handler for dynamic route `[...path]`
- [ ] `params` awaited before use (`await params`)
- [ ] All HTTP methods exported (GET, POST, PUT, PATCH, DELETE)
- [ ] No duplicate routes (only one proxy per feature)

### Best Practices

- [ ] Proxy route is minimal (delegation, not logic)
- [ ] No business logic in proxy (goes in backend)
- [ ] Error logging uses `logger.error()` not `console.log()`
- [ ] Route documented with example (comment at top)
- [ ] Base URL uses `process.env.NEXT_PUBLIC_API_URL`

---

## Quick Decision Tree

### "Should I use a proxy route?"

```
Is the request from a client component?
├─ YES: Continue
└─ NO: You don't need a proxy, use Server Component

Does the backend require authentication?
├─ YES: Continue
└─ NO: Call backend directly, no proxy needed

Is the endpoint already defined in Express?
├─ YES: Continue
└─ NO: Add backend route first

Can you fetch data in a Server Component instead?
├─ YES: Use Server Component, no proxy needed
└─ NO: Create proxy route

Does a ts-rest contract exist for this endpoint?
├─ YES: May already route via proxy internally
└─ NO: Create new proxy route
```

### "What error am I getting?"

| Error                  | Cause                  | Fix                                                            |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| **401 Unauthorized**   | Token missing/invalid  | Check `getBackendToken()` returns token; verify session active |
| **403 Forbidden**      | User lacks permission  | Verify user role on backend; check tenant scoping              |
| **404 Not Found**      | Endpoint doesn't exist | Verify backend route exists; check path construction           |
| **500 Internal Error** | Backend error          | Check backend logs; verify request body valid                  |
| **Fetch failed**       | Network error          | Verify `NEXT_PUBLIC_API_URL` env var set; check API running    |

---

## Existing Proxy Routes (Reference)

MAIS has two production proxy routes you can use as templates:

### 1. `/api/tenant-admin/[...path]/route.ts`

- **Purpose:** Proxy all tenant admin routes to Express `/v1/tenant-admin/*`
- **Authentication:** NextAuth session → `getBackendToken()`
- **Use for:** Package management, booking admin, settings

### 2. `/api/agent/[...path]/route.ts`

- **Purpose:** Proxy all agent routes to Express `/v1/agent/*`
- **Authentication:** NextAuth session → `getBackendToken()`
- **Use for:** AI assistant endpoints, growth assistant

Both follow the same pattern - copy the structure for new proxy routes.

---

## Prevention Strategies

### Strategy 1: Server Components First

**Always prefer Server Components over Client Components with proxies.**

```typescript
// ❌ Client component with proxy (more complex)
'use client';
export function PackageList() {
  const [packages, setPackages] = useState([]);
  useEffect(() => {
    fetch('/api/tenant-admin/packages').then(r => r.json()).then(setPackages);
  }, []);
  return <div>{packages}</div>;
}

// ✅ Server component (simpler, no proxy needed)
export async function PackageList() {
  const token = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/tenant-admin/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const packages = await response.json();
  return <div>{packages}</div>;
}
```

**Benefit:** No proxy route needed, simpler architecture, better performance (no extra request).

### Strategy 2: Cache Shared Requests

**If multiple components fetch the same data, wrap in React `cache()`.**

```typescript
// ✅ Wrap in cache() - prevents duplicate requests
export const getCachedPackages = cache(async () => {
  const token = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/tenant-admin/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
});

// Both of these fetch once per request
export async function DashboardPage() {
  const packages = await getCachedPackages(); // First fetch
}

export async function SidebarWidget() {
  const packages = await getCachedPackages(); // Reuses first result
}
```

**Benefit:** One network request per page render, not per component.

### Strategy 3: Test Token Retrieval

**Always test that `getBackendToken()` returns a token in your environment.**

```typescript
// Test in your proxy route
const token = await getBackendToken();
console.log('Token available:', !!token); // Should be true
console.log('Token starts with:', token?.substring(0, 20)); // Should be JWT start

// In development, add debug logging
if (!token && process.env.NODE_ENV === 'development') {
  logger.warn('getBackendToken returned null - check NextAuth session');
}
```

### Strategy 4: Type-Safe Client Calls

**Always use TypeScript types for proxy responses.**

```typescript
// ❌ No type safety
const response = await fetch('/api/tenant-admin/packages');
const data = await response.json();

// ✅ Type-safe
interface Package {
  id: string;
  name: string;
}

const response = await fetch('/api/tenant-admin/packages');
const packages: Package[] = await response.json();
```

### Strategy 5: Graceful Degradation

**Handle auth failures gracefully in client components.**

```typescript
'use client';

export function PackageList() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tenant-admin/packages')
      .then(async (r) => {
        if (r.status === 401) {
          // Not authenticated - redirect to login
          window.location.href = '/login';
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load packages'
        );
      });
  }, []);

  if (error) return <div className="error">{error}</div>;
  // ... render packages
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Bypassing Proxy

**WRONG:** Calling Express API directly from client

```typescript
// ❌ NEVER DO THIS
'use client';
export function PackageList() {
  const [token] = useState(localStorage.getItem('token')); // No token in localStorage!
  useEffect(() => {
    fetch('http://localhost:3001/v1/tenant-admin/packages', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [token]);
}
```

**Problems:**

1. Token not in localStorage (NextAuth stores in HTTP-only cookie)
2. CORS errors (frontend origin not allowed on backend)
3. Token exposure in network requests

**Fix:** Use proxy route instead

```typescript
// ✅ Use proxy
fetch('/api/tenant-admin/packages');
```

### Anti-Pattern 2: Hardcoding API URL in Client

**WRONG:** Using `NEXT_PUBLIC_API_URL` directly in client fetch

```typescript
// ❌ WRONG - direct backend call with auth
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const token = localStorage.getItem('token'); // Doesn't exist!

fetch(`${API_URL}/v1/tenant-admin/packages`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Fix:** Use proxy route which has access to token

```typescript
// ✅ Correct - proxy has token access
fetch('/api/tenant-admin/packages');
```

### Anti-Pattern 3: Duplicate Proxy Logic

**WRONG:** Creating multiple proxy routes with same code

```typescript
// ❌ /api/packages/[...path]/route.ts - Same code as tenant-admin!
// ❌ /api/bookings/[...path]/route.ts - Same code again!

// ✅ Use single proxy route for all /tenant-admin/* paths
// /api/tenant-admin/[...path]/route.ts handles packages, bookings, etc.
```

### Anti-Pattern 4: Proxy Containing Business Logic

**WRONG:** Proxy doing more than forwarding

```typescript
// ❌ WRONG - Proxy has business logic
async function handleRequest(request: NextRequest) {
  const token = await getBackendToken();
  const path = params.path.join('/');

  // Proxy should NOT do this:
  if (path.includes('special-case')) {
    // Complex logic here
    const result = await specialProcessing();
    return result;
  }

  // Forward to backend...
}
```

**Fix:** Keep proxy minimal, put logic in backend

```typescript
// ✅ Proxy just forwards
async function handleRequest(request: NextRequest) {
  const token = await getBackendToken();
  const response = await fetch(backendUrl, { headers: { Authorization: `Bearer ${token}` } });
  return NextResponse.json(await response.json(), { status: response.status });
}
```

### Anti-Pattern 5: Not Handling Content-Type

**WRONG:** Not preserving request body content type

```typescript
// ❌ Missing Content-Type for multipart/form-data
const headers = { Authorization: `Bearer ${token}` };
const response = await fetch(backendUrl, { method: 'POST', headers, body });
```

**Fix:** Preserve original content type

```typescript
// ✅ Preserve Content-Type
const contentType = request.headers.get('content-type');
const headers: HeadersInit = { Authorization: `Bearer ${token}` };
if (contentType) headers['Content-Type'] = contentType;
const response = await fetch(backendUrl, { method: 'POST', headers, body });
```

---

## Common Errors and Solutions

### Error: "401 Unauthorized from proxy"

**Symptom:** Client gets 401 from `/api/tenant-admin/...` route

**Diagnosis:**

```typescript
// In proxy route, add debug logging
const token = await getBackendToken();
if (!token) {
  logger.warn('getBackendToken() returned null - NextAuth session missing?');
  return NextResponse.json({ error: 'No token' }, { status: 401 });
}
logger.info('Got token from NextAuth', { tokenStart: token.substring(0, 20) });
```

**Solutions:**

1. Verify user is logged in (check `/api/auth/session`)
2. Verify NextAuth session active (not expired)
3. Check `AUTH_SECRET` env var is set and matches backend
4. Verify `getBackendToken()` implementation is correct

### Error: "CORS errors when calling proxy"

**Symptom:** Browser blocks fetch to `/api/...` with CORS error

**Diagnosis:** Client component making wrong request

```typescript
// ❌ WRONG - calling backend directly
fetch('http://localhost:3001/v1/tenant-admin/packages');

// ✅ CORRECT - calling proxy on same origin
fetch('/api/tenant-admin/packages');
```

**Solutions:**

1. Use proxy route URL, not backend URL
2. Don't hardcode `http://localhost:3001` in client
3. Proxy is same-origin, no CORS headers needed

### Error: "Token missing in backend"

**Symptom:** Backend rejects request with "missing Authorization header"

**Diagnosis:** Proxy not adding token

```typescript
// Check proxy is including token
const headers = { Authorization: `Bearer ${token}` };
const response = await fetch(backendUrl, { headers });
```

**Solutions:**

1. Verify `getBackendToken()` returns non-null value
2. Verify Authorization header is added to request
3. Verify header format is exactly `Bearer ${token}` (space required)
4. Check backend middleware validates this header

### Error: "Request body not forwarded"

**Symptom:** Backend receives empty body for POST/PUT requests

**Diagnosis:** Proxy not copying request body

```typescript
// ❌ WRONG - no body forwarded
const response = await fetch(backendUrl, { method: 'POST', headers });

// ✅ CORRECT - body forwarded
const body = await request.text();
const response = await fetch(backendUrl, {
  method: request.method,
  headers,
  body,
});
```

**Solutions:**

1. Copy original request body with `await request.text()`
2. Pass body to fetch only for non-GET requests
3. Preserve Content-Type header from original request

---

## Testing Proxy Routes

### Unit Test Example

```typescript
// __tests__/api/tenant-admin/route.test.ts
import { POST } from '@/app/api/tenant-admin/[...path]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getBackendToken: jest.fn(),
}));

test('returns 401 when no token', async () => {
  const mockGetBackendToken = require('@/lib/auth').getBackendToken;
  mockGetBackendToken.mockResolvedValue(null);

  const request = new NextRequest('http://localhost:3000/api/tenant-admin/packages', {
    method: 'GET',
  });

  const response = await POST(request, { params: Promise.resolve({ path: ['packages'] }) });
  expect(response.status).toBe(401);
});

test('forwards token to backend', async () => {
  const mockGetBackendToken = require('@/lib/auth').getBackendToken;
  mockGetBackendToken.mockResolvedValue('test-token');

  const mockFetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify([{ id: '1', name: 'Package' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  global.fetch = mockFetch;

  const request = new NextRequest('http://localhost:3000/api/tenant-admin/packages', {
    method: 'GET',
  });

  await POST(request, { params: Promise.resolve({ path: ['packages'] }) });

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/tenant-admin/packages'),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer test-token',
      }),
    })
  );
});
```

### E2E Test Example

```typescript
// e2e/proxy.spec.ts
import { test, expect } from '@playwright/test';

test('client can fetch packages via proxy', async ({ page, context }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[name="email"]', 'admin@handled.ai');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  // Make API call from client
  const response = await context.request.get('/api/tenant-admin/packages');
  expect(response.status()).toBe(200);

  const packages = await response.json();
  expect(Array.isArray(packages)).toBe(true);
});
```

---

## Key Takeaway

**The proxy pattern securely bridges NextAuth sessions with Express API authentication.**

Pattern:

1. Client calls `/api/{feature}/{path}` (proxy route, same-origin)
2. Proxy gets token from `getBackendToken()` (server-side, secure)
3. Proxy forwards request to Express with token in Authorization header
4. Express validates token and processes request
5. Proxy returns response to client

**Rules:**

- Client never sees backend token
- All auth happens server-side
- Proxy is minimal forwarding layer
- Business logic stays in backend
- Always test token retrieval in your environment
