---
status: complete
priority: p1
issue_id: '266'
tags: [code-review, backend-audit, stripe, webhooks, payments]
dependencies: []
---

# Missing Webhook Handler for payment_intent.failed

## Problem Statement

The webhook handler in `webhooks.routes.ts` only handles `checkout.session.completed` events. Failed payments are not tracked in the system, leaving users and admins unaware when payment attempts fail.

**Why it matters:**

- Failed payments go unnoticed by the system
- No user notification for payment failures
- No ability to retry or follow up on failed payments
- Booking flow may appear stuck to users

## Findings

### Agent: backend-audit

- **Location:** `server/src/routes/webhooks.routes.ts`
- **Evidence:** Only `checkout.session.completed` case in switch statement
- **Impact:** HIGH - Users experience silent payment failures

## Proposed Solutions

### Option A: Add payment_intent.failed Handler (Recommended)

**Description:** Add handler for payment failure events, update booking status, and notify user

```typescript
case 'payment_intent.payment_failed':
  const failedIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = failedIntent.metadata?.bookingId;

  if (bookingId) {
    // Update booking status to indicate payment failure
    await bookingService.markPaymentFailed(tenantId, bookingId, {
      reason: failedIntent.last_payment_error?.message,
      code: failedIntent.last_payment_error?.code,
    });

    // Optionally notify user via email
    logger.warn({ bookingId, tenantId }, 'Payment failed for booking');
  }
  break;
```

**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option B: Add Multiple Failure Handlers

**Description:** Handle all payment-related failure events comprehensively

Events to handle:

- `payment_intent.payment_failed`
- `checkout.session.expired`
- `charge.failed`

**Effort:** Medium-Large (4-6 hours)
**Risk:** Low

## Recommended Action

Implement Option A first as minimum viable solution, then expand to Option B.

## Technical Details

**Affected Files:**

- `server/src/routes/webhooks.routes.ts`
- `server/src/services/booking.service.ts` (add `markPaymentFailed` method)

**Database Changes:** Consider adding `paymentFailedAt` and `paymentFailureReason` columns to Booking model

## Acceptance Criteria

- [ ] `payment_intent.payment_failed` webhook handler added
- [ ] Booking status updated on payment failure
- [ ] Failure logged with structured logging
- [ ] Test coverage for failure scenarios

## Work Log

| Date       | Action                     | Learnings                    |
| ---------- | -------------------------- | ---------------------------- |
| 2025-12-05 | Created from backend audit | Critical gap in payment flow |

## Resources

- [Stripe Payment Intents Lifecycle](https://stripe.com/docs/payments/intents#intent-statuses)
- Related: `server/src/routes/webhooks.routes.ts`
