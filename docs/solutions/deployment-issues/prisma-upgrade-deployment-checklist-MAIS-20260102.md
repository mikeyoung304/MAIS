---
title: 'Prisma Upgrade Deployment Checklist for Render/Vercel'
category: deployment-issues
severity: P1
use-case: 'After implementing Prisma upgrade, before pushing to production'
platforms:
  - Render
  - Vercel
  - Docker-based deployments
tags:
  - prisma
  - ci-cd
  - deployment
  - build-verification
---

# Prisma Upgrade Deployment Checklist

Use this checklist before merging a Prisma upgrade to `main`.

## Pre-Deployment (Development)

### Environment Setup

- [ ] Created `server/scripts/prisma-postgenerate.js` with correct syntax
- [ ] Updated `server/package.json` build script to call `prisma:generate`
- [ ] Created `server/src/db.ts` wrapper module (if applicable)
- [ ] Updated all imports to use new entry point (if applicable)

### Local Validation

```bash
# Command 1: Verify postgenerate script syntax
node -c server/scripts/prisma-postgenerate.js
# Expected: (no output, exit code 0)

# Command 2: Run postgenerate manually
node server/scripts/prisma-postgenerate.js
# Expected: ✅ Created Prisma barrel file: src/generated/prisma/index.ts

# Command 3: Verify barrel file exists
cat server/src/generated/prisma/index.ts
# Expected: export * from './client';

# Command 4: Type check
npm run typecheck
# Expected: (no errors, completes quickly)

# Command 5: Local build
npm run build
# Expected: (completes successfully)

# Command 6: Test in clean shell (CRITICAL)
bash -c "cd server && rm -rf node_modules dist && npm install && npm run build"
# Expected: (build succeeds without cached files)
```

**Status:** All commands pass? ✅ Proceed to next section

### Clean Environment Test

This is the **most important** test. It simulates what CI will do.

```bash
# Option 1: Docker test (most realistic)
docker run -it --rm \
  -v $(pwd):/app \
  node:20-alpine \
  bash -c "cd /app && npm ci && npm run build"
# Expected: Build completes successfully

# Option 2: Fresh shell test (if Docker unavailable)
# In a completely new terminal or different user session
cd /tmp
cp -r ~/CODING/MAIS ./MAIS_TEST
cd MAIS_TEST
npm ci
npm run build
# Expected: Build succeeds
```

**Status:** Clean build passes? ✅ Proceed to deployment

## Pre-Deployment (CI Pipeline)

### GitHub Actions Verification

- [ ] All GitHub Actions workflows passed
- [ ] Specifically check: `npm run build` step
- [ ] Check: `npm run typecheck` step
- [ ] Check: `npm test` step (if part of pipeline)

**If any workflow failed:** Stop! Do not merge. Fix locally first.

```bash
# Re-run locally to match CI exactly
npm ci      # Use exact lockfile versions (like CI does)
npm run typecheck
npm run build
npm test
```

### Render-Specific Checks

Check that your `render.yaml` is correct:

```yaml
build:
  command: npm run build
envVars:
  - key: DATABASE_URL
    sync: false
  - key: DIRECT_URL
    sync: false
```

**CRITICAL: Environment Variables for Prisma 7:**

Prisma 7 requires **both** `DATABASE_URL` and `DIRECT_URL`:

- `DATABASE_URL` = Session Pooler (port 5432, pgbouncer mode) - used at runtime for queries
- `DIRECT_URL` = Transaction Pooler (port 6543, no pgbouncer) - used during `prisma generate`

Without `DIRECT_URL`, builds fail with:

```
PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL
```

**This command must include the postgenerate step:**

```bash
# What actually runs
npm run build
  → npm run prisma:generate (you added this)
    → prisma generate
    → node scripts/prisma-postgenerate.js (creates barrel file)
  → tsc -b (TypeScript compilation)
```

Verify by checking your `server/package.json`:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate && node scripts/prisma-postgenerate.js",
    "build": "npm run prisma:generate && tsc -b"
  }
}
```

✅ Does `build` call `prisma:generate`? Continue.
✅ Are both `DATABASE_URL` and `DIRECT_URL` set? Continue.
❌ If not, fix these first.

### Vercel-Specific Checks (if using apps/web)

For Next.js deployment, check `apps/web/package.json` and root build:

```json
{
  "vercel-build": "npm run build -w @macon/contracts && npm run build -w @macon/shared && cd apps/web && next build"
}
```

This calls `npm run build` in each workspace. Ensure:

- [ ] `server` workspace has postgenerate in build script
- [ ] `@macon/contracts` and `@macon/shared` don't depend on Prisma
- [ ] `apps/web` doesn't import from `server/src/generated/`

## Deployment Testing (Staging)

Before production, test on staging environment.

### Create Staging Commit

1. Create a feature branch: `git checkout -b test/prisma-upgrade-staging`
2. Merge all changes
3. **Do NOT merge to main yet**

### Deploy to Staging

For Render:

```bash
# Manually trigger staging build in Render dashboard
# OR use Render CLI:
render deploy --environment staging
```

For Vercel:

```bash
# Preview deployment auto-created on PR
# Or manually trigger:
vercel deploy --prod --scope=<your-scope>
```

### Smoke Tests on Staging

```bash
# Check deployment status
curl https://staging-api.example.com/health
# Expected: 200 OK

