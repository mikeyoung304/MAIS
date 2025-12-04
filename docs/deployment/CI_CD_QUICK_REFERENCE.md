# CI/CD Quick Reference & Common Fixes

Quick solutions for common CI/CD deployment failures.

## Quick Fixes

### Error: "could not find the DIRECT_URL environment variable"

**Problem:** Prisma migration fails in CI pipeline

**Solution:**

```yaml
# In GitHub Actions workflow, add DIRECT_URL:
env:
  DATABASE_URL: postgresql://user:pass@host:5432/db?poolingMode=transaction
  DIRECT_URL: postgresql://user:pass@host:5432/db
```

**Why:** Supabase uses connection pooler (DATABASE_URL) for app connections and direct URL for migrations.

**Files to check:**

- `.github/workflows/main-pipeline.yml` (line 268)
- `.github/workflows/deploy-production.yml` (line 300)
- `server/prisma/schema.prisma` (should have `directUrl = env("DIRECT_URL")`)

---

### Error: "ESLint errors in CI but not locally"

**Problem:** Strict TypeScript linting rules fail in CI environment

**Solution 1: Generate types before linting**

```bash
# Run in CI before lint job
npm run typecheck -- --noEmit
npm run --workspace=server prisma:generate
npm run lint
```

**Solution 2: Clear ESLint cache**

```bash
rm -rf .eslintcache
npm run lint
```

**Solution 3: Fix root configurations**

- Update `.eslintrc.cjs` to include workspace tsconfig references
- Create workspace-specific overrides (`server/.eslintrc.cjs`, `client/.eslintrc.cjs`)
- See `docs/deployment/CI_CD_FAILURE_PREVENTION.md` Part 2 Strategy 1

**Files to check:**

- `.eslintrc.cjs`
- `server/.eslintrc.cjs`
- `client/.eslintrc.cjs`
- `.github/workflows/main-pipeline.yml` (lint job)

---

### Error: "Missing environment variable X in production"

**Problem:** Required variable not available in deployment

**Solution:**

1. **Add to `.env.example`** (with example value):

   ```
   MY_VARIABLE=example-value
   ```

2. **Document in `docs/deployment/ENVIRONMENT_VARIABLES.md`:**

   ```markdown
   | MY_VARIABLE | Tier | Purpose | Default |
   ```

3. **Add to GitHub Actions secrets:**
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `MY_VARIABLE`
   - Value: (actual value)

4. **Add to doctor script** (`server/scripts/doctor.ts`):
   ```typescript
   {
     key: 'MY_VARIABLE',
     required: true,
     feature: 'Feature Name',
     description: 'What this variable does',
   }
   ```

**Verification:**

```bash
npm run doctor  # Should show the variable
```

---

### Error: "linting failed but doesn't block deployment"

**Problem:** ESLint errors bypassed with `continue-on-error: true`

**Solution:** Remove the bypass and fix the root cause

**Wrong:**

```yaml
- name: Run ESLint
  run: npm run lint
  continue-on-error: true # ❌ Masks the problem
```

**Right:**

```yaml
- name: Generate Prisma Client
  run: npm run --workspace=server prisma:generate

- name: Run ESLint
  run: npm run lint
  # ✅ Will fail if there are lint errors
```

**Files to check:**

- `.github/workflows/deploy-production.yml` (line 131)

---

### Error: "Prisma Client not generated"

**Problem:** Types missing when running linting or tests

**Solution:** Generate types before other checks

```bash
npm run --workspace=server prisma:generate
npm run typecheck -- --noEmit
npm run lint
```

**In GitHub Actions:**

```yaml
- name: Generate Prisma Client
  run: npm run --workspace=server prisma:generate

- name: Generate types
  run: npm run typecheck -- --noEmit

- name: Run linting
  run: npm run lint
```

---

## Pre-Deployment Checklist

Before pushing code or deploying:

```bash
# 1. Validate environment
npm run doctor

# 2. Type checking
npm run typecheck

# 3. Generate Prisma types
npm run --workspace=server prisma:generate

# 4. Linting
npm run lint

# 5. Tests
npm run test

# 6. Build
npm run build --workspaces
```

**For production deployment:**

```bash
# Verify in CI
git push origin main  # Push to trigger CI

# Wait for all checks:
- ✓ Documentation validation
- ✓ Pattern validation
- ✓ ESLint
- ✓ TypeScript
- ✓ Unit tests
- ✓ Integration tests
- ✓ E2E tests
- ✓ Build

# Then deploy
gh workflow run deploy-production.yml
```

---

## Secret Validation

Before deploying, verify all secrets are set:

```bash
# Check repository secrets
gh secret list --repo myorg/MAIS

# Check production environment secrets
gh secret list --repo myorg/MAIS --env production
```

**Required for production:**

- `PRODUCTION_DATABASE_URL`
- `PRODUCTION_DIRECT_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RENDER_PRODUCTION_API_DEPLOY_HOOK`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## Environment Variable Quick Reference

### Always Required

```
JWT_SECRET=...
TENANT_SECRETS_ENCRYPTION_KEY=...
DATABASE_URL=...
DIRECT_URL=...
```

