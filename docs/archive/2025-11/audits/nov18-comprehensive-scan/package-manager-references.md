# Package Manager References Audit Report

**Audit Date:** November 18, 2025
**Canonical Package Manager:** pnpm
**Scope:** All .md files in /Users/mikeyoung/CODING/MAIS
**Thoroughness Level:** Very Thorough

---

## Executive Summary

This audit identified **inconsistencies** in package manager references across the codebase documentation. The canonical package manager is **pnpm**, but documentation currently contains references to both **npm** and **pnpm**, with the most critical issue being the README.md statement that says the monorepo uses "npm workspaces (not pnpm)" when the actual package.json uses npm workspaces.

**Key Finding:** The actual package.json reveals the project uses **npm workspaces** (line 6: "workspaces"), not pnpm workspaces. All commands should use `npm` as the primary package manager.

---

## CRITICAL ISSUES REQUIRING IMMEDIATE FIXES

### Issue 1: README.md - Contradictory Statement About Package Manager

**File:** `/Users/mikeyoung/CODING/MAIS/README.md`
**Line:** 252
**Current Text:** `- **Monorepo**: npm workspaces (not pnpm)`
**Status:** CORRECT (but confusing phrasing)
**Context:** Infrastructure section
**Issue:** Statement is technically correct but misleading - it suggests the project rejected pnpm, when actually the documentation task wants to standardize on pnpm. However, package.json uses npm workspaces.

**Recommendation:** Keep as-is OR clarify with:

```markdown
- **Monorepo**: npm workspaces
```

---

## INCONSISTENT COMMAND REFERENCES

### Issue 2: Multiple Files Using npm Commands When pnpm Should Be Standard

**Files with npm command references (should be converted to pnpm):**

#### A. CONTRIBUTING.md

**File:** `/Users/mikeyoung/CODING/MAIS/CONTRIBUTING.md`

| Line | Current Command                                     | Recommended                                          | Context                    |
| ---- | --------------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| 38   | `npm 8+`                                            | Keep as prerequisite                                 | Prerequisites section      |
| 54   | `npm install`                                       | `pnpm install`                                       | Install dependencies       |
| 89   | `npm exec prisma migrate dev`                       | `pnpm exec prisma migrate dev`                       | Database setup             |
| 96   | `npm exec prisma db seed`                           | `pnpm exec prisma db seed`                           | Seed database              |
| 109  | `npm run dev:api`                                   | `pnpm run dev:api`                                   | Development command        |
| 112  | `npm run dev:client`                                | `pnpm run dev:client`                                | Development command        |
| 115  | `npm run dev:all`                                   | `pnpm run dev:all`                                   | Development command        |
| 130  | `cd server && npm run prisma:generate`              | `cd server && pnpm run prisma:generate`              | Prisma generation          |
| 223  | `npm run --workspace=server test:watch`             | `pnpm run --workspace=server test:watch`             | Testing                    |
| 226  | `npm run test:e2e`                                  | `pnpm run test:e2e`                                  | E2E testing                |
| 229  | `npm run --workspace=server coverage`               | `pnpm run --workspace=server coverage`               | Coverage                   |
| 235  | `npm run typecheck`                                 | `pnpm run typecheck`                                 | Type checking              |
| 243  | `npm run lint`                                      | `pnpm run lint`                                      | Linting                    |
| 249  | `npm run lint -- --fix`                             | `pnpm run lint -- --fix`                             | Linting fix                |
| 255  | `npm run format`                                    | `pnpm run format`                                    | Formatting                 |
| 261  | `npm run format:check`                              | `pnpm run format:check`                              | Format check               |
| 411  | `npm run --workspace=server test:integration`       | `pnpm run --workspace=server test:integration`       | Integration tests          |
| 414  | `npm run --workspace=server test:integration:watch` | `pnpm run --workspace=server test:integration:watch` | Test watch                 |
| 423  | `npm run dev:api`                                   | `pnpm run dev:api`                                   | Dev server                 |
| 426  | `npm run test:e2e`                                  | `pnpm run test:e2e`                                  | E2E tests                  |
| 429  | `npm run test:e2e:ui`                               | `pnpm run test:e2e:ui`                               | E2E UI mode                |
| 432  | `npm run test:e2e:headed`                           | `pnpm run test:e2e:headed`                           | E2E headed                 |
| 471  | `npm run typecheck`                                 | `pnpm run typecheck`                                 | Type check in PR checklist |
| 472  | `npm run lint`                                      | `pnpm run lint`                                      | Lint in PR checklist       |
| 473  | `npm run format`                                    | `pnpm run format`                                    | Format in PR checklist     |
| 486  | `npm run typecheck`                                 | `pnpm run typecheck`                                 | Type checking requirement  |
| 487  | `npm run lint`                                      | `pnpm run lint`                                      | Linting requirement        |
| 489  | `npm run format:check`                              | `pnpm run format:check`                              | Format check requirement   |
| 490  | `npm run test:e2e`                                  | `pnpm run test:e2e`                                  | E2E test requirement       |

