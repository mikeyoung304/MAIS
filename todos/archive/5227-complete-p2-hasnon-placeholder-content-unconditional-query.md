---
status: pending
priority: p2
issue_id: '5227'
tags: [code-review, performance, backend]
dependencies: ['5225']
---

# P2: hasNonPlaceholderContent() runs unconditionally — should be lazy

## Problem Statement

`hasNonPlaceholderContent()` (a `prisma.package.count()` query) runs in all 3 methods (`build()`, `getBootstrapData()`, `getOnboardingState()`) before `resolveOnboardingPhase()` is called. The query is only needed when steps 1 and 2 of the waterfall fail. After lazy backfill completes (todo #5225), the count query will be unnecessary for every existing tenant.

Additionally, the Package table lacks a covering index on `[tenantId, basePrice]` — PostgreSQL uses the `[tenantId]` index and then does a sequential filter on `basePrice > 0`.

## Findings

- **Performance Oracle (P2):** Unconditional query + missing index
- **Architecture Strategist (P2):** Suggested passing `() => Promise<boolean>` thunk for lazy evaluation
- **Code Simplicity (P2):** Part of the 4-line block repeated 3 times

## Proposed Solutions

### Option A: Lazy thunk + extract method (Recommended)

Extract a `resolveAndBackfillPhase(tenantId, tenant)` method that internally calls `hasNonPlaceholderContent()` only when steps 1-2 fail. Return `{ effectivePhase, onboardingDone }`.

- **Pros:** Eliminates unnecessary queries AND deduplicates the 4-line block
- **Cons:** Slightly more complex control flow
- **Effort:** Small-Medium
- **Risk:** Low

### Option B: Add covering index only

Add `@@index([tenantId, basePrice])` to Package model. Keep query unconditional.

- **Pros:** Faster query execution
- **Cons:** Still runs unnecessary queries
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/services/context-builder.service.ts` (lines 267-272, 389-394, 454-459)
- **Index:** Package model in `schema.prisma`
- **Depends on:** #5225 (waterfall dead code fix) should land first

## Acceptance Criteria

- [ ] `hasNonPlaceholderContent()` only called when waterfall steps 1-2 fail
- [ ] All 3 methods use the extracted helper
- [ ] Covering index added to Package model
- [ ] Typecheck passes

## Work Log

| Date       | Action                                      | Learnings                                                 |
| ---------- | ------------------------------------------- | --------------------------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | Unconditional queries before branching logic = wasted I/O |

## Resources

- Commit: 8c091544
