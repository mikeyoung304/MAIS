---
status: pending
priority: p2
issue_id: "155"
tags: [code-review, architecture, mvp-gaps, refactoring]
dependencies: []
---

# BookingService Monolithic (1177 lines, 4 domains)

## Problem Statement

BookingService handles 4 distinct domains in a single class with 8 constructor dependencies. This violates Single Responsibility Principle and makes testing difficult.

**Why This Matters:**
- 8 dependencies to mock for testing
- Hard to understand and maintain
- Changes in one domain risk breaking others

## Findings

### Agent: code-simplicity-reviewer

**Location:** `server/src/services/booking.service.ts`

**Evidence:**
- Wedding Package Bookings (lines 112-223, 245-363, 389-637)
- Appointment Scheduling (lines 640-894)
- Booking Management (lines 954-1088)
- Payment Processing (lines 1090-1175)
- 8 constructor dependencies (some optional)

## Proposed Solutions

### Option A: Split into Focused Services (Recommended)
**Pros:** Better testability, clearer responsibilities
**Cons:** Refactoring effort
**Effort:** Large (8-12 hours)
**Risk:** Medium

```typescript
class WeddingBookingService { } // 300 lines
class AppointmentBookingService { } // 250 lines
class BookingManagementService { } // 150 lines
```

### Option B: Keep But Document
**Pros:** No refactoring
**Cons:** Technical debt remains
**Effort:** None
**Risk:** High (continued degradation)

## Technical Details

**Affected Files:**
- `server/src/services/booking.service.ts`
- `server/src/di.ts`

## Acceptance Criteria

- [ ] Service split into 3-4 focused services
- [ ] Each service has 3-4 dependencies max
- [ ] All existing tests pass
- [ ] DI container updated
