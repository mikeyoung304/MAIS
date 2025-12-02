---
title: Webhook Idempotency Race Condition Prevention - Summary
category: prevention
tags: [webhooks, idempotency, race-conditions, summary, P1]
priority: P1
date_created: 2025-12-01
status: active
---

# Webhook Idempotency Race Condition Prevention - Summary

## Quick Overview

**Problem:** Race conditions in webhook handlers where two concurrent requests both pass a duplicate check before either creates a record, resulting in duplicate processing.

**Solution:** Use atomic database unique constraints to prevent the race condition window.

**Key Principle:** Don't check then create. Let the database enforce uniqueness.

---

## The Three Core Strategies

### 1. Design Pattern: Atomic Record-and-Check
Use database unique constraints as the source of truth for deduplication.

```typescript
// ✅ CORRECT: Atomic create with error handling
try {
  await db.webhookEvent.create({ data: { eventId } });
  return true; // New
} catch (error) {
  if (error.code === 'P2002') return false; // Duplicate
  throw error;
}

// ❌ WRONG: Check then create (race condition)
if (await isDuplicate(eventId)) return;
await db.create({ data: { eventId } }); // Both can reach here!
```

**Why it works:**
- No application-level check creates no race window
- Database constraint is atomic (enforced at SQL level)
- All concurrency serialized through database
- Automatic for all concurrent requests

### 2. Interface Design: Return Success/Failure Explicitly
Handlers must clearly communicate: new record, duplicate, or error.

```typescript
// ✅ CORRECT: Boolean return with clear semantics
async function recordWebhook(eventId: string): Promise<boolean> {
  try {
    await db.create({ data: { eventId } });
    return true; // NEW
  } catch (error) {
    if (error.code === 'P2002') return false; // DUPLICATE
    throw error; // ERROR
  }
}

// Caller understands all three cases
if (!isNew) return 200; // Duplicate → success to Stripe
await processWebhook(); // New → process
```

### 3. Test Strategy: Concurrent Operations Testing
Test with actual concurrent requests, not sequential.

```typescript
// ✅ CORRECT: Concurrent test reveals race conditions
it('prevents duplicates', async () => {
  const results = await Promise.allSettled([
    handler(eventId),
    handler(eventId), // Concurrent, not sequential
  ]);

  // Both should complete
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);

  // But exactly 1 record created
  const records = await db.find({ eventId });
  expect(records).toHaveLength(1); // ← CRITICAL

  // Test with more requests
  const burst = Array.from({ length: 50 }, () => handler(eventId));
  await Promise.allSettled(burst);

  // Still exactly 1 record
  expect(await db.find({ eventId })).toHaveLength(1);
});
```

---

## Documentation Provided

### 1. WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md (30 min read)
**Complete prevention strategies with:**
- 10 major sections covering design to deployment
- Copy-paste implementation patterns (3 real patterns)
- Full code examples with explanations
- Common pitfalls and how to avoid them
- Migration guide for existing code
- Monitoring setup
- Reference materials

**Best for:** Implementers, architects, deep understanding

### 2. WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md (5 min read)
**One-page cheat sheet with:**
- Problem and solution visual
- ✅ Correct patterns (searchable)
- ❌ Wrong patterns (searchable)
- Common mistakes table
- Concurrent testing template
- Code review red flags
- Print-friendly format

**Best for:** Quick lookup, desk reference, teaching

### 3. WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md (20 min read)
**6-phase code review checklist with:**
- Phase 1: Design Review (schema, error handling, tenantId)
- Phase 2: Implementation Review (atomic ops, return values)
- Phase 3: Testing Review (concurrent, integrity, stress tests)
- Phase 4: Code Quality Review (logging, types)
- Phase 5: Documentation Review (comments, migrations)
- Phase 6: Deployment & Operations (checklist, monitoring)
- Approval criteria
- Quick red flags
- Questions to ask

**Best for:** Code reviewers, quality assurance, team standardization

### 4. WEBHOOK-IDEMPOTENCY-PREVENTION-INDEX.md (10 min read)
**Navigation guide with:**
- Quick decision tree (find right document in 10 seconds)
- Role-based reading paths (engineer, reviewer, lead, onboarding)
- Problem-based navigation (debugging, implementing, reviewing)
- Document structure overview
- Key concepts index
- Learning paths (beginner to advanced)

