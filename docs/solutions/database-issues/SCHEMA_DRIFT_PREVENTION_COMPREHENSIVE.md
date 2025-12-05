---
title: 'Schema Drift Prevention: Pre-Commit, CI/CD, and Development Workflow'
category: database-issues
component: server/prisma
severity: P0
implementation_date: 2025-12-04
maintenance_owner: Mike Young
---

# Schema Drift Prevention: Multi-Layer Defense Strategy

## Executive Summary

Schema drift caused **189 test failures** by creating an inconsistency between `schema.prisma` and the actual database. This document outlines a **three-layer prevention system**:

1. **Pre-commit Checks** - Catch issues before they leave developer machines
2. **CI/CD Pipeline** - Enforce validation in GitHub Actions
3. **Development Workflow** - Best practices to prevent issues during feature work
4. **Test Configuration** - Ensure all test environments have complete configuration

The previous incident had three independent failures:
- Empty migration directory created without `migration.sql` inside
- Database missing `landingPageConfig` column that schema expected
- Test configurations missing `DATABASE_CONNECTION_LIMIT` (causing "undefined" in connection strings)

This strategy prevents all three from recurring.

---

## Layer 1: Pre-Commit Checks

### 1.1 Schema Integrity Validation Hook

**File:** `.claude/hooks/validate-schema.sh` (Create New)

