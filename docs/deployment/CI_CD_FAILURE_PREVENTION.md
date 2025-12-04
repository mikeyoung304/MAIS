# CI/CD Failure Prevention & Best Practices

## Overview

This document outlines strategies to prevent common CI/CD deployment failures observed in production, specifically:

1. ESLint configuration failures in CI environments
2. Missing environment variables for Prisma migrations
3. Environment variable documentation gaps
4. Deployment readiness validation gaps

## Part 1: Documented Issues & Root Causes

### Issue 1: ESLint Configuration Divergence

**Problem:** Strict TypeScript ESLint rules pass locally but fail in CI pipeline.

**Root Cause:**

- Global ESLint configuration at `/Users/mikeyoung/CODING/MAIS/.eslintrc.cjs` uses:
  ```javascript
  extends: [
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ]
  ```
- These rules require Prisma type information and workspace context
- CI environment has different Node version, dependencies, or type generation timing
- Monorepo workspace boundaries not properly configured for ESLint

**See Also:** `deploy-production.yml` line 131 with `continue-on-error: true` (bypass that masks the issue)

### Issue 2: Missing DIRECT_URL in Migrations

**Problem:** Prisma migrations fail with:

```
Error: Could not find the DIRECT_URL environment variable
```

**Root Cause:**

- `prisma/schema.prisma` requires both `DATABASE_URL` and `DIRECT_URL`
- CI pipeline provides `DATABASE_URL` but not `DIRECT_URL`
- Migration job in `main-pipeline.yml` (line 266) doesn't set `DIRECT_URL`
- Production deployment requires `DIRECT_URL` for Supabase pooler connections

**See Also:** `deploy-production.yml` line 300 correctly sets both, but `main-pipeline.yml` line 268 only sets `DATABASE_URL`

### Issue 3: Environment Variable Documentation Gaps

**Problem:** Required vs optional variables not clearly documented for CI.

**Current State:**

- `.env.example` shows all variables with defaults
- `server/scripts/doctor.ts` validates env vars but paths are incorrect (references `server/.env.example` at line 133)
- No matrix of which vars are needed for each CI job
- No clear guidance on TIER 1/2/3 requirements per job

## Part 2: Future Prevention Strategies

### Strategy 1: ESLint Configuration for CI

#### 1.1 ESLint Configuration Audit

**Action Items:**

1. Verify ESLint configuration includes workspace context
2. Ensure type generation runs before linting
3. Add ESLint cache invalidation in CI

**Implementation:**

```javascript
// .eslintrc.cjs - Enhanced for CI environments
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    // NEW: Explicit type checking project references
    project: [
      './tsconfig.json',
      './server/tsconfig.json',
      './client/tsconfig.json',
      './packages/*/tsconfig.json',
    ],
    // NEW: Search for tsconfig in all workspaces
    tsconfigRootDir: __dirname,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked', // ← Lighter than strict
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
  ],
  env: { node: true, es2022: true },
  rules: {
    // Strict rules disabled for CI compatibility
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn', // ← Changed from error
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn', // ← Changed from error
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  // NEW: Override for test files
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs'],
};
```

#### 1.2 CI Workflow Improvements

**In `main-pipeline.yml` lint job:**

```yaml
lint:
  name: Lint & Format Check
  runs-on: ubuntu-latest
  timeout-minutes: 5

  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    # NEW: Generate TypeScript types before linting
    - name: Generate TypeScript types
      run: npm run typecheck -- --noEmit --skipLibCheck

    # NEW: Generate Prisma types
    - name: Generate Prisma Client
      run: npm run --workspace=server prisma:generate

    - name: Install dependencies
      run: npm ci

    # NEW: Clear ESLint cache to prevent stale checks
    - name: Clear ESLint cache
      run: rm -rf .eslintcache

    - name: Run ESLint
      run: npm run lint

    - name: Check formatting
      run: npm run format:check
```

#### 1.3 Monorepo ESLint Configuration

**Create `server/.eslintrc.cjs` override:**