**Best for:** First-time navigation, team onboarding, reference

---

## Core Principles

### 1. Atomic Database Constraints
```prisma
model WebhookEvent {
  tenantId String
  eventId  String
  @@unique([tenantId, eventId])  // Atomic deduplication
}
```

✅ Prevents duplicates automatically
✅ Works for unlimited concurrent requests
✅ No application-level logic needed
✅ Composite key includes tenantId (tenant isolation)

### 2. Specific Error Handling
```typescript
try {
  await db.create(data);
} catch (error) {
  if (error.code === 'P2002') {
    // Duplicate detected (expected, idempotent)
    logger.info('Duplicate webhook');
    return 200;
  }
  // Unexpected error
  throw error;
}
```

✅ Catches unique violations specifically
✅ Returns 200 OK to Stripe (idempotent)
✅ Re-throws unexpected errors
✅ No silent failures

### 3. Tenant-Scoped Uniqueness
```typescript
// Same event ID, different tenants = different records (no collision)
const isDupe = await isDuplicate(tenantId, eventId);

// Composite unique constraint
@@unique([tenantId, eventId])
```

✅ Prevents cross-tenant collisions
✅ Maintains data isolation
✅ No "unknown" bucket of lost events

### 4. Concurrent Testing
```typescript
// Concurrent, not sequential
const results = await Promise.allSettled([
  handler(eventId),
  handler(eventId),
]);

// Verify exactly 1 record
expect(records).toHaveLength(1);
```

✅ Reveals race conditions in tests
✅ Verifies data integrity
✅ Tests stress (50+ requests)

---

## Implementation Patterns

### Pattern A: Webhook Event Deduplication
For: Stripe webhooks arriving twice (network retry)
```typescript
// Check global uniqueness BEFORE tenant extraction
const isGlobalDupe = await webhookRepo.isDuplicate('_global', eventId);
if (isGlobalDupe) return 200;

// Extract tenantId (fail fast if missing)
const tenantId = event.metadata?.tenantId;
if (!tenantId) throw new ValidationError('Missing tenantId');

// Record webhook atomically (unique constraint)
const isNew = await webhookRepo.recordWebhook({ tenantId, eventId });
if (!isNew) return 200; // Duplicate during recording

// Process webhook (only for new events)
await processWebhookEvent(event);
return 200;
```

### Pattern B: Idempotency Key Caching
For: Same API request called twice (client retry)
```typescript
// Generate deterministic key (same inputs = same key)
const key = generateIdempotencyKey(tenantId, packageId, email, date);

// Check cache (has this request been processed?)
const cached = await idempotencyService.get(key);
if (cached) return cached;

// Store key atomically
const isNew = await idempotencyService.store(key);
if (!isNew) {
  // Another request already processing, wait briefly
  await sleep(100);
  return await idempotencyService.get(key);
}

// Perform operation with idempotency key
const result = await stripeApi.create({ ...data, idempotencyKey: key });

// Cache response
await idempotencyService.set(key, result);
return result;
```

### Pattern C: Double-Booking Prevention
For: Two webhooks for same date arriving concurrently
```typescript
// Transaction prevents double-booking
const booking = await prisma.$transaction(async (tx) => {
  // Lock the row
  const existing = await tx.booking.findFirst({
    where: { tenantId, date: input.date }
  });
  if (existing) throw new BookingConflictError();

  // Create within same transaction
  return tx.booking.create({ data: { tenantId, date: input.date } });
});

// Database constraint also prevents
// @@unique([tenantId, date]) on Booking
```

---

## Code Review Essentials

### Red Flags (Stop and Require Changes)
```typescript
🚩 "Check if exists, then create" → RACE CONDITION
🚩 No unique constraint in database → RACE CONDITION
🚩 Generic catch block → WRONG ERROR HANDLING
🚩 Sequential tests only → RACE CONDITION HIDDEN
🚩 tenantId defaults to "unknown" → CROSS-TENANT COLLISION
🚩 Don't verify exactly 1 record → DATA CORRUPTION HIDDEN
```

### Approval Checklist
- ✅ Unique constraint exists (composite with tenantId)
- ✅ Code handles P2002 error specifically
- ✅ Concurrent test passes (2+ simultaneous)
- ✅ Exactly 1 record verified (not "at least 1")
- ✅ Stress test passes (50+ requests)
- ✅ tenantId never defaults to "unknown"
- ✅ Logging includes tenantId context
- ✅ Metrics configured (duplicate rate)
- ✅ Rollback plan documented

