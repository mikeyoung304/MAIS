---
status: complete
priority: p1
issue_id: "405"
tags:
  - code-review
  - security
  - logging
  - locked-template-system
dependencies: []
---

# Missing Error Logging in Landing Page API Route

## Problem Statement

The Next.js API route at `/api/tenant/landing-page` catches errors but silently returns 500 without logging. This violates the codebase convention of using `logger` for all error handling.

**Why This Matters:**
- Errors are invisible in production monitoring
- No audit trail for debugging
- Inconsistent with CLAUDE.md: "Use `logger`, never `console.log`"

## Findings

**Location:** `apps/web/src/app/api/tenant/landing-page/route.ts`

**Evidence (lines 46-51 and 92-97):**
```typescript
} catch (error) {
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**Expected pattern** (from `apps/web/src/app/t/[slug]/(site)/error.tsx`):
```typescript
import { logger } from '@/lib/logger';
logger.error('Storefront error boundary caught error', error);
```

**Agent:** Pattern Recognition Specialist

## Proposed Solutions

### Solution 1: Add Logger Import and Log Errors (Recommended)

Add `logger.error()` calls before returning 500 responses.

```typescript
import { logger } from '@/lib/logger';

} catch (error) {
  logger.error('Landing page API error', { error, method: 'GET' });
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**Pros:**
- Consistent with codebase patterns
- Enables production monitoring
- Minimal change

**Cons:**
- None

**Effort:** Small
**Risk:** None

## Recommended Action

**APPROVED**: Solution 1 - Add logger.error() calls before returning 500 responses.

## Technical Details

**Affected Files:**
- `apps/web/src/app/api/tenant/landing-page/route.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] `logger` imported from `@/lib/logger`
- [ ] GET handler logs errors with context before returning 500
- [ ] PUT handler logs errors with context before returning 500
- [ ] TypeScript passes (`npm run typecheck`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Silent error handling found in new API route |

## Resources

- Pattern: `apps/web/src/lib/logger.ts`
- Reference: `apps/web/src/app/t/[slug]/(site)/error.tsx`
