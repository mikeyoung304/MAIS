---
title: Webhook Idempotency - Quick Reference
category: prevention
tags: [cheat-sheet, webhooks, race-conditions, idempotency]
priority: P1
---

# Webhook Idempotency - Quick Reference

**Print this and pin it to your wall!**

---

## The Problem

Two concurrent requests both pass a duplicate check, then both create records:

```
Request A: Check exists? No ──┐
                               ├─ RACE CONDITION
Request B: Check exists? No ──┘

Both create → Duplicate records
```

---

## The Solution

Use database unique constraints as the source of truth:

```
Request A: Create (atomically) ──┐
                                  ├─ Only ONE succeeds
Request B: Create (atomically) ──┘

Database enforces: Exactly 1 record
```

---

## Implementation Pattern

### ✅ CORRECT: Use Database Constraint

```typescript
async function recordWebhook(eventId: string) {
  try {
    // Let database prevent duplicates
    await db.webhookEvent.create({ data: { eventId } });
    return true; // New record created
  } catch (error) {
    if (error.code === 'P2002') {
      // Unique constraint violated
      return false; // Duplicate detected
    }
    throw error;
  }
}
```

### ❌ WRONG: Application-Level Check

```typescript
async function recordWebhook(eventId: string) {
  // Race condition window opens here
  const exists = await db.webhookEvent.findUnique({ where: { eventId } });
  if (exists) return false;

  // Both concurrent requests can pass above check
  await db.webhookEvent.create({ data: { eventId } });
  // Race condition window closes here
  return true;
}
```

---

## Database Schema

```prisma
model WebhookEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventId   String
  status    String

  // ✅ CORRECT: Unique constraint prevents duplicates
  @@unique([tenantId, eventId])
}
```

---

## Concurrent Testing

```typescript
// Test with CONCURRENT requests, not sequential
it('prevents duplicate webhooks', async () => {
  const results = await Promise.allSettled([
    webhookHandler(eventId, data), // Concurrent
    webhookHandler(eventId, data), // Concurrent
  ]);

  // Both should succeed (idempotency)
  expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

  // But only 1 record created (data integrity)
  const records = await db.find({ eventId });
  expect(records).toHaveLength(1); // ← CRITICAL
});
```

---

## Tenant Isolation

### ✅ CORRECT: Composite Key with tenantId

```typescript
// Same event from different tenants = different records (no collision)
const isDupe = await isDuplicate(tenantId, eventId);

// Composite unique constraint
@@unique([tenantId, eventId])
```

### ❌ WRONG: Global Event ID

```typescript
// Same event ID from tenant A and B treated as duplicate!
const isDupe = await isDuplicate(eventId);
```

---

## Error Handling

```typescript
// ✅ CORRECT: Catch specific error code
try {
  await db.create({ eventId });
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint
    logger.info('Duplicate detected');
    return 200; // Idempotent success to Stripe
  }
  throw error; // Re-throw other errors
}

// ❌ WRONG: Generic catch
try {
  await db.create({ eventId });
} catch (error) {
  logger.info('Duplicate'); // Assumes all errors are duplicates!
  return 200;
}
```

---

## tenantId Validation

```typescript
// ✅ CORRECT: Fail fast if missing
if (!event.metadata?.tenantId) {
  throw new ValidationError('Missing tenantId');
}
const tenantId = event.metadata.tenantId;

// ❌ WRONG: Default to "unknown"
const tenantId = event.metadata?.tenantId || 'unknown';
// Creates single bucket for all failed extractions!
```

---

## Common Mistakes

| Mistake              | Problem                  | Fix                          |
| -------------------- | ------------------------ | ---------------------------- |
| Check then create    | Race condition window    | Use database constraint      |
| Generic catch block  | Can't distinguish errors | Check error.code === 'P2002' |
| tenantId = "unknown" | Cross-tenant collisions  | Fail fast if missing         |
| Sequential tests     | Race condition hidden    | Use Promise.allSettled       |
| Don't count records  | Data corruption hidden   | Verify exactly 1 record      |

---

## Code Review Red Flags

```typescript
// 🚩 Separate check from create
const exists = await isDuplicate(eventId);
if (exists) return; // Race condition!

// 🚩 No composite key with tenantId
@@unique([eventId]) // Missing tenantId!

// 🚩 Sequential testing
await handler1();
await handler2(); // Not concurrent!

// 🚩 Don't verify count
expect(records.length > 0).toBe(true); // Could be 2!

// 🚩 Default tenantId
const tenantId = metadata?.tenantId || 'unknown';
```

---

## Test Template

```typescript
describe('Webhook Idempotency', () => {
  it('should prevent duplicates under concurrency', async () => {
    const eventId = 'evt_test_001';
    const eventData = {
      /* ... */
    };

    // 1. Run concurrent requests
    const results = await Promise.allSettled([
      handler(eventId, eventData),
      handler(eventId, eventData),
    ]);

    // 2. Both should succeed
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // 3. Exactly 1 record created
    const records = await db.find({ eventId });
    expect(records).toHaveLength(1);
  });

  it('should handle 10+ concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, () => handler(eventId, eventData));
    const results = await Promise.allSettled(requests);

    // All should complete without error
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Still exactly 1 record
    const records = await db.find({ eventId });
    expect(records).toHaveLength(1);
  });
});
```

---

## Monitoring

```typescript
// Log duplicates
if (isDuplicate) {
  logger.info({ eventId, tenantId }, 'Duplicate webhook detected');
}

// Track metrics
metrics.counter('webhook.duplicates');
metrics.counter('webhook.race_conditions_prevented');
metrics.histogram('webhook.processing_time_ms', duration);
```

---

## Deployment Checklist

- [ ] Unique constraint added to database schema
- [ ] Migration created and tested locally
- [ ] Code updated to catch P2002 errors
- [ ] Concurrent test added and passing
- [ ] Monitoring configured (metrics/logs)
- [ ] Rollback plan documented
- [ ] Code review approved
- [ ] Deployed to staging and verified
- [ ] Deployed to production

---

## Key Takeaway

> **Don't check then create. Let the database enforce uniqueness.**
>
> This one principle handles all race conditions automatically.

**Three rules:**

1. ✅ Unique constraint in database
2. ✅ Catch and handle constraint violation gracefully
3. ✅ Test with concurrent requests (Promise.allSettled)

---

## Further Reading

- [Full Prevention Strategies](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) - Complete guide with patterns
- [Project Implementation](../../../server/IDEMPOTENCY_IMPLEMENTATION.md) - Current implementation
- [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts) - Real test code
- [Code Reference](../../../server/src/routes/webhooks.routes.ts) - Handler implementation