---

## Testing Strategy

### Test 1: Basic Concurrent (5 min)
```typescript
it('prevents duplicate webhooks', async () => {
  const results = await Promise.allSettled([
    handler(eventId),
    handler(eventId),
  ]);

  expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  expect(await db.find({ eventId })).toHaveLength(1);
});
```

### Test 2: High Concurrency (10 min)
```typescript
it('handles 10 concurrent requests', async () => {
  const requests = Array.from({ length: 10 }, () =>
    handler(eventId)
  );

  const results = await Promise.allSettled(requests);
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  expect(await db.find({ eventId })).toHaveLength(1);
});
```

### Test 3: Stress (15 min)
```typescript
it('handles 50 burst requests', async () => {
  const requests = Array.from({ length: 50 }, () =>
    handler(eventId)
  );

  await Promise.allSettled(requests);
  expect(await db.find({ eventId })).toHaveLength(1);
  // Also verify no deadlock, timeouts, or crashes
});
```

### Test 4: Tenant Isolation (10 min)
```typescript
it('isolates by tenant', async () => {
  // Same event ID, different tenants
  const results = await Promise.allSettled([
    handler(eventId, { tenantId: 'a' }),
    handler(eventId, { tenantId: 'b' }),
  ]);

  // Both should succeed
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);

  // But 2 records (different tenants, same event ID)
  expect(await db.find({ eventId })).toHaveLength(2);
});
```

---

## Monitoring & Observability

### Metrics to Track
```typescript
metrics.counter('webhook.duplicate_count', { event_type, tenant_id });
metrics.counter('webhook.race_conditions_prevented');
metrics.histogram('webhook.processing_time_ms', duration);
metrics.gauge('webhook.success_rate', successCount / totalCount);
```

### Log Patterns
```
INFO: Duplicate webhook detected { eventId, tenantId }
INFO: Webhook processed successfully { eventId, tenantId }
ERROR: Webhook processing failed { eventId, tenantId, error }
```

### Alerts
- Alert if `webhook.failed_count` spikes (>> expected)
- Alert if `webhook.processing_time_ms` > 2000ms
- Monitor dashboard for duplicate rate (should be > 0)

---

## Common Mistakes & How to Fix

| Mistake | Problem | Fix |
|---------|---------|-----|
| Check then create | Race condition window | Use database constraint |
| No unique constraint | Duplicates in database | Add @@unique in schema |
| Generic catch | Can't handle errors properly | Check error.code === 'P2002' |
| Sequential tests | Race condition hidden | Use Promise.allSettled |
| tenantId = "unknown" | Cross-tenant collisions | Fail fast if missing |
| Don't count records | Data corruption hidden | Verify records.length === 1 |
| Separate operations | Can get interrupted | Use transaction or constraint |
| No logging | Can't debug issues | Log with tenantId context |
| No monitoring | Silent failures | Configure metrics |

---

## Implementation Checklist

### Before Writing Code
- [ ] Read QUICK REFERENCE (5 min)
- [ ] Choose pattern (A, B, or C)
- [ ] Design database schema with unique constraint

### While Writing Code
- [ ] Create operation is atomic (one db call)
- [ ] Catch P2002 error specifically
- [ ] tenantId never defaults
- [ ] Return value is clear (bool or exception)
- [ ] Logging includes tenantId

### Before Testing
- [ ] Concurrent test (Promise.allSettled)
- [ ] High-concurrency test (10+)
- [ ] Stress test (50+)
- [ ] Tenant isolation test
- [ ] Verify exactly 1 record in each test

### Before Code Review
- [ ] Self-review with CODE REVIEW CHECKLIST
- [ ] All tests pass
- [ ] Monitoring configured
- [ ] Rollback plan documented

### During Code Review
- [ ] Reviewer uses CODE REVIEW CHECKLIST
- [ ] All 6 phases checked
- [ ] Approval criteria met
- [ ] No red flags remain

### Before Deployment
- [ ] Database migration created & tested
- [ ] Migration applied before code deploy
- [ ] Monitoring verified in staging
- [ ] Rollback plan documented

### After Deployment
- [ ] Monitor webhook_duplicate_count (should be > 0)
- [ ] Monitor error logs (should be minimal)
- [ ] Check processing latency (should be stable)

