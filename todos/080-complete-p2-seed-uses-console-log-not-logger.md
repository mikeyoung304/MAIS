---
status: complete
priority: p2
issue_id: "080"
tags: [quality, code-review, logging, consistency]
dependencies: []
---

# P2: Seed Files Use console.log Instead of Logger

## Problem Statement

All seed files use `console.log` instead of the codebase's structured logger. This violates the established "no console.log" rule and makes seed output hard to parse in CI/CD.

**Why it matters:**
- Violates CLAUDE.md rule: "Use `logger`, never `console.log`"
- No structured logging for log aggregation (Sentry, Datadog)
- No log levels (info, warn, error)
- Cannot filter or search seed logs easily

## Findings

**Locations:** All seed files

```typescript
// seed.ts
console.log(`\n🌱 Running seed in "${mode}" mode\n`);
console.error('\n❌ Seed failed:', error);

// platform.ts
console.log(`✅ Platform admin created: ${admin.email}`);

// e2e.ts
console.log(`✅ E2E test tenant created: ${tenant.name}`);
console.log(`   Public Key: ${E2E_PUBLIC_KEY}`);

// demo.ts
console.log(`   Secret Key: ${demoSecretKey}`);
console.log(`   ⚠️  Save these keys - they change on each seed!`);
```

**Expected pattern:**
```typescript
import { logger } from '../src/lib/core/logger';

logger.info({ email: admin.email }, 'Platform admin created');
logger.warn({ tenantSlug: demoSlug }, 'Demo keys regenerated - update .env');
```

## Proposed Solutions

### Solution A: Replace all console.* with logger (Recommended)
**Pros:** Consistent with codebase, structured logging
**Cons:** Requires logger import in seed files
**Effort:** Small (30 min)
**Risk:** None

```typescript
import { logger } from '../src/lib/core/logger';

logger.info({ mode }, 'Running seed');
logger.info({ email: admin.email, role: admin.role }, 'Platform admin created');
```

### Solution B: Create seed-specific logger
**Pros:** Customized for seed output
**Cons:** Additional abstraction
**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// prisma/seeds/logger.ts
export const seedLogger = {
  success: (msg: string, meta?: object) => logger.info({ ...meta, emoji: '✅' }, msg),
  warn: (msg: string, meta?: object) => logger.warn({ ...meta, emoji: '⚠️' }, msg),
  error: (msg: string, meta?: object) => logger.error({ ...meta, emoji: '❌' }, msg),
};
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/prisma/seed.ts`
- `server/prisma/seeds/platform.ts`
- `server/prisma/seeds/e2e.ts`
- `server/prisma/seeds/demo.ts`

## Acceptance Criteria

- [ ] No `console.log` in seed files
- [ ] All seed output uses structured logger
- [ ] Seed logs visible in Sentry/log aggregation
- [ ] Log levels appropriate (info for success, warn for warnings, error for failures)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | Seed files should follow same standards as app code |

## Resources

- **Code Review:** Seed system refactoring review
- **Logger:** `server/src/lib/core/logger.ts`
- **Rule:** CLAUDE.md "Use `logger`, never `console.log`"
