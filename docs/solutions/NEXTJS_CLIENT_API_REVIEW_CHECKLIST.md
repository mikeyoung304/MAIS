# Next.js Client API Proxy - Code Review Checklist

Use this checklist when reviewing PRs that contain React/Next.js API calls.

---

## Quick Scan (2 minutes)

Search for these patterns in the PR diff:

### Search 1: Direct Backend URL

```bash
# Search for direct API calls
grep -r "NEXT_PUBLIC_API_URL" --include="*.tsx" --include="*.ts"
grep -r "localhost:3001" --include="*.tsx" --include="*.ts"
```

**Red Flags:**

- `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/v1/...\`)`
- `fetch('http://localhost:3001/...')`
- String templates with backend URL in client code

**Expected:** Client components should use `/api/*` paths only

---

### Search 2: Token Access

```bash
grep -r "backendToken" --include="*.tsx" --include="*.ts"
grep -r "localStorage.getItem.*token" --include="*.tsx" --include="*.ts"
grep -r "sessionStorage.getItem.*token" --include="*.tsx" --include="*.ts"
grep -r "document.cookie" --include="*.tsx" --include="*.ts"
```

**Red Flags:**

- `localStorage.getItem('backendToken')`
- `sessionStorage.getItem('adminToken')`
- Trying to read cookies from client
- `document.cookie.split('...')`

**Expected:** No token access in client code (proxy handles it)

---

### Search 3: Manual Authorization Headers in Client

```bash
grep -r "Authorization.*Bearer" --include="*.tsx" --include="*.ts"
# Look for patterns like:
# headers: { Authorization: `Bearer ${token}` }
# in files marked with 'use client'
```

**Red Flags:**

```typescript
'use client';
const headers = {
  Authorization: `Bearer ${token}`, // Where is token from?
};
```

**Expected:** Client components never add Authorization headers

---

### Search 4: Missing 401 Handling

```bash
# Look for fetch() without response.ok/status check
grep -B2 "response.json()" --include="*.tsx" --include="*.ts" | grep -v "response.ok\|response.status\|response.json()"
```

**Red Flags:**

```typescript
const response = await fetch('/api/...');
const data = await response.json(); // No check if 401!
setData(data); // Crash if data is { error: 'Unauthorized' }
```

**Expected:** All API calls check `response.ok` or `response.status === 401`

---

## Full Checklist

Use this when reviewing files that make API calls.

### Phase 1: Identify Component Type

- [ ] File has `'use client'` directive (Client Component)
- [ ] File is a route handler: `/app/*/page.tsx`, `/app/*/layout.tsx`, etc. (Server Component)
- [ ] File imports from `/app/api/` (API Route Handler)

**If you can't identify the type:** Ask the author to clarify

---

### Phase 2: Check API Call Pattern

#### For Client Components (`'use client'`)

- [ ] No `NEXT_PUBLIC_API_URL` in fetch URLs
- [ ] All API calls use `/api/*` paths only
  - [ ] `/api/tenant-admin/*` for admin APIs
  - [ ] `/api/agent/*` for agent APIs
- [ ] No `Authorization` headers added manually
- [ ] No token access (`localStorage`, `sessionStorage`, `document.cookie`)

**Example of CORRECT client component:**

```typescript
'use client';
const response = await fetch('/api/tenant-admin/packages');
if (response.status === 401) return <LoginPrompt />;
if (!response.ok) throw new Error('Failed');
const data = await response.json();
```

#### For Server Components (no `'use client'`)

- [ ] Uses `createServerApiClient()` for API calls
- [ ] Does NOT use fetch with `NEXT_PUBLIC_API_URL`
- [ ] No manual Authorization headers
- [ ] Checks response.ok before using data

**Example of CORRECT server component:**

```typescript
// No 'use client'
const api = await createServerApiClient();
const response = await api.getPackages();
if (!response.ok) return <Error />;
const data = response.body;
```

#### For API Route Handlers (`/app/api/*`)

- [ ] Uses `getBackendToken()` to get authenticated request
- [ ] Adds token to backend request headers
- [ ] Returns consistent error responses
- [ ] Handles 401 gracefully

**Example of CORRECT API route:**

```typescript
// /app/api/tenant-admin/[...path]/route.ts
const token = await getBackendToken();
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const headers = { Authorization: `Bearer ${token}` };
const backendResponse = await fetch(backendUrl, { headers });
```

---

### Phase 3: Check Error Handling

