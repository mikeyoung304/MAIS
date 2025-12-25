---
title: Webhook Idempotency Race Condition Prevention Strategies
category: prevention
tags: [webhooks, concurrency, idempotency, race-conditions, atomic-operations, database-patterns]
priority: P1
applies_to: webhook-handlers, payment-processing, async-operations
date_created: 2025-12-01
status: active
---

# Webhook Idempotency Race Condition Prevention Strategies

## Executive Summary

The webhook idempotency race condition occurs when two concurrent requests both pass a duplicate "existence check" before either creates the record. This document provides comprehensive prevention strategies to ensure all webhook and async operation handlers are resilient against concurrent access.

**Root Cause Pattern:**

```
Request A: Check exists? No ──┐
                               ├─ Both pass check
Request B: Check exists? No ──┤
                               └─ Both create → Duplicate record created
```

**Solution Pattern:**

```
Request A: Check exists atomically (with constraint) ─────┐
                                                           ├─ Only one succeeds
Request B: Check exists atomically (with constraint) ─────┤
                                                           └─ Second returns early
```

---

## 1. Design Pattern: Atomic Record-and-Check

### Problem

Separating the "check if exists" logic from "create if not exists" creates a window where concurrent requests both pass the check.

### Solution: Use Database Constraints as Source of Truth

**Why it works:**

- Database unique constraints are atomic (enforced at SQL level)
- All concurrency is serialized through the database
- No race condition window possible
- Returns an error on duplicate, which you handle gracefully

**Implementation Pattern:**

```typescript
// ❌ WRONG - Race condition window exists between check and create
async function recordWebhook(eventId: string, metadata: any) {
  // Window opens here
  const existing = await db.webhookEvent.findUnique({ where: { eventId } });
  if (existing) {
    return false; // Already exists
  }

  // Concurrent request can also pass the check above
  // and both try to create
  await db.webhookEvent.create({
    data: { eventId, metadata },
  });
  // Window closes here
  return true;
}

// ✅ CORRECT - Database constraint prevents race condition
async function recordWebhook(eventId: string, metadata: any) {
  try {
    // Atomically create with unique constraint on eventId
    await db.webhookEvent.create({
      data: { eventId, metadata },
    });
    return true; // New record created
  } catch (error) {
    // If unique constraint violated, duplicate was detected
    if (error.code === 'P2002') {
      // Prisma unique constraint error
      logger.info('Webhook duplicate detected');
      return false;
    }
    throw error; // Re-throw other errors
  }
}
```

**Database Schema Requirements:**

```prisma
// ✅ CORRECT - Unique constraint on eventId
model WebhookEvent {
  id        String   @id @default(cuid())
  eventId   String   @unique  // ← Atomic deduplication
  tenantId  String
  status    String
  createdAt DateTime @default(now())

  // Composite unique for tenant-scoped operations
  @@unique([tenantId, eventId])
}

// ✅ CORRECT - Composite unique constraint
model IdempotencyKey {
  id        String   @id @default(cuid())
  key       String   @unique  // ← Atomic deduplication
  tenantId  String
  response  String?
  expiresAt DateTime

  // If you need tenant scoping AND global uniqueness
  @@unique([tenantId, key])
}
```

**Why NOT separate checks:**

```typescript
// ❌ WRONG - Never do this in concurrent scenarios
const isNew = await isDuplicate(eventId);
if (!isNew) return; // Race condition: another request can pass this check

const created = await create(eventId); // Both requests reach here!
```

---

## 2. Interface Design: Return Success/Failure, Never Leave It Ambiguous

### Problem

If a method doesn't clearly communicate whether an operation was new or duplicate, callers can't handle race conditions properly.

### Solution: Explicit Return Values and Exception Handling

**Pattern 1: Boolean Return Value**

```typescript
// ✅ CORRECT - Caller knows exactly what happened
async function recordWebhook(eventId: string): Promise<boolean> {
  try {
    await db.webhookEvent.create({ data: { eventId } });
    return true; // NEW: Record created successfully
  } catch (error) {
    if (error.code === 'P2002') {
      return false; // DUPLICATE: Already existed
    }
    throw error; // ERROR: Unexpected failure
  }
}

// Caller has clear semantics
const isNew = await recordWebhook(eventId);
if (!isNew) {
  logger.info('Duplicate webhook, returning early');
  return 200; // Success response to Stripe
}

// Process webhook logic only for new events
await processWebhook(event);
```

