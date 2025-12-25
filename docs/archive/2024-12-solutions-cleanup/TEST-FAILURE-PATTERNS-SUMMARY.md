---
title: Test Failure Patterns - Executive Summary
category: testing
tags: [summary, quick-reference, test-reliability]
priority: P0
date: 2025-11-28
---

# Test Failure Patterns - Executive Summary

**Quick reference for the three critical test failure patterns and their fixes**

---

## Overview

During code review of the MAIS scheduling platform, we identified three recurring test failure patterns that cause flaky, non-deterministic test failures. This document provides a quick reference for prevention.

**Full Documentation:** [TEST-FAILURE-PREVENTION-STRATEGIES.md](./TEST-FAILURE-PREVENTION-STRATEGIES.md)

---

## The Three Patterns

### Pattern 1: Concurrent Transaction Contention

**Problem:** Tests running multiple database transactions in parallel cause timeouts and deadlocks.

**Symptoms:**

- Test timeouts in CI
- Non-deterministic failures
- "Transaction was deadlocked" errors
- Works locally, fails in CI

**Root Cause:**

```typescript
// ❌ BAD: Parallel execution for correctness test
await Promise.all([service.create(data1), service.create(data2), service.create(data3)]);
// Causes transaction contention!
```

**Fix:**

```typescript
// ✅ GOOD: Sequential execution
await service.create(data1);
await service.create(data2);
await service.create(data3);
```

**When to Use Parallel:**

- Stress tests (clearly marked)
- Load testing (with `Promise.allSettled()`)
- Independent tenants (no shared data)

---

### Pattern 2: Undefined Dependencies in Mock Mode

**Problem:** DI container returns `undefined` for dependencies, causing cleanup failures.

**Symptoms:**

- "Cannot read property of undefined" in `afterAll`
- Tests pass, cleanup fails
- Mock mode behaves differently than real mode
- Hard-to-debug null pointer exceptions

**Root Cause:**

```typescript
// ❌ BAD: Mock adapter missing from export
export function buildMockAdapters() {
  const catalogRepo = new MockCatalogRepository();
  return {
    catalogRepo,
    // Missing: webhookRepo, calendarProvider, etc.
  };
}

// Cleanup fails:
afterAll(async () => {
  await container.prisma?.$disconnect(); // prisma is undefined!
});
```

**Fix:**

```typescript
// ✅ GOOD: Export all mock instances
export function buildMockAdapters() {
  return {
    catalogRepo: new MockCatalogRepository(),
    bookingRepo: new MockBookingRepository(),
    blackoutRepo: new MockBlackoutRepository(),
    calendarProvider: new MockCalendarProvider(),
    paymentProvider: new MockPaymentProvider(),
    emailProvider: new MockEmailProvider(),
    userRepo: new MockUserRepository(),
    webhookRepo: new MockWebhookRepository(),
  };
}

// Safe cleanup:
afterAll(async () => {
  if (container.prisma) {
    await container.prisma.$disconnect();
  }
});
```

**Prevention:**

- Always export all mock instances
- Add guards before cleanup (`if (dep)`)
- Validate container in dev mode

---

### Pattern 3: Insufficient Timeouts for Bulk Operations

**Problem:** Tests creating many records exceed default 5s timeout.

**Symptoms:**

- Test timeouts on bulk operations
- Works with small data, fails with large
- Flaky under system load
- Different behavior on CI vs local

**Root Cause:**

```typescript
// ❌ BAD: No timeout for 50 operations
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await service.create({ slug: `pkg-${i}`, ... });
  }
}); // Default 5s timeout - will fail!
```

**Fix:**

```typescript
// ✅ GOOD: Explicit timeout
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await service.create({ slug: `pkg-${i}`, ... });
  }
}, 30000); // 30 second timeout

// ✅ BETTER: Batch operation
it('should create 50 packages', async () => {
  await prisma.package.createMany({
    data: packageData, // Batch insert
  });
}, 10000); // Faster with batch
```

**Timeout Guidelines:**

| Operation Size | Recommended Timeout |
| -------------- | ------------------- |
| 1-10 records   | Default (5s)        |
| 10-20 records  | 10s                 |
| 20-50 records  | 15-30s              |
| 50-100 records | 30-60s              |
| 100+ records   | Use batch + 60s     |

**Timeout Formula:**

```typescript
timeout = 5000 + recordCount * 200;

// Examples:
// 10 records  = 5000 + (10 * 200)  = 7000ms
// 50 records  = 5000 + (50 * 200)  = 15000ms
// 100 records = 5000 + (100 * 200) = 25000ms
```

---

## Quick Decision Trees

### Should I use Promise.all()?

```
Are you testing race conditions or concurrency handling?
  ├─ YES → Use Promise.allSettled(), expect conflicts
  └─ NO  → Use sequential await
```

### Do I need a guard in cleanup?

```
Is this dependency always defined?
  ├─ YES (real mode only) → No guard needed
  ├─ NO (optional/mock)   → Add guard: if (dep)
  └─ UNSURE              → Add guard (safer)
```

### What timeout should I use?

