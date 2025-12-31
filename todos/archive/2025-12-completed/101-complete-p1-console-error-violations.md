---
status: complete
priority: p1
issue_id: '101'
tags: [code-review, logging, ui-redesign]
dependencies: []
---

# Console.error Used Instead of Logger (24 Instances)

## Problem Statement

Direct `console.error()` usage across tenant-admin features violates the critical security rule from CLAUDE.md: "Logging: Use `logger`, never `console.log`"

**Why it matters:** No centralized error tracking, missing tenant context, no log aggregation in production.

## Findings

### From architecture-strategist and code-quality agents:

**Files with violations:**

- `client/src/features/tenant-admin/BrandingEditor.tsx` (line 104)
- `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts` (lines 46, 60, 74, 88)
- `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx` (lines 55, 105, 137, 157)
- `client/src/features/tenant-admin/packages/hooks/usePackageManager.ts` (lines 34, 61)
- And ~14 more instances

**Example violations:**

```typescript
// BrandingEditor.tsx:104
console.error('Failed to save branding:', err);

// useDashboardData.ts:46
console.error('Failed to load packages:', error);

// StripeConnectCard.tsx:55
console.error('Failed to check Stripe status:', err);
```

## Proposed Solutions

### Solution 1: Create/Import Frontend Logger (Recommended)

**Pros:** Consistent with backend pattern, enables error tracking
**Cons:** Need to create logger if doesn't exist
**Effort:** Medium (2 hours for all 24 instances)
**Risk:** Low

```typescript
// client/src/lib/logger.ts
import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  error?: Error | unknown;
  component?: string;
  tenantId?: string;
  [key: string]: unknown;
}

const logger = {
  error: (message: string, context?: LogContext) => {
    if (config.isDev) {
      console.error(message, context);
    }
    // In production, send to error tracking service (Sentry, etc.)
  },
  // ... other levels
};

export { logger };
```

### Solution 2: ESLint Rule + Batch Replace

**Pros:** Prevents future violations
**Cons:** Still need to do the replacement
**Effort:** Medium
**Risk:** Low

Add ESLint rule: `"no-console": ["error", { allow: [] }]`

## Recommended Action

Implement both solutions: Create logger, replace all instances, add ESLint rule.

## Technical Details

**Affected files:** 24 instances across tenant-admin features

## Acceptance Criteria

- [ ] Frontend logger created at `client/src/lib/logger.ts`
- [ ] All 24 console.error instances replaced
- [ ] ESLint rule added to prevent future violations
- [ ] Logger includes tenant context when available
- [ ] Dev mode shows console output, prod sends to tracking

## Work Log

| Date       | Action                   | Learnings                |
| ---------- | ------------------------ | ------------------------ |
| 2025-11-30 | Created from code review | Logging violations found |

## Resources

- CLAUDE.md Rule 4: "Use logger, never console.log"
