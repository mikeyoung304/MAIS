---
status: deferred
priority: p1
issue_id: '5209'
tags: [code-review, testing, booking, stripe]
dependencies: []
---

# Missing Test Coverage for Critical Payment Services

## Problem Statement

Four critical payment services have zero test coverage. These services handle real money and customer bookings - any bug could result in lost revenue or double charges.

**Why it matters:** Payment bugs are P0 incidents. Testing is the primary defense against shipping broken payment logic.

## Findings

**Services Without Tests:**

| Service                     | Risk   | Handles                                  |
| --------------------------- | ------ | ---------------------------------------- |
| `RefundProcessingService`   | HIGH   | Customer refunds, partial refunds        |
| `WeddingDepositService`     | HIGH   | Split payments, deposit collection       |
| `AppointmentBookingService` | MEDIUM | Time slot booking, conflict detection    |
| `CheckoutSessionFactory`    | HIGH   | Stripe session creation, fee calculation |

**Reviewer:** Test Coverage Reviewer (TC-001, TC-002, TC-003, TC-004)

## Proposed Solutions

### Option A: Add Comprehensive Unit Tests (Recommended)

**Pros:** Full coverage, catches regressions
**Cons:** Time investment
**Effort:** Medium (2-4 hours per service)
**Risk:** Low

**Priority Order:**

1. `CheckoutSessionFactory` - Most critical, creates Stripe sessions
2. `RefundProcessingService` - Money going back to customers
3. `WeddingDepositService` - Complex split payment logic
4. `AppointmentBookingService` - Conflict detection

### Option B: Integration Tests Only

**Pros:** Tests real behavior
**Cons:** Slower, harder to debug
**Effort:** Medium
**Risk:** Medium (may miss edge cases)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Test Files to Create:**

- `server/test/services/checkout-session.factory.test.ts`
- `server/test/services/refund-processing.service.test.ts`
- `server/test/services/wedding-deposit.service.test.ts`
- `server/test/services/appointment-booking.service.test.ts`

**Key Test Cases:**

```typescript
// CheckoutSessionFactory
describe('CheckoutSessionFactory', () => {
  it('creates session with correct application fee');
  it('handles zero application fee');
  it('includes tenant metadata for webhook routing');
  it('throws on missing required fields');
});

// RefundProcessingService
describe('RefundProcessingService', () => {
  it('processes full refund');
  it('processes partial refund');
  it('prevents double refund with idempotency key');
  it('handles Stripe API errors gracefully');
});
```

## Acceptance Criteria

- [ ] CheckoutSessionFactory has 80%+ line coverage
- [ ] RefundProcessingService has 80%+ line coverage
- [ ] WeddingDepositService has 80%+ line coverage
- [ ] AppointmentBookingService has 80%+ line coverage
- [ ] All tests mock Stripe API (no real API calls)
- [ ] Tests run in CI pipeline

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-24 | Created from /workflows:review | Test Coverage reviewer found 4 untested services |

## Resources

- Review: Test Coverage Reviewer
- Testing patterns: `server/test/helpers/fakes.ts`
- Stripe mocking: `server/test/helpers/stripe-mock.ts`
