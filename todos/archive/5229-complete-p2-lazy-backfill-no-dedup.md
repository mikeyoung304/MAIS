---
status: pending
priority: p2
issue_id: '5229'
tags: [code-review, performance, backend]
dependencies: ['5225']
---

# P2: lazyBackfillPhase fire-and-forget without deduplication

## Problem Statement

Every request for a tenant where `effectivePhase === 'COMPLETED' && !hasExplicitPhase` fires an UPDATE. If the backfill succeeds on the first request, subsequent requests still pass the same condition because they read the old `tenant.onboardingPhase` value. The UPDATE is idempotent (same values), but generates unnecessary DB writes — potentially 3-5 redundant UPDATEs per tenant before the next read picks up the backfilled value.

## Findings

- **Performance Oracle (P2):** Redundant writes, suggested module-scoped Set with TTL
- **Security Sentinel (P3):** Confirmed idempotent, no data corruption risk
- **Architecture Strategist (P3):** Correctly assessed as acceptable tradeoff

## Proposed Solutions

### Option A: Module-scoped dedup Set (Recommended)

Add a `Set<string>` at module scope tracking recently-backfilled tenantIds. Clear entries after 5 minutes or cap at 1000 entries (per Pitfall #46).

- **Pros:** Eliminates redundant writes within same server instance
- **Cons:** Adds state to the service module
- **Effort:** Small
- **Risk:** Low — worst case is a missed dedup, which just means one extra idempotent write

### Option B: Conditional UPDATE with WHERE guard

Use `WHERE onboardingPhase = 'NOT_STARTED'` in the UPDATE query so the DB itself skips redundant writes.

- **Pros:** DB-level dedup, no application state needed
- **Cons:** Requires raw SQL or Prisma updateMany with where filter
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/services/context-builder.service.ts:525-540`
- **Pitfall:** #46 (module-level cache unbounded)

## Acceptance Criteria

- [ ] Redundant UPDATE calls eliminated for same tenant within process lifetime
- [ ] Dedup mechanism has bounded memory (TTL or max-size)
- [ ] Backfill still fires correctly for first occurrence

## Work Log

| Date       | Action                                      | Learnings                                                    |
| ---------- | ------------------------------------------- | ------------------------------------------------------------ |
| 2026-02-07 | Created from code review of commit 8c091544 | Idempotent writes are safe but wasteful — dedup at app level |

## Resources

- Commit: 8c091544
- CLAUDE.md Pitfall #46
