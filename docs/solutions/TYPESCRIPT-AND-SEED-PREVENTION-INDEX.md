# TypeScript Build & Seed Configuration Prevention - Index

**Created:** 2025-12-27
**Documents:** 3 comprehensive prevention strategy documents
**Problem Scope:** TypeScript build errors + seed configuration drift
**Impact:** Blocks production deployments

---

## Documents Overview

### 1. Comprehensive Prevention Strategy

**File:** `TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md`

**Contains:**

- Problem analysis with real code examples
- 7 detailed prevention strategies
- Pre-commit hooks setup
- CI/CD validation workflows
- Unit test examples
- Quick reference checklist
- Implementation priority matrix

**When to read:** First time understanding the problem or implementing prevention

**Read time:** 30-40 minutes

---

### 2. Quick Reference (Print & Pin)

**File:** `TYPESCRIPT-BUILD-QUICK-REFERENCE.md`

**Contains:**

- When you change the database schema (quick steps)
- Property name mismatch patterns
- Enum status comparison rules
- Unused parameter fixes
- Type assertion guidelines
- Seed configuration quick fixes
- Common error messages & solutions
- Decision trees
- Files to know

**When to read:** Quick lookup while coding or during code review

**Read time:** 5-10 minutes per lookup

---

### 3. Code Review Checklist

**File:** `TYPESCRIPT-BUILD-CODE-REVIEW-CHECKLIST.md`

**Contains:**

- PR review checklist for schema changes
- PR review checklist for seed changes
- Code quality checks
- Red flags requiring change requests
- PR approval criteria
- Example review comments with suggestions
- Reviewer workflow
- Quick command reference

**When to read:** During code review of related PRs

**Read time:** 10-15 minutes per review

---

## Problem Summary

### Problem #1: TypeScript Build Errors from Property/Type Mismatches

**Recent Examples (Commit 1c9972f):**

1. Property name mismatch: `heroImageUrl` → `heroImage`
2. Type comparison mismatch: `depositPaid` vs `DEPOSIT_PAID`
3. Unused parameter: `_tenantId` parameter not referenced
4. Type assertion: Stub object cast without type guard

**Impact:** Blocks Render deployment, fails TypeScript strict mode

**Root Cause:** Disconnected sources of truth (schema changes not synchronized with code references)

---

### Problem #2: Seed Configuration Drift

**Scenario:** Seed file expects `ADMIN_EMAIL` environment variable, but actual value differs from expected

**Impact:** Manual database updates required, auth flows fail, deployment delayed

**Root Cause:** Environment variable mismatches, insufficient validation

---

## Prevention Strategies at a Glance

| Strategy                          | Effort  | Impact | Setup                    |
| --------------------------------- | ------- | ------ | ------------------------ |
| TypeScript strict mode            | ✅ Done | High   | Already enabled          |
| Pre-commit hook (prisma generate) | Low     | High   | Add to .husky/pre-commit |
| Seed env var validation           | Low     | High   | Add to platform.ts       |
| CI/CD schema consistency check    | Medium  | High   | Add to GitHub Actions    |
| Seed configuration unit tests     | Medium  | Medium | Create test file         |
| Runtime property validation       | Low     | Low    | Add to services          |
| Code review checklist             | Low     | Medium | Use in PR reviews        |

---

## Quick Implementation Roadmap

### Day 1 (30 minutes)

1. Read `TYPESCRIPT-BUILD-QUICK-REFERENCE.md`
2. Enable pre-commit hook: `.husky/pre-commit` for schema changes
3. Add env var validation to `server/prisma/seeds/platform.ts`
4. Test locally: `npm run typecheck`, seed with wrong env var

### Day 2 (1 hour)

1. Add GitHub Actions workflow for schema consistency check
2. Create `server/test/seeds/platform-seed.test.ts` with unit tests
3. Update `.env.example` with all seed requirements
4. Test the workflow by creating a draft PR

### Day 3 (30 minutes)

1. Share code review checklist with team
2. Add checklist link to PR template
3. Train team on new prevention strategies
4. Document in CLAUDE.md

---

## How to Use These Documents

### For Developers

**Before coding:**

1. Read the "Quick Reference" for current task
2. Follow the decision trees to avoid mistakes
3. Run pre-commit checks before committing

**While coding:**

1. Keep "Quick Reference" open for pattern lookup
2. Verify with `npm run typecheck` and `npm run lint`
3. If stuck, check the error message section

**During code review:**

1. Use the "Code Review Checklist"
2. Copy example review comments from the checklist
3. Request changes systematically

### For Tech Leads

**For team training:**

1. Share "Quick Reference" (print & pin)
2. Review "Code Review Checklist" with reviewers
3. Set expectations in PR template

**For process improvement:**

1. Reference implementation roadmap
2. Enable CI/CD checks gradually
3. Monitor for recurring issues

### For CI/CD

**Pre-commit:**

```bash
# From .husky/pre-commit
npm exec prisma generate
npm run typecheck
npm run lint
```

**GitHub Actions:**

```yaml
- name: TypeScript check
  run: npm run typecheck

- name: Lint
  run: npm run lint

- name: Schema consistency
  run: npm exec prisma generate && git diff --exit-code
```