```bash
#!/bin/bash
# Pre-commit hook: Validate schema.prisma integrity and consistency

set -e

SCHEMA_FILE="server/prisma/schema.prisma"
MIGRATIONS_DIR="server/prisma/migrations"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

schema_checks_passed=true

echo "🔍 Schema Integrity Check..."
echo ""

# Check 1: Schema file exists and is not empty
if [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}✗ FAIL${NC}: schema.prisma file not found at $SCHEMA_FILE"
  schema_checks_passed=false
elif [ ! -s "$SCHEMA_FILE" ]; then
  echo -e "${RED}✗ FAIL${NC}: schema.prisma file is empty"
  schema_checks_passed=false
else
  echo -e "${GREEN}✓ PASS${NC}: schema.prisma exists and has content"
fi

# Check 2: Required models are defined
REQUIRED_MODELS=("Tenant" "User" "Package" "Booking" "Customer" "Venue" "Service" "AvailabilityRule")
missing_models=()

for model in "${REQUIRED_MODELS[@]}"; do
  if ! grep -q "^model $model " "$SCHEMA_FILE"; then
    missing_models+=("$model")
  fi
done

if [ ${#missing_models[@]} -gt 0 ]; then
  echo -e "${RED}✗ FAIL${NC}: Missing required models: ${missing_models[*]}"
  schema_checks_passed=false
else
  echo -e "${GREEN}✓ PASS${NC}: All required models present"
fi

# Check 3: Tenant isolation patterns (tenantId in multi-tenant models)
MULTI_TENANT_MODELS=("Package" "Booking" "Customer" "Venue" "Service" "AvailabilityRule" "Payment")
isolation_failures=()

for model in "${MULTI_TENANT_MODELS[@]}"; do
  # Extract the model block
  model_block=$(sed -n "/^model $model /,/^}/p" "$SCHEMA_FILE")

  if [ -z "$model_block" ]; then
    continue  # Model might be commented out or not exist
  fi

  # Check if model has tenantId field
  if ! echo "$model_block" | grep -q "tenantId.*String"; then
    isolation_failures+=("$model")
  fi
done

if [ ${#isolation_failures[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠ WARNING${NC}: Models missing tenantId: ${isolation_failures[*]}"
  echo "    Multi-tenant isolation may be compromised for these models"
fi

# Check 4: Unique constraints include tenantId for isolation
echo ""
echo "Checking unique constraint patterns..."

if grep -q "@@unique.*tenantId" "$SCHEMA_FILE"; then
  echo -e "${GREEN}✓ PASS${NC}: Found tenantId in unique constraints"
else
  echo -e "${YELLOW}⚠ WARNING${NC}: No tenantId found in unique constraints"
  echo "    This may be OK if using global unique fields (like User.email)"
fi

# Check 5: Migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}✗ FAIL${NC}: Migrations directory not found at $MIGRATIONS_DIR"
  schema_checks_passed=false
else
  echo -e "${GREEN}✓ PASS${NC}: Migrations directory exists"
fi

# Check 6: No empty migration directories
echo ""
echo "Checking for empty migration directories..."

empty_migrations=()
for migration_dir in "$MIGRATIONS_DIR"/*_*/; do
  if [ -d "$migration_dir" ]; then
    # Count files in the directory
    file_count=$(find "$migration_dir" -type f | wc -l)
    if [ "$file_count" -eq 0 ]; then
      empty_migrations+=("$(basename "$migration_dir")")
    fi
  fi
done

if [ ${#empty_migrations[@]} -gt 0 ]; then
  echo -e "${RED}✗ FAIL${NC}: Found empty migration directories:"
  for migration in "${empty_migrations[@]}"; do
    echo "    - $migration/"
  done
  echo ""
  echo "Remediation:"
  echo "  1. Check if migration.sql exists but is empty"
  echo "  2. If empty and invalid: rm -rf $MIGRATIONS_DIR/<migration_name>"
  echo "  3. If valid: Populate migration.sql with SQL"
  echo "  4. Re-run: npm exec prisma migrate dev"
  schema_checks_passed=false
else
  echo -e "${GREEN}✓ PASS${NC}: No empty migration directories"
fi

# Check 7: Migration files are not empty
echo ""
echo "Checking migration file integrity..."

empty_migrations=()
for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration_file" ] && [ ! -s "$migration_file" ]; then
    empty_migrations+=("$(basename "$migration_file")")
  fi
done

for migration_dir in "$MIGRATIONS_DIR"/*_*/migration.sql; do
  if [ -f "$migration_dir" ] && [ ! -s "$migration_dir" ]; then
    empty_migrations+=("$(basename "$(dirname "$migration_dir")")")
  fi
done

if [ ${#empty_migrations[@]} -gt 0 ]; then
  echo -e "${RED}✗ FAIL${NC}: Found empty migration files:"
  for migration in "${empty_migrations[@]}"; do
    echo "    - $migration"
  done
  schema_checks_passed=false
else
  echo -e "${GREEN}✓ PASS${NC}: All migration files have content"
fi

# Check 8: Detect schema.prisma changes without migrations
echo ""
echo "Detecting schema changes without migrations..."

if git diff --cached --name-only | grep -q "server/prisma/schema.prisma"; then
  schema_changed=true
  echo -e "${YELLOW}ℹ${NC}: schema.prisma has been modified"

  # Check if any migration files are also staged
  if git diff --cached --name-only | grep -q "server/prisma/migrations"; then
    echo -e "${GREEN}✓ PASS${NC}: Migration changes detected alongside schema changes"
  else
    echo -e "${YELLOW}⚠ WARNING${NC}: schema.prisma changed but no migration files staged"
    echo ""
    echo "Common fixes:"
    echo "  1. If adding columns/tables: npm exec prisma migrate dev --name descriptive_name"
    echo "  2. If adding enums/indexes: Create manual SQL file in server/prisma/migrations/"
    echo "  3. After migration: git add server/prisma/migrations/"
    echo ""
    echo "If this is intentional (e.g., reverting), add: --no-verify to skip this check"
  fi
fi

# Final result
echo ""
echo "═══════════════════════════════════════════════════════════════════"

if [ "$schema_checks_passed" = true ]; then
  echo -e "${GREEN}✅ Schema integrity check PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ Schema integrity check FAILED${NC}"
  echo ""
  echo "Fix the issues above before committing."
  exit 1
fi
```

### 1.2 Installation in Git Hooks

**File:** `.git/hooks/pre-commit` (Update existing)

```bash
#!/bin/bash
# Git pre-commit hook - runs validation checks before commit

set -e

# Store exit code from previous checks
exit_code=0

# Run schema validation
if [ -x "./.claude/hooks/validate-schema.sh" ]; then
  ./.claude/hooks/validate-schema.sh || exit_code=$?
fi

if [ $exit_code -ne 0 ]; then
  echo ""
  echo "❌ Pre-commit checks failed. Commit blocked."
  echo ""
  echo "To skip this check (not recommended): git commit --no-verify"
  exit 1
fi
```

### 1.3 Hook Installation Script

**File:** `scripts/install-hooks.sh` (Create New)