**Pattern 2: Specific Exception Types**

```typescript
// ✅ CORRECT - Exceptions communicate intent
class DuplicateEventError extends Error {
  constructor(eventId: string) {
    super(`Event ${eventId} already processed`);
    this.name = 'DuplicateEventError';
  }
}

async function recordWebhook(eventId: string): Promise<void> {
  try {
    await db.webhookEvent.create({ data: { eventId } });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new DuplicateEventError(eventId); // Specific error type
    }
    throw error;
  }
}

// Caller catches specific error type
try {
  await recordWebhook(eventId);
  await processWebhook(event);
} catch (error) {
  if (error instanceof DuplicateEventError) {
    logger.info('Duplicate webhook, returning 200 OK to Stripe');
    return 200;
  }
  throw error; // Re-throw unexpected errors
}
```

**Pattern 3: Result Object (TypeScript Discriminated Union)**

```typescript
// ✅ CORRECT - Type-safe result object
type WebhookRecordResult = { success: true; isNew: boolean } | { success: false; error: Error };

async function recordWebhook(eventId: string): Promise<WebhookRecordResult> {
  try {
    await db.webhookEvent.create({ data: { eventId } });
    return { success: true, isNew: true };
  } catch (error) {
    if (error.code === 'P2002') {
      return { success: true, isNew: false };
    }
    return { success: false, error };
  }
}

// Caller has exhaustive type checking
const result = await recordWebhook(eventId);
if (!result.success) {
  logger.error('Failed to record webhook', result.error);
  throw new WebhookProcessingError('Cannot record webhook');
}

if (!result.isNew) {
  logger.info('Duplicate webhook');
  return 200;
}

await processWebhook(event);
```

**Recommendation:** Use **Boolean return** for simple scenarios (duplicate = false). Use **Specific exceptions** for complex error handling. Use **Result objects** when you need detailed error information from the caller.

---

## 3. Test Strategy: Concurrent Operations Testing

### Problem

Synchronous tests don't reveal race conditions. You must test with actual concurrency.

### Solution: Promise.allSettled for Concurrent Testing

**Test Pattern: Detect Race Condition**

```typescript
describe('Webhook Idempotency', () => {
  it('should prevent duplicate webhook processing', async () => {
    const eventId = 'evt_test_001';
    const eventData = {
      /* webhook data */
    };

    // Act: Process same webhook twice CONCURRENTLY
    // (not sequentially!)
    const results = await Promise.allSettled([
      webhookHandler(eventId, eventData),
      webhookHandler(eventId, eventData),
    ]);

    // Assert: Both should complete successfully (idempotency)
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('fulfilled');

    // Verify exactly ONE record was created
    const records = await db.webhookEvent.findMany({
      where: { eventId },
    });
    expect(records).toHaveLength(1); // ← CRITICAL: Must be exactly 1

    // Verify both calls returned "duplicate detected"
    // (implementation-specific, but both should succeed)
  });

  it('should handle high-concurrency (10+ simultaneous requests)', async () => {
    const eventId = 'evt_burst_001';
    const eventData = {
      /* webhook data */
    };

    // Fire 10 requests simultaneously
    const requests = Array.from({ length: 10 }, () => webhookHandler(eventId, eventData));

    const results = await Promise.allSettled(requests);

    // Assert: All should complete (no crashes/timeouts)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Verify exactly ONE record was created
    const records = await db.webhookEvent.findMany({
      where: { eventId },
    });
    expect(records).toHaveLength(1); // ← CRITICAL

    // Log success rate for monitoring
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`Success rate: ${successCount}/10`);
  });

  it('should isolate concurrent webhooks by tenant', async () => {
    const tenantA = 'tenant_a';
    const tenantB = 'tenant_b';
    const sameEventId = 'evt_same_001'; // Same event ID, different tenants

    // Act: Process same event ID for different tenants concurrently
    // (multi-tenant system should NOT treat as duplicate)
    const results = await Promise.allSettled([
      webhookHandler(sameEventId, { tenantId: tenantA /* ... */ }),
      webhookHandler(sameEventId, { tenantId: tenantB /* ... */ }),
    ]);

    // Both should succeed
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('fulfilled');

    // Verify TWO records were created (different tenants, same event ID)
    const recordsA = await db.webhookEvent.findMany({
      where: { tenantId: tenantA, eventId: sameEventId },
    });
    const recordsB = await db.webhookEvent.findMany({
      where: { tenantId: tenantB, eventId: sameEventId },
    });
    expect(recordsA).toHaveLength(1);
    expect(recordsB).toHaveLength(1);

    // But not more
    const totalRecords = await db.webhookEvent.findMany({
      where: { eventId: sameEventId },
    });
    expect(totalRecords).toHaveLength(2);
  });

  it('should handle cascade race conditions (recording + processing)', async () => {
    const eventId = 'evt_cascade_001';
    const eventData = {
      /* webhook data */
    };

    // Simulate: Record webhook + Process booking both race
    const results = await Promise.allSettled([
      recordAndProcessWebhook(eventId, eventData),
      recordAndProcessWebhook(eventId, eventData),
    ]);

    // Both should succeed
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Exactly one webhook record
    const webhookRecords = await db.webhookEvent.findMany({
      where: { eventId },
    });
    expect(webhookRecords).toHaveLength(1);

    // Exactly one booking created
    const bookings = await db.booking.findMany({
      where: {
        /* filter by event data */
      },
    });
    expect(bookings).toHaveLength(1);
  });
});
```

