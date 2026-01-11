# NextAuth v5 getBackendToken() - Quick Reference

**Print This. Pin It. Reference When Debugging Token Issues.**

---

## The Core Issue in 30 Seconds

NextAuth v5 uses different cookie names depending on protocol:

```
HTTP (localhost)  → authjs.session-token
HTTPS (prod)      → __Secure-authjs.session-token   ← Easy to miss!
```

If your code only checks for `authjs.session-token`, **production will fail**.

---

## One-Liner Reminders

```
🔒 HTTPS = __Secure- prefix
```

```
📍 Check HTTPS name FIRST (most common in production)
```

```
🚀 API routes: Pass request.  Server Components: Use next/headers
```

```
🔍 getBackendToken() returns null silently (check logs!)
```

```
❌ Never construct mock request objects in API routes
```

---

## Decision Tree: Am I Using getBackendToken() Correctly?

```
START: You're using getBackendToken()
  │
  ├─ Are you in an API route? (route.ts)
  │  ├─ YES: Pass the request parameter
  │  │       ✓ await getBackendToken(request)
  │  │
  │  └─ NO: You're in a Server Component
  │       ✓ await getBackendToken()  (no params)
  │
  ├─ Did you test on HTTPS?
  │  ├─ NO: DO THIS NOW before shipping
  │  │     Check: Cookie name in DevTools
  │  │
  │  └─ YES: Check if you see __Secure- prefix
  │
  └─ Token is still null?
     ├─ Check logs for "No session cookie found"
     ├─ Verify cookie name in DevTools → Application
     └─ See DEBUGGING SECTION below
```

---

## Copy-Paste Patterns

### API Route (CORRECT)

```typescript
// apps/web/src/app/api/your-route/route.ts
export async function GET(request: Request) {
  const token = await getBackendToken(request); // ✓ Pass request

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use token for backend API calls
  return new Response(JSON.stringify({ success: true }));
}
```

### Server Component (CORRECT)

```typescript
// apps/web/src/app/your-page/page.tsx
import { getBackendToken } from '@/lib/auth';

export default async function YourPage() {
  const token = await getBackendToken();  // ✓ No params needed

  if (!token) {
    return <div>Not authenticated</div>;
  }

  // Use token to fetch data from backend
  return <div>Authenticated content</div>;
}
```

### Client Component (WRONG - Use useSession Instead)

```typescript
// ❌ DON'T DO THIS
'use client';
import { getBackendToken } from '@/lib/auth';

// getBackendToken is server-only!

// ✓ DO THIS INSTEAD
import { useSession } from 'next-auth/react';

export function YourComponent() {
  const { data: session } = useSession();
  // Access session.user.role, session.user.email, etc.
}
```

---

## Debugging Checklist

### If token is null (locally works, production fails):

1. **Check browser cookies** (DevTools → Application → Cookies):
   - Local: Should see `authjs.session-token` ✓
   - Production: Should see `__Secure-authjs.session-token` ✓

2. **Check server logs**:

   ```
   DEBUG: No session cookie found
   availableCookies: ['__Secure-authjs.session-token', ...]
   ```

   → If you see `__Secure-` but code only checks `authjs.session-token`, that's the bug!

3. **Verify you're on HTTPS** in production:

   ```
   Protocol: https://gethandled.ai ✓
   ```

   (Not `http://` - that forces the non-prefixed cookie name)

4. **Check API route receives request**:

   ```typescript
   export function GET(request: Request) {
     console.log('Request URL:', request.url); // Should log URL
     const token = await getBackendToken(request);
   }
   ```

5. **Check that getBackendToken() checks the right names**:
   - Look in `apps/web/src/lib/auth.ts` line 302-307
   - Should include: `__Secure-authjs.session-token` ✓

### If you get 401 Unauthorized on protected routes:

1. Verify login succeeded (check session in browser)
2. Check if getBackendToken() returned null (see logs)
3. Verify the returned token is being sent to backend API
4. Check backend API validates the token signature

---

## Cookie Name Lookup Table

Use this when you need to know which name to check:

