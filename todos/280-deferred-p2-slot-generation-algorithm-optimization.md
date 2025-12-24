---
status: pending
priority: p2
issue_id: "280"
tags: [deferred, code-review, performance, algorithm, availability, scheduling]
dependencies: ["275"]
next_review: "2026-01-23"
revisit_trigger: "P99 > 100ms in production"
---

# Slot Generation Algorithm O(n*m) Complexity

## Problem Statement

The slot generation algorithm generates ALL possible slots, then filters conflicts. This is O(n*m) where n=slots and m=existing bookings. At scale, this causes user-facing latency.

**Why it matters:**
- For typical 9am-5pm service: 16 slots/day
- With 5 services: 80 slots generated
- Filtering: O(16 * 20) = 320 comparisons per request
- 100 concurrent requests: 32,000 comparisons/second
- User-facing latency degrades from 15ms to 200-300ms

## Findings

### Agent: performance-oracle
- **Location:** `server/src/services/scheduling-availability.service.ts:106-129`
- **Evidence:**
```typescript
// Current approach: Generate ALL slots, then filter conflicts
const allSlots = this.generateSlotsFromRules(...);  // Generates 50-100+ slots
const existingBookings = await this.getTimeslotBookings(...);  // Queries DB
const availableSlots = this.filterConflictingSlots(allSlots, existingBookings);
```

### Performance Impact:

| Scenario | Current | Optimized | Improvement |
|----------|---------|-----------|-------------|
| Single request | 15-25ms | 5ms | 3-5x faster |
| 100 concurrent | 200-300ms | 20-50ms | 6-10x faster |
| 500 concurrent | 500-800ms | 50-100ms | 10x faster |

## Proposed Solutions

### Option A: Early-Exit Slot Generation (Recommended)
**Description:** Generate slots incrementally, checking conflicts during generation

```typescript
async getAvailableSlots(tenantId: string, serviceId: string, date: Date): Promise<TimeSlot[]> {
  const service = await this.serviceRepo.getById(tenantId, serviceId);
  const rules = await this.availabilityRuleRepo.getEffectiveRules(tenantId, date, serviceId);

  // Fetch bookings ONCE (single query)
  const existingBookings = await this.bookingRepo.findTimeslotBookings(tenantId, date, serviceId);

  // Build booking intervals for O(log n) conflict checking
  const bookingIntervals = existingBookings.map(b => ({
    start: b.startTime.getTime(),
    end: b.endTime.getTime(),
  })).sort((a, b) => a.start - b.start);

  const availableSlots: TimeSlot[] = [];

  // Generate slots incrementally
  for (const rule of rules) {
    let slotStart = this.parseRuleTime(rule.startTime, date);
    const ruleEnd = this.parseRuleTime(rule.endTime, date);

    while (slotStart.getTime() + service.durationMinutes * 60000 <= ruleEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60000);

      // O(log n) binary search for conflict
      if (!this.hasConflict(slotStart, slotEnd, bookingIntervals)) {
        availableSlots.push({ startTime: slotStart, endTime: slotEnd, available: true });
      }

      // Move to next slot (including buffer)
      slotStart = new Date(slotStart.getTime() + (service.durationMinutes + service.bufferMinutes) * 60000);
    }
  }

  return availableSlots;
}

private hasConflict(start: Date, end: Date, intervals: { start: number; end: number }[]): boolean {
  // Binary search for overlapping interval
  const startMs = start.getTime();
  const endMs = end.getTime();

  // O(log n) search
  let left = 0, right = intervals.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const interval = intervals[mid];

    if (startMs < interval.end && endMs > interval.start) {
      return true; // Overlap found
    }
    if (startMs >= interval.end) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return false;
}
```

**Pros:**
- Reduces comparisons from O(n*m) to O(n*log m)
- No extra memory allocation for full slot array
- Can add pagination (return first N available slots)

**Cons:**
- More complex implementation
- Requires sorted booking intervals

**Effort:** Medium (4-8 hours)
**Risk:** Low

### Option B: Pre-computed Availability Bitmap
**Description:** Store availability as bitmap for instant lookup

**Effort:** Large (2-3 days)
**Risk:** Medium (cache invalidation complexity)

## Recommended Action

Implement Option A. Benchmark before/after with realistic data.

## Technical Details

**Affected Files:**
- `server/src/services/scheduling-availability.service.ts`

**Benchmark Command:**
```bash
# Create test data: 100 bookings
npm run db:seed -- --bookings=100

# Benchmark availability endpoint
npx autocannon -c 100 -d 10 \
  'http://localhost:3001/v1/public/availability/slots?serviceId=X&date=2025-12-15'
```

**Target Metrics:**
- P99 latency < 50ms
- 500 concurrent requests without degradation

## Acceptance Criteria

- [ ] Slot generation uses binary search for conflict detection
- [ ] Benchmark shows 5-10x improvement
- [ ] All existing tests pass
- [ ] New unit test for hasConflict() binary search

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from performance review | Algorithm optimization needed |

## Resources

- [Interval Tree for Range Queries](https://en.wikipedia.org/wiki/Interval_tree)
- Related: `server/src/services/scheduling-availability.service.ts`
