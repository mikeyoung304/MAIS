---
status: resolved
priority: p2
issue_id: '732'
tags:
  - code-review
  - security
  - error-handling
  - dx
dependencies: []
---

# P2: Inconsistent Error Messages Between Proxies

## Problem Statement

The `/api/agent/*` and `/api/tenant-admin/*` proxies return different error formats for the same failure condition (missing authentication), making debugging difficult and potentially leaking information about the authentication flow.

## Why It Matters

- **Debugging Impact**: Different error formats make it hard to trace issues
- **Security Impact**: Semantic `reason` field in agent proxy reveals auth state
- **DX Impact**: Developers can't rely on consistent error handling

## Findings

### Current Behavior (Code Simplicity Reviewer + Security Sentinel)

**Agent proxy** (`/api/agent/*`):

```typescript
return NextResponse.json(
  {
    available: false,
    reason: 'not_authenticated', // <- Leaks auth state
    message: 'Please sign in to access your assistant.',
  },
  { status: 401 }
);
```

**Tenant-admin proxy** (`/api/tenant-admin/*`):

```typescript
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Security Concern

The `reason: 'not_authenticated'` field reveals the specific authentication failure mode, which could help attackers understand the auth flow.

## Proposed Solutions

### Option A: Standardize on generic errors (Recommended)

**Pros**: More secure, consistent
**Cons**: Less user-friendly for agent
**Effort**: Small (15 minutes)
**Risk**: Low

```typescript
// Both proxies return same format
return NextResponse.json(
  {
    status: 'error',
    statusCode: 401,
    error: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
  { status: 401 }
);
```

### Option B: Create shared error response helper

**Pros**: DRY, ensures consistency
**Cons**: Requires import in both files
**Effort**: Small (20 minutes)
**Risk**: Low

```typescript
// lib/proxy-errors.ts
export function unauthorizedResponse(context: 'agent' | 'tenant-admin') {
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: 'Authentication required' },
    { status: 401 }
  );
}
```

## Recommended Action

**Option B** - Create shared helper to enforce consistency.

## Resolution

Implemented **Option B** with the following changes:

### New File Created

- `apps/web/src/lib/proxy-errors.ts` - Shared proxy error response helpers

### Files Modified

- `apps/web/src/app/api/agent/[...path]/route.ts` - Updated to use shared helpers
- `apps/web/src/app/api/tenant-admin/[...path]/route.ts` - Updated to use shared helpers

### Changes Made

1. Created `proxy-errors.ts` with three helpers:
   - `unauthorizedResponse()` - Returns 401 with `{ error: 'UNAUTHORIZED', message: 'Authentication required' }`
   - `badRequestResponse(message)` - Returns 400 with `{ error: 'BAD_REQUEST', message }`
   - `serverErrorResponse()` - Returns 500 with `{ error: 'INTERNAL_ERROR', message: 'Internal server error' }`

2. Updated both proxy routes to use the shared helpers instead of inline responses

3. Removed semantic `reason` field from agent proxy (security improvement)

## Technical Details

### Affected Files

- `apps/web/src/app/api/agent/[...path]/route.ts`
- `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
- `apps/web/src/lib/proxy-errors.ts` (new)

## Acceptance Criteria

- [x] Both proxies return identical error format for 401
- [x] No semantic `reason` field that reveals auth state
- [x] Shared helper enforces consistency
- [x] Error format documented (in proxy-errors.ts JSDoc)

## Work Log

| Date       | Action                                   | Learnings                                                                                |
| ---------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-01-10 | Issue identified via multi-agent review  | Inconsistent errors make debugging "identical" code paths confusing                      |
| 2026-01-10 | Implemented Option B with shared helpers | Creating typed helpers prevents future inconsistency; JSDoc documents security rationale |

## Resources

- **Error Disclosure Doc**: `docs/solutions/code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md`
- **New Helper File**: `apps/web/src/lib/proxy-errors.ts`