---

## File Structure

```
docs/solutions/
├── WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md   (1069 lines, 30KB)
│   └── Complete guide with 10 sections, patterns, examples
│
├── WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md         (300 lines, 7KB)
│   └── One-page cheat sheet, print & pin
│
├── WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md   (580 lines, 17KB)
│   └── 6-phase checklist for reviewers
│
├── WEBHOOK-IDEMPOTENCY-PREVENTION-INDEX.md        (394 lines, 15KB)
│   └── Navigation guide, decision tree, learning paths
│
├── WEBHOOK-IDEMPOTENCY-PREVENTION-SUMMARY.md      (this file)
│   └── Executive summary & quick reference

└── Related Files:
    ├── server/IDEMPOTENCY_IMPLEMENTATION.md
    │   └── Project-specific implementation details
    │
    ├── server/src/routes/webhooks.routes.ts
    │   └── Real webhook handler implementation
    │
    └── server/test/integration/webhook-race-conditions.spec.ts
        └── Real concurrent tests
```

---

## Quick Navigation

**I need to...**

| Goal | Document | Section |
|------|----------|---------|
| Implement a webhook handler | STRATEGIES | Pattern A |
| Implement idempotent caching | STRATEGIES | Pattern B |
| Review webhook code | CHECKLIST | All phases |
| Test for race conditions | STRATEGIES | Section 3 |
| Find a pattern quickly | QUICK REFERENCE | (search for ✅) |
| Debug a race condition | STRATEGIES | Section 7 |
| Migrate existing code | STRATEGIES | Section 8 |
| Set up monitoring | STRATEGIES | Section 6 |
| Onboard a new engineer | QUICK REFERENCE + STRATEGIES intro |
| Understand the architecture | STRATEGIES | Section 1 |

---

## Key Takeaway

> **Don't check then create. Let the database enforce uniqueness.**
>
> This one principle prevents all race conditions automatically:
> - No check-then-create window
> - Atomic constraint enforced at SQL level
> - Works for unlimited concurrent requests
> - Automatic error handling for duplicates

---

## Success Metrics

After implementing these prevention strategies:

✅ **Zero duplicate processing** (uniqueness enforced)
✅ **100% concurrent test coverage** (all handlers tested with Promise.allSettled)
✅ **Tenant isolation verified** (no cross-tenant collisions)
✅ **Clear error semantics** (duplicate vs error vs success)
✅ **Production visibility** (metrics showing duplicate rate)
✅ **Code review standardization** (team uses checklist)
✅ **Knowledge retention** (documentation for future reference)

---

## Questions & Support

**Q: Why use database constraints instead of application-level checks?**
A: Database constraints are atomic and handle unlimited concurrency. Application checks create a race window.

**Q: What if I can't modify the database schema?**
A: You need a unique constraint or the race condition will always exist. This is a hard requirement.

**Q: How do I test race conditions?**
A: Use `Promise.allSettled` to run requests concurrently. Count records - must be exactly 1.

**Q: What error code indicates a duplicate?**
A: P2002 (Prisma unique constraint violation). Check `error.code === 'P2002'`.

**Q: Do I always need to include tenantId?**
A: Yes, always. Composite key `[tenantId, eventId]` prevents cross-tenant collisions.

---

## Resources

- [Complete Prevention Strategies](./WEBHOOK-IDEMPOTENCY-PREVENTION-STRATEGIES.md) - 10 sections, full examples
- [Quick Reference](./WEBHOOK-IDEMPOTENCY-QUICK-REFERENCE.md) - 1 page, print & pin
- [Code Review Checklist](./WEBHOOK-IDEMPOTENCY-CODE-REVIEW-CHECKLIST.md) - 6 phases, approval criteria
- [Navigation Index](./WEBHOOK-IDEMPOTENCY-PREVENTION-INDEX.md) - Decision tree, learning paths
- [Project Implementation](../../../server/IDEMPOTENCY_IMPLEMENTATION.md) - Real code examples
- [Test Examples](../../../server/test/integration/webhook-race-conditions.spec.ts) - Concurrent tests
- [Webhook Handler](../../../server/src/routes/webhooks.routes.ts) - Real implementation

---

**Status:** Complete & Ready for Team Use
**Created:** 2025-12-01
**Version:** 1.0 (Initial comprehensive release)