**Test Pattern: Stress Testing**

```typescript
describe('Webhook Under Load', () => {
  it('should handle 50 rapid concurrent webhooks for same event', async () => {
    const eventId = 'evt_stress_001';
    const eventData = {
      /* webhook data */
    };

    const startTime = Date.now();

    // Fire 50 requests as fast as possible
    const requests = Array.from({ length: 50 }, () => webhookHandler(eventId, eventData));

    const results = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;

    // Success metrics
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    expect(fulfilled).toBeGreaterThan(0); // At least some succeeded
    expect(rejected + fulfilled).toBe(50); // All completed

    // Data integrity
    const records = await db.webhookEvent.findMany({
      where: { eventId },
    });
    expect(records).toHaveLength(1); // ← CRITICAL: Still exactly 1

    // Performance: Should complete reasonably fast
    // (adjust threshold based on your SLA)
    expect(duration).toBeLessThan(5000); // 5 second max

    console.log(
      `Handled 50 concurrent requests in ${duration}ms ` +
        `(${fulfilled} succeeded, ${rejected} failed)`
    );
  });
});
```

**What to Verify:**

1. ✅ Both concurrent calls complete (no deadlock/timeout)
2. ✅ Exactly one record created (data integrity)
3. ✅ Both calls return "success" to Stripe (idempotency)
4. ✅ No duplicate records in database
5. ✅ Performance is acceptable (timing)

**Common Test Mistakes:**

```typescript
// ❌ WRONG - Sequential test doesn't catch race conditions
async function testWebhookIdempotency() {
  await webhookHandler(eventId, data); // First call
  await webhookHandler(eventId, data); // Second call (sequential)
  // Race condition not detected!
}

// ✅ CORRECT - Concurrent test reveals race conditions
async function testWebhookIdempotency() {
  const results = await Promise.allSettled([
    webhookHandler(eventId, data), // First call (concurrent)
    webhookHandler(eventId, data), // Second call (concurrent)
  ]);
  // Race condition detected if 2 records created
}

// ❌ WRONG - Doesn't verify exactly 1 record
await Promise.allSettled([...]);
// Just check "no error occurred" but might have 2 records!

// ✅ CORRECT - Verify data integrity
const records = await db.find({ where: { eventId } });
expect(records).toHaveLength(1); // Exactly 1, not just "no error"
```

---

## 4. Code Review Checklist for Webhook Handlers

### Pre-Implementation Checklist

When implementing any webhook or async handler, use this checklist:

