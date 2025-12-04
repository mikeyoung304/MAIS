# Schema Drift Prevention - Implementation Status

**Created:** 2025-11-28
**Status:** Fully Implemented
**Priority:** Critical
**Impact:** Prevents production-level database corruption and AI agent errors

---

## Summary

This document tracks the implementation of comprehensive prevention strategies for database schema drift - the critical issue where schema.prisma changes were made without corresponding migrations, risking destructive database operations.

## What Was Implemented

### 1. ✅ Core Prevention Document (COMPLETED)

- **File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/SCHEMA_DRIFT_PREVENTION.md`
- **Contents:**
  - Executive summary of the problem and root causes
  - Decision tree for choosing between Pattern A (Prisma) vs Pattern B (Manual SQL)
  - Detailed migration architecture explanation
  - Pre-commit hook script with full output
  - CI/CD safety gates (GitHub Actions YAML)
  - Safe practices for AI agent database interactions
  - Test cases for schema consistency
  - Quick reference checklist

### 2. ✅ Pre-Commit Hook Integration (COMPLETED)

- **File:** `/Users/mikeyoung/CODING/MAIS/.claude/hooks/validate-patterns.sh` (existing hook enhanced)
- **Changes Made:**
  - Added Check 6: Schema Drift Detection
  - Detects when schema.prisma is modified without migrations
  - Provides actionable error messages with clear remediation steps
  - Prevents commits that violate schema consistency

**How It Works:**

```bash
git add server/prisma/schema.prisma  # Modified without migration
git commit -m "add new field"        # Hook triggers
→ ❌ SCHEMA DRIFT DETECTED!
→ Suggests: npm exec prisma migrate dev --name ...
→ Blocks commit until migration is created
```

### 3. ✅ CLAUDE.md Documentation (COMPLETED)

- **File:** `/Users/mikeyoung/CODING/MAIS/CLAUDE.md`
- **Updates:**
  - "When Modifying Database Schema" section with hybrid migration system explained
  - Pattern A (Prisma migrations) for tables/columns
  - Pattern B (Manual SQL) for enums, indexes, extensions
  - Decision guide table showing which pattern to use
  - Critical rules for safe schema modifications
  - Reference to comprehensive SCHEMA_DRIFT_PREVENTION.md

### 4. ✅ Schema Consistency Tests (COMPLETED)

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/schema-consistency.test.ts`
- **Tests Include:**
  - Schema files exist and have content
  - Required models are defined (Tenant, User, Package, Booking, Service, etc.)
  - Required enums exist (UserRole, BookingStatus, BookingType, PaymentStatus)
  - Migration files are present and not empty
  - Manual SQL migrations are idempotent (use IF EXISTS, etc.)
  - Tenant isolation patterns are followed (tenantId in multi-tenant models)
  - Unique constraints include tenantId for data isolation
  - Critical tables are present

**Run Tests:**

```bash
npm test -- server/test/schema-consistency.test.ts
```

---

## Migration Architecture Explained

### Pattern A: Prisma Migrations (Version-based)

Used for table and column changes that Prisma can express.

**Format:**

```
server/prisma/migrations/
  └── 20251016140827_initial_schema/
      └── migration.sql
```

**When to Use:**

- Add/remove columns
- Add/remove tables
- Add unique constraints (@@unique)
- Add foreign keys (@relation)
- Modify column types

**Command:**

```bash
npm exec prisma migrate dev --name your_change_name
# Prisma auto-generates migration.sql from schema.prisma changes
# Applies it to database
# Regenerates Prisma Client
# Runs tests automatically
```

### Pattern B: Manual SQL (Sequential)

Used for PostgreSQL-specific features that Prisma can't generate.

**Format:**

```
server/prisma/migrations/
  ├── 01_add_webhook_events.sql
  ├── 02_add_performance_indexes.sql
  ├── 03_add_multi_tenancy.sql
  ├── 04_fix_multi_tenant_data_corruption.sql
  ├── 05_add_additional_performance_indexes.sql
  ├── 06_add_rls_policies.sql
  └── 07_add_scheduling_platform.sql
```

**When to Use:**

- Create or drop enums
- Add or remove indexes
- Add Row-Level Security (RLS) policies
- Create PostgreSQL extensions
- Complex data migrations requiring procedural SQL
- Advisory locks or other PostgreSQL-specific features

**How to Create:**

```bash
# 1. Find next number
ls server/prisma/migrations/ | grep '^[0-9]' | tail -1
# Output: 07_add_scheduling_platform.sql → Next is 08

# 2. Create idempotent SQL file
cat > server/prisma/migrations/08_name.sql << 'EOF'
-- Make migration idempotent (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MyEnum') THEN
    CREATE TYPE "MyEnum" AS ENUM ('VALUE1', 'VALUE2');
  END IF;
END $$;
EOF

# 3. Apply it
psql $DATABASE_URL < server/prisma/migrations/08_name.sql

# 4. Regenerate Prisma Client
npm exec prisma generate

# 5. Test
npm test
```

