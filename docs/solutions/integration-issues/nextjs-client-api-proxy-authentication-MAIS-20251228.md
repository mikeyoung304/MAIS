---
title: Next.js Client API Authentication Through Proxy Route
category: integration-issues
severity: P1
components:
  - apps/web/src/app/api/agent/[...path]/route.ts
  - apps/web/src/components/agent/PanelAgentChat.tsx
tags:
  - authentication
  - api-proxy
  - nextauth
  - jwt
  - growth-assistant
  - client-server-communication
date_solved: 2025-12-28
symptoms:
  - Growth Assistant panel showing 'Assistant Unavailable' with generic error message
  - Console error 401 Unauthorized when calling Express API from client component
  - Health check endpoint returning 401 even with credentials:include
root_cause: Client components cannot access backend JWT token (security design)
verified: true
---

# Next.js Client API Authentication Through Proxy Route

## Problem

The Growth Assistant PanelAgentChat component couldn't authenticate with the Express API:

```
Console: Failed to load resource: the server responded with a status of 401 (Unauthorized)
UI: "Assistant Unavailable - Unable to connect to your assistant"
```

## Root Cause

**Architecture mismatch between Next.js client components and Express API authentication:**

1. **Express API** requires JWT token in `Authorization: Bearer ${token}` header
2. **NextAuth** stores the backend token securely in HTTP-only cookies (server-side only)
3. **Client components** (marked with `'use client'`) run in the browser and cannot access server-side secrets
4. Using `credentials: 'include'` sends cookies, but Express validates JWT tokens not NextAuth cookies

```
Before (Broken):
Browser → fetch(Express/v1/agent/health, {credentials:'include'}) → 401 Unauthorized
```

## Solution

Created a **Next.js API proxy route** that bridges client components to Express with proper authentication.

```
After (Working):
Browser → fetch(/api/agent/health) → Next.js Proxy → getBackendToken() → Express API → Success
```

### 1. Create API Proxy Route

**File:** `apps/web/src/app/api/agent/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Server-side: can access NextAuth session
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
  const backendUrl = `${API_BASE_URL}/v1/agent/${path.join('/')}${new URL(request.url).search}`;

  const response = await fetch(backendUrl, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`, // Add the secure token
      Accept: 'application/json',
      ...(request.method !== 'GET'
        ? { 'Content-Type': request.headers.get('content-type') || '' }
        : {}),
    },
    body: request.method !== 'GET' ? await request.text() : undefined,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, ctx);
}
// ... PUT, PATCH, DELETE handlers
```

### 2. Update Client Component

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

```typescript
// Before (broken):
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
await fetch(`${API_URL}/v1/agent/health`, { credentials: 'include' });

// After (working):
const API_PROXY = '/api/agent';
await fetch(`${API_PROXY}/health`);
```

## Key Insight

**Client components can never access server-side secrets.** This is a security feature, not a bug. The solution is to create a server-side proxy that:

1. Runs in Node.js (can access NextAuth session)
2. Adds authentication headers
3. Forwards requests to the backend
4. Returns responses to the client

## Authentication Flow

```
NextAuth Session (HTTP-only cookie)
         ↓
    getBackendToken()  [server-side only]
         ↓
   API Proxy adds Authorization header
         ↓
   Express API validates Bearer token
         ↓
   Request succeeds with tenant isolation
```

## Prevention

### When You Need a Proxy

Create an API proxy when:

- ✅ Client component needs to call Express API
- ✅ Express API requires JWT authentication
- ✅ You see 401 errors from client-side fetch calls

### Existing Proxies (Use as Templates)

| Proxy Route                   | Backend Route        | Purpose                  |
| ----------------------------- | -------------------- | ------------------------ |
| `/api/tenant-admin/[...path]` | `/v1/tenant-admin/*` | Tenant CRUD operations   |
| `/api/agent/[...path]`        | `/v1/agent/*`        | AI assistant integration |

### Code Review Checklist

- [ ] Client components use `/api/` proxy, never direct backend URLs
- [ ] Proxy calls `getBackendToken()` server-side
- [ ] Token is added to `Authorization` header
- [ ] All HTTP methods are exported (GET, POST, PUT, PATCH, DELETE)
- [ ] Error responses include user-friendly messages

## Related Documentation

- [API Proxy Pattern Prevention](../API_PROXY_PATTERN_PREVENTION.md) - Comprehensive guide
- [API Proxy Quick Reference](../API_PROXY_QUICK_REFERENCE.md) - 30-second cheat sheet
- [API Proxy Code Review Checklist](../API_PROXY_CODE_REVIEW_CHECKLIST.md) - PR review guide
- [ADR-015: API Proxy Pattern](../../adrs/ADR-015-api-proxy-pattern.md) - Architectural decision

## Files Changed

| File                                               | Change               |
| -------------------------------------------------- | -------------------- |
| `apps/web/src/app/api/agent/[...path]/route.ts`    | Created proxy route  |
| `apps/web/src/components/agent/PanelAgentChat.tsx` | Updated to use proxy |

## Commits

- `4b96440` - fix(agent): add API proxy for Growth Assistant authentication
