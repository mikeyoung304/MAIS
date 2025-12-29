---
module: MAIS
date: 2025-12-29
problem_type: deployment_checklist
component: deployment/render.io, server/, apps/web
symptoms:
  - TypeScript build errors prevent deployment
  - Build succeeds locally but fails on Render
  - Environment variables missing during build
  - Database migrations not applied
root_cause: Incomplete preparation before pushing to production platform
resolution_type: deployment_checklist
severity: P0
related_files:
  - .github/workflows/ci.yml
  - render.yaml
  - server/prisma/schema.prisma
tags: [deployment, render, typescript, production, checklist]
---

# Before Deploying to Render: Complete Checklist

This checklist ensures your code is production-ready and won't have surprises when deploying to Render.

**Timing:** Run this checklist BEFORE creating a GitHub PR or pushing to production branch.

**Duration:** 15-20 minutes depending on project size.

---

## Phase 1: Local Verification (5 minutes)

### 1.1 Clean Installation

```bash
# Clean node_modules and reinstall dependencies
rm -rf node_modules apps/web/node_modules server/node_modules
npm ci  # Use ci instead of install for reproducibility
```

**What this catches:**

- Missing dependencies
- Version conflicts
- Lock file corruption

### 1.2 Code Quality Checks

```bash
# Run all quality checks
npm run lint       # ESLint (catches import errors, naming issues)
npm run format     # Prettier (code formatting)
npm run typecheck  # TypeScript (catches type errors)

# Verify no errors:
# ✓ lint passed
# ✓ typecheck passed
# ✓ build succeeded (next)
```

**What this catches:**

- Import source errors (wrong paths)
- Interface method naming mismatches
- Entity field naming errors
- Private property convention violations
- Complex type inference failures
- ESLint rule violations

**CRITICAL:** All three must pass before continuing.

### 1.3 Build All Workspaces

```bash
# Build entire monorepo
npm run build

# Expected output:
# ✓ server built
# ✓ apps/web built
# ✓ packages/contracts built
# ✓ packages/shared built
```

**What this catches:**

- TypeScript compilation errors
- Missing exports
- Circular dependencies
- Build-time resource issues

**MUST PASS:** Build should complete with 0 errors.

---

## Phase 2: Database Safety (5 minutes)

### 2.1 Check Migration Status

```bash
# Check if migrations are in sync with schema
npm exec -w server prisma migrate status

# Expected output should show:
# ✓ All migrations up to date
# OR
# ⚠ Pending migrations (if intentional new changes)
```

**What this catches:**

- Unpushed migration files
- Schema drift
- Unapplied migrations
- Missing migration names

### 2.2 Validate Prisma Schema

```bash
# Verify schema.prisma is valid
npm exec -w server prisma validate

# Expected output:
# ✓ Your schema.prisma is valid
```

**What this catches:**

- Schema syntax errors
- Invalid field types
- Broken relationships
- Index syntax errors

### 2.3 Verify All Database Changes Are Committed

```bash
# Check if any schema.prisma changes are uncommitted
git status server/prisma/schema.prisma server/prisma/migrations/

# Expected: No changes, everything committed
```

**What this catches:**

- Uncommitted migrations
- Schema drift between branches
- Orphaned migration files

---

## Phase 3: Environment & Secrets (3 minutes)

### 3.1 List Required Environment Variables

```bash
# Check what's in .env.example
cat .env.example | grep -v "^#" | grep -v "^$"

# Expected environment variables:
# SERVER_PORT
# DATABASE_URL
# DIRECT_URL
# JWT_SECRET
# TENANT_SECRETS_ENCRYPTION_KEY
# (Plus optional: STRIPE_SECRET_KEY, POSTMARK_TOKEN, etc.)
```

**What this catches:**

- Missing required secrets
- Locally-set variables not documented

### 3.2 Verify Secrets Are NOT in Code

```bash
# Check for hardcoded secrets
grep -r "sk_live_\|pk_live_\|password\|secret" --include="*.ts" --include="*.tsx" server/ apps/web/ | grep -v "// " || echo "✓ No hardcoded secrets found"

# Check for example/test credentials
grep -r "test_.*key\|example_.*secret" --include="*.ts" --include="*.tsx" . || echo "✓ No test credentials found"
```

**What this catches:**

- Accidentally committed secrets
- Hardcoded API keys
- Database credentials in code

**CRITICAL:** Stop if any secrets found. Remove before continuing.

### 3.3 Check Render Environment Configuration

