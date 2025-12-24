# Plan: Complete Booking Flow Fix + Polish

**Created:** 2025-12-16
**Context:** UX audit revealed broken booking flow and visual issues. This plan addresses all findings with a complete solution.

---

## Problem Summary

The La Petit Mariage storefront has a broken booking flow:

1. User browses Packages via tier cards (works great)
2. User clicks "Book Now - $595.00"
3. Taken to Service-based scheduling wizard
4. Shows "No services available" - user is stuck
5. Cannot complete any bookings

**Root cause:** Package and Service are separate systems. Packages exist but no Services were created.

---

## Solution Overview

Build a hybrid booking system that:

1. Supports both DATE-only and TIMESLOT booking per Package
2. Auto-creates Services when Package uses TIMESLOT booking
3. Adds configurable deposit settings per Package
4. Includes full tenant dashboard UI for managing these settings

---

## Detailed Requirements

### 1. Package Model Updates

Add these fields to the `Package` model in `server/prisma/schema.prisma`:

```prisma
model Package {
  // ... existing fields ...

  // Booking Configuration
  bookingType       BookingType @default(TIMESLOT)  // DATE or TIMESLOT
  durationMinutes   Int?        // Required for TIMESLOT, e.g., 480 (8 hours) for full-day
  bufferMinutes     Int         @default(0)         // Buffer between bookings

  // Deposit Configuration
  depositType       DepositType @default(PERCENTAGE) // PERCENTAGE, FIXED, or FULL
  depositPercent    Int         @default(25)         // Default 25%
  depositAmountCents Int?                            // For FIXED type, e.g., 20000 = $200

  // Balance Due Configuration
  balanceDueType    BalanceDueType @default(MANUAL)  // MANUAL, DAYS_BEFORE, ON_EVENT
  balanceDueDays    Int?                              // Days before event (for DAYS_BEFORE)

  // Auto-created Service reference (for TIMESLOT packages)
  linkedServiceId   String?     @unique
  linkedService     Service?    @relation(fields: [linkedServiceId], references: [id])
}

enum BookingType {
  DATE      // Simple date selection (no time slots)
  TIMESLOT  // Full scheduling wizard with time selection
}

enum DepositType {
  PERCENTAGE  // depositPercent% of basePrice
  FIXED       // depositAmountCents flat amount
  FULL        // 100% upfront
}

enum BalanceDueType {
  MANUAL       // Tenant collects manually
  DAYS_BEFORE  // Auto-charge balanceDueDays before event
  ON_EVENT     // Auto-charge on event day
}
```

### 2. Auto-Create Service Logic

When a Package with `bookingType=TIMESLOT` is created or updated:

```typescript
// In PackageService or via Prisma middleware
async function syncLinkedService(package: Package) {
  if (package.bookingType !== 'TIMESLOT') {
    // Delete linked service if exists
    if (package.linkedServiceId) {
      await prisma.service.delete({ where: { id: package.linkedServiceId } });
      await prisma.package.update({
        where: { id: package.id },
        data: { linkedServiceId: null },
      });
    }
    return;
  }

  const serviceData = {
    tenantId: package.tenantId,
    slug: `pkg-${package.slug}`,
    name: package.name,
    description: package.description,
    durationMinutes: package.durationMinutes || 480, // Default 8 hours
    bufferMinutes: package.bufferMinutes,
    priceCents: package.basePrice,
    segmentId: package.segmentId,
    active: package.active,
  };

  if (package.linkedServiceId) {
    // Update existing
    await prisma.service.update({
      where: { id: package.linkedServiceId },
      data: serviceData,
    });
  } else {
    // Create new
    const service = await prisma.service.create({ data: serviceData });
    await prisma.package.update({
      where: { id: package.id },
      data: { linkedServiceId: service.id },
    });
  }
}
```

### 3. Booking Flow Changes

#### For DATE Booking Type (New Flow)

Create a new 4-step booking component:

**Step 1: Confirm Package** (pre-filled from clicked Package)

- Show package name, price, description
- Display deposit amount: "Pay $148.75 today (25% deposit)"

**Step 2: Select Date**

- Calendar view showing available dates
- Check against existing Bookings for this Package's segment
- No time selection needed

