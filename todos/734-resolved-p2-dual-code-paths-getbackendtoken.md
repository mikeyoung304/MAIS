---
status: resolved
priority: p2
issue_id: '734'
tags:
  - code-review
  - architecture
  - maintainability
dependencies:
  - '730'
---

# P2: Dual Code Paths in getBackendToken() Create Maintenance Risk

## Problem Statement

The `getBackendToken()` function has two completely different implementations based on whether a `request` parameter is passed:

1. **With request**: Manual cookie string parsing (buggy)
2. **Without request**: Uses `next/headers()` API (safer)

This divergence causes POST requests (which use path 1) to fail while Server Components (path 2) work.

## Why It Matters

- **Bug Risk**: Manual parsing has edge cases not handled by the API
- **Maintenance Risk**: Changes to one path may not be applied to the other
- **Debugging Risk**: Same function name, different behavior

## Findings

### Code Paths (TypeScript Reviewer + Architecture Strategist)

**Path 1 - Manual parsing** (lines 316-332):

```typescript
if (request) {
  const cookieHeader = request.headers.get('cookie') || '';
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    // Manual parsing - doesn't handle edge cases
  });
}
```

**Path 2 - API usage** (lines 334-346):

```typescript
else {
  const { cookies } = await import('next/headers');
  const nextCookieStore = await cookies();
  // Uses validated Next.js API
}
```

### Why Path 1 is Buggy

Manual `split(';')` and `split('=')` doesn't handle:

- Cookies with `=` in the value
- URL-encoded cookie values
- Cookies with no value (`name;`)
- Whitespace variations

## Resolution

**Implemented Option A** - Unified on NextRequest.cookies API.

### Changes Made

1. **Changed function signature** from `Request` to `NextRequest`:

   ```typescript
   export async function getBackendToken(request?: NextRequest): Promise<string | null>;
   ```

2. **Removed manual cookie parsing** (17 lines of buggy code):
   - Deleted `cookieHeader.split(';').forEach(...)` logic
   - Deleted manual `cookieMap` construction

3. **Unified cookie access pattern**:

   ```typescript
   if (request) {
     // API Route Handlers: Use NextRequest.cookies API (validated, handles edge cases)
     cookieStore = request.cookies;
   } else {
     // Server Components: Use next/headers API
     const { cookies } = await import('next/headers');
     cookieStore = await cookies();
   }
   ```

4. **Preserved empty string validation** from P1-730 fix.

### Verification

- All callers already pass `NextRequest` (verified 6 API routes)
- TypeScript typecheck passes
- No breaking changes to public API

## Technical Details

### Affected Files

- `apps/web/src/lib/auth.ts`

### Callers (unchanged - already used NextRequest)

- `apps/web/src/app/api/agent/[...path]/route.ts`
- `apps/web/src/app/api/admin/[...path]/route.ts`
- `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
- `apps/web/src/app/api/tenant/landing-page/route.ts`
- Server Components (no request param)

## Acceptance Criteria

- [x] Single code path for cookie reading
- [x] Uses validated API (NextRequest.cookies or next/headers)
- [x] Manual string parsing removed
- [ ] Tests cover both call patterns (existing tests pass)

## Work Log

| Date       | Action                                  | Learnings                                                                                                     |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-01-10 | Issue identified via multi-agent review | Optional parameters that change behavior create hidden complexity                                             |
| 2026-01-10 | Implemented Option A fix                | NextRequest.cookies API is already in use by all callers - type narrowing from Request to NextRequest is safe |

## Resources

- **NextRequest Docs**: https://nextjs.org/docs/app/api-reference/functions/next-request