```
How many database operations?
  ├─ < 10   → Default (5s)
  ├─ 10-50  → 15-30s
  ├─ 50-100 → 30-60s
  └─ > 100  → Batch operation + 60s
```

---

## Code Review Red Flags

When reviewing PRs, watch for:

### 🚨 Red Flag 1: Promise.all in Integration Tests

```typescript
// ❌ RED FLAG
await Promise.all([
  service.create(...),
  service.create(...),
  service.create(...),
]);
```

**Ask:** "Is this testing concurrency, or can it be sequential?"

---

### 🚨 Red Flag 2: Cleanup Without Guards

```typescript
// ❌ RED FLAG
afterAll(async () => {
  await container.prisma.$disconnect();
  await container.cacheAdapter.disconnect();
});
```

**Ask:** "Are these dependencies guaranteed to exist in all modes?"

---

### 🚨 Red Flag 3: Bulk Operations Without Timeouts

```typescript
// ❌ RED FLAG
it('should create 50 records', async () => {
  for (let i = 0; i < 50; i++) {
    await service.create(...);
  }
}); // No timeout!
```

**Ask:** "Will this complete in 5 seconds under load?"

---

### 🚨 Red Flag 4: Incomplete Mock Exports

```typescript
// ❌ RED FLAG (in adapters/mock/index.ts)
export function buildMockAdapters() {
  return {
    catalogRepo: new MockCatalogRepository(),
    // Only one adapter exported?
  };
}
```

**Ask:** "Are all adapters exported from buildMockAdapters()?"

---

## Implementation Checklist

Use this checklist when writing integration tests:

```markdown
## Integration Test Checklist

### Execution Strategy

- [ ] Sequential await for correctness tests
- [ ] Parallel execution ONLY for stress tests
- [ ] Stress tests use Promise.allSettled()
- [ ] Stress tests clearly marked in test name

### Cleanup Safety

- [ ] Guards before all cleanup operations
- [ ] Finally blocks for guaranteed cleanup
- [ ] No assumptions about dependency existence

### Timeout Configuration

- [ ] Default timeout for < 10 operations
- [ ] Explicit timeout for 10+ operations
- [ ] Batch operations for 50+ records
- [ ] Suite-level timeouts for bulk test suites

### Mock Completeness

- [ ] All adapters exported from buildMockAdapters()
- [ ] Mock container shape matches real container
- [ ] No undefined dependencies in DI container
```

---

## Impact Metrics

**Before Prevention Strategies:**

- Test flakiness rate: 15-20%
- False negatives blocking deploys: 3-5 per week
- Developer time debugging flaky tests: 4-6 hours/week
- CI pipeline reruns due to timeouts: 20-30%

**After Prevention Strategies (Expected):**

- Test flakiness rate: < 2%
- False negatives: < 1 per week
- Debugging time: < 1 hour/week
- CI reruns: < 5%

**ROI:**

- Time saved: ~5 hours/week per engineer
- Faster deployments: 30-40% reduction in blocked PRs
- Improved confidence: Deterministic test results

---

## Next Steps

1. **Read Full Documentation**
   - [TEST-FAILURE-PREVENTION-STRATEGIES.md](./TEST-FAILURE-PREVENTION-STRATEGIES.md)

2. **Review Existing Tests**
   - Search for `Promise.all` in test files
   - Add guards to cleanup code
   - Add timeouts to bulk operation tests

3. **Update Test Helpers**
   - Create `calculateTimeout()` utility
   - Add `validateContainer()` dev mode check
   - Document in TESTING.md

4. **Training**
   - Share with team in #engineering
   - Add to onboarding checklist
   - Include in PR review guidelines

---

## Resources

- **Full Guide:** [TEST-FAILURE-PREVENTION-STRATEGIES.md](./TEST-FAILURE-PREVENTION-STRATEGIES.md)
- **Quick Reference:** [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md)
- **Index:** [PREVENTION-STRATEGIES-INDEX.md](./PREVENTION-STRATEGIES-INDEX.md)
- **Testing Guide:** `../../TESTING.md`

---

## FAQ

**Q: When is it OK to use Promise.all in tests?**
A: Only for stress tests that intentionally test concurrency, clearly marked with "(stress test)" in the name.

**Q: What if my cleanup code needs Prisma but it's undefined?**
A: Add a guard: `if (container.prisma) await container.prisma.$disconnect();`

**Q: How do I know what timeout to use?**
A: Count operations: < 10 = default, 10-50 = 15-30s, 50+ = batch + 30-60s

**Q: Should I use batch operations or sequential?**
A: Use batch for 50+ records. Sequential is fine for < 50.

**Q: What if my test is still flaky after these fixes?**
A: Check for: race conditions, shared test data, external service dependencies, timing-dependent logic

---

**Last Updated:** 2025-11-28
**Related Documents:**

- [TEST-FAILURE-PREVENTION-STRATEGIES.md](./TEST-FAILURE-PREVENTION-STRATEGIES.md) - Full guide
- [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md) - Daily reference
- [COMPREHENSIVE-PREVENTION-STRATEGIES.md](./COMPREHENSIVE-PREVENTION-STRATEGIES.md) - All strategies