# Check API is loading Prisma correctly
curl https://staging-api.example.com/v1/admin/audit \
  -H "Authorization: Bearer test-token" \
  -H "X-Tenant-Key: pk_live_test_123"
# Expected: 200 OK (or 401 if unauthorized, not 500)

# Check database connectivity
curl https://staging-api.example.com/v1/public/packages \
  -H "X-Tenant-Key: pk_live_test_123"
# Expected: Returns JSON response (not module error)
```

**If any health checks fail:**

- [ ] Check deployment logs in Render/Vercel dashboard
- [ ] Look for "Cannot find module" errors
- [ ] Check if `src/generated/prisma/index.ts` was created
- [ ] Rollback staging deployment

### Application Validation on Staging

- [ ] Admin dashboard loads without errors
- [ ] Can create/list resources
- [ ] Database queries work correctly
- [ ] No "Cannot find module" in logs
- [ ] No TypeScript errors in application logs
- [ ] Check build logs: "✅ Created Prisma barrel file" appears

## Production Deployment

### Final Pre-Production Checks

- [ ] All staging tests passed
- [ ] All team members reviewed code
- [ ] Database migrations (if any) already applied to production
- [ ] Rollback plan documented (see below)
- [ ] Monitoring configured (see below)

### Merge and Deploy

```bash
# Merge to main
git checkout main
git merge test/prisma-upgrade-staging
git push origin main

# Trigger production deployment
# Render: Manual trigger in dashboard OR
render deploy --environment production

# Vercel: Automatic on push to main, or manual:
vercel deploy --prod
```

### Monitor Production Deployment

**During Deployment:**

- [ ] Watch build logs in Render/Vercel dashboard
- [ ] Look for: "✅ Created Prisma barrel file"
- [ ] Look for: "TypeScript compilation complete"
- [ ] No "Cannot find module" errors
- [ ] Build time is reasonable (not hanging)

**After Deployment:**

```bash
# Health check
curl https://api.example.com/health -v
# Expected: 200 OK

# Application check (requires valid auth)
curl https://api.example.com/v1/admin/tenants \
  -H "Authorization: Bearer $(get_valid_token)" \
  -v
# Expected: 200 OK, valid JSON response

# Error logs check
# Render: Dashboard → Logs → "stderr"
# Look for: No TypeScript/module errors
# Look for: Normal application logs
```

**If Production Deployment Failed:**

See the "Rollback Plan" section below.

## Rollback Plan (If Issues Found)

### Option 1: Immediate Rollback (Fastest)

If production is broken and needs immediate recovery:

```bash
# Revert the commit
git revert HEAD
git push origin main

# Render: Automatic redeploy on main push
# Vercel: Automatic redeploy on main push

# Monitor logs until deployment complete
# Expected: Back to previous stable version in ~5 minutes
```

### Option 2: Targeted Fix (If Issue Identified)

If you identified the exact problem:

```bash
# Fix the issue locally
# (postgenerate script, build script, etc.)

# Test in clean environment
rm -rf node_modules && npm ci && npm run build

# Commit fix
git add -A
git commit -m "fix(prisma): correct postgenerate script path"
git push origin main

# Monitor redeployment
```

### Option 3: Feature Flag Fallback (If Available)

If you have feature flags for critical functionality:

```bash
# Disable the problematic feature
# Update FEATURE_FLAGS env var in Render/Vercel
# Redeploy with flag disabled

# This buys time to fix while app stays online
```

## Monitoring Post-Deployment

### Metrics to Watch (First Hour)

- **Build completion:** Should complete in < 15 minutes
- **Error rate:** Should remain < 1% (normal baseline)
- **API response time:** Should remain normal
- **Database connection errors:** Should be zero

### Logs to Monitor

**Render logs (Dashboard → Logs):**

```
✓ Checking npm install
✓ Running npm run build
  ✓ prisma generate
  ✓ Created Prisma barrel file
  ✓ TypeScript compilation
