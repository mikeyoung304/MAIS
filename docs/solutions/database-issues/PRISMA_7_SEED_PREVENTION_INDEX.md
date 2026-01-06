---
title: 'Prisma 7 Seed Prevention Index'
category: database-issues
severity: P1
status: active
date_created: 2026-01-05
tags:
  - prisma
  - prisma-7
  - seed-scripts
  - prevention-index
  - index
---

# Prisma 7 Seed Prevention Index

Complete prevention strategy for Prisma 7 seed script failures. This index guides you through the documentation and provides quick access to specific issues.

**Use this to navigate:** Which issue are you experiencing?

---

## 🚀 Quick Navigation

### I need to...

| Goal                                   | Document                                                | Time   |
| -------------------------------------- | ------------------------------------------------------- | ------ |
| Understand all 5 prevention strategies | [Full Prevention Strategies](#full-prevention-guide)    | 20 min |
| Quickly fix seed failure               | [Quick Reference](#quick-reference-print--pin)          | 2 min  |
| Diagnose specific error                | [Troubleshooting Error Map](#troubleshooting-error-map) | 5 min  |
| Run comprehensive test                 | [Test Suite](#run-comprehensive-test-suite)             | 5 min  |
| Prepare before Prisma upgrade          | [Pre-Upgrade Checklist](#before-upgrade)                | 10 min |
| Deploy seed scripts to production      | [Deployment Checklist](#deployment-verification)        | 15 min |

---

## 📚 Documentation Structure

### Main Documents

#### 1. **Full Prevention Guide**

**File:** `prisma-7-seed-upgrade-prevention-strategies-MAIS-20260105.md`

Comprehensive prevention strategies covering:

- **Strategy 1:** Pre-upgrade checklist (what to validate before major upgrades)
- **Strategy 2:** Import path validation (detect stale imports after `prisma generate`)
- **Strategy 3:** Factory pattern enforcement (centralize PrismaClient creation)
- **Strategy 4:** Dotenv loading order (ensure env vars load before Prisma operations)
- **Strategy 5:** Test commands (quick verification after Prisma upgrades)

**When to read:** Before upgrading Prisma or implementing seed infrastructure

**Key sections:**

- Breaking changes in Prisma 7 (table)
- Validation script (`validate-prisma-imports.js`)
- Factory pattern (`createPrismaClient()`)
- Dotenv loading order
- Test command reference

#### 2. **Quick Reference (Print & Pin)**

**File:** `PRISMA_7_SEED_QUICK_REFERENCE.md`

2-minute reference guide with:

- 30-second diagnostic commands
- Common errors and fixes (table)
- Execution order diagram
- File locations
- Run commands
- Pre/post-upgrade checklists
- Deployment verification

**When to read:** When seed scripts fail - diagnose in <2 min

**Key content:**

- Error → cause → fix matrix
- Diagnostic bash commands
- File location reference
- Pre/post-upgrade checklists

### Supporting Scripts

#### 3. **Comprehensive Test Suite**

**File:** `server/scripts/test-seed-upgrade.sh`

Automated validation of all 7 seed components:

```bash
bash server/scripts/test-seed-upgrade.sh
```

Tests:

1. Prisma client generation + barrel file
2. Import path validation
3. TypeScript type checking
4. Build process
5. Environment variable setup
6. Seed execution (E2E mode)
7. Database verification

**When to run:** After Prisma upgrades, before deployment, or when debugging

**Output:** Color-coded pass/fail for each component

---

## 🔍 Troubleshooting Error Map

### Error: "Cannot find module 'src/generated/prisma'"

**Root cause:** Barrel file missing after `prisma generate`

**Prisma 7 breaking change:** Entry point changed from `index.ts` to `client.ts`

**Solution:**

```bash
npm run prisma:postgenerate
ls server/src/generated/prisma/index.ts
```

**Related documents:**

- Prevention Strategy 2: Import Path Validation
- Related ADR: `docs/solutions/build-errors/prisma-7-entry-point-barrel-file-build-fix-MAIS-20260102.md`

---

### Error: "DATABASE_URL environment variable is required"

**Root cause:** Dotenv not loaded before PrismaClient creation

**Prisma 7 breaking change:** Environment variables no longer auto-loaded

**Solution:**

```typescript
// Add to top of seed.ts
import 'dotenv/config';
```

**Related documents:**

- Prevention Strategy 4: Dotenv Loading Order
- Check: `server/prisma/seed.ts` line 25

---

### Error: "Type 'null' is not assignable to type 'InputJsonValue'"

**Root cause:** Prisma 7 stricter JSON field types

**Prisma 7 breaking change:** Strict JSON type validation

**Solution:** Use `undefined` instead of `null` for optional JSON fields

```typescript
// BEFORE
data: {
  metadata: null;
}

// AFTER
data: {
  metadata: undefined;
}
```

**Related documents:**

- `docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md`
- `docs/solutions/database-issues/prisma-json-quick-reference-MAIS-20260102.md`

---

### Error: "Seed hangs/times out"

**Root causes:** Connection pooling exhausted or incorrect connection string

**Solutions:**

1. Check connections: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_stat_activity;"`
2. Use correct URLs:
   - `DATABASE_URL` = Session Pooler (port 5432)
   - `DIRECT_URL` = Transaction Pooler (port 6543)
3. Add timeout: `export PGCONNECT_TIMEOUT=5`

**Related documents:**

- Prevention Strategy 4: Environment variables
- `docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md`

---

### Error: TypeScript won't compile after upgrade

**Root causes:**

1. Stale import paths
2. JSON type mismatches
3. Missing barrel file

**Solution:**

```bash
npm run prisma:generate    # Fix stale paths + barrel file
npm run typecheck          # Check types
npm run build              # Full build
```

**Related documents:**

- Prevention Strategy 1: Pre-upgrade checklist
- Prevention Strategy 2: Import validation

---

## ✅ Before Upgrade

**Estimated time:** 10 minutes

Use Strategy 1: Pre-Upgrade Checklist

1. [ ] Document current import patterns

   ```bash
   grep -r "from.*prisma" --include="*.ts" server/src/ | sort | uniq
   ```

2. [ ] Check Prisma changelog for breaking changes
   - Visit: https://github.com/prisma/prisma/releases

3. [ ] Verify current Prisma version

   ```bash
   npm list prisma @prisma/client @prisma/adapter-pg
   ```

4. [ ] Run full test suite

   ```bash
   npm test
   ```

5. [ ] Test current seed
   ```bash
   SEED_MODE=e2e npm run db:seed
   ```

---

## 🔧 During Upgrade

1. Update Prisma versions in `package.json`:

   ```json
   {
     "dependencies": {
       "@prisma/client": "^7.2.0",
       "@prisma/adapter-pg": "^7.2.0",
       "prisma": "^7.2.0"
     }
   }
   ```

2. Run `npm install`

3. Update `prisma.config.ts` if needed (check schema)

4. Generate new client:

   ```bash
   npm run prisma:generate
   ```

5. Verify barrel file:
   ```bash
   ls server/src/generated/prisma/index.ts
   ```

---

## ✨ After Upgrade

**Estimated time:** 15 minutes

Use comprehensive test suite:

```bash
bash server/scripts/test-seed-upgrade.sh
```

Or manual verification:

1. [ ] `npm run typecheck` passes
2. [ ] `npm run build` succeeds
3. [ ] Imports validate: `node server/scripts/validate-prisma-imports.js`
4. [ ] Seed runs: `SEED_MODE=e2e npm run db:seed`
5. [ ] Database populated: `npm exec prisma studio`

---

## 🚀 Deployment Verification

**Estimated time:** 15 minutes

### Environment Variables

```bash
# Required variables in Render environment
DATABASE_URL=postgresql://...  # Session Pooler (port 5432)
DIRECT_URL=postgresql://...    # Transaction Pooler (port 6543)
```

### Build Command

```yaml
# Correct
buildCommand: npm ci && npm run build --workspace=@macon/api

# Wrong
buildCommand: npm ci && cd server && npx prisma generate
```

### Seed Command

```yaml
# Correct
seed: npx tsx prisma/seed.ts

# Wrong
seed: npx prisma db seed  # Missing dotenv/config import
```

### Post-Deployment

1. [ ] Check build logs for errors
2. [ ] Verify seed completed without timeout
3. [ ] Query database: `psql $DIRECT_URL -c "SELECT COUNT(*) FROM Tenant;"`
4. [ ] Check application logs: `npm exec prisma studio`

---

## 🧪 Run Comprehensive Test Suite

**Time:** 5 minutes

```bash
# From project root
bash server/scripts/test-seed-upgrade.sh
```

**What it tests:**

1. ✅ Prisma generation + barrel file
2. ✅ Import path validation
3. ✅ TypeScript compilation
4. ✅ Build process
5. ✅ Environment variables
6. ✅ Seed execution
7. ✅ Database integrity

**Output:** Color-coded results for each test

---

## 📋 Seed Files Reference

### Core Files

| File                                        | Purpose              | Responsibility                                   |
| ------------------------------------------- | -------------------- | ------------------------------------------------ |
| `server/prisma/seed.ts`                     | Main orchestrator    | Load env, determine seed mode, dispatch to seeds |
| `server/src/lib/prisma.ts`                  | PrismaClient factory | Create client with driver adapter                |
| `server/prisma.config.ts`                   | Prisma configuration | Database URLs, schema location                   |
| `server/scripts/prisma-postgenerate.js`     | Generate barrel file | Create index.ts for backward compatibility       |
| `server/scripts/validate-prisma-imports.js` | Validate imports     | Check all imports valid after generation         |
| `server/scripts/test-seed-upgrade.sh`       | Test suite           | Run comprehensive validation                     |

### Seed Modules

| File                              | Seeds               | Environment                |
| --------------------------------- | ------------------- | -------------------------- |
| `server/prisma/seeds/platform.ts` | Platform admin only | Production, staging, dev   |
| `server/prisma/seeds/demo.ts`     | Rich test data      | Development, local testing |
| `server/prisma/seeds/e2e.ts`      | Fixed test tenant   | E2E automation, CI/CD      |
| `server/prisma/seeds/handled.ts`  | Dogfooding data     | Development, testing       |

---

## 🎯 Key Insights

### Insight 1: Import Paths are Fragile

Prisma 7 changed generated entry points. Instead of updating all imports:

- Create barrel file (`index.ts`) that re-exports `client.ts`
- Post-generate script runs after `prisma generate`
- All existing imports continue working

**Prevention:** Use `npm run prisma:generate` (not `npx prisma generate`) which runs both steps.

### Insight 2: Factory Pattern Prevents Config Drift

Don't create PrismaClient in multiple places. Single factory ensures:

- Consistent adapter configuration
- Easy to test and mock
- Single point to update if Prisma changes

**Prevention:** All code uses `createPrismaClient()` from `lib/prisma.ts`

### Insight 3: Dotenv Loading is Not Implicit

Prisma 7 doesn't auto-load `.env`. Seed scripts must explicitly:

```typescript
import 'dotenv/config';
```

**Prevention:** Always load dotenv FIRST in any standalone script

### Insight 4: Validation Must Automate

Manual checks fail. Catch issues before runtime:

- Run import validator in build pipeline
- Run type check before deployment
- Run test suite after upgrades

**Prevention:** Integration into `npm run prisma:generate` and CI/CD

### Insight 5: Test Order is Critical

1. Load environment variables first
2. Generate Prisma client
3. Validate imports
4. Check TypeScript types
5. Run seed

Skipping steps in order causes silent failures.

**Prevention:** Use test suite script that enforces order

---

## 📖 Related Documentation

### Prisma 7 Breaking Changes

- `docs/solutions/build-errors/prisma-7-entry-point-barrel-file-build-fix-MAIS-20260102.md` - Barrel file fix
- `docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md` - JSON type changes
- `docs/solutions/database-issues/prisma-db-execute-supabase-migrations-MAIS-20251231.md` - Migration execution

### Related Patterns

- `docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md` - Connection pooling
- `docs/solutions/database-issues/SCHEMA_DRIFT_PREVENTION.md` - Schema management
- `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` - Migration patterns

### Deployment

- `docs/solutions/deployment-issues/prisma-upgrade-deployment-checklist-MAIS-20260102.md` - Deployment guide
- `docs/solutions/deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md` - Workspace builds

---

## 🤔 FAQ

### Q: Do I need to upgrade Prisma?

**A:** Check latest version:

```bash
npm outdated prisma @prisma/client
```

Only upgrade if you need new features or bug fixes. Breaking changes require testing.

### Q: Can I stay on Prisma 6?

**A:** Yes, but:

- Missing security updates
- Can't use new ORM features
- Eventually need to upgrade anyway

Upgrade when you have testing capacity.

### Q: Does the barrel file need to be committed?

**A:** No. It's generated by post-generate script:

```bash
npm run prisma:generate
```

Keep `src/generated/prisma/` in `.gitignore`.

### Q: What if seed still fails after tests pass?

**A:** Check:

1. Database connection (if using pooler)
2. Seed data format (JSON types)
3. Timezone/locale differences
4. Application logs for clues

Then refer to specific error in "Troubleshooting Error Map" above.

---

## ✨ Next Steps

1. **Bookmark this index** - Return here when seed issues occur
2. **Read Quick Reference** - 2-minute diagnostic guide
3. **Run Test Suite** - Validate your setup: `bash server/scripts/test-seed-upgrade.sh`
4. **Schedule Prisma upgrade** - Plan with team before starting
5. **Document custom behavior** - If you modify scripts, document changes here

---

**Status:** Active Prevention Strategies
**Last Updated:** 2026-01-05
**Applies to:** Prisma 7.2.0+, all seed scripts
**Next Review:** After next Prisma major version release
