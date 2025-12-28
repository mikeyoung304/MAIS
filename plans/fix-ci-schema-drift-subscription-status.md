# Fix CI Schema Drift: subscriptionStatus Column Missing

## Overview

The CI integration tests are failing because the `subscriptionStatus` column doesn't exist in the CI test database. The field was added to `schema.prisma` but the corresponding migration was never created.

**Error:**

```
The column `subscriptionStatus` does not exist in the current database.
```

**Location:** `server/test/helpers/integration-setup.ts:139`

## Problem Statement

The Prisma schema has three subscription-related fields on the Tenant model that have no corresponding database migration:

| Field                | Type               | Default | Line in schema.prisma |
| -------------------- | ------------------ | ------- | --------------------- |
| `trialEndsAt`        | DateTime?          | null    | 70                    |
| `subscriptionStatus` | SubscriptionStatus | NONE    | 71                    |
| `stripeCustomerId`   | String?            | null    | 72                    |

The `SubscriptionStatus` enum is also defined but not in the database:

```prisma
enum SubscriptionStatus {
  NONE      // Signed up, no trial started
  TRIALING  // In 14-day trial
  ACTIVE    // Paid customer
  EXPIRED   // Trial ended, didn't pay (soft lock)
}
```

## Root Cause

Schema was modified in `schema.prisma` without running `prisma migrate dev` to generate a migration. This is a classic schema drift issue documented in `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`.

## Proposed Solution

### Two-Part Fix Required

**Part 1: Create the missing migration**

Per the hybrid migration system documented in CLAUDE.md, this requires **Pattern B (Manual SQL)** because it includes an enum:

Create: `server/prisma/migrations/15_add_subscription_fields.sql`

```sql
-- Add SubscriptionStatus enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'EXPIRED');
  END IF;
END$$;

-- Add subscription fields to Tenant table
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Add unique constraint on stripeCustomerId
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
```

**Part 2: Apply locally and regenerate Prisma Client**

```bash
cd server
psql $DATABASE_URL < prisma/migrations/15_add_subscription_fields.sql
npm exec prisma generate
```

## Technical Details

### Files to Create

| File                                                      | Purpose              |
| --------------------------------------------------------- | -------------------- |
| `server/prisma/migrations/15_add_subscription_fields.sql` | Add enum and columns |

### Files to Verify (No Changes Needed)

| File                                       | Reason                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `server/prisma/schema.prisma`              | Already has the fields (lines 70-72)           |
| `server/test/helpers/integration-setup.ts` | Uses `@default(NONE)` so no code change needed |
| `.github/workflows/main-pipeline.yml`      | Already applies manual SQL migrations          |

### CI Migration Flow (Already Configured)

The CI workflow (`main-pipeline.yml:306-321`) already handles this:

```bash
for file in server/prisma/migrations/[0-9][0-9]_*.sql; do
  # ... applies all numbered migrations
done
```

Once we add `15_add_subscription_fields.sql`, CI will automatically apply it.

## Acceptance Criteria

- [ ] Migration file `15_add_subscription_fields.sql` exists and is idempotent
- [ ] `SubscriptionStatus` enum exists in database
- [ ] `Tenant` table has `trialEndsAt`, `subscriptionStatus`, `stripeCustomerId` columns
- [ ] `stripeCustomerId` has unique constraint
- [ ] CI integration tests pass
- [ ] Local `npm test` passes

## Risk Assessment

| Risk                          | Likelihood | Impact | Mitigation                                  |
| ----------------------------- | ---------- | ------ | ------------------------------------------- |
| Migration fails in production | Low        | Medium | Idempotent SQL with IF NOT EXISTS           |
| Data loss                     | None       | N/A    | Only adding columns, no destructive changes |
| Type mismatch                 | Low        | Low    | Using exact types from schema.prisma        |

## References

- Schema file: `server/prisma/schema.prisma:70-72, 559-564`
- CI workflow: `.github/workflows/main-pipeline.yml:306-321`
- Migration pattern guide: `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`
- Hybrid migration docs: `docs/solutions/database-issues/prisma-hybrid-migration-schema-drift.md`

## Implementation Steps

1. Create `server/prisma/migrations/15_add_subscription_fields.sql` with idempotent SQL
2. Apply locally: `psql $DATABASE_URL < server/prisma/migrations/15_add_subscription_fields.sql`
3. Regenerate client: `npm exec prisma generate`
4. Run tests locally: `npm test`
5. Commit and push
6. Verify CI passes

## Estimated Effort

~15 minutes
