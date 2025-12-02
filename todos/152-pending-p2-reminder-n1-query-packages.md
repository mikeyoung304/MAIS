---
status: pending
priority: p2
issue_id: "152"
tags: [code-review, performance, mvp-gaps, reminders]
dependencies: []
---

# N+1 Query in Reminder Processing

## Problem Statement

The `processOverdueReminders` method iterates through bookings and makes individual queries for package details, causing N+1 query performance issues.

**Why This Matters:**
- 10 reminders = 11 database queries
- Dashboard load blocks on sequential processing
- Performance degrades linearly with reminder count

## Findings

### Agent: performance-oracle

**Location:** `server/src/services/reminder.service.ts:86-99`

**Evidence:**
```typescript
for (const booking of bookingsToRemind) {
  await this.sendReminderForBooking(tenantId, booking);  // Line 88
  // Inside sendReminderForBooking:
  const pkg = await this.catalogRepo.getPackageById(tenantId, booking.packageId); // Line 137
}
```

## Proposed Solutions

### Option A: Batch Fetch Packages (Recommended)
**Pros:** Single query for all packages
**Cons:** Requires new repository method
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
const packageIds = bookingsToRemind.map(b => b.packageId);
const packages = await this.catalogRepo.getPackagesByIds(tenantId, packageIds);
const packageMap = new Map(packages.map(p => [p.id, p]));

for (const booking of bookingsToRemind) {
  const pkg = packageMap.get(booking.packageId);
  await this.sendReminderForBooking(tenantId, booking, pkg);
}
```

## Technical Details

**Affected Files:**
- `server/src/services/reminder.service.ts`
- `server/src/lib/ports.ts` (add getPackagesByIds)
- `server/src/adapters/prisma/catalog.repository.ts`

## Acceptance Criteria

- [ ] getPackagesByIds added to CatalogRepository
- [ ] Reminder processing batch-fetches packages
- [ ] Query count reduced from N+1 to 2
