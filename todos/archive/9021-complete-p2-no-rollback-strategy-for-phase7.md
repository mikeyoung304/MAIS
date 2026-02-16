---
status: pending
priority: p2
issue_id: 9021
tags: [code-review, migration, operations]
dependencies: []
---

# No Rollback Strategy for Phase 7 Destructive Migration

## Problem Statement

Phase 7 drops the Package table, PackageAddOn table, and Booking.packageId column in a single transaction. If any issue is discovered after the migration commits, there is no rollback path — the data is gone.

The plan mentions "Backup production DB before migration" and "Test on staging first" but provides no explicit rollback script.

## Findings

- Data Integrity Guardian P2-7: "No rollback strategy for the Phase 7 breaking migration"

## Proposed Solutions

### Option A: Create backup tables before drop (Recommended)

```sql
CREATE TABLE "Package_backup" AS SELECT * FROM "Package";
CREATE TABLE "PackageAddOn_backup" AS SELECT * FROM "PackageAddOn";
ALTER TABLE "Booking" ADD COLUMN "packageId_backup" TEXT;
UPDATE "Booking" SET "packageId_backup" = "packageId";
```

- Keep for 30 days. Add Phase 10 todo: "Drop backup tables after 30-day soak."
- **Effort:** Small

### Option B: Keep Package table as archived (renamed)

- Rename to `Package_archived` instead of dropping
- **Effort:** Tiny but leaves table clutter

## Acceptance Criteria

- [ ] Backup tables created before Phase 7 destructive operations
- [ ] Rollback SQL documented in migration directory
- [ ] 30-day soak period before backup cleanup

## Work Log

| Date       | Action            | Learnings                                           |
| ---------- | ----------------- | --------------------------------------------------- |
| 2026-02-12 | Operations review | Destructive migrations need explicit rollback paths |
