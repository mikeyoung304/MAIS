---
module: MAIS
date: 2025-12-04
problem_type: database_issue
component: server/prisma/migrations, server/src/di.ts
symptoms:
  - 189 integration tests failing with PrismaClientInitializationError
  - 'Tenant.landingPageConfig column missing from database'
  - Error code P2022 - Unknown field
  - Test config producing "?connection_limit=undefined" in DATABASE_URL
root_cause: Empty migration directory created without migration.sql file; test configs missing required DATABASE_CONNECTION_LIMIT and DATABASE_POOL_TIMEOUT values
resolution_type: fix_with_pattern
severity: P0
related_files:
  - server/prisma/migrations/20251204000000_sync_schema_with_manual_migrations/
  - server/prisma/schema.prisma
  - server/src/di.ts
  - server/test/http/tenant-admin-scheduling.test.ts
tags: [prisma, schema-drift, migrations, database, test-configuration, P0-critical]
---

# Schema Drift: Empty Migration Directory Causing 189 Test Failures

## Problem Summary

**Impact:** 189 tests failing (189 failed | 695 passed)
**Duration:** Immediate detection via test suite
**Root Cause:** Two independent issues:

1. Empty Prisma migration directory (no `migration.sql` inside)
2. Test configs missing `DATABASE_CONNECTION_LIMIT` causing `undefined` in URL params

## Symptoms

```
Test Files  19 failed | 34 passed (53)
Tests  189 failed | 695 passed | 82 skipped (966)

Error: P2022 - column "Tenant.landingPageConfig" does not exist
```

Additional error in specific tests:

```
PrismaClientInitializationError: The provided database string is invalid.
The provided arguments are not supported in database URL.
```

## Root Cause Analysis

### Issue 1: Empty Migration Directory

A migration directory `20251204000000_sync_schema_with_manual_migrations/` was created but contained no `migration.sql` file. This caused:

1. `prisma migrate status` showed migration as "not yet applied"
2. Database was missing the `landingPageConfig` column defined in `schema.prisma`
3. Any query touching `Tenant.landingPageConfig` failed with P2022

**Why it happened:** Migration creation was likely interrupted, or the directory was created manually without the SQL file.

### Issue 2: Undefined URL Parameters

The DI container (`src/di.ts`) adds connection pooling parameters to DATABASE_URL:

```typescript
// src/di.ts lines 313-314
databaseUrl.searchParams.set('connection_limit', String(config.DATABASE_CONNECTION_LIMIT));
databaseUrl.searchParams.set('pool_timeout', String(config.DATABASE_POOL_TIMEOUT));
```

When tests passed a config without these values, `String(undefined)` produced literal `"undefined"`:

```
postgresql://user:pass@host:5432/db?connection_limit=undefined&pool_timeout=undefined
```

Prisma rejected this as an invalid connection string.

## Solution

### Fix 1: Remove Empty Migration & Sync Schema

```bash
# 1. Remove the broken empty migration directory
rm -rf prisma/migrations/20251204000000_sync_schema_with_manual_migrations

# 2. Push schema to database (adds missing columns)
npx prisma db push

# Result: "Your database is now in sync with your Prisma schema"
```

### Fix 2: Add Missing Config Values to Tests

```typescript
// server/test/http/tenant-admin-scheduling.test.ts
const config = {
  NODE_ENV: 'test',
  PORT: 3001,
  JWT_SECRET,
  ADAPTERS_PRESET: process.env.ADAPTERS_PRESET || 'mock',
  DATABASE_URL: process.env.DATABASE_URL!,
  DATABASE_CONNECTION_LIMIT: 1, // Added
  DATABASE_POOL_TIMEOUT: 10, // Added
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
};
```

### Fix 3: Correct createApp Signature

The test was calling `createApp(container)` but the function requires 3 arguments:

```typescript
// Before (wrong)
app = createApp(container);

// After (correct)
const startTime = Date.now();
app = createApp(config, container, startTime);
```

## Verification

```bash
npm test
# Test Files  52 passed (53)
# Tests  962 passed | 2 skipped (966)
```

**Result:** 189 failures → 962 passing (2 remaining are pre-existing timeout issues)

## Prevention Strategies

### 1. Pre-Commit Check: Validate Migration Directories

Add to `.claude/hooks/validate-patterns.sh`:

```bash
# Check for empty migration directories
for dir in server/prisma/migrations/*/; do
  if [ -d "$dir" ] && [ ! -f "${dir}migration.sql" ]; then
    echo "ERROR: Empty migration directory: $dir"
    echo "Either add migration.sql or remove the directory"
    exit 1
  fi
done
```

### 2. CI Pipeline: Migration Dry Run

```yaml
# .github/workflows/main-pipeline.yml
migration-validation:
  runs-on: ubuntu-latest
  steps:
    - name: Check for empty migrations
      run: |
        for dir in server/prisma/migrations/*/; do
          if [ -d "$dir" ] && [ ! -f "${dir}migration.sql" ]; then
            echo "::error::Empty migration directory: $dir"
            exit 1
          fi
        done
```

### 3. Test Configuration Template

Create `server/test/helpers/test-config.ts`:

```typescript
export function createTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT: 3001,
    JWT_SECRET: 'test-secret',
    ADAPTERS_PRESET: process.env.ADAPTERS_PRESET || 'mock',
    DATABASE_URL: process.env.DATABASE_URL!,
    DATABASE_CONNECTION_LIMIT: 1,
    DATABASE_POOL_TIMEOUT: 10,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    ...overrides,
  };
}
```

### 4. DI Container: Defensive Defaults

Consider adding defaults in `di.ts`:

```typescript
const connectionLimit = config.DATABASE_CONNECTION_LIMIT ?? 1;
const poolTimeout = config.DATABASE_POOL_TIMEOUT ?? 10;

databaseUrl.searchParams.set('connection_limit', String(connectionLimit));
databaseUrl.searchParams.set('pool_timeout', String(poolTimeout));
```

## Quick Reference: Schema Drift Detection

| Symptom                        | Likely Cause                  | Fix                        |
| ------------------------------ | ----------------------------- | -------------------------- |
| P2022 "column does not exist"  | Schema has column, DB doesn't | `npx prisma db push`       |
| "Migration not applied"        | Empty migration directory     | Remove dir, re-run migrate |
| "Invalid database URL"         | `undefined` in URL params     | Add missing config values  |
| Tests pass locally, fail in CI | Env var differences           | Check CI env configuration |

## Related Documentation

- [Schema Drift Prevention Guide](./schema-drift-prevention-MAIS-20251204.md)
- [Prisma Hybrid Migration System](./prisma-hybrid-migration-schema-drift.md)
- [Database Client Mismatch Prevention](./database-client-mismatch-MAIS-20251204.md)
- [CLAUDE.md - When Modifying Database Schema](../../../CLAUDE.md#when-modifying-database-schema)

## Work Log

| Date       | Action                           | Result                               |
| ---------- | -------------------------------- | ------------------------------------ |
| 2025-12-04 | Identified 189 test failures     | P2022 error on landingPageConfig     |
| 2025-12-04 | Found empty migration directory  | Removed, ran db push                 |
| 2025-12-04 | Fixed test config missing values | Added CONNECTION_LIMIT, POOL_TIMEOUT |
| 2025-12-04 | Fixed createApp signature        | Added config and startTime params    |
| 2025-12-04 | Verified fix                     | 962 tests passing                    |
