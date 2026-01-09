---
status: pending
priority: p2
issue_id: '693'
tags: [code-review, testing, migration-debt, playwright, nextjs]
dependencies: ['692']
---

# P2: E2E Auth Fixture Needs Next.js Migration Update

## Problem Statement

The E2E test auth fixture (`e2e/fixtures/auth.fixture.ts`) was designed for the Vite SPA client and needs updates to work with the Next.js app. Tests timeout waiting for signup API response even though:

- The API server is running and responding correctly to curl
- CORS is properly configured
- The Next.js signup page loads correctly

**Root Cause:** The E2E test infrastructure was not fully migrated when the project moved from Vite to Next.js. This was noted as a documentation gap in `nextjs-migration-lessons-learned-MAIS-20251225.md` (line 345-346).

## Findings

**Agent:** Session debugging

**Files Fixed So Far:**

1. ✅ `e2e/playwright.config.ts` - Port 5173 → 3000
2. ✅ `e2e/fixtures/auth.fixture.ts` - Removed `#confirmPassword` field
3. ✅ `e2e/global-teardown.ts` - Prisma 7 import path fix

**Remaining Issues:**

- Signup form submission doesn't trigger API request in Playwright browser
- `page.waitForResponse('/v1/auth/signup')` times out at 30s
- API responds correctly to direct curl requests
- CORS preflight passes

**Suspected Causes:**

1. JavaScript execution timing in Next.js vs Vite
2. Form validation blocking submission silently
3. Next.js server/client component boundary issues
4. Missing env vars in Playwright browser context

## Proposed Solutions

### Option A: Debug with headed browser and traces

- Run tests in headed mode to see what's happening
- Analyze Playwright traces in detail
- **Effort:** Small-Medium
- **Risk:** Low

### Option B: Create dedicated E2E test tenant

- Pre-create a test tenant in database
- Skip signup flow, test only dashboard features
- **Pros:** Unblocks testing of Phase 5 features
- **Cons:** Doesn't test signup flow
- **Effort:** Small
- **Risk:** Low

### Option C: Full E2E migration audit

- Audit all E2E tests for Next.js compatibility
- Update fixtures, helpers, and page objects
- Create Next.js E2E Testing Guide (noted as gap)
- **Pros:** Comprehensive fix
- **Cons:** Significant effort
- **Effort:** Large
- **Risk:** Low

## Recommended Action

**Option B** short-term to unblock Phase 5 testing, then **Option C** as follow-up sprint.

## Technical Details

**Affected Files:**

- `e2e/fixtures/auth.fixture.ts` - Auth flow
- `e2e/tests/agent-ui-control.spec.ts` - Uses auth fixture
- `e2e/playwright.config.ts` - Environment setup

**Related Issues:**

- #692 - Playwright config port mismatch (fixed)

## Acceptance Criteria

- [ ] E2E tests can run to completion
- [ ] Auth fixture successfully signs up or logs in
- [ ] Agent UI control tests pass
- [ ] Next.js E2E Testing Guide created

## Work Log

| Date       | Action                           | Outcome                    |
| ---------- | -------------------------------- | -------------------------- |
| 2026-01-09 | Fixed Playwright port config     | Still failing              |
| 2026-01-09 | Removed confirmPassword field    | Still failing              |
| 2026-01-09 | Fixed Prisma import path         | Still failing              |
| 2026-01-09 | Verified API works via curl      | Confirmed working          |
| 2026-01-09 | Verified CORS configuration      | Confirmed correct          |
| 2026-01-09 | Tests timeout on waitForResponse | Needs deeper investigation |

## Resources

- Migration Lessons: `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md`
- Session Context: `docs/sessions/2026-01-09-agent-first-phase-5-review-context.md`
- Playwright Traces: `test-results/*/trace.zip`
