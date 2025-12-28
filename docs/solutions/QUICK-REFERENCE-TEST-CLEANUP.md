# Quick Reference: Test Suite Cleanup Pattern

**Problem:** Test suite hung because 117+ orphaned test tenants accumulated, slowing the reminder scheduler to 29+ seconds.

**Solution:** Global setup hook runs before tests start and cleans orphaned test tenants.

## Implementation (2 files)

### 1. Create `server/test/helpers/vitest-global-setup.ts`

```typescript
import { getTestPrisma, disconnectTestPrisma } from './global-prisma';

const TEST_TENANT_PATTERNS = [
  'hash-test-business-%',
  'test-business-%',
  'test-tenant-%',
  // ... add your test patterns
];

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_TEST) {
    return; // Skip in mock mode
  }

  const prisma = getTestPrisma();
  const testTenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'hash-test-business-' } },
        // ... add your patterns
      ],
      slug: { not: { in: ['mais', 'little-bit-farm', 'demo'] } }, // Allowlist
    },
  });

  // Delete in correct order (foreign key dependencies first)
  await prisma.bookingAddOn.deleteMany({
    where: { booking: { tenantId: { in: testTenants.map((t) => t.id) } } },
  });

  await prisma.tenant.deleteMany({
    where: { id: { in: testTenants.map((t) => t.id) } },
  });

  await disconnectTestPrisma();
}
```

### 2. Update `server/vitest.config.ts`

```typescript
export default defineConfig(({ mode }) => {
  return {
    test: {
      // ... other config

      globalSetup: ['./test/helpers/vitest-global-setup.ts'],
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],

      // ... rest
    },
  };
});
```

## Why It Works

- **Runs before all tests** - Cleans orphaned data fresh each run
- **Handles interrupted runs** - Catch-all for tests stopped mid-execution
- **Safe pattern matching** - Explicit allowlist prevents accidental deletion
- **Two-level cleanup**:
  1. Global setup: Remove orphans
  2. Per-test afterEach(): Clean that test's data

## Verification

```bash
# Check orphaned tenants before
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Tenant\" WHERE slug LIKE 'test-%';"

# Run tests
npm test

# Verify cleanup succeeded
npm test -- --reporter=verbose | grep "Global setup"

# Check real tenants still exist
psql $DATABASE_URL -c "SELECT slug FROM \"Tenant\" WHERE slug IN ('mais', 'little-bit-farm', 'demo');"
```

## Key Patterns

```typescript
// ✅ SAFE: Uses pattern matching + explicit allowlist
where: {
  OR: [{ slug: { startsWith: 'test-' } }],
  slug: { not: { in: REAL_TENANT_SLUGS } },
}

// ❌ WRONG: Greedy deletion without allowlist
where: { slug: { startsWith: 'test' } } // Would delete "test-production"!

// ✅ SAFE: Respect foreign key deletion order
await tx.bookingAddOn.deleteMany({ ... }); // Delete children first
await tx.tenant.deleteMany({ ... });       // Then parent
```

## Performance Impact

- Global setup: ~1-2 seconds (amortized across full test suite)
- Scheduler cleanup: From 29s → 2s (due to fewer tenants)
- Overall test time: Massive improvement (from hanging to completing)

## Common Issues

| Issue                  | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Cleanup not running    | Check `DATABASE_URL` is set (skips in mock mode) |
| Deleting real data     | Verify allowlist includes all production slugs   |
| Foreign key errors     | Delete child tables before parent                |
| Connection pool errors | Reuse singleton Prisma via `getTestPrisma()`     |

**Reference:** See full solution at `docs/solutions/test-failures/TEST-SUITE-HANG-ORPHANED-TENANTS-20251227.md`