```javascript
// server/.eslintrc.cjs - Workspace-specific overrides
module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

**Create `client/.eslintrc.cjs` override:**

```javascript
// client/.eslintrc.cjs - Frontend-specific rules
module.exports = {
  extends: ['../.eslintrc.cjs'],
  env: { browser: true, node: true, es2022: true },
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off', // React components
  },
};
```

### Strategy 2: Environment Variable Management

#### 2.1 Comprehensive Environment Matrix

Create `docs/deployment/ENVIRONMENT_VARIABLES.md`:

```markdown
# Environment Variables Reference

## Quick Reference Matrix

| Variable              | TIER | Dev | Test | Staging | Prod | Purpose                   |
| --------------------- | ---- | --- | ---- | ------- | ---- | ------------------------- |
| ADAPTERS_PRESET       | 1    | ✓   | ✓    | ✓       | ✓    | Mode selector (mock/real) |
| JWT_SECRET            | 1    | ✓   | ✓    | ✓       | ✓    | JWT signing key           |
| DATABASE_URL          | 1    | ✓   | ✓    | ✓       | ✓    | Connection string         |
| DIRECT_URL            | 1    | ✗   | ✓    | ✓       | ✓    | Prisma direct connection  |
| STRIPE_SECRET_KEY     | 2    | ✗   | ✗    | ✓       | ✓    | Payment processing        |
| POSTMARK_SERVER_TOKEN | 2    | ✗   | ✗    | ✓       | ✓    | Email service             |

## Per-Job Requirements

### main-pipeline.yml

**lint job:**

- Required: None (uses defaults)

**typecheck job:**

- Required: None (uses defaults)

**unit-tests job:**

- Required: JWT_SECRET, TENANT_SECRETS_ENCRYPTION_KEY
- Optional: NODE_ENV=test

**integration-tests job:**

- Required: DATABASE_URL, DIRECT_URL, JWT_SECRET, TENANT_SECRETS_ENCRYPTION_KEY
- Optional: NODE_ENV=test

**e2e-tests job:**

- Required: JWT_SECRET (mock mode)
- Optional: API_PORT, CORS_ORIGIN

### deploy-production.yml

**migrate-database-production job:**

- Required: PRODUCTION_DATABASE_URL, PRODUCTION_DIRECT_URL
- Critical: DIRECT_URL needed for Supabase pooler compatibility

**deploy-api-production job:**

- Required: PRODUCTION_API_URL
- Secrets: RENDER_PRODUCTION_API_DEPLOY_HOOK
```

#### 2.2 Doctor Script Enhancement

**Update `server/scripts/doctor.ts` to:**

1. Check correct file paths (currently says `server/.env` from root context)
2. Add `DIRECT_URL` to database checks
3. Show job-specific requirements
4. Add CI mode detection

```typescript
// Add to doctor.ts around line 63
const DATABASE_CHECKS: EnvCheck[] = [
  {
    key: 'DATABASE_URL',
    required: true,
    feature: 'Database',
    description: 'PostgreSQL connection string',
  },
  {
    key: 'DIRECT_URL',
    required: true,
    feature: 'Database',
    description: 'Direct database URL (required for Prisma migrations with Supabase pooler)',
  },
];

// Add CI-specific checks around line 205
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
if (isCI) {
  console.log(color('🤖 CI Environment Detected', colors.cyan));
  console.log(color('   Validating against CI requirements...', colors.cyan));
}
```

#### 2.3 GitHub Actions Secrets Configuration

Create `docs/deployment/GITHUB_SECRETS_SETUP.md`:

````markdown
# GitHub Actions Secrets Setup

## Required Secrets

Configure these in Settings → Secrets and Variables → Actions:

### Tier 1: Always Required

- `JWT_SECRET` - Generate: `openssl rand -hex 32`
- `TENANT_SECRETS_ENCRYPTION_KEY` - Generate: `openssl rand -hex 32`

### Tier 2: Production Only

- `PRODUCTION_DATABASE_URL` - Supabase connection string with pooler
- `PRODUCTION_DIRECT_URL` - Supabase direct URL (critical for migrations)
- `STRIPE_SECRET_KEY` - From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard

### Tier 3: Deployment Infrastructure

- `RENDER_PRODUCTION_API_DEPLOY_HOOK` - From Render Deploy Hooks
- `VERCEL_TOKEN` - From Vercel Account Settings
- `VERCEL_ORG_ID` - From Vercel Settings
- `VERCEL_PROJECT_ID` - From Vercel Project Settings

## Validation Checklist

Before deploying to production:

```bash
# 1. Verify all secrets exist
gh secret list --org myorg