```bash
#!/bin/bash
# Install pre-commit hooks

HOOKS_DIR=".claude/hooks"
GIT_HOOKS_DIR=".git/hooks"

echo "📦 Installing pre-commit hooks..."

# Make hooks directory executable
chmod +x "$HOOKS_DIR"/*.sh

# Copy hook files
mkdir -p "$GIT_HOOKS_DIR"

# Create/update pre-commit hook
cat > "$GIT_HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
set -e

# Run schema validation
if [ -x "./.claude/hooks/validate-schema.sh" ]; then
  ./.claude/hooks/validate-schema.sh || exit_code=$?
fi

if [ $exit_code -ne 0 ]; then
  echo ""
  echo "❌ Pre-commit checks failed. Commit blocked."
  exit 1
fi
EOF

chmod +x "$GIT_HOOKS_DIR/pre-commit"

echo "✅ Pre-commit hooks installed"
echo ""
echo "Hooks installed:"
echo "  - $GIT_HOOKS_DIR/pre-commit (schema validation)"
echo ""
echo "To manually install: bash scripts/install-hooks.sh"
```

---

## Layer 2: CI/CD Pipeline Checks

### 2.1 Schema Validation Job (main-pipeline.yml)

Add to `.github/workflows/main-pipeline.yml`:

```yaml
  # Schema Drift Detection Job
  schema-validation:
    name: Schema Consistency Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    if: github.event_name == 'pull_request' || contains(github.ref, 'refs/heads/main')

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate schema.prisma syntax
        run: |
          cd server
          npx prisma validate --schema=./prisma/schema.prisma

      - name: Check for empty migrations
        run: |
          cd server

          echo "🔍 Checking for empty migration directories..."

          # Count empty migration directories
          empty_count=0
          while IFS= read -r migration_dir; do
            if [ -z "$(find "$migration_dir" -type f)" ]; then
              echo "❌ Empty migration directory: $migration_dir"
              ((empty_count++))
            fi
          done < <(find prisma/migrations -maxdepth 1 -type d ! -name migrations)

          if [ $empty_count -gt 0 ]; then
            echo "FAILED: $empty_count empty migration directories found"
            exit 1
          fi

          echo "✅ No empty migration directories"

      - name: Check for empty migration files
        run: |
          cd server

          echo "🔍 Checking for empty migration SQL files..."

          # Check .sql files in root migrations directory
          for file in prisma/migrations/*.sql; do
            if [ -f "$file" ] && [ ! -s "$file" ]; then
              echo "❌ Empty SQL file: $file"
              exit 1
            fi
          done

          # Check migration.sql in timestamped directories
          for file in prisma/migrations/*/migration.sql; do
            if [ -f "$file" ] && [ ! -s "$file" ]; then
              echo "❌ Empty migration.sql: $file"
              exit 1
            fi
          done

          echo "✅ All migration files have content"

      - name: Verify required database models
        run: |
          cd server

          echo "🔍 Verifying required database models..."

          schema_file="prisma/schema.prisma"
          required_models=("Tenant" "User" "Package" "Booking" "Customer" "Service")

          for model in "${required_models[@]}"; do
            if ! grep -q "^model $model " "$schema_file"; then
              echo "❌ Missing required model: $model"
              exit 1
            fi
          done

          echo "✅ All required models present"

      - name: Verify tenant isolation patterns
        run: |
          cd server

          echo "🔍 Verifying tenant isolation patterns..."

          schema_file="prisma/schema.prisma"
          multi_tenant_models=("Package" "Booking" "Customer" "Venue" "Service")

          for model in "${multi_tenant_models[@]}"; do
            if grep -q "^model $model " "$schema_file"; then
              model_block=$(sed -n "/^model $model /,/^}/p" "$schema_file")

              if ! echo "$model_block" | grep -q "tenantId.*String"; then
                echo "⚠️ WARNING: $model missing tenantId field"
                echo "   This may compromise multi-tenant isolation"
              fi
            fi
          done

          echo "✅ Tenant isolation check complete"

      - name: Compare schema and migrations
        run: |
          cd server

          echo "🔍 Checking for schema drift between migrations and schema.prisma..."

          # Get count of migration files
          migration_count=$(find prisma/migrations -type f \( -name "*.sql" -o -name "migration.sql" \) | wc -l)
          echo "Found $migration_count migration files"

          # Basic sanity check: schema file should be recent if migrations were recent
          schema_mtime=$(stat -f '%m' prisma/schema.prisma 2>/dev/null || stat -c '%Y' prisma/schema.prisma 2>/dev/null)
          echo "Schema last modified: $(date -r $schema_mtime 2>/dev/null || date)"

          if [ $migration_count -eq 0 ]; then
            echo "⚠️ WARNING: No migration files found. First deployment?"
          fi

          echo "✅ Schema drift check complete"

      - name: Comment PR on schema validation failure
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ **Schema consistency check failed**\n\n' +
                    'Please fix schema or migration issues:\n' +
                    '```bash\n' +
                    '# Check for problems\n' +
                    'cd server && npx prisma validate\n' +
                    '\n' +
                    '# Create missing migration if needed\n' +
                    'npm exec prisma migrate dev --name descriptive_name\n' +
                    '```\n\n' +
                    'See `docs/solutions/database-issues/SCHEMA_DRIFT_PREVENTION_COMPREHENSIVE.md`'
            })
