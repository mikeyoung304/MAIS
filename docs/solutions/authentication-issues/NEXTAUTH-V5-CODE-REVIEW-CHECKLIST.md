# NextAuth v5 Authentication Code Review Checklist

**Use this checklist when reviewing any code that uses `getBackendToken()`, `getToken()`, or NextAuth JWT features.**

---

## Context

NextAuth v5 has tricky behavior with cookie naming on HTTPS. Missing this causes silent production failures where tokens are present but code can't find them. This checklist catches those issues before they ship.

---

## Cookie Name Verification

### ☐ Cookie Names Include HTTPS Variant

**What to look for**:

```typescript
// In getBackendToken() or similar token lookup code
const possibleCookieNames = [
  '__Secure-authjs.session-token', // ← Should be FIRST
  'authjs.session-token', // ← Fallback to HTTP
  '__Secure-next-auth.session-token', // ← Legacy
  'next-auth.session-token', // ← Legacy HTTP
];
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Missing __Secure- variant
const cookieName = 'authjs.session-token';

// ❌ WRONG: Only checks non-prefixed name
const possibleNames = ['authjs.session-token', 'next-auth.session-token'];
```

**Question**: Which cookie name is checked first?

- **Answer**: `__Secure-authjs.session-token` (HTTPS/production)
- **Why**: Production HTTPS is more common than local HTTP

**Question**: Is there a fallback to HTTP variant?

- **Answer**: Yes, `authjs.session-token` should be checked second
- **Why**: Local development still needs to work

---

### ☐ Cookie Lookup Handles Missing Cookies Gracefully

**What to look for**:

```typescript
// Code finds the right cookie name
const cookieName = possibleCookieNames.find((name) => cookieStore.get(name)?.value !== undefined);

if (!cookieName) {
  logger.debug('No session cookie found', {
    availableCookies: allCookieNames, // For debugging
  });
  return null; // Not an error, just not authenticated
}
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Assumes cookie always exists
const token = await getToken({
  req,
  cookieName: 'authjs.session-token',
});

// ❌ WRONG: Throws error instead of returning null
if (!cookieName) {
  throw new Error('Authentication failed'); // Too harsh
}
```

**Question**: What happens if cookie isn't found?

- **Answer**: Logs debug message, returns null (not error)
- **Why**: Missing token is normal when not authenticated

---

## Request Object Handling

### ☐ API Routes Pass Actual Request Parameter

**What to look for**:

```typescript
// In API route handler
export async function GET(request: Request) {
  const token = await getBackendToken(request); // ← Passes request
  if (!token) return new Response('Unauthorized', { status: 401 });
  // ...
}

export async function POST(request: Request) {
  const token = await getBackendToken(request); // ← Passes request
  // ...
}
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Constructing mock request in API route
export async function GET() {
  const mockReq = { cookies: {}, headers: {} };
  const token = await getToken({ req: mockReq, ... });  // Silently fails
}

// ❌ WRONG: Calling without request in API route
export async function GET(request: Request) {
  const token = await getBackendToken();  // Wrong - request is available!
}
```

**Question**: Is the request parameter passed to `getBackendToken()`?

- **Answer**: YES, in all API routes (route.ts)
- **Why**: Real Request objects have proper cookie parsing; mocks don't

**Question**: Are any mock request objects created in API routes?

- **Answer**: NO, use the actual request parameter
- **Why**: Mock objects cause `getToken()` to fail silently

---

### ☐ Server Components Use Proper next/headers Objects

**What to look for**:

```typescript
// In Server Component (no 'use client' directive)
export default async function AdminPage() {
  const token = await getBackendToken();  // ← No params needed
  if (!token) return <AccessDenied />;
  // ...
}

// Inside getBackendToken() for Server Components:
const { cookies, headers } = await import('next/headers');
const nextCookieStore = await cookies();

const req = {
  cookies: nextCookieStore,  // ← Use actual CookieStore
  headers: headerStore,      // ← Use actual Headers
} as Parameters<typeof getToken>[0]['req'];
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Converting CookieStore to plain object
const req = {
  cookies: Object.fromEntries(nextCookieStore.getAll().map((c) => [c.name, c.value])), // Plain object, not CookieStore - doesn't work!
  headers: headerStore,
};

// ❌ WRONG: Calling with request in Server Component
export default async function Page() {
  const token = await getBackendToken(request); // request doesn't exist here!
}
```

**Question**: In Server Components, are `cookies()` and `headers()` passed directly?

- **Answer**: YES, as actual objects from `next/headers`
- **Why**: `getToken()` expects proper CookieStore/Headers objects, not plain objects

---

## Token Usage Patterns

### ☐ Null Tokens Are Handled Properly

