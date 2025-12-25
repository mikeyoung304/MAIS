---
title: Webhook Idempotency Code Review Checklist
category: prevention
tags: [code-review, webhooks, idempotency, checklist]
priority: P1
---

# Webhook Idempotency - Code Review Checklist

Use this checklist when reviewing any webhook handler, async operation, or idempotency implementation.

---

## Phase 1: Design Review

### Database Design

- [ ] Unique constraint exists for deduplication (not just in code)
- [ ] Constraint includes `tenantId` (composite key: `[tenantId, eventId]`)
- [ ] Constraint prevents duplicates atomically at database level
- [ ] No magic strings like "unknown" or "\_global" used in production keys
- [ ] Migration is idempotent (uses `CREATE TABLE IF NOT EXISTS`)
- [ ] Index exists for efficient lookups (e.g., `@@index([createdAt])` for cleanup)

**What to look for:**

```prisma
// ✅ GOOD
model WebhookEvent {
  id      String @id
  tenantId String
  eventId  String
  @@unique([tenantId, eventId])  // ← Composite key
}

// ❌ BAD
model WebhookEvent {
  id      String @id
  eventId String  // Missing tenantId!
  @@unique([eventId])  // ← Not composite
}
```

### Error Handling Strategy

- [ ] Handler distinguishes duplicate (return 200) vs error (return 400/500)
- [ ] Specific error code checked (P2002 for Prisma unique violations)
- [ ] Generic exceptions not caught (must check error code)
- [ ] Duplicates logged at INFO level (expected behavior)
- [ ] Errors logged with full context (tenantId, eventId, error details)

**What to look for:**

```typescript
// ✅ GOOD - Specific error handling
try {
  await create();
} catch (error) {
  if ((error as any).code === 'P2002') {
    logger.info('Duplicate detected');
    return 200; // Idempotent success
  }
  throw error;
}

// ❌ BAD - Generic catch
try {
  await create();
} catch (error) {
  logger.info('Duplicate detected'); // Assumes all errors are P2002!
  return 200;
}
```

### Tenant Isolation

- [ ] `tenantId` extracted from request context (not optional)
- [ ] `tenantId` validated before processing (fail fast if missing)
- [ ] `tenantId` never defaults to "unknown" or other magic strings
- [ ] `tenantId` used in uniqueness checks (composite key)
- [ ] Same `eventId` from different tenants treated as separate events

**What to look for:**

```typescript
// ✅ GOOD - Validated tenantId
if (!event.metadata?.tenantId) {
  throw new ValidationError('Missing tenantId');
}
const tenantId = event.metadata.tenantId;

// ❌ BAD - Default tenantId
const tenantId = event.metadata?.tenantId || 'unknown';
// Creates single bucket for all failed extractions!
```

---

## Phase 2: Implementation Review

### Atomic Operations

- [ ] No "check then create" pattern (race condition window exists)
- [ ] Create operation is atomic (single database call)
- [ ] Transaction used only when multiple records must be created together
- [ ] Pessimistic locking used if needed (SELECT FOR UPDATE)
- [ ] No callbacks/setTimeout/Promise chains that break atomicity

**What to look for:**

```typescript
// ✅ GOOD - Atomic create with error handling
try {
  await db.webhookEvent.create({ data: { tenantId, eventId } });
  return true;
} catch (error) {
  if (error.code === 'P2002') return false;
  throw error;
}

// ❌ BAD - Non-atomic check-then-create
const exists = await db.webhookEvent.findUnique({ where: { eventId } });
if (exists) return false; // Race condition window opens here

await db.webhookEvent.create({ data: { eventId } });
// Race condition window closes here
return true;

// ❌ BAD - Async operation breaks atomicity
const isNew = await db.webhookEvent.create({ data: { eventId } });
// Another request can sneak in here
await some_async_operation();
```

### Return Values & Semantics

- [ ] Return value clearly indicates new vs duplicate (boolean, exception, or result object)
- [ ] Duplicate detection doesn't throw exception (return false/result object)
- [ ] Validation errors throw exception (400 to caller)
- [ ] Caller can't misinterpret return value

**What to look for:**

