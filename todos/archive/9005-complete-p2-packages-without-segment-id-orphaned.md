---
status: pending
priority: p2
issue_id: 9005
tags: [code-review, data-integrity, migration]
dependencies: [9003]
---

# Phase 7 Migration Silently Skips Packages Without segmentId

## Problem Statement

Phase 7's migration script filters `WHERE "segmentId" IS NOT NULL`. If production has Packages without a segmentId (the column IS nullable per schema), those packages' bookings won't get a tierId.

The abort guard then fires: `WHERE "packageId" IS NOT NULL AND "tierId" IS NULL` catches these bookings and aborts the entire migration.

**Why it matters:** If even one Package lacks a segmentId, the entire migration fails.

## Findings

### Evidence

- Schema `Package.segmentId` is `String?` (nullable) — line 367
- Migration script line 709: `WHERE "segmentId" IS NOT NULL`
- Abort guard line 758-762: counts bookings with packageId but no tierId

### Risk Assessment

Need to verify production data:

```sql
SELECT COUNT(*) FROM "Package" WHERE "segmentId" IS NULL;
SELECT COUNT(*) FROM "Booking" b
JOIN "Package" p ON b."packageId" = p.id
WHERE p."segmentId" IS NULL;
```

## Proposed Solutions

### Option A: Pre-migration check + assign default segment (Recommended)

- Before migration, check for orphaned packages
- Assign them to tenant's first active segment
- If no segment exists, create "General Services" default
- **Effort:** Small
- **Risk:** Low

### Option B: Allow orphaned bookings to keep null tierId

- Change Booking.tierId to remain nullable post-migration
- Skip abort guard for orphaned packages
- **Effort:** Small
- **Risk:** Medium — leaves data inconsistency

## Acceptance Criteria

- [ ] Migration handles packages with null segmentId
- [ ] Pre-migration verification query added
- [ ] No bookings orphaned by segmentId filter

## Work Log

| Date       | Action                        | Learnings                                                       |
| ---------- | ----------------------------- | --------------------------------------------------------------- |
| 2026-02-12 | Discovered during plan review | Nullable FK in source data + NOT NULL filter = silent data loss |