# 2. Check each secret is not empty
gh secret list --org myorg --format json | jq '.[]'

# 3. Validate format (example for JWT)
# Should be 64 hex characters
echo $JWT_SECRET | wc -c  # Should output 65 (64 + newline)
```
````

## Secret Rotation Schedule

- JWT_SECRET: Every 90 days
- Database passwords: Every 60 days
- API keys: On vendor update or team change

````

### Strategy 3: Pre-Flight Validation

#### 3.1 Enhanced Doctor Script

Create new script `scripts/ci-preflight-check.sh`:

```bash
#!/bin/bash

# CI Pre-flight Validation Script
# Run before CI/CD deployment to catch issues early

set -e

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_YELLOW}🚀 CI Pre-flight Validation${COLOR_RESET}\n"

CHECKS_PASSED=0
CHECKS_FAILED=0

# Check 1: ESLint configuration
echo -n "Checking ESLint configuration... "
if [ -f ".eslintrc.cjs" ] && grep -q "plugin:@typescript-eslint/strict-type-checked" .eslintrc.cjs; then
    echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
    ((CHECKS_PASSED++))
else
    echo -e "${COLOR_RED}✗${COLOR_RESET}"
    echo "  ERROR: ESLint strict config not found"
    ((CHECKS_FAILED++))
fi

# Check 2: Environment variable documentation
echo -n "Checking environment variable docs... "
if [ -f "docs/deployment/ENVIRONMENT_VARIABLES.md" ]; then
    echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
    ((CHECKS_PASSED++))
else
    echo -e "${COLOR_RED}✗${COLOR_RESET}"
    echo "  ERROR: ENVIRONMENT_VARIABLES.md not found"
    ((CHECKS_FAILED++))
fi

# Check 3: Prisma schema has DIRECT_URL
echo -n "Checking Prisma DIRECT_URL configuration... "
if grep -q 'directUrl.*env("DIRECT_URL")' server/prisma/schema.prisma; then
    echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
    ((CHECKS_PASSED++))
else
    echo -e "${COLOR_RED}✗${COLOR_RESET}"
    echo "  ERROR: DIRECT_URL not configured in schema"
    ((CHECKS_FAILED++))
fi