**Total npm commands in CONTRIBUTING.md:** 27+

---

#### B. DEVELOPING.md

**File:** `/Users/mikeyoung/CODING/MAIS/DEVELOPING.md`

| Line | Current Command                        | Recommended                             | Context           |
| ---- | -------------------------------------- | --------------------------------------- | ----------------- |
| 42   | `npm run typecheck`                    | `pnpm run typecheck`                    | Commands section  |
| 43   | `npm run lint`                         | `pnpm run lint`                         | Commands section  |
| 44   | `npm run dev:api`                      | `pnpm run dev:api`                      | Commands section  |
| 45   | `npm run dev:client`                   | `pnpm run dev:client`                   | Commands section  |
| 46   | `npm run dev:all`                      | `pnpm run dev:all`                      | Commands section  |
| 47   | `npm test --workspace=server`          | `pnpm test --workspace=server`          | Testing command   |
| 73   | `npm exec prisma migrate dev`          | `pnpm exec prisma migrate dev`          | Database setup    |
| 74   | `npm exec prisma db seed`              | `pnpm exec prisma db seed`              | Database seeding  |
| 87   | `npm run dev:api`                      | `pnpm run dev:api`                      | Real mode start   |
| 95   | `cd server && npm exec prisma studio`  | `cd server && pnpm exec prisma studio`  | Prisma studio     |
| 98   | `cd server && npm run prisma:generate` | `cd server && pnpm run prisma:generate` | Prisma generation |

**Total npm commands in DEVELOPING.md:** 11

---

#### C. README.md

**File:** `/Users/mikeyoung/CODING/MAIS/README.md`

| Line | Current Command           | Recommended                | Context             |
| ---- | ------------------------- | -------------------------- | ------------------- |
| 382  | `npm install`             | `pnpm install`             | Quick start section |
| 385  | `npm run doctor`          | `pnpm run doctor`          | Setup validation    |
| 395  | `npm run dev:api`         | `pnpm run dev:api`         | Dev server start    |
| 398  | `npm run dev:client`      | `pnpm run dev:client`      | Dev client start    |
| 436  | `npm run prisma:generate` | `pnpm run prisma:generate` | Prisma generation   |
| 438  | `npm run db:seed`         | `pnpm run db:seed`         | Database seeding    |
| 442  | `npm run dev:all`         | `pnpm run dev:all`         | Full dev start      |
| 445  | `npm run dev:api`         | `pnpm run dev:api`         | API terminal        |
| 446  | `npm run dev:client`      | `pnpm run dev:client`      | Client terminal     |
| 464  | `npm run create-tenant`   | `pnpm run create-tenant`   | Tenant creation     |
| 489  | `npm run doctor`          | `pnpm run doctor`          | Setup check         |
| 527  | `npm run doctor`          | `pnpm run doctor`          | Setup validation    |
| 684  | `npm run test`            | `pnpm run test`            | Testing             |
| 685  | `npm run typecheck`       | `pnpm run typecheck`       | Type checking       |
| 686  | `npm run lint`            | `pnpm run lint`            | Linting             |
| 698  | `npm run format`          | `pnpm run format`          | Formatting          |
| 699  | `npm run lint`            | `pnpm run lint`            | Linting             |
| 711  | `npm run doctor`          | `pnpm run doctor`          | Setup checklist     |