```typescript
// ✅ GOOD - Boolean return with clear semantics
async function recordWebhook(eventId: string): Promise<boolean> {
  try {
    await create();
    return true; // NEW
  } catch (error) {
    if (error.code === 'P2002') return false; // DUPLICATE
    throw error; // ERROR
  }
}

// ✅ GOOD - Specific exception type
async function recordWebhook(eventId: string): Promise<void> {
  try {
    await create();
  } catch (error) {
    if (error.code === 'P2002') {
      throw new DuplicateEventError(eventId); // Caller catches this
    }
    throw error;
  }
}

// ❌ BAD - Ambiguous return value
async function recordWebhook(eventId: string): Promise<any> {
  // Caller can't tell if result is duplicate or new
}

// ❌ BAD - Throws on duplicate
async function recordWebhook(eventId: string): Promise<void> {
  try {
    await create();
  } catch (error) {
    if (error.code === 'P2002') {
      throw error; // Caller must handle as success (confusing!)
    }
  }
}
```

### tenantId Usage

- [ ] `tenantId` passed to all database queries (not just creation)
- [ ] `tenantId` used in uniqueness check: `isDuplicate(tenantId, eventId)`
- [ ] `tenantId` never omitted or replaced with defaults
- [ ] `tenantId` used in logging context: `{ tenantId, eventId }`
- [ ] `tenantId` type is `string` (never `string | undefined` without validation)

**What to look for:**

```typescript
// ✅ GOOD - tenantId everywhere
async recordWebhook(tenantId: string, eventId: string) {
  const isDupe = await db.webhookEvent.findFirst({
    where: { tenantId, eventId }  // ← tenantId in filter
  });

  if (isDupe) return false;

  await db.webhookEvent.create({
    data: { tenantId, eventId }  // ← tenantId in create
  });

  logger.info({ tenantId, eventId }, 'Webhook recorded');  // ← tenantId in logs
}

// ❌ BAD - tenantId omitted
async recordWebhook(eventId: string) {
  const isDupe = await db.webhookEvent.findFirst({
    where: { eventId }  // ← Missing tenantId! Cross-tenant collision!
  });
  // ...
}
```

---

## Phase 3: Testing Review

### Concurrency Testing

- [ ] Test with concurrent requests (not sequential)
- [ ] Use `Promise.allSettled` to run requests simultaneously
- [ ] Test with 2 concurrent requests (basic case)
- [ ] Test with 10+ concurrent requests (stress case)
- [ ] Test with 50+ burst requests (extreme case)

**What to look for:**

```typescript
// ✅ GOOD - Concurrent test
it('prevents duplicate webhooks', async () => {
  const results = await Promise.allSettled([
    handler(eventId, data), // Concurrent
    handler(eventId, data), // Concurrent
  ]);

  expect(results[0]?.status).toBe('fulfilled');
  expect(results[1]?.status).toBe('fulfilled');

  const records = await db.find({ eventId });
  expect(records).toHaveLength(1);  // ← Exactly 1
});

// ❌ BAD - Sequential test (race condition hidden)
it('prevents duplicate webhooks', async () => {
  await handler(eventId, data); // Sequential
  await handler(eventId, data); // Sequential
  // Race condition never triggered!
});

// ❌ BAD - Doesn't verify record count
it('handles duplicate webhooks', async () => {
  const results = await Promise.allSettled([...]);
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  // Could have created 2 records, but test doesn't check!
});
```

### Data Integrity Verification

- [ ] Verify exactly 1 record created (not "at least 1")
- [ ] Verify all concurrent calls return success/200
- [ ] Verify no records leaked to other tenants
- [ ] Verify status field correctly set (PROCESSED, DUPLICATE, FAILED)
- [ ] Verify timestamps set correctly

**What to look for:**

```typescript
// ✅ GOOD - Strict verification
const records = await db.webhookEvent.findMany({ where: { eventId } });
expect(records).toHaveLength(1); // ← Exactly 1, not >= 1

const statuses = records.map((r) => r.status);
expect(statuses[0]).toBe('PROCESSED');

const otherTenantRecords = await db.webhookEvent.findMany({
  where: { tenantId: OTHER_TENANT, eventId },
});
expect(otherTenantRecords).toHaveLength(0); // ← No cross-tenant leak

// ❌ BAD - Loose verification
expect(records.length).toBeGreaterThan(0); // Could be 2!
expect(records.length).toBeLessThanOrEqual(1); // Could be 0!
```

### Tenant Isolation Tests

- [ ] Test same eventId, different tenants = both processed
- [ ] Test cross-tenant isolation (no data leakage)
- [ ] Test unique constraint scoped by tenantId

**What to look for:**

