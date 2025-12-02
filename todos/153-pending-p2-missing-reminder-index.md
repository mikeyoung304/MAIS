---
status: pending
priority: p2
issue_id: "153"
tags: [code-review, performance, mvp-gaps, database]
dependencies: []
---

# Missing Database Index for Reminder Queries

## Problem Statement

The `findBookingsNeedingReminders` query filters by `reminderDueDate` and `reminderSentAt` but there's no composite index for these fields, causing full table scans.

**Why This Matters:**
- Query performance degrades with booking count
- At 10,000 CONFIRMED bookings: full table scan after tenant filter

## Findings

### Agent: performance-oracle

**Location:** `server/prisma/schema.prisma:322-345`

**Evidence:**
```sql
WHERE tenantId = ? AND reminderDueDate <= ? AND reminderSentAt IS NULL AND status = 'CONFIRMED'
```

**Current Indexes:**
- `@@index([tenantId, status])` ✅
- `@@index([tenantId, status, date])` ✅
- **MISSING**: `[tenantId, reminderDueDate, reminderSentAt, status]`

## Proposed Solutions

### Option A: Add Composite Index (Recommended)
**Pros:** Optimal query performance
**Cons:** Slight write overhead
**Effort:** Small (1 hour)
**Risk:** Low

```prisma
@@index([tenantId, reminderDueDate, reminderSentAt, status])
```

## Technical Details

**Affected Files:**
- `server/prisma/schema.prisma`

## Acceptance Criteria

- [ ] Index added to schema
- [ ] Migration created and applied
- [ ] Query plan shows index usage
