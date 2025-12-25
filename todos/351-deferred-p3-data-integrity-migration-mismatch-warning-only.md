---
status: deferred
priority: p3
issue_id: "351"
tags: [code-review, data-integrity, migration, database, wont-fix]
dependencies: []
---

# Data Integrity: Migration Mismatch Check Only Warns, Doesn't Fail

## Problem Statement

The migration `14_package_booking_type.sql` validation check between `Booking.bookingType` and `Package.bookingType` only raises a WARNING, allowing the migration to complete even when data inconsistency exists.

**Why it matters:** Existing bookings with mismatched `bookingType` will have undefined behavior in downstream business logic that assumes package and booking types align.

## Findings

**File:** `server/prisma/migrations/14_package_booking_type.sql:15-24`

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Booking" b
    INNER JOIN "Package" p ON b."packageId" = p.id
    WHERE b."bookingType" != p."bookingType"
  ) THEN
    RAISE WARNING 'Booking/Package bookingType mismatch detected';  -- Should be EXCEPTION
  END IF;
END $$;
```

**Agent:** data-integrity-guardian

## Proposed Solutions

### Option A: Change to EXCEPTION (Recommended for new deployments)
- **Pros:** Prevents silent data corruption, fails fast
- **Cons:** Requires manual remediation before migration succeeds
- **Effort:** Small
- **Risk:** Medium (may block deploys if data is inconsistent)

```sql
RAISE EXCEPTION 'Booking/Package bookingType mismatch detected - manual remediation required';
```

### Option B: Add remediation before check
- **Pros:** Auto-fixes the issue
- **Cons:** May not be the correct fix for all cases
- **Effort:** Medium
- **Risk:** Medium

### Option C: Document as known limitation
- **Pros:** No migration change
- **Cons:** Data inconsistency persists
- **Effort:** Small
- **Risk:** High

## Recommended Action

**DEFERRED** - Migration already applied to production. Best practice: Never modify applied migrations.

Option C (Document) selected. The migration has been applied and cannot be changed. Instead:
1. Document as known limitation in ops runbook
2. Add data audit query to check for mismatches during deploys
3. Apply stricter validation in next migration if needed

## Technical Details

- **Affected files:** `server/prisma/migrations/14_package_booking_type.sql`
- **Components:** Database migration, booking/package data model
- **Database changes:** Migration logic modification

## Acceptance Criteria

- [ ] Migration fails if mismatch exists OR
- [ ] Mismatch is documented with remediation runbook
- [ ] Data audit script available to check for mismatches

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | data-integrity-guardian agent finding |
| 2024-12-24 | Triaged: DEFERRED (P2→P3) | Never modify applied migrations; document instead |

## Resources

- Migration file: `server/prisma/migrations/14_package_booking_type.sql`
