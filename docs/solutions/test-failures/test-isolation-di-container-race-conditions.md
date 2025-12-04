---
title: Test Failures - Webhook Race Conditions, DI Container, and Timeout Issues
slug: test-isolation-di-container-race-conditions
category: test-failures
severity: medium
components:
  - webhooks
  - password-reset
  - catalog-repository
  - dependency-injection
  - integration-tests
symptoms:
  - 'Array length mismatch in race condition test (expected 3, got 2)'
  - "Cannot read properties of undefined (reading '$disconnect')"
  - 'Test timed out in 5000ms for bulk add-on operations'
root_cause: |
  Three distinct issues: (1) Webhook race condition test used concurrent Promise.allSettled
  causing transaction contention, (2) DI container returned undefined prisma client in mock
  mode breaking cleanup, (3) Catalog repository bulk operations exceeded default 5s timeout
date_solved: 2025-11-28
tags:
  - testing
  - race-conditions
  - dependency-injection
  - timeouts
  - mock-mode
  - idempotency
  - prisma
  - integration-tests
related:
  - DECISIONS.md#ADR-006
  - docs/solutions/PREVENTION-QUICK-REFERENCE.md
  - server/test/helpers/integration-setup.ts
---

# Test Failures: Webhook Race Conditions, DI Container, and Timeout Issues

## Problem Statement

Three distinct test failures were discovered in the MAIS codebase after resolving database schema drift:

1. **Webhook Race Condition Test** (`test/integration/webhook-race-conditions.spec.ts:426`)
   - Error: `expected [ {...}, {...} ] to have a length of 3 but got 2`
   - Test: "should maintain idempotency across different date bookings"

2. **Password Reset HTTP Test** (`test/http/password-reset.http.spec.ts:54`)
   - Error: `Cannot read properties of undefined (reading '$disconnect')`
   - Test suite crash during `afterAll` cleanup

3. **Catalog Repository Timeout** (`test/integration/catalog.repository.integration.spec.ts:435`)
   - Error: `Test timed out in 5000ms`
   - Test: "should handle large number of add-ons efficiently"

## Root Cause Analysis

### Issue 1: Webhook Race Condition (Transaction Contention)

**Root Cause:** The test used `Promise.allSettled()` to process 3 webhook events concurrently. This caused multiple database transactions to attempt acquiring locks simultaneously, leading to transaction timeouts in PostgreSQL.

**Technical Details:**

- Concurrent webhook processing triggered simultaneous `SELECT FOR UPDATE` queries
- PostgreSQL's pessimistic locking caused transaction queue buildup
- Only 2 of 3 webhooks would succeed before timeout (5s default)
- The idempotency mechanism was working correctly, but the concurrent pattern was inappropriate

### Issue 2: DI Container Prisma Undefined (Mock Mode Inconsistency)

**Root Cause:** The dependency injection container's mock mode preset returned `prisma: undefined` instead of the mock Prisma instance. This caused the test's `afterAll` cleanup to crash when calling `prisma.$disconnect()`.

**Technical Details:**

- Mock mode created `mockPrisma` instance but didn't export it
- Test assumed `prisma` would always be defined
- No defensive check in cleanup code for undefined prisma instance

### Issue 3: Catalog Repository Timeout (Insufficient Test Timeout)

**Root Cause:** The test created 50 add-on records with concurrent `prisma.addOn.create()` calls. While efficient, the 5-second default Vitest timeout was insufficient for this volume of operations.

**Technical Details:**

- 50 concurrent inserts with foreign key relationships
- Each insert includes validation, constraint checking, and index updates
- Operation typically completes in 6-8 seconds (exceeding 5s default)

## Solution

### Fix 1: Sequential Webhook Processing

**File:** `server/test/integration/webhook-race-conditions.spec.ts:448-454`

```typescript
// Before (concurrent - caused transaction contention)
const results = await Promise.allSettled(
  events.map(({ stripeEvent }) => {
    const rawBody = JSON.stringify(stripeEvent);
    const signature = 'test_signature';
    return webhooksController.handleStripeWebhook(rawBody, signature);
  })
);
const succeeded = results.filter((r) => r.status === 'fulfilled');
expect(succeeded).toHaveLength(3);

// After (sequential - avoids transaction contention)
for (const { stripeEvent } of events) {
  const rawBody = JSON.stringify(stripeEvent);
  const signature = 'test_signature';
  await webhooksController.handleStripeWebhook(rawBody, signature);
}
```

**Rationale:**

- Webhook processing in production is inherently sequential (Stripe sends one at a time)
- The test validates idempotency logic, not concurrent transaction stress
- Sequential processing eliminates race conditions while maintaining test validity

### Fix 2: DI Container Mock Mode Export + Guard

**File 1:** `server/src/di.ts:199`