```

### 2.2 Migration Testing Job

Add to `.github/workflows/main-pipeline.yml`:

```yaml
  # Migration Dry-Run Testing
  migration-dry-run:
    name: Migration Dry-Run Test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    if: github.event_name == 'pull_request'

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_migration_dryrun
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Dry-run migrations on clean database
        run: |
          cd server
          npx prisma migrate deploy --schema=./prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_migration_dryrun
          DIRECT_URL: postgresql://postgres:postgres@localhost:5432/mais_migration_dryrun

      - name: Generate Prisma Client
        run: npm run --workspace=server prisma:generate

      - name: Verify schema matches database
        run: |
          cd server

          # Introspect database to check for drift
          npx prisma db pull --schema=./prisma/schema.prisma --force 2>&1 | head -50

          # Check if schema changed (would indicate drift)
          if git diff --quiet prisma/schema.prisma; then
            echo "✅ Schema matches database"
          else
            echo "⚠️ Warning: Schema changes detected after introspection"
            git diff prisma/schema.prisma | head -20
          fi

      - name: Report migration issues
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ **Migration dry-run failed**\n\n' +
                    'One or more migrations failed on a clean database.\n\n' +
                    'This indicates:\n' +
                    '1. Migration SQL has syntax errors\n' +
                    '2. Migrations depend on missing data\n' +
                    '3. Schema drift in migrations directory\n\n' +
                    'Run locally to debug:\n' +
                    '```bash\n' +
                    'cd server && npx prisma migrate deploy\n' +
                    '```'
            })
