---
title: Prisma 7 Config File Location and Environment Variable Fallback
category: build-errors
severity: high
symptoms:
  - 'Error: The datasource.url property is required in your Prisma config file'
  - 'PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL'
  - CI migrations fail but local works
root_cause: prisma-7-config-location
prevention: prisma-cwd-pattern
date_created: 2026-01-15
last_verified: 2026-01-15
related_commits:
  - 07a76ca1
  - a0dc3221
---

# Prisma 7 Config File Location and Environment Variable Fallback

## Problem

After upgrading to Prisma 7, CI fails with:

```
Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy.
```

Or during `prisma generate`:

```
PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL
```

## Root Cause

Prisma 7 introduced `prisma.config.ts` which **must be in the current working directory** when running CLI commands. Two issues commonly occur:

### Issue 1: Wrong Working Directory

Running from repo root with `--schema=./server/prisma/schema.prisma` doesn't work because Prisma looks for `prisma.config.ts` in the current directory (root), not relative to the schema file.

### Issue 2: `env()` Throws on Missing Variables

The Prisma config helper `env('DATABASE_URL')` throws an error if the environment variable isn't set, even for commands like `prisma generate` that don't actually need a database connection.

## Solution

### Fix 1: Always `cd` to config directory before running Prisma commands

```yaml
# WRONG - prisma.config.ts not found in root
- name: Run Prisma migrations
  run: npx prisma migrate deploy --schema=./server/prisma/schema.prisma

# CORRECT - cd to where prisma.config.ts lives
- name: Run Prisma migrations
  run: |
    cd server
    npx prisma migrate deploy
```

### Fix 2: Use `process.env` with placeholder fallback

```typescript
// server/prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use process.env with fallback - allows prisma generate without DB
    url:
      process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    directUrl:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
```

**Why this works:**

- `process.env.DATABASE_URL` returns `undefined` (doesn't throw) when not set
- The placeholder URL satisfies Prisma's validation for `prisma generate`
- Real DATABASE_URL is used when available (migrations, runtime)

## Prevention

1. **Always use `cd server &&` pattern** in CI workflows for Prisma commands
2. **Never use `env()` helper** for required datasource URLs - use `process.env` with fallback
3. **Test CI locally** with `act` or by unsetting DATABASE_URL: `unset DATABASE_URL && npx prisma generate`

## Verification

```bash
# Test that prisma generate works without DATABASE_URL
unset DATABASE_URL
cd server
npx prisma generate  # Should succeed with placeholder

# Test migrations work with DATABASE_URL
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy  # Should connect to real DB
```

## Related Files

- `server/prisma.config.ts` - Prisma 7 configuration
- `.github/workflows/main-pipeline.yml` - CI workflow
- `.github/workflows/deploy-production.yml` - Production deployment

## Tags

prisma, prisma-7, config, environment-variables, ci, migrations, schema