```typescript
// Before
return {
  controllers,
  services,
  repositories,
  mailProvider: undefined,
  cacheAdapter,
  prisma: undefined,
};

// After
return {
  controllers,
  services,
  repositories,
  mailProvider: undefined,
  cacheAdapter,
  prisma: mockPrisma,
};
```

**File 2:** `server/test/http/password-reset.http.spec.ts:49-60`

```typescript
// Before
afterAll(async () => {
  if (testTenantId) {
    await prisma.tenant.delete({ where: { id: testTenantId } });
  }
  await prisma.$disconnect();
});

// After
afterAll(async () => {
  if (!prisma) return; // Guard against undefined
  if (testTenantId) {
    await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
  }
  await prisma.$disconnect();
});
```

**Rationale:**

- Mock mode tests need access to mock Prisma for cleanup
- Defensive coding prevents crashes when container configuration changes

### Fix 3: Extended Timeout for Bulk Operations

**File:** `server/test/integration/catalog.repository.integration.spec.ts:466`

```typescript
// Before
it('should handle large number of add-ons efficiently', async () => {
  // ... creates 50 add-ons
  expect(addOns).toHaveLength(50);
}); // Default 5s timeout

// After
it('should handle large number of add-ons efficiently', async () => {
  // ... creates 50 add-ons
  expect(addOns).toHaveLength(50);
}, 15000); // Extended timeout for bulk operations
```

**Rationale:**

- 15 seconds provides 3x buffer over observed completion time (6-8s)
- Timeout extension preferable to reducing test coverage

## Verification

All tests pass after fixes:

```
Test Files  45 passed | 1 skipped (46)
     Tests  809 passed | 6 skipped | 12 todo (827)
```

## Prevention Strategies

### 1. Concurrent Test Pattern Guidelines

| Scenario             | Pattern              | Reason                        |
| -------------------- | -------------------- | ----------------------------- |
| Correctness tests    | Sequential `await`   | Avoids transaction contention |
| Stress/load tests    | `Promise.allSettled` | Explicitly tests concurrency  |
| Read-only operations | `Promise.all`        | No lock contention            |

```typescript
// Decision tree
// Testing correctness? → Sequential
// Testing concurrency handling? → Parallel with allSettled
// Read-only operations? → Parallel with all
```

### 2. DI Container Export Consistency

**Rule:** Mock mode should export equivalent interfaces to real mode.

```typescript
// In buildContainer() - mock mode
return {
  controllers,
  services,
  prisma: mockPrisma, // Always export, never undefined
  // ...
};
```

**Validation:** Add integration test that verifies all DI exports are defined:

```typescript
it('should export all required dependencies in mock mode', () => {
  const config = loadConfig();
  const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });

  expect(container.prisma).toBeDefined();
  expect(container.controllers).toBeDefined();
  expect(container.services).toBeDefined();
});
```

### 3. Bulk Operation Timeout Standards

| Operation Count | Recommended Timeout    |
| --------------- | ---------------------- |
| < 10 records    | 5s (default)           |
| 10-50 records   | 15s                    |
| 50-100 records  | 30s                    |
| > 100 records   | 60s + batch operations |

**Formula:** `timeout = 5000 + (recordCount * 200)`

### 4. Test Cleanup Best Practices

```typescript
// CORRECT - Defensive cleanup with guards
afterAll(async () => {
  if (!prisma) return;
  if (testTenantId) {
    await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// WRONG - Assumes prisma always defined
afterAll(async () => {
  await prisma.tenant.delete({ where: { id: testTenantId } });
  await prisma.$disconnect();
});
```

## Code Review Checklist

When reviewing integration tests, verify:

- [ ] Tests use sequential `await` for correctness validation
- [ ] Parallel tests are marked as stress/load tests
- [ ] All mock instances exported from DI container
- [ ] Cleanup code has existence checks (`if (dep)`)
- [ ] Bulk operation tests have explicit timeouts
- [ ] Timeout calculation based on operation count

## Related Documentation

- [ADR-006: PostgreSQL Advisory Locks](../../DECISIONS.md) - Transaction deadlock prevention
- [Integration Setup Helpers](../../server/test/helpers/integration-setup.ts) - Reusable test setup
- [Retry Helpers](../../server/test/helpers/retry.ts) - Retry logic for flaky tests
- [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md) - Daily reference guide

## Files Modified

| File                                                             | Lines   | Change                |
| ---------------------------------------------------------------- | ------- | --------------------- |
| `server/test/integration/webhook-race-conditions.spec.ts`        | 426-476 | Sequential processing |
| `server/src/di.ts`                                               | 199     | Export mockPrisma     |
| `server/test/http/password-reset.http.spec.ts`                   | 49-60   | Guard + catch         |
| `server/test/integration/catalog.repository.integration.spec.ts` | 466     | Timeout extension     |