- [ ] All fetch calls check response status
- [ ] 401 responses are handled separately (user not authenticated)
- [ ] Other error status codes are handled
- [ ] Error messages are user-friendly (not showing technical details)

**Patterns to look for:**

```typescript
// ✅ CORRECT: Check before parsing
const response = await fetch('/api/...');
if (response.status === 401) {
  // Show login
}
if (!response.ok) {
  // Show generic error
}
const data = await response.json();
```

```typescript
// ❌ WRONG: No checks
const response = await fetch('/api/...');
const data = await response.json();
setData(data); // Crash if 401
```

---

### Phase 4: Check for CORS Issues

- [ ] Client components don't call `localhost:3001` directly
- [ ] No `credentials: 'include'` to Express API
- [ ] Cross-origin requests go through proxy

**Red Flag Pattern:**

```typescript
// ❌ WRONG: CORS will block this
const response = await fetch('http://localhost:3001/v1/...', {
  credentials: 'include',
});
```

**Correct Pattern:**

```typescript
// ✅ CORRECT: Same origin
const response = await fetch('/api/agent/...'); // localhost:3000
```

---

### Phase 5: React Query / TanStack Query

If using React Query, check:

- [ ] `queryFn` uses proxy URLs (`/api/*`)
- [ ] `queryFn` handles 401 by throwing error
- [ ] Error state is displayed in component
- [ ] Loading state prevents fetch race conditions

**Example:**

```typescript
useQuery({
  queryKey: ['packages'],
  queryFn: async () => {
    const response = await fetch('/api/tenant-admin/packages');

    if (response.status === 401) {
      throw new Error('Not authenticated');
    }

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    return response.json();
  },
});
```

---

### Phase 6: Check Proxy Route Usage

- [ ] Correct proxy route used for API path
  - [ ] `/api/tenant-admin/*` → Express `/v1/tenant-admin`
  - [ ] `/api/agent/*` → Express `/v1/agent`
- [ ] No typos in URL path
- [ ] Path matches a defined proxy route

**Quick Reference:**
| Client calls | Uses proxy | Calls Express |
|---|---|---|
| `/api/tenant-admin/packages` | ✅ `/api/tenant-admin/[...path]` | ✅ `/v1/tenant-admin/packages` |
| `/api/agent/chat` | ✅ `/api/agent/[...path]` | ✅ `/v1/agent/chat` |
| `/api/foobar/xyz` | ❌ No proxy | ❌ Direct to Express |

---

## Red Flags During Review

### Red Flag 1: Multiple API URLs

```typescript
// ❌ WRONG: Mixing proxy and direct calls
const response1 = await fetch('/api/packages'); // Good
const response2 = await fetch('http://localhost:3001/v1/chat'); // Bad
```

**Action:** Ask author to use proxy for both

---

### Red Flag 2: Token Attempt

```typescript
// ❌ WRONG
'use client';
import { getBackendToken } from '@/lib/auth'; // Server-only function
const token = await getBackendToken(); // Can't await in client
```

**Action:** Replace with proxy call

---

### Red Flag 3: Duplicate Error Messages

```typescript
// ❌ WRONG: Same error handling in 3 components
if (!response.ok) {
  setError('Something went wrong');
}

if (!response.ok) {
  setError('Something went wrong');
}

if (!response.ok) {
  setError('Something went wrong');
}
```

**Action:** Extract to custom hook

```typescript
// ✅ CORRECT
function useApiCall(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetch = async () => {
    const response = await fetch(url);
    if (response.status === 401) {
      setError('Please sign in');
      return;
    }
    if (!response.ok) {
      setError('Something went wrong');
      return;
    }
    setData(await response.json());
  };

  return { data, error, fetch };
}
```

---

### Red Flag 4: Missing 401 Check

```typescript
// ❌ WRONG: No 401 handling
const response = await fetch('/api/agent/health');
const health = await response.json();

if (!health.available) {
  // When 401, health is { error: 'Unauthorized' }, not { available: true }
  // This logic is broken
}
```

**Action:** Add 401 check

```typescript
// ✅ CORRECT
const response = await fetch('/api/agent/health');

if (response.status === 401) {
  setError('Session expired');
  return;
}

const health = await response.json();
if (!health.available) {
  // Now this makes sense
}
```

---

### Red Flag 5: localStorage Dependency

```typescript
// ❌ WRONG
const token = localStorage.getItem('tenantToken');
const response = await fetch(`/api/packages`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Action:** Remove token logic, use proxy

```typescript
// ✅ CORRECT
const response = await fetch('/api/tenant-admin/packages');
// Proxy adds token automatically
```

---

## Review Comments to Use

### If direct API call found:

```
Please use the Next.js API proxy for this call.

