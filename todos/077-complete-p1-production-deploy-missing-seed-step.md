---
status: complete
priority: p1
issue_id: "077"
tags: [ci-cd, code-review, deployment, production]
dependencies: []
resolution: "Already fixed - Production seed step exists at deploy-production.yml:332-337"
completed_date: "2025-11-30"
---

# P1: Production Deployment Missing Seed Step

## Problem Statement

The production deployment workflow runs migrations but **does not seed the platform admin user**. A fresh production database will have zero users, making the admin panel inaccessible.

**Why it matters:**
- Production lockout: No way to access admin panel after fresh deploy
- Manual intervention required: SSH into database to create user
- Security risk: Rushed manual user creation bypasses validation

## Findings

**Location:** `.github/workflows/deploy-production.yml`

```yaml
# Current state
- name: Run database migrations
  run: npx prisma migrate deploy --schema=./server/prisma/schema.prisma
  # Missing: npm run db:seed:production
```

**Expected:**
```yaml
- name: Seed production database (platform admin only)
  run: npm run --workspace=server db:seed:production
  env:
    DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
    SEED_MODE: production
    ADMIN_EMAIL: ${{ secrets.PRODUCTION_ADMIN_EMAIL }}
    ADMIN_DEFAULT_PASSWORD: ${{ secrets.PRODUCTION_ADMIN_PASSWORD }}
```

## Proposed Solutions

### Solution A: Add seed step after migrations (Recommended)
**Pros:** Automated, consistent, secure
**Cons:** Requires GitHub secrets setup
**Effort:** Small (20 min)
**Risk:** Low

```yaml
- name: Run database migrations
  run: npx prisma migrate deploy

- name: Seed production database
  run: npm run --workspace=server db:seed:production
  env:
    DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
    ADMIN_EMAIL: ${{ secrets.PRODUCTION_ADMIN_EMAIL }}
    ADMIN_DEFAULT_PASSWORD: ${{ secrets.PRODUCTION_ADMIN_PASSWORD }}

- name: Verify admin user created
  run: |
    psql $DATABASE_URL -c "SELECT email, role FROM \"User\" WHERE role = 'PLATFORM_ADMIN';"
```

### Solution B: Manual seed after first deploy
**Pros:** No CI changes needed
**Cons:** Manual process, easy to forget
**Effort:** None
**Risk:** High (human error)

Document in runbook: "After first production deploy, run seed manually."

### Solution C: App-level bootstrap on startup
**Pros:** Self-healing, no CI changes
**Cons:** Credentials in env vars at runtime
**Effort:** Medium (1 hour)
**Risk:** Medium

```typescript
// app.ts startup
if (await prisma.user.count({ where: { role: 'PLATFORM_ADMIN' } }) === 0) {
  await seedPlatform(prisma);
}
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `.github/workflows/deploy-production.yml`

**Components:**
- Production deployment job
- Database setup steps

**Database Changes:** Creates platform admin user

**Required Secrets:**
- `PRODUCTION_ADMIN_EMAIL`
- `PRODUCTION_ADMIN_PASSWORD`

## Acceptance Criteria

- [ ] Production deployment creates platform admin user
- [ ] Admin can log in after fresh deployment
- [ ] Seed is idempotent (safe to re-run)
- [ ] Pipeline logs show seed execution
- [ ] Verification step confirms admin exists

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | Fresh prod deploy = no users = lockout |

## Resources

- **Code Review:** Seed system refactoring review
- **Pipeline:** `.github/workflows/deploy-production.yml`
- **Seed:** `server/prisma/seeds/platform.ts`
