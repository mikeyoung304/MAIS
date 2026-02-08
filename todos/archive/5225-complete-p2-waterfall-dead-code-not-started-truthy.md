---
status: complete
priority: p2
issue_id: '5225'
tags: [code-review, data-integrity, backend]
dependencies: []
---

# P2: Waterfall heuristic dead code — NOT_STARTED is truthy

## Problem Statement

In `server/src/services/context-builder.service.ts:492-498`, the `resolveOnboardingPhase` waterfall checks `if (tenant.onboardingPhase)` at branch 1. The schema defines `onboardingPhase` as `NOT NULL DEFAULT 'NOT_STARTED'` (`schema.prisma:118`). Every tenant — including pre-rebuild ones — has `'NOT_STARTED'` (truthy), so branches 2–4 (including the `hasRealContent` fallback at branch 3) are dead code.

**Impact:** Pre-rebuild tenants with real content are treated as "not onboarded" and may be shown the onboarding flow again. The `lazyBackfillPhase` at line 530 also never fires because `effectivePhase` is `NOT_STARTED`, not `COMPLETED`.

## Findings

- **Data Integrity Guardian (P2):** Identified that NOT NULL DEFAULT makes branches 2-4 unreachable
- **Architecture Strategist:** Confirmed waterfall order is load-bearing but step 1 short-circuits incorrectly

## Proposed Solutions

### Option A: Check for meaningful phase (Recommended)

Change `if (tenant.onboardingPhase)` to `if (tenant.onboardingPhase && tenant.onboardingPhase !== 'NOT_STARTED')`.

- **Pros:** Minimal change, lets branches 2-4 fire for pre-rebuild tenants
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low — `NOT_STARTED` is the default, so excluding it preserves the original intent

### Option B: Check for non-default phase

Use `if (tenant.onboardingPhase !== 'NOT_STARTED')` — treats NOT_STARTED the same as null.

- **Pros:** Cleaner, single condition
- **Cons:** Slightly different semantics if schema ever allows null again
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/services/context-builder.service.ts:492-498`
- **Schema:** `schema.prisma:118` — `onboardingPhase String? @default("NOT_STARTED")`

## Acceptance Criteria

- [ ] Pre-rebuild tenants with real content ($>0 packages) resolve to `COMPLETED`
- [ ] `lazyBackfillPhase` fires for those tenants, writing `COMPLETED` to DB
- [ ] Tenants with explicit non-NOT_STARTED phases still short-circuit at branch 1
- [ ] New tenants still get `NOT_STARTED` by default

## Work Log

| Date       | Action                                                                             | Learnings                                                                |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-02-07 | Created from code review of commit 8c091544                                        | NOT NULL DEFAULT creates truthy values that bypass null-check waterfalls |
| 2026-02-08 | Fixed: condition excludes NOT_STARTED so branches 2-4 fire for pre-rebuild tenants | Option A chosen for safety                                               |

## Resources

- Commit: 8c091544
