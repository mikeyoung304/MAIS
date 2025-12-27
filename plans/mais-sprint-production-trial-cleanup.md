# MAIS Sprint: Production Fix + Free Trial Verification + Cleanup

**Created:** 2025-12-27
**Updated:** 2025-12-27 (post-review simplification)
**Status:** Ready for Implementation
**Estimated Time:** 2-3 hours (simplified from 5-7 hours)

## Overview

Three tasks to get MAIS production-ready:

1. **Task 3: Clean Up Uncommitted Files** (15 min) - Clean slate first
2. **Task 1: Seed MAIS Tenant to Production** (30 min) - Fix 404 on `/t/mais`
3. **Task 2: Smoke Test Free Trial System** (1-2 hours) - Verify it works

---

## Task 3: Clean Up Uncommitted Files (First)

**Effort:** 15 minutes

### Execution

```bash
# Archive meta-doc
mkdir -p docs/archive/2025-12
mv docs/solutions/RESOLUTION-SUMMARY-20251226.md docs/archive/2025-12/

# Make script executable BEFORE staging (Kieran fix)
chmod +x scripts/verify-nextjs-build.sh

# Stage everything at once (Simplicity fix)
git add docs/ plans/ scripts/ CLAUDE.md apps/web/.eslintrc.cjs apps/web/vercel.json package.json server/src/agent/tools/write-tools.ts

# Commit
git commit -m "$(cat <<'EOF'
chore: add Next.js docs, deployment guides, and config updates

- Add comprehensive Next.js 14 patterns and quick reference
- Add ISR revalidation decision tree
- Add agent security solutions documentation
- Add Vercel monorepo deployment prevention guide
- Add MAIS Tenant Zero dogfooding plan
- Add pre-deployment verification script
- Update project configuration files

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Success Criteria

- [ ] `git status` shows clean working directory

---

## Task 1: Seed MAIS Tenant to Production

**Effort:** 30 minutes

### Steps

```bash
# 1. BACKUP FIRST (Kieran critical addition)
pg_dump $PRODUCTION_DATABASE_URL > backup-pre-mais-seed-$(date +%Y%m%d-%H%M%S).sql

# 2. Check if tenant already exists
psql $PRODUCTION_DATABASE_URL -c "SELECT slug, name FROM \"Tenant\" WHERE slug = 'mais';"

# 3. Run MAIS seed
cd server
SEED_MODE=mais DATABASE_URL=$PRODUCTION_DATABASE_URL npm exec prisma db seed

# 4. Verify
curl -I https://mais.vercel.app/t/mais
# Expected: HTTP 200

curl -I https://mais.vercel.app/
# Expected: HTTP 308 redirect to /t/mais
```

### If Rollback Needed

```bash
psql $PRODUCTION_DATABASE_URL < backup-pre-mais-seed-XXXXXXXX.sql
```

### Success Criteria

- [ ] `https://mais.vercel.app/t/mais` returns 200 with MAIS storefront
- [ ] `https://mais.vercel.app/` redirects to `/t/mais`

---

## Task 2: Smoke Test Free Trial System

**Effort:** 1-2 hours (simplified from 4-6 hours per DHH feedback)

### Current State

The trial system is ~90% complete. All components exist:
- Database schema ✅
- Backend endpoints ✅
- Stripe adapter ✅
- Webhook handler ✅
- Frontend components ✅

### Remaining Configuration

1. **Stripe Dashboard:** Create Product "MAIS Club Membership" → Price $99/month
2. **Environment:** Add `STRIPE_SUBSCRIPTION_PRICE_ID=price_xxx` to `.env`

### Smoke Test (DHH approach)

```bash
# Start everything
npm run dev:api &
stripe listen --forward-to localhost:3001/v1/webhooks/stripe &
cd apps/web && npm run dev &

# Manual flow:
# 1. Sign up as new tenant
# 2. Create a package
# 3. Click "Start Free Trial"
# 4. Verify TrialBanner shows countdown
# 5. Click "Upgrade" → Stripe Checkout
# 6. Pay with 4242 4242 4242 4242
# 7. Verify "Active Subscription" in billing page

# If all green → ship it
# If something fails → investigate then
```

### Success Criteria

- [ ] Trial start works, banner shows countdown
- [ ] Stripe Checkout redirects and completes
- [ ] Webhook updates status to ACTIVE

### Key Files (reference only)

| File | Purpose |
|------|---------|
| `server/src/routes/tenant-admin.routes.ts` | Trial endpoints |
| `server/src/routes/tenant-admin-billing.routes.ts` | Billing endpoints |
| `apps/web/src/components/trial/StartTrialCard.tsx` | Start trial UI |
| `apps/web/src/components/trial/TrialBanner.tsx` | Trial countdown UI |

---

## Post-Deployment Verification (Kieran addition)

After deploying, verify production webhook:

```bash
# Check webhook is configured in Stripe Dashboard
stripe webhooks list --limit 5
# Look for endpoint: https://your-domain.com/v1/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

---

## Review Feedback Applied

| Reviewer | Key Changes Applied |
|----------|---------------------|
| **DHH** | Reduced Task 2 from 4-6 hours to 1-2 hour smoke test |
| **DHH** | Removed Risk Assessment table |
| **DHH** | Removed duplicate Verification Commands section |
| **Kieran** | Added database backup step before production seeding |
| **Kieran** | Fixed chmod ordering (before git add) |
| **Kieran** | Added post-deployment webhook verification |
| **Simplicity** | Removed Section 2.2 (API route mapping) - covered by smoke test |
| **Simplicity** | Removed Section 2.4 (E2E tests) - YAGNI for MVP |
| **Simplicity** | Combined git add into single command |

---

## Notes

- The free trial system is **substantially complete** - this is verification, not development
- If smoke test fails, investigate then - don't pre-plan investigation
- Backup exists if production seeding needs rollback