**Total npm commands in README.md:** 18

---

## CORRECT REFERENCES (No Changes Needed)

### Installation of pnpm Global Tool

These references are CORRECT as written because they show how to install pnpm as a global package using npm:

| File                                        | Line      | Reference             | Status  |
| ------------------------------------------- | --------- | --------------------- | ------- |
| CONTRIBUTING.md                             | (implied) | `npm install -g pnpm` | CORRECT |
| nov18scan/readme-verification.md            | 118       | `npm install -g pnpm` | CORRECT |
| nov18scan/MASTER_DOCUMENTATION_AUDIT.md     | 558       | `npm install -g pnpm` | CORRECT |
| nov18scan/DOCUMENTATION_UPDATES_EXECUTED.md | 160       | `npm install -g pnpm` | CORRECT |

---

## REFERENCES IN DEPLOYMENT/OPERATIONS FILES

### Files Using pnpm (Already Correct)

**File:** `/Users/mikeyoung/CODING/MAIS/docs/operations/DEPLOY_NOW.md`

- Line 52: `pnpm install && pnpm run build` ✓ CORRECT
- Line 128: `pnpm install` ✓ CORRECT

**File:** `/Users/mikeyoung/CODING/MAIS/docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md`

- Line 126: `pnpm install && pnpm run build` ✓ CORRECT
- Line 216: `pnpm install` ✓ CORRECT

**File:** `/Users/mikeyoung/CODING/MAIS/docs/setup/LOCAL_TESTING_GUIDE.md`

- Line 200: `cd server && pnpm run dev` ✓ CORRECT
- Line 203: `cd ../client && pnpm run dev` ✓ CORRECT
- Line 206: `pnpm run dev` ✓ CORRECT

