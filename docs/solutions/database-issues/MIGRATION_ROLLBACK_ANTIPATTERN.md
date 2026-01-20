# Migration Rollback File Anti-Pattern

**Problem ID:** MIGRATION-ROLLBACK-001
**Discovered:** 2026-01-20
**Severity:** HIGH - Schema drift between environments

## The Problem

The `chatEnabled` column existed in production but was missing in CI test database. Integration tests failed with "column does not exist" errors.

## Root Cause

A rollback migration file was created alongside its forward migration:

```
server/prisma/migrations/
├── 16_add_customer_chat_support.sql          ← Adds chatEnabled column
├── 16_add_customer_chat_support_rollback.sql ← REMOVES chatEnabled column
```

**The trap:** Migrations apply in alphabetical order. Since `rollback` comes after `support`:

1. `16_add_customer_chat_support.sql` runs → adds column ✅
2. `16_add_customer_chat_support_rollback.sql` runs → removes column ❌

**Result:** Production (migrated long ago) has the column. Fresh databases (CI, new dev) don't.

## The Anti-Pattern

**NEVER create paired rollback files:**

```
# WRONG - Creates schema drift
16_add_feature.sql
16_add_feature_rollback.sql

# WRONG - Duplicate numbers
17_add_subscription_tier.sql
17_add_session_type_index.sql
```

## The Correct Pattern

**Rollbacks are forward migrations:**

```
# CORRECT - Forward-only, sequential
16_add_customer_chat_support.sql      # Adds chatEnabled
25_remove_customer_chat_support.sql   # IF you need to remove it later
```

**Why this works:**

- Each migration has a unique number
- Order is deterministic
- Schema state is reproducible in any environment

## The Fix

### Immediate Fix (5 minutes)

```bash
# Delete rollback files
rm server/prisma/migrations/16_add_customer_chat_support_rollback.sql

# Rename duplicates to use suffixes
mv server/prisma/migrations/17_add_session_type_index.sql \
   server/prisma/migrations/17b_add_session_type_index.sql

mv server/prisma/migrations/23_booking_links_phase1.sql \
   server/prisma/migrations/23b_booking_links_phase1.sql
```

### Permanent Prevention (2 hours)

**1. Migration validation script:**

```typescript
// server/scripts/validate-migrations.ts
const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{2}[a-z]?_.*\.sql$/.test(f));

// Check for rollback files
const rollbacks = sqlFiles.filter((f) => f.includes('rollback'));
if (rollbacks.length > 0) {
  console.error('❌ Rollback files found (use forward migrations):');
  rollbacks.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

// Check for duplicate numbers
const numbers = new Map<string, string[]>();
for (const file of sqlFiles) {
  const num = file.match(/^(\d{2})/)?.[1];
  if (num) {
    if (!numbers.has(num)) numbers.set(num, []);
    numbers.get(num)!.push(file);
  }
}

for (const [num, files] of numbers) {
  if (files.length > 1 && !files.some((f) => /^\d{2}[a-z]_/.test(f))) {
    console.error(`❌ Duplicate migration number ${num}:`);
    files.forEach((f) => console.error(`   - ${f}`));
    process.exit(1);
  }
}
```

**2. Pre-commit hook:**

```bash
# .husky/pre-commit
if git diff --cached --name-only | grep -q "server/prisma/migrations/"; then
  npm run --workspace=server validate:migrations
fi
```

**3. CI skip rollback files:**

```bash
# In CI migration loop
if [[ "$filename" == *"rollback"* ]]; then
  echo "⏭️ Skipping rollback: $filename"
  continue
fi
```

## Migration Naming Convention

| Format                        | Example             | Use Case           |
| ----------------------------- | ------------------- | ------------------ |
| `NN_description.sql`          | `16_add_chat.sql`   | Standard migration |
| `NNa_description.sql`         | `16a_fix_chat.sql`  | Amendment to NN    |
| `NNb_description.sql`         | `16b_add_index.sql` | Second amendment   |
| `NN_description_rollback.sql` | ❌ NEVER            | Anti-pattern       |

## Hybrid Migration System Notes

MAIS uses Prisma + manual SQL migrations:

- **Prisma migrations:** `20251016140827_initial_schema/` (timestamped directories)
- **Manual SQL:** `01_*.sql` through `24_*.sql` (numbered files)

Both systems coexist. The manual SQL handles:

- Custom enum types
- PostgreSQL-specific features
- Performance indexes
- RLS policies

**The validation script checks manual SQL only** - Prisma handles its own consistency.

## Related

- **CLAUDE.md Pitfall:** #59 (Migration rollback file anti-pattern)
- **Plan:** `plans/fix-enterprise-stability-synthesized.md` Phase 1
- **Existing docs:** `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`
- **PR:** #29 (Enterprise Stability Foundation)

## Search Keywords

`rollback migration`, `schema drift`, `column missing`, `duplicate migration number`, `chatEnabled`, `16_rollback`
