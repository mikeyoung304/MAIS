---
status: complete
priority: p1
issue_id: '730'
resolution_date: '2026-01-10'
tags:
  - code-review
  - security
  - authentication
  - typescript
dependencies: []
---

# P1: Empty Cookie Value Validation Bug in getBackendToken()

## Problem Statement

The `getBackendToken()` function in `apps/web/src/lib/auth.ts` uses `!== undefined` to check for cookie presence, which treats empty strings as valid cookies. This causes silent authentication failures when cookies are malformed or empty.

## Why It Matters

- **User Impact**: Users see 401 "Missing Authorization header" with no clear explanation
- **Debugging Impact**: The bug is silent - no logs indicate the real cause
- **Security Impact**: Masks authentication issues, could lead to privilege escalation if combined with other bugs

## Findings

### Root Cause (TypeScript Reviewer + Security Sentinel)

**Location**: `apps/web/src/lib/auth.ts`, lines 349-351

```typescript
const cookieName = NEXTAUTH_COOKIE_NAMES.find(
  (name) => cookieStore.get(name)?.value !== undefined // BUG: empty strings pass!
);
```

### Evidence

Manual cookie parsing at lines 320-327 can produce empty strings:

- Malformed cookie `"authjs.session-token"` (no `=`) → stored as `""`
- Empty value `"authjs.session-token="` → stored as `""`

Empty strings pass `!== undefined` check, causing `getToken()` to receive an invalid JWT.

### Test Case

```typescript
// Current behavior (BUG):
const value = '';
console.log(value !== undefined); // TRUE - empty string passes ✗

// Expected behavior:
console.log(!!value); // FALSE - empty string rejected ✓
```

## Proposed Solutions

### Option A: Fix the validation check (Recommended)

**Pros**: Minimal change, fixes root cause
**Cons**: None
**Effort**: Small (5 minutes)
**Risk**: Low

```typescript
const cookieName = NEXTAUTH_COOKIE_NAMES.find((name) => {
  const value = cookieStore.get(name)?.value;
  return value !== undefined && value !== ''; // Also reject empty strings
});
```

### Option B: Use truthiness check

**Pros**: More idiomatic, catches null/undefined/empty
**Cons**: Might be confusing to future readers
**Effort**: Small (5 minutes)
**Risk**: Low

```typescript
const cookieName = NEXTAUTH_COOKIE_NAMES.find(
  (name) => !!cookieStore.get(name)?.value // Truthy check
);
```

### Option C: Add debug logging + Option A

**Pros**: Helps diagnose future issues
**Cons**: Slightly more code
**Effort**: Small (10 minutes)
**Risk**: Low

```typescript
const cookieName = NEXTAUTH_COOKIE_NAMES.find((name) => {
  const value = cookieStore.get(name)?.value;
  if (value === '') {
    logger.debug('Found empty cookie value', { cookieName: name });
  }
  return value !== undefined && value !== '';
});
```

## Recommended Action

**Option C** - Fix validation AND add debug logging for future diagnosis.

## Technical Details

### Affected Files

- `apps/web/src/lib/auth.ts` (lines 312-377)

### Related Prevention Strategy

- `docs/solutions/best-practices/typescript-unused-variables-build-failure-MAIS-20251227.md`

## Acceptance Criteria

- [ ] Empty cookie values are rejected (not treated as found)
- [ ] Debug log added for empty cookie detection
- [ ] Unit test added for edge case: malformed cookie header
- [ ] Manual test: login → preview token works

## Work Log

| Date       | Action                                                                 | Learnings                                                              |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-01-10 | Issue identified via multi-agent review                                | TypeScript `!== undefined` vs truthy check catches different things    |
| 2026-01-10 | **FIXED**: Updated validation to `value !== undefined && value !== ''` | Added debug logging for empty cookie detection to aid future debugging |

## Resources

- **Related PR**: N/A (new finding)
- **Prevention Doc**: `docs/solutions/patterns/NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md`