**Step 3: Your Details**

- Customer name, email, phone
- Optional notes/special requests

**Step 4: Payment & Confirm**

- Stripe checkout for deposit amount
- Show booking summary
- Confirm button

#### For TIMESLOT Booking Type (Existing Flow)

Modify existing 5-step wizard:

- When navigating from Package detail page, pass `packageId` in URL/state
- Step 1 (Select Service): Pre-select the linked Service, or skip if only one
- Steps 2-5: Work as currently designed

### 4. Tenant Dashboard UI

Create new settings page at `/tenant/packages/:id/booking-settings`:

```
┌─────────────────────────────────────────────────────────────┐
│  Package Booking Settings                                    │
│  Essential Elopement                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BOOKING TYPE                                                │
│  ○ Date Only - Customer picks a date (weddings, events)     │
│  ● Time Slot - Customer picks date AND time (consultations) │
│                                                              │
│  Duration: [480] minutes  (8 hours = full day)              │
│  Buffer:   [30] minutes between bookings                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DEPOSIT SETTINGS                                            │
│  ○ Percentage of price                                       │
│    [25]% deposit ($148.75 for this package)                 │
│  ○ Fixed amount                                              │
│    $[___] deposit                                            │
│  ○ Full payment upfront                                      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BALANCE DUE                                                 │
│  ○ Manual collection (I'll collect separately)              │
│  ○ Auto-charge [14] days before event                       │
│  ○ Auto-charge on event day                                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                        [Cancel]  [Save]      │
└─────────────────────────────────────────────────────────────┘
```

Add link to this page from Package edit form and Package list.

### 5. Visual Polish Items

#### A. Seed Photos for La Petit Mariage

Add wedding photos to seed data for all La Petit Mariage packages:

- Use royalty-free images from Unsplash
- 2-3 photos per package
- Store URLs in Package.photos JSON field

#### B. Remove Duplicate Card Labels

In tier card components (`TierCard.tsx` or similar):

- Remove the text overlay on the image
- Keep only the uppercase label below the image
- This applies to both segment cards and tier cards

#### C. Full Polish Checklist

- [ ] Fix booking flow (hybrid DATE/TIMESLOT)
- [ ] Add deposit configuration
- [ ] Build tenant dashboard UI
- [ ] Seed La Petit Mariage photos
- [ ] Remove duplicate text labels
- [ ] Test full booking flow end-to-end

---

## Database Migration

```sql
-- Migration: add_package_booking_config

-- Add booking type enum
CREATE TYPE "BookingType" AS ENUM ('DATE', 'TIMESLOT');
CREATE TYPE "DepositType" AS ENUM ('PERCENTAGE', 'FIXED', 'FULL');
CREATE TYPE "BalanceDueType" AS ENUM ('MANUAL', 'DAYS_BEFORE', 'ON_EVENT');

-- Add columns to Package
ALTER TABLE "Package" ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'TIMESLOT';
ALTER TABLE "Package" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "Package" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Package" ADD COLUMN "depositType" "DepositType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "Package" ADD COLUMN "depositPercent" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Package" ADD COLUMN "depositAmountCents" INTEGER;
ALTER TABLE "Package" ADD COLUMN "balanceDueType" "BalanceDueType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Package" ADD COLUMN "balanceDueDays" INTEGER;
ALTER TABLE "Package" ADD COLUMN "linkedServiceId" TEXT UNIQUE;

-- Add foreign key
ALTER TABLE "Package" ADD CONSTRAINT "Package_linkedServiceId_fkey"
  FOREIGN KEY ("linkedServiceId") REFERENCES "Service"("id") ON DELETE SET NULL;
```

---

## Files to Create/Modify

### New Files

| File                                                 | Purpose                     |
| ---------------------------------------------------- | --------------------------- |
| `client/src/features/booking/DateBookingWizard.tsx`  | 4-step DATE booking flow    |
| `client/src/pages/tenant/PackageBookingSettings.tsx` | Tenant dashboard UI         |
| `server/src/services/package-service.sync.ts`        | Service auto-creation logic |
| `packages/contracts/src/booking-config.ts`           | New DTOs and schemas        |

