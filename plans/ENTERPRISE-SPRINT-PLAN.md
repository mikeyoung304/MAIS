# Enterprise Sprint Plan

> **PARTIALLY SUPERSEDED (2026-02-05):** Sprint 1 (Optimistic Locking for Drafts) was completed. However, the `landingPageConfigDraftVersion` field mentioned below was part of the legacy draft system that has since been replaced by the `SectionContent` table in the Phase 5 Section Content Migration (February 2, 2026). The `storefront-executors.ts` file referenced below no longer exists.

**Created:** 2026-01-21
**Last Updated:** 2026-02-05 (status update)
**Triage By:** DHH Rails Reviewer, Kieran TypeScript Reviewer, Code Simplicity Reviewer
**Focus:** Enterprise quality and stability

---

## Executive Summary

After triage of 31 deferred todos, we identified:

- **15 archived** (complete, wontfix, premature optimization, or merged)
- **1 P1** (true enterprise blocker)
- **2 P2** (important for scale)
- **13 P3-P4** (acceptable tech debt, fix opportunistically)

---

## Sprint 1: Data Integrity ✅ COMPLETE

### P1: #620 - Optimistic Locking for Drafts ✅

**Status:** Merged to main (51bb2323) on 2026-01-21
**Effort:** ~3 hours actual
**Risk Mitigated:** User data loss (silent overwrites in multi-tab editing)

**Implementation Completed:**

1. ✅ Schema migration: `landingPageConfigDraftVersion Int @default(0)`
2. ✅ Backend: 5 executors use `updateMany` with version check, 2 reset to 0
3. ✅ Frontend: `useDraftConfig` tracks version, `ConflictDialog` for conflicts
4. ✅ Tests: 4 new unit tests + 30 existing tests updated

**Files Changed:**

- `server/prisma/schema.prisma` - Version field
- `server/src/agent/executors/storefront-executors.ts` - Version checking
- `apps/web/src/components/build-mode/ConflictDialog.tsx` - Conflict UI
- `apps/web/src/hooks/useDraftConfig.ts` - Version tracking
- `packages/contracts/src/tenant-admin/landing-page.contract.ts` - API contract

**Why P1:** All three reviewers agreed - this was the ONLY scenario where users could lose their actual work.

---

## Sprint 2: Resilience at Scale (When Needed)

### P2: #5193 - Circuit Breaker for Specialist Agents

**File:** `todos/5193-deferred-p2-no-circuit-breaker.md`
**Effort:** 2-3 days
**Risk:** Cascading slowness when specialist agent is down

**When to implement:** Before heavy agent usage or after first production incident.

### P2: #525 - Rate Limiter Persistence (merged with #574)

**File:** `todos/525-deferred-p1-rate-limiter-state-not-persisted.md`
**Effort:** 2-3 days
**Risk:** Rate limits ineffective in multi-instance deployment

**When to implement:** Before horizontal scaling (moving from single instance).

---

## Acceptable Tech Debt (Fix Opportunistically)

These items are correctly deferred. Fix when touching related code:

| ID  | Issue                        | Trigger to Fix                  |
| --- | ---------------------------- | ------------------------------- |
| 527 | Prompt injection scope       | Adding new orchestrators        |
| 536 | Circuit breaker bypass       | Scaling horizontally            |
| 540 | Hardcoded Anthropic client   | Writing agent integration tests |
| 548 | Error message inconsistency  | Internationalization work       |
| 549 | CustomerToolContext type gap | Adding new customer tools       |
| 561 | Base orchestrator too large  | Major agent feature addition    |
| 573 | RLS missing on new tables    | Enterprise deployment prep      |
| 576 | Direct Prisma in routes      | Modifying those routes          |

---

## Feature Requests (Not Tech Debt)

Moved to P3, ship when customers ask:

| ID  | Feature                                         |
| --- | ----------------------------------------------- |
| 567 | Customer self-service tools (reschedule/cancel) |
| 676 | Build mode UX enhancements                      |

---

## Archived Items (2026-01-21)

Moved to `todos/archived-2026-01-21/`:

| ID  | Reason                                          |
| --- | ----------------------------------------------- |
| 012 | wontfix - archive naming cosmetic               |
| 140 | premature optimization - 20-50 packages is fine |
| 160 | premature optimization - batch email            |
| 220 | wontfix - no Storybook infrastructure           |
| 226 | complete - no analytics infrastructure          |
| 242 | merged into 620                                 |
| 281 | complete - feature request                      |
| 282 | complete - feature request                      |
| 283 | complete - feature request                      |
| 285 | complete - feature request                      |
| 286 | complete - feature request                      |
| 351 | applied migration, cannot change                |
| 535 | merged into 567                                 |
| 574 | merged into 525                                 |
| 579 | premature optimization - small audit logs       |

---

## Remaining Deferred Count

**Before triage:** 31 items
**After triage:** 16 items (1 active P1, 15 deferred)

---

## Next Action

Start #620 (Optimistic Locking) implementation:

```bash
# Suggested prompt for next session:
Implement #620 - Optimistic locking for landing page drafts.
Read: todos/620-active-p1-optimistic-locking-drafts.md
This is the P1 enterprise blocker identified by triage.
```

---

## Philosophy Applied

> "You don't have 31 problems. You have 5. And really, you have 1 that matters right now." - DHH Reviewer

> "The security items are defense-in-depth, not primary controls. The real blocker is data integrity." - Kieran Reviewer

> "Most items were correctly deferred. The codebase is healthier than the todo count suggests." - Simplicity Reviewer