```markdown
## Webhook/Async Handler Code Review

### Idempotency Design

- [ ] Unique constraint exists in database for deduplication
- [ ] Create operation uses constraint (not separate check)
- [ ] Error handling catches unique constraint violation
- [ ] Return value clearly indicates new vs duplicate
- [ ] tenantId NEVER defaults to magic strings like "unknown"

### Concurrency Safety

- [ ] No race condition window between check and create
- [ ] All database operations are atomic
- [ ] No callback/setTimeout/Promise chains that unsync operations
- [ ] Tested with Promise.allSettled for concurrent requests
- [ ] Stress tested (10+ simultaneous requests)

### Tenant Isolation

- [ ] tenantId extracted BEFORE idempotency check
- [ ] tenantId validated (not optional/nullable)
- [ ] tenantId required for checkout.session.completed events
- [ ] Unique constraint scoped by tenantId (composite key)
- [ ] Tested: Same event ID, different tenants = both processed

### Error Handling

- [ ] Duplicate detection doesn't throw (returns 200 to Stripe)
- [ ] Validation errors throw (return 400 to Stripe)
- [ ] Unhandled errors logged with full context
- [ ] No PII leaked in error messages

### Testing

- [ ] Concurrent webhook test (2 simultaneous calls)
- [ ] High-concurrency test (10+ simultaneous calls)
- [ ] Stress test (50+ burst requests)
- [ ] Tenant isolation test (same event, different tenants)
- [ ] Integration test (recording + processing combined)

### Monitoring & Observability

- [ ] Duplicate detection logged (INFO level)
- [ ] Success logged with tenant context
- [ ] Failures logged with full error details
- [ ] Metrics available: duplicate rate, processing time
```

### Red Flags During Review

```typescript
// 🚩 RED FLAG 1: Separate check from create
const isDupe = await isDuplicate(eventId);
if (!isDupe) {
  const created = await create(eventId); // Race condition!
}

// FIX: Use database constraint
try {
  await create(eventId); // Atomically
} catch (e) {
  if (e.code === 'P2002') return false; // Duplicate
}

// 🚩 RED FLAG 2: tenantId defaults to "unknown"
const tenantId = metadata?.tenantId || 'unknown';
// FIX: Fail fast if tenantId missing
if (!tenantId) throw new ValidationError('Missing tenantId');

// 🚩 RED FLAG 3: No concurrent testing
it('handles duplicate webhooks', async () => {
  await handler(event1);
  await handler(event1); // Sequential, not concurrent!
});
// FIX: Use Promise.allSettled
const results = await Promise.allSettled([handler(event1), handler(event1)]);

// 🚩 RED FLAG 4: Doesn't verify exactly 1 record
expect(records.length).toBeGreaterThan(0); // Too loose!
// FIX: Verify exact count
expect(records).toHaveLength(1);

// 🚩 RED FLAG 5: Magic strings in database logic
const namespace = 'unknown';
const isDupe = await db.find({ namespace, eventId });
// FIX: Use actual tenantId or proper constants
const isDupe = await db.find({ tenantId, eventId });
```

---

## 5. Implementation Patterns by Use Case

### Pattern A: Webhook Event Deduplication

**Scenario:** Stripe webhook arrives twice (network retry)

```typescript
// ✅ CORRECT PATTERN
async handleStripeWebhook(eventId: string, event: StripeEvent) {
  // Step 1: Check global uniqueness BEFORE tenant extraction
  // (Stripe event IDs are globally unique)
  const isGlobalDupe = await webhookRepo.isDuplicate('_global', eventId);
  if (isGlobalDupe) {
    logger.info('Duplicate webhook detected');
    return 200; // Idempotent success
  }

  // Step 2: Extract and validate tenantId (fail fast if missing)
  const tenantId = event.metadata?.tenantId;
  if (!tenantId) {
    logger.error('Missing tenantId in webhook');
    throw new ValidationError('Missing tenantId');
  }

  // Step 3: Record webhook (with atomic unique constraint)
  const isNew = await webhookRepo.recordWebhook({
    tenantId,
    eventId,
    eventType: event.type,
    payload: event,
  });

  if (!isNew) {
    logger.info('Duplicate webhook detected during recording');
    return 200; // Idempotent success
  }

  // Step 4: Process webhook (only for new events)
  try {
    await processWebhookEvent(tenantId, event);
    await webhookRepo.markProcessed(tenantId, eventId);
  } catch (error) {
    await webhookRepo.markFailed(tenantId, eventId, error.message);
    throw error; // Stripe will retry
  }

  return 200;
}
```