```bash
# If using render.yaml, verify structure
if [ -f render.yaml ]; then
  echo "Checking render.yaml..."
  # Should have:
  # - services (server, web)
  # - environment variables section
  # - health check for server
  grep -E "envVars|environment" render.yaml
fi
```

---

## Phase 4: Code Review: TypeScript Build Errors (3 minutes)

### 4.1 Interface Method Naming

```bash
# Verify all repository methods use consistent naming
grep -r "interface.*Repository" server/src/lib/ports.ts | head -5

# Check that implementations match interface names
# Pattern: get[EntityName]By[Field]
# Examples: getPackageById, getPackageBySlug, getAllPackages, getAddOnById
```

**Red flags:**

- `findById` in interface, `getById` in implementation
- `fetch` mixed with `get`
- Inconsistent naming across repositories

### 4.2 Entity Field Naming

```bash
# Verify Prisma schema and entities.ts are in sync
echo "Fields in schema.prisma:"
grep -A 30 "model Booking" server/prisma/schema.prisma | grep -E "^\s+\w+\s+" | head -10

echo ""
echo "Fields in entities.ts:"
grep -A 20 "interface Booking" server/src/lib/entities.ts | head -10

# Should match exactly
```

**Red flags:**

- `paidAt` in schema, `paid` in entity type
- `balancePaidAt` in schema, `paidDate` in type
- Missing fields between schema and type

### 4.3 Private Property Convention

```bash
# Verify private properties use underscore prefix
grep -r "private [a-zA-Z]" server/src --include="*.ts" | grep -v "_" | head -5

# Should be empty (no matches without underscore)
```

**Red flags:**

- `private repository: Repository` (missing underscore)
- Mixed convention: some with underscore, some without

### 4.4 Import Source Correctness

```bash
# Check for relative imports from packages/ directory
grep -r "from ['\"].*packages/" server/src apps/web/src --include="*.ts" --include="*.tsx" || echo "✓ No relative package imports found"

# Check for CommonJS imports in ESM code
grep -r "require(" server/src apps/web/src --include="*.ts" --include="*.tsx" || echo "✓ No CommonJS imports found"
```

**Red flags:**

- `import { contract } from '../../../packages/contracts'`
- `const express = require('express')`
- Wrong subpath: `import type Stripe from 'stripe/lib'`

### 4.5 Type Inference Safety

```bash
# Check for risky Parameters<> usage
grep -r "Parameters<" server/src --include="*.ts" | head -5

# If found, verify they're not on optional parameters
# (Should be empty or very rare)
```

**Red flags:**

- `type CreateParams = Parameters<typeof create>` where create has optional params
- Multiple instances of inference on complex functions

---

## Phase 5: Automated Testing (3 minutes)

### 5.1 Run All Unit Tests

```bash
# Run entire test suite
npm test 2>&1 | tail -20

# Expected output:
# ✓ All tests pass
# ✓ No failures
# ✓ Coverage meets threshold
```

**What this catches:**

- Runtime issues from type changes
- Logic errors in services
- Failed assumptions in code

### 5.2 Check Test Coverage

```bash
# View coverage summary
npm run test:coverage 2>&1 | grep -E "Statements|Branches|Functions|Lines" | head -5
```

**Expected minimum:**

- Statements: > 70%
- Branches: > 60%
- Functions: > 70%
- Lines: > 70%

---

## Phase 6: Production Build Simulation (2 minutes)

### 6.1 Simulate Render Build Environment

```bash
# Build with production settings (what Render will do)
npm run build -- --production

# Or for Next.js:
cd apps/web && npm run build && cd ../..

# Check output for warnings/errors
echo ""
echo "Looking for build warnings..."
npm run build 2>&1 | grep -i "warning\|deprecated" | head -10
```

**What this catches:**

- Deprecated dependencies
- Build-time warnings that might fail in CI
- Missing build steps

### 6.2 Check Bundle Size (warnings only)

```bash
# For Next.js app
if [ -d "apps/web" ]; then
  echo "Next.js build output:"
  cd apps/web && npm run build 2>&1 | grep -E "Page|Route" | head -10
fi
```

---

## Phase 7: Git Hygiene (2 minutes)

### 7.1 Check for Uncommitted Changes

```bash
# Status should be clean
git status

# Expected output:
# On branch feat/...
# nothing to commit, working tree clean
```

**Red flags:**

- Uncommitted code changes
- Untracked files (except node_modules, .next, dist/)
- Unstaged migrations

### 7.2 Verify Commit Messages

```bash
# Check last 5 commits
git log --oneline -5

# Expected format:
# feat: add new feature
# fix: resolve bug
# refactor: improve code structure
```

### 7.3 Verify Branch is Protected