### Required for Real Mode

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
POSTMARK_SERVER_TOKEN=...
```

### Required for Production

```
PRODUCTION_DATABASE_URL=...
PRODUCTION_DIRECT_URL=...
STRIPE_SECRET_KEY=sk_live_...  (different from test)
STRIPE_WEBHOOK_SECRET=whsec_live_...  (different from test)
```

### Optional (Graceful Fallbacks)

```
POSTMARK_FROM_EMAIL=...  (files to ./tmp/emails/ if not set)
GOOGLE_CALENDAR_ID=...   (uses mock calendar if not set)
```

---

## Common GitHub Actions Issues

### Workflow Can't Access Secret

```yaml
# WRONG - Secret won't be available
env:
  API_KEY: ${{ secrets.api_key }}  # Case mismatch!

# RIGHT - Name must match exactly
env:
  API_KEY: ${{ secrets.API_KEY }}  # Case-sensitive!
```

### Production Secrets Not Available in PR

**This is intentional!** Production secrets only available to:

- Push to `main` branch
- Manual `workflow_dispatch` trigger
- Tagged releases

**Solution:** Use repository-level secrets for CI, environment secrets for production

### Database Connection Fails

**Check:**

1. Connection string format is correct
2. Both `DATABASE_URL` and `DIRECT_URL` are set
3. Database allows connections from GitHub Actions IPs
4. Password doesn't have special characters that need escaping

**Fix:**

```yaml
env:
  DATABASE_URL: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
  DIRECT_URL: postgresql://user:pass@host:5432/db
```

---

## Troubleshooting Workflow

1. **Check workflow logs:**
   - GitHub repo → Actions → Failed workflow
   - Review job logs for specific error

2. **Identify issue category:**
   - ESLint error → Need to fix code
   - Missing env var → Need to add secret
   - Database error → Need to check connection
   - Migration error → Need to check DIRECT_URL

3. **Fix locally first:**

   ```bash
   npm run doctor
   npm run lint --fix
   npm run test
   ```

4. **Verify configuration:**
   - Check `.env.example` has all variables
   - Check GitHub secrets are set
   - Check workflow has correct env var references

5. **Push and test:**
   ```bash
   git add .
   git commit -m "fix: resolve CI issue"
   git push origin feature-branch
   # Wait for workflow to pass
   ```

---

## Documentation Files

### Quick Start

- `docs/deployment/CI_CD_QUICK_REFERENCE.md` (this file)

### Deep Dive

- `docs/deployment/CI_CD_FAILURE_PREVENTION.md` - Root causes and strategies
- `docs/deployment/ENVIRONMENT_VARIABLES.md` - Complete reference
- `docs/deployment/GITHUB_SECRETS_SETUP.md` - Secret configuration guide

### Configuration

- `.eslintrc.cjs` - Linting rules
- `server/prisma/schema.prisma` - Database schema
- `.github/workflows/main-pipeline.yml` - CI pipeline
- `.github/workflows/deploy-production.yml` - Production deployment

### Tools

- `npm run doctor` - Validate environment
- `scripts/ci-preflight-check.sh` - Pre-flight validation
- `tests/ci/ci-validation.test.ts` - Configuration tests

---

## Key Takeaways

1. **Always set DIRECT_URL with DATABASE_URL** for Prisma migrations
2. **Generate types before linting** to avoid ESLint errors
3. **Document all environment variables** in ENVIRONMENT_VARIABLES.md
4. **Use GitHub secrets** for sensitive values, never hardcode
5. **Run `npm run doctor`** before committing
6. **Don't use `continue-on-error: true`** - fix the root cause instead
7. **Rotate secrets regularly** - TIER 1 every 90 days

---

## Getting Help

1. **For ESLint issues:** See `CI_CD_FAILURE_PREVENTION.md` Strategy 1
2. **For env var issues:** See `ENVIRONMENT_VARIABLES.md` Troubleshooting
3. **For secrets issues:** See `GITHUB_SECRETS_SETUP.md` Troubleshooting
4. **For deployment issues:** Check `deploy-production.yml` logs in GitHub Actions

---

## Related Commands

```bash
# Local validation
npm run doctor                                # Check environment
npm run lint                                  # Check code style
npm run typecheck                             # Check types
npm run test                                  # Run tests
npm run build --workspaces                    # Build all packages

# Pre-deployment
scripts/ci-preflight-check.sh                # Validate CI/CD setup
npm run test:e2e                             # Run E2E tests

# GitHub Actions
gh workflow list                              # See available workflows
gh workflow run main-pipeline.yml             # Trigger CI pipeline
gh workflow run deploy-production.yml         # Trigger production deployment
gh secret list --repo myorg/MAIS              # List secrets

# Database
npm run --workspace=server prisma:generate   # Generate Prisma types
npm run --workspace=server prisma:migrate:dev --name NAME  # Create migration
npm run --workspace=server prisma:migrate:deploy  # Apply migrations
npm run --workspace=server prisma:studio     # Visual database browser
```

---

## Version Info

- Node.js: ≥20.0.0
- npm: ≥8.0.0
- TypeScript: 5.9.3
- PostgreSQL: 16
- Prisma: 6.x
- ts-rest: 3.52.1

---

## Last Updated

This guide was created during Sprint 10 (November 2025) based on actual CI/CD failure analysis.

For latest information, see `docs/deployment/CI_CD_FAILURE_PREVENTION.md`.