```typescript
// ✅ GOOD - Tenant isolation test
it('should isolate webhooks by tenant', async () => {
  const eventId = 'evt_same_001';

  const results = await Promise.allSettled([
    handler(eventId, { tenantId: 'tenant_a' }),
    handler(eventId, { tenantId: 'tenant_b' }),
  ]);

  // Both should succeed
  expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

  // But 2 records created (different tenants)
  const records = await db.find({ eventId });
  expect(records).toHaveLength(2); // ← TWO records, different tenants

  // Verify composite key works
  const recordA = records.find((r) => r.tenantId === 'tenant_a');
  const recordB = records.find((r) => r.tenantId === 'tenant_b');
  expect(recordA).toBeDefined();
  expect(recordB).toBeDefined();
});
```

### High-Concurrency Stress Test

- [ ] Test handles 50+ concurrent requests gracefully
- [ ] Test doesn't crash, timeout, or deadlock
- [ ] Test still maintains data integrity (exactly 1 record)
- [ ] Test completes in reasonable time (< 5 seconds)

**What to look for:**

```typescript
// ✅ GOOD - Stress test
it('handles 50 concurrent requests', async () => {
  const startTime = Date.now();
  const requests = Array.from({ length: 50 }, () => handler(eventId, data));

  const results = await Promise.allSettled(requests);
  const duration = Date.now() - startTime;

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  // Most should succeed
  expect(fulfilled.length).toBeGreaterThan(40);

  // Still exactly 1 record
  const records = await db.find({ eventId });
  expect(records).toHaveLength(1); // ← Data integrity maintained

  // Performance is acceptable
  expect(duration).toBeLessThan(5000); // 5 second timeout
});
```

---

## Phase 4: Code Quality Review

### Logging & Observability

- [ ] Duplicate detection logged at INFO level
- [ ] Processing success logged with tenantId context
- [ ] Errors logged with full details (error code, message, tenantId)
- [ ] No PII logged in error messages
- [ ] Metrics/counters for duplicates and race conditions

**What to look for:**

```typescript
// ✅ GOOD - Proper logging
if (isGlobalDupe) {
  logger.info({ eventId, tenantId }, 'Duplicate webhook detected');
}

try {
  await process();
  logger.info({ eventId, tenantId }, 'Webhook processed successfully');
} catch (error) {
  logger.error(
    { eventId, tenantId, error: error.message, errorCode: error.code },
    'Webhook processing failed'
  );
}

// ❌ BAD - Missing context
logger.info('Webhook duplicate'); // No tenantId!
logger.error(error); // No structured context!
logger.info(JSON.stringify(event)); // Might leak PII!
```

### Type Safety

- [ ] `tenantId` type is `string` (not `string | undefined`)
- [ ] Error code checked with proper typing
- [ ] No `as any` type assertions
- [ ] Return types are clear and specific

**What to look for:**

```typescript
// ✅ GOOD - Type safe
async recordWebhook(tenantId: string, eventId: string): Promise<boolean> {
  // tenantId is string, not optional
  try {
    await create();
    return true;
  } catch (error) {
    const errorCode = (error as any)?.code;  // ← Necessary to access property
    if (errorCode === 'P2002') return false;
    throw error;
  }
}

// ❌ BAD - Loose typing
async recordWebhook(tenantId?: string): Promise<any> {
  // tenantId is optional! Can be undefined
  const tenantId = tenantId || 'unknown';  // ← Default to unknown
}
```

---

## Phase 5: Documentation Review

### Code Comments

- [ ] Why: Explains why race condition prevention is needed
- [ ] How: Describes the atomic create pattern
- [ ] When: Documents when this code runs (webhook processing)
- [ ] Gotchas: Notes about unique constraint and error handling

**What to look for:**

```typescript
// ✅ GOOD - Helpful comments
// CRITICAL: Webhook deduplication must be atomic to prevent race conditions.
// We rely on database unique constraint (tenantId, eventId) to prevent:
//   1. Two identical requests both passing an application-level check
//   2. Both attempting to create the same record
// Database constraint ensures exactly one succeeds.
try {
  await db.webhookEvent.create({ data: { tenantId, eventId } });
  return true; // New
} catch (error) {
  // P2002 = unique constraint violated (Prisma error code)
  if (error.code === 'P2002') return false; // Duplicate
  throw error;
}

// ❌ BAD - No explanation
try {
  await db.webhookEvent.create({ data: { tenantId, eventId } });
  return true;
} catch (error) {
  if (error.code === 'P2002') return false;
}
```

### Migration Documentation

