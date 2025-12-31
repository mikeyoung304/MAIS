# P2: Path Traversal Potential in Agent API Proxy

## Status

- **Priority:** P2 (Medium - Security)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Security Sentinel

## Problem

The agent API proxy doesn't validate path segments for traversal attempts.

**File:** `apps/web/src/app/api/agent/[...path]/route.ts` (line 44)

```typescript
const pathString = path.join('/');
// No validation for '..' or '.' segments
```

A request like `/api/agent/..%2F..%2Fv1%2Fadmin%2Ftenants` could potentially traverse to admin endpoints.

**Mitigating factors:**

- Backend API prefix is fixed at `/v1/agent/`
- Auth middleware would reject requests to other paths
- URL encoding may prevent some attacks

## Impact

Low risk due to mitigations, but defense-in-depth should reject obviously malicious paths early.

## Solution

Add path validation:

```typescript
if (path.some((segment) => segment === '..' || segment === '.' || segment === '')) {
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
}
```

## Tags

`security`, `api`, `validation`
