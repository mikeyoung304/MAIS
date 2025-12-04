---
status: complete
priority: p2
issue_id: '156'
tags: [code-review, quality, mvp-gaps, duplication]
dependencies: ['155']
resolved_at: 2025-12-02
---

# Checkout Session Logic Duplicated 3 Times

## Problem Statement

Identical checkout session creation logic is repeated 3 times with minor variations: wedding checkout, balance checkout, and appointment checkout.

**Why This Matters:**

- 120+ lines of duplicated code
- Bug fixes must be applied 3 times
- Already caused inconsistency in balance payment

## Findings

### Agent: code-simplicity-reviewer

**Location:** `server/src/services/booking.service.ts`

- Lines 133-223 (wedding checkout)
- Lines 292-363 (balance checkout)
- Lines 716-789 (appointment checkout)

**Duplicated patterns:**

1. Idempotency key generation (8 lines)
2. Cached response check (5 lines)
3. Race condition handling (9 lines)
4. Stripe Connect vs Standard logic (15 lines)
5. Response caching (4 lines)

## Solution Implemented

### Option A: Extract Shared Method (Implemented)

**Implementation Date:** 2025-12-02

Created private method `createCheckoutSession()` that consolidates all common checkout logic:

```typescript
private async createCheckoutSession(params: {
  tenantId: string;
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
  applicationFeeAmount: number;
  idempotencyKeyParts: [string, string, string, string, number];
}): Promise<{ checkoutUrl: string }> {
  // Unified idempotency + race condition + Stripe logic
}
```

**Changes:**

1. Added shared `createCheckoutSession()` method at lines 105-175
2. Refactored `createCheckout()` to use shared method (reduced from 123 lines to 65 lines)
3. Refactored `createBalancePaymentCheckout()` to use shared method (reduced from 116 lines to 56 lines)
4. Refactored `createAppointmentCheckout()` to use shared method (reduced from 110 lines to 54 lines)
5. Fixed bug in `createBalancePaymentCheckout()` where `extendedBooking` was undefined (line 337)

**Results:**

- **155 lines of duplicated code eliminated**
- Single source of truth for checkout session creation
- All 15 unit tests passing
- Bug fixes now need to be applied only once
- Improved maintainability and consistency

## Technical Details

**Affected Files:**

- `server/src/services/booking.service.ts`

## Acceptance Criteria

- [x] Common checkout logic extracted to shared method
- [x] All 3 checkout methods use shared implementation
- [x] 120+ lines of duplication removed (155 lines total)
- [x] All tests pass (15/15 unit tests passing)