**What to look for**:

```typescript
// Check token before using
const token = await getBackendToken(request);

if (!token) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Safe to use token now
const response = await fetch('http://localhost:3001/v1/protected-endpoint', {
  headers: { Authorization: `Bearer ${token}` },
});
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Using token without checking
const token = await getBackendToken();
const response = await fetch(apiUrl, {
  headers: { Authorization: `Bearer ${token}` }, // Crashes if null
});

// ❌ WRONG: Assuming token is always present
const response = await api.call(token!); // Non-null assertion without check
```

**Question**: Is every `getBackendToken()` call followed by a null check?

- **Answer**: YES, before using the token
- **Why**: `getBackendToken()` returns null when not authenticated

---

### ☐ Backend Token Not Exposed to Client

**What to look for**:

```typescript
// ✓ Token stays server-side only
export async function getBackendToken(request?: Request): Promise<string | null> {
  // ... extract token ...
  return (token as MAISJWT).backendToken || null;
}

// ✓ Token used only in Server Components / API routes
async function getDataFromBackend(request: Request) {
  const token = await getBackendToken(request);
  // Send token to backend, don't send to client
}

// ✓ Session excludes backend token
interface MAISSession extends Session {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
    // ← NO backendToken field here
  };
}
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Backend token in session/client
interface MAISSession {
  user: {
    id: string;
    backendToken: string; // ← Exposed to client! Leak!
  };
}

// ❌ WRONG: Token sent to browser
export async function GET() {
  const token = await getBackendToken();
  return Response.json({ token }); // Client gets the token!
}

// ❌ WRONG: Token in useSession()
('use client');
const { data: session } = useSession();
const token = session.user.backendToken; // Doesn't exist, but shouldn't try
```

**Question**: Is the backend token ever included in session data sent to client?

- **Answer**: NO, token stays server-side only
- **Why**: Backend tokens should never be exposed to browser JavaScript

---

## Testing & Validation

### ☐ Token Lookup Tested on HTTPS

**What to look for**:

```typescript
// Test explicitly covers HTTPS environment
test('getBackendToken returns token on HTTPS', async () => {
  // Simulates production environment
  const request = new Request('https://example.com/api/test', {
    headers: {
      Cookie: '__Secure-authjs.session-token=valid-jwt',
    },
  });
  const token = await getBackendToken(request);
  expect(token).toBeTruthy();
});
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Only tested on HTTP
test('getBackendToken returns token', async () => {
  // Doesn't test HTTPS at all
  const token = await getBackendToken();
  expect(token).toBeTruthy();
});

// ❌ WRONG: No token lookup tests
// (Tests only exist for session creation, not token retrieval)
```

**Question**: Are there tests for HTTPS environment?

- **Answer**: YES, explicitly using `__Secure-` cookie name
- **Why**: Bug only manifests on HTTPS; HTTP tests won't catch it

**Question**: Are both HTTP and HTTPS tested?

- **Answer**: YES, to ensure both local dev and production work
- **Why**: Cookie name changes between protocols

---

### ☐ Staging/Production Pre-Deployment Checklist Present

**What to look for**:

```typescript
// Code/PR includes testing instructions
// Or documentation mentions:
// 1. Test on HTTPS staging environment
// 2. Verify token lookup succeeds in logs
// 3. Verify API routes can access token
// 4. Check browser cookies for __Secure- prefix
// 5. Monitor logs for "No session cookie found"
```

**What NOT to accept**:

```typescript
// ❌ WRONG: No mention of HTTPS testing
// ❌ WRONG: "Only tested locally"
// ❌ WRONG: Missing staging verification
```

**Question**: Does the PR mention testing on HTTPS?

- **Answer**: YES, with specific steps to verify
- **Why**: Cookie behavior differs on HTTP/HTTPS; must test both

---

## Security Considerations

### ☐ No Timing Attacks in Cookie Lookup

**What to look for**:

```typescript
// Safe cookie lookup (constant time is not critical here)
const cookieName = possibleCookieNames.find((name) => cookieStore.get(name)?.value !== undefined);

// Token validation is done by getToken() with proper JWT verification
const token = await getToken({
  req,
  secret: authSecret,
  cookieName,
});
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Custom JWT verification without using getToken()
// (allows timing attacks on JWT verification)
const cookieValue = cookieStore.get(cookieName)?.value;
if (cookieValue === expectedToken) {
  // ← Timing attack!
  return cookieValue;
}
```

**Question**: Is token validation delegated to `getToken()`?

- **Answer**: YES, `getToken()` handles JWT verification
- **Why**: Built-in verification is constant-time protected

---

### ☐ No CORS Leaks via Token

**What to look for**:

