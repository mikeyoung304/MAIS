# API Proxy Pattern Quick Reference

**Print this and pin to your desk when working with Next.js client components.**

---

## The Rule

**Client components CANNOT access Express backend directly.**

They must use an API proxy route that handles authentication.

```
Client Component (use client)
    ↓
fetch('/api/tenant-admin/packages')  ← Proxy route on Next.js
    ↓
API Proxy (/api/tenant-admin/[...path]/route.ts)
    ├─ Gets backend token via getBackendToken()
    ├─ Adds Authorization header
    └─ Forwards to Express backend
    ↓
Express API (/v1/tenant-admin/packages)
    ↓
Returns data to client component
```

---

## Quick Decision: Proxy or Not?

| Question                                   | Answer | Action                                             |
| ------------------------------------------ | ------ | -------------------------------------------------- |
| Is this a client component ('use client')? | YES    | Use proxy                                          |
| Does backend require authentication?       | YES    | Use proxy                                          |
| Can you use a Server Component instead?    | YES    | **Use Server Component instead** (no proxy needed) |
| Does proxy route already exist?            | YES    | Use existing proxy                                 |
| Does proxy route exist?                    | NO     | Create new proxy route                             |

---

## 30-Second Proxy Creation

### 1. Create File

```bash
apps/web/src/app/api/{feature}/[...path]/route.ts
```

### 2. Copy Template

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
    const token = await getBackendToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await params;
    const pathString = path.join('/');
    const url = new URL(request.url);
    const queryString = url.search;
    const backendUrl = `${API_BASE_URL}/v1/{feature}/${pathString}${queryString}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    const method = request.method;
    let body: string | undefined;

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType) headers['Content-Type'] = contentType;
      body = await request.text();
    }

    const response = await fetch(backendUrl, { method, headers, body });
    const responseText = await response.text();

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return new NextResponse(responseText, {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('Content-Type') || 'text/plain' },
      });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    logger.error('API proxy error', { error, method: request.method, url: request.url });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

### 3. Update Placeholder

Replace `{feature}` with your feature name (e.g., `tenant-admin`, `agent`, `bookings`)

### 4. Use from Client

```typescript
'use client';

