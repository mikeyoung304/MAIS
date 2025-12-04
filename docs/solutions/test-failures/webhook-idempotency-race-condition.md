---
title: 'Webhook Idempotency Race Condition Fix'
date: 2025-12-01
category: test-failures
component: webhooks
severity: P0
symptoms:
  - 'Concurrent webhook processing caused duplicate booking attempts'
  - 'Tests failing: should prevent duplicate webhook processing'
  - 'Two concurrent calls could both pass isDuplicate check before either recorded'
  - 'Race condition between isDuplicate check and recordWebhook'
root_cause: 'recordWebhook returned void, preventing controller from detecting if concurrent call already recorded the event'
solution: 'Changed recordWebhook return type from void to boolean - returns true if new record created, false if duplicate detected via P2002 unique constraint'
tags:
  - webhooks
  - race-conditions
  - idempotency
  - prisma
  - concurrency
  - stripe
  - booking-conflicts
related_files:
  - server/src/routes/webhooks.routes.ts
  - server/src/adapters/prisma/webhook.repository.ts
  - server/src/lib/ports.ts
  - server/test/integration/webhook-race-conditions.spec.ts
related_adrs:
  - ADR-002 (Database-Based Webhook Dead Letter Queue)
  - ADR-006 (PostgreSQL Advisory Locks)
---

# Webhook Idempotency Race Condition Fix

## Problem Statement

Concurrent webhook calls from Stripe could both pass the initial `isDuplicate()` check before either had recorded the webhook event, leading to duplicate booking attempts.

### Timeline of the Bug

```
Time    Call A                          Call B
─────────────────────────────────────────────────────────────────
T1      isDuplicate() → false
T2                                      isDuplicate() → false
T3      recordWebhook() ✓
T4                                      recordWebhook() (P2002 caught, returns)
T5      createBooking() ✓
T6                                      createBooking() → BookingConflictError!
```

Both calls passed the duplicate check because neither had recorded yet.

## Root Cause

The `recordWebhook()` method returned `void`, so the controller couldn't detect if a concurrent call had already recorded the event. When P2002 (unique constraint violation) was caught, the method silently returned without indicating it was a duplicate.

```typescript
// BEFORE - Problematic
async recordWebhook(input: {...}): Promise<void> {
  try {
    await this.prisma.webhookEvent.create({...});
  } catch (error) {
    if (errorCode === 'P2002') {
      return;  // Silent return - caller doesn't know it's a duplicate!
    }
    throw error;
  }
}
```

## Solution

### 1. Changed Interface (server/src/lib/ports.ts)

```typescript
export interface WebhookRepository {
  /**
   * Records a webhook event. Returns true if new record, false if duplicate.
   */
  recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean>; // Changed from void
  // ...
}
```

### 2. Updated Repository (server/src/adapters/prisma/webhook.repository.ts)

```typescript
async recordWebhook(input: {...}): Promise<boolean> {
  try {
    await this.prisma.webhookEvent.create({
      data: {
        tenantId: input.tenantId,
        eventId: input.eventId,
        eventType: input.eventType,
        rawPayload: input.rawPayload,
        status: 'PENDING',
        attempts: 1,
      },
    });
    logger.info({...}, 'Webhook event recorded');
    return true; // New record created
  } catch (error) {
    const errorCode = (error as any)?.code;
    if (errorCode === 'P2002') {
      logger.info({...}, 'Webhook already recorded (duplicate eventId)');
      return false; // Duplicate detected
    }
    throw error;
  }
}
```

### 3. Updated Controller (server/src/routes/webhooks.routes.ts)

```typescript
// Record webhook and check if it's a new record
const isNewRecord = await this.webhookRepo.recordWebhook({
  tenantId: effectiveTenantId,
  eventId: event.id,
  eventType: event.type,
  rawPayload: rawBody,
});

// RACE CONDITION FIX: Return early if duplicate detected
if (!isNewRecord) {
  logger.info(
    { eventId: event.id },
    'Webhook duplicate detected during recording - returning 200 OK'
  );
  return; // Idempotent success
}

// Continue with processing...
```

## Why This Works

1. **Database unique constraint is atomic** - Only one of the concurrent calls can successfully create the record
2. **P2002 error is specific** - We know exactly why the create failed
3. **Boolean return communicates state** - Controller knows whether to proceed or return early
4. **200 OK for duplicates** - Stripe sees success and won't retry

### Fixed Timeline

```
Time    Call A                          Call B
─────────────────────────────────────────────────────────────────
T1      isDuplicate() → false
T2                                      isDuplicate() → false
T3      recordWebhook() → true ✓
T4                                      recordWebhook() → false (P2002)
T5      createBooking() ✓               return 200 OK (idempotent)
T6      markProcessed() ✓
```

## Schema Requirements

The fix relies on the database unique constraint:

```prisma
model WebhookEvent {
  id         String   @id @default(cuid())
  tenantId   String
  eventId    String   // Stripe event ID
  eventType  String
  status     String   @default("PENDING")
  // ...

  @@unique([tenantId, eventId])  // CRITICAL: Prevents duplicates
}
```

## Testing Strategy

### Concurrent Test Pattern

```typescript
it('should prevent duplicate webhook processing', async () => {
  const eventId = 'evt_duplicate_test_001';

  // Process same webhook twice concurrently
  const results = await Promise.allSettled([
    webhooksController.handleStripeWebhook(rawBody, signature),
    webhooksController.handleStripeWebhook(rawBody, signature),
  ]);

  // Both should succeed (idempotent)
  expect(results[0]?.status).toBe('fulfilled');
  expect(results[1]?.status).toBe('fulfilled');

  // Only one booking created
  const bookings = await prisma.booking.findMany({...});
  expect(bookings).toHaveLength(1);
});
```

## Prevention Strategies

### 1. Design Pattern: Atomic Record-and-Check

When implementing idempotency:

- Use database unique constraints as the source of truth
- Return success/failure from the create operation
- Don't separate "check if exists" from "create if not exists"

### 2. Interface Design

Repository methods that can fail due to duplicates should:

- Return boolean (true = new, false = duplicate)
- Or throw a specific exception that callers handle as success

### 3. Code Review Checklist

When reviewing webhook handlers:

- [ ] Is there a gap between duplicate check and record creation?
- [ ] Are unique constraints being used?
- [ ] Does the handler return 200 for duplicates?
- [ ] Is the recordWebhook return value being checked?

## Related Documentation

- **ADR-002**: Database-Based Webhook Dead Letter Queue (DECISIONS.md)
- **ADR-006**: PostgreSQL Advisory Locks (DECISIONS.md)
- **ARCHITECTURE.md**: Webhook Processing section
- **test-isolation-di-container-race-conditions.md**: Related testing patterns

## Files Changed

```
server/src/lib/ports.ts                           # Interface change
server/src/adapters/prisma/webhook.repository.ts  # Returns boolean
server/src/adapters/mock/index.ts                 # Mock returns boolean
server/src/routes/webhooks.routes.ts              # Checks return value
server/test/integration/webhook-race-conditions.spec.ts  # Updated test
```

## Breaking Change Notice

The `WebhookRepository.recordWebhook` interface changed from `Promise<void>` to `Promise<boolean>`. Any code implementing this interface must be updated:

```typescript
// Update implementations to return boolean
async recordWebhook(input: {...}): Promise<boolean> {
  // ... create logic ...
  return true;  // or false for duplicates
}
```

## Remaining Work

The `FakeWebhookRepository` in `server/test/helpers/fakes.ts` needs updating to match the new interface. See `docs/plans/TEST-FAILURES-CLEANUP-PROGRESS.md` for details.