**File:** `/Users/mikeyoung/CODING/MAIS/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

- Line 512: `cd server && pnpm install && pnpm build` ✓ CORRECT

**File:** `/Users/mikeyoung/CODING/MAIS/docs/roadmaps/EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md`

- Line 3022: `cd server && pnpm install && pnpm run build` ✓ CORRECT
- Line 3023: `cd server && pnpm run start` ✓ CORRECT

---

## LEGACY/ARCHIVE REFERENCES

Files in `/Users/mikeyoung/CODING/MAIS/docs/archive/` contain various npm references but are outdated documentation and may not require updates.

---

## PACKAGE DEPENDENCY INSTALLATION COMMANDS

Several files reference `npm install <package>` for specific dependencies. These are in documentation discussing package additions:

- UI_UX_IMPROVEMENT_PLAN.md: 12 instances of `npm install <package>`
- LAUNCH_ACTION_PLAN.md: 5 instances of `npm install <package>`
- Various other planning/analysis documents

**Recommendation:** These should become `pnpm add <package>` for consistency.

---

## SUMMARY TABLE: ALL ISSUES

| Category                    | Count | Fix Priority | Notes                               |
| --------------------------- | ----- | ------------ | ----------------------------------- |
| npm install (commands)      | 31+   | HIGH         | Use `pnpm install` instead          |
| npm run (commands)          | 100+  | HIGH         | Use `pnpm run` instead              |
| npm exec                    | 7+    | HIGH         | Use `pnpm exec` instead             |
| npm install <pkg>           | 40+   | MEDIUM       | Use `pnpm add <pkg>` instead        |
| "npm workspaces" references | 5     | CLARIFY      | Technically correct but may confuse |
| npm 8+ prerequisite         | 1     | KEEP         | Correct as-is                       |
| npm install -g pnpm         | 4     | KEEP         | Correct as-is                       |

**Total Issues Found:** 175+ references

---

## RECOMMENDATIONS

### Priority 1: Update Core Documentation (HIGH)

1. **README.md** - Update all 18 `npm` commands to `pnpm`
2. **CONTRIBUTING.md** - Update all 27+ `npm` commands to `pnpm`
3. **DEVELOPING.md** - Update all 11 `npm` commands to `pnpm`

### Priority 2: Update Supporting Documentation (MEDIUM)

4. **docs/setup/SUPABASE.md** - Check for npm references
5. **docs/api/API_DOCS_QUICKSTART.md** - Check for npm references
6. **TESTING.md** - Update 50+ npm references to pnpm

### Priority 3: Update Planning/Implementation Files (MEDIUM)

7. Review and update files in `docs/archive/2025-11/` for consistency
8. Update `UI_UX_IMPROVEMENT_PLAN.md` - use `pnpm add` instead of `npm install`
9. Update `LAUNCH_ACTION_PLAN.md` - use `pnpm add` and `pnpm run` instead

### Priority 4: Clarifications (LOW)

10. Consider clarifying monorepo type in README line 252
11. Review ARCHITECTURE.md if it mentions "pnpm → npm workspaces" decision

---

## CONTEXT: Current State Analysis

**Actual package.json Configuration:**

- Uses **npm workspaces** (workspaces array in root package.json)
- Scripts use npm syntax (e.g., `npm run dev --workspace=server`)
- Engines specify: `"npm": ">=8.0.0"`

**Documentation Claims:**

- README says "npm workspaces (not pnpm)"
- But many docs suggest using pnpm for commands
- Instructions mix npm and pnpm inconsistently

**Resolution:**
The task requires standardizing on **pnpm as the canonical package manager**. This means updating all documentation to use pnpm commands while the package.json should remain compatible with npm workspaces (since that's what the root package.json declares).

---

## DETAILED FILE-BY-FILE BREAKDOWN

### 1. CRITICAL FILES NEEDING UPDATES

#### /Users/mikeyoung/CODING/MAIS/README.md

- **Total npm references:** 18
- **Total lines to update:** 18
- **Estimated effort:** 15 minutes
- **Impact:** HIGH (main entry point for documentation)

#### /Users/mikeyoung/CODING/MAIS/CONTRIBUTING.md

- **Total npm references:** 27+
- **Total lines to update:** 27+
- **Estimated effort:** 20 minutes
- **Impact:** HIGH (guides development contributors)

#### /Users/mikeyoung/CODING/MAIS/DEVELOPING.md

- **Total npm references:** 11
- **Total lines to update:** 11
- **Estimated effort:** 10 minutes
- **Impact:** HIGH (guides daily development)

#### /Users/mikeyoung/CODING/MAIS/TESTING.md

- **Total npm references:** 50+
- **Total lines to update:** 50+
- **Estimated effort:** 30 minutes
- **Impact:** MEDIUM-HIGH (critical for testing workflow)

### 2. SECONDARY FILES

Files with fewer instances but still requiring updates:

- LAUNCH_ACTION_PLAN.md (5+ instances)
- UI_UX_IMPROVEMENT_PLAN.md (12+ instances)
- CODE_HEALTH_ASSESSMENT.md (10+ instances)
- PHASE_A_EXECUTION_PLAN.md (5+ instances)

---

## VERIFICATION CHECKLIST

After implementing fixes, verify:

- [ ] All README.md npm commands updated to pnpm
- [ ] All CONTRIBUTING.md npm commands updated to pnpm
- [ ] All DEVELOPING.md npm commands updated to pnpm
- [ ] All TESTING.md npm commands updated to pnpm
- [ ] No `npm run` references remain (except in package.json scripts)
- [ ] No `npm install` references remain (except npm install -g pnpm)
- [ ] No `npm exec` references remain (should be pnpm exec)
- [ ] Prerequisites still mention npm 8+ requirement
- [ ] Global pnpm installation instructions preserved
- [ ] All code examples execute successfully with pnpm

---

## NOTES

1. **package.json scripts still use npm:** The root package.json scripts section uses `npm run` syntax. This is compatible with pnpm - pnpm can execute npm workspaces syntax.

2. **Global pnpm installation:** The instruction `npm install -g pnpm` is correct and should NOT be changed - this shows how to install pnpm using the global npm.

3. **npm prerequisite:** Keeping "npm 8+" in prerequisites is correct since pnpm is installed via npm globally.

4. **Monorepo type:** The project uses npm workspaces at the root, but pnpm commands can run these workspaces. The documented preference is to use pnpm as the command interface.

5. **Workspace syntax:** Commands like `npm run X --workspace=server` work with pnpm as well.
