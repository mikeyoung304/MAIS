# TEST INFRASTRUCTURE FIX PLAN

**Created**: 2025-11-12
**Purpose**: Fix failing tests and set up Playwright E2E testing
**Estimated Time**: 3-4 hours total
**Priority**: Medium (post-MVP)

---

## CONTEXT FOR NEW SESSION

You're working on the Elope Wedding Platform. The MVP is functional and ready to launch, but the test suite needs maintenance after recent refactoring. This plan provides a systematic approach to fix all test issues.

### Current Test Status

- **Integration Tests**: ✅ 98% passing (1 flaky timeout)
- **Unit Tests**: ❌ 69% passing (50 failures due to outdated mocks)
- **E2E Tests**: ❌ Cannot run (Playwright not installed)

### Project Structure

```
/Users/mikeyoung/CODING/Elope/
├── server/          # Backend (Node.js, Express, Prisma)
│   └── test/        # Unit & integration tests (Vitest)
├── client/          # Frontend (React, Vite)
├── e2e/            # End-to-end tests (Playwright)
│   └── tests/
│       ├── booking-flow.spec.ts
│       ├── admin-flow.spec.ts
│       └── booking-mock.spec.ts
└── package.json    # Root workspace
```

---

## PHASE 1: FIX UNIT TESTS (1.5 hours)

### Problem

50 unit tests failing in `/server/test/` due to:

1. Service method signatures changed (now require `tenantId`)
2. Mock repository methods returning wrong shapes
3. Test fixtures using old data structures

### Step-by-Step Fix

#### 1.1 Fix Catalog Service Tests

```bash
cd /Users/mikeyoung/CODING/Elope/server
```

**File**: `test/catalog.service.spec.ts`

**Issues to Fix**:

- All service methods now require `tenantId` as first parameter
- Mock repository methods need proper return shapes
- Package creation now returns different structure

**Fix Pattern**:

```typescript
// OLD (failing)
await catalogService.getPackageBySlug('test-slug');

// NEW (correct)
await catalogService.getPackageBySlug('test-tenant', 'test-slug');

// OLD mock
getPackageBySlug: vi.fn().mockResolvedValue(mockPackage);

// NEW mock
getPackageBySlug: vi.fn().mockResolvedValue({
  ...mockPackage,
  tenantId: 'test-tenant',
  addOns: [],
});
```

#### 1.2 Fix Booking Service Tests

**File**: `test/booking.service.spec.ts`

**Issues**:

- Missing `tenantId` in service calls
- `createCheckout` expects different parameters
- Mock stripe client not returning proper session shape

**Fix Pattern**:

```typescript
// Update all service calls to include tenantId
await bookingService.createCheckout('test-tenant', {
  packageId: 'pkg-1',
  addOnIds: [],
  // ... rest of params
});
```

#### 1.3 Fix Availability Service Tests

**File**: `test/availability.service.spec.ts`

**Issue**: Date parameter not being passed correctly

**Fix**:

```typescript
// The service expects (tenantId, date) but tests are passing (date) only
// Update all calls to include tenantId
```

#### 1.4 Fix Webhook Controller Tests

**File**: `test/controllers/webhooks.controller.spec.ts`

**Issue**: Stripe session validation too strict

**Fix**:

```typescript
// Mock needs complete Stripe session structure
const mockStripeSession = {
  id: 'cs_test_123',
  payment_status: 'paid',
  metadata: {
    tenantId: 'test-tenant',
    packageId: 'pkg-1',
    bookingDate: '2025-07-01',
    coupleName: 'Test Couple',
    coupleEmail: 'test@example.com',
    addOnIds: JSON.stringify([]),
  },
  amount_total: 50000,
};
```

### Verification

```bash
# Run only unit tests (not integration)
npm test -- --run --exclude="test/integration/**"

# Should see ~160 passing tests
```

---

## PHASE 2: FIX FLAKY INTEGRATION TEST (30 min)

### Problem

One integration test intermittently times out:

- `test/integration/catalog.repository.integration.spec.ts`
- Test: "should handle empty descriptions"

### Fix

#### 2.1 Add Explicit Timeout

```typescript
// In catalog.repository.integration.spec.ts
describe('Data Integrity', () => {
  // Increase timeout for this suite
  beforeEach(async () => {
    // ... existing setup
  }, 30000); // Add 30 second timeout

  afterEach(async () => {
    await prisma.$disconnect();
  }, 30000); // Add timeout here too
```

#### 2.2 Ensure Proper Cleanup

```typescript
afterEach(async () => {
  // Clean up test data first
  await prisma.package.deleteMany({
    where: { tenantId: testTenantId },
  });

  // Then disconnect
  await prisma.$disconnect();
});
```

### Verification

```bash
# Run integration tests 3 times to verify no flakiness
npm run test:integration
npm run test:integration
npm run test:integration

# All 3 runs should pass
```

---

## PHASE 3: SET UP PLAYWRIGHT (45 min)

### 3.1 Install Playwright

```bash
cd /Users/mikeyoung/CODING/Elope

# Install Playwright and browsers
npx playwright install chromium
npx playwright install-deps  # System dependencies if needed

# Verify installation
npx playwright --version
```

### 3.2 Create Missing Client .env

```bash
cd client
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_APP_MODE=mock
VITE_E2E=1
EOF
```

