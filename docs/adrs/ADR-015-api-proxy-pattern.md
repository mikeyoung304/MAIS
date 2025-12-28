# ADR-015: API Proxy Pattern for Next.js Client Components

**Date:** 2025-12-28
**Status:** ACCEPTED
**Context:** Next.js App Router + Express API architecture with NextAuth session management
**Participants:** Architecture team

---

## Problem Statement

Client components in Next.js cannot directly call Express API endpoints that require JWT authentication because:

1. **Token Storage:** Backend tokens are stored in HTTP-only cookies by NextAuth (secure, but client-side code can't access)
2. **Token Retrieval:** `getBackendToken()` only works server-side (uses next/headers)
3. **CORS Issues:** Browser will block requests to different origin (localhost:3001) from client-side JavaScript
4. **Security:** Exposing backend token to client-side code violates zero-trust security model

Previously, developers either:

- Made direct fetch calls with `getBackendToken()` (wrong, doesn't work in client components)
- Stored tokens in localStorage (wrong, insecure)
- Created duplicate auth logic in components (wrong, brittle)
- Never made API calls from client components (overly restrictive, complicates UX)

---

## Solution: API Proxy Pattern

Create server-side proxy routes that:

1. Accept client requests at `/api/{feature}/{path}`
2. Retrieve backend token via `getBackendToken()`
3. Forward request to Express API with token in Authorization header
4. Return response to client

**Route Structure:**

```
/apps/web/src/app/api/{feature}/[...path]/route.ts
```

**Example:**

```
Client: POST /api/tenant-admin/packages (no token)
  ↓
Proxy: Retrieves token, forwards POST /v1/tenant-admin/packages (with token)
  ↓
Express: Validates token, processes request
  ↓
Proxy: Returns response to client
```

### Why This Works

1. **Token stays server-side:** `getBackendToken()` runs in proxy route (server code)
2. **Same-origin calls:** Client calls `/api/...` on same domain (no CORS)
3. **Secure forwarding:** Token only in Authorization header, never exposed to client
4. **Standard pattern:** Well-established pattern in Next.js community (API routes as middleware)

---

## Design Details

### Route Implementation

All proxy routes follow same template with minimal variation:

```typescript
// /api/{feature}/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // 1. Get token from NextAuth session
    const token = await getBackendToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Build backend URL
    const { path } = await params;
    const pathString = path.join('/');
    const queryString = new URL(request.url).search;
    const backendUrl = `${API_BASE_URL}/v1/{feature}/${pathString}${queryString}`;

    // 3. Prepare headers
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    // 4. Copy request body for mutations
    let body: string | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType) headers['Content-Type'] = contentType;
      body = await request.text();
    }

    // 5. Forward to backend
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    // 6. Parse and return response
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

// Export handlers for all HTTP methods
export const { GET, POST, PUT, PATCH, DELETE } = {
  GET: (r, c) => handleRequest(r, c),
  POST: (r, c) => handleRequest(r, c),
  PUT: (r, c) => handleRequest(r, c),
  PATCH: (r, c) => handleRequest(r, c),
  DELETE: (r, c) => handleRequest(r, c),
};
```

### Key Design Decisions

1. **Minimal proxy logic**
   - No validation, no business logic
   - Just request/response forwarding
   - Logic stays in backend

2. **Generic path handling**
   - `[...path]` catch-all route
   - Forwards `/api/{feature}/resource/123?sort=name` → `/v1/{feature}/resource/123?sort=name`
   - One proxy route per feature, not one per endpoint

3. **Content-Type preservation**
   - Extracts and preserves original Content-Type
   - Required for multipart/form-data
   - JSON endpoints work without explicit header

4. **Raw body forwarding**
   - Body read as text with `await request.text()`
   - NOT parsed and re-serialized
   - Preserves exact client payload

5. **Error differentiation**
   - 401 for missing authentication (not 500)
   - Backend status codes forwarded as-is
   - Helps debugging

---

## When to Use API Proxy

### Use Proxy When:

1. **Client component needs backend data**

   ```typescript
   'use client';
   const response = await fetch('/api/tenant-admin/packages');
   ```

2. **Backend requires authentication**
   - Express endpoint has auth middleware
   - Requires JWT in Authorization header

3. **No Server Component alternative**
   - Data depends on client-side state
   - User interaction needed before fetch

### Don't Use Proxy When:

1. **Server Component available**

   ```typescript
   // ✅ Preferred - no proxy needed
   export async function Dashboard() {
     const token = await getBackendToken();
     const packages = await fetch(`${API_URL}/v1/tenant-admin/packages`, {
       headers: { Authorization: `Bearer ${token}` },
     });
   }
   ```

2. **Endpoint is public**

   ```typescript
   // No proxy needed - no auth required
   fetch('/v1/public/landing-page');
   ```

3. **Already handled by ts-rest client**
   - ts-rest contracts may route via proxy internally
   - Check if contract exists first

---

## Implementation Locations

### Current Production Proxies

| Route                         | Purpose                  | Backend              |
| ----------------------------- | ------------------------ | -------------------- |
| `/api/tenant-admin/[...path]` | Admin CRUD operations    | `/v1/tenant-admin/*` |
| `/api/agent/[...path]`        | AI assistant integration | `/v1/agent/*`        |

### Template for New Proxies

When adding new feature requiring client-side API calls:

1. **Create:** `apps/web/src/app/api/{feature}/[...path]/route.ts`
2. **Copy template above**
3. **Update:** Replace `{feature}` with feature name
4. **Test:** Verify token forwarding and error handling
5. **Document:** Add route to this ADR once proven

---

## Security Model

### Token Flow (Secure)

```
Express API
  ↓ (After login)
NextAuth Session (HTTP-only cookie)
  ↓ (Server-side only)
getBackendToken() extracts token from cookie
  ↓ (Server-side only)
Proxy route adds token to Authorization header
  ↓ (Server-to-server HTTPS)
Express validates token in request
```

**Token is NEVER:**

- Visible to client-side JavaScript
- Stored in localStorage
- Passed through browser cookies to client
- Exposed in error messages
- Logged with sensitive data

### Attack Prevention

1. **XSS attacks:** Token in HTTP-only cookie, not accessible to `document.cookie`
2. **CSRF attacks:** Server validates origin, proxy same-origin
3. **Token theft:** Token never sent to client, only server-to-server
4. **Cross-tenant access:** Backend validates `tenantId` in token, not proxy

---

## Alternative Approaches Considered

### Alternative 1: Direct Client-Side Calls

**Rejected because:**

- Token not accessible to client (HTTP-only cookie)
- CORS errors from browser
- Insecure if token exposed

### Alternative 2: Store Token in localStorage

**Rejected because:**

- Vulnerable to XSS attacks
- Breaks multi-tab sessions
- Violates zero-trust security model
- NextAuth explicitly stores in HTTP-only for security

### Alternative 3: GraphQL API Layer

**Rejected because:**

- Over-engineered for current scope
- More complex error handling
- No type advantage over ts-rest contracts

### Alternative 4: Server Components Only

**Rejected because:**

- Overly restrictive for interactive UX
- Forces all data fetching to render time
- Can't respond to user interactions
- Some features require client-side state

### Alternative 5: Custom Middleware

**Rejected because:**

- Duplicates Next.js built-in routing
- More complex than route handlers
- No advantage over standard route.ts

---

## Implementation Checklist

When adding a new proxy route:

- [ ] Create `/api/{feature}/[...path]/route.ts`
- [ ] Copy template from ADR
- [ ] Test token retrieval: `getBackendToken()` returns value
- [ ] Test forwarding: request reaches backend with token
- [ ] Test auth failure: 401 when no token
- [ ] Test mutations: POST/PUT body forwarded
- [ ] Test query strings: `?sort=name` preserved
- [ ] Test error handling: backend errors returned to client
- [ ] Test error logging: errors logged without token
- [ ] Document in route with example comment
- [ ] Add to list of production proxies

---

## Testing Strategy

### Unit Tests

```typescript
// Test token retrieval
test('returns 401 when token unavailable', async () => {
  jest.spyOn(auth, 'getBackendToken').mockResolvedValue(null);
  const response = await GET(request, { params });
  expect(response.status).toBe(401);
});

// Test forwarding
test('forwards token to backend', async () => {
  jest.spyOn(auth, 'getBackendToken').mockResolvedValue('test-token');
  await POST(request, { params });
  expect(fetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer test-token',
      }),
    })
  );
});
```

### E2E Tests

```typescript
// Test from client component
test('client component can fetch via proxy', async () => {
  await page.goto('/login');
  // Login
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Make API call from client
  const response = await page.evaluate(() => fetch('/api/tenant-admin/packages'));
  expect(response.status).toBe(200);
});
```

---

## Monitoring & Debugging

### Key Signals to Monitor

1. **401 errors from proxy**
   - Indicates session expired or auth issue
   - Check NextAuth session validity

2. **404 errors from proxy**
   - Indicates backend route doesn't exist
   - Verify route is defined in Express API

3. **500 errors from proxy**
   - Could be network, backend, or proxy error
   - Check logs for context

### Debug Steps

1. Verify session active: Check `/api/auth/session`
2. Verify token retrievable: Add logging in proxy
3. Verify backend route exists: curl backend directly
4. Verify network connectivity: Check browser Network tab
5. Check error logs: Look for detailed error message

---

## Future Enhancements

### Possible Improvements

1. **Caching layer** - Cache GET requests for frequently-accessed data
2. **Rate limiting** - Limit requests per user per minute
3. **Request validation** - Validate body shape before forwarding
4. **Response transformation** - Normalize backend responses
5. **Retry logic** - Automatic retry on transient failures
6. **Timeout handling** - Graceful degradation on slow backend

### Non-Goals (Keep Simple)

- Authentication logic in proxy (leave in backend)
- Validation rules in proxy (leave in backend)
- Business logic in proxy (leave in backend)
- Caching policy in proxy (use standard HTTP caching)

---

## Migration Path (If Changing Pattern)

If we ever need to change this pattern:

1. **New proxy routes use new pattern**
2. **Keep existing routes unchanged** (don't refactor)
3. **Document decision in new ADR** (explain why pattern changed)
4. **Old routes can be gradually migrated** (if needed)

This maintains stability while allowing evolution.

---

## Related Decisions

- **ADR-008:** NextAuth.js v5 configuration and session strategy
- **ADR-014:** Next.js App Router migration patterns
- **CLAUDE.md:** Multi-tenant isolation requirements

---

## Decision Record

**Decision:** Implement API proxy pattern for Next.js client component authentication

**Rationale:**

- Matches industry best practices (Next.js docs recommend this)
- Secure (token stays server-side)
- Simple (minimal forwarding logic)
- Testable (clear request/response flow)
- Extensible (can add caching/monitoring later)

**Approved by:** Architecture team
**Effective date:** 2025-12-28
**Review date:** 2026-06-28 (6 months)

---

## Prevention Strategies

To prevent anti-patterns from this ADR:

1. **Code review checklist**
   - See `docs/solutions/API_PROXY_CODE_REVIEW_CHECKLIST.md`
   - Use during PR review for auth changes

2. **Quick reference guide**
   - See `docs/solutions/API_PROXY_QUICK_REFERENCE.md`
   - Print and post for daily reference

3. **Comprehensive guide**
   - See `docs/solutions/API_PROXY_PATTERN_PREVENTION.md`
   - Reference when implementing new proxies

4. **Common issues**
   - 401 from proxy → Token missing/invalid
   - CORS errors → Direct backend call (use proxy)
   - Empty body → Not forwarded (use `await request.text()`)

---

## Questions & Answers

**Q: Why not use Server Components exclusively?**
A: They can't respond to client-side state/interactions. Some UX requires client-side data fetching.

**Q: Why not store token in localStorage?**
A: NextAuth stores in HTTP-only cookie specifically to prevent XSS. Storing in localStorage defeats this.

**Q: Can I call proxy from Server Component?**
A: You could, but use `getBackendToken()` directly instead. Proxies are for client components.

**Q: Do I need a new proxy per endpoint?**
A: No, one proxy per feature handles all endpoints. `/api/tenant-admin/[...path]` handles `packages`, `bookings`, etc.

**Q: What if backend returns non-JSON?**
A: Proxy handles it. Check try/catch for `JSON.parse()`. Falls back to returning raw response.

**Q: How do I test if token is being forwarded?**
A: Add logging in proxy, use Network tab to see Authorization header, or mock `getBackendToken()` in tests.

---

## References

- Next.js: API Routes documentation
- NextAuth.js: Security best practices
- OWASP: Token storage recommendations
- Express: Middleware pattern documentation
