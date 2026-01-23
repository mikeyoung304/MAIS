---
status: pending
priority: p1
issue_id: '5206'
tags: [code-review, session-bootstrap, testing, internal-agent-routes]
dependencies: []
---

# Test Coverage Only 15% - 17 Endpoints Untested

## Problem Statement

The internal-agent.routes.ts file implements 20 endpoints but only 3 are tested (bootstrap, complete-onboarding, store-discovery-fact). This is 15% coverage.

**Why it matters:** Untested endpoints could have bugs, security issues, or regressions without detection.

## Findings

**Location:** `server/test/routes/internal-agent-bootstrap.test.ts`

**Untested Endpoints:**

1. /services
2. /service-details
3. /availability
4. /business-info
5. /faq
6. /recommend
7. /create-booking (T3 security action!)
8. /storefront/structure
9. /storefront/section
10. /storefront/update-section
11. /storefront/add-section
12. /storefront/remove-section
13. /storefront/reorder-sections
14. /storefront/toggle-page
15. /storefront/update-branding
16. /storefront/preview
17. /storefront/publish
18. /storefront/discard
19. /research/search-competitors
20. /research/scrape-competitor

**Critical Gap:** `/create-booking` is a T3 action that creates payments - completely untested.

**Reviewer:** Test Coverage Review (TC-001)

## Proposed Solutions

### Option A: Prioritized Test Addition (Recommended)

**Pros:** Focused effort on highest risk
**Cons:** Still leaves gaps
**Effort:** Medium
**Risk:** Low

Priority order:

1. /create-booking (T3 security)
2. /storefront/publish, /storefront/discard (T3 actions)
3. All storefront mutation endpoints
4. Read endpoints

### Option B: Full Coverage Sprint

**Pros:** Complete coverage
**Cons:** Large effort, may delay ship
**Effort:** Large
**Risk:** Low

### Option C: Defer to Follow-Up PR

**Pros:** Ships feature faster
**Cons:** Technical debt
**Effort:** Small now, Large later
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/routes/internal-agent-bootstrap.test.ts`
- New file: `server/test/routes/internal-agent-storefront.test.ts`
- New file: `server/test/routes/internal-agent-booking.test.ts`

## Acceptance Criteria

- [ ] /create-booking endpoint has unit tests
- [ ] /storefront/publish and /storefront/discard have unit tests
- [ ] Test coverage above 50% for internal-agent.routes.ts
- [ ] All T3 actions have test coverage

## Work Log

| Date       | Action                         | Learnings                                 |
| ---------- | ------------------------------ | ----------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Test Coverage reviewer found 15% coverage |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Test Coverage Reviewer
- Existing tests: server/test/routes/internal-agent-bootstrap.test.ts