### Modified Files

| File                                                 | Changes                            |
| ---------------------------------------------------- | ---------------------------------- |
| `server/prisma/schema.prisma`                        | Add Package booking fields + enums |
| `client/src/router.tsx`                              | Add booking settings route         |
| `client/src/pages/TierDetailPage.tsx`                | Pass packageId to booking          |
| `client/src/features/booking/AppointmentBooking.tsx` | Handle pre-selected package        |
| `client/src/features/storefront/TierCard.tsx`        | Remove image overlay text          |
| `client/src/features/storefront/SegmentCard.tsx`     | Remove image overlay text          |
| `server/prisma/seed.ts`                              | Add photos for La Petit Mariage    |

---

## API Endpoints

### New Endpoints

```
PATCH /v1/tenant-admin/packages/:id/booking-settings
  Body: { bookingType, durationMinutes, depositType, depositPercent, ... }

GET /v1/tenant-admin/packages/:id/booking-settings
  Returns: Current booking configuration for package
```

### Modified Endpoints

```
GET /v1/segments/:slug/packages
  Response now includes: bookingType, depositType, depositPercent, etc.

POST /v1/public/bookings
  Body now accepts: packageId (for DATE bookings without serviceId)
```

---

## Testing Requirements

### Unit Tests

- [ ] Package booking config validation
- [ ] Deposit calculation (percentage vs fixed)
- [ ] Service auto-creation logic
- [ ] Balance due date calculation

### Integration Tests

- [ ] Create package with TIMESLOT → Service auto-created
- [ ] Update package to DATE → Service deleted
- [ ] Booking with deposit creates correct Stripe charge
- [ ] DATE booking creates Booking without serviceId

### E2E Tests

- [ ] Full DATE booking flow: Browse → Select → Book → Pay
- [ ] Full TIMESLOT booking flow with pre-selected package
- [ ] Tenant dashboard: Update booking settings

---

## Acceptance Criteria

1. **Booking works end-to-end**
   - User can complete booking for La Petit Mariage packages
   - Payment is collected (deposit or full)
   - Booking confirmation shown

2. **Hybrid booking types**
   - DATE packages show simplified 4-step flow
   - TIMESLOT packages show 5-step wizard with time selection
   - Tenant can switch between types in dashboard

3. **Deposit configuration**
   - Default 25% deposit works
   - Tenant can set percentage, fixed, or full payment
   - Tenant can configure balance due timing

4. **Visual polish**
   - La Petit Mariage has photos on all packages
   - No duplicate text labels on cards
   - Clean, professional appearance

---

## Out of Scope (Future Work)

- Auto-charging balance (webhook/cron implementation)
- Email reminders for balance due
- Partial payment tracking UI
- Refund handling for deposits
- Multi-photographer/venue availability

---

## Summary for New Chat

**Copy this to start implementation in a fresh chat:**

---

### Task: Fix Booking Flow + Add Deposit Settings

**Problem:** Clicking "Book Now" on packages shows "No services available" - users cannot complete bookings.

**Solution:** Build hybrid booking system with:

1. **Per-Package booking type** (DATE or TIMESLOT)
   - DATE: Simple 4-step flow (confirm → date → details → pay)
   - TIMESLOT: Existing 5-step wizard with auto-created Service

2. **Auto-create Service** when Package.bookingType = TIMESLOT

3. **Deposit configuration** per Package:
   - Type: Percentage (default 25%), Fixed amount, or Full payment
   - Balance due: Manual, X days before, or on event day

4. **Tenant dashboard UI** at `/tenant/packages/:id/booking-settings`

5. **Visual fixes:**
   - Seed photos for La Petit Mariage packages
   - Remove duplicate text labels on tier/segment cards

**Key files to modify:**

- `server/prisma/schema.prisma` - Add booking config fields to Package
- `client/src/features/booking/` - Add DateBookingWizard.tsx
- `client/src/pages/tenant/` - Add PackageBookingSettings.tsx
- `client/src/features/storefront/TierCard.tsx` - Remove overlay text

**Start with:** Schema migration, then Service auto-creation, then DATE booking flow, then dashboard UI, then visual polish.

---
