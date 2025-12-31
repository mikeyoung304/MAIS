---
status: complete
priority: p2
issue_id: '129'
tags: [code-review, logging, code-quality, pr-12]
dependencies: []
resolution: NOT FOUND - No console.error calls in TenantPackagesManager.tsx
---

# console.error Used Instead of Logger

## Problem Statement

The TenantPackagesManager uses `console.error` for error logging instead of the structured logger pattern used elsewhere in the codebase.

**Why it matters:**

- Violates CLAUDE.md rule: "Use `logger`, never `console.log`"
- console.error doesn't integrate with error tracking (Sentry)
- No structured metadata for debugging
- Inconsistent with codebase patterns

## Findings

**Source:** Pattern Recognition agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`

**Current Code:**

```typescript
} catch (error) {
  console.error('Failed to delete package:', error);
}
```

## Proposed Solutions

### Solution 1: Use Client Logger (Recommended)

```typescript
import { logger } from '@/lib/logger';

} catch (error) {
  logger.error('Failed to delete package', { error, packageId: pkg.id });
}
```

**Pros:** Consistent with codebase, better debugging
**Cons:** Need to verify client logger exists
**Effort:** Small (5 minutes)
**Risk:** Low

### Solution 2: Keep console.error for Client

If client logger doesn't exist, this is acceptable for client-side code.

**Pros:** No changes needed
**Cons:** Inconsistent patterns
**Effort:** None
**Risk:** None

## Recommended Action

Check if client has logger utility. If yes, use it. If no, consider creating one or accept console.error for client-side code.

## Technical Details

**Affected Files:**

- `client/src/features/tenant-admin/TenantPackagesManager.tsx`

**Note:** The CLAUDE.md rule about logger may be server-focused. Verify client expectations.

## Acceptance Criteria

- [ ] Either use client logger OR document that console.error is acceptable for client
- [ ] If using logger, add structured metadata
- [ ] TypeScript passes

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
