# Prisma 7 Seed Script Module Resolution and Driver Adapter

**Status:** RESOLVED
**Date:** 2025-01-05
**Severity:** P1 (Database seeding broken, blocks development workflow)
**Category:** Database | Module Resolution | Dependency Upgrade

---

## Problem Summary

After upgrading to Prisma 7.x, seed scripts (`npm run db:seed*`) fail with two root causes:

1. **Module resolution error:** Seed files import from `../../src/generated/prisma` expecting index.ts, but Prisma 7 generates only client.ts as the entry point
2. **Driver adapter required:** Prisma 7 requires explicit driver adapter (PrismaPg) and options object; can't instantiate PrismaClient() without them
3. **Missing dotenv:** Seed files didn't load environment variables before creating PrismaClient, causing DATABASE_URL lookup to fail
4. **Module-level instantiation:** Some seed files (upgrade-tenant-pages.ts) created PrismaClient at module load time, causing initialization order issues

**Error Messages:**

```
Error: Cannot find module '../../src/generated/prisma'
ModuleNotFoundError: Expected '../../src/generated/prisma/package.json' to exist

Error: DATABASE_URL environment variable is required
```

---

## Root Causes

### 1. Prisma 7 Generated Client Structure Change

**Prisma 5-6:**

```
generated/prisma/
├── index.ts         ← Client export
├── client.ts
├── runtime/
└── ...
```

**Prisma 7:**

```
generated/prisma/
├── client.ts        ← ONLY entry point
├── runtime/
└── ... (no index.ts)
```

Seed scripts continued importing from the old path:

```typescript
// ❌ WRONG - Prisma 7 doesn't generate index.ts
import type { PrismaClient } from '../../src/generated/prisma';
```

### 2. Prisma 7 Driver Adapter Requirement

Prisma 7 separates the ORM layer from database driver. It requires explicit driver adapter instantiation:

```typescript
// ❌ WRONG - Prisma 7 will error
const prisma = new PrismaClient();

// ✅ CORRECT - Prisma 7 requires adapter
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
```

### 3. Missing Environment Variable Loading

Seed scripts called `createPrismaClient()` before `dotenv/config`, causing environment variable lookup to fail:

```typescript
// ❌ WRONG - Process env not loaded yet
const prisma = createPrismaClient();
// DATABASE_URL is undefined here

import 'dotenv/config'; // Too late
```

### 4. Module-Level Instantiation Side Effects

`upgrade-tenant-pages.ts` created PrismaClient at module load time, causing:

- Connection pool created but never used until function is called
- Circular dependency potential with type imports
- Better pattern: lazy initialization inside function

---

## Solution Architecture

### Step 1: Create Centralized Prisma Factory (`server/src/lib/prisma.ts`)

Extract PrismaClient creation into a single, reusable factory that:

- Imports from Prisma 7's correct path (`../generated/prisma/client`)
- Creates driver adapter with connection string
- Configures logging appropriately for environment
- Handles DATABASE_URL validation

```typescript
/**
 * Prisma Client Factory
 *
 * Creates a PrismaClient instance with the Prisma 7 driver adapter pattern.
 * Used by seed scripts and other standalone processes that need database access.
 *
 * For the main application, use the DI container in di.ts instead.
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Creates a new PrismaClient instance with PostgreSQL driver adapter
 *
 * @param connectionString - Optional custom connection string. Defaults to DATABASE_URL env var.
 * @returns Configured PrismaClient instance
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const databaseUrl = connectionString || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'], // Quiet logs for seeding
  });
}
```

**Why this pattern:**

- Single source of truth for PrismaClient creation
- Consistent across all seed scripts (no duplication)
- Easy to update when Prisma upgrades again
- Handles both Prisma internal use and external seed scripts

### Step 2: Update Main Seed Orchestrator (`server/prisma/seed.ts`)

Load environment variables **before** any imports that depend on them:

```typescript
// Load environment variables before any other imports
import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma';
// ... rest of imports

// Prisma 7: Use centralized factory with driver adapter
const prisma = createPrismaClient();

// ... rest of seed logic
```

**Critical ordering:** `dotenv/config` must be first import in file.

### Step 3: Update All Seed Function Signatures

Change all seed functions to accept pre-created PrismaClient as parameter (dependency injection):