✓ Deployment successful
```

**Application logs:**

```
INFO: Server starting on port 3001
INFO: Database connected
INFO: API ready
```

**DO NOT see:**

```
ERROR: Cannot find module './generated/prisma'
ERROR: TS2307: Cannot find module
FATAL: Build failed
```

### Set Up Alerts

**For Render:**

1. Dashboard → Project → Notifications
2. Add webhook to Slack/Discord
3. Alert on: Build failure, deployment failure

**For Vercel:**

1. Dashboard → Settings → Integrations
2. Configure deployment notifications
3. Watch email for build failures

## Post-Deployment (24-48 Hours)

### Ongoing Monitoring

- [ ] No error spikes in logs (48 hours post-deploy)
- [ ] User reports? Check in Slack/support channel
- [ ] Database performance normal? Check query logs
- [ ] API response times stable? Check monitoring dashboard

### Success Indicators (After 48 Hours)

- ✅ No TypeScript/module errors in logs
- ✅ Error rate returned to baseline
- ✅ Users report no issues
- ✅ Database migrations (if any) completed successfully
- ✅ CI/CD pipeline shows all green

**Upgrade is successful!** Document it:

```bash
git log --oneline | head -1
# Example: abc123d chore(deps): upgrade prisma 6 to 7

# Add to project notes
echo "✅ Prisma upgrade to 7.x completed successfully on $(date)" >> UPGRADE_LOG.md
```

## Troubleshooting Deployment Issues

### Issue: "Cannot find module './generated/prisma'"

**Cause:** Postgenerate script didn't run

**Steps:**

1. Check `server/package.json` build script includes `prisma:generate`
2. Check postgenerate script syntax: `node -c server/scripts/prisma-postgenerate.js`
3. Verify script path is correct in package.json
4. Re-deploy with corrected script

### Issue: "Build Timeout (>30 min)"

**Cause:** Possible infinite loop in postgenerate or Prisma generate taking too long

**Steps:**

1. Cancel deployment in Render/Vercel
2. Check for infinite loops in postgenerate script
3. Verify Prisma schema is valid: `npm exec prisma validate`
4. Run locally: `time npm run prisma:generate` (check duration)
5. Check if large Prisma schema causing slowness

### Issue: "TypeScript Compilation Errors"

**Cause:** Entry point changed, imports not updated, or JSON types

**Steps:**

1. Is this a Prisma 7 JSON type issue? See: `prisma-7-json-type-breaking-changes-MAIS-20260102.md`
2. Are imports pointing to old entry point? Update all imports
3. Run locally: `npm run typecheck` (debug error)
4. Check if wrapper module (`src/db.ts`) is being used consistently

### Issue: "Deployment Succeeded But App Won't Start"

**Cause:** Runtime module resolution issue

**Steps:**

1. Check runtime logs in Render/Vercel
2. Look for module loading errors
3. Verify `src/generated/prisma/index.ts` exists in deployment (check build log)
4. Verify imports use the barrel file or wrapper
5. Check environment variables are set

## Quick Command Reference

```bash
# Pre-deployment
node -c server/scripts/prisma-postgenerate.js          # Syntax check
npm run prisma:generate                                 # Run postgenerate
npm run typecheck                                       # Type check
rm -rf node_modules && npm ci && npm run build         # Clean build test

# Deployment simulation (Docker)
docker run -v $(pwd):/app node:20 bash -c "cd /app && npm ci && npm run build"

# Post-deployment monitoring
curl https://api.example.com/health
curl https://api.example.com/v1/admin/tenants -H "Authorization: Bearer TOKEN"

# Rollback (if needed)
git revert HEAD && git push origin main
```

## Success Criteria Checklist

Before you can claim victory:

- [ ] Local tests pass (clean environment)
- [ ] Docker build succeeds
- [ ] Staging deployment successful
- [ ] Staging smoke tests pass
- [ ] Production build completes
- [ ] Production health checks pass
- [ ] No errors in production logs (24 hours)
- [ ] Monitoring shows normal metrics
- [ ] All team members verified

## Key Files to Reference

| File                                    | Purpose                     |
| --------------------------------------- | --------------------------- |
| `server/scripts/prisma-postgenerate.js` | Creates barrel file         |
| `server/package.json`                   | Wires postgenerate to build |
| `server/src/db.ts`                      | Wrapper module (if used)    |
| `render.yaml`                           | Render deployment config    |
| `vercel.json`                           | Vercel deployment config    |

## Related Documentation

- **Prevention Guide:** `prisma-major-upgrade-build-failure-prevention-MAIS-20260102.md`
- **Quick Reference:** `prisma-upgrade-quick-reference-MAIS-20260102.md`
- **Upgrade Checklist:** `prisma-upgrade-checklist-MAIS-20260102.md`
- **JSON Type Changes:** `prisma-7-json-type-breaking-changes-MAIS-20260102.md`

## Getting Help

If you're stuck:

1. **Check logs:** Render/Vercel dashboard → Logs tab
2. **Look for patterns:** Is error about module, types, or build timeout?
3. **Run locally:** Reproduce the error locally first
4. **Check related docs:** Review the 4 Prisma guides above
5. **Escalate:** If still stuck, share logs and error message in Slack

---

**Remember:** The most common issue is local cache masking the problem. Always test with `rm -rf node_modules` before claiming your fix works.