---

## Key Files Modified

| File                              | Change                   | Why                          |
| --------------------------------- | ------------------------ | ---------------------------- |
| `server/prisma/schema.prisma`     | Define properties        | Source of truth for types    |
| `server/tsconfig.json`            | Strict mode              | Already enabled              |
| `.husky/pre-commit`               | Add prisma generate hook | Prevent schema drift         |
| `.env.example`                    | Add seed env vars        | Document requirements        |
| `server/prisma/seeds/platform.ts` | Add validation           | Prevent configuration errors |
| `.github/workflows/validate.yml`  | Add schema check         | CI/CD validation             |

---

## Commands Developers Need to Know

```bash
# After schema change
npm exec prisma generate
npm run typecheck
npm run lint

# Before commit
npm run build
npm test

# Check seed requirements
grep "process.env" server/prisma/seeds/platform.ts
cat .env.example

# When seed fails
export ADMIN_EMAIL=your@email.com
export ADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 32)
npm exec prisma db seed
```

---

## Common Errors & Where to Find Solutions

| Error                   | Quick Ref | Checklist | Full Docs |
| ----------------------- | --------- | --------- | --------- |
| Property does not exist | ✓         | ✓         | ✓         |
| Unused parameter        | ✓         | ✓         | ✓         |
| Type assertion issue    | ✓         | ✓         | ✓         |
| ADMIN_EMAIL mismatch    | ✓         | ✓         | ✓         |
| Enum comparison error   | ✓         | ✓         | ✓         |
| Schema drift detected   | ✓         | ✓         | ✓         |

---

## Related MAIS Documentation

These prevention strategies integrate with:

- **CLAUDE.md** - Project guidelines (multi-tenant patterns, TypeScript strict)
- **SCHEMA_DRIFT_PREVENTION.md** - Database schema migration procedures
- **PREVENTION-STRATEGIES-INDEX.md** - Full index of prevention strategies
- **QUALITY-GATES-IMPLEMENTATION.md** - CI/CD quality gates
- **PRISMA-TYPESCRIPT-BUILD-PREVENTION.md** - Detailed Prisma/TypeScript patterns

---

## Prevention Metrics

Track these to measure effectiveness:

| Metric                     | Target     | How to Track                       |
| -------------------------- | ---------- | ---------------------------------- |
| TypeScript strict errors   | 0          | `npm run typecheck`                |
| Lint errors                | 0          | `npm run lint`                     |
| Property mismatch issues   | 0          | Search for schema property changes |
| Seed configuration issues  | 0          | Monitor seed execution logs        |
| Schema regeneration misses | 0          | Git diff check in CI               |
| PR reviews finding issues  | Decreasing | Code review checklist usage        |

---

## FAQ

### Q: Do I need to read all three documents?

**A:** No. Read in this order based on your role:

- **Developers:** Quick Reference + Code Review Checklist
- **Code Reviewers:** Code Review Checklist (required)
- **DevOps/Tech Leads:** All three
- **New team members:** Quick Reference + Full Strategy

### Q: When should I run `npm exec prisma generate`?

**A:**

1. After editing `schema.prisma` (required)
2. When pulling code with schema changes (required)
3. Pre-commit hook runs it automatically
4. Safe to run any time (idempotent)

### Q: What if my seed fails with ADMIN_EMAIL error?

**A:** Check the Quick Reference → "Seed Configuration Issues" section. Common fix:

```bash
export ADMIN_EMAIL=your@email.com
export ADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 32)
npm exec prisma db seed
```

### Q: Can I skip the pre-commit hook?

**A:** Not recommended. It prevents the exact errors described here. But if needed:

```bash
git commit --no-verify  # ❌ Only in emergencies
```

### Q: How do I report a new TypeScript error pattern?

**A:**

1. Document it in a todo or issue
2. Add to prevention strategy document
3. Create unit test for the pattern
4. Share example with team

---

## Team Accountability

| Role              | Responsibility                                     |
| ----------------- | -------------------------------------------------- |
| **Developer**     | Run pre-commit checks, follow Quick Reference      |
| **Code Reviewer** | Use Code Review Checklist, block non-compliant PRs |
| **Tech Lead**     | Enforce prevention strategies, monitor metrics     |
| **DevOps**        | Maintain CI/CD checks, update workflows            |

---

## Continuous Improvement

As new errors occur:

1. **Document** the error pattern in these guides
2. **Add** a code review checklist item
3. **Create** a unit test for the pattern
4. **Update** quick reference with solution
5. **Train** team on prevention

This creates a feedback loop that strengthens the prevention system over time.

---

## Last Updated

- **Document Created:** 2025-12-27
- **Based on:** Commit 1c9972f and historical pattern analysis
- **Real Examples:** From MAIS codebase (Segment.heroImage, BookingStatus enums)
- **Status:** Active (in use for current and future PRs)

---

## Navigation

- **Start Here:** TYPESCRIPT-BUILD-QUICK-REFERENCE.md
- **Full Details:** TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md
- **Code Review:** TYPESCRIPT-BUILD-CODE-REVIEW-CHECKLIST.md
- **Team Setup:** Implementation Roadmap (see above)
