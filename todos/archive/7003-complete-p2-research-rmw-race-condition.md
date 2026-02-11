---
status: complete
priority: p2
issue_id: '7003'
tags: [code-review, data-integrity, race-condition, pr-45]
dependencies: []
---

# 7003: Research Service RMW Race Can Clobber Concurrent Discovery Facts

## Problem Statement

`ResearchService.storeResults()` performs a read-modify-write on `tenant.branding` JSON column: it reads the current branding, spreads the research data in, and writes back the entire object. If `DiscoveryService.storeFact()` writes to the same `branding` field concurrently, one write will clobber the other.

Similarly, `clearResearchTriggeredFlag()` has the same RMW pattern.

**Impact:** Medium. During onboarding, research runs async while the user is actively chatting and storing facts. The window is narrow (single-user flow), but data loss is possible — a stored fact could be silently reverted.

## Resolution

**Approach chosen: Optimistic retry with post-write verification** (variant of Option C without schema changes).

Could not use Option A (Prisma JSON path update) because:

- `tenant.branding` is a `Json` field in Prisma, not a typed model — Prisma does not support nested JSON path updates on raw `Json` fields
- `$executeRaw` with `jsonb_set` would require access to `PrismaClient`, which is `private` in `PrismaTenantRepository` and the task constraints prohibit modifying the repository

Could not use Option B (advisory lock) because:

- Same PrismaClient access constraint
- Advisory locks require `$queryRaw` or `$executeRaw`

**Implementation:**

1. Extracted inline RMW in `triggerAsync()` into new `storeResearchData()` private method
2. Both `storeResearchData()` and `clearResearchTriggeredFlag()` now follow the pattern:
   - Read tenant branding
   - Modify the target key
   - Write back
   - Re-read and verify the target key persisted
   - If clobbered (concurrent write overwrote), retry after 50ms delay
   - Max 2 retries (3 total attempts)
3. `clearResearchTriggeredFlag()` additionally verifies no real fact keys were lost
4. Exhausted retries log `logger.error` but do not throw (fire-and-forget context)

**File changed:** `server/src/services/research.service.ts`

## Technical Details

- **Affected files:** `server/src/services/research.service.ts` (only file modified)
- **Constants added:** `BRANDING_WRITE_MAX_RETRIES` (2), `BRANDING_WRITE_RETRY_DELAY_MS` (50)
- **Methods added:** `storeResearchData()`, `delay()`
- **Methods modified:** `clearResearchTriggeredFlag()` (added retry loop + verification)
- **Methods simplified:** `triggerAsync()` (delegates to `storeResearchData()`)

## Work Log

| Date       | Action                              | Learnings                                                                     |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review          | Found by Data Integrity Guardian + Performance Oracle agents                  |
| 2026-02-11 | Fixed with optimistic retry pattern | PrismaClient is private in repo — cannot use $executeRaw without arch changes |