**Database Schema:**

```prisma
model WebhookEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventId   String
  eventType String
  payload   String   @db.Text
  status    String   @default("PENDING")
  attempts  Int      @default(1)
  createdAt DateTime @default(now())

  // Atomic deduplication across all tenants
  @@unique([tenantId, eventId])
}
```

### Pattern B: Idempotency Key Caching

**Scenario:** Same API request called twice (client retry)

```typescript
// ✅ CORRECT PATTERN
async createCheckoutSession(
  tenantId: string,
  input: CreateCheckoutInput
): Promise<{ url: string }> {
  // Step 1: Generate deterministic idempotency key
  // Same inputs = same key (idempotent)
  const key = generateIdempotencyKey(
    tenantId,
    input.packageId,
    input.email,
    input.eventDate
  );

  // Step 2: Check cache (has this exact request been processed?)
  const cachedResponse = await idempotencyService.get(key);
  if (cachedResponse) {
    logger.info('Returning cached response for idempotency key');
    return cachedResponse; // Same response
  }

  // Step 3: Store key atomically (prevent race condition)
  const isNew = await idempotencyService.store(key);
  if (!isNew) {
    // Another request already stored this key
    // Wait briefly, then fetch the result
    await new Promise(r => setTimeout(r, 100));
    const result = await idempotencyService.get(key);
    if (result) return result;
    // If still not available, treat as new and proceed
  }

  // Step 4: Perform operation
  const session = await stripeProvider.createCheckoutSession({
    amount: input.amount,
    metadata: { tenantId, packageId: input.packageId },
    idempotencyKey: key, // Pass to Stripe too
  });

  // Step 5: Cache response
  await idempotencyService.set(key, {
    url: session.url,
    sessionId: session.id,
  });

  return { url: session.url };
}
```

**Database Schema:**

```prisma
model IdempotencyKey {
  id        String   @id @default(cuid())
  key       String   @unique // SHA256(tenantId + packageId + email + date)
  response  String   @db.Text // JSON response
  expiresAt DateTime // 24 hours
  createdAt DateTime @default(now())

  @@index([expiresAt]) // For cleanup job
}
```

### Pattern C: Double-Booking Prevention

**Scenario:** Two checkout webhooks for same date arrive concurrently

```typescript
// ✅ CORRECT PATTERN
async createBooking(
  tenantId: string,
  input: CreateBookingInput
): Promise<Booking> {
  // Database constraint prevents double-booking
  // @@unique([tenantId, date]) on Booking model

  try {
    // Transaction ensures atomicity of check + create
    const booking = await prisma.$transaction(async (tx) => {
      // Lock the row for this tenant+date if it exists
      const existing = await tx.booking.findFirst({
        where: { tenantId, date: input.date },
        select: { id: true },
      });

      if (existing) {
        throw new BookingConflictError(`Date ${input.date} is already booked`);
      }

      // Create booking within transaction
      // If concurrent request reaches here, unique constraint will catch it
      return tx.booking.create({
        data: {
          tenantId,
          date: input.date,
          // ... other fields
        },
      });
    });

    logger.info('Booking created successfully');
    return booking;
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint
        logger.info('Booking conflict - date already booked');
        throw new BookingConflictError(`Date already booked`);
      }
    }
    throw error;
  }
}
```

**Database Schema:**

```prisma
model Booking {
  id          String   @id @default(cuid())
  tenantId    String
  date        DateTime
  totalPrice  Int
  status      String   @default("CONFIRMED")
  createdAt   DateTime @default(now())

  // Prevent double-booking: Only 1 booking per tenant per date
  @@unique([tenantId, date])
  @@index([tenantId])
}
```

---

## 6. Monitoring & Observability

### Key Metrics to Track

```typescript
// 1. Duplicate Detection Rate
metrics.counter('webhook.duplicates', {
  tags: {
    event_type: event.type,
    tenant_id: tenantId,
  },
});

// 2. Race Condition Detections
// (when concurrent requests both tried to create)
metrics.counter('webhook.race_conditions_prevented', {
  tags: {
    operation: 'webhook_recording', // or 'booking_creation'
  },
});

// 3. Processing Time
metrics.histogram('webhook.processing_time_ms', duration, {
  tags: {
    event_type: event.type,
    status: 'success', // or 'failed'
  },
});

// 4. Idempotency Cache Hit Rate
metrics.gauge('idempotency.cache_hit_rate', hitRate, {
  tags: {
    operation: 'checkout_session_creation',
  },
});
```

