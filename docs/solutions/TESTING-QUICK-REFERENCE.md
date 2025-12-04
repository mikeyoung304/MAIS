# Testing Prevention - Quick Reference Card

Print and pin this card to your desk!

---

## When to Write Tests

### ALWAYS Write Tests For:

- [ ] New seed functions (`server/prisma/seeds/*.ts`)
- [ ] Critical UI routes (`client/src/features/storefront/`, `/signup`, `/booking`)
- [ ] Service business logic (`server/src/services/`)
- [ ] Database transactions (multi-step operations)
- [ ] Error scenarios (what can go wrong?)

### Test Types by Module:

| Module        | Unit Test | Integration | E2E | Coverage |
| ------------- | --------- | ----------- | --- | -------- |
| Seed function | ✅        | ✅          | -   | 80%+     |
| Service layer | ✅        | ✅          | -   | 75%+     |
| UI component  | ✅        | -           | ✅  | 70%+     |
| API route     | -         | ✅          | ✅  | 75%+     |
| Middleware    | ✅        | ✅          | -   | 80%+     |

---

## Test Checklist by Change Type

### Changing a Seed Function?

```bash
# Verify test file exists
ls server/test/seeds/{name}.test.ts

# Run tests
npm test -- server/test/seeds/{name}.test.ts

# Test idempotency
npm run db:seed:production
npm run db:seed:production  # Should not error
```

**Test file must have:**

- [x] Environment variable validation tests
- [x] Idempotency tests (running twice = no duplicates)
- [x] Error handling tests
- [x] Security guard tests (passwords hashed, keys random)

### Changing UI (StoreFront, Booking, etc)?

```bash
# Check E2E test exists
ls e2e/tests/{feature}.spec.ts

# Run E2E tests
npm run test:e2e -- e2e/tests/{feature}.spec.ts

# Test on different screen sizes
npm run test:e2e:headed  # See browser
```

**Test file must have:**

- [x] Happy path (data loads, user completes action)
- [x] Error states (network error, 404, 500)
- [x] Responsive layout (mobile, tablet, desktop)
- [x] Navigation flows

### Changing a Service?

```bash
# Run unit tests (mocked)
npm test -- src/services/{name}.service.test.ts

# Run integration tests (real database)
npm run test:integration -- test/services/{name}.integration.spec.ts

# Check coverage
npm run test:coverage -- src/services/{name}.service.ts
```

**Tests must verify:**

- [x] Happy path works
- [x] Error paths throw custom domain errors
- [x] Multi-tenant queries scoped by `tenantId`
- [x] No race conditions (pessimistic locks)

---

## Pre-Commit Checklist

Before committing:

```bash
# Run all pre-commit checks
npm run test:unit              # Unit tests (fast)
npm run typecheck              # Type checking (fast)
./scripts/validate-docs.sh     # Documentation (fast)

# Run full test suite (if changed critical modules)
npm test                       # All tests
npm run test:coverage          # With coverage

# Test seed idempotency (if changed seed)
npm run db:seed:dev
npm run db:seed:dev            # Should not error
```

**Pre-commit gates:**

- [ ] Unit tests passing
- [ ] TypeScript errors fixed
- [ ] Documentation validated
- [ ] Seed idempotency verified (if applicable)
- [ ] E2E tests updated (if UI changed)

---

## Test Patterns

### Seed Test Pattern

```typescript
describe('Seed Function', () => {
  describe('Environment Variables') {
    it('should throw when required var missing');
    it('should include helpful error message');
  }

  describe('Idempotency') {
    it('should use upsert, not create');
    it('should not modify existing records');
  }

  describe('Data Creation') {
    it('should create correct tenant/user');
    it('should set all fields correctly');
  }

  describe('Error Handling') {
    it('should handle constraint violations');
    it('should wrap Prisma errors');
  }

  describe('Security') {
    it('should hash passwords');
    it('should generate random keys');
  }
});
```

### Service Test Pattern

```typescript
describe('MyService', () => {
  describe('Happy Path', () => {
    it('should do the thing correctly');
  });

  describe('Multi-Tenant Scoping', () => {
    it('should filter by tenantId');
    it('should not leak cross-tenant data');
  });

  describe('Error Paths', () => {
    it('should throw DomainError on conflict');
    it('should throw DomainError on invalid input');
  });

  describe('Race Conditions', () => {
    it('should prevent double bookings');
    it('should use pessimistic locks');
  });
});
```

### E2E Test Pattern

```typescript
test.describe('Feature', () => {
  test.describe('Happy Path', () => {
    test('should load and display data');
    test('should complete user action');
  });

  test.describe('Error States', () => {
    test('should show error on network failure');
    test('should show error on 404');
  });

  test.describe('Responsive', () => {
    test('should work on mobile');
    test('should work on tablet');
    test('should work on desktop');
  });

  test.describe('Navigation', () => {
    test('should navigate to detail page');
    test('should support deep linking');
  });
});
```

