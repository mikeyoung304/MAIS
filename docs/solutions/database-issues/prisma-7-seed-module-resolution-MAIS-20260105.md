---
title: 'Prisma 7 Seed Script Module Resolution & Factory Pattern'
date: 2026-01-05
author: Claude Code
tags:
  - prisma
  - prisma-7
  - seeding
  - module-resolution
  - typescript
  - breaking-change
severity: medium
component: server/prisma
affected_files:
  - server/prisma/seed.ts
  - server/prisma/seeds/*.ts (9 files)
  - server/src/lib/prisma.ts (new)
status: resolved
---

# Prisma 7 Seed Script Module Resolution & Factory Pattern

## Problem Statement

After upgrading to Prisma 7, all seed scripts fail with module resolution errors:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/generated/prisma/index.json'
```

Or client initialization errors:

```
PrismaClientInitializationError: `PrismaClient` needs to be constructed with a non-empty, valid `PrismaClientOptions`
```

## Root Cause Analysis

Prisma 7 introduced **four breaking changes** affecting seed scripts:

### 1. Entry Point Changed

| Prisma 6                    | Prisma 7                     |
| --------------------------- | ---------------------------- |
| `generated/prisma/index.ts` | `generated/prisma/client.ts` |

Imports from `../../src/generated/prisma` fail because there's no `index.ts`.

### 2. Driver Adapter Required

Prisma 7 requires explicit driver adapter configuration:

```typescript
// ❌ Prisma 6 (worked)
const prisma = new PrismaClient();

// ✅ Prisma 7 (required)
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

### 3. Dotenv Not Auto-Loaded

Seed scripts run via `tsx` don't auto-load `.env` files. Must explicitly import:

```typescript
import 'dotenv/config'; // MUST be first import
```

### 4. Module-Level Instantiation Timing

Creating PrismaClient at module load time fails because env vars aren't loaded yet:

```typescript
// ❌ Fails - runs before dotenv loads
const prisma = createPrismaClient();

// ✅ Works - lazy initialization
let prisma: PrismaClient;
export async function myFunction() {
  prisma = createPrismaClient();
}
```

## Solution

### Step 1: Create Centralized Factory

**File:** `server/src/lib/prisma.ts`

```typescript
/**
 * Prisma Client Factory
 * Creates PrismaClient with Prisma 7 driver adapter pattern.
 */
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createPrismaClient(connectionString?: string): PrismaClient {
  const databaseUrl = connectionString || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  });
}
```

### Step 2: Update Import Paths (All 9 Seed Files)

```typescript
// ❌ Before (Prisma 6)
import type { PrismaClient } from '../../src/generated/prisma';

// ✅ After (Prisma 7)
import type { PrismaClient } from '../../src/generated/prisma/client';
```

**Files updated:**

- `platform.ts`
- `demo.ts`
- `e2e.ts`
- `la-petit-mariage.ts`
- `little-bit-horse-farm.ts`
- `plate.ts`
- `handled.ts`
- `utils.ts`
- `upgrade-tenant-pages.ts`

### Step 3: Add Dotenv to Seed Orchestrator

**File:** `server/prisma/seed.ts`

```typescript
// Load environment variables FIRST
import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma';
// ... rest of imports
```

### Step 4: Fix Lazy Initialization

For files that create their own PrismaClient (like `upgrade-tenant-pages.ts`):

```typescript
import { createPrismaClient } from '../../src/lib/prisma';
import type { PrismaClient } from '../../src/generated/prisma/client';

// Lazy-loaded (not at module level)
let prisma: PrismaClient;

export async function upgradeTenantPages(): Promise<void> {
  // Initialize when function runs (after dotenv loaded)
  prisma = createPrismaClient();

  // ... rest of function
}
```

## Verification

```bash
# Run seed
npm run db:seed:dev

# Expected output
[INFO] Running seed
    mode: "dev"
[INFO] Starting seed transaction
[INFO] Platform admin already exists...
[INFO] Database seeded successfully
```

## Prevention Strategies

### 1. Pre-Upgrade Checklist

Before upgrading Prisma major versions:

- [ ] Search for `from '../../src/generated/prisma'` imports
- [ ] Check for `new PrismaClient()` without adapter
- [ ] Verify dotenv loading in standalone scripts
- [ ] Review Prisma changelog for breaking changes

### 2. Import Path Validation Script

```bash
# Find stale imports after prisma generate
grep -r "from.*generated/prisma'" server/prisma/seeds/ --include="*.ts"
# Should return ZERO matches (all should end in /client')
```

### 3. Factory Pattern Enforcement

Always use `createPrismaClient()` from `lib/prisma.ts`:

- Centralizes driver adapter configuration
- Single place to update for future Prisma changes
- Consistent error handling for missing env vars

### 4. Dotenv Loading Order

In seed scripts, dotenv MUST be first:

```typescript
// ✅ CORRECT ORDER
import 'dotenv/config';        // 1. Load env vars
import { createPrismaClient }; // 2. Then factory
import { seedPlatform };       // 3. Then seeds

// ❌ WRONG ORDER
import { createPrismaClient }; // Fails - no DATABASE_URL yet
import 'dotenv/config';        // Too late
```

### 5. Quick Test After Upgrades

```bash
npx prisma generate && npm run db:seed:dev
```

## Related Documentation

- [Prisma 7 JSON Type Breaking Changes](prisma-7-json-type-breaking-changes-MAIS-20260102.md)
- [Schema Drift Prevention](../SCHEMA_DRIFT_PREVENTION.md)
- [Prisma DB Execute for Supabase](prisma-db-execute-supabase-migrations-MAIS-20251231.md)

## Key Insight

> **Prisma 7's generated client structure changed fundamentally.** The entry point moved from `index.ts` to `client.ts`, and driver adapters are now required. Centralizing client creation in a factory function (`createPrismaClient`) insulates application code from future Prisma changes.

## Files Changed

| File                                           | Change                         |
| ---------------------------------------------- | ------------------------------ |
| `server/src/lib/prisma.ts`                     | **Created** - Factory function |
| `server/prisma/seed.ts`                        | Added `import 'dotenv/config'` |
| `server/prisma/seeds/platform.ts`              | Updated import path            |
| `server/prisma/seeds/demo.ts`                  | Updated import path            |
| `server/prisma/seeds/e2e.ts`                   | Updated import path            |
| `server/prisma/seeds/la-petit-mariage.ts`      | Updated import paths           |
| `server/prisma/seeds/little-bit-horse-farm.ts` | Updated import path            |
| `server/prisma/seeds/plate.ts`                 | Updated import path            |
| `server/prisma/seeds/handled.ts`               | Updated import path            |
| `server/prisma/seeds/utils.ts`                 | Updated import paths           |
| `server/prisma/seeds/upgrade-tenant-pages.ts`  | Updated import + lazy init     |
