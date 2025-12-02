---
status: complete
priority: p2
issue_id: "053"
tags: [code-review, scheduling, performance, database]
dependencies: []
---

# getNextAvailableSlot() Makes 30x Redundant Database Queries

## Problem Statement

The `getNextAvailableSlot()` method loops up to 30 times (days), each iteration fetching the same service and availability rules. This causes 90+ database queries for a single "find next slot" request.

**Why this matters:** 2-5 second response times for finding next available slot, poor user experience.

## Findings

### Code Evidence

**Location:** `server/src/services/booking.service.ts:483-510`

```typescript
async getNextAvailableSlot(
  tenantId: string,
  serviceId: string,
  fromDate: Date,
  maxDaysAhead: number = 30
): Promise<TimeSlot | null> {
  for (let i = 0; i < maxDaysAhead; i++) {
    const slots = await this.getAvailableSlots({  // Each iteration queries:
      tenantId,                                    // 1. Service (same every time!)
      serviceId,                                   // 2. Rules (same every time!)
      date: checkDate,                             // 3. Bookings (different)
    });
    // ...
  }
}
```

### Query Breakdown

Per iteration:
- 1× Service lookup (SAME service, should cache)
- 1× Rules lookup (SAME rules, should cache)
- 1× Bookings lookup (different date, necessary)

30-day search = 90 queries (vs optimal 32 queries)

## Proposed Solutions

### Option A: Cache Service & Rules Within Loop (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
async getNextAvailableSlot(...) {
  // Fetch once
  const service = await this.serviceRepo.getById(tenantId, serviceId);
  const rules = await this.availabilityRuleRepo.getEffectiveRules(tenantId, new Date(), serviceId);

  for (let i = 0; i < maxDaysAhead; i++) {
    // Use cached service/rules, only query bookings
    const slots = await this.generateSlotsForDate(service, rules, checkDate);
  }
}
```

### Option B: Batch Date Range Query
**Effort:** Medium | **Risk:** Low

Fetch all bookings for date range in one query:

```typescript
const allBookings = await this.bookingRepo.findByDateRange(
  tenantId,
  startDate,
  endDate // startDate + 30 days
);

// Generate slots in memory using cached bookings
```

## Recommended Action

Implement **Option A** first (quick win), then **Option B** for full optimization.

## Technical Details

**Files to Update:**
- `server/src/services/booking.service.ts:483-510`
- `server/src/services/scheduling-availability.service.ts` - Add method for cached slot generation

## Acceptance Criteria

- [ ] Service and rules fetched once per getNextAvailableSlot() call
- [ ] Query count reduced from 90 to ~32 for 30-day search
- [ ] Response time < 500ms for finding next slot

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Performance Oracle review |