### 3.3 Fix Playwright Config

**File**: `e2e/playwright.config.ts`

Check and fix:

1. Correct `webServer` command
2. Proper environment variables
3. Correct base URLs

```typescript
webServer: {
  command: 'cd .. && npm run dev:all',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
}
```

### 3.4 Run E2E Tests

```bash
# From root directory
npm run test:e2e

# Or with UI for debugging
npm run test:e2e:ui
```

### 3.5 Fix Any E2E Test Issues

Common issues and fixes:

**Selector Problems**:

```typescript
// If selectors changed, update them
// OLD
await page.getByRole('button', { name: /View Packages/i });

// NEW (if button text changed)
await page.getByRole('button', { name: /Browse Packages/i });
```

**Timing Issues**:

```typescript
// Add explicit waits where needed
await page.waitForLoadState('networkidle');
await page.waitForSelector('.package-card', { timeout: 10000 });
```

**Mock vs Real Mode**:

```typescript
// Ensure tests work in both modes
const isRealMode = process.env.VITE_APP_MODE === 'real';
if (isRealMode) {
  // Different assertions for real data
}
```

---

## PHASE 4: CREATE TEST DOCUMENTATION (30 min)

### 4.1 Create Test README

````bash
cat > /Users/mikeyoung/CODING/Elope/TEST_README.md << 'EOF'
# Elope Platform - Test Guide

## Quick Start

### Run All Tests
```bash
# Unit tests only
npm test

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# Everything
npm test && npm run test:integration && npm run test:e2e
````

## Test Structure

### Unit Tests (`/server/test/*.spec.ts`)

- Test business logic in isolation
- Mock all external dependencies
- Fast execution (<1 second per test)

### Integration Tests (`/server/test/integration/*.spec.ts`)

- Test database operations
- Use real Prisma client with test database
- Test transactions and concurrency

### E2E Tests (`/e2e/tests/*.spec.ts`)

- Test complete user journeys
- Run against real browser
- Test both customer and admin flows

## Common Issues & Solutions

### Issue: Tests fail with "tenantId" errors

**Solution**: All service methods now require tenantId as first parameter

### Issue: Playwright tests won't run

**Solution**: Install browsers: `npx playwright install chromium`

### Issue: Integration tests timeout

**Solution**: Ensure test database is running: `docker-compose up -d postgres`

### Issue: Mock data not loading

**Solution**: Check ADAPTERS_PRESET=mock in server/.env

## Continuous Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run tests
  run: |
    npm test
    npm run test:integration
    npx playwright install chromium
    npm run test:e2e
```

EOF

````

### 4.2 Update Package.json Scripts
```json
{
  "scripts": {
    "test:all": "npm test && npm run test:integration && npm run test:e2e",
    "test:unit": "vitest run --exclude='test/integration/**'",
    "test:fix": "vitest run --reporter=verbose --no-coverage"
  }
}
````

---

## PHASE 5: VERIFICATION CHECKLIST

### Final Test Run

```bash
cd /Users/mikeyoung/CODING/Elope

# 1. Start fresh
pkill -f "vite|vitest|playwright"

# 2. Install dependencies
npm install

# 3. Set up test database
cd server
cp .env.test.example .env.test
npm run prisma:generate

# 4. Run all test suites
cd ..
npm test                    # ✅ Should see ~160 passing
npm run test:integration    # ✅ Should see ~40 passing
npm run test:e2e           # ✅ Should see 6 passing

# 5. Generate coverage report
cd server && npm run coverage
```

### Success Criteria

- [ ] All unit tests passing (0 failures)
- [ ] All integration tests passing (0 flaky)
- [ ] All E2E tests passing in both mock and real mode
- [ ] Test documentation created
- [ ] CI/CD pipeline updated

---

## TROUBLESHOOTING

### If Unit Tests Still Fail

1. Check if any database migrations were run recently
2. Verify mock data matches current schema: `server/prisma/schema.prisma`
3. Run tests individually to isolate issues: `npm test -- availability.service.spec.ts`

### If Integration Tests Fail

1. Ensure test database is clean: `npm run prisma:reset`
2. Check DATABASE_URL_TEST in `.env.test`
3. Look for connection pool issues in logs

### If E2E Tests Fail

1. Ensure services are running: `npm run dev:all`
2. Check browser console for errors: `npm run test:e2e:headed`
3. Take screenshots on failure for debugging

---

## TIME ESTIMATES

- **Phase 1 (Unit Tests)**: 1.5 hours
- **Phase 2 (Integration)**: 30 minutes
- **Phase 3 (Playwright)**: 45 minutes
- **Phase 4 (Documentation)**: 30 minutes
- **Phase 5 (Verification)**: 30 minutes

**Total**: ~3.5 hours

---

## PRIORITY ORDER

If time is limited, fix in this order:

1. **HIGH**: E2E tests (Phase 3) - Most valuable for regression testing
2. **MEDIUM**: Unit tests for critical services (booking, payment)
3. **LOW**: All other unit tests
4. **LOW**: Flaky integration test

---

## SUCCESS METRIC

You'll know you're done when:

```bash
npm run test:all  # Shows 0 failures across all test suites
```

Good luck! The codebase is solid - these are just test maintenance issues, not production bugs.
