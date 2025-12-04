---
title: 'Database Schema Drift: Prisma vs Manual Migrations'
category: database-issues
tags:
  - prisma
  - migrations
  - schema-drift
  - hybrid-migrations
  - multi-tenant
severity: high
component: prisma-migrations
status: resolved
date_resolved: '2025-11-28'
symptoms:
  - "42 integration tests failing with 'column Booking.bookingType does not exist'"
  - 'Prisma schema contains scheduling platform features missing from database'
  - 'Schema modifications made without generating corresponding migrations'
  - 'Prisma detects massive drift between local schema and actual database state'
related_errors:
  - 'database error: column Booking.bookingType does not exist'
  - 'Prisma migration history out of sync with manual SQL migrations'
  - 'Risk of data loss if destructive migrate reset executed'
---

# Database Schema Drift: Prisma vs Manual Migrations

## Problem Summary

Scheduling platform changes (commit `862a324`) modified `schema.prisma` without generating a migration. The database was missing:

- `BookingType` enum
- New Booking columns: `bookingType`, `serviceId`, `clientTimezone`, `googleEventId`, `cancelledAt`
- `Service` table
- `AvailabilityRule` table
- Updated unique constraint

**Result:** 42 integration tests failing with "column Booking.bookingType does not exist"

## Root Cause Analysis

### The Hybrid Migration System

MAIS uses a **hybrid migration approach** that wasn't documented:

| Migration Type     | Tracked by Prisma | Applied Via          | Files                         |
| ------------------ | ----------------- | -------------------- | ----------------------------- |
| Manual SQL (00-06) | NO                | psql directly        | `NN_name.sql`                 |
| Prisma-generated   | YES               | `prisma migrate dev` | `YYYYMMDD_name/migration.sql` |

### Why `prisma migrate dev` Was Dangerous

When `prisma migrate dev` was run, it showed "massive drift" because:

1. **Prisma only tracked 2 migrations** in `_prisma_migrations` table:
   - `20251016140827_initial_schema`
   - `20251023152454_add_password_hash`

2. **Database had all multi-tenancy features** from manual SQL files (00-06)

3. **Prisma interpreted this as drift** and wanted to reset the database

4. **Real tenant data existed** (34 tenants including "Plate" at mike@platemacon.com)

Running `prisma migrate reset` would have **destroyed all production data**.

## Solution

### Step 1: Create Manual SQL Migration

Created `07_add_scheduling_platform.sql` following the existing manual migration pattern:

```sql
-- =====================================================================
-- Migration: Add Scheduling Platform Features
-- Date: 2025-11-28
-- =====================================================================

-- Step 1: Create BookingType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingType') THEN
    CREATE TYPE "BookingType" AS ENUM ('DATE', 'TIMESLOT');
  END IF;
END $$;

-- Step 2: Add new columns to Booking table
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "bookingType" "BookingType" NOT NULL DEFAULT 'DATE';

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "clientTimezone" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- Step 3: Create Service table
CREATE TABLE IF NOT EXISTS "Service" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  -- ... (full definition in migration file)
);

-- Step 4: Create AvailabilityRule table
CREATE TABLE IF NOT EXISTS "AvailabilityRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  -- ... (full definition in migration file)
);

-- Step 5: Update unique constraint
ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_tenantId_date_key";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_tenantId_date_bookingType_key"
  UNIQUE ("tenantId", "date", "bookingType");

-- Step 6: Add partial unique index for TIMESLOT double-booking prevention
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_timeslot_unique"
ON "Booking"("tenantId", "serviceId", "startTime")
WHERE "startTime" IS NOT NULL AND "serviceId" IS NOT NULL;
```

### Step 2: Apply Migration

```bash
cd /Users/mikeyoung/CODING/MAIS/server
source .env
psql "$DATABASE_URL" -f prisma/migrations/07_add_scheduling_platform.sql
```

### Step 3: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 4: Verify

```bash
npm test
```

## Results

| Metric                   | Before  | After                     |
| ------------------------ | ------- | ------------------------- |
| Tests passing            | 729     | 773                       |
| Tests failing            | 42      | 3                         |
| `bookingType` column     | Missing | Present (default: `DATE`) |
| `Service` table          | Missing | Present                   |
| `AvailabilityRule` table | Missing | Present                   |

The remaining 3 failures are pre-existing test isolation issues (duplicate test data), unrelated to the migration.

## Prevention Strategies

### 1. Document the Hybrid Migration Pattern

Added to `CLAUDE.md`:

```markdown
### When Modifying Database Schema

MAIS uses a **hybrid migration system** with two patterns:

**Pattern A: Prisma Migrations** (for tables/columns)

1. Edit server/prisma/schema.prisma
2. npm exec prisma migrate dev --name descriptive_name
3. Prisma auto-generates migration.sql and applies it

**Pattern B: Manual Raw SQL** (for enums, indexes, extensions, RLS)

1. Edit server/prisma/schema.prisma
2. Create: server/prisma/migrations/NN_name.sql (idempotent SQL)
3. Apply: psql $DATABASE_URL < migrations/NN_name.sql
4. npm exec prisma generate
```

### 2. Decision Guide

| Change         | Pattern | Why                          |
| -------------- | ------- | ---------------------------- |
| Add column     | A       | Prisma handles ALTER TABLE   |
| Add table      | A       | Prisma handles CREATE TABLE  |
| Create enum    | B       | PostgreSQL-specific syntax   |
| Add index      | B       | More control over index type |
| Add constraint | A       | Prisma handles constraints   |
| RLS policy     | B       | PostgreSQL-specific          |

### 3. Critical Rules

- **Never run `prisma migrate reset`** on databases with real data
- **Check migration status first**: `prisma migrate status`
- **Use idempotent SQL**: `IF EXISTS`, `IF NOT EXISTS`, `DO $$` blocks
- **Commit schema + migrations together**
- **Test locally before committing**

### 4. Pre-Commit Verification

Before committing schema changes:

```bash
# Check what Prisma sees
npx prisma migrate status

# If it shows "drift", check if manual migrations exist
ls prisma/migrations/*.sql

# If drift is from manual migrations, that's expected - use Pattern B
```

## Key Insights

1. **Hybrid migrations are valid** - Many projects use manual SQL for PostgreSQL-specific features
2. **Prisma doesn't track everything** - Manual migrations bypass Prisma's tracking
3. **Always check before reset** - `migrate reset` is destructive
4. **Document your patterns** - Future developers (and AI agents) need to know

## Related Documentation

- `CLAUDE.md` - Updated with "When Modifying Database Schema" section
- `DEVELOPING.md` - Database commands reference
- `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Tenant isolation patterns
- `server/prisma/migrations/07_add_scheduling_platform.sql` - The fix migration

## Files Created/Modified

- **Created**: `server/prisma/migrations/07_add_scheduling_platform.sql`
- **Updated**: `CLAUDE.md` (hybrid migration documentation)
- **Updated**: `plans/fix-database-schema-drift-booking-type.md` (plan file)
