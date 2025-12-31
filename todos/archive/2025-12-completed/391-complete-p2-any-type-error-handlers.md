---
status: complete
priority: p2
issue_id: '391'
tags:
  - typescript
  - type-safety
  - code-review
dependencies: []
---

# Fix `any` Type Usage in Error Handlers

## Problem Statement

Multiple files use `catch (err: any)` pattern which bypasses TypeScript type checking and can cause runtime errors if `err.message` doesn't exist.

## Findings

**Affected Files:**

1. `apps/web/src/app/(protected)/tenant/domains/page.tsx`
   - Lines 124, 163, 190 use `catch (err: any)`
   - Accesses `err.message` without type guard

2. `server/src/routes/admin/stripe.routes.ts`
   - Line 34: `let stripeConnectService: any`
   - Unsafe service injection

**Example of issue:**

```typescript
// BAD - err might not have message property
catch (err: any) {
  setError(err.message || 'Failed to add domain');
}

// GOOD - Type-safe error handling
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  setError(message || 'Failed to add domain');
}
```

## Proposed Solutions

### Option 1: Use type guards (Recommended)

- Replace `any` with `unknown`
- Use `instanceof Error` check before accessing properties

**Pros:** Type-safe, handles edge cases
**Cons:** Slightly more verbose
**Effort:** Small
**Risk:** Low

### Option 2: Create error utility function

- Create `getErrorMessage(error: unknown): string` helper
- Use throughout codebase

**Pros:** DRY, consistent error handling
**Cons:** Another utility to maintain
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 2 - Create utility and use it everywhere

## Technical Details

**Utility function:**

```typescript
// lib/errors.ts
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}
```

**Usage:**

```typescript
import { getErrorMessage } from '@/lib/errors';

catch (error) {
  setError(getErrorMessage(error) || 'Failed to add domain');
}
```

## Acceptance Criteria

- [ ] No `catch (err: any)` patterns in codebase
- [ ] Error utility function created
- [ ] All error handlers use type-safe pattern
- [ ] TypeScript strict mode passes

## Work Log

| Date       | Action                        | Learnings                         |
| ---------- | ----------------------------- | --------------------------------- |
| 2025-12-25 | Created from multi-agent scan | Found during type safety analysis |

## Resources

- TypeScript error handling best practices
- CLAUDE.md TypeScript strict rules
