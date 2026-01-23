---
status: complete
priority: p1
issue_id: '659'
tags:
  - code-review
  - security
  - data-integrity
  - storefront-section-ids
dependencies: []
---

# TOCTOU Race Condition in Section ID Uniqueness Check

## Problem Statement

The `update_page_section` executor performs a read-then-write without transaction isolation. Two concurrent requests for the same tenant could both pass the uniqueness check against stale data, resulting in duplicate section IDs.

**Why it matters:** Duplicate section IDs break the stable-reference contract and could cause the agent to target the wrong section during edits. This is a data integrity issue that could lead to customer data corruption.

## Findings

**Location:** `server/src/agent/executors/storefront-executors.ts` lines 82-140

**Current Pattern:**

```typescript
// Line 82: READ draft config
const { pages, slug } = await getDraftConfigWithSlug(prisma, tenantId);

// Lines 94-113: CHECK uniqueness in memory (stale data)
if (incomingId) {
  for (const [pName, pConfig] of Object.entries(pages)) {
    // ...validation against stale data
  }
}

// Line 140: WRITE updated config
await saveDraftConfig(prisma, tenantId, updatedPages as PagesConfig);
```

**Risk Scenario:**

1. Request A reads config with no `home-hero-main`
2. Request B reads config with no `home-hero-main` (same stale data)
3. Request A passes uniqueness check, writes `home-hero-main`
4. Request B passes uniqueness check (against stale snapshot), writes duplicate `home-hero-main`

## Proposed Solutions

### Option A: Advisory Lock Pattern (Recommended)

**Pros:** Follows established MAIS pattern (booking service uses this), proven effective
**Cons:** Adds lock contention, slight latency increase
**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
await prisma.$transaction(async (tx) => {
  // Acquire advisory lock on tenant's storefront edits
  const lockId = hashTenantStorefront(tenantId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);
  // ... validation and write within same transaction
});
```

### Option B: Database Constraint (Not Feasible)

**Pros:** Database-level enforcement, no code changes needed
**Cons:** Section IDs are in JSON field, can't add unique constraint
**Effort:** N/A
**Risk:** N/A

### Option C: Optimistic Locking with Version

**Pros:** No lock contention, scales better
**Cons:** Requires schema change (add version column), more complex retry logic
**Effort:** Large (1 day)
**Risk:** Medium

## Recommended Action

**Option A: Advisory Lock Pattern** - Follow established MAIS pattern from booking service. Wrap read-validate-write in `prisma.$transaction` with `pg_advisory_xact_lock`. Proven approach for preventing race conditions on JSON fields.

## Technical Details

**Affected Files:**

- `server/src/agent/executors/storefront-executors.ts` - update_page_section executor

**Testing:**

- Add integration test with concurrent section creation
- Verify lock prevents duplicate IDs under load

## Acceptance Criteria

- [x] Concurrent `update_page_section` calls cannot create duplicate IDs
- [x] Lock contention is acceptable (< 100ms added latency)
- [x] Integration test proves race condition is prevented
- [x] Error message when lock timeout occurs is helpful

## Work Log

| Date       | Action                   | Learnings                                                                         |
| ---------- | ------------------------ | --------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by security-sentinel and data-integrity-guardian agents                |
| 2026-01-08 | Approved for work        | Quality triage: Data integrity risk demands fix. Advisory lock is proven pattern. |
| 2026-01-08 | Implemented fix          | Added advisory lock pattern, integration tests pass (5/5). Latency within bounds. |

## Implementation Notes

**Files Modified:**

- `server/src/lib/advisory-locks.ts` - Added `hashTenantStorefront()` function
- `server/src/agent/tools/utils.ts` - Updated `getDraftConfigWithSlug()` to accept transaction client
- `server/src/agent/executors/storefront-executors.ts` - Wrapped `update_page_section` in transaction with advisory lock
- `server/src/agent/proposals/executor-registry.ts` - Added `clearAllExecutors()` for test isolation

**New Test File:**

- `server/test/integration/section-id-race-conditions.spec.ts` - 5 integration tests covering race condition prevention

**Pattern Used:**

```typescript
return await prisma.$transaction(
  async (tx) => {
    // Acquire advisory lock for this tenant's storefront edits
    const lockId = hashTenantStorefront(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Read, validate, and write within same transaction
    const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);
    // ... validation and write
  },
  {
    timeout: 5000,
    isolationLevel: 'ReadCommitted',
  }
);
```

## Resources

- Similar pattern: `server/src/services/booking.service.ts` (advisory locks for double-booking)
- ADR-013: Advisory Locks Pattern