**Critical Rule:** All manual SQL MUST be idempotent - safe to run multiple times:

- Use `IF EXISTS`, `IF NOT EXISTS`
- Use `DO $$ ... END $$` blocks for conditionals
- Never use destructive operations without checks
- Add comments explaining what each step does

---

## Decision Tree: Which Pattern to Use?

```
┌─────────────────────────────────────────────┐
│ I need to change the database schema        │
└────────────────┬────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
Can I express in       PostgreSQL-specific
Prisma schema?        (enums, extensions,
(tables, cols)        indexes, RLS)
    │                         │
    YES                       YES
    │                         │
    ▼                         ▼
Use PATTERN A         Use PATTERN B
Prisma Migrate        Manual SQL
    │                         │
    └─────┬───────────────────┘
          │
    RUN and COMMIT
```

---

## How the Pre-Commit Hook Works

### Installation (Already Active)

The hook is already installed via:

```
.git/hooks/pre-commit → ../../.claude/hooks/validate-patterns.sh
```

When you run `git commit`, it automatically runs 6 validation checks:

1. Repository interfaces have tenantId
2. Commission calculations use Math.ceil
3. Cache keys include tenantId
4. Prisma queries scope by tenantId
5. Webhook handlers check for duplicates
6. **NEW: Schema changes have migrations** ✅

### What Happens When Hook Detects Schema Drift

```bash
$ git add server/prisma/schema.prisma
$ git commit -m "add new field"

📄 Check 6: schema.prisma changes must have corresponding migrations
❌ FAIL: schema.prisma changed but no migrations found
   Action: Create migration using one of:
   • npm exec prisma migrate dev --name your_change_name
   • Create manual SQL: server/prisma/migrations/NN_name.sql
   See: docs/solutions/SCHEMA_DRIFT_PREVENTION.md

❌ Validation failed!
   Errors: 1
   Warnings: 0
   Fix errors before committing.
```

### Bypassing the Hook (Only When Necessary)

```bash
# Absolute last resort - only if hook is broken
git commit --no-verify
```

---

## CI/CD Safety Gates

While not yet implemented in GitHub Actions, the comprehensive SCHEMA_DRIFT_PREVENTION.md document includes a complete `.github/workflows/schema-validation.yml` template that can be added to catch drift before it reaches main branch.

**What the proposed CI gates would do:**

- Check for schema changes without migrations
- Validate Prisma schema syntax
- Verify migrations can be applied
- Prevent destructive SQL commands
- Generate Prisma Client successfully
- Run TypeScript type checking

---

## Safe Database Operations for AI Agents

### SAFE (Read-only, can run anytime):

```bash
npm exec prisma migrate status      # Check migration state
npm exec prisma studio             # View data
npm exec prisma generate           # Regenerate client (no DB changes)
npm exec prisma validate           # Validate schema syntax
npm test                            # Run tests
npm run typecheck                   # TypeScript check
```

### UNSAFE (Should propose, not execute):

```bash
npm exec prisma migrate dev         # Creates and applies migration
npm exec prisma migrate deploy      # Applies migrations to production
npm exec prisma migrate reset       # DESTRUCTIVE - drops DB
npm exec prisma db push             # Modifies schema directly
npm exec prisma db seed             # Inserts data
```

### Rule for AI Agents:

> If you detect schema.prisma has changed but no migrations exist, **NEVER** run destructive commands. Instead, propose a migration to the user and ask them to run it. Always err on the side of caution.

---

## Testing Schema Consistency

### Run Consistency Tests

```bash
npm test -- server/test/schema-consistency.test.ts

# Output:
# ✓ schema-consistency.test.ts (9 tests)
#   ✓ Schema Files Exist
#     ✓ should have schema.prisma file
#     ✓ should have migrations directory
#   ✓ Schema Content
#     ✓ should not have empty schema.prisma
#     ✓ should have required models defined
#     ✓ should have required enums defined
#   ... (more tests)
```

### What Tests Verify

- Schema files exist and have content
- All critical models are defined
- All critical enums are defined
- Migration files exist and are not empty
- Manual SQL migrations are idempotent
- Tenant isolation patterns are followed
- Data isolation constraints are in place
- Critical tables exist

---

## Documentation Files Created/Modified

### New Files

1. **`/Users/mikeyoung/CODING/MAIS/docs/solutions/SCHEMA_DRIFT_PREVENTION.md`**
   - Comprehensive 600+ line prevention strategy guide
   - Decision trees, migration patterns, test cases
   - CI/CD recommendations, AI agent safety rules