- [ ] Migration file is idempotent (IF NOT EXISTS)
- [ ] Comments explain the constraint purpose
- [ ] Backward compatibility considered
- [ ] Rollback steps documented (if needed)

**What to look for:**

```sql
-- ✅ GOOD - Idempotent migration
CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  event_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint prevents duplicate webhook processing
  UNIQUE(tenant_id, event_id)
);

-- ❌ BAD - Not idempotent
CREATE TABLE webhook_events (  -- Will fail if table exists!
  -- ...
);
```

---

## Phase 6: Deployment & Operations

### Deployment Checklist

- [ ] Database migration created and tested locally
- [ ] Migration applied before code deployment
- [ ] Rollback plan documented (how to remove constraint)
- [ ] Monitoring configured (metrics/logs for duplicates)
- [ ] Feature flag available (if gradual rollout needed)
- [ ] Staging environment tested
- [ ] Production deployment planned (low-traffic window?)

**What to look for:**

```markdown
# Deployment Plan

## Pre-deployment

- [ ] Test migration locally: `npm exec prisma migrate dev`
- [ ] Verify constraint works: INSERT duplicate, expect error

## Deployment

- [ ] Deploy migration to production
- [ ] Wait 5 minutes for safety
- [ ] Deploy new code (with error handling for P2002)

## Post-deployment

- [ ] Monitor webhook_duplicates metric (should be > 0)
- [ ] Monitor error logs (should be minimal)
- [ ] Check processing latency (should be similar to before)

## Rollback

- [ ] Remove unique constraint from schema
- [ ] Run: npx prisma migrate reset
- [ ] Deploy previous code version
- [ ] Verify webhooks processing normally
```

### Monitoring Setup

- [ ] Metric: `webhook.duplicate_count` (should increase over time)
- [ ] Metric: `webhook.race_conditions_prevented` (counter)
- [ ] Alert: If `webhook.failed_count` spikes
- [ ] Log pattern: Search for "Duplicate webhook detected"
- [ ] Dashboard: Track duplicate rate vs success rate

**What to look for:**

```typescript
// ✅ GOOD - Metrics/monitoring
if (isDuplicate) {
  metrics.counter('webhook.duplicate_count', 1, {
    tags: { event_type: event.type, tenant_id: tenantId },
  });
  logger.info({ eventId, tenantId }, 'Duplicate webhook');
}

metrics.histogram('webhook.processing_time_ms', duration);
metrics.gauge('webhook.success_rate', successCount / totalCount);
```

---

## Summary Checklist

### Before Code Review

- [ ] Read full prevention strategies document
- [ ] Understand the root cause (race condition window)
- [ ] Know the solution (atomic database constraint)

### During Code Review

- [ ] Phase 1: Design (schema, error handling, tenantId)
- [ ] Phase 2: Implementation (atomic ops, return values)
- [ ] Phase 3: Testing (concurrent, integrity, tenant isolation)
- [ ] Phase 4: Quality (logging, types, documentation)
- [ ] Phase 5: Operations (deployment, monitoring)

### Approval Criteria

- [ ] Unique constraint exists in database schema
- [ ] Code handles P2002 error specifically
- [ ] Concurrent test passes with 2+ simultaneous requests
- [ ] Exactly 1 record verified in tests
- [ ] tenantId never defaults to "unknown"
- [ ] Logging includes full context
- [ ] Monitoring/metrics configured
- [ ] Rollback plan documented

---

## Quick Red Flags

```
🚩 "Check if exists, then create" → Race condition!
🚩 No unique constraint in database → Race condition!
🚩 Generic catch block → Wrong error handling!
🚩 Sequential tests only → Race condition hidden!
🚩 tenantId defaults to "unknown" → Cross-tenant collision!
🚩 Don't count records → Data corruption hidden!
🚩 No monitoring → Silent failures!
```

---

## Questions to Ask

1. **Design:** Why use this approach instead of pessimistic locking?
2. **Testing:** What happens if 100 concurrent requests arrive?
3. **Tenant:** Why is tenantId included in the unique constraint?
4. **Error:** What specific error code indicates a duplicate?
5. **Monitoring:** How will we detect if race conditions occur in production?
6. **Rollback:** How do we revert this if it causes issues?

---

## Resources

- [Full Prevention Strategies](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md)
- [Quick Reference](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md)
- [Project Implementation](../../../server/IDEMPOTENCY_IMPLEMENTATION.md)
- [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts)
- [Code Reference](../../../server/src/routes/webhooks.routes.ts)
