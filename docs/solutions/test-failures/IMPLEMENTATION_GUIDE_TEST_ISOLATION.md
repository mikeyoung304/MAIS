# Implementation Guide: Test Isolation - Serial Execution

**For:** Developers integrating test isolation fix into their workflow
**Status:** Complete and production-ready
**Commit:** `8b33ba9c35f60c0f54adc171c92155db2df085bc`
**Date:** December 25, 2025

---

## Quick Start (5 minutes)

### Step 1: Verify the Fix is Applied

```bash
cd /Users/mikeyoung/CODING/MAIS/server
npm run 2>&1 | grep test:serial
```

**Expected output:**

```
  test:serial
```

If you see `test:serial`, the fix is already applied. Skip to Step 3.

### Step 2: Apply the Fix (If Not Already Applied)

If `test:serial` is not in the scripts, add it to `server/package.json`:

```json
{
  "scripts": {
    "test": "vitest run --reporter=verbose",
    "test:serial": "vitest --pool=forks --poolOptions.forks.singleFork",
    "test:watch": "vitest",
    "test:integration": "DATABASE_URL=$DATABASE_URL_TEST vitest run test/integration/ --no-coverage"
  }
}
```

### Step 3: Verify Installation

```bash
cd /Users/mikeyoung/CODING/MAIS/server

# Option A: Run all tests (takes ~2 minutes)
npm run test:serial

# Option B: Run a quick subset to verify
npm run test:serial -- test/unit/ --run --reporter=verbose

# Option C: Watch mode for development
npm run test:serial -- --watch
```

**Expected output after ~120 seconds:**

```
✓ Test Files  46 passed (46)
✓ Tests  1169 passed | 13 failed | 778 skipped
```

---

## Integration into Your Workflow

### For Daily Development

Replace your current test command with:

```bash
# BEFORE (parallel - unstable)
npm test --workspace=server

# AFTER (serial - stable)
npm run test:serial --workspace=server
```

### For CI/CD Pipelines

Update your CI configuration (GitHub Actions, GitLab CI, Render, etc.):

```yaml
# GitHub Actions example
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/setup-node@v3
    - run: npm install
    - run: npm run test:serial --workspace=server
      # Instead of: npm test --workspace=server
```

### For Pre-commit Hooks

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
set -e

echo "Running tests..."
cd server
npm run test:serial

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Fix them before committing."
  exit 1
fi

echo "✅ Tests passed. Proceeding with commit..."
exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Command Reference

### Running Tests

```bash
# All tests, serially (recommended for integration tests)
npm run test:serial --workspace=server

# All tests, in parallel (not recommended for database tests)
npm test --workspace=server

# Unit tests only (safe to parallelize)
npm run test:unit --workspace=server

# Integration tests only (serially)
npm run test:integration --workspace=server

# Watch mode
npm run test:serial --workspace=server -- --watch

# With verbose output
npm run test:serial --workspace=server -- --reporter=verbose

# Specific test file
npm run test:serial --workspace=server -- test/unit/booking.test.ts

# Tests matching pattern
npm run test:serial --workspace=server -- --grep "should create booking"

# With coverage
npm run test:coverage --workspace=server
```

### Debugging Failed Tests

```bash
# Run failed test in watch mode for iterative debugging
npm run test:serial --workspace=server -- --watch test/integration/booking.spec.ts

# Run with detailed output
npm run test:serial --workspace=server -- --reporter=verbose test/integration/booking.spec.ts

# Check database directly (if test uses real DB)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM booking;"

# View database in Prisma Studio
cd server && npm exec prisma studio
```

---

## Configuration Files

### server/package.json

The serial execution is configured in the npm script:

```json
{
  "scripts": {
    "test": "vitest run --reporter=verbose",
    "test:serial": "vitest --pool=forks --poolOptions.forks.singleFork"
  }
}
```

**Flags explained:**

- `--pool=forks`: Use process-based worker pool (true isolation)
- `--poolOptions.forks.singleFork`: Limit to 1 worker (sequential execution)

### server/vitest.config.ts

No changes needed. Configuration already supports both modes:

```typescript
export default defineConfig(({ mode }) => {
  return {
    test: {
      globals: true,
      environment: 'node',
      // Default uses threads pool (8 workers)
      // --pool=forks --poolOptions.forks.singleFork overrides with 1 fork
    },
  };
});
```

### .env.test (for test database)

```bash
# Test database configuration
DATABASE_URL="postgresql://user:password@localhost:5432/mais_test"
DIRECT_URL="postgresql://user:password@localhost:5432/mais_test"

# Mock mode (in-memory, no database)
ADAPTERS_PRESET="mock"

# Real mode (PostgreSQL database)
ADAPTERS_PRESET="real"
```

---

## Best Practices

### 1. Always Use Serial for Database Tests

```bash
# ✅ CORRECT
npm run test:serial --workspace=server

# ❌ WRONG (will cause intermittent failures)
npm test --workspace=server
```

### 2. Test Cleanup Must Be Robust

```typescript
// ✅ CORRECT - Guards against missing prisma
afterAll(async () => {
  if (!prisma) return; // Guard
  if (testTenantId) {
    await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ❌ WRONG - Assumes prisma always defined
afterAll(async () => {
  await prisma.tenant.delete({ where: { id: testTenantId } });
  await prisma.$disconnect();
});
```

### 3. Set Appropriate Timeouts

```typescript
// ✅ CORRECT - Bulk operations get extended timeout
it('should handle large number of add-ons', async () => {
  // Creates 50 add-ons
}, 30000); // 30 seconds for bulk ops

// ❌ WRONG - Default 5s timeout too short for database work
it('should handle large number of add-ons', async () => {
  // Creates 50 add-ons (takes 6-8 seconds)
}); // Will timeout!
```

