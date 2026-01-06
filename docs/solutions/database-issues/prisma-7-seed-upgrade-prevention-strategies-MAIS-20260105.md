---
title: 'Prisma 7 Seed File Prevention Strategies'
category: database-issues
severity: P1
status: active
date_created: 2026-01-05
tags:
  - prisma
  - prisma-7
  - seed-scripts
  - database
  - environment-variables
  - import-paths
  - factory-pattern
  - typescript
  - build-system
components:
  - server/prisma/seed.ts
  - server/src/lib/prisma.ts
  - server/prisma/seeds/*.ts
  - server/prisma.config.ts
  - server/scripts/prisma-postgenerate.js
  - server/package.json
related_docs:
  - docs/solutions/build-errors/prisma-7-entry-point-barrel-file-build-fix-MAIS-20260102.md
  - docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md
  - docs/solutions/database-issues/prisma-db-execute-supabase-migrations-MAIS-20251231.md
  - docs/solutions/SCHEMA_DRIFT_PREVENTION.md
---

# Prisma 7 Seed File Prevention Strategies

## Executive Summary

Prisma 7 introduces breaking changes that cause seed scripts to fail silently or with cryptic errors. This document provides 5 prevention strategies covering pre-upgrade validation, import path detection, client factory enforcement, environment loading, and verification commands.

**Key Insight:** Seed failures in Prisma 7 often occur at runtime due to (1) stale import paths after `prisma generate`, (2) missing barrel file, (3) incorrect PrismaClient initialization, and (4) environment variables not loaded in correct order. Prevention requires automation at build-time, factory pattern enforcement, and comprehensive testing.

---

## 1. Pre-Upgrade Checklist: Prepare Before Major Prisma Upgrades

**Goal:** Identify and resolve version incompatibilities before upgrading.

### Step 1: Document Current Import Patterns

Before upgrading, catalog all import styles in your codebase:

```bash
# Find all Prisma imports
grep -r "from.*prisma" --include="*.ts" server/src/ | sort | uniq

# Expected output for Prisma 6-7 compatibility:
# - import { PrismaClient } from '@prisma/client'        ✅ Works
# - import { PrismaClient } from '../generated/prisma'   ⚠️  May break
# - import { Prisma } from '@prisma/client'              ✅ Works
# - import type { User } from '@prisma/client'           ✅ Works
```

**Why:** Prisma 7 changed the generated file structure. Seed scripts often use custom import patterns that break after upgrade.

### Step 2: Check Package.json Prisma Version

```bash
# Before upgrade, verify current version
npm list prisma @prisma/client @prisma/adapter-pg

# Check Prisma changelogs for breaking changes
# Visit: https://github.com/prisma/prisma/releases
```

**Critical Breaking Changes in Prisma 7:**

| Change                                        | Impact                   | Migration                                   |
| --------------------------------------------- | ------------------------ | ------------------------------------------- |
| Generated file: `index.ts` → `client.ts`      | Import failures          | Create barrel file (see Strategy 2)         |
| Database URL moved to `prisma.config.ts`      | Migration failures       | Update `DIRECT_URL` env var                 |
| JSON types stricter (null vs undefined)       | Type errors in seed data | Use `undefined` for optional JSON           |
| `PrismaClient.prototype.$extends` return type | Decorator pattern breaks | Don't extract return types                  |
| Driver adapter required                       | Runtime errors           | Import `PrismaPg` from `@prisma/adapter-pg` |

### Step 3: Test with Mock Data

Before applying seed to real database:

```bash
# 1. Create test database
export DATABASE_URL="postgresql://user:pass@localhost/test_db"

# 2. Apply schema
npm exec prisma migrate dev --name init

# 3. Run seed with single tenant
SEED_MODE=e2e npm run db:seed

# 4. Verify data exists
npm exec prisma studio
```

**What to Check:**

- No import errors during seed execution
- Database connects without pooler timeout
- Seed data structure matches schema changes
- All required fields populated correctly

### Step 4: Validate TypeScript Compilation

```bash
# Check for type errors before and after upgrade
npm run typecheck

# Build locally to catch issues early
npm run build

# Run full test suite
npm test
```

**Red Flags:**

```
❌ error TS2307: Cannot find module 'src/generated/prisma'
❌ error TS2322: Type 'null' is not assignable to type 'InputJsonValue'
❌ error TS4049: Return type of exported function has or is using private name
```

---

## 2. Import Path Validation: Detect Stale Imports After `prisma generate`

**Goal:** Ensure all imports resolve correctly after generation step.

### Validation Script: Check Import Paths

Create `/Users/mikeyoung/CODING/MAIS/server/scripts/validate-prisma-imports.js`:

```javascript
#!/usr/bin/env node
/**
 * Validate Prisma Import Paths
 *
 * After `prisma generate`, verify:
 * 1. Barrel file (index.ts) exists
 * 2. client.ts exists
 * 3. No stale import references in codebase
 * 4. All imports use correct patterns
 *
 * Run after: npm exec prisma generate
 * Usage: node scripts/validate-prisma-imports.js
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PRISMA_GEN_DIR = join(process.cwd(), 'src/generated/prisma');
const REQUIRED_FILES = ['client.ts', 'index.ts'];
const FORBIDDEN_IMPORTS = [
  "from '@prisma/client'", // ❌ Breaks in seed (requires env vars)
  "from '../prisma'", // ❌ Wrong path in seed context
];
const VALID_IMPORTS = [
  "from '../../generated/prisma'", // ✅ From routes
  "from '../generated/prisma'", // ✅ From services
  "from '../../src/generated/prisma'", // ✅ From tests
  "from '../src/generated/prisma'", // ✅ From seed
];

const errors = [];
const warnings = [];

// Check 1: Barrel file exists
if (!existsSync(join(PRISMA_GEN_DIR, 'index.ts'))) {
  errors.push('❌ Barrel file missing: src/generated/prisma/index.ts');
  errors.push('   Run: npm run prisma:generate');
}

// Check 2: client.ts exists
if (!existsSync(join(PRISMA_GEN_DIR, 'client.ts'))) {
  errors.push('❌ client.ts missing: src/generated/prisma/client.ts');
  errors.push('   Run: npx prisma generate');
}

// Check 3: Scan codebase for import violations
try {
  const grepCmd = `grep -r "from.*prisma" --include="*.ts" server/src/ 2>/dev/null || true`;
  const imports = execSync(grepCmd, { encoding: 'utf-8' })
    .split('\n')
    .filter((line) => line.trim());

  for (const line of imports) {
    // Skip comments
    if (line.includes('//') || line.includes('/*')) continue;

    // Check for forbidden patterns
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (line.includes(forbidden)) {
        errors.push(`❌ Forbidden import: ${line}`);
        errors.push(`   Pattern: ${forbidden}`);
      }
    }

    // Check if import is from valid location
    let isValid = false;
    for (const valid of VALID_IMPORTS) {
      if (line.includes(valid)) {
        isValid = true;
        break;
      }
    }

    // Allow @prisma/* in specific files
    if (line.includes("from '@prisma/")) {
      // Only allowed in lib/prisma.ts and specific files
      if (!line.includes('lib/prisma.ts') && !line.includes('adapter-pg')) {
        warnings.push(`⚠️  Direct @prisma import outside lib/prisma.ts: ${line}`);
      }
    }
  }
} catch (error) {
  warnings.push(`⚠️  Could not scan imports: ${error.message}`);
}

// Output results
if (errors.length > 0) {
  console.error('\n❌ IMPORT VALIDATION FAILED\n');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\n⚠️  IMPORT WARNINGS\n');
  warnings.forEach((w) => console.warn(w));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All Prisma imports valid');
  console.log(`   - Barrel file: src/generated/prisma/index.ts exists`);
  console.log(`   - Client file: src/generated/prisma/client.ts exists`);
  console.log(`   - Import paths: all valid`);
}
```

### Integration: Run in Build Pipeline

Update `/Users/mikeyoung/CODING/MAIS/server/package.json`:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate && node scripts/prisma-postgenerate.js && node scripts/validate-prisma-imports.js",
    "prisma:postgenerate": "node scripts/prisma-postgenerate.js",
    "build": "npm run prisma:generate && tsc -b"
  }
}
```

**Now every generation step includes validation:**

```bash
$ npm run prisma:generate

> prisma generate
  ✅ Generated Prisma Client to ./src/generated/prisma

> node scripts/prisma-postgenerate.js
  ✅ Created Prisma barrel file: src/generated/prisma/index.ts

> node scripts/validate-prisma-imports.js
  ✅ All Prisma imports valid
```

### Detection Strategy: Grep for Common Issues

When imports fail, use this to quickly diagnose:

```bash
# Find all Prisma-related imports
grep -n "import.*prisma" server/src/**/*.ts server/prisma/**/*.ts

