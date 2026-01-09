---
status: pending
priority: p2
issue_id: '692'
tags: [code-review, agent-first-architecture, testing, migration-debt, playwright]
dependencies: []
---

# P2: Playwright Config Points to Deprecated Vite Port (5173)

## Problem Statement

The Playwright E2E test configuration still expects the Vite development server on port 5173, but the project migrated to Next.js which runs on port 3000. This causes all E2E tests to fail with:

```
Error: Timed out waiting 120000ms from config.webServer.
```

**Root Cause:** The Vite to Next.js migration (documented in ADR-014) was completed, but Playwright configuration was not updated.

**Why This Matters:**

- E2E tests cannot run at all
- CI/CD pipeline is effectively broken for E2E testing
- The `agent-ui-control.spec.ts` tests for Phase 5 are blocked
- This was noted as Priority 2 documentation gap in `nextjs-migration-lessons-learned-MAIS-20251225.md`

## Findings

**Agent:** Code Review (Session Context)

**Location:** `e2e/playwright.config.ts`

**Current Config (lines 73-80):**

```typescript
webServer: {
  command: 'ADAPTERS_PRESET=real E2E_TEST=1 VITE_API_URL=http://localhost:3001 VITE_APP_MODE=mock VITE_E2E=1 VITE_TENANT_API_KEY=pk_live_handled-e2e_0000000000000000 npm run dev:e2e',
  cwd: '..',
  url: 'http://localhost:5173',  // ← WRONG - Vite port
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

**Also affected (line 39):**

```typescript
baseURL: 'http://localhost:5173',  // ← WRONG - Vite port
```

## Proposed Solutions

### Option A: Update ports to Next.js (Recommended)

```typescript
// e2e/playwright.config.ts
use: {
  baseURL: 'http://localhost:3000',  // Next.js port
  // ...
},

webServer: {
  command: 'npm run dev:e2e',  // Uses dev:all which starts Next.js
  cwd: '..',
  url: 'http://localhost:3000',  // Next.js port
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

- **Pros:** Simple fix, aligns with current architecture
- **Cons:** May need to update some test selectors if they relied on Vite-specific behavior
- **Effort:** Small
- **Risk:** Low

### Option B: Also clean up Vite environment variables

Remove the `VITE_*` prefixed env vars since Next.js uses `NEXT_PUBLIC_*`:

```typescript
webServer: {
  command: 'E2E_TEST=1 npm run dev:e2e',
  // ...
},
```

- **Pros:** Cleaner config, removes dead env vars
- **Cons:** Need to verify no code depends on VITE\_\* vars
- **Effort:** Small-Medium
- **Risk:** Low

### Option C: Full E2E testing audit

- Update Playwright config
- Audit all test files for Vite-specific patterns
- Create Next.js E2E Testing Guide (noted as gap in migration lessons)
- **Pros:** Comprehensive fix
- **Cons:** Larger scope
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**Option A** - Quick port fix to unblock E2E tests. Then Option C as follow-up.

## Technical Details

**Affected Files:**

- `e2e/playwright.config.ts` - Port configuration
- `e2e/tests/*.spec.ts` - May need baseURL adjustments

**Related Documentation:**

- `docs/adrs/ADR-014-nextjs-app-router-migration.md` - Migration decision
- `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md` - Noted E2E guide as gap (line 345-346)

## Acceptance Criteria

- [ ] Playwright config uses port 3000 (Next.js)
- [ ] `npm run test:e2e` starts successfully
- [ ] `agent-ui-control.spec.ts` tests can run
- [ ] CI pipeline E2E tests pass

## Work Log

| Date       | Action                                        | Outcome                    |
| ---------- | --------------------------------------------- | -------------------------- |
| 2026-01-09 | Discovered during code review E2E testing     | Config mismatch identified |
| 2026-01-09 | Found root cause: Vite→Next.js migration debt | Created this todo          |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- Migration Lessons: `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`
- ADR: `docs/adrs/ADR-014-nextjs-app-router-migration.md`