---

## Common Commands

### Running Tests

```bash
# Unit tests only (fast, ~10s)
npm run test:unit

# All tests with coverage
npm run test:coverage

# Specific test file
npm test -- server/test/seeds/platform.test.ts

# Tests matching pattern
npm test -- --grep "idempotency"

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed

# E2E with UI
npm run test:e2e:ui
```

### Seed Commands

```bash
# Run seed in dev mode (platform + demo)
npm run db:seed:dev

# Run only platform admin seed
SEED_MODE=production npm run db:seed

# Run only demo seed
SEED_MODE=demo npm run db:seed

# Run E2E seed (test tenant)
npm run db:seed:e2e

# Test idempotency
npm run db:seed:dev && npm run db:seed:dev  # Should not error
```

### Database

```bash
# Fresh database
cd server
npm exec prisma migrate reset

# See database with UI
npm exec prisma studio

# Create migration after schema change
npm exec prisma migrate dev --name my_change

# Run specific migration
npm exec prisma migrate deploy
```

---

## Red Flags in Code Review

### Watch For:

❌ **No tests for new code**

- Require tests for new seeds, services, routes, UI

❌ **Seed without idempotency tests**

- Seeds MUST use upsert and have idempotency tests

❌ **UI changes without E2E tests**

- Critical paths must have E2E coverage

❌ **Missing `tenantId` filter in queries**

- All queries must be scoped by `tenantId`

❌ **Tests that only mock**

- Unit tests can mock, but integration tests should use real DB

❌ **No error path testing**

- Test both happy path AND what can go wrong

❌ **Hardcoded values in seeds**

- Use environment variables or sensible defaults

---

## CI Pipeline

Current jobs (all must pass):

1. ✅ Documentation validation
2. ✅ Multi-tenant pattern validation
3. ✅ Linting & formatting
4. ✅ TypeScript type checking
5. ✅ Unit tests
6. ✅ Integration tests
7. ✅ **Seed tests** (NEW)
8. ✅ E2E tests
9. ✅ Build validation

**PR won't merge if any job fails!**

---

## Troubleshooting

### "Pre-commit hook failed"

```bash
# Make sure hooks are installed
npx husky install

# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/seed-validation
```

### "Tests pass locally but fail in CI"

```bash
# Use same Node version as CI (20.x)
node --version

# Set required env vars
export NODE_ENV=test
export JWT_SECRET=test-secret
export TENANT_SECRETS_ENCRYPTION_KEY=0123456789abcdef...

# Run same test command as CI
npm run test:unit
npm run test:integration
```

### "Idempotency test failing"

```bash
# Verify seed uses upsert
grep -n "upsert\|findUnique" server/prisma/seeds/your-seed.ts

# Check for duplicate-creating patterns
grep -n "\.create(" server/prisma/seeds/your-seed.ts

# Test idempotency manually
npm run db:seed:dev
npm run db:seed:dev  # Should not error on 2nd run
```

---

## Coverage Targets

| Metric     | Current | Target |
| ---------- | ------- | ------ |
| Lines      | 42%     | 80%    |
| Branches   | 77%     | 75% ✅ |
| Functions  | 37%     | 80%    |
| Statements | 42%     | 80%    |

**Critical modules (must be 80%+):**

- `server/src/middleware/tenant.ts` - Multi-tenant scoping
- `server/src/services/booking.service.ts` - Double-booking prevention
- `server/prisma/seeds/` - Database initialization
- `client/src/features/storefront/` - Critical UI

---

## Key Documents

For full details, see:

- `docs/solutions/TESTING-PREVENTION-STRATEGIES.md` - Comprehensive strategies
- `docs/solutions/TESTING-IMPLEMENTATION-GUIDE.md` - Step-by-step implementation
- `docs/TESTING.md` - Testing guide
- `CLAUDE.md` - Project standards and patterns

---

## Quick Start

**Just added a new seed?**

```bash
# 1. Create test file
touch server/test/seeds/my-seed.test.ts

# 2. Add tests (see Seed Test Pattern above)

# 3. Run tests
npm test -- server/test/seeds/my-seed.test.ts

# 4. Test idempotency
npm run db:seed:dev && npm run db:seed:dev
```

**Just modified UI?**

```bash
# 1. Create/update E2E test
touch e2e/tests/my-feature.spec.ts

# 2. Add tests (see E2E Test Pattern above)

# 3. Run E2E tests
npm run test:e2e -- e2e/tests/my-feature.spec.ts

# 4. Test on different sizes
npm run test:e2e:headed
```

**Ready to commit?**

```bash
# Run pre-commit checks
npm run test:unit && npm run typecheck

# Run full test suite
npm test

# Commit with confidence!
git add . && git commit -m "feat: ..."
```

---

**Last Updated:** 2025-11-30
**Test Coverage:** 771 server tests + 21 E2E tests
**Seed Tests:** 66 unit tests
**Pipeline Status:** All jobs passing
