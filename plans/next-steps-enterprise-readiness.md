# MAIS Next Steps - Enterprise Readiness

**Date:** 2024-12-25
**Status:** Phase 2 mostly complete, planning Phase 3

---

## What's Done

| Item                           | Status | Commit  |
| ------------------------------ | ------ | ------- |
| Archive 58 redundant docs      | Done   | f7be6e5 |
| ESLint no-console rule         | Done   | dbe0ab8 |
| ErrorBoundary component        | Done   | dbe0ab8 |
| Accessibility tests (axe-core) | Done   | dbe0ab8 |

---

## Current Blocker: Test Isolation

**Problem:** Tests pass individually but fail together (39 failures in parallel, 0 alone)

**Root Cause:** Database state pollution between integration tests

**Options:**

### Option A: Run Tests Serially (Quick Fix)

```bash
# Add to package.json scripts
"test:serial": "vitest --pool=forks --poolOptions.forks.singleFork"
```

- Pros: Works immediately
- Cons: Slower CI (~3x longer)

### Option B: Fix Test Isolation (Proper Fix)

Each test file needs:

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE "Booking" CASCADE`;
  // Reset relevant tables
});
```

- Pros: Tests can run in parallel
- Cons: 2-4 hours of work

### Option C: Separate Test Database Per Worker

```typescript
// vitest.config.ts
globalSetup: './test/setup-parallel-dbs.ts';
```

- Pros: Full isolation
- Cons: Complex setup, more resources

**Recommendation:** Option A now (unblock CI), Option B later (sprint task)

---

## Priority Actions

### P0: Unblock CI (Today - 30 min)

1. Add serial test script to package.json
2. Update CI workflow to use serial tests
3. Verify all tests pass

### P1: Stripe Connect E2E (This Week - 4 hrs)

Critical business flow with no test coverage:

- `e2e/tests/stripe-connect.spec.ts`
- Test onboarding redirect
- Test dashboard status display

### P2: Photo Upload E2E (This Week - 2 hrs)

- `e2e/tests/package-photos.spec.ts`
- Test upload, ordering, deletion

### P3: Component Tests (Next Week)

Add Vitest component tests for:

- StripeConnectCard.tsx
- PhotoUploader.tsx
- BrandingEditor.tsx

---

## Decision Needed

**Question:** How do you want to proceed?

1. **Fix tests first** - Run serial, unblock CI, then tackle new tests
2. **Skip to features** - Accept test flakiness, focus on new E2E coverage
3. **Parallel track** - Serial tests now + start Stripe Connect E2E

---

## Commands Reference

```bash
# Run tests serially (workaround)
npm test -- --pool=forks --poolOptions.forks.singleFork

# Run single test file
npm test -- test/http/packages.test.ts

# Run E2E tests
npm run test:e2e

# Run accessibility tests only
npm run test:e2e -- e2e/tests/accessibility.spec.ts
```

---

## Files Changed This Session

```
client/src/components/ErrorBoundary.tsx  (new)
client/src/main.tsx                      (modified)
e2e/tests/accessibility.spec.ts          (new)
server/.eslintrc.json                    (modified)
scripts/archive-redundant-docs.sh        (new)
plans/enterprise-readiness-synthesized.md (new)
docs/archive/2024-12-solutions-cleanup/  (58 files moved)
```
