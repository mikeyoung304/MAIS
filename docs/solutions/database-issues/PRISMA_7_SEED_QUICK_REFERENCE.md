---
title: 'Prisma 7 Seed Quick Reference'
category: database-issues
severity: P1
status: active
date_created: 2026-01-05
tags:
  - prisma
  - prisma-7
  - quick-reference
  - seed-scripts
  - cheat-sheet
---

# Prisma 7 Seed Quick Reference (Print & Pin)

**Read this first when seed scripts fail. Full guide: `prisma-7-seed-upgrade-prevention-strategies-MAIS-20260105.md`**

---

## 30-Second Diagnostic

```bash
# 1. Barrel file exists?
ls server/src/generated/prisma/index.ts

# 2. Env vars loaded?
echo "DATABASE_URL: $DATABASE_URL"

# 3. Types valid?
npm run typecheck

# 4. Imports valid?
node server/scripts/validate-prisma-imports.js

# 5. Build succeeds?
npm run build

# 6. Seed runs?
SEED_MODE=e2e npm run db:seed
```

---

## Common Errors & Fixes

| Error                                             | Cause                      | Fix                                     |
| ------------------------------------------------- | -------------------------- | --------------------------------------- |
| `Cannot find module 'src/generated/prisma'`       | Missing barrel file        | `npm run prisma:postgenerate`           |
| `DATABASE_URL environment variable is required`   | dotenv not loaded          | Add `import 'dotenv/config'` to seed.ts |
| `Type 'null' is not assignable to InputJsonValue` | Prisma 7 strict JSON types | Use `undefined` not `null`              |
| Seed hangs/times out                              | Connection exhaustion      | Use `DIRECT_URL` for migrations         |
| TypeScript won't compile                          | Stale import paths         | `npm run prisma:generate`               |

---

## Seed Execution Order

```typescript
1. import 'dotenv/config'              ← Load env vars FIRST
2. import { createPrismaClient }       ← Import factory AFTER env
3. const prisma = createPrismaClient() ← Create with env vars
4. await seedPlatform(prisma)          ← Run seeds
5. prisma.$disconnect()                ← Always disconnect
```

---

## File Locations

| Purpose              | File                                        |
| -------------------- | ------------------------------------------- |
| Seed orchestrator    | `server/prisma/seed.ts`                     |
| PrismaClient factory | `server/src/lib/prisma.ts`                  |
| Individual seeds     | `server/prisma/seeds/*.ts`                  |
| Prisma config        | `server/prisma.config.ts`                   |
| Post-generate script | `server/scripts/prisma-postgenerate.js`     |
| Import validator     | `server/scripts/validate-prisma-imports.js` |

---

## Run Commands

```bash
# Generate Prisma client + barrel file
npm run prisma:generate

# Validate imports after generation
node server/scripts/validate-prisma-imports.js

# Run seeds (auto-detects mode from NODE_ENV or SEED_MODE)
npm run db:seed

# Run specific seed
SEED_MODE=e2e npm run db:seed
SEED_MODE=demo npm run db:seed

# View database visually
npm exec prisma studio

# Type check
npm run typecheck

# Build
npm run build
```

---

## Critical Prisma 7 Changes

| Item            | Prisma 6                        | Prisma 7                            | Impact                  |
| --------------- | ------------------------------- | ----------------------------------- | ----------------------- |
| Generated entry | `src/generated/prisma/index.ts` | `src/generated/prisma/client.ts`    | Need barrel file        |
| Client init     | `new PrismaClient()`            | `new PrismaClient({ adapter })`     | Driver adapter required |
| Database URL    | In `schema.prisma`              | In `prisma.config.ts`               | Update config file      |
| JSON types      | Loose                           | Strict (null vs undefined)          | Update seed data        |
| Env loading     | Auto-loaded                     | Manual via `import 'dotenv/config'` | Load early in seed      |

---

## Pre-Upgrade Checklist

- [ ] Document current Prisma version
- [ ] Check changelog for breaking changes
- [ ] Scan codebase for import patterns
- [ ] Run full test suite before upgrade
- [ ] Test seed with E2E mode after upgrade

---

## Post-Upgrade Checklist

- [ ] `npm run prisma:generate` succeeds
- [ ] Barrel file exists: `ls server/src/generated/prisma/index.ts`
- [ ] `npm run typecheck` passes
- [ ] Import validator passes: `node scripts/validate-prisma-imports.js`
- [ ] `npm run build` succeeds
- [ ] `SEED_MODE=e2e npm run db:seed` succeeds

---

## Deployment Verification

- [ ] Env vars set: `DATABASE_URL`, `DIRECT_URL`
- [ ] Build command uses `npm run prisma:generate`, not `npx prisma generate`
- [ ] Render.yaml has both `DATABASE_URL` and `DIRECT_URL`
- [ ] Seed completes without timeout
- [ ] Database has expected data

---

**Remember:** Seed failures are usually one of 5 things:

1. Missing barrel file → Run postgenerate script
2. Missing env var → Check dotenv loading order
3. Wrong import path → Run import validator
4. Type mismatch → Use `undefined` not `null`
5. No connection → Check `DATABASE_URL`
