---
title: NextAuth Backend Token Security & API Proxy Pattern
date: 2025-12-30
category: integration-issues
tags:
  - nextjs
  - authentication
  - api-proxy
  - nextauth
  - security
severity: medium
time_to_fix: 15min
recurrence_risk: low
components_affected:
  - apps/web/src/components/agent/AgentChat.tsx
  - apps/web/src/app/api/agent/[...path]/route.ts
  - apps/web/src/lib/auth.ts
---

# NextAuth Backend Token Security & API Proxy Pattern

## Problem Statement

The AgentChat component (tenant dashboard chatbot) was displaying "unavailable" status, even though the Express backend was running and the backend token existed in the session.

**Root Cause:** Client-side component was attempting to call the Express API directly (http://localhost:3001/v1/agent/\*) without authentication headers, causing the tenant middleware to fail tenant resolution (tenantId was null).

## Why This Matters

This is a **security + UX integration problem**:

1. **Security**: Backend tokens should NEVER be exposed to client-side JavaScript
2. **UX**: Without proper authentication, the chatbot appears broken when it's actually just unauthenticated
3. **Integration**: The API proxy pattern already existed but wasn't being used

## Technical Root Cause

NextAuth.js v5 stores the backend token in an HTTP-only JWT cookie (`auth.js-{NEXTAUTH_SECRET}`) for security:

```typescript
// auth.ts - line 215
session: { // ← backend token is intentionally NOT included in session
  user: {
    id: maisToken.id,
    email: maisToken.email,
    role: maisToken.role,
    // NOTE: backendToken removed - kept server-side only in JWT
  }
}
```

This means:

- Client-side code CANNOT access `session.user.backendToken`
- Backend token is only available in Server Components or API routes
- Client-side fetch calls need to go through a proxy that can access the server-side token

## The Solution: API Proxy Pattern

The fix involves routing all client API calls through a Next.js API route proxy that:

1. Receives unauthenticated request from client
2. Retrieves backend token server-side via `getBackendToken()`
3. Adds Authorization header with token
4. Forwards request to Express backend
5. Returns response to client

### Before (Broken)

```typescript
// AgentChat.tsx - BROKEN: direct call without auth
const API_URL = 'http://localhost:3001'; // ❌ No token, tenantId is null

const response = await fetch(`${API_URL}/v1/agent/health`);
// Express tenant middleware: tenantId = null → health check fails
```

### After (Fixed)

```typescript
// AgentChat.tsx - FIXED: uses proxy
const API_URL = '/api'; // ✅ Routes to Next.js proxy

const response = await fetch(`${API_URL}/agent/health`);
// → Proxied to: /api/agent/health
// → Next.js route handler adds Authorization header
// → Forwarded to: http://localhost:3001/v1/agent/health
// → Express receives valid token → tenantId resolved
```

## Implementation Details

### Client Component Change

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/AgentChat.tsx`

```typescript
// Line 13: Updated API_URL to use Next.js proxy
const API_URL = '/api';  // ✅ Uses proxy instead of direct backend call

// Lines 131, 150, 203, 250, 282: Updated fetch paths
// Remove /v1/agent prefix since proxy adds it
await fetch(`${API_URL}/agent/health`);      // ✅ Was: /v1/agent/health
await fetch(`${API_URL}/agent/session`);     // ✅ Was: /v1/agent/session
await fetch(`${API_URL}/agent/chat`, {...}); // ✅ Was: /v1/agent/chat
```

### Proxy Route Handler

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/api/agent/[...path]/route.ts`

The proxy already exists and handles the complex parts:

```typescript
// Line 29: Retrieves backend token server-side (secure)
const token = await getBackendToken();

// Lines 58-61: Adds Authorization header
const headers: HeadersInit = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
};

// Line 55: Reconstructs backend URL with /v1 prefix
const backendUrl = `${API_BASE_URL}/v1/agent/${pathString}${queryString}`;

// Lines 76-80: Forwards request with auth
const response = await fetch(backendUrl, {
  method,
  headers,
  body,
});
```

### Security Layer

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/auth.ts`

```typescript
// Lines 254-277: getBackendToken() only works on server
export async function getBackendToken(): Promise<string | null> {
  const { getToken } = await import('next-auth/jwt');
  const { cookies, headers } = await import('next/headers');

  // Access HTTP-only JWT cookie
  const cookieStore = await cookies();
  const token = await getToken({
    req: { cookies, headers },
    secret: process.env.AUTH_SECRET,
  });

  return (token as MAISJWT).backendToken || null;
}
```

Key: This function ONLY works in Server Components or API routes because of Next.js `cookies()` and `headers()` APIs.

## Why This Pattern Works

| Aspect                | Details                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| **Security**          | Backend token never exposed to client; remains in HTTP-only JWT cookie |
| **Authentication**    | Proxy adds Authorization header server-side before forwarding          |
| **Tenant Resolution** | Express middleware receives valid Bearer token → resolves tenantId     |
| **Client Simplicity** | Client just calls `/api/agent/*` without thinking about auth           |
| **Error Handling**    | Proxy returns 401 with friendly message if not authenticated           |

## Flow Diagram

```
User Browser (AgentChat.tsx)
  │
  ├─ fetch('/api/agent/health')
  │
  └─→ Next.js API Route (/api/agent/[...path]/route.ts)
       │
       ├─ getBackendToken() ← Reads HTTP-only JWT cookie (secure)
       │
       ├─ Add Authorization: Bearer <token>
       │
       └─→ Express Backend (http://localhost:3001/v1/agent/health)
            │
            ├─ Validate Bearer token
            │
            ├─ Tenant middleware resolves tenantId
            │
            └─ Returns health check response
```

## Common Mistakes to Avoid

### 1. Client Accessing Backend Token Directly

```typescript
// ❌ WRONG: Doesn't work - token not in session
const response = await fetch('/v1/agent/health', {
  headers: {
    Authorization: `Bearer ${session.user.backendToken}`,
    // ↑ undefined - token is only in HTTP-only cookie
  },
});
```

### 2. Removing API Proxy

```typescript
// ❌ WRONG: Direct backend call loses authentication
const API_URL = 'http://localhost:3001';
await fetch(`${API_URL}/v1/agent/health`);
// ↑ No Authorization header - tenantId = null
```

### 3. Using Credentials Include

```typescript
// ❌ WRONG: credentials: 'include' not needed for same-origin
fetch('/api/agent/health', {
  credentials: 'include', // ← Unnecessary for same-origin requests
});

// ✅ CORRECT: Default fetch behavior includes cookies
fetch('/api/agent/health'); // ← Automatically includes cookies
```

## Testing the Fix

### Quick Verification

1. Start Next.js dev server: `cd apps/web && npm run dev`
2. Navigate to tenant dashboard
3. Verify chatbot loads without "unavailable" message
4. Check browser Network tab:
   - Request: `/api/agent/health`
   - Proxy forwards to: `http://localhost:3001/v1/agent/health` (with Authorization header)

### Integration Points to Verify

```bash
# 1. Health check works
curl http://localhost:3000/api/agent/health

# 2. Backend token is retrievable (server-side only)
# In Server Component or API route:
import { getBackendToken } from '@/lib/auth';
const token = await getBackendToken(); // ← Works

# 3. From client-side code:
const token = await getBackendToken(); // ← Fails (as expected)
```

## Related Patterns

### Similar Proxy Routes

If you need to add more proxied endpoints, follow the same pattern:

```typescript
// apps/web/src/app/api/[resource]/[...path]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; path: string[] }> }
) {
  const token = await getBackendToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Forward with auth...
}
```

### NextAuth.js Session Pattern

For accessing user info in Server Components:

```typescript
import { auth } from '@/lib/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // Use session.user (token exposed here)
  // Get backend token for API calls:
  const token = await getBackendToken();
}
```

## Prevention Checklist

- [ ] All client API calls route through proxy (no direct backend URLs)
- [ ] Backend token never accessed from client-side code
- [ ] Proxy validates authentication before forwarding
- [ ] Proxy returns 401 (not 500) when unauthenticated
- [ ] Error messages are user-friendly (not technical)
- [ ] Tests verify both authenticated and unauthenticated flows

## Files Changed

| File                                            | Change                                                     | Impact                                       |
| ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `apps/web/src/components/agent/AgentChat.tsx`   | Changed API_URL from backend to proxy; updated fetch paths | Component now works with authenticated proxy |
| `apps/web/src/app/api/agent/[...path]/route.ts` | Already implemented - no changes needed                    | Handles token injection and forwarding       |
| `apps/web/src/lib/auth.ts`                      | Already implemented - no changes needed                    | Provides secure token retrieval              |

## Key Takeaways

1. **NextAuth Backend Token Pattern**: Store sensitive tokens in HTTP-only cookies, expose non-sensitive data in session
2. **API Proxy Pattern**: Client calls `/api/...` → proxy adds auth → forwards to backend
3. **Security First**: Token is never exposed to client-side JavaScript
4. **Tenant Resolution**: Express middleware can now resolve tenantId because Bearer token is present

---

**Documented by:** Claude Code Agent
**Solution Type:** Security Best Practice + Integration Pattern
**Status:** Applied and tested (2025-12-30)
