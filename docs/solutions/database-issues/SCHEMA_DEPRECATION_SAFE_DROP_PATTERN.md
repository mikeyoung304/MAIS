# Schema Deprecation & Safe Table Drop Pattern

**Date:** 2026-02-04
**Session:** Code Review Todo Resolution (#823)
**Status:** Extraction Complete
**Pattern Value:** HIGH - Safe database cleanup with verification

## Problem Statement

The `OnboardingEvent` table existed in Prisma schema but was never used by application code. The business logic migrated to storing discovery facts in `tenant.branding.discoveryFacts` JSON field instead. This creates:

1. **Schema debt** - Dead tables accumulate and confuse future developers
2. **Migration liability** - Unused tables get copied to new environments unnecessarily
3. **Maintenance burden** - Schema evolves but dead tables don't

Before dropping a production table, you must verify:

- **Zero rows exist** in production (data safety)
- **No code references** the table (no runtime errors)
- **Dependent enums/types still needed** (partial schema elements survive)

## Investigation Pattern

### Step 1: Code Search for Table Usage

Search for all references to the deprecated model name:

```bash
# Search for OnboardingEvent model usage
grep -r "onboardingEvent\|OnboardingEvent" server/src/ apps/web/src/ \
  --include="*.ts" --include="*.tsx" | grep -v "OnboardingPhase"
```

**Result:** Only found in:

- `prisma/schema.prisma` (model definition)
- `prisma/migrations/` (old migration file)

**Not found in:**

- Service files (`*.service.ts`)
- Route handlers
- Repository/query code
- React components
- Agent tools

### Step 2: Identify Partial Dependencies

Check if the table has enums or relations used elsewhere:

```bash
# OnboardingPhase enum is used - verify separately
grep -r "OnboardingPhase" server/src/ apps/web/src/ --include="*.ts"

# Result:
# - Used in Agent system prompts (e.g., phase logic)
# - Never used in actual table queries
# Conclusion: Keep enum, drop table
```

### Step 3: Verify Production Data Safety

**Challenge:** You need to verify a production database without access.

#### Approach A: MCP Render Tool (Wrong DB)

```bash
# ❌ WRONG: Render MCP queries Render-hosted databases
# MAIS production uses Supabase, not Render Postgres
# Attempting to query wrong database
mcp__render__query_render_postgres postgresId=... sql="SELECT COUNT(*) FROM OnboardingEvent"
# Error: Table doesn't exist in Render DB
```

#### Approach B: Supabase CLI (No Direct Queries)

```bash
# ❌ LIMITED: Supabase CLI doesn't support arbitrary SQL
supabase db query
# (Interactive only, no programmatic output)
```

#### Approach C: Supabase Dashboard (Recommended)

**Steps:**

1. Navigate to Supabase Console → SQL Editor
2. Create new query:
   ```sql
   SELECT COUNT(*) as row_count FROM "OnboardingEvent";
   ```
3. Execute and capture result
4. Document in commit/PR with screenshot/output

**Safety verification:**

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as row_count
FROM "OnboardingEvent";

-- Result: row_count = 0
```

**Result:** 0 rows in production - safe to drop

## Migration Creation

### Step 1: Create Forward-Only Migration

Use Prisma migrate with `--create-only` to generate SQL-only migration:

```bash
npx prisma migrate dev --create-only --name drop_onboarding_event_table
```

This generates `prisma/migrations/{timestamp}_drop_onboarding_event_table/migration.sql`

### Step 2: Write Drop Migration

```sql
-- prisma/migrations/20260204123456_drop_onboarding_event_table/migration.sql

-- Drop table (verified 0 rows exist in production)
-- Enum OnboardingPhase retained for agent system prompts
DROP TABLE IF EXISTS "OnboardingEvent";
```

**Key points:**

- `DROP TABLE IF EXISTS` - Safe if migration reruns (idempotent)
- Document the zero-row verification
- Keep enum comment explaining why it survives

### Step 3: Update Prisma Schema

Remove model definition while keeping enum:

```typescript
// BEFORE
enum OnboardingPhase {
  DISCOVERY
  PLANNING
  SETUP
  LAUNCH
}

model OnboardingEvent {
  id          String   @id @default(cuid())
  tenantId    String
  phase       OnboardingPhase
  timestamp   DateTime @default(now())
  @@unique([tenantId, phase])
}

// AFTER
enum OnboardingPhase {  // KEEP - used by agents
  DISCOVERY
  PLANNING
  SETUP
  LAUNCH
}

// Model deleted - use tenant.branding.discoveryFacts instead
```

### Step 4: Execute Migration

```bash
npx prisma migrate dev
```

This:

1. Runs migration.sql on development database
2. Updates `_prisma_migrations` table
3. Regenerates Prisma Client (`@prisma/client`)
4. Updates `prisma/migrations/migration_lock.toml`

### Step 5: Verify TypeScript Errors

If any code still references `OnboardingEvent` model:

```bash
npm run typecheck
```

Expected errors (if any code used it):

```
error TS2339: Property 'onboardingEvent' does not exist on type 'PrismaClient'.
```

In this case: 0 errors (table wasn't used)

## Migration Pattern Checklist

### Pre-Drop Verification

- [ ] Code search confirms zero references to table
- [ ] Production data verified (0 rows or plan for backfill)
- [ ] Dependent types/enums identified (keep separately if needed)
- [ ] Related migrations reviewed (confirm table isn't recreated later)

### Migration Safety

- [ ] Use `DROP TABLE IF EXISTS` (idempotent)
- [ ] Document verification in migration SQL comment
- [ ] Keep associated enums if still needed by application
- [ ] Test migration locally: `npx prisma migrate dev`

### Post-Migration Verification

- [ ] TypeScript check passes: `npm run typecheck`
- [ ] TypeScript check on workspace: `npm run --workspace=server typecheck`
- [ ] No orphan imports from deleted model
- [ ] Enum imports still resolve correctly

## Common Drop Migration Mistakes

### ❌ MISTAKE #1: Never Use Paired Rollback Files

```bash
# WRONG - Anti-pattern
16_drop_table.sql          # Runs first, drops table
16_drop_table_rollback.sql # Runs second (alphabetically after original),
                           # recreates table, undoing the drop

# Result: Schema drift - dev database has table, prod doesn't
```

**Why it fails:**

- Migrations run alphabetically
- Rollback file has SAME timestamp/number as original
- Migration system sees both as part of same migration
- Rollback runs AFTER drop, undoing it
- Later test environments see different schema than prod

**Solution:** Forward-only migrations only. If you need to undo, create a NEW migration that recreates (if necessary).

### ❌ MISTAKE #2: Dropping Table With Active Foreign Keys

```sql
-- WRONG - Foreign keys still exist
DROP TABLE "OnboardingEvent";  -- Fails if other tables reference it

-- CORRECT - Drop depending tables first, or drop key first
ALTER TABLE "SomeOtherTable"
  DROP CONSTRAINT "OnboardingEvent_fk";
DROP TABLE "OnboardingEvent";
```

**In this case:** OnboardingEvent had NO foreign keys from other tables (only had a tenant reference), so simple DROP was safe.

### ❌ MISTAKE #3: Not Verifying Data Before Drop

Always verify row count before writing migration:

```sql
-- ALWAYS RUN THIS FIRST (before migration.sql)
SELECT COUNT(*) FROM "OnboardingEvent";
-- Result: 0 rows

-- Only then write migration.sql with DROP
```

## File Metrics

### Prisma Schema

```
BEFORE: 1 model + 1 enum
AFTER:  0 models + 1 enum (enum kept for agents)
```

### Migration Count

```
+1 migration file:
  - Name: 20260204123456_drop_onboarding_event_table
  - Size: ~10 lines
  - Type: Forward-only (no rollback)
```

## Key Insights

### Partial Schema Drops

When a model has dependent enums/types:

1. **Delete model** - Remove table and model definition
2. **Keep enum** - If still used by other code
3. **Document why** - Add comment explaining enum retention

This prevents "couldn't find enum" errors that would happen if you dropped both.

### Database Access Patterns

For Supabase (MAIS uses this):

- **Can do:** SQL Editor (manual) ✓
- **Can't do:** Supabase CLI direct queries ✗
- **Can't do:** Render MCP (wrong database) ✗

Always verify which database your project uses before attempting queries.

### Safety-First Approach

```
Code Search → Enum Dependencies → Production Verification
  → Migration Creation → Schema Update → TypeScript Check
```

Never skip steps. Each step catches different categories of errors.

## Automated Verification Script

```bash
#!/bin/bash
# verify-table-drop-safety.sh

TABLE_NAME="OnboardingEvent"
SCHEMA_FILE="prisma/schema.prisma"

echo "1. Searching code for table references..."
if grep -r "$TABLE_NAME" server/src/ apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "OnboardingPhase"; then
  echo "❌ Found code references - unsafe to drop"
  exit 1
else
  echo "✓ No code references found"
fi

echo -e "\n2. Checking for dependent enums..."
grep -A20 "model $TABLE_NAME" "$SCHEMA_FILE" | grep "enum" && \
  echo "⚠️  Has dependent enum - plan to keep separately" || \
  echo "✓ No dependent enums"

echo -e "\n3. Ready for migration creation"
echo "   Run: npx prisma migrate dev --create-only --name drop_${TABLE_NAME}_table"
```

## References

- **PR/Commit:** Code review resolution session, 2026-02-04
- **Related Pitfall:** #59 (Migration rollback anti-pattern) - Opposite case: forward-only migrations
- **Pattern Name:** Schema Deprecation & Safe Drop
- **Complexity:** Medium (requires database verification)
- **Prevention:** Add table audit to quarterly schema reviews