```bash
# Check current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $BRANCH"

# Should be a feature branch (feat/*, fix/*, etc.) before PR
# NOT main or master
```

---

## Phase 8: Pre-Deployment Final Checks (2 minutes)

### 8.1 Run Full CI Suite Locally

```bash
# Simulate what GitHub Actions will run
npm run lint && npm run typecheck && npm run build && npm test

# All four must pass with 0 errors
# Output should show:
# ✓ lint passed
# ✓ typecheck passed
# ✓ build succeeded
# ✓ tests passed
```

### 8.2 Final Database Check

```bash
# Ensure no pending migrations
npm exec -w server prisma migrate status

# Should show all migrations deployed
# OR if new migrations, they should be:
# 1. In server/prisma/migrations/
# 2. Committed to git
# 3. Listed in git status as tracked files
```

### 8.3 Environment Variables for Render

Create list of what Render needs:

```bash
cat << 'EOF' > /tmp/render-env-vars.txt
# Server environment variables needed on Render:
DATABASE_URL=postgresql://...  # Render Postgres
DIRECT_URL=postgresql://...    # Render Postgres (for migrations)
JWT_SECRET=<generate-with-openssl>
TENANT_SECRETS_ENCRYPTION_KEY=<generate-with-openssl>
NODE_ENV=production
ADAPTERS_PRESET=real           # Use real external services
PORT=10000                      # Render default

# Optional but recommended:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
POSTMARK_SERVER_TOKEN=...
GOOGLE_CALENDAR_ID=...

# Next.js environment variables:
NEXT_PUBLIC_API_BASE=https://your-api.onrender.com
EOF

# Review what variables are needed
echo "Required environment variables for Render:"
cat /tmp/render-env-vars.txt
```

---

## Phase 9: PR & Deployment Preparation

### 9.1 Create Pull Request

```bash
# Before pushing, verify:
# ✓ All tests pass locally
# ✓ All quality checks pass
# ✓ Build succeeds
# ✓ No TypeScript errors
# ✓ Database migrations committed

git push origin feat/your-feature-name
# Then create PR on GitHub
```

### 9.2 Wait for GitHub Actions

```bash
# GitHub Actions will run:
# - lint
# - typecheck
# - build
# - test
# - e2e tests

# All must pass (green checkmarks) before merging
# Status shows on PR page
```

**If anything fails:**

1. Check the action logs
2. Fix locally
3. Push again (PR will update automatically)

### 9.3 Code Review Checklist

Before merge, reviewers should verify:

```yaml
Code Review: □ All GitHub Actions pass (green)
  □ No merge conflicts
  □ TypeScript strict mode passes
  □ No new warnings/errors
  □ Database migrations are safe
  □ Environment variables documented
  □ Commit messages follow conventions
  □ Feature is complete (not partial)
```

---

## Phase 10: Deploy to Render

### 10.1 Merge to Main

```bash
# After PR approval, merge to main branch
# Render will automatically deploy main branch
```

### 10.2 Monitor Render Deployment

```bash
# Watch build logs at render.io dashboard:
# 1. Check "Build" tab for compilation errors
# 2. Check "Deploy" tab for runtime errors
# 3. Check "Logs" tab for application output

# Build should show:
# ✓ Build succeeded
# ✓ All migrations applied
# ✓ Server health check passed
```

### 10.3 Verify Application is Running

```bash
# Test production endpoints
curl https://your-api.onrender.com/health
# Should return: { status: "ok" }

# Test Next.js app
curl https://your-web.onrender.com
# Should return HTML (not error page)
```

---

## Rollback Plan (If Deployment Fails)

### If Render Build Fails

```bash
# 1. Check Render logs for error
#    Common causes:
#    - TypeScript compilation error
#    - Database migration failed
#    - Environment variable missing
#    - Port already in use

# 2. Identify the error:
grep -i "error\|failed" <render-logs>

# 3. Fix locally:
npm run typecheck  # If TypeScript error
npm exec prisma migrate resolve  # If migration error
# Add missing env var to Render dashboard

# 4. Push fix:
git push origin main

# 5. Render auto-redeploys (or manually trigger in dashboard)
```

### If Application Has Errors After Deploy

```bash
# Check application logs on Render
# Look for:
# - Database connection errors
# - Missing environment variables
# - Unhandled exceptions

# Quick fixes (without code change):
# 1. Restart application (Render dashboard)
# 2. Check environment variables are set
# 3. Verify database is accessible

# If code issue:
# 1. Revert PR on main branch
# 2. Render will redeploy previous version
# 3. Fix the issue locally
# 4. Create new PR
```