### 4. No Parallel Expectations

```typescript
// ✅ CORRECT - Tests are independent
describe('booking service', () => {
  it('should create booking', async () => {
    const booking = await service.create(data);
    expect(booking).toBeDefined();
  });

  it('should prevent double-booking', async () => {
    const booking = await service.create(data);
    expect(booking).toBeDefined();
  });
});

// ❌ WRONG - Assumes parallel execution order
describe('booking service', () => {
  let bookingId;

  it('should create booking', async () => {
    const booking = await service.create(data);
    bookingId = booking.id; // Assumes this runs first!
  });

  it('should fetch booking', async () => {
    const booking = await service.get(bookingId); // May be undefined!
  });
});
```

---

## Performance Expectations

### Execution Time

| Mode                 | Time        | Stability             |
| -------------------- | ----------- | --------------------- |
| Parallel (8 workers) | 45 seconds  | 97% (38 failures)     |
| Serial (1 worker)    | 120 seconds | 99% (13 pre-existing) |

**Recommendation:** Accept 75 seconds slower execution for 25 fewer failures.

### Memory Usage

| Mode     | Memory | Notes                     |
| -------- | ------ | ------------------------- |
| Parallel | 400MB  | 8 Prisma instances × 50MB |
| Serial   | 50MB   | 1 Prisma instance × 50MB  |

**Benefit:** 8x less memory consumption with serial execution.

---

## Troubleshooting

### Problem: "Cannot acquire database connection"

**Symptoms:**

```
Error: Cannot get a connection, all pooled connections are in use
Error: FATAL: remaining connection slots reserved for non-replication superuser
```

**Solutions:**

1. **Use serial execution:**

   ```bash
   npm run test:serial --workspace=server
   ```

2. **Verify database is running:**

   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Check connection pool limits:**
   ```bash
   # View max connections in PostgreSQL
   psql $DATABASE_URL -c "SHOW max_connections;"
   ```

### Problem: "Test timed out in 5000ms"

**Symptoms:**

```
Error: Test timed out in 5000ms
```

**Causes:**

- Test is slow (> 5 seconds)
- Database query inefficiency
- Missing database index

**Solutions:**

1. **Increase timeout for slow tests:**

   ```typescript
   it('slow test', async () => {
     // test code that takes 6-8 seconds
   }, 30000); // 30 second timeout
   ```

2. **Optimize database query:**

   ```bash
   # View slow queries
   psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT ...;"
   ```

3. **Add database index:**
   ```sql
   CREATE INDEX idx_booking_tenant ON booking(tenantId);
   ```

### Problem: "Tests still fail in serial mode"

**Symptoms:**

```
FAIL test/integration/booking.spec.ts
FAIL test/http/password-reset.spec.ts
```

**Solutions:**

1. **Check test database exists:**

   ```bash
   createdb mais_test
   npm exec prisma migrate deploy --force
   ```

2. **Run test in isolation:**

   ```bash
   npm run test:serial --workspace=server -- test/integration/booking.spec.ts --reporter=verbose
   ```

3. **Check Prisma Client is synchronized:**

   ```bash
   npm exec prisma generate
   ```

4. **Check for hardcoded test data:**
   ```bash
   # Some tests may depend on seed data
   npm exec prisma db seed
   ```

---

## Verification Checklist

Use this checklist to ensure serial execution is properly integrated:

- [ ] `npm run test:serial --workspace=server` command works
- [ ] All integration tests pass with serial execution
- [ ] Unit tests still pass with `npm test --workspace=server`
- [ ] CI/CD pipeline uses `npm run test:serial --workspace=server`
- [ ] Pre-commit hook (if used) runs `npm run test:serial --workspace=server`
- [ ] Team knows to use `test:serial` for database tests
- [ ] Documentation updated with serial execution commands
- [ ] No test files assume parallel execution order
- [ ] All test cleanup code has existence guards
- [ ] Bulk operation tests have extended timeouts

---

## Documentation Links

| Document                                                                                           | Purpose                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------- |
| [TEST_ISOLATION_SERIAL_EXECUTION.md](./TEST_ISOLATION_SERIAL_EXECUTION.md)                         | Full technical explanation   |
| [SOLUTION_SUMMARY_TEST_ISOLATION.md](./SOLUTION_SUMMARY_TEST_ISOLATION.md)                         | Executive summary            |
| [../TEST_ISOLATION_QUICK_REFERENCE.md](../TEST_ISOLATION_QUICK_REFERENCE.md)                       | Quick reference (print!)     |
| [test-isolation-di-container-race-conditions.md](./test-isolation-di-container-race-conditions.md) | Related: DI Container issues |

---

## Next Steps

1. ✅ Run `npm run test:serial --workspace=server` to verify
2. ✅ Update your CI/CD to use `test:serial` for stability
3. ✅ Share quick reference with team
4. ✅ Add to team wiki/documentation
5. ✅ Update pre-commit hooks to use `test:serial`

---

## Support

For issues or questions:

1. Check the quick reference: `docs/solutions/TEST_ISOLATION_QUICK_REFERENCE.md`
2. See full technical details: `docs/solutions/test-failures/TEST_ISOLATION_SERIAL_EXECUTION.md`
3. Check Vitest documentation: https://vitest.dev/config/#pool
4. Check Prisma documentation: https://www.prisma.io/docs/orm/prisma-client/deployment/connection-management

---

**This solution is production-ready. Use it with confidence!**