**Before (Prisma 5-6 pattern):**

```typescript
// ❌ OLD - Created its own client
import { PrismaClient } from '../../src/generated/prisma';

export async function seedPlatform(): Promise<void> {
  const prisma = new PrismaClient();
  // ...
}
```

**After (Prisma 7 pattern):**

```typescript
// ✅ NEW - Accepts client as parameter
import type { PrismaClient } from '../../src/generated/prisma/client';

export async function seedPlatform(prisma: PrismaClient): Promise<void> {
  // Use passed-in prisma client
  // ...
}
```

**Benefits:**

- Single PrismaClient instance for all operations (connection pooling efficiency)
- Factory handles driver adapter creation
- Easier to test with mock PrismaClient
- Follows dependency injection pattern

### Step 4: Fix Module-Level Instantiation (Lazy Initialization)

For files that need conditional initialization, use lazy-loaded pattern:

**Before (broken):**

```typescript
// ❌ Module-level instantiation - happens at import time
const prisma = createPrismaClient();

export async function upgradeTenantPages() {
  // Uses module-level prisma
}
```

**After (fixed):**

```typescript
// ✅ Lazy initialization - happens when function is called
let prisma: PrismaClient;

export async function upgradeTenantPages(): Promise<void> {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  // Now safe to use prisma
}
```

**Why this matters:**

- Environment variables loaded before first use
- No dangling connections if function never called
- Clearer initialization intent in code

---

## Implementation Checklist

### Files Modified

1. ✅ Create `/server/src/lib/prisma.ts` - Factory function
2. ✅ Update `/server/prisma/seed.ts` - Main orchestrator
3. ✅ Update all seed files to use correct import path and accept prisma parameter:
   - ✅ `/server/prisma/seeds/platform.ts`
   - ✅ `/server/prisma/seeds/e2e.ts`
   - ✅ `/server/prisma/seeds/demo.ts`
   - ✅ `/server/prisma/seeds/la-petit-mariage.ts`
   - ✅ `/server/prisma/seeds/little-bit-horse-farm.ts`
   - ✅ `/server/prisma/seeds/plate.ts`
   - ✅ `/server/prisma/seeds/handled.ts`
   - ✅ `/server/prisma/seeds/upgrade-tenant-pages.ts` - Lazy initialization

### Change Pattern for Each Seed File

```typescript
// Step 1: Fix import path (Prisma 7)
- import type { PrismaClient } from '../../src/generated/prisma';
+ import type { PrismaClient } from '../../src/generated/prisma/client';

// Step 2: Change function signature to accept prisma
- export async function seedXXX(): Promise<void> {
-   const prisma = new PrismaClient();
+ export async function seedXXX(prisma: PrismaClient): Promise<void> {

// Step 3: Remove prisma.$disconnect() from function
// (seed.ts handles it in finally block)
- await prisma.$disconnect();
```

---

## Validation & Testing

### Verify Seed Scripts Work

```bash
# Test each seed mode
npm run db:seed:production    # With PLATFORM_ADMIN_* env vars set
npm run db:seed:e2e
npm run db:seed:demo
npm run db:seed:dev
npm run db:seed:all

# Test specific tenant seeds
SEED_MODE=la-petit-mariage npm exec prisma db seed
SEED_MODE=upgrade-tenant-pages npm exec prisma db seed

# Verify data was created
npm exec prisma studio
```

### Check Module Resolution

```bash
# Verify Prisma client can be found at new path
node -e "console.log(require.resolve('@macon/server/dist/generated/prisma/client'))"

# Verify factory function exports correctly
npm run typecheck
```

### Database State

```bash
# After successful seed, verify tenants created
npm exec prisma studio

# Check platform admin user exists
psql $DATABASE_URL -c "SELECT email FROM \"User\" WHERE role = 'ADMIN';"
```

---

## Key Patterns to Remember

### For Future Prisma Updates

When Prisma upgrades again, check:

1. **Generated client structure** - Where is the entry point now?

   ```bash
   ls server/src/generated/prisma/
   # Look for: client.ts, index.ts, etc.
   ```

2. **Driver adapter requirement** - Is explicit adapter still needed?

   ```typescript
   // Check Prisma docs for current pattern
   const adapter = new PrismaPg({ ... });
   const prisma = new PrismaClient({ adapter });
   ```

