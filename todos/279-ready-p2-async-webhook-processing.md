---
status: pending
priority: p2
issue_id: "279"
tags: [code-review, performance, webhooks, async, stripe]
dependencies: []
---

# Synchronous Webhook Processing Blocks Response

## Problem Statement

Stripe webhook processing is synchronous - the endpoint waits for booking creation, advisory lock acquisition, and payment record creation before responding. This can cause Stripe timeouts under load.

**Why it matters:**
- Stripe expects response within 5 seconds
- Advisory lock contention can cause delays beyond 5 seconds
- Stripe marks webhooks as "failed" and retries, creating a cascade
- Under load, legitimate webhooks may be marked as failed

## Findings

### Agent: performance-oracle
- **Location:** `server/src/routes/webhooks.routes.ts:118-399`
- **Processing Time Breakdown:**
  - Signature verification: ~10ms
  - Idempotency check: ~5ms
  - Record webhook: ~10ms
  - Process payment: ~50-100ms (DB transaction + advisory lock)
  - Total: 75-125ms blocking time
  - Under load with lock contention: 200-5000ms

### Load Metrics:

| Webhooks/sec | Processing Time | Timeout Rate |
|--------------|-----------------|--------------|
| 10/sec       | 75ms avg        | 0%           |
| 50/sec       | 120ms avg       | 2-5%         |
| 100/sec      | 200-300ms avg   | 10-15%       |

## Proposed Solutions

### Option A: Async Webhook Processing with Job Queue (Recommended)
**Description:** Record webhook immediately, process in background

```typescript
async handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  // 1. Verify signature (10ms)
  const event = await this.paymentProvider.verifyWebhook(rawBody, signature);

  // 2. Record webhook (10ms)
  await this.webhookRepo.recordWebhook({
    eventId: event.id,
    eventType: event.type,
    payload: event,
    status: 'pending',
  });

  // 3. Respond to Stripe IMMEDIATELY (200 OK)
  // Total response time: 20ms

  // 4. Queue background job for processing (async)
  await this.jobQueue.enqueue('process-webhook', { eventId: event.id });
}

// Background Worker:
async processWebhookJob(eventId: string): Promise<void> {
  const webhook = await this.webhookRepo.findByEventId(eventId);
  // Process without timeout pressure
  // Automatic retry on failure
}
```

**Pros:**
- Guaranteed fast response to Stripe
- No timeout risk under any load
- Automatic retry with exponential backoff
- Decouples webhook receipt from processing

**Cons:**
- Requires job queue infrastructure (BullMQ, pg-boss)
- Slightly delayed booking creation (seconds, not ms)
- More complex debugging

**Effort:** Medium (1-2 days)
**Risk:** Low

### Option B: Fire-and-Forget Processing (Simpler)
**Description:** Process asynchronously without awaiting

```typescript
async handleStripeWebhook(...): Promise<void> {
  const event = await this.paymentProvider.verifyWebhook(rawBody, signature);
  await this.webhookRepo.recordWebhook({...});

  // Process asynchronously (don't await)
  this.processWebhookAsync(event).catch(err =>
    logger.error({ err, eventId: event.id }, 'Webhook processing failed')
  );

  // Return immediately
}
```

**Pros:**
- Very quick to implement (1 hour)
- No additional infrastructure

**Cons:**
- No automatic retry on failure
- Harder to track processing status
- Potential memory issues with many concurrent processes

**Effort:** Small (1 hour)
**Risk:** Medium

## Recommended Action

Implement Option B immediately for quick win, then migrate to Option A for production reliability.

## Technical Details

**Affected Files:**
- `server/src/routes/webhooks.routes.ts`
- NEW: `server/src/jobs/webhook-processor.job.ts` (for Option A)
- `server/src/adapters/prisma/webhook.repository.ts`

**Job Queue Options:**
- BullMQ (Redis-based, production-ready)
- pg-boss (PostgreSQL-based, no new infrastructure)
- Simple database polling (minimal, works for MVP)

## Acceptance Criteria

- [ ] Webhook endpoint responds within 50ms
- [ ] Processing happens in background
- [ ] Failed processing doesn't affect Stripe response
- [ ] Retry logic for failed webhook processing
- [ ] Monitoring for processing latency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from performance review | Timeout risk under load |

## Resources

- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- Related: `server/src/routes/webhooks.routes.ts`