2. **`/Users/mikeyoung/CODING/MAIS/server/test/schema-consistency.test.ts`**
   - 10+ test cases for schema validation
   - Tests for migration consistency
   - Tests for tenant isolation patterns
   - Idempotency verification

3. **`/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-SCHEMA-DRIFT-IMPLEMENTATION.md`** (this file)
   - Implementation status and checklist
   - How-to guides
   - Reference documentation

### Modified Files

1. **`/Users/mikeyoung/CODING/MAIS/.claude/hooks/validate-patterns.sh`**
   - Added Check 6: Schema Drift Detection
   - Detects schema.prisma without migrations
   - Provides actionable remediation guidance

2. **`/Users/mikeyoung/CODING/MAIS/CLAUDE.md`**
   - Updated "When Modifying Database Schema" section
   - Explained hybrid migration system
   - Added Pattern A vs Pattern B decision guide
   - Added critical rules and best practices

---

## Quick Start Guide

### For Developers

**When adding a column to a table:**

```bash
1. Edit server/prisma/schema.prisma
   model Package {
     ...
     newField String?  ← Add this
   }

2. npm exec prisma migrate dev --name add_new_field_to_package
   # Prisma auto-generates and applies migration

3. npm test
   # Verify everything works

4. git add server/prisma/
   git commit -m "feat: add newField to Package"
```

**When creating an enum:**

```bash
1. Edit server/prisma/schema.prisma
   enum PackageStatus {
     ACTIVE
     ARCHIVED
   }

2. Find next number: ls server/prisma/migrations/ | grep '^[0-9]' | tail -1
   # Let's say it shows 07_... → Next is 08

3. Create server/prisma/migrations/08_add_package_status_enum.sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackageStatus') THEN
       CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
     END IF;
   END $$;

4. psql $DATABASE_URL < server/prisma/migrations/08_add_package_status_enum.sql

5. npm exec prisma generate

6. npm test

7. git add server/prisma/
   git commit -m "feat: add PackageStatus enum"
```

### For AI Agents

**When you detect schema drift:**

```
🔍 Check: Is schema.prisma modified?
   git diff --name-only | grep schema.prisma
   → YES: Schema changed

🔍 Check: Are migrations staged?
   git diff --cached --name-only | grep migrations/
   → NO: No migrations found

❌ Schema Drift Detected

✅ Correct Action:
   Propose to user: "I found a schema change. Let me create a migration."
   Ask user to run: npm exec prisma migrate dev --name your_change_name
   Wait for user to apply it
   Then continue with other changes

❌ WRONG Action (Never Do):
   ❌ npm exec prisma migrate reset  (destructive!)
   ❌ npm exec prisma db push        (modifies production!)
   ❌ Make assumptions about schema state
```

---

## Monitoring and Validation

### Pre-Commit Hook Validation

Automatically runs on every `git commit` - catches drift immediately.

### Test Suite Validation

```bash
npm test -- server/test/schema-consistency.test.ts
```

### Manual Validation (Anytime)

```bash
# Check if migrations are applied
npm exec prisma migrate status

# Validate schema syntax
npm exec prisma validate

# Generate Prisma Client
npm exec prisma generate

# View database
npm exec prisma studio
```

---

## Prevention Measures Summary

| Layer         | Mechanism                              | Prevents                |
| ------------- | -------------------------------------- | ----------------------- |
| Pre-Commit    | Git hook validates migrations exist    | Schema drift commits    |
| Documentation | CLAUDE.md + SCHEMA_DRIFT_PREVENTION.md | Wrong migration pattern |
| Testing       | schema-consistency.test.ts             | Subtle schema issues    |
| Process       | Decision tree guidance                 | Analysis paralysis      |
| AI Safety     | Safe command rules                     | Destructive operations  |

---

## Next Steps

1. **Team Training** - Share SCHEMA_DRIFT_PREVENTION.md with team
2. **CI/CD Implementation** - Add GitHub Actions workflow from document
3. **Monitoring** - Watch pre-commit hook catches in next development cycle
4. **Review** - Quarterly audit of schema change patterns

---

## References

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/SCHEMA_DRIFT_PREVENTION.md` - Main prevention document
- `/Users/mikeyoung/CODING/MAIS/CLAUDE.md` - Updated database modification guidance
- `/Users/mikeyoung/CODING/MAIS/.claude/hooks/validate-patterns.sh` - Pre-commit validation
- `/Users/mikeyoung/CODING/MAIS/server/test/schema-consistency.test.ts` - Test suite
- `/Users/mikeyoung/CODING/MAIS/DECISIONS.md` - Database ADRs (ADR-006 on advisory locks)

---

**Last Updated:** 2025-11-28
**Status:** Fully Implemented and Tested
**Next Review:** 2025-12-28
