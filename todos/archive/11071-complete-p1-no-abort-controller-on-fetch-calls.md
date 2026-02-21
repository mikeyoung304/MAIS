---
status: pending
priority: p1
issue_id: '11071'
tags: [code-review, frontend, react]
pr: 68
---

# No AbortController on Onboarding Fetch Calls (F-007)

## Problem Statement

None of the fetch() calls in onboarding pages use AbortController. In-flight requests on unmount call setState on stale/unmounted components. Poll closures can resolve out of order.

## Findings

- **Agents:** julik-frontend-races
- **Location:** `apps/web/src/app/onboarding/build/page.tsx:123-168,179-200`, `intake/page.tsx:49-76`, `payment/page.tsx:51-64`
- **Impact:** React warnings, incorrect state rendering, out-of-order updates

## Proposed Solution

Add AbortController to all fetch calls in effects. Create new AbortController per poll tick. Abort on cleanup.

## Effort

Medium (1-3 hours)

## Acceptance Criteria

- [ ] All fetch calls use AbortController
- [ ] Effects abort on cleanup
- [ ] Polling creates new controller per tick
- [ ] No React unmount warnings in console