```

### 2.3 Environment Configuration Validation

Add validation to `main-pipeline.yml` for environment configs:

```yaml
  # Environment Configuration Check
  env-config-validation:
    name: Environment Configuration Check
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Validate .env.example consistency
        run: |
          echo "🔍 Checking environment variable consistency..."

          # Required database connection variables
          required_env_vars=(
            "DATABASE_URL"
            "DIRECT_URL"
            "DATABASE_CONNECTION_LIMIT"
            "JWT_SECRET"
            "TENANT_SECRETS_ENCRYPTION_KEY"
          )

          missing_vars=()
          for var in "${required_env_vars[@]}"; do
            if ! grep -q "$var" server/.env.example; then
              missing_vars+=("$var")
            fi
          done

          if [ ${#missing_vars[@]} -gt 0 ]; then
            echo "❌ Missing environment variables in .env.example:"
            printf '  - %s\n' "${missing_vars[@]}"
            exit 1
          fi

          echo "✅ All required environment variables in .env.example"

      - name: Verify DATABASE_CONNECTION_LIMIT is documented
        run: |
          echo "🔍 Checking DATABASE_CONNECTION_LIMIT documentation..."

          files_to_check=(
            "server/.env.example"
            "server/src/config/env.schema.ts"
            "ENV_VARIABLES.md"
          )

          for file in "${files_to_check[@]}"; do
            if [ ! -f "$file" ]; then
              continue
            fi

            if ! grep -q "DATABASE_CONNECTION_LIMIT" "$file"; then
              echo "⚠️ WARNING: DATABASE_CONNECTION_LIMIT not found in $file"
            fi
          done

          echo "✅ DATABASE_CONNECTION_LIMIT documentation check complete"
```

---

## Layer 3: Development Workflow Best Practices

### 3.1 Safe Migration Creation Checklist

**File:** `docs/guides/SAFE_MIGRATION_WORKFLOW.md` (Create New)

```markdown
# Safe Schema Migration Workflow

## Before You Start

1. **Understand your change type:**
   - Adding column/table? → Use Pattern A (Prisma migrations)
   - Adding enum/index/extension? → Use Pattern B (Manual SQL)

## Pattern A: Prisma-Managed Migrations

### Step 1: Create Migration from Schema Change

```bash
cd server

# Edit schema.prisma first
# Then run:
npm exec prisma migrate dev --name add_my_new_column

# This will:
# 1. Create timestamped migration directory
# 2. Generate migration.sql with your changes
# 3. Apply migration to local database
# 4. Regenerate Prisma Client
```

### Step 2: Verify Migration

```bash
# Check that migration was created:
ls -la prisma/migrations/

# Should see a directory like:
# 20251204_add_my_new_column/migration.sql

# Verify it's not empty:
cat prisma/migrations/*/migration.sql | wc -l
# Should show > 10 lines, not 0
```

### Step 3: Test Migration

```bash
# Run integration tests to verify
npm run test:integration

# If tests pass, your migration is safe
```

### Step 4: Commit Changes

```bash
git add server/prisma/schema.prisma
git add server/prisma/migrations/
git commit -m "feat(schema): add my_new_column to Package table

- Added column with type String
- Generated migration 20251204_add_my_new_column
- All integration tests pass"
```

## Pattern B: Manual SQL Migrations

### For Enums, Indexes, RLS Policies, Extensions

### Step 1: Edit schema.prisma (Optional)

```bash
# If adding enum, define it in schema.prisma
# If adding index, add @index directive
# (Other manual changes don't need schema.prisma update)
```

### Step 2: Create SQL Migration File

```bash
cd server/prisma/migrations

# Get next number:
ls | grep "^[0-9]" | tail -1
# Output: 09_add_booking_status_enum_values.sql

# Create next one:
touch 10_add_performance_indexes.sql
```

### Step 3: Write Idempotent SQL

```sql
-- Critical: Use IF EXISTS / IF NOT EXISTS to make migration idempotent
-- This allows it to be run multiple times safely

-- Create enum safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MyEnum') THEN
    CREATE TYPE "MyEnum" AS ENUM ('VALUE1', 'VALUE2');
  END IF;
END $$;

-- Create index safely
CREATE INDEX IF NOT EXISTS idx_booking_reminder_due
  ON "Booking" ("tenantId", "reminderDueDate")
  WHERE "reminderSentAt" IS NULL AND "status" = 'CONFIRMED';

-- Add constraint safely
ALTER TABLE "Booking"
  ADD CONSTRAINT IF NOT EXISTS unique_booking_timeslot
  UNIQUE ("tenantId", "serviceId", "startTime")
  WHERE "startTime" IS NOT NULL;
```

### Step 4: Apply Manually

```bash
cd server

# Test on local database
psql $DATABASE_URL < prisma/migrations/10_add_performance_indexes.sql

# Verify it worked
npm exec prisma generate

# Run tests
npm run test:integration
```

### Step 5: Update schema.prisma if needed

```bash
# If you created an enum, add it to schema.prisma:
enum MyEnum {
  VALUE1
  VALUE2
}

# If you added an index, add the directive:
@@index([tenantId, reminderDueDate])
```

### Step 6: Commit

```bash
git add server/prisma/schema.prisma  # Only if updated
git add server/prisma/migrations/10_add_performance_indexes.sql
git commit -m "chore(schema): add performance indexes for reminder queries

- Created index on (tenantId, reminderDueDate) for reminder queries
- Idempotent SQL handles existing installations
- Manual migration approach for PostgreSQL-specific syntax"
```

## Critical Don'ts

### ❌ Never Do This

```bash
# DON'T edit migration files directly after creation
# Risk: Next migration will be based on broken state

# DON'T create empty migrations
# Risk: CI will catch them, but better to prevent

# DON'T change schema.prisma without migrations
# Risk: Drift detection will block your commit

# DON'T use prisma migrate reset in production
# Risk: Data loss from all tenants

# DON'T skip the pre-commit hooks
# Use --no-verify only for emergencies
```

## Troubleshooting

### Empty Migration Created

```bash
# If prisma migrate dev created an empty migration:

# Option 1: Delete it (if nothing was staged)
rm -rf server/prisma/migrations/20251204_my_empty_migration

# Option 2: Check what's in it
cat server/prisma/migrations/20251204_my_empty_migration/migration.sql

# Option 3: Revert schema.prisma and try again
git checkout server/prisma/schema.prisma
npm exec prisma migrate dev --name try_again
```

### Migration Fails to Apply

```bash
# Check error:
npm exec prisma migrate deploy

# Common issues:
# 1. Foreign key constraint violation
#    → Check if referenced table/row exists
# 2. Column already exists
#    → Migration is idempotent, check existing database
# 3. Type conflict
#    → Check enum definitions and type compatibility

# For complex issues:
# 1. Check migration SQL manually
# 2. Test on local database
# 3. Ask in #database channel with error output
```

### Schema Drift Detected

```bash
# If CI says "schema drift detected":

# Option 1: Sync production to your schema
cd server && npx prisma db pull

# Option 2: Check what changed
git diff server/prisma/schema.prisma

# Option 3: Create migration for drift
# Determine what changed, then follow Pattern A or B above
```

## Testing Your Migration

```bash
# Run all integration tests (requires database)
npm run test:integration

# Run specific migration test
npm test -- server/test/migrations.test.ts

# Test schema consistency
npm test -- server/test/schema-consistency.test.ts

# If all pass, migration is safe
```

## Checklist Before Committing

- [ ] Migration created (Pattern A or B)
- [ ] Migration file is not empty (> 0 bytes)
- [ ] Migration is idempotent (uses IF EXISTS/IF NOT EXISTS)
- [ ] schema.prisma updated to match migration (if Pattern A)
- [ ] `npm exec prisma generate` run
- [ ] Integration tests pass
- [ ] No schema.prisma changes without migrations
- [ ] Pre-commit hook passes
- [ ] Commit message mentions migration

See also: `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` for detailed patterns and ADRs.
```

### 3.2 Development Setup Validation

**File:** `scripts/doctor.ts` (Update existing)

Add schema validation checks:

```typescript
// In doctor.ts, add new section:

section('Database Configuration', async () => {
  const checks: Check[] = [];

  // Check 1: DATABASE_CONNECTION_LIMIT is set
  checks.push({
    name: 'DATABASE_CONNECTION_LIMIT',
    run: async () => {
      const limit = process.env.DATABASE_CONNECTION_LIMIT;
      if (!limit) {
        return {
          status: 'error',
          message: 'DATABASE_CONNECTION_LIMIT not set',
          hint: 'Add DATABASE_CONNECTION_LIMIT=5 to .env for local development',
        };
      }
      try {
        const parsed = parseInt(limit, 10);
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Must be a positive integer');
        }
        return {
          status: 'success',
          message: `DATABASE_CONNECTION_LIMIT=${limit} is valid`,
        };
      } catch (e) {
        return {
          status: 'error',
          message: `DATABASE_CONNECTION_LIMIT="${limit}" is invalid: ${e.message}`,
          hint: 'Must be a positive integer (e.g., 5 for local, 1 for serverless)',
        };
      }
    },
  });

  // Check 2: Schema file exists
  checks.push({
    name: 'Prisma schema.prisma file',
    run: async () => {
      const schemaPath = path.join(process.cwd(), 'server/prisma/schema.prisma');
      if (!fs.existsSync(schemaPath)) {
        return {
          status: 'error',
          message: 'schema.prisma not found',
          hint: `Expected at: ${schemaPath}`,
        };
      }

      const content = fs.readFileSync(schemaPath, 'utf-8');
      if (content.length < 100) {
        return {
          status: 'error',
          message: 'schema.prisma is suspiciously small',
          hint: 'Check if file is corrupted or empty',
        };
      }

      return {
        status: 'success',
        message: `schema.prisma found (${content.length} bytes)`,
      };
    },
  });

  // Check 3: Migrations directory
  checks.push({
    name: 'Prisma migrations directory',
    run: async () => {
      const migrationsPath = path.join(process.cwd(), 'server/prisma/migrations');
      if (!fs.existsSync(migrationsPath)) {
        return {
          status: 'error',
          message: 'migrations directory not found',
          hint: `Run: npm exec prisma migrate dev --name init`,
        };
      }

      // Count migration files
      const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql') || f.endsWith('.toml'));
      if (files.length === 0) {
        return {
          status: 'warning',
          message: 'No migrations found (this is OK for first deployment)',
          hint: 'Run: npm exec prisma migrate dev --name init',
        };
      }

      return {
        status: 'success',
        message: `${files.length} migration files found`,
      };
    },
  });

  // Check 4: No empty migrations
  checks.push({
    name: 'Migration file integrity',
    run: async () => {
      const migrationsPath = path.join(process.cwd(), 'server/prisma/migrations');
      if (!fs.existsSync(migrationsPath)) {
        return { status: 'skipped', message: 'migrations directory not found' };
      }

      const emptyFiles: string[] = [];

      // Check .sql files
      fs.readdirSync(migrationsPath).forEach(file => {
        if (file.endsWith('.sql')) {
          const filepath = path.join(migrationsPath, file);
          const stats = fs.statSync(filepath);
          if (stats.size === 0) {
            emptyFiles.push(file);
          }
        }
      });

      // Check migration.sql in directories
      fs.readdirSync(migrationsPath).forEach(dir => {
        const migrationPath = path.join(migrationsPath, dir, 'migration.sql');
        if (fs.existsSync(migrationPath)) {
          const stats = fs.statSync(migrationPath);
          if (stats.size === 0) {
            emptyFiles.push(`${dir}/migration.sql`);
          }
        }
      });

      if (emptyFiles.length > 0) {
        return {
          status: 'error',
          message: `Found ${emptyFiles.length} empty migration file(s): ${emptyFiles.join(', ')}`,
          hint: 'Delete empty migrations or populate them with SQL',
        };
      }

      return {
        status: 'success',
        message: 'All migration files have content',
      };
    },
  });

  // Run all checks
  for (const check of checks) {
    const result = await check.run();
    logCheck(check.name, result);
  }
});
```

---

## Layer 4: Test Configuration Validation

### 4.1 Environment Variable Validation for Tests

**File:** `server/src/config/env.schema.ts` (Update existing)

```typescript
// Add validation that DATABASE_CONNECTION_LIMIT doesn't end up as "undefined" in URLs

export function validateEnv(): Env {
  logger.info('🔍 Validating environment variables...');

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    logger.error({ errors: result.error.format() }, 'Environment validation failed');
    process.exit(1);
  }

  const env = result.data;

  // NEW: Validate DATABASE_CONNECTION_LIMIT is properly configured
  if (env.DATABASE_URL) {
    const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT;
    if (connectionLimit === undefined || connectionLimit === '' || connectionLimit === 'undefined') {
      logger.warn(
        'DATABASE_CONNECTION_LIMIT not set. Using default: 1',
      );
      // For serverless environments, this is OK. Just warn the user.
    } else {
      try {
        const parsed = parseInt(connectionLimit, 10);
        if (isNaN(parsed) || parsed <= 0) {
          logger.error('DATABASE_CONNECTION_LIMIT must be a positive integer');
          process.exit(1);
        }
      } catch (e) {
        logger.error(`Invalid DATABASE_CONNECTION_LIMIT: ${connectionLimit}`);
        process.exit(1);
      }
    }
  }

  // Validate DATABASE_URL doesn't have literal "undefined"
  if (env.DATABASE_URL?.includes('undefined')) {
    logger.error('DATABASE_URL contains literal "undefined" - configuration error');
    logger.error('Check .env file and environment variable setup');
    process.exit(1);
  }

  if (env.DIRECT_URL?.includes('undefined')) {
    logger.error('DIRECT_URL contains literal "undefined" - configuration error');
    logger.error('Check .env file and environment variable setup');
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
  return env;
}
```

### 4.2 Test Configuration File Template

**File:** `server/.env.test` (Create New)

```bash
# Test Environment Configuration
# Used by: npm run test:integration
# Never commit with real values

NODE_ENV=test
ADAPTERS_PRESET=mock

# Database - uses test-specific database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20
DATABASE_CONNECTION_LIMIT=10

# Security
JWT_SECRET=test-jwt-secret-for-tests-only-not-for-production
TENANT_SECRETS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Optional services (should fail gracefully in test mode)
STRIPE_SECRET_KEY=sk_test_dummy_key_for_tests_only
STRIPE_WEBHOOK_SECRET=whsec_test_dummy_webhook_secret_for_tests_only
POSTMARK_SERVER_TOKEN=

# URLs
CORS_ORIGIN=http://localhost:5173
API_PORT=3001

# Optional
SENTRY_DSN=
LOG_LEVEL=error
```

### 4.3 Test Initialization Check

**File:** `server/test/helpers/integration-setup.ts` (Update existing)

```typescript
// Add validation before running tests

export async function setupTestDatabase() {
  // Validate environment before running any tests
  validateTestEnvironment();

  // ... rest of setup
}

function validateTestEnvironment() {
  const errors: string[] = [];

  // Check DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set');
  } else if (process.env.DATABASE_URL.includes('undefined')) {
    errors.push('DATABASE_URL contains literal "undefined" - check .env setup');
  }

  // Check DATABASE_CONNECTION_LIMIT
  if (!process.env.DATABASE_CONNECTION_LIMIT) {
    logger.warn('DATABASE_CONNECTION_LIMIT not set, using default');
  } else if (process.env.DATABASE_CONNECTION_LIMIT === 'undefined') {
    errors.push('DATABASE_CONNECTION_LIMIT is literal "undefined" - check .env setup');
  }

  // Check JWT_SECRET
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is not set');
  }

  // Check TENANT_SECRETS_ENCRYPTION_KEY
  if (!process.env.TENANT_SECRETS_ENCRYPTION_KEY) {
    errors.push('TENANT_SECRETS_ENCRYPTION_KEY is not set');
  }

  if (errors.length > 0) {
    logger.error(
      {
        errors,
        env_vars: {
          DATABASE_URL: process.env.DATABASE_URL ? '***set***' : 'NOT_SET',
          DATABASE_CONNECTION_LIMIT: process.env.DATABASE_CONNECTION_LIMIT || 'NOT_SET',
          JWT_SECRET: process.env.JWT_SECRET ? '***set***' : 'NOT_SET',
        },
      },
      'Test environment validation failed',
    );
    throw new Error(`Test environment invalid: ${errors.join(', ')}`);
  }

  logger.info('✅ Test environment validated');
}
```

---

## Summary: Prevention Layers

| Layer | Mechanism | Catches | Owner |
|-------|-----------|---------|-------|
| **Pre-Commit** | `.claude/hooks/validate-schema.sh` | Empty migrations, missing models, isolation patterns | Developer |
| **CI/CD** | `schema-validation` job | Syntax errors, broken migrations, drift | CI System |
| **CI/CD** | `migration-dry-run` job | Migrations that fail on clean database | CI System |
| **CI/CD** | `env-config-validation` job | Missing env vars, incomplete config | CI System |
| **Development** | `SAFE_MIGRATION_WORKFLOW.md` | Wrong migration pattern, incomplete commits | Developer |
| **Test Setup** | Environment validation | Undefined connection strings, missing secrets | Test Runner |

## Incident Prevention Matrix

| Root Cause | Prevention Layer | How It's Caught |
|------------|-----------------|-----------------|
| Empty migration directory | Pre-commit + CI | Hook checks `find migrationdir -type f` count |
| Missing landingPageConfig column | Pre-commit | Hook verifies required models exist |
| DATABASE_CONNECTION_LIMIT undefined | Test setup + env validation | URL checked for literal "undefined" |
| Empty migration.sql file | Pre-commit + CI | `-s` test checks file size > 0 |
| Schema without migrations | Pre-commit | Detects staged schema changes without migration files |
| Test environment misconfiguration | Test initialization | validateTestEnvironment() called before any tests |

## Implementation Checklist

- [ ] Create `.claude/hooks/validate-schema.sh` with all checks
- [ ] Create `scripts/install-hooks.sh` and run during setup
- [ ] Update `.github/workflows/main-pipeline.yml` with schema validation job
- [ ] Update `.github/workflows/main-pipeline.yml` with migration dry-run job
- [ ] Add env config validation to main pipeline
- [ ] Create `docs/guides/SAFE_MIGRATION_WORKFLOW.md` guide
- [ ] Update `scripts/doctor.ts` with schema checks
- [ ] Create `server/.env.test` template
- [ ] Update `server/test/helpers/integration-setup.ts` with validation
- [ ] Update `server/src/config/env.schema.ts` with connection limit validation
- [ ] Test all checks locally before pushing
- [ ] Document in team wiki/handbook

## Quick Reference: What to Do When...

**...you modify schema.prisma:**
1. `npm exec prisma migrate dev --name descriptive_name`
2. Verify `.sql` file was created and not empty
3. Run integration tests: `npm run test:integration`
4. Commit both `schema.prisma` and migrations folder

**...you need to add an enum or index:**
1. Create manual SQL file: `server/prisma/migrations/NN_name.sql`
2. Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
3. Test locally: `psql $DATABASE_URL < migrations/NN_name.sql`
4. Run tests to verify
5. Update `schema.prisma` to match (for generation)

**...integration tests fail with "column X does not exist":**
1. Check if you edited schema without running `npm exec prisma migrate dev`
2. Check if migration file is empty
3. Revert schema changes and try again
4. Or run manual migration from migrations/ directory

**...pre-commit hook blocks your commit:**
1. Read the error message carefully
2. Run the suggested fix command
3. Re-try commit
4. Only use `--no-verify` in emergencies

---

## Maintenance

This prevention system requires periodic review:

- **Monthly:** Review recent commits for schema patterns
- **Quarterly:** Update hooks based on new failure modes
- **After incidents:** Add checks to prevent recurrence
- **With Prisma upgrades:** Verify migration system still works

Owner: @Mike Young
Last updated: 2025-12-04
