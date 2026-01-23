---
title: Migration System Consolidation - Prisma-Only Pattern
slug: migration-system-consolidation
category: database-issues
tags:
  - prisma
  - migrations
  - schema-management
  - technical-debt
  - consolidation
severity: medium
component: prisma-migrations
symptoms:
  - Perpetual "drift detected" warnings from prisma migrate status
  - Shadow database conflicts during migration creation
  - Confusion between Pattern A and Pattern B documentation
  - Tests expecting numbered SQL files that shouldn't exist
root_cause: Hybrid migration system with 28 numbered SQL files outside Prisma tracking
date_solved: 2026-01-23
resolution_time: 45 minutes
---

# Migration System Consolidation - Prisma-Only Pattern

## Problem

MAIS accumulated technical debt from a hybrid migration system:

| Issue                                        | Impact                              |
| -------------------------------------------- | ----------------------------------- |
| 28 numbered SQL files (00-26, plus 17b, 23b) | Not tracked by Prisma               |
| 3 old Prisma migration folders               | Inconsistent state                  |
| Dual documentation (Pattern A vs Pattern B)  | Developer confusion                 |
| `prisma migrate status`                      | Perpetual "drift detected" warnings |

**Root Cause:** The numbered SQL files were tracked in git but NOT in Prisma's `_prisma_migrations` table. Prisma saw schema differences it didn't apply, triggering drift warnings even though the database was correct.

## Solution

### Step 1: Archive Old Migrations

```bash
cd /Users/mikeyoung/CODING/MAIS/server/prisma/migrations

# Remove numbered SQL files
rm -f [0-9][0-9]*.sql

# Remove old Prisma migration folders
rm -rf 20251016140827_initial_schema 20260118000000_add_project_hub 20260123171414_baseline_sync
```

**What this does:** Removes all migration files that were causing drift. Git history preserves them if needed later.

### Step 2: Reset Database

```bash
cd /Users/mikeyoung/CODING/MAIS/server
npx prisma migrate reset --force
```

**What this does:** Drops all tables, clears `_prisma_migrations` table, giving us a clean slate.

> **Note:** Only safe because MAIS has no production data. For production systems, see [Alternative Approaches](#alternative-approaches).

### Step 3: Create Fresh Baseline

```bash
npx prisma migrate dev --name baseline
```

**What this does:** Creates a single migration from `schema.prisma` containing all tables, enums, indexes, and constraints. This becomes the new single source of truth.

### Step 4: Verify

```bash
npx prisma migrate status  # Should show "Database schema is up to date!"
npx prisma validate        # Should pass
npm run typecheck          # Should pass
```

### Step 5: Update Documentation

Replace dual-pattern docs in CLAUDE.md with single pattern:

```markdown
### Database Migrations

All migrations use Prisma:

\`\`\`bash

# Standard migration

npx prisma migrate dev --name descriptive_name

# Custom SQL (enums, RLS, indexes)

npx prisma migrate dev --create-only --name descriptive_name

# Edit the migration.sql, then:

npx prisma migrate dev
\`\`\`
```

### Step 6: Update Tests

Changed `schema-consistency.spec.ts` test from expecting numbered SQL files to expecting none:

```typescript
// Before (expected numbered files)
it('should have numbered manual SQL migrations', () => {
  const numericFiles = sqlFiles.filter((f) => /^\d+_/.test(f));
  expect(files.length).toBeGreaterThan(2);
});

// After (expects NO numbered files)
it('should use Prisma-only migrations (no numbered SQL files)', () => {
  const numericSqlFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f));
  expect(numericSqlFiles.length).toBe(0);
});
```

## Results

| Metric                  | Before                    | After             |
| ----------------------- | ------------------------- | ----------------- |
| Migration files         | 28 SQL + 3 Prisma folders | 1 Prisma baseline |
| Lines of migration code | ~3,000                    | ~1,300            |
| Drift warnings          | Perpetual                 | None              |
| Migration patterns      | 2 (confusing)             | 1 (clear)         |
| `prisma migrate status` | "Drift detected"          | "Up to date!"     |

## Prevention Strategies

### Always Do

1. **Use Prisma for all schema changes**

   ```bash
   npx prisma migrate dev --name descriptive_name
   ```

2. **For custom SQL (enums, RLS, indexes)**

   ```bash
   npx prisma migrate dev --create-only --name add_rls_policies
   # Edit server/prisma/migrations/[timestamp]_add_rls_policies/migration.sql
   npx prisma migrate dev
   ```

3. **Verify after every migration**
   ```bash
   npx prisma migrate status
   ```

### Never Do

- Create numbered SQL files (00*\*, 01*\*, etc.)
- Run raw SQL directly against the database
- Edit migrations after they've been applied
- Use `prisma db push` in development (use `migrate dev`)

### Test Enforcement

The updated test in `schema-consistency.spec.ts` will fail CI if anyone creates numbered SQL files:

```typescript
it('should use Prisma-only migrations (no numbered SQL files)', () => {
  const numericSqlFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f));
  expect(numericSqlFiles.length).toBe(0); // Fails if any exist
});
```

## Alternative Approaches

For **production systems with data**, you cannot use `migrate reset`. Instead:

1. **Baseline existing database:**

   ```bash
   npx prisma migrate resolve --applied "20260123225244_baseline"
   ```

   This marks the baseline as "already applied" without running it.

2. **Squash migrations:**
   Create a new baseline and mark all old migrations as applied.

## Related Documentation

- [CLAUDE.md - Database Migrations section](/CLAUDE.md#database-migrations)
- [Pitfall #59 - Migration rollback file anti-pattern](/CLAUDE.md#cicd-pitfalls-58-59)
- [DEVELOPING.md - Migration commands](/DEVELOPING.md)

## Lessons Learned

1. **Single source of truth matters:** Dual systems (Prisma + raw SQL) accumulate drift over time.

2. **Test what you expect:** The old test expected numbered files; the new test enforces their absence.

3. **Clean slate is easier:** With no production data, resetting is simpler than reconciling drift.

4. **Document the "why":** The single-pattern documentation prevents future confusion.

## Commit Reference

```
d998df53 refactor: consolidate to Prisma-only migrations
```