```typescript
// API routes verify request origin if needed
export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  // Only return token to same-origin requests

  const token = await getBackendToken(request);
  if (!token) return new Response('Unauthorized', { status: 401 });

  // Don't expose token in response
  return new Response(JSON.stringify({ data: '...' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**What NOT to accept**:

```typescript
// ❌ WRONG: Returning token to client
return Response.json({ token: backendToken });

// ❌ WRONG: Using token in Set-Cookie response header
response.headers.set('Set-Cookie', `token=${backendToken}; ...`);
```

**Question**: Is the backend token ever returned in API responses?

- **Answer**: NO, token is used server-side only
- **Why**: Client has no legitimate need for backend token

---

## Anti-Patterns to Reject

### Pattern 1: Hardcoded Cookie Names

```typescript
// ❌ REJECT THIS
const token = cookies.get('authjs.session-token')?.value;
```

**Why it's bad**: Only works on HTTP; fails silently on HTTPS

**How to fix**: Use `getBackendToken()` which handles all variants

---

### Pattern 2: Assuming Consistent Cookie Name Across Environments

```typescript
// ❌ REJECT THIS
process.env.NEXTAUTH_COOKIE_NAME = 'authjs.session-token'; // Doesn't change for HTTPS!
```

**Why it's bad**: Cookie name changes based on protocol, not config

**How to fix**: Check all possible names at runtime

---

### Pattern 3: Converting CookieStore to Plain Object

```typescript
// ❌ REJECT THIS
const req = {
  cookies: Object.fromEntries(
    nextCookieStore.getAll().map((c) => [c.name, c.value])
  ),
};
await getToken({ req, ... });
```

**Why it's bad**: `getToken()` expects proper CookieStore object; plain object fails

**How to fix**: Pass the actual CookieStore from `next/headers`

---

### Pattern 4: Not Checking for Cookie Before Calling getToken()

```typescript
// ❌ AVOID THIS (works but wasteful)
const token = await getToken({ req, secret, cookieName });
if (!token) return null;
```

**Why it's bad**: Calls `getToken()` even when cookie definitely doesn't exist

**How to fix**: Check if cookie exists first

```typescript
// ✓ BETTER
if (!cookieStore.get(cookieName)?.value) {
  return null;
}
const token = await getToken({ req, secret, cookieName });
```

---

### Pattern 5: Using getBackendToken() on Client Side

```typescript
// ❌ REJECT THIS
'use client';
import { getBackendToken } from '@/lib/auth';

export function MyComponent() {
  useEffect(() => {
    const token = await getBackendToken(); // Doesn't work on client!
  }, []);
}
```

**Why it's bad**: `getBackendToken()` is server-side only; can't run on client

**How to fix**: Use `useSession()` from `next-auth/react` on client

---

## Reviewer Sign-Off

### Required Checks

```
Before approving, verify:

☐ All API routes pass request to getBackendToken()
☐ Cookie names include __Secure- variant
☐ __Secure- variant is checked FIRST
☐ Fallback to non-prefixed name exists
☐ Null tokens are handled gracefully
☐ Backend token not exposed to client
☐ Tests include HTTPS environment
☐ HTTPS staging test mentioned
☐ No hardcoded cookie names
☐ No mock request construction in API routes
```

### Reviewer Comment Template

When changes are needed, use this template:

```
## Token Lookup Issues Found

The code needs updates to handle NextAuth v5 cookie naming:

### Issue 1: Missing __Secure- Cookie Name
- **Location**: Line XXX
- **Problem**: Only checks `authjs.session-token` (HTTP)
- **Fix**: Add `__Secure-authjs.session-token` to lookup, check it FIRST
- **Why**: Production HTTPS uses `__Secure-` prefix

### Issue 2: HTTPS Testing Not Mentioned
- **Problem**: No plan to test on HTTPS/staging
- **Fix**: Add testing steps to PR description
- **Why**: Bug only manifests on HTTPS

Please update and request re-review. See quick reference:
[NEXTAUTH-V5-QUICK-REFERENCE.md](./NEXTAUTH-V5-QUICK-REFERENCE.md)
```

---

## Reference Links

- **Full Prevention Guide**: `/docs/solutions/authentication-issues/nextauth-v5-getbackendtoken-cookie-prefix.md`
- **Quick Reference**: `/docs/solutions/authentication-issues/NEXTAUTH-V5-QUICK-REFERENCE.md`
- **NextAuth.js v5**: https://authjs.dev/
- **RFC 6265 (Cookies)**: https://tools.ietf.org/html/rfc6265
- **Set-Cookie Secure Flag**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie

---

**Last Updated**: 2025-12-31
**Severity**: CRITICAL
**Use This**: For all NextAuth token-related code reviews