| Environment       | Protocol | Cookie Name                        | Prefix? |
| :---------------- | :------- | :--------------------------------- | :------ |
| Local dev         | HTTP     | `authjs.session-token`             | ❌      |
| Staging           | HTTPS    | `__Secure-authjs.session-token`    | ✓       |
| Production        | HTTPS    | `__Secure-authjs.session-token`    | ✓       |
| NextAuth v4 (old) | HTTPS    | `__Secure-next-auth.session-token` | ✓       |

**Rule**: Check HTTPS variant first (most common after deployment).

---

## Common Mistakes (Don't Do These)

### ❌ MISTAKE 1: Only checking one cookie name

```typescript
// Wrong - only works on HTTP
const token = cookies.get('authjs.session-token')?.value;
```

**Fix**:

```typescript
// Correct - check multiple names
const possibleNames = [
  '__Secure-authjs.session-token', // HTTPS first
  'authjs.session-token', // HTTP second
];
const cookieName = possibleNames.find((name) => cookies.get(name));
```

### ❌ MISTAKE 2: Constructing request in API route

```typescript
// Wrong - creating mock request
export function GET() {
  const req = { cookies: {}, headers: {} };
  await getToken({ req, ... });  // Fails silently
}
```

**Fix**:

```typescript
// Correct - use actual request
export function GET(request: Request) {
  await getToken({ req: request, ... });  // Works!
}
```

### ❌ MISTAKE 3: Not handling null return

```typescript
// Wrong - crashes if token is null
const token = await getBackendToken();
const data = await api.call({ token });
```

**Fix**:

```typescript
// Correct - check for null
const token = await getBackendToken();
if (!token) {
  return new Response('Unauthorized', { status: 401 });
}
const data = await api.call({ token });
```

### ❌ MISTAKE 4: Using getBackendToken on client

```typescript
// Wrong - getBackendToken is server-only!
'use client';
import { getBackendToken } from '@/lib/auth';
```

**Fix**:

```typescript
// Correct - use useSession on client
'use client';
import { useSession } from 'next-auth/react';

export function Component() {
  const { data: session } = useSession();
  // session.user.email, session.user.role, etc.
}
```

---

## Testing Your Fix

```bash
# 1. Login on local (HTTP)
npm run dev:web
# → Check browser cookies: authjs.session-token present? ✓

# 2. Try API route
curl http://localhost:3000/api/tenant-admin/something
# → Should work (token found)

# 3. Deploy to staging (HTTPS)
npm run deploy:staging
# → Check browser cookies: __Secure-authjs.session-token present? ✓

# 4. Try API route on staging
curl https://staging.gethandled.ai/api/tenant-admin/something
# → Should work (token found with __Secure- prefix)
```

---

## Emergency Checklist (If Production is Down)

1. **Stop. Check logs first.**

   ```
   Look for: "No session cookie found"
   Check: Which cookie names are actually present?
   ```

2. **Is it HTTPS?**

   ```
   https://gethandled.ai ✓ (should use __Secure- prefix)
   http://gethandled.ai ❌ (wrong, should be HTTPS)
   ```

3. **Do you check for `__Secure-` prefix?**

   ```
   In apps/web/src/lib/auth.ts:
   Should include: '__Secure-authjs.session-token'
   ```

4. **Did you pass request in API routes?**

   ```
   export function GET(request: Request) {
     const token = await getBackendToken(request);
   }
   ```

5. **Rollback or apply fix**:
   - If new code: Rollback to last known good
   - If old code: Update to check \_\_Secure- prefix

---

## Related Files

- **Full Prevention Guide**: `docs/solutions/authentication-issues/nextauth-v5-getbackendtoken-cookie-prefix.md`
- **Auth Configuration**: `apps/web/src/lib/auth.ts`
- **NextAuth v5 Docs**: https://authjs.dev/
- **Cookie Security (MDN)**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie

---

**Last Updated**: 2025-12-31
**Severity**: CRITICAL - Affects production authentication
**Test Before Deploying**: YES - Always test on HTTPS
