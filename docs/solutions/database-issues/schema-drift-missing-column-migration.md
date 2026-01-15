---
title: Schema Drift - Column Defined in Schema but Missing Migration
category: database-issues
severity: high
symptoms:
  - "The column `X` does not exist in the current database"
  - "PrismaClientKnownRequestError: Invalid prisma.model.operation() invocation"
  - Tests pass locally but fail in CI
  - "P2022" error code
root_cause: schema-drift-missing-migration
prevention: always-migrate-after-schema-change
date_created: 2026-01-15
last_verified: 2026-01-15
related_commits:
  - d96a6ddb
---

# Schema Drift - Column Defined in Schema but Missing Migration

## Problem

CI fails with database column errors like:

```
PrismaClientKnownRequestError:
The column `tier` does not exist in the current database.
```

But locally everything works fine.

## Root Cause

**Schema drift**: A column/field was added to `schema.prisma` but no migration was created. This happens when:

1. Developer runs `prisma generate` (updates Prisma Client) but forgets `prisma migrate dev`
2. Column was added directly to production database (manual SQL) but not captured in migration
3. Local database has the column (from previous runs) but CI uses fresh database

### Why Local Works

Your local database might have the column because:

- You ran `prisma db push` at some point (applies schema without migration)
- You manually added it via SQL
- An old migration created it but was later removed

### Why CI Fails

CI databases are created fresh and only have columns from migrations in the `migrations/` folder.

## Solution

### Step 1: Identify Missing Columns

```bash
# Compare schema to migrations
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

### Step 2: Create Migration

For simple columns (no enums):

```bash
npx prisma migrate dev --name add_missing_column
```

For columns with enums (Pattern B - manual SQL required):

```sql
-- server/prisma/migrations/17_add_subscription_tier.sql

-- Step 1: Create enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionTier') THEN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
  END IF;
END$$;

-- Step 2: Add column with default
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
```

### Step 3: Verify

```bash
# Check migration status
cd server && npx prisma migrate status

# Test with fresh database (like CI)
docker-compose down -v
docker-compose up -d
npx prisma migrate deploy
npm test
```

## Prevention

### Rule: Never run `prisma generate` without `prisma migrate dev`

```bash
# WRONG - creates client but no migration
npx prisma generate

# CORRECT - creates migration AND updates client
npx prisma migrate dev --name describe_your_change
```

### Add Pre-commit Check

```bash
# .husky/pre-commit (optional)
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --exit-code || {
    echo "Schema drift detected! Run: npx prisma migrate dev"
    exit 1
  }
```

## Detection Checklist

When you see "column does not exist" in CI:

1. ☐ Check if column is in `schema.prisma`
2. ☐ Search migrations for column: `grep -r "columnName" prisma/migrations/`
3. ☐ If not found, create migration
4. ☐ For enums, use Pattern B (manual SQL)
5. ☐ Test with fresh local database before pushing

## Common Drift Patterns

| Schema Addition  | Migration Pattern           |
| ---------------- | --------------------------- |
| Simple column    | `prisma migrate dev` (auto) |
| Column with enum | Manual SQL (Pattern B)      |
| New enum type    | Manual SQL (Pattern B)      |
| Index/constraint | `prisma migrate dev` (auto) |
| Relation field   | `prisma migrate dev` (auto) |

## Related Documentation

- `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` - Prevention decision tree
- `docs/solutions/database-issues/prisma-hybrid-migration-schema-drift.md` - Hybrid migration patterns

## Tags

prisma, schema-drift, migrations, database, ci, columns, enums