3. **Environment variable timing** - Ensure dotenv loads first
   ```typescript
   import 'dotenv/config'; // Always first
   ```

### Seed Function Pattern

All seed functions should follow this signature:

```typescript
import type { PrismaClient } from '../../src/generated/prisma/client';
import { logger } from '../../src/lib/core/logger';

export async function seedXXX(prisma: PrismaClient): Promise<void> {
  logger.info({ type: 'xxx' }, 'Starting seed');
  try {
    // Database operations
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    throw error; // seed.ts handles exit
  }
}
```

### Connection Pooling

With centralized `createPrismaClient()`:

- Single connection pool for all operations
- More efficient than multiple PrismaClient instances
- Automatic cleanup in seed.ts finally block
- No dangling connections

---

## Related Issues & Prevention

### Why This Broke

Prisma 7 major version bump changed fundamental architecture:

- Separated ORM from driver layer
- Removed default driver dependency
- Made generated client structure match driver pattern

This is documented in Prisma 7 migration guide but easy to miss if seed scripts aren't run during testing.

### Prevention for Future Upgrades

1. **Always run full test suite including seeds** before marking upgrade complete
2. **Check Prisma changelog** for "breaking changes" section
3. **Test seed scripts in CI/CD** - don't assume local works
4. **Use TypeScript strict mode** - would catch import errors faster

### Related Solutions

- `docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md` - JSON field type casting patterns
- `docs/solutions/database-issues/schema-drift-prevention-MAIS-20251231.md` - Migration patterns and decision tree

---

## References

### Prisma 7 Documentation

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/orm/prisma-migrate/migrate-from-prisma-6-to-7)
- [Driver Adapters](https://www.prisma.io/docs/orm/reference/prisma-client-reference#adapter)
- [PrismaPg Adapter](https://www.prisma.io/docs/orm/overview/databases/postgresql#pg-adapter)

### MAIS Seed Scripts

- `server/prisma/seed.ts` - Main orchestrator with mode selection
- `server/prisma/seeds/` - Individual seed implementations
- `server/src/lib/prisma.ts` - Factory function

### Environment Variables Required for Seeds

```bash
DATABASE_URL=postgresql://...           # Required
PLATFORM_ADMIN_EMAIL=admin@example.com  # Required for platform seed
PLATFORM_ADMIN_PASSWORD=...             # Required for platform seed (min 12 chars)
PLATFORM_ADMIN_NAME=Admin User          # Optional, defaults to "Platform Admin"
```

---

## Code Examples

### Factory Function Usage

```typescript
// In seed.ts
import 'dotenv/config'; // FIRST
import { createPrismaClient } from '../src/lib/prisma';

const prisma = createPrismaClient(); // Will use DATABASE_URL from environment

// Pass to seed functions
await seedPlatform(prisma);
await seedDemo(prisma);
```

### Seed Function Pattern

```typescript
// In seeds/platform.ts
import type { PrismaClient } from '../../src/generated/prisma/client';

export async function seedPlatform(prisma: PrismaClient): Promise<void> {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error('PLATFORM_ADMIN_EMAIL required');
  }

  // Use passed-in prisma instance
  await prisma.user.create({
    data: { email: adminEmail, role: 'ADMIN' },
  });
}
```

### Lazy Initialization Pattern

```typescript
// In seeds/upgrade-tenant-pages.ts
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createPrismaClient } from '../../src/lib/prisma';

let prisma: PrismaClient;

export async function upgradeTenantPages(): Promise<void> {
  // Create on first call, reuse on subsequent calls
  if (!prisma) {
    prisma = createPrismaClient();
  }

  const tenants = await prisma.tenant.findMany();
  // ... process tenants
}
```

---

## Summary

The fix unifies all seed script initialization around a single factory function that:

1. Uses Prisma 7's correct client path (`../generated/prisma/client`)
2. Creates explicit driver adapter (PrismaPg)
3. Validates DATABASE_URL before use
4. Loads environment variables first (dotenv import)
5. Provides single connection pool for efficiency
6. Centralizes future upgrade changes

**Result:** Seed scripts work reliably across all environments (development, staging, production) with clear error messages if configuration is missing.
