# P3: Missing Documentation for bookingType Field

## Priority: P3 Nice-to-have

## Status: ready

## Feature: DATE Booking Flow

## Category: Developer Experience

## Issue

The `BookingType` enum definition lacks comprehensive examples and migration guidance.

**File:** `server/prisma/schema.prisma:393-396`

```prisma
enum BookingType {
  DATE     // Legacy date-only bookings (weddings)
  TIMESLOT // Time-slot based scheduling
}
```

## Recommendation

Add more comprehensive documentation:

```prisma
enum BookingType {
  DATE
  // Date-only bookings: Customer selects a single day (e.g., wedding on June 15)
  // Enforces one booking per tenant per date via unique constraint
  // Used by: wedding venues, event spaces, full-day rentals
  // Flow: TierDetail → DateBookingWizard → Stripe checkout

  TIMESLOT
  // Time-slot bookings: Customer selects specific time slots (e.g., 2:00pm-3:00pm)
  // Multiple bookings allowed per day with different time slots
  // Used by: consultations, appointments, hourly services
  // Flow: ServiceSelection → TimeSlotPicker → Stripe checkout
}
```

## Also Consider

- Add JSDoc comments to related TypeScript types
- Document the booking flow differences in a README
- Add decision tree for choosing between DATE and TIMESLOT

## Work Log

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference

- Data Integrity Review Finding P3-003 (Missing documentation)
