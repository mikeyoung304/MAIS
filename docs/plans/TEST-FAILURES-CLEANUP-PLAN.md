# Test Failures & Cleanup Plan

**Branch:** `fix/test-failures-and-cleanup`
**Created:** 2025-12-01
**Status:** Ready for implementation

## Overview

This plan addresses 17 failing tests and 6 skipped tests across the MAIS codebase. Issues are prioritized by severity and grouped by root cause for efficient fixing.

---

## P0 - Critical: Webhook Idempotency (2 failing tests)

### Problem
Concurrent webhook processing throws `BookingConflictError` instead of returning idempotently. Already-processed webhooks throw errors instead of succeeding silently.

### Files to Modify
- `server/src/routes/webhooks.routes.ts` (lines 113-304)

### Fix Strategy
1. Wrap duplicate detection + webhook recording in atomic operation
2. Catch `BookingConflictError` in webhook handler and treat as idempotent success
3. Check webhook status AFTER recording - if already PROCESSED/DUPLICATE, return 200 OK
4. Return 200 to Stripe even when booking already exists (idempotent behavior)

### Tests to Pass
- `webhook-race-conditions.spec.ts`: "should prevent duplicate webhook processing"
- `webhook-race-conditions.spec.ts`: "should return success for already-processed webhook"
- `webhook-race-conditions.spec.ts`: "should handle webhook retries from Stripe gracefully"

### Verification
```bash
npm test -- webhook-race-conditions
```

---

## P1-A - High: Cache Test Assertions (11 failing tests)

### Problem
Tests call `ctx.cache.cache.get()` without `await` but the method returns a Promise. Tests are checking Promise objects instead of actual cached values.

### Files to Modify
- `server/test/integration/segment.service.integration.spec.ts` (~20 instances)
- `server/test/integration/catalog-segment.integration.spec.ts` (~5 instances)

### Fix Strategy
Add `await` to all `ctx.cache.cache.get()` calls in test assertions:

```typescript
// Before (broken)
expect(ctx.cache.cache.get(key)).toBeUndefined();

// After (fixed)
expect(await ctx.cache.cache.get(key)).toBeUndefined();
```

### Lines to Fix in segment.service.integration.spec.ts
- 270, 326, 330, 340, 353, 375, 376, 381, 382, 404, 405, 410, 411, 429, 435, 439, 478, 479, 498, 511

### Tests to Pass
- `segment.service.integration.spec.ts`: All 9 cache behavior tests
- `catalog-segment.integration.spec.ts`: 2 cache behavior tests

### Verification
```bash
npm test -- segment.service.integration
npm test -- catalog-segment.integration
```

---

## P1-B - High: Catalog Referential Integrity Test (1 failing test)

### Problem
Test calls `getAddOnsByPackageId()` with a deleted package ID. The method correctly throws `NotFoundError` (security guard), but test expects empty array.

### Files to Modify
- `server/test/integration/catalog.repository.integration.spec.ts` (lines 503-504)

### Fix Strategy
Replace the assertion with direct Prisma query (matches how PackageAddOn is already tested):

```typescript
// Before (broken - method throws NotFoundError for deleted package)
const addOnsForPackage = await repository.getAddOnsByPackageId(testTenantId, pkg.id);
expect(addOnsForPackage).toHaveLength(0);

// After (fixed - query join table directly)
const packageAddOns = await ctx.prisma.packageAddOn.findMany({
  where: { packageId: pkg.id },
});
expect(packageAddOns).toHaveLength(0);
```

### Verification
```bash
npm test -- catalog.repository.integration
```

---

## P2 - Medium: Rate Limiter Test Bypass (2 failing tests)

### Problem
`loginLimiter` has no test environment bypass while other limiters do. Tests hit 429 Too Many Requests.

### Files to Modify
- `server/src/middleware/rateLimiter.ts` (line ~35)

### Fix Strategy
Add test bypass to `loginLimiter` matching other limiters:

```typescript
// Before
max: 5,

// After
max: process.env.NODE_ENV === 'test' ? 100 : 5,
```

### Tests to Pass
- `auth-prevention-tests.spec.ts`: "should use same credentials in seed and signup"
- `auth-prevention-tests.spec.ts`: "should not have stale credentials in tests"

### Verification
```bash
npm test -- auth-prevention-tests
```

---

## P3 - Low: Remove Dead Skipped Tests (4 to remove)

### Files to Modify

#### 1. `server/test/integration/auth-prevention-tests.spec.ts`
- **Remove lines 554-589**: "should allow user to test frontend with backend credentials"
  - Reason: Redundant, covered by other tests

#### 2. `server/test/adapters/prisma/user.repository.spec.ts`
- **Remove lines 119-197**: Three `describe.skip` blocks (create, update, delete)
  - Reason: Methods will never be implemented; User model is only for platform admins created via seed

### Tests to Keep Skipped
- "should handle full user lifecycle" - Useful manual regression test
- "should maintain data integrity with concurrent operations" - Useful manual stress test

### Verification
```bash
npm test -- user.repository.spec
npm test -- auth-prevention-tests
```

---

## P4 - Tech Debt: Document TODOs (No code changes)

These TODOs are confirmed still relevant but not blocking. Document for future sprints:

1. **CSP nonce** (`app.ts:43`) - Security hardening, Phase 3
2. **Auth context integration** (`catalog.service.ts:31`) - Refactor to use `res.locals.tenantAuth`
3. **Customer management** (`booking.service.ts:608`) - Implement CustomerRepository/Service

---

## Implementation Order

| Step | Priority | Task | Tests Fixed | Est. Complexity |
|------|----------|------|-------------|-----------------|
| 1 | P1-A | Add `await` to cache test assertions | 11 | Low |
| 2 | P1-B | Fix catalog referential integrity test | 1 | Low |
| 3 | P2 | Add test bypass to loginLimiter | 2 | Low |
| 4 | P3 | Remove dead skipped tests | - | Low |
| 5 | P0 | Fix webhook idempotency | 3 | Medium |

**Note:** P0 is done last because it's the most complex and benefits from having all other tests green first for easier verification.

---

## Success Criteria

```bash
# All tests pass
npm test

# Expected output:
# Test Files  0 failed | 51 passed
# Tests       0 failed | ~900 passed | 2 skipped
```

---

## Rollback Plan

If issues arise:
```bash
git checkout main
git branch -D fix/test-failures-and-cleanup
```
