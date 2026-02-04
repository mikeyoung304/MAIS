# Safe Table Drop Quick Reference

## Schema Cleanup - February 4, 2026

### Situation: Table Defined in Schema but Never Used in Code

You want to drop a deprecated database table. Must verify:

1. Zero code uses it
2. Zero rows exist in production
3. Dependent enums/types are kept separately

### 5-Minute Verification

```bash
# 1. Check for code references (search all source)
grep -r "onboardingEvent\|OnboardingEvent" server/src/ apps/web/src/ \
  --include="*.ts" --include="*.tsx"

# Expected: Only schema.prisma and migrations (no application code)

# 2. Check for dependent types still in use
grep -r "OnboardingPhase" server/src/ apps/web/src/ --include="*.ts"

# Expected: If found, keep enum even though table is dropped
```

### Production Data Check

⚠️ **CRITICAL:** Verify zero rows exist before writing DROP statement.

```sql
-- Run in Supabase SQL Editor (verify your database!)
SELECT COUNT(*) as row_count FROM "OnboardingEvent";

-- Result MUST be: 0 (zero rows)
-- If rows exist: Plan migration strategy before dropping
```

**Why check production?**

- Cannot undo DROP TABLE (data is gone)
- Must verify migration is data-safe
- Prevents accidental loss of business data

**MAIS uses:** Supabase (NOT Render Postgres)

- Supabase SQL Editor: ✓ Works
- Supabase CLI: ✗ Limited (interactive only)
- Render MCP: ✗ Wrong database

### Migration Steps

```bash
# 1. Create forward-only migration
npx prisma migrate dev --create-only --name drop_onboarding_event_table

# 2. Edit migration file and add DROP statement
# File: prisma/migrations/{timestamp}_drop_onboarding_event_table/migration.sql

-- Verified 0 rows in production 2026-02-04
-- Enum OnboardingPhase retained (used by agent system)
DROP TABLE IF EXISTS "OnboardingEvent";

# 3. Execute migration (runs on dev, updates schema)
npx prisma migrate dev

# 4. Verify TypeScript (should have 0 errors)
npm run typecheck
```

### Schema Changes

```typescript
// BEFORE
enum OnboardingPhase { ... }
model OnboardingEvent { ... }

// AFTER
enum OnboardingPhase { ... }     // KEEP - still used
// model OnboardingEvent deleted
```

### Critical Safety Rules

#### ✓ DO THIS

```sql
-- Forward-only, idempotent
DROP TABLE IF EXISTS "OnboardingEvent";
```

#### ✗ NEVER DO THIS

```bash
# WRONG: Creates rollback that undoes the drop
16_drop_table.sql          # Runs first, drops table
16_drop_table_rollback.sql # Runs second (alphabetically), recreates table

# Result: Schema drift between dev and production
```

### Verification Checklist

- [ ] Code search finds 0 references to table in application code
- [ ] Production database verified: 0 rows exist
- [ ] Dependent enums/types identified (keep separately if needed)
- [ ] Migration created with `DROP TABLE IF EXISTS` (idempotent)
- [ ] Schema updated (model removed, enum kept if needed)
- [ ] `npm run typecheck` passes
- [ ] Migration tested locally: `npx prisma migrate dev`

### Common Mistakes

| Mistake                  | Impact          | Prevention                       |
| ------------------------ | --------------- | -------------------------------- |
| Paired rollback files    | Schema drift    | Forward-only migrations only     |
| Not verifying production | Data loss       | Always check row count first     |
| Dropping dependent enum  | Runtime errors  | Keep enum if application uses it |
| Dropping with active FK  | Migration fails | Check other tables' constraints  |

### What Happened February 4

**OnboardingEvent Table:**

```
Code references:     0 (zero application code)
Production rows:     0 (verified in Supabase)
Enum dependencies:   OnboardingPhase (kept - used by agents)
Migration result:    Forward-only DROP TABLE IF EXISTS
TypeScript errors:   0 (no orphan references)
```

### Full Documentation

See: `/docs/solutions/database-issues/SCHEMA_DEPRECATION_SAFE_DROP_PATTERN.md`
