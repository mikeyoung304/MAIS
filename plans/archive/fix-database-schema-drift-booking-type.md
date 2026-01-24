# fix: Resolve Database Schema Drift - Missing Scheduling Platform Features

## Problem

Scheduling platform changes (commit `862a324`) modified Prisma schema without generating a migration. The database is missing:

- `BookingType` enum
- New Booking columns: `bookingType`, `serviceId`, `clientTimezone`, `googleEventId`, `cancelledAt`
- `Service` table
- `AvailabilityRule` table
- Updated unique constraint

**Result:** 42 integration tests failing with "column Booking.bookingType does not exist"

## Root Cause Analysis

**This codebase uses hybrid migrations:**

- Manual SQL files (00-06) applied directly via psql/Supabase (NOT tracked by Prisma)
- Prisma-generated migrations (timestamped directories)

Prisma's `_prisma_migrations` table only tracks 2 migrations:

- `20251016140827_initial_schema`
- `20251023152454_add_password_hash`

But the database has all multi-tenancy features from manual SQL files. This is **expected behavior** for this project's migration workflow.

**Database State:**

- 34 tenants (includes real data like "Plate" at mike@platemacon.com)
- 0 bookings (safe to change constraints)
- Service/AvailabilityRule tables do NOT exist

## Solution

Create a new manual SQL migration following the existing pattern (like `03_add_multi_tenancy.sql`):

```bash
# 1. Create the migration file
# (see 07_add_scheduling_platform.sql below)

# 2. Apply via psql
cd /Users/mikeyoung/CODING/MAIS/server
source .env
psql "$DATABASE_URL" -f prisma/migrations/07_add_scheduling_platform.sql

# 3. Regenerate Prisma client
npx prisma generate

# 4. Verify
npm test
```

## Why NOT use `prisma migrate dev`?

The existing manual SQL migrations (00-06) are not tracked by Prisma. Running `migrate dev` sees them as "drift" and wants to reset the database. This would **destroy real tenant data**.

The correct approach is to continue the established pattern: create manual SQL migrations and apply via psql.

## Success Criteria

- [ ] `psql` applies migration without errors
- [ ] `Service` and `AvailabilityRule` tables exist
- [ ] `bookingType` column exists on Booking with default 'DATE'
- [ ] All 42 previously failing integration tests pass
- [ ] `npm test` passes

## Prevention

Document that this project uses **hybrid migrations**:

1. Complex migrations → manual SQL files (00-XX) applied via psql
2. Simple schema changes → `prisma migrate dev` (timestamped directories)

Always check which pattern applies before making schema changes.
