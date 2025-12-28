# API Proxy Code Review Checklist

Use this checklist when reviewing Pull Requests that add or modify API proxy routes.

---

## Pre-Review Questions

**Does this PR involve:**

- [ ] New or modified `/api/*/[...path]/route.ts` file?
- [ ] Client components calling backend APIs?
- [ ] Changes to `getBackendToken()` or auth handling?
- [ ] New HTTP endpoints requiring authentication?

If **ANY** checkbox is true, use the full checklist below.

---

## Tier 1: Security (BLOCKING ISSUES)

### Token Security

- [ ] **Token Retrieved Correctly**

  ```typescript
  const token = await getBackendToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```

  - Is `getBackendToken()` called before backend request?
  - Is token checked for null/falsy value?
  - Is 401 returned if token missing?

- [ ] **Token Not Exposed**
  - [ ] Token not logged (except hash/start for debugging)
  - [ ] Token not returned to client
  - [ ] Token not hardcoded in code
  - [ ] Token not stored in browser storage

- [ ] **Authorization Header Correct**
  ```typescript
  const headers = { Authorization: `Bearer ${token}` };
  ```

  - Is format exactly `Bearer ${token}` (space required)?
  - Is header added to all backend requests?
  - Is header NOT added to non-authenticated calls?

### Client Component Security

- [ ] **No Direct Backend Calls**
  - Client components call `/api/{feature}/path`, NOT `http://localhost:3001/...`
  - Client components don't use `getBackendToken()` (server-side only)
  - Client components don't read from localStorage for tokens

- [ ] **No Token in Error Messages**
  - Error logs don't include token value
  - Error responses to client don't reveal token
  - Debug messages don't expose authentication details

---

## Tier 2: Correctness (FUNCTIONAL ISSUES)

### HTTP Method Handling

- [ ] **All Methods Exported**

  ```typescript
  export async function GET(...) { ... }
  export async function POST(...) { ... }
  export async function PUT(...) { ... }
  export async function PATCH(...) { ... }
  export async function DELETE(...) { ... }
  ```

  - Does route export GET, POST, PUT, PATCH, DELETE?
  - Does each use same `handleRequest()` function?
  - Are methods the same as backend expects?

- [ ] **Method Preserved**
  ```typescript
  const response = await fetch(backendUrl, { method: request.method });
  ```

  - Is original request method forwarded?
  - Is method NOT hardcoded?

### Request Body Handling

- [ ] **Body Copied for Mutations**

  ```typescript
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await request.text();
  }
  const response = await fetch(backendUrl, { method, headers, body });
  ```

  - Is body read with `await request.text()`?
  - Is body only read for POST/PUT/PATCH/DELETE?
  - Is body passed to backend fetch?
  - Is body NOT parsed (keep as raw string)?

- [ ] **Content-Type Preserved**
  ```typescript
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  ```

  - Is Content-Type header extracted from request?
  - Is it added to proxy headers?
  - Is it NOT hardcoded to `application/json`?
  - (Multipart/form-data needs original header)

### Query String Handling

- [ ] **Query String Forwarded**
  ```typescript
  const url = new URL(request.url);
  const queryString = url.search;
  const backendUrl = `${API_BASE_URL}/v1/...${queryString}`;
  ```

  - Is `url.search` extracted?
  - Is it appended to backend URL?
  - Are query parameters preserved?

### Response Handling

- [ ] **Response Parsed Correctly**

  ```typescript
  const responseText = await response.text();
  let responseData: unknown;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    return new NextResponse(responseText, {
      /* headers */
    });
  }
  return NextResponse.json(responseData, { status: response.status });
  ```

  - Is response read with `response.text()`?
  - Is JSON parsing wrapped in try/catch?
  - Are non-JSON responses returned as-is?
  - Is HTTP status code preserved?

- [ ] **Response Headers**
  - Is `Content-Type` header preserved for non-JSON?
  - Are security headers NOT modified?
  - Are CORS headers handled correctly?

---

## Tier 3: Next.js Patterns (STRUCTURAL ISSUES)

### Route Structure

- [ ] **Correct File Path**
  - File is `apps/web/src/app/api/{feature}/[...path]/route.ts`
  - Directory structure matches backend feature
  - Catch-all route uses `[...path]` for dynamic segments

- [ ] **Async Handler**

  ```typescript
  async function handleRequest(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
  ) {
    const { path } = await params; // Awaited!
  }
  ```

  - Is handler function `async`?
  - Is `params` a Promise?
  - Is params awaited before use?
  - Are string arrays joined correctly?

- [ ] **No Duplicate Routes**
  - Only one proxy for `/api/{feature}/*`
  - No conflicting route patterns
  - Route doesn't shadow other endpoints

