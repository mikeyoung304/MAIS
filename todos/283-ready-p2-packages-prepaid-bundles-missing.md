---
status: pending
priority: p2
issue_id: "283"
tags: [code-review, feature-gap, packages, prepaid, acuity-parity]
dependencies: []
---

# Prepaid Package Bundles Not Implemented (Acuity Parity)

## Problem Statement

Acuity supports prepaid packages (e.g., "Buy 5 sessions, get 1 free") that clients purchase upfront and redeem against appointments. MAIS only supports pay-per-appointment. This is a key monetization feature.

**Why it matters:**
- Improves cash flow (payment upfront)
- Increases client commitment
- Common for personal trainers, therapists, coaches
- Reduces no-shows (prepaid = committed)

## Findings

### Agent: architecture-strategist
- **Location:** No existing implementation
- **Evidence:** No Package model for appointment bundles (existing Package model is for wedding packages)
- **Missing:**
  - Service package bundles (5 sessions for $X)
  - Credit balance tracking
  - Redemption against appointments
  - Expiration handling

### Acuity Package Features:
- Define package: 5 sessions for $400 (vs $100 each = $100 savings)
- Client purchases package
- Credit balance tracked
- Redeem credits when booking
- Expiration date support
- Partial redemption allowed

## Proposed Solutions

### Option A: Credit-Based Package System (Recommended)
**Description:** Packages grant credits, credits redeemed against appointments

**Schema:**
```prisma
model ServicePackage {
  id            String   @id @default(cuid())
  tenantId      String
  serviceId     String   // Which service this package is for
  name          String   // "10 Yoga Classes"
  description   String?
  sessionCount  Int      // 10 sessions
  priceCents    Int      // $900 (vs $100 each)
  validityDays  Int?     // 365 days from purchase
  active        Boolean  @default(true)

  service       Service  @relation(fields: [serviceId], references: [id])
  purchases     PackagePurchase[]

  @@index([tenantId, serviceId])
}

model PackagePurchase {
  id              String   @id @default(cuid())
  tenantId        String
  packageId       String
  customerId      String
  creditsTotal    Int      // 10
  creditsUsed     Int      @default(0)
  creditsRemaining Int     // Computed: creditsTotal - creditsUsed
  purchasedAt     DateTime @default(now())
  expiresAt       DateTime?
  stripePaymentId String?

  package         ServicePackage @relation(fields: [packageId], references: [id])
  customer        Customer       @relation(fields: [customerId], references: [id])
  redemptions     PackageRedemption[]

  @@index([tenantId, customerId])
  @@index([customerId, expiresAt])
}

model PackageRedemption {
  id          String   @id @default(cuid())
  purchaseId  String
  bookingId   String   @unique
  redeemedAt  DateTime @default(now())

  purchase    PackagePurchase @relation(fields: [purchaseId], references: [id])
  booking     Booking         @relation(fields: [bookingId], references: [id])
}
```

**Service Logic:**
```typescript
async createAppointmentWithPackage(
  input: CreateAppointmentInput,
  packagePurchaseId: string
): Promise<Booking> {
  const purchase = await this.packageRepo.getPurchase(input.tenantId, packagePurchaseId);

  // Validate package has credits
  if (purchase.creditsRemaining <= 0) {
    throw new PackageExhaustedError(packagePurchaseId);
  }

  // Validate not expired
  if (purchase.expiresAt && purchase.expiresAt < new Date()) {
    throw new PackageExpiredError(packagePurchaseId);
  }

  // Validate package is for this service
  if (purchase.package.serviceId !== input.serviceId) {
    throw new PackageServiceMismatchError();
  }

  // Create booking with package redemption in transaction
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        ...input,
        priceCents: 0, // Prepaid via package
        paymentType: 'PACKAGE',
        status: 'CONFIRMED',
      },
    });

    await tx.packagePurchase.update({
      where: { id: packagePurchaseId },
      data: { creditsUsed: { increment: 1 } },
    });

    await tx.packageRedemption.create({
      data: {
        purchaseId: packagePurchaseId,
        bookingId: booking.id,
      },
    });

    return booking;
  });
}
```

**API Endpoints:**
```typescript
// List available packages
GET /v1/public/packages?serviceId=X

// Purchase package
POST /v1/public/packages/:id/checkout
{ customerId: "..." }

// Get customer's package balance
GET /v1/public/customers/:id/packages?token=X

// Book with package credit
POST /v1/bookings/appointment/checkout
{ serviceId: "...", startTime: "...", packagePurchaseId: "..." }
```

**Pros:**
- Standard package/credit model
- Flexible redemption
- Clear audit trail
- Supports multiple packages per customer

**Cons:**
- Complex schema (3 new models)
- UI for package management
- Expiration handling complexity

**Effort:** Very Large (1-2 weeks)
**Risk:** Medium

### Option B: Simple Session Counter
**Description:** Track remaining sessions without full credit system

**Effort:** Large (3-5 days)
**Risk:** Low (but limited flexibility)

## Recommended Action

Defer to Phase 3. Focus on core booking flow and recurring appointments first.

## Technical Details

**Affected Files:**
- `server/prisma/schema.prisma` (new models)
- NEW: `server/src/services/package.service.ts`
- NEW: `server/src/routes/packages.routes.ts`
- `server/src/services/booking.service.ts`

**Stripe Integration:**
- Use Stripe Checkout for package purchase
- Store payment reference in PackagePurchase

## Acceptance Criteria

- [ ] ServicePackage, PackagePurchase, PackageRedemption models created
- [ ] Package purchase via Stripe Checkout
- [ ] Credit balance tracking
- [ ] Redemption on appointment booking
- [ ] Expiration validation
- [ ] Customer package balance API
- [ ] Admin package management UI

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from Acuity comparison | Defer to Phase 3 |

## Resources

- [Acuity Packages](https://help.acuityscheduling.com/hc/en-us/articles/16676922487949)
- Related: `server/src/services/booking.service.ts`