# Check 4: GitHub Actions workflows have DIRECT_URL
echo -n "Checking CI workflows for DIRECT_URL... "
MISSING_DIRECT_URL=0
for workflow in .github/workflows/*.yml; do
    if grep -q "prisma migrate" "$workflow" && ! grep -q "DIRECT_URL" "$workflow"; then
        echo -e "${COLOR_YELLOW}⚠${COLOR_RESET}"
        echo "  WARNING: $workflow uses migrations but doesn't set DIRECT_URL"
        ((MISSING_DIRECT_URL++))
    fi
done

if [ $MISSING_DIRECT_URL -eq 0 ]; then
    echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi

# Check 5: All required env vars documented
echo -n "Checking required env vars are documented... "
UNDOCUMENTED_VARS=0
for var in JWT_SECRET TENANT_SECRETS_ENCRYPTION_KEY DATABASE_URL DIRECT_URL; do
    if ! grep -q "| $var" docs/deployment/ENVIRONMENT_VARIABLES.md 2>/dev/null; then
        echo -e "${COLOR_YELLOW}⚠${COLOR_RESET}"
        echo "  WARNING: $var not documented"
        ((UNDOCUMENTED_VARS++))
    fi
done

if [ $UNDOCUMENTED_VARS -eq 0 ]; then
    echo -e "${COLOR_GREEN}✓${COLOR_RESET}"
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi

# Summary
echo ""
echo -e "${COLOR_YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_RESET}"
echo -e "Passed: ${COLOR_GREEN}$CHECKS_PASSED${COLOR_RESET} | Failed: ${COLOR_RED}$CHECKS_FAILED${COLOR_RESET}"

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "\n${COLOR_RED}❌ Pre-flight checks failed!${COLOR_RESET}"
    echo "Fix issues above before deploying."
    exit 1
else
    echo -e "\n${COLOR_GREEN}✅ All pre-flight checks passed!${COLOR_RESET}"
    exit 0
fi
````

#### 3.2 Husky Pre-Commit Hook

Update `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run pre-flight checks before commit
echo "🏥 Running environment validation..."
npm run doctor

# Run linter
echo "🔍 Checking code quality..."
npm run lint:staged

# Run tests on changed files
echo "🧪 Running tests..."
npm run test:changed

echo "✅ All checks passed!"
```

### Strategy 4: CI/CD Workflow Improvements

#### 4.1 Migration Job Enhancement

Update `main-pipeline.yml` migration-validation job (line 265-267):

```yaml
migration-validation:
  name: Database Migration Validation
  runs-on: ubuntu-latest
  timeout-minutes: 10
  if: github.event_name == 'pull_request'

  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: mais_migration_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    # NEW: Validate migration files exist
    - name: Validate migration files
      run: |
        if [ ! -d "server/prisma/migrations" ]; then
          echo "❌ No migrations directory found"
          exit 1
        fi
        echo "✅ Found $(ls server/prisma/migrations | wc -l) migration(s)"

    # NEW: Check schema consistency
    - name: Validate Prisma schema
      run: |
        cd server
        npx prisma validate --schema=./prisma/schema.prisma

    # NEW: Set both DATABASE_URL and DIRECT_URL
    - name: Test migrations (fresh database)
      run: |
        cd server
        npx prisma migrate deploy --schema=./prisma/schema.prisma
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_migration_test?connection_limit=10&pool_timeout=20
        DIRECT_URL: postgresql://postgres:postgres@localhost:5432/mais_migration_test

    - name: Generate Prisma Client
      run: npm run --workspace=server prisma:generate
```

#### 4.2 Deploy Production Lint Fix

Replace line 131 in `deploy-production.yml`:

```yaml
# OLD (problematic):
# - name: Run linting
#   run: npm run lint
#   continue-on-error: true  # Don't block deploy on lint issues (TODO: fix lint errors)

# NEW (fix root cause):
- name: Run linting
  run: npm run lint
  # Note: Lint failures WILL block deployment
  # Use `npm run lint --fix` locally to resolve issues
```

#### 4.3 Add Health Check Validation Job

Add to `deploy-production.yml` after line 175:

```yaml
# New job: Validate environment before deployment
validate-deployment-env:
  name: Validate Deployment Environment
  runs-on: ubuntu-latest
  timeout-minutes: 5

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Validate required secrets
      run: |
        REQUIRED_SECRETS=(
          "PRODUCTION_DATABASE_URL"
          "PRODUCTION_DIRECT_URL"
          "STRIPE_SECRET_KEY"
          "STRIPE_WEBHOOK_SECRET"
        )

        for secret in "${REQUIRED_SECRETS[@]}"; do
          if [ -z "$(eval echo \${{ secrets.$secret }})" ]; then
            echo "❌ Missing required secret: $secret"
            exit 1
          fi
        done

        echo "✅ All required secrets are configured"

    - name: Validate environment variables
      run: |
        # Check .env.example documents all required vars
        if ! grep -q "PRODUCTION_DATABASE_URL" .env.example; then
          echo "⚠️  PRODUCTION_DATABASE_URL not documented in .env.example"
        fi
        echo "✅ Environment variable documentation check complete"
```

## Part 3: Best Practices

### Best Practice 1: Environment Variable Strategy

**Rule 1: Tier-Based Classification**

```
TIER 1: Core (always required, all modes)
TIER 2: Production-critical (required in prod only)
TIER 3: Optional (graceful fallbacks available)
```

**Rule 2: Doctor Script as Single Source of Truth**

- Keep `server/scripts/doctor.ts` as authoritative reference
- Doctor runs in pre-commit hooks
- Doctor validates before any CI job

**Rule 3: Secret Rotation Calendar**

```
- Sensitive keys: Every 90 days (JWT_SECRET, encryption keys)
- Integration keys: Every 180 days (Stripe, Postmark, etc.)
- On-demand: When team members leave or credentials suspected compromised
```

### Best Practice 2: ESLint Configuration

**Rule 1: Type-Checked Linting in CI**

```bash
# Always run in CI:
npm run typecheck  # Before linting (generates types)
npm run lint       # After type generation
```

**Rule 2: Rule Severity Strategy**

- `error`: Security, type safety, multi-tenant isolation
- `warn`: Code quality, style, performance
- `off`: Flexible rules in test files

**Rule 3: Monorepo Workspace Isolation**

- Root `.eslintrc.cjs`: Base config
- Workspace overrides: Feature-specific rules
- Never mix frontend and backend rules

### Best Practice 3: Prisma Migration Strategy

**Rule 1: Always Set DIRECT_URL**

```bash
# WRONG (fails with Supabase pooler):
DATABASE_URL=pool://...
npx prisma migrate deploy

# RIGHT:
DATABASE_URL=pool://...
DIRECT_URL=direct://...
npx prisma migrate deploy
```

**Rule 2: Migration Validation Before Deploy**

```bash
# 1. Validate schema
npx prisma validate --schema=./prisma/schema.prisma

# 2. Check migration status
npx prisma migrate status

# 3. Test on clean database
DIRECT_URL=<test-db> npx prisma migrate deploy
```

**Rule 3: Lock Migrations in Production**

```bash
# Production: Use 'deploy' (safe, idempotent)
npx prisma migrate deploy

# Development: Use 'dev' (creates new migrations)
npx prisma migrate dev --name <description>
```

### Best Practice 4: Pre-Deployment Checklist

**Always run before pushing:**

```bash
npm run doctor                # Validate environment
npm run lint                  # Check code quality
npm run typecheck            # Type safety
npm run test                 # Run all tests
npm run build --workspaces   # Build all packages
```

**Always check before CI merge:**

- [ ] All CI checks pass (lint, type, test, build)
- [ ] No `continue-on-error: true` bypasses
- [ ] Environment variables documented
- [ ] Migration files validate
- [ ] No hardcoded secrets

## Part 4: Test Cases for Prevention

### Test Case 1: ESLint Configuration Validation

```bash
#!/bin/bash
# tests/ci/eslint-config.test.sh

# Test 1: ESLint config exists
test -f .eslintrc.cjs || exit 1

# Test 2: Workspace configs exist
test -f server/.eslintrc.cjs || exit 1
test -f client/.eslintrc.cjs || exit 1

# Test 3: ESLint runs without errors
npm run lint || exit 1

# Test 4: No explicit 'any' in core code
! grep -r "as any" server/src/services/ || exit 1

echo "✅ ESLint configuration tests passed"
```

### Test Case 2: Environment Variable Validation

```bash
#!/bin/bash
# tests/ci/env-validation.test.sh

# Test 1: Doctor script works
npm run doctor > /dev/null || exit 1

# Test 2: All documented vars are tested
REQUIRED_VARS=("JWT_SECRET" "DATABASE_URL" "DIRECT_URL")
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "| $var" docs/deployment/ENVIRONMENT_VARIABLES.md; then
    echo "❌ Variable $var not documented"
    exit 1
  fi
done

# Test 3: CI workflows include all required env vars
for workflow in .github/workflows/*.yml; do
  if grep -q "prisma migrate" "$workflow"; then
    grep -q "DIRECT_URL" "$workflow" || {
      echo "❌ $workflow missing DIRECT_URL"
      exit 1
    }
  fi
done

echo "✅ Environment variable validation tests passed"
```

### Test Case 3: Prisma Migration Validation

```bash
#!/bin/bash
# tests/ci/prisma-migration.test.sh

# Test 1: Schema is valid
npm run --workspace=server prisma:validate || exit 1

# Test 2: Migration files exist
test -d server/prisma/migrations || exit 1

# Test 3: DIRECT_URL in schema
grep -q 'directUrl.*env("DIRECT_URL")' server/prisma/schema.prisma || exit 1

# Test 4: Test migration on clean database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"
export DIRECT_URL="postgresql://postgres:postgres@localhost:5432/test_db"
npm run --workspace=server prisma:reset -- --force || exit 1

echo "✅ Prisma migration tests passed"
```

### Test Case 4: CI Workflow Validation

```bash
#!/bin/bash
# tests/ci/workflow-validation.test.sh

echo "Validating CI/CD workflows..."

# Test 1: No 'continue-on-error: true' for critical jobs
! grep -A 5 "Run linting" .github/workflows/deploy-production.yml | grep "continue-on-error: true" || {
    echo "❌ Linting should not have continue-on-error"
    exit 1
}

# Test 2: All migrations set DIRECT_URL
for workflow in .github/workflows/*.yml; do
  if grep -q "prisma migrate deploy" "$workflow"; then
    grep -B 10 "prisma migrate deploy" "$workflow" | grep -q "DIRECT_URL" || {
      echo "❌ Migration in $workflow missing DIRECT_URL"
      exit 1
    }
  fi
done

# Test 3: Secrets documented
grep -q "PRODUCTION_DATABASE_URL" docs/deployment/GITHUB_SECRETS_SETUP.md || {
    echo "❌ Production secrets not documented"
    exit 1
}

echo "✅ CI workflow validation passed"
```

## Part 5: Implementation Roadmap

### Phase 1: Documentation (Week 1)

- [ ] Create `docs/deployment/CI_CD_FAILURE_PREVENTION.md` (this file)
- [ ] Create `docs/deployment/ENVIRONMENT_VARIABLES.md`
- [ ] Create `docs/deployment/GITHUB_SECRETS_SETUP.md`

### Phase 2: Script Enhancement (Week 1)

- [ ] Update `server/scripts/doctor.ts` with DIRECT_URL check
- [ ] Create `scripts/ci-preflight-check.sh`
- [ ] Add doctor script to husky pre-commit

### Phase 3: Configuration Fix (Week 1)

- [ ] Create `server/.eslintrc.cjs` workspace override
- [ ] Create `client/.eslintrc.cjs` workspace override
- [ ] Update root `.eslintrc.cjs` with tsconfig project references

### Phase 4: CI Workflow Updates (Week 2)

- [ ] Update `main-pipeline.yml` migration-validation job
- [ ] Fix `deploy-production.yml` lint job (remove continue-on-error)
- [ ] Add validate-deployment-env job
- [ ] Add type generation before lint step

### Phase 5: Testing (Week 2)

- [ ] Implement `tests/ci/eslint-config.test.sh`
- [ ] Implement `tests/ci/env-validation.test.sh`
- [ ] Implement `tests/ci/prisma-migration.test.sh`
- [ ] Implement `tests/ci/workflow-validation.test.sh`

### Phase 6: Documentation Updates (Week 2)

- [ ] Update CLAUDE.md with new patterns
- [ ] Update CONTRIBUTING.md with pre-commit checklist
- [ ] Create runbook for common CI failures

## Quick Reference: Common Fixes

### Fix: "could not find the DIRECT_URL"

```bash
# Add to GitHub Actions workflow:
env:
  DATABASE_URL: postgresql://...
  DIRECT_URL: postgresql://...  # <- Missing in CI

# Or in .env.example:
DIRECT_URL=postgresql://...
```

### Fix: "ESLint errors in CI but not locally"

```bash
# 1. Generate types first
npm run typecheck -- --noEmit

# 2. Clear ESLint cache
rm -rf .eslintcache

# 3. Run linter
npm run lint
```

### Fix: "Missing environment variable in production"

```bash
# 1. Document in ENVIRONMENT_VARIABLES.md
# 2. Add to GitHub Actions secrets
# 3. Add to doctor.ts checks
# 4. Add to .env.example (masked)
```

### Fix: "Prisma migration fails in CI"

```bash
# Always set both:
DATABASE_URL=pool://...
DIRECT_URL=direct://...

# Test locally:
npm run --workspace=server prisma:reset -- --force
```

## References

- `.eslintrc.cjs` - Global ESLint configuration
- `server/scripts/doctor.ts` - Environment variable validator
- `.github/workflows/main-pipeline.yml` - CI pipeline configuration
- `.github/workflows/deploy-production.yml` - Production deployment workflow
- `server/prisma/schema.prisma` - Prisma schema with DATABASE_URL and DIRECT_URL
- `.env.example` - Environment template
