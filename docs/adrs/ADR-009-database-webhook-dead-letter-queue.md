# ADR-009: Database-Based Webhook Dead Letter Queue

**Date:** 2025-10-29
**Status:** Accepted
**Decision Makers:** Engineering Team
**Category:** Reliability
**Related Issues:** Phase 2B - Webhook Reliability

## Context

Stripe webhooks are the critical link between payment success and booking creation. If a webhook fails to process (database error, network timeout, application crash), we risk a scenario where:

1. Customer's payment succeeds in Stripe
2. Webhook processing fails
3. No booking is created
4. Customer is charged with no booking

Stripe has built-in retry logic (sends webhook up to 3 times), but we need additional safety nets:

- What if all 3 attempts fail?
- How do we track webhook processing attempts?
- How do we manually recover from persistent failures?

## Decision

We have chosen to implement a **database-based webhook dead letter queue (DLQ)** by adding a `WebhookEvent` table to our schema.

**Schema:**

```prisma
model WebhookEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique  // Stripe event ID
  eventType   String             // e.g., "checkout.session.completed"
  payload     Json                // Full webhook payload
  status      String             // "pending", "processed", "failed"
  attempts    Int      @default(0)
  lastError   String?            // Error message from last attempt
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([status, createdAt])  // For querying failed events
}
```

**Webhook Handler Logic:**

```typescript
async handleStripeWebhook(rawBody: string, signature: string) {
  // 1. Verify signature
  const event = await paymentProvider.verifyWebhook(rawBody, signature);

  // 2. Store in webhook events table (idempotency check)
  const webhookEvent = await prisma.webhookEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, eventType: event.type, payload: event },
    update: { attempts: { increment: 1 } }
  });

  // 3. If already processed, return success (idempotency)
  if (webhookEvent.status === 'processed') {
    return { received: true, duplicate: true };
  }

  // 4. Process webhook
  try {
    await bookingService.onPaymentCompleted(extractPayload(event));

    // 5. Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'processed', processedAt: new Date() }
    });

    return { received: true };
  } catch (error) {
    // 6. Mark as failed, increment attempts, store error
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: 'failed',
        attempts: { increment: 1 },
        lastError: error.message
      }
    });

    // 7. Return 500 to trigger Stripe retry
    throw error;
  }
}
```

## Consequences

**Positive:**

- **Auditability:** Every webhook attempt is logged in database
- **Idempotency:** Duplicate webhooks are automatically detected and skipped
- **Manual recovery:** Failed webhooks can be reprocessed manually via admin dashboard
- **Debugging:** Full payload and error messages stored for investigation
- **No lost payments:** Even if webhook fails permanently, payment is recorded
- **No additional infrastructure:** Uses existing PostgreSQL database

**Negative:**

- **Database writes:** Every webhook creates/updates a database row
- **Storage growth:** Webhook events table grows over time (requires cleanup strategy)
- **Transaction overhead:** Each webhook requires 2+ database operations

**Mitigation Strategies:**

- Add cron job to archive old webhook events (>90 days)
- Add index on `status` and `createdAt` for fast queries
- Consider table partitioning for high-volume scenarios

## Alternatives Considered

### Alternative 1: Redis-Based Queue

**Approach:** Store failed webhooks in Redis queue, process with background worker.

**Why Rejected:**

- **Additional infrastructure:** Requires Redis deployment
- **Complexity:** Requires background worker process
- **Volatility:** Redis is in-memory; data lost on restart
- **Overkill:** Wedding bookings are low-volume

### Alternative 2: File-Based Queue

**Approach:** Write failed webhooks to files, process with cron job.

**Why Rejected:**

- **No concurrent access:** Multiple servers can't safely access files
- **No transactions:** Can't atomically check + update webhook status
- **Limited querying:** Can't easily query by status or date
- **Debugging difficulty:** Harder to inspect than database table

### Alternative 3: External Queue Service (SQS, RabbitMQ)

**Approach:** Send failed webhooks to external queue service.

**Why Rejected:**

- **Additional cost:** AWS SQS or RabbitMQ hosting fees
- **Complexity:** Another service to maintain and monitor
- **Network dependency:** Queue unavailability blocks webhook processing
- **Overkill for scale:** Low webhook volume doesn't justify queue service

### Alternative 4: No DLQ (Rely on Stripe Retries Only)

**Approach:** Let Stripe retry webhook, log errors, manually reconcile failures.

**Why Rejected:**

- **Lost payments:** If all Stripe retries fail, payment → booking link is lost
- **Manual reconciliation:** Operations team must manually match payments to bookings
- **No audit trail:** No record of webhook attempts or failures
- **Customer experience:** Delays in booking confirmation

## Implementation Details

**Files Modified:**

- `server/prisma/schema.prisma` - Added `WebhookEvent` model
- `server/src/routes/webhooks.routes.ts` - Updated webhook handler with DLQ logic
- `server/src/adapters/prisma/webhook.repository.ts` - Created (handles webhook event persistence)

**Migration:**

```bash
npx prisma migrate dev --name add_webhook_events
```

**Testing:**

- Added test for duplicate webhook handling
- Added test for failed webhook storage
- Verified webhook replay from database

**Rollback Plan:**
If webhook events table causes performance issues:

1. Remove webhook event persistence
2. Keep idempotency check only (use in-memory cache with TTL)
3. Revert to Stripe retry-only approach

## References

- Stripe Documentation: [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- Martin Fowler: [Dead Letter Queue Pattern](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html)

## Related ADRs

- ADR-008: Pessimistic Locking (related to webhook processing)
- ADR-011: PaymentProvider Interface