---

## Checklist Summary

### Copy this checklist for each deployment:

```
BEFORE DEPLOYING TO RENDER
==========================

Phase 1: Local Verification
  □ Clean installation (rm -rf node_modules && npm ci)
  □ npm run lint passes
  □ npm run typecheck passes
  □ npm run build succeeds

Phase 2: Database Safety
  □ prisma migrate status is clean
  □ prisma validate passes
  □ All migrations committed

Phase 3: Environment & Secrets
  □ .env.example documents all required vars
  □ No secrets hardcoded in code
  □ render.yaml configured (if using)

Phase 4: Code Review (TypeScript Build Errors)
  □ Interface methods use consistent naming
  □ Entity field names match schema.prisma
  □ Private properties use underscore prefix
  □ No relative imports from packages/
  □ No risky type inference

Phase 5: Testing
  □ npm test passes (all tests green)
  □ Coverage meets minimum thresholds

Phase 6: Production Build
  □ npm run build --production succeeds
  □ No build warnings

Phase 7: Git Hygiene
  □ git status is clean
  □ All commits have proper messages
  □ Branch is feature branch, not main

Phase 8: Pre-Deployment
  □ Full CI suite passes (lint, typecheck, build, test)
  □ No pending migrations

Phase 9: PR & Code Review
  □ GitHub Actions all green
  □ PR approved by code reviewer
  □ No merge conflicts

Phase 10: Deploy
  □ Merged to main
  □ Render build succeeded
  □ Health checks passing
  □ Application responding to requests
```

---

## Common Render Errors and Fixes

### Build Error: "Cannot find module '@macon/contracts'"

```
Cause: Relative import from packages/
Fix: Use @macon/contracts import path
     Check package.json "exports" field
```

### Build Error: "Property 'X' does not exist"

```
Cause: Interface method naming mismatch
       OR entity field name mismatch
Fix: Verify ports.ts matches implementation
     Verify entity types match schema.prisma
     Run: npm run typecheck locally
```

### Build Error: "Type constraint violated"

```
Cause: Complex type inference on optional parameters
Fix: Replace Parameters<> with explicit interface
     Make parameters required instead of optional
```

### Runtime Error: "Database connection failed"

```
Cause: DATABASE_URL or DIRECT_URL not set on Render
Fix: Add environment variables in Render dashboard
     Verify Postgres instance is running
     Check network connectivity
```

### Runtime Error: "JWT_SECRET is not defined"

```
Cause: Required environment variable missing on Render
Fix: Generate with: openssl rand -hex 32
     Add to Render environment variables
     Restart application
```

---

## Prevention: Make This Part of Your Workflow

### Add Pre-Commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

echo "Running deployment checklist..."
npm run lint || exit 1
npm run typecheck || exit 1
npm run build || exit 1

echo "✓ Ready to commit"
```

### Add Pre-Push Hook

```bash
#!/bin/bash
# .husky/pre-push

echo "Running full test suite before push..."
npm test || exit 1

echo "✓ All tests pass - ready to push"
```

### GitHub Actions Catches Remaining Issues

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```

---

## Success Criteria

Your deployment is successful when:

1. **Build Phase (GitHub Actions)**
   - ✓ All workflows pass (green checkmarks)
   - ✓ No lint errors
   - ✓ No TypeScript errors
   - ✓ Build completes in < 5 minutes

2. **Deployment Phase (Render)**
   - ✓ Render build log shows "Build succeeded"
   - ✓ Migrations applied successfully
   - ✓ Health check responds (200 OK)

3. **Post-Deployment (Production)**
   - ✓ API responds to requests
   - ✓ Next.js app loads correctly
   - ✓ Database queries work
   - ✓ No errors in Render logs

4. **Verification**
   - ✓ Smoke test: Hit health endpoint
   - ✓ Create test booking/package
   - ✓ Verify data in production database

---

## Questions? Troubleshooting

### TypeScript errors locally but CI passes?

```bash
# Sync TypeScript version
npm install -D typescript@latest
npm run typecheck
```

### Database migrations failing on Render?

```bash
# Check migration files are committed
git status server/prisma/migrations/

# Verify DIRECT_URL is set on Render
# Check Postgres is accessible from Render
```

### Application crashing after deploy?

```bash
# Check Render application logs
# Look for:
# - Uncaught exceptions
# - Missing environment variables
# - Database connection errors

# Restart application (Render dashboard)
# Verify all env vars are set
```

---

**Last Updated:** 2025-12-29
**Applies to:** MAIS project (main branch deployments)
**Review Frequency:** Every release