### Log Patterns for Debugging

```typescript
// DUPLICATE DETECTION
logger.info({ eventId, tenantId, eventType }, 'Duplicate webhook detected');

// RACE CONDITION DETECTED
logger.info(
  { eventId, tenantId },
  'Race condition detected - duplicate recorded during concurrent request'
);

// PROCESSING ERROR
logger.error({ eventId, tenantId, error, errorCode: error.code }, 'Webhook processing failed');

// PERFORMANCE WARNING
if (duration > 2000) {
  logger.warn({ eventId, tenantId, duration }, 'Webhook processing took longer than expected');
}
```

---

## 7. Common Pitfalls & How to Avoid Them

### Pitfall 1: Check-Then-Act (TOCTOU Bug)

```typescript
// ❌ WRONG - Time of check to time of use
const existing = await db.find({ eventId });
if (existing) return; // Check

// Window here: Another request can create a duplicate
const created = await db.create({ eventId }); // Act
```

**Prevention:** Use database constraints instead of application-level checks.

### Pitfall 2: Non-Atomic Composite Operations

```typescript
// ❌ WRONG - Operations can be interleaved
const session = await stripeApi.verifySession(sessionId);
// Stripe can retry webhook between here and next line

const booking = await db.booking.create({
  data: { sessionId, date: session.date },
});
// Two webhooks can create bookings for same session
```

**Prevention:** Wrap in a transaction or use unique constraints.

### Pitfall 3: Missing Tenant Isolation

```typescript
// ❌ WRONG - Global idempotency, not tenant-scoped
const isDupe = await isDuplicate(eventId);
// Same event ID from different tenants treated as duplicate!

// ✅ CORRECT - Composite key includes tenantId
const isDupe = await isDuplicate(tenantId, eventId);
```

**Prevention:** Always include tenantId in uniqueness checks.

### Pitfall 4: Catching Generic Exceptions

```typescript
// ❌ WRONG - Can't distinguish unique violation from other errors
try {
  await create(eventId);
} catch (error) {
  logger.info('Duplicate detected'); // Assumes P2002 error
  return;
}

// ✅ CORRECT - Check error code specifically
try {
  await create(eventId);
} catch (error) {
  if ((error as any).code === 'P2002') {
    logger.info('Duplicate detected');
    return;
  }
  throw error; // Re-throw other errors
}
```

**Prevention:** Always check error code before handling unique violations.

### Pitfall 5: Retry Logic Without Idempotency

```typescript
// ❌ WRONG - Retry loop creates duplicates
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await handler(event);
    break;
  } catch (error) {
    // Retry without idempotency check
    // Same event might be created multiple times
  }
}

// ✅ CORRECT - Idempotency handles retries
try {
  // Idempotent handler (using unique constraint)
  await handler(event);
} catch (error) {
  throw error; // Let Stripe retry
  // Next retry will be idempotent (duplicate detected)
}
```

**Prevention:** Make handlers idempotent instead of adding retry logic.

---

## 8. Migration Guide: Add Idempotency to Existing Handler

### Step 1: Add Database Constraint

```bash
# Create migration
npx prisma migrate dev --name add_webhook_deduplication
```

```prisma
// Add to schema.prisma
model WebhookEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventId   String
  eventType String
  status    String   @default("PENDING")

  // Add unique constraint
  @@unique([tenantId, eventId])
}
```

### Step 2: Update Handler to Use Constraint

```typescript
// Before: Check then create (race condition)
async handleWebhook(event: StripeEvent) {
  const isDupe = await isDuplicate(event.id);
  if (isDupe) return;

  await db.webhookEvent.create({/* ... */});
}

// After: Create atomically with constraint
async handleWebhook(event: StripeEvent) {
  try {
    const isNew = await db.webhookEvent.create({/* ... */});
    if (!isNew) return; // Duplicate
  } catch (error) {
    if (error.code === 'P2002') {
      logger.info('Duplicate webhook');
      return;
    }
    throw error;
  }
}
```