# Find files importing from wrong location
grep -r "from '@prisma/client'" server/src/ | grep -v "lib/prisma.ts"

# Find stale Prisma 6 patterns
grep -r "from '.*prisma.*index'" server/src/
```

---

## 3. Factory Pattern Enforcement: Centralize PrismaClient Creation

**Goal:** Ensure all PrismaClient instances use consistent initialization with proper Prisma 7 driver adapter.

### Pattern: Single PrismaClient Factory

All PrismaClient creation must go through **one** factory function: `/Users/mikeyoung/CODING/MAIS/server/src/lib/prisma.ts`

```typescript
/**
 * Prisma Client Factory
 *
 * Creates a new PrismaClient instance with the Prisma 7 driver adapter pattern.
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

  // Prisma 7 requires driver adapter
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'], // Quiet logs for seeding
  });
}
```

### Verification Checklist: Enforce Factory Pattern

**Code Review Checklist:**

```
□ New file imports PrismaClient?
  ✅ Correct: import { createPrismaClient } from '../lib/prisma'
  ❌ Wrong:   new PrismaClient() directly
  ❌ Wrong:   import { PrismaClient } from '@prisma/client'

□ Seed file calling database?
  ✅ Correct: const prisma = createPrismaClient()
  ❌ Wrong:   const prisma = new PrismaClient()
  ❌ Wrong:   Direct Prisma() calls without adapter

□ Adapter provided?
  ✅ Correct: new PrismaClient({ adapter: new PrismaPg(...) })
  ❌ Wrong:   new PrismaClient() without adapter
  ❌ Wrong:   Mixing @prisma/client with database URL
```

### Pattern: Never Duplicate Client Creation

**Bad Pattern (Causes Problems):**

```typescript
// ❌ DON'T: Create new clients in multiple places
// file1.ts
const prisma = new PrismaClient();

// file2.ts
const prisma = new PrismaClient();

// file3.ts
const prisma = new PrismaClient();
// Result: Connection exhaustion, inconsistent configuration
```

**Good Pattern (Single Source of Truth):**

```typescript
// ✅ DO: Single factory in lib/prisma.ts
export function createPrismaClient() {
  // All configuration here
}

// Used everywhere
import { createPrismaClient } from '../lib/prisma';
const prisma = createPrismaClient();
```

### Lint Rule: Enforce Factory Pattern (ESLint)

Create `.eslintrc.cjs` rule to prevent direct `new PrismaClient()`:

```javascript
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "NewExpression[callee.name='PrismaClient']",
        message: 'Use createPrismaClient() factory from lib/prisma.ts instead of direct instantiation'
      }
    ]
  }
}
```

**Run ESLint to catch violations:**

```bash
npm run lint -- server/src/

# Output
server/src/routes/broken.ts:3:5 - error: Use createPrismaClient() factory...
```

---

## 4. Dotenv Loading Order: Strict Environment Variable Initialization

**Goal:** Ensure environment variables load before any Prisma operations.

### Critical Loading Pattern

**File:** `/Users/mikeyoung/CODING/MAIS/server/prisma/seed.ts`

```typescript
// MUST BE FIRST - Before any other imports
import 'dotenv/config';

// THEN import everything that needs env vars
import { createPrismaClient } from '../src/lib/prisma';
import { seedPlatform } from './seeds/platform';
// ... other imports
```

**Why This Order Matters:**

```
1. import 'dotenv/config'          ← Load .env variables FIRST
   │
   ├── Populates process.env.DATABASE_URL
   ├── Populates process.env.DIRECT_URL
   └── Populates process.env.SEED_MODE

2. import { createPrismaClient }   ← Import factory AFTER env loaded
   │
   └── createPrismaClient() can access process.env.DATABASE_URL

3. const prisma = createPrismaClient()  ← Create instance with env vars
   │
   └── Uses DATABASE_URL from process.env
```

### Validation: Environment Variables Are Loaded

Add this check at start of seed:

```typescript
async function main() {
  // Validate environment before proceeding
  const requiredEnvVars = ['DATABASE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(
        { envVar },
        `Missing required environment variable: ${envVar}`
      );
      process.exit(1);
    }
  }

  const mode = getSeedMode();
  logger.info({ mode, database: process.env.DATABASE_URL }, 'Running seed');

  try {
    // ... seed operations
  }
}
```

### Dotenv Loading Checklist

**Before running any seed:**

```bash
# Check .env file exists
test -f server/.env && echo "✅ .env exists" || echo "❌ .env missing"

# Check required variables
echo "DATABASE_URL=$DATABASE_URL"
echo "NODE_ENV=$NODE_ENV"
echo "SEED_MODE=$SEED_MODE"

# If any are empty, dotenv:config didn't work
```

### Dotenv NOT Auto-Loaded in Prisma 7

**Critical:** Prisma 7 does NOT auto-load `.env` files like earlier versions.

```typescript
// ❌ WRONG - Prisma 7 doesn't auto-load .env
const prisma = new PrismaClient();
// If DATABASE_URL not in process.env, this fails

// ✅ CORRECT - Explicitly load dotenv first
import 'dotenv/config';
const prisma = createPrismaClient(); // Now DATABASE_URL available
```

---

## 5. Test Command: Quick Verification After Prisma Upgrades

**Goal:** Automated test to verify seed scripts work correctly.

### Command 1: Build and Generate Prisma Client

```bash
npm run prisma:generate
# Output should include both messages:
# ✅ Generated Prisma Client to ./src/generated/prisma
# ✅ Created Prisma barrel file: src/generated/prisma/index.ts
# ✅ All Prisma imports valid
```

**Failure Mode 1: Missing Barrel File**

```bash
❌ error TS2307: Cannot find module 'src/generated/prisma'

# Fix:
npm run prisma:postgenerate
```

### Command 2: TypeScript Compilation Check

```bash
npm run typecheck

# Should succeed with no type errors
# Common errors after upgrade:
# - Type 'null' is not assignable to InputJsonValue
# - Cannot find module 'src/generated/prisma'
```

### Command 3: Run Seed with Mock Data

```bash
# Test with minimal data (E2E seed is fastest)
SEED_MODE=e2e npm run db:seed

# Watch for:
# ✅ "Database seeded successfully"
# ❌ Connection errors → DATABASE_URL not loaded
# ❌ Type errors → JSON type mismatches
# ❌ Import errors → Stale import paths
```

**Expected Output:**

```
$ SEED_MODE=e2e npm run db:seed

  [seed] Running seed
  [seed] Starting seed transaction
  [seed] Test tenant created: e2e-tenant (key: pk_live_...)
  [seed] Database seeded successfully
```

### Command 4: Verify Database State

```bash
# Open Prisma Studio to visually verify data
npm exec prisma studio

# Or query directly
npm exec prisma db execute --stdin <<'SQL'
SELECT COUNT(*) as tenant_count FROM "Tenant";
SELECT slug FROM "Tenant" LIMIT 1;
SQL
```

### Command 5: Test Build Process

```bash
npm run build

# Must succeed with no TypeScript errors
# Verifies:
# 1. Prisma generation works
# 2. Barrel file created
# 3. TypeScript compilation succeeds
# 4. All imports resolve
```

### Quick Test Script

Create `/Users/mikeyoung/CODING/MAIS/server/scripts/test-seed-upgrade.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Testing Prisma 7 Seed Configuration..."
echo ""

# Step 1: Generate Prisma Client
echo "📦 Step 1: Generate Prisma Client..."
npm run prisma:generate
if [ ! -f src/generated/prisma/index.ts ]; then
  echo "❌ Barrel file not created"
  exit 1
fi
echo "✅ Barrel file created"
echo ""

# Step 2: Check TypeScript
echo "🔤 Step 2: TypeScript Type Check..."
npm run typecheck
echo "✅ Type check passed"
echo ""

# Step 3: Run E2E seed
echo "🌱 Step 3: Seed E2E Test Data..."
SEED_MODE=e2e npm run db:seed
echo "✅ Seed completed"
echo ""

# Step 4: Verify database
echo "🔍 Step 4: Verify Database..."
npm exec prisma db execute --stdin <<'SQL'
SELECT COUNT(*) as tenant_count FROM "Tenant";
SQL
echo "✅ Database verified"
echo ""

echo "✅ All Prisma 7 seed tests passed!"
```

**Run the test:**

```bash
bash server/scripts/test-seed-upgrade.sh
```

---

## Implementation Checklist

Use this checklist when upgrading Prisma or troubleshooting seed failures:

### Before Upgrade

- [ ] Document current import patterns: `grep -r "from.*prisma" --include="*.ts"`
- [ ] Check Prisma changelog for breaking changes
- [ ] Verify package.json Prisma version
- [ ] Run current tests: `npm test`
- [ ] Build locally: `npm run build`

### During Upgrade

- [ ] Update `package.json` Prisma versions
- [ ] Run `npm install`
- [ ] Update `prisma.config.ts` if needed (database URL location)
- [ ] Run `npm run prisma:generate`
- [ ] Verify barrel file: `ls server/src/generated/prisma/index.ts`

### After Upgrade

- [ ] Run type check: `npm run typecheck`
- [ ] Check import validation: `node scripts/validate-prisma-imports.js`
- [ ] Build: `npm run build`
- [ ] Test seed: `SEED_MODE=e2e npm run db:seed`
- [ ] Verify DB: `npm exec prisma studio`
- [ ] Run tests: `npm test`

### Deployment

- [ ] Verify `.env` includes `DATABASE_URL` and `DIRECT_URL`
- [ ] Verify Render env vars set: `DATABASE_URL` and `DIRECT_URL`
- [ ] Verify build command uses `npm run prisma:generate`, not `npx prisma generate`
- [ ] Deploy and monitor logs for seed failures

---

## Troubleshooting Reference

### Problem: "Cannot find module 'src/generated/prisma'"

**Cause:** Barrel file missing after generation

**Solution:**

```bash
npm run prisma:postgenerate
ls -la server/src/generated/prisma/index.ts
```

### Problem: "DATABASE_URL environment variable is required"

**Cause:** dotenv:config not loaded before PrismaClient creation

**Solution:**

```typescript
// Add to top of seed.ts
import 'dotenv/config';
```

### Problem: "Type 'null' is not assignable to type 'InputJsonValue'"

**Cause:** Prisma 7 stricter JSON types

**Solution:** Use `undefined` instead of `null` for optional JSON fields

```typescript
// BEFORE
data: {
  metadata: null;
}

// AFTER
data: {
  metadata: undefined;
}
```

### Problem: Seed hangs or times out

**Cause:** Connection pooling exhausted or direct URL missing

**Solution:**

```bash
# Check connections
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Use correct URL for migrations
export DIRECT_URL="postgresql://user:pass@host:6543/db"
```

---

## Key Insights

1. **Import Paths are Fragile:** Prisma 7 changed generated entry points. Use barrel file pattern to insulate codebase from future changes.

2. **Factory Pattern is Essential:** Single `createPrismaClient()` function prevents configuration drift and makes testing easier.

3. **Dotenv Loading is Not Implicit:** Seed scripts must explicitly `import 'dotenv/config'` before any code that needs env vars.

4. **Validation Must Automate:** Grep-based validation scripts catch import issues in CI/CD before deployment.

5. **Test Order is Critical:** Load env → validate env → create client → run migrations → run seed.

---

## Related Patterns

- **Barrel File Pattern** (Strategy 2): Adapter pattern for backward compatibility
- **Factory Pattern** (Strategy 3): Single source of truth for object creation
- **Validation Automation** (Strategies 1, 2): Catch issues before runtime
- **Environment Loading** (Strategy 4): Explicit loading order prevents race conditions

---

## Quick Reference

| Problem               | Solution                   | Command                                   |
| --------------------- | -------------------------- | ----------------------------------------- |
| Barrel file missing   | Run postgenerate script    | `npm run prisma:postgenerate`             |
| Import errors         | Check import paths         | `node scripts/validate-prisma-imports.js` |
| Type errors on JSON   | Use `undefined` not `null` | Update schema seed data                   |
| Env vars not loaded   | Add dotenv import          | Add `import 'dotenv/config'` to seed.ts   |
| Seed fails to connect | Check DATABASE_URL         | `echo $DATABASE_URL`                      |
| Build fails           | Regenerate                 | `npm run build`                           |

---

**Status:** Active Prevention Strategies
**Last Updated:** 2026-01-05
**Applies to:** Prisma 7.2.0+, Server package, Seed scripts
