---
title: Next.js Chatbot Direct API Authentication Bypass - Proxy Architecture Fix
category: security-issues
severity: critical
component: apps/web/src/components/agent/AgentChat.tsx
date: 2025-12-30
symptoms:
  - AgentChat component shows "unavailable" in tenant dashboard
  - "Having trouble loading your data. Try again?" error message
  - Health check returns available: false with no clear reason
  - Works with direct Express backend URL but not through Next.js frontend
root_cause: Client-side JavaScript calling Express API directly, bypassing Next.js API proxy that provides authentication
solution_pattern: Proxy all agent API calls through Next.js /api/agent/* route that handles JWT token injection
tags: [nextjs, authentication, security, proxy-pattern, backendtoken, jwt, spa-proxy]
---

# Next.js Chatbot Direct API Authentication Bypass Fix

This document explains why the AgentChat component showed "unavailable" despite the backend being healthy, and the authentication proxy architecture that fixes it.

## Problem Statement

The AgentChat React component was showing "unavailable" error in the tenant dashboard, even though:

1. The Express API backend was healthy and running
2. Health checks were passing when called directly with proper auth headers
3. Other authenticated features (bookings, packages) were working correctly
4. The issue only appeared in the chatbot widget

## Root Cause Analysis

### The Architecture Problem

NextAuth.js stores the backend token in a **server-side only JWT cookie**. This is a security best practice:

```typescript
// In apps/web/src/lib/auth.ts (server-side callback)
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.backendToken = getBackendToken(); // Server-side only!
    }
    return token;
  }
}
```

However, the original AgentChat implementation tried to call the Express API directly from the browser:

```typescript
// WRONG: Client-side JavaScript cannot access server-side JWT
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

fetch(`${API_URL}/v1/agent/health`, { credentials: 'include' });
fetch(`${API_URL}/v1/agent/chat`, { credentials: 'include', ... });
```

### Why This Fails

1. **No Authorization Header**: Without the JWT token, the fetch includes no `Authorization: Bearer` header
2. **Express Tenant Middleware Fails**: The Express tenant middleware looks for the token in the header:

```typescript
// In server/src/middleware/tenant.ts
const authHeader = req.headers.authorization;
const token = authHeader?.split('Bearer ')[1]; // token = undefined

const tenantAuth = validateTenantToken(token);
res.locals.tenantAuth = tenantAuth; // null/empty
```

3. **Health Check Returns "unavailable"**: With no valid tenant auth, the health check endpoint sees `tenantId = null`:

```typescript
// In server/src/routes/agent.routes.ts - GET /health
const tenantId = getTenantId(res); // null!

if (!tenantId) {
  return {
    available: false,
    reason: 'not_authenticated',
    message: 'Please sign in to access your assistant.',
  };
}
```

4. **Chatbot Disabled**: The AgentChat component displays "unavailable" because health check says `available: false`.

### Visual Flow

```
User clicks chatbot → AgentChat component mounts
    ↓
initializeChat() called
    ↓
fetch('/v1/agent/health', { credentials: 'include' }) [WRONG URL]
    ↓
Express receives request with NO Authorization header
    ↓
Tenant middleware: tenantId = null
    ↓
Health check returns: available: false, reason: 'not_authenticated'
    ↓
AgentChat displays "Having trouble loading your data. Try again?"
```

## The Solution: Authentication Proxy

Instead of calling the Express API directly, proxy all agent requests through a **Next.js API route** that:

1. Retrieves the backend token from server-side session
2. Adds the `Authorization: Bearer` header
3. Forwards the request to Express
4. Returns the response to the client

### Step 1: Update AgentChat Component

Change from direct API calls to proxy calls:

```typescript
// In apps/web/src/components/agent/AgentChat.tsx

// BEFORE: Direct API call (wrong)
// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// fetch(`${API_URL}/v1/agent/health`, { credentials: 'include' });

// AFTER: Proxy through Next.js API (correct)
const API_URL = '/api';

// Now all calls go through /api/agent/* proxy
fetch(`${API_URL}/agent/health`);
fetch(`${API_URL}/agent/session`);
fetch(`${API_URL}/agent/chat`, { ... });
fetch(`${API_URL}/agent/proposals/${proposalId}/confirm`, { ... });
```

Why `/api` instead of full URL?

- Same origin → no CORS issues
- Relative path → works in all environments
- Next.js handles routing automatically
- Much simpler than `process.env.NEXT_PUBLIC_API_URL`

### Step 2: Create Authentication Proxy Route

Create `/api/agent/[...path]/route.ts` to handle proxy logic:

```typescript
// In apps/web/src/app/api/agent/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Step 1: Get backend token from server-side session
    const token = await getBackendToken();

    if (!token) {
      return NextResponse.json(
        {
          available: false,
          reason: 'not_authenticated',
          message: 'Please sign in to access your assistant.',
        },
        { status: 401 }
      );
    }

    const { path } = await params;

    // Prevent path traversal attacks
    if (path.some((segment) => segment === '..' || segment === '.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Step 2: Build backend URL with proper path
    const pathString = path.join('/');
    const url = new URL(request.url);
    const backendUrl = `${API_BASE_URL}/v1/agent/${pathString}${url.search}`;

    // Step 3: Prepare headers with Authorization
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`, // CRITICAL: Token added here
      Accept: 'application/json',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
    }

    // Step 4: Forward request to Express backend
    const body =
      request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    // Step 5: Parse and return response
    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    logger.error('Agent API proxy error', {
      error,
      method: request.method,
      url: request.url,
    });

    return NextResponse.json(
      {
        available: false,
        reason: 'proxy_error',
        message: 'Having trouble connecting. Try again?',
      },
      { status: 500 }
    );
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

### How It Works: Complete Flow

```
User clicks chatbot
    ↓
AgentChat component mounts
    ↓
fetch('/api/agent/health') [Same origin, uses proxy]
    ↓
Next.js API route calls getBackendToken()
    ↓
Server-side session → retrieves JWT from cookie
    ↓
Proxy adds Authorization: Bearer <JWT> header
    ↓
Forwards to Express: GET /v1/agent/health
    ↓
Express tenant middleware validates header
    ↓
Tenant ID resolved, health check runs
    ↓
Returns: available: true
    ↓
AgentChat initializes successfully
```

## Security Properties

This architecture maintains security best practices:

### 1. Token Never Exposed to Client

```typescript
// Token retrieval happens ONLY on server
async function getBackendToken() {
  const session = await auth(); // Server-side only
  return session?.backendToken; // Never sent to client
}
```

### 2. Path Traversal Prevention

```typescript
// Validate path segments before forwarding
if (path.some((segment) => segment === '..' || segment === '.')) {
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
}
```

### 3. Request Validation

```typescript
// Proxy validates all requests before forwarding
// - Token must be present
// - Path must be safe
// - Content-type must be preserved
// - Only pass necessary headers
```

## Request/Response Mapping

The proxy transparently maps between client-facing paths and backend paths:

| Client Request                     | Server Action               | Backend Request                   |
| ---------------------------------- | --------------------------- | --------------------------------- |
| `/api/agent/health`                | getBackendToken() + headers | `/v1/agent/health`                |
| `/api/agent/session`               | getBackendToken() + headers | `/v1/agent/session`               |
| `/api/agent/chat`                  | getBackendToken() + headers | `/v1/agent/chat`                  |
| `/api/agent/proposals/123/confirm` | Same pattern                | `/v1/agent/proposals/123/confirm` |

## Common Pitfalls to Avoid

### 1. Using `process.env.NEXT_PUBLIC_API_URL` in Client Component

```typescript
// ❌ WRONG: Tries to call Express directly
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
fetch(`${API_URL}/v1/agent/health`);
```

**Why it fails:** Client JavaScript cannot access server-side token

### 2. Forgetting to Add Authorization Header

```typescript
// ❌ WRONG: Proxy exists but doesn't add token
const response = await fetch(backendUrl, {
  method,
  headers: {
    'Content-Type': 'application/json',
    // Missing Authorization header!
  },
  body,
});
```

**Why it fails:** Express sees no token, rejects request

### 3. Using Relative Path Without Proxy

```typescript
// ❌ WRONG: Path is relative but no proxy exists
fetch('/v1/agent/health'); // Next.js looks for route at /v1/agent/health
```

**Why it fails:** Next.js doesn't have a route handler at that path

### 4. Storing Backend Token in Session Callback

```typescript
// ❌ WRONG: Exposing token to client
callbacks: {
  async session({ session, token }) {
    session.backendToken = token.backendToken; // Now client has it!
    return session;
  }
}
```

**Why it's wrong:** NextAuth sessions are readable from client-side code

**Solution:** Store in JWT only (not in session object), access only in server functions

## Testing the Fix

### Manual Testing

1. **Open Developer Console** (F12)
2. **Go to Network tab**
3. **Open chatbot widget**
4. **Observe requests:**
   - Should see request to `/api/agent/health` (same origin)
   - NOT to `http://localhost:3001/v1/agent/health`
   - Request should succeed with `available: true`

### Automated Testing

```typescript
// E2E test for chatbot availability
import { test, expect } from '@playwright/test';

test('chatbot initializes successfully', async ({ page }) => {
  await page.goto('/tenant/dashboard');

  // Wait for chatbot widget to appear
  const chatbotContainer = page.locator('[data-testid="chatbot-container"]');
  await expect(chatbotContainer).toBeVisible();

  // Verify it's NOT in error state
  await expect(page.locator('text=Having trouble loading')).not.toBeVisible();

  // Verify input is enabled (indicates successful initialization)
  const chatInput = page.locator('[data-testid="chat-input"]');
  await expect(chatInput).toBeEnabled();
});
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│    Tenant Dashboard (Next.js)           │
│  ┌──────────────────────────────────┐  │
│  │  AgentChat Component ('use client')  │
│  │  fetch('/api/agent/health')      │  │
│  └──────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 │ Same origin
                 ↓
    ┌────────────────────────────┐
    │ /api/agent/[...path]/route.ts  │
    │ (Server Route Handler)       │
    │                              │
    │ 1. getBackendToken()         │
    │ 2. Validate path             │
    │ 3. Add Authorization header  │
    │ 4. Forward to Express        │
    │ 5. Return response           │
    └────────────────┬─────────────┘
                     │ Authorization: Bearer <JWT>
                     ↓
        ┌─────────────────────────┐
        │  Express API            │
        │  /v1/agent/health       │
        │                         │
        │ Tenant middleware:      │
        │ - Reads Authorization   │
        │ - Validates JWT         │
        │ - Resolves tenantId     │
        │                         │
        │ Health check:           │
        │ - Verifies services     │
        │ - Returns available     │
        └─────────────────────────┘
```

## Related Documentation

- [NextAuth.js v5 Configuration](../../reference/NEXTAUTH-V5-SETUP.md)
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Chatbot Architecture Overview](./chatbot-proposal-execution-flow-MAIS-20251229.md)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **Server-side tokens must stay server-side** - Never expose JWT to client code, even in session callbacks
2. **API proxies bridge authentication gaps** - Server routes can access tokens and forward authenticated requests
3. **Same-origin requests bypass CORS** - Use relative paths (`/api/*`) instead of absolute URLs
4. **Transparent proxying enables clear separation** - Client code doesn't know about authentication, proxy handles it
5. **Path validation prevents injection** - Always sanitize path segments in proxy routes

`─────────────────────────────────────────────────`

## Checklist for Implementing This Fix

- [ ] Update `AgentChat.tsx` to use `/api` proxy instead of direct Express URL
- [ ] Create `/api/agent/[...path]/route.ts` proxy route
- [ ] Implement `getBackendToken()` in `lib/auth.ts` (server-only function)
- [ ] Add path validation to prevent traversal attacks
- [ ] Test chatbot initialization in browser DevTools Network tab
- [ ] Verify no requests go to direct Express API URL
- [ ] Run E2E tests to confirm chatbot works end-to-end
- [ ] Document proxy pattern in team wiki for future SPA features

## Git Commit Message Template

```
fix(web): proxy agent API requests through next.js authentication layer

The AgentChat component was calling the Express API directly from the browser,
bypassing the authentication proxy. Backend token is server-side only and
cannot be accessed from client code.

BREAKING CHANGE: AgentChat now requires the /api/agent/* proxy route to be
available. Ensure apps/web/src/app/api/agent/[...path]/route.ts exists.

Fixes: #[issue-number]
- Move API calls from direct Express URL to /api/agent/* proxy
- Proxy handles JWT token injection before forwarding to backend
- Add path traversal validation in proxy route
- Update health check initialization flow
```
