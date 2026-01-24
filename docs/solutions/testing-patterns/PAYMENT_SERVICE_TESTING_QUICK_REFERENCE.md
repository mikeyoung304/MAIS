---
title: Payment Service Testing Quick Reference
category: testing-patterns
created: 2026-01-24
tags: [testing, stripe, payments, refunds, deposits]
---

# Payment Service Testing Quick Reference

## Overview

Payment services handle real money. Every code path needs tests.

## Test Files

| Service                   | Test File                                           | Test Count |
| ------------------------- | --------------------------------------------------- | ---------- |
| RefundProcessingService   | `test/services/refund-processing.service.test.ts`   | 21         |
| WeddingDepositService     | `test/services/wedding-deposit.service.test.ts`     | 24         |
| CheckoutSessionFactory    | `test/services/checkout-session.factory.test.ts`    | 18         |
| AppointmentBookingService | `test/services/appointment-booking.service.test.ts` | 22         |

## Test Categories

### 1. Happy Path

- Full refund succeeds
- Partial refund succeeds
- Deposit calculation correct
- Checkout session created

### 2. Error Handling

- NotFoundError for missing resources
- Invalid state errors (already refunded, balance paid)
- Amount validation (exceeds maximum, zero amount)
- Payment provider failures

### 3. Idempotency

- Duplicate requests return cached response
- Race condition handling
- Balance already paid = no-op

### 4. Multi-Tenant Isolation

- Only finds resources for correct tenant
- Events include tenantId
- Cache keys include tenantId

### 5. Event Emission

- Correct event type emitted
- Payload contains required fields
- No event on failure

## Test Helpers (test/helpers/fakes.ts)

### FakeBookingRepository

```typescript
// Core methods
create(tenantId, booking): Promise<Booking>
findById(tenantId, id): Promise<Booking | null>
update(tenantId, id, data): Promise<Booking>
completeBalancePayment(tenantId, id, amount): Promise<Booking | null>

// Test utilities
addBooking(booking, tenantId): void
clear(): void
```

### FakePaymentProvider

```typescript
// Core methods
createCheckoutSession(input): Promise<CheckoutSession>
createConnectCheckoutSession(input): Promise<CheckoutSession>
refund(input): Promise<RefundResult>

// Test utilities
setRefundShouldFail(shouldFail, error?): void
clear(): void
```

### FakeEventEmitter

```typescript
// Core methods
emit(event, payload): Promise<void>
subscribe(event, handler): void

// Test utilities
emittedEvents: Array<{ event, payload }>
clear(): void
```

## Mock Patterns

### Mock Tenant Repository

```typescript
function createMockTenantRepo(overrides = {}) {
  return {
    findById: vi.fn().mockResolvedValue({
      id: 'tenant_123',
      stripeAccountId: 'acct_test',
      stripeOnboarded: true,
      depositPercent: 50,
      ...overrides,
    }),
  };
}
```

### Mock Commission Service

```typescript
function createMockCommissionService() {
  return {
    calculateBookingTotal: vi.fn().mockResolvedValue({
      subtotal: 100000,
      commissionAmount: 5000,
      commissionPercent: 5,
    }),
  };
}
```

### Mock Prisma Transaction (for advisory locks)

```typescript
const mockPrisma = {
  $transaction: vi.fn(async (fn) =>
    fn({
      $executeRaw: vi.fn(), // Advisory lock
      booking: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(mockBooking),
      },
      customer: {
        upsert: vi.fn().mockResolvedValue(mockCustomer),
      },
    })
  ),
};
```

## Assertions

### Verify Refund Status Progression

```typescript
// Before refund
expect(booking.refundStatus).toBe('PENDING');

// During refund
expect(updateCalls[0].refundStatus).toBe('PROCESSING');

// After successful refund
expect(result.refundStatus).toBe('COMPLETED');
// or
expect(result.refundStatus).toBe('PARTIAL');

// After failed refund
expect(result.refundStatus).toBe('FAILED');
```

### Verify Event Emission

```typescript
expect(eventEmitter.emittedEvents).toHaveLength(1);
expect(eventEmitter.emittedEvents[0]).toEqual({
  event: BookingEvents.REFUNDED,
  payload: expect.objectContaining({
    bookingId: 'booking_123',
    tenantId: 'tenant_123',
    refundAmount: 10000,
    isPartial: false,
  }),
});
```

### Verify Multi-Tenant Isolation

```typescript
// Add booking for tenant A
bookingRepo.addBooking(booking, 'tenant_a');

// Query with tenant B should return null
const result = await bookingRepo.findById('tenant_b', booking.id);
expect(result).toBeNull();
```

## Running Tests

```bash
# All payment service tests
npm run --workspace=server test -- --run test/services/refund-processing.service.test.ts test/services/wedding-deposit.service.test.ts test/services/checkout-session.factory.test.ts test/services/appointment-booking.service.test.ts

# Single service
npm run --workspace=server test -- --run test/services/refund-processing.service.test.ts

# Watch mode
npm run --workspace=server test -- --watch test/services/
```

## Related Documentation

- [Test Helpers](../../../server/test/helpers/fakes.ts)
- [Booking Service](../../../server/src/services/booking.service.ts)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)
