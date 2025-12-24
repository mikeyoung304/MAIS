---
status: pending
priority: p2
issue_id: '282'
tags: [deferred, code-review, feature-gap, group-classes, capacity, acuity-parity]
dependencies: []
next_review: '2026-01-23'
revisit_trigger: '3 customer requests'
---

# Group Classes/Sessions Not Implemented (Acuity Parity)

## Problem Statement

Acuity supports group classes where multiple clients book the same timeslot up to a capacity limit. MAIS only supports 1:1 appointments. This is a significant gap for fitness instructors, workshop hosts, and educators.

**Why it matters:**

- Yoga instructors need 20-person classes
- Workshop hosts need group registration
- Music teachers offer group lessons
- Revenue per slot multiplied by capacity

## Findings

### Agent: architecture-strategist

- **Location:** `server/prisma/schema.prisma` (Service model)
- **Evidence:** No `capacity` field in Service model, no multi-booking per slot logic
- **Current:** Unique constraint prevents multiple bookings per timeslot
- **Needed:** Capacity tracking, waitlist support, group management

### Acuity Group Features:

- Set max capacity per class (e.g., 20 spots)
- Show remaining spots to customers
- Waitlist when full
- One-click class booking
- Group registration forms

## Proposed Solutions

### Option A: Capacity-Based Group Bookings (Recommended)

**Description:** Add capacity to Service model, track registered count per timeslot

**Schema Changes:**

```prisma
model Service {
  // Existing fields...

  // Group class fields
  isGroupClass   Boolean @default(false)
  capacity       Int?    // Max attendees per session
  waitlistLimit  Int?    // Max waitlist size

  // Group-specific settings
  showSpotsRemaining Boolean @default(true)
  allowWaitlist      Boolean @default(false)
}

model Booking {
  // Existing fields...

  // Group booking fields
  isWaitlisted Boolean @default(false)
  waitlistPosition Int?

  // Keep existing unique constraint for 1:1 services
  // Add conditional constraint for group classes
}
```

**Service Logic:**

```typescript
async checkGroupAvailability(
  tenantId: string,
  serviceId: string,
  startTime: Date
): Promise<{ available: boolean; spotsRemaining: number; waitlistPosition?: number }> {
  const service = await this.serviceRepo.getById(tenantId, serviceId);

  if (!service.isGroupClass || !service.capacity) {
    // Treat as 1:1 appointment
    const booked = await this.bookingRepo.findByStartTime(tenantId, serviceId, startTime);
    return { available: !booked, spotsRemaining: booked ? 0 : 1 };
  }

  // Count registered attendees
  const bookings = await this.bookingRepo.countGroupBookings(tenantId, serviceId, startTime);
  const spotsRemaining = service.capacity - bookings;

  if (spotsRemaining > 0) {
    return { available: true, spotsRemaining };
  }

  // Check waitlist
  if (service.allowWaitlist) {
    const waitlistCount = await this.bookingRepo.countWaitlist(tenantId, serviceId, startTime);
    if (waitlistCount < (service.waitlistLimit || 10)) {
      return { available: false, spotsRemaining: 0, waitlistPosition: waitlistCount + 1 };
    }
  }

  return { available: false, spotsRemaining: 0 };
}
```

**API Response:**

```json
{
  "slots": [
    {
      "startTime": "2025-12-10T10:00:00Z",
      "endTime": "2025-12-10T11:00:00Z",
      "available": true,
      "spotsRemaining": 5,
      "isGroupClass": true
    }
  ]
}
```

**Pros:**

- Enables group class use case
- Revenue multiplier for service providers
- Waitlist for demand management

**Cons:**

- Complex availability calculation
- UI changes for group vs 1:1
- Payment split considerations

**Effort:** Large (3-5 days)
**Risk:** Medium

### Option B: Simple Capacity Without Waitlist

**Description:** Add capacity only, no waitlist support

**Effort:** Medium (2-3 days)
**Risk:** Low

## Recommended Action

Defer to Phase 2. Implement Option B first, add waitlist in Phase 3.

## Technical Details

**Affected Files:**

- `server/prisma/schema.prisma` (Service, Booking models)
- `server/src/services/scheduling-availability.service.ts`
- `server/src/services/booking.service.ts`
- `packages/contracts/src/dto.ts`
- Client UI components

**Database Considerations:**

- Remove or modify unique constraint on `(tenantId, serviceId, startTime)` for group classes
- Add composite index: `(tenantId, serviceId, startTime, isWaitlisted)` for counting

## Acceptance Criteria

- [ ] Service model extended with capacity fields
- [ ] Availability returns spotsRemaining for group classes
- [ ] Multiple bookings allowed per slot (up to capacity)
- [ ] UI shows remaining spots
- [ ] Waitlist support (optional phase)
- [ ] Group attendee list for tenant admin

## Work Log

| Date       | Action                         | Learnings        |
| ---------- | ------------------------------ | ---------------- |
| 2025-12-05 | Created from Acuity comparison | Defer to Phase 2 |

## Resources

- [Acuity Group Classes](https://help.acuityscheduling.com/hc/en-us/articles/16676922487949)
- Related: `server/src/services/scheduling-availability.service.ts`
