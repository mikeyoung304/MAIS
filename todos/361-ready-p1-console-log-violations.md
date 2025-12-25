---
status: ready
priority: p1
issue_id: "361"
tags: [code-review, quality, logging]
dependencies: []
---

# Console Logging in Production Code (Violates CLAUDE.md)

## Problem Statement

The CLAUDE.md explicitly states: "Logging: Use `logger`, never `console.log`". Found 6+ instances of console.log/error in the Next.js app.

**Why it matters:** Breaks consistency with backend logger patterns, obscures errors in production monitoring.

## Findings

**Violations Found:**

| File | Line | Code |
|------|------|------|
| `apps/web/src/app/api/revalidate/route.ts` | 26 | `console.error('NEXTJS_REVALIDATE_SECRET not configured')` |
| `apps/web/src/app/api/revalidate/route.ts` | 60 | `console.log('Revalidated path: ${path}')` |
| `apps/web/src/app/api/revalidate/route.ts` | 68 | `console.error('Revalidation error:', error)` |
| `apps/web/src/lib/auth.ts` | 135 | `console.error('Auth error:', error)` |
| `apps/web/src/app/sitemap.ts` | 69 | `console.error('Error fetching tenants...')` |
| `apps/web/src/app/(protected)/tenant/domains/page.tsx` | ~159 | `console.error('Error fetching domains:', err)` |

**Impact:** P1 - Non-compliant with project standards (CLAUDE.md)

## Proposed Solutions

### Option 1: Create Web Logger Utility (Recommended)
- **Description:** Create `apps/web/src/lib/logger.ts` matching server pattern
- **Pros:** Consistent logging, works in both server and client
- **Cons:** Need to handle browser vs server context
- **Effort:** Small (30 min)
- **Risk:** Low

### Option 2: Import from @macon/shared
- **Description:** Export logger from shared package
- **Pros:** Single source of truth
- **Cons:** May need isomorphic logger
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**FIX NOW** - Replace all console.log/error with a logger utility. Create `apps/web/src/lib/logger.ts` first, then update the 6 files. This is a CLAUDE.md compliance issue.

## Technical Details

**Logger Template:**
```typescript
// apps/web/src/lib/logger.ts
const logger = {
  info: (message: string, data?: object) => {
    if (process.env.NODE_ENV === 'development') console.log(message, data);
    // In production: send to monitoring service
  },
  warn: (message: string, data?: object) => {...},
  error: (message: string, error?: Error | object) => {...},
};
export { logger };
```

## Acceptance Criteria

- [ ] All console.log/error replaced with logger
- [ ] Logger created in apps/web/src/lib/logger.ts
- [ ] No eslint console warnings
- [ ] Logs work in development and production

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | CLAUDE.md violation found |

## Resources

- CLAUDE.md: "Logging: Use `logger`, never `console.log`"