Currently: fetch('http://localhost:3001/v1/...')
Should be: fetch('/api/tenant-admin/...')

The proxy handles authentication and avoids CORS issues.

See: docs/solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md
```

---

### If token access attempt:

```
Backend tokens are HTTP-only cookies and can't be accessed from client code.
Please use the API proxy instead, which has the token available.

Remove this: localStorage.getItem('backendToken')
Use instead: fetch('/api/tenant-admin/...')

The proxy will add the token automatically.
```

---

### If missing 401 check:

```
Please add error handling for unauthenticated requests (401):

const response = await fetch('/api/...');
if (response.status === 401) {
  // Show login prompt or redirect
  return;
}
if (!response.ok) {
  // Handle other errors
  return;
}
```

---

### If CORS issue:

```
Cross-origin request detected. This will fail due to CORS.

Currently: fetch('http://localhost:3001/...')
Should be: fetch('/api/tenant-admin/...')

The API proxy is on the same origin (localhost:3000) as the client.
```

---

## Approval Criteria

Approve the PR if ALL of these are true:

- [ ] All client components use `/api/*` proxy URLs
- [ ] No manual Authorization headers in client code
- [ ] No token access attempts (`localStorage`, `sessionStorage`)
- [ ] All API calls check `response.ok` or `response.status`
- [ ] 401 responses handled separately from other errors
- [ ] No CORS errors in browser console
- [ ] Server components use `createServerApiClient()`
- [ ] Error messages are user-friendly
- [ ] No duplicate error handling logic

---

## Testing Checklist

Before merging, test these scenarios:

### Test 1: Happy Path (Authenticated User)

```bash
1. Log in as valid user
2. Perform action that calls API via proxy
3. Verify: Data loads correctly
4. Verify: No 401 error shown
```

### Test 2: Unauthenticated User

```bash
1. Sign out (clear session)
2. Try to perform action that needs auth
3. Verify: 401 error handled gracefully
4. Verify: Redirects to login or shows login prompt
5. Verify: NOT a broken/crashed component
```

### Test 3: Session Expired

```bash
1. Log in
2. Wait for session to expire (or manually clear cookie)
3. Try API call
4. Verify: 401 handled gracefully
```

### Test 4: Network Error

```bash
1. Disconnect network (DevTools → Offline)
2. Try API call
3. Verify: Shows error message (not component crash)
4. Verify: Can retry after connection restored
```

---

## Common Review Mistakes (Don't Make These)

### Mistake 1: Approving Direct API Calls

```typescript
// ❌ DON'T approve this
'use client';
fetch('http://localhost:3001/v1/packages');
```

This will fail in production and causes CORS issues.

---

### Mistake 2: Approving Missing Error Handling

```typescript
// ❌ DON'T approve this
const response = await fetch('/api/...');
const data = await response.json(); // No check!
```

This crashes when user is logged out.

---

### Mistake 3: Approving Token in localStorage

```typescript
// ❌ DON'T approve this
const token = localStorage.getItem('backendToken');
fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

Backend token is intentionally NOT in localStorage.

---

## Questions to Ask Author

If you're unsure:

1. **"Why is this component making API calls?"**
   - Should it be a Server Component instead?
   - Should it use React Query?

2. **"What happens when the user is logged out?"**
   - Have you tested the 401 case?
   - Is the error message clear?

3. **"Why use direct API URL instead of proxy?"**
   - If they say "performance," discuss caching strategies
   - If they say "CORS," tell them about proxy

4. **"Where does the token come from?"**
   - If they say "localStorage" or "cookie," it's wrong
   - Proxy provides it automatically

---

## Resources

- **Detailed Guide:** `docs/solutions/NEXTJS_CLIENT_API_PROXY_PREVENTION.md`
- **Quick Reference:** `docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md`
- **Next.js Docs:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **NextAuth.js Docs:** https://authjs.dev/concepts/custom-pages

---

## Summary

**Client Components:**

- ✅ Use `/api/*` proxy
- ✅ Check response.ok and 401 separately
- ✅ Show clear error messages
- ❌ No direct Express URLs
- ❌ No manual tokens
- ❌ No Authorization headers

**Server Components:**

- ✅ Use `createServerApiClient()`
- ✅ Check response.ok
- ✅ Handle errors
- ❌ No `/api/*` proxy
- ❌ No manual token handling

That's it. That's the pattern.