### Step 3: Add Concurrent Tests

```typescript
it('prevents duplicate webhooks under concurrency', async () => {
  const results = await Promise.allSettled([handler(event), handler(event)]);

  expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

  const records = await db.find({ eventId: event.id });
  expect(records).toHaveLength(1); // ← CRITICAL
});
```

### Step 4: Deploy & Verify

```bash
# 1. Backfill unique constraint (if existing records)
UPDATE WebhookEvent SET status = 'PROCESSED'
WHERE status IS NULL;

# 2. Deploy code change
npm run build && npm run test

# 3. Verify in production
# Check logs for "Duplicate webhook" messages
# Monitor webhook_duplicates metric

# 4. Rollback plan (if needed)
# - Remove unique constraint from schema
# - Revert to check-then-create logic
# - Deploy previous code version
```

---

## 9. Quick Reference: Prevention Checklist

```markdown
## Before Submitting PR with Webhook/Async Handler

### Database Design

- [ ] Unique constraint exists for idempotency key
- [ ] Constraint is composite (includes tenantId)
- [ ] Database creates table/constraint (not just comments)
- [ ] Migration is idempotent (uses IF NOT EXISTS)

### Code Implementation

- [ ] Handler uses database constraint (not application check)
- [ ] Catches unique violation error (P2002)
- [ ] Returns 200 OK on duplicate (idempotent)
- [ ] tenantId never defaults to "unknown"
- [ ] tenantId validated (fail fast if missing)

### Testing

- [ ] Concurrent test (2 simultaneous requests)
- [ ] High-concurrency test (10+ simultaneous)
- [ ] Stress test (50+ burst requests)
- [ ] Tenant isolation test
- [ ] Test passes with npm test

### Code Review

- [ ] No race condition window visible in code
- [ ] All database operations atomic
- [ ] Error handling specific (checks error code)
- [ ] Logging includes tenantId context
- [ ] No magic strings like "unknown"

### Deployment

- [ ] Database migration applied
- [ ] Code deployed after migration
- [ ] Monitoring verified (metrics showing duplicates)
- [ ] Logs monitored for errors
- [ ] Rollback plan documented
```

---

## 10. References & Further Reading

### Database Patterns

- [Postgres Unique Constraints](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-UNIQUE)
- [Prisma Unique Constraints](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#unique)
- [Transactions & Locking](https://www.postgresql.org/docs/current/tutorial-transactions.html)

### Concurrency Testing

- [Promise.allSettled Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [Race Condition Testing](https://github.com/nodejs/node/blob/master/test/parallel/test-http-max-sockets.js)

### Webhook Best Practices

- [Stripe Webhook Idempotency](https://stripe.com/docs/webhooks#best-practices)
- [Webhook Idempotent REST APIs](https://restfulapi.net/idempotent-rest-apis/)
- [Event Sourcing Patterns](https://martinfowler.com/eaaDev/EventSourcing.html)

### Project-Specific

- [IDEMPOTENCY_IMPLEMENTATION.md](../../../server/IDEMPOTENCY_IMPLEMENTATION.md) - Current implementation details
- [CLAUDE.md](../../../CLAUDE.md) - Project patterns and conventions
- [webhook-race-conditions.spec.ts](../../../server/test/integration/webhook-race-conditions.spec.ts) - Test examples
- [webhooks.routes.ts](../../../server/src/routes/webhooks.routes.ts) - Implementation reference

---

## Summary

**The core principle:** Don't check then create. Let the database enforce uniqueness. This automatically handles all race conditions.

**Key patterns:**

1. ✅ Atomic database constraints (unique key)
2. ✅ Catch and handle unique violations gracefully
3. ✅ Test with concurrent requests (Promise.allSettled)
4. ✅ Tenant-scoped uniqueness (composite keys)
5. ✅ Log duplicates and race conditions for monitoring

**Prevention at a glance:**

- Race condition? → Use database constraint
- Duplicate? → Return 200 OK (idempotency)
- Missing tenantId? → Fail fast (throw error)
- Test? → Use Promise.allSettled (concurrent)
- Verify? → Count records (must be exactly 1)