const response = await fetch('/api/{feature}/resource');
const data = await response.json();
```

---

## Checklist: Before Committing

- [ ] Proxy route has `getBackendToken()` call
- [ ] Authorization header uses `Bearer ${token}` format
- [ ] Returns 401 if token is null
- [ ] All HTTP methods exported (GET, POST, PUT, PATCH, DELETE)
- [ ] Request body copied for mutations (`await request.text()`)
- [ ] Content-Type header preserved
- [ ] Response text parsed as JSON (or forwarded as-is)
- [ ] Error logged with `logger.error()`
- [ ] Backend URL uses `/v1/{feature}/` prefix
- [ ] No business logic in proxy (just forwarding)

---

## Existing Proxy Routes (Copy These)

| Proxy                         | Backend              | Use For                      |
| ----------------------------- | -------------------- | ---------------------------- |
| `/api/tenant-admin/[...path]` | `/v1/tenant-admin/*` | Packages, bookings, settings |
| `/api/agent/[...path]`        | `/v1/agent/*`        | AI assistant, growth helper  |

---

## Common Errors

| Error                     | Cause                    | Fix                                                              |
| ------------------------- | ------------------------ | ---------------------------------------------------------------- |
| **401 Unauthorized**      | Token missing/invalid    | Check `getBackendToken()` returns value; verify session          |
| **CORS error**            | Calling backend directly | Use proxy route `/api/{feature}/...` not `http://localhost:3001` |
| **404 Not Found**         | Path doesn't exist       | Verify backend route exists; check path construction             |
| **Empty body in backend** | Body not forwarded       | Copy with `await request.text()` for POST/PUT/PATCH              |
| **Network error**         | API not running          | Check `NEXT_PUBLIC_API_URL` env var; verify backend running      |

---

## Anti-Patterns (DON'T DO THESE)

### Anti-Pattern 1: Hardcoding Backend URL in Client

```typescript
// ❌ WRONG
fetch('http://localhost:3001/v1/tenant-admin/packages', {
  headers: { Authorization: `Bearer ${token}` }, // Token not in client!
});

// ✅ CORRECT
fetch('/api/tenant-admin/packages');
```

### Anti-Pattern 2: Getting Token from localStorage

```typescript
// ❌ WRONG - Not in localStorage
const token = localStorage.getItem('backendToken');

// ✅ CORRECT - Server component or proxy route
const token = await getBackendToken();
```

### Anti-Pattern 3: Business Logic in Proxy

```typescript
// ❌ WRONG
async function handleRequest(request, context) {
  // Complex validation here
  if (request.body.date) {
    const available = await checkAvailability(request.body.date);
    if (!available) return error();
  }
  // Forward to backend...
}

// ✅ CORRECT - Proxy just forwards
async function handleRequest(request, context) {
  const token = await getBackendToken();
  const response = await fetch(backendUrl, { headers: { Authorization } });
  return response;
}
```

### Anti-Pattern 4: Exposing Token in Error Messages

```typescript
// ❌ WRONG
logger.error('Request failed', { token, body }); // Exposes token!

// ✅ CORRECT
logger.error('Request failed', { method, url }); // Safe
```

---

## File Map

| Task             | File                                                | Function                       |
| ---------------- | --------------------------------------------------- | ------------------------------ |
| Create proxy     | `apps/web/src/app/api/{feature}/[...path]/route.ts` | handleRequest()                |
| Get token        | `apps/web/src/lib/auth.ts`                          | `getBackendToken()`            |
| Call from client | Your client component                               | `fetch('/api/{feature}/path')` |
| Debug token      | NextAuth session                                    | Check cookies, JWT valid       |

---

## Example: Package Management Proxy

### File: `apps/web/src/app/api/tenant-admin/[...path]/route.ts`

```typescript
// Copy template above, replace {feature} with 'tenant-admin'
```

### Use from Client:

```typescript
'use client';

// Get all packages
const response = await fetch('/api/tenant-admin/packages');
const packages = await response.json();

// Get one package
const response = await fetch('/api/tenant-admin/packages/123');
const pkg = await response.json();

// Create package
const response = await fetch('/api/tenant-admin/packages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Package' }),
});

// Update package
const response = await fetch('/api/tenant-admin/packages/123', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Updated' }),
});

// Delete package
const response = await fetch('/api/tenant-admin/packages/123', {
  method: 'DELETE',
});
```

---

## Why This Pattern?

**Problem:** Backend requires JWT token. Client components can't access backend token (security).

**Solution:** Proxy route has access to token via `getBackendToken()` (server-side only).

**Flow:**

1. NextAuth stores backend token in HTTP-only cookie (secure)
2. Client calls proxy route (same-origin, no CORS)
3. Proxy uses `getBackendToken()` to access token
4. Proxy forwards to backend with token
5. Client gets response (token never exposed)

**Benefit:** Token stays secure, client can still call backend APIs.

---

## Testing Your Proxy

### Quick Test

```typescript
// In browser console after login
fetch('/api/tenant-admin/packages')
  .then((r) => r.json())
  .then((d) => console.log('Success:', d))
  .catch((e) => console.error('Error:', e));
```

### If 401: Check Token

```typescript
// Server Component
const token = await getBackendToken();
console.log('Token:', token ? 'exists' : 'missing');
```

### If 404: Check Path

```typescript
// Verify backend route exists
// GET http://localhost:3001/v1/tenant-admin/packages

// Your proxy path must match
// GET /api/tenant-admin/packages
```

---

## Key Insight

**The proxy route is the ONLY place where client code gets access to the backend token.**

Everywhere else: Token stays server-side only.

This is why:

- Server Components use `getBackendToken()` directly
- Client Components use proxy routes
- We NEVER expose token to client-side JavaScript
- We NEVER store token in localStorage