### Backend URL Construction

- [ ] **Correct URL Format**

  ```typescript
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const backendUrl = `${API_BASE_URL}/v1/{feature}/${pathString}${queryString}`;
  ```

  - Uses `process.env.NEXT_PUBLIC_API_URL`
  - Has fallback to `http://localhost:3001`
  - Constructs URL with `/v1/{feature}/` prefix
  - Appends original path string
  - Appends query string

- [ ] **No Hardcoded URLs**
  - No `http://localhost:3001` hardcoded
  - No feature names hardcoded
  - Uses environment variables

---

## Tier 4: Error Handling (DEBUGGING ISSUES)

### Error Cases

- [ ] **Token Missing**

  ```typescript
  const token = await getBackendToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```

  - Returns 401 with clear message
  - Doesn't return 500 for auth failures

- [ ] **Backend Errors Forwarded**
  - 4xx errors returned as-is
  - 5xx errors returned as-is
  - Status code preserved

- [ ] **Proxy Errors Caught**
  ```typescript
  try {
    // Fetch logic
  } catch (error) {
    logger.error('API proxy error', { error, method, url });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  ```

  - Try/catch wraps entire handler
  - Errors logged with context
  - 500 error returned to client
  - Error message safe (not token exposure)

### Logging

- [ ] **Debug Logging Safe**
  ```typescript
  logger.error('API proxy error', {
    error,
    method: request.method,
    url: request.url,
    // NOT: token, body, responseData
  });
  ```

  - Logs include method and URL (for debugging)
  - Logs do NOT include token
  - Logs do NOT include request/response body
  - Uses `logger.error()` not `console.log()`

---

## Tier 5: Code Quality (STYLE ISSUES)

### Code Organization

- [ ] **Single Responsibility**
  - Proxy only proxies (no business logic)
  - No validation logic in proxy
  - No data transformation in proxy
  - All logic should be in backend

- [ ] **DRY Principle**
  - Single `handleRequest()` function
  - All HTTP methods call `handleRequest()`
  - No duplicated code
  - No copy-paste between proxies

- [ ] **Comments/Documentation**
  ```typescript
  /**
   * Feature API Proxy Route
   *
   * Proxies /api/{feature}/* requests to backend API with authentication.
   * Example: /api/{feature}/resource → /v1/{feature}/resource
   */
  ```

  - Has header comment explaining purpose
  - Example shows client → proxy → backend flow
  - Comments explain non-obvious code

### TypeScript

- [ ] **Proper Types**

  ```typescript
  async function handleRequest(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
  ): Promise<NextResponse>;
  ```

  - `NextRequest` used (not `Request`)
  - `NextResponse` used (not `Response`)
  - Return type `Promise<NextResponse>`
  - `params` typed as `Promise<{ path: string[] }>`

- [ ] **No `any` Types**
  - `headers: HeadersInit` not `headers: any`
  - `responseData: unknown` not `responseData: any`
  - No type bypasses without justification

---

## Tier 6: Testing (VERIFICATION ISSUES)

### Test Coverage

- [ ] **Happy Path Tested**
  - Successful request returns data
  - Status code preserved
  - Response body correct

- [ ] **Auth Failure Tested**
  - Returns 401 when no token
  - Returns 401 with clear message
  - No 500 for auth failures

- [ ] **Error Cases Tested**
  - Backend 404 returns 404
  - Backend 500 returns 500
  - Network errors handled gracefully

- [ ] **Body Handling Tested**
  - GET requests have no body
  - POST requests forward body
  - Content-Type preserved
  - Multipart/form-data works

### Manual Testing Checklist

- [ ] Tested after login (token available)

  ```bash
  curl http://localhost:3000/api/tenant-admin/packages
  ```

- [ ] Tested without login (401 response)

  ```bash
  curl http://localhost:3000/api/tenant-admin/packages
  # Should return 401 Unauthorized
  ```

- [ ] Tested with invalid token (401 response)
  - Clear, helpful error message

- [ ] Tested with mutation (POST/PUT)
  - Body forwarded correctly
  - Backend receives data
  - Response includes created/updated resource

- [ ] Tested with delete (DELETE)
  - Correct status code returned
  - Backend record deleted

---

## Common Issues Checklist

Use this to find common problems quickly:

### Missing Tier 1 Issues (Security)

- [ ] Proxy doesn't call `getBackendToken()`
  - **Fix:** Add token retrieval and check

- [ ] Token exposed in logs/errors
  - **Fix:** Remove token from logged data

- [ ] Client component calls backend directly
  - **Fix:** Create/use proxy route

- [ ] Token stored in localStorage by client
  - **Fix:** Use proxy, token stays server-side

### Missing Tier 2 Issues (Correctness)

- [ ] Body not forwarded for POST/PUT
  - **Fix:** Add `body = await request.text()`

- [ ] Content-Type not preserved
  - **Fix:** Extract and add to headers

- [ ] Query strings lost
  - **Fix:** Add `${queryString}` to backend URL

- [ ] Only exports GET (not POST/PUT/DELETE)
  - **Fix:** Export all HTTP methods

### Missing Tier 3 Issues (Structure)

- [ ] File path wrong
  - **Fix:** Use `app/api/{feature}/[...path]/route.ts`

- [ ] Params not awaited
  - **Fix:** Add `await params` before use

- [ ] Hardcoded backend URL
  - **Fix:** Use `process.env.NEXT_PUBLIC_API_URL`

### Missing Tier 4 Issues (Error Handling)

- [ ] Returns 500 for auth failures
  - **Fix:** Return 401 specifically for missing token

- [ ] No error logging
  - **Fix:** Add try/catch with logger.error()

- [ ] Error messages expose internal details
  - **Fix:** Log technical details, return safe message

### Missing Tier 5 Issues (Quality)

- [ ] Proxy has validation/business logic
  - **Fix:** Move to backend, keep proxy thin

- [ ] Multiple `handleRequest()` copies
  - **Fix:** Consolidate to single function

- [ ] No documentation
  - **Fix:** Add header comment with example

### Missing Tier 6 Issues (Testing)

- [ ] No tests for proxy
  - **Fix:** Add unit tests for token retrieval, forwarding

- [ ] Not tested after login
  - **Fix:** Test with valid session

- [ ] Not tested with invalid token
  - **Fix:** Test returns 401 correctly

---

## Review Template

Use this template when commenting on a PR:

### Security Issue

````
[BLOCKING] Security: Token exposed in logs

The error handler logs the entire response:
```typescript
logger.error('Proxy error', { error, responseData }); // exposes token!
````

Should be:

```typescript
logger.error('Proxy error', { error, method, url });
```

Reason: Prevents token leakage in logs.

```

### Correctness Issue

```

[BLOCKING] Correctness: Request body not forwarded

POST requests lose their body:

```typescript
const response = await fetch(backendUrl, { method: 'POST', headers });
// body is undefined!
```

Should be:

```typescript
const body = await request.text();
const response = await fetch(backendUrl, { method: 'POST', headers, body });
```

Reason: Backend won't receive POST data without body.

```

### Structural Issue

```

[MAJOR] Structure: Missing HTTP methods

Exports only GET and POST:

```typescript
export async function GET(...) { ... }
export async function POST(...) { ... }
// Missing PUT, PATCH, DELETE
```

Should export:

```typescript
export async function GET(...) { ... }
export async function POST(...) { ... }
export async function PUT(...) { ... }
export async function PATCH(...) { ... }
export async function DELETE(...) { ... }
```

Reason: Client components need to call PUT/PATCH/DELETE.

```

### Error Handling Issue

```

[MAJOR] Error Handling: Auth failures return 500

Missing token returns 500:

```typescript
const token = await getBackendToken();
// No check - proceeds to fetch with undefined token
const response = await fetch(backendUrl, { headers: { Authorization: `Bearer ${undefined}` } });
```

Should check:

```typescript
const token = await getBackendToken();
if (!token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Reason: Differentiates auth failures (401) from server errors (500).

```

### Code Quality Issue

```

[MINOR] Quality: Duplicated token check

Same token retrieval code appears in multiple proxies.

Consider: Extract to shared function or document the pattern in CLAUDE.md.

```

---

## Approval Criteria

**Approve if:**
- [ ] All Tier 1 (Security) issues resolved
- [ ] All Tier 2 (Correctness) issues resolved
- [ ] Tier 3 (Structure) follows pattern
- [ ] Tier 4 (Error Handling) handles auth/errors
- [ ] Tests added for new/changed proxy

**Request Changes if:**
- [ ] Any Tier 1 or Tier 2 issues present
- [ ] Token exposed anywhere
- [ ] Body/headers not forwarded
- [ ] HTTP methods missing
- [ ] Auth failures not handled (401 vs 500)

**Comment for Future if:**
- [ ] Code could be refactored (no change needed)
- [ ] Documentation could be improved
- [ ] Test coverage could be expanded

---

## Quick Links

- **Full Guide:** `docs/solutions/API_PROXY_PATTERN_PREVENTION.md`
- **Quick Reference:** `docs/solutions/API_PROXY_QUICK_REFERENCE.md`
- **Existing Examples:**
  - `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
  - `apps/web/src/app/api/agent/[...path]/route.ts`
- **Auth Helper:** `apps/web/src/lib/auth.ts` (`getBackendToken()`)
```
