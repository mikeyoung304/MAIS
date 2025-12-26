# Quality Gates Quick Start

**TL;DR:** This project prevents 4 types of quality regressions. Here's how to work with them.

---

## 1. Configuration Duplication

**Problem:** Multiple files with same patterns (e.g., `.eslintrc.cjs` AND `.eslintignore`)

**Solution:** One file = Truth
- ESLint: Use **`.eslintignore`** only (delete ignorePatterns from .eslintrc.cjs)
- Pattern: Copy `.gitignore` style (separate file, not embedded config)

**What to do:**
```bash
# Check for duplication
./scripts/validate-config-duplication.sh

# Fix: Remove duplicate, use primary file
grep -l "ignorePatterns" *.js    # Find duplicates
# Delete the duplicate entry, keep primary
```

**Baseline:** 0 duplications

---

## 2. Mechanical Replacements (Undefined Variables)

**Problem:** `sed tenantId _tenantId` changed parameter name but code still used old name

**Solution:** Always verify ALL usages updated
- Enable ESLint `no-undef: error`
- Enable TypeScript `noUnusedLocals`
- Test affected code after replacement

**What to do:**
```bash
# After running sed/find-replace
npm run typecheck        # Catches type mismatches
npm run lint             # Catches undefined variables
npm test -- --grep "method.*name"  # Test changed methods

# Pre-commit hook validates
git commit  # Hook runs npm lint -- --rule "no-undef:error"
```

**Baseline:** 0 undefined variables

---

## 3. Lint Regression (Tech Debt)

**Problem:** New lint errors merged without detection (continue-on-error: true)

**Solution:** Track baseline, fail if exceeded
```bash
# Current baseline: 305 errors (as of 2025-12-26)
npm run lint 2>&1 | grep -c " error "  # Should output ≤ 305
```

**What to do:**
```bash
# Local development
npm run lint              # Check error count
# If you add new errors, fix them before commit

# In CI: Automatic check
# PR fails if error count increases

# To update baseline (after fixing errors)
npm run lint 2>&1 | grep -o "[0-9]* error"  # Get new count
# Edit .github/workflows/main-pipeline.yml line 98: BASELINE=305
# Update to new count
```

**Baseline:** 305 errors (max)
**Target:** 0 errors (long-term)

---

## 4. Coverage Thresholds

**Problem:** Coverage disabled in CI, allowing regression

**Solution:** Always-on coverage thresholds (per-suite targets)
```typescript
// server/vitest.config.ts
thresholds: {
  lines: 30,       // CI baseline (unit tests alone)
  branches: 60,
  functions: 35,
  statements: 30,
}
```

**What to do:**
```bash
# Run tests locally
npm run test:unit -- --coverage

# Check coverage report
# Lines must be ≥ 30%, Branches ≥ 60%, etc.

# If below threshold: Add more tests
npm run test:unit -- --coverage    # Re-run
```

**Baseline:** 30% lines, 60% branches, 35% functions, 30% statements

---

## Quick Decision Tree

**You just made changes. What to check?**

```
Did you use sed/find-replace?
├─ Yes
│  ├─ npm run typecheck         ← Catch type mismatches
│  ├─ npm run lint              ← Catch undefined variables
│  └─ npm test -- --grep "YOUR_METHOD"  ← Test changed code
│
Did you add new code?
├─ Yes
│  └─ npm run test:unit -- --coverage  ← Check coverage thresholds
│      └─ If < 30% lines: Add tests
│
Did you change .eslintrc, .prettierrc, vitest.config, or similar?
├─ Yes
│  └─ ./scripts/validate-config-duplication.sh
│      └─ Check no duplicate patterns
│
Did you want to commit?
└─ Run: npm run lint
   └─ Count errors: npm run lint 2>&1 | grep -c " error "
      └─ If > 305: Fix errors first
```

---

## Cheat Sheet: Before Pushing

```bash
# 1. Type safety
npm run typecheck

# 2. Lint (and error count)
npm run lint                    # Should show ≤ 305 errors

# 3. Coverage
npm run test:unit -- --coverage # Must pass thresholds

# 4. Config duplication
./scripts/validate-config-duplication.sh

# 5. Commit and push
git push
# CI will run comprehensive checks
```

---

## When CI Fails

### Lint Regression Failed
```bash
# You added new lint errors
npm run lint 2>&1               # See which ones
npm run lint -- --fix           # Auto-fix if possible
# OR manually fix the issues
git add -A && git commit -m "fix: resolve lint errors"
git push
```

### Coverage Threshold Failed
```bash
# Your code doesn't have enough test coverage
npm run test:unit -- --coverage  # See which lines uncovered
# Add more tests for those lines
npm test -- path/to/your.test.ts
# Once ≥ thresholds, commit and push
```

### Config Duplication Failed
```bash
# You have same pattern in multiple config files
./scripts/validate-config-duplication.sh  # See which ones
# Delete the duplicate, use single source of truth
git add -A && git commit -m "fix: remove duplicate config pattern"
```

### Undefined Variable Failed
```bash
# You have undefined variables (from sed/find-replace)
npm run lint -- --rule "no-undef:error"  # See which ones
# Fix them manually or re-run sed correctly
git add -A && git commit -m "fix: resolve undefined variable references"
```

---

## Baseline Updates

When metrics improve, update baselines:

### Lint Errors Baseline
```bash
npm run lint 2>&1 | grep -o "[0-9]* error"  # e.g., "305 error"

# Edit .github/workflows/main-pipeline.yml
# Line 98: BASELINE=305
# Change to: BASELINE=250 (your new count)

git add .github/workflows/main-pipeline.yml
git commit -m "chore: update lint baseline to 250 errors"
```

### Coverage Baseline
```bash
npm run test:unit -- --coverage | grep "Lines\|Branches"
# e.g., "Lines: 35.5%" (was 30%)

# Edit server/vitest.config.ts
# Change: lines: 30 to lines: 35

git add server/vitest.config.ts
git commit -m "chore: update coverage baseline to 35% lines"
```

---

## CI Status Checks

PR checks in order:
1. ✅ Documentation Standards
2. ✅ Multi-Tenant Patterns
3. ✅ Lint & Format (no regression)
4. ✅ TypeScript Types
5. ✅ Unit Tests (coverage ≥ 30%)
6. ✅ Integration Tests (coverage ≥ 30%)
7. ✅ Database Migrations
8. ✅ E2E Tests (Playwright)
9. ✅ Build Validation

All must pass. If one fails, CI comments on PR with error details.

---

## References

- **Detailed Strategies:** `docs/solutions/CODE-QUALITY-PREVENTION-STRATEGIES.md`
- **CI Configuration:** `.github/workflows/main-pipeline.yml`
- **ESLint Config:** `.eslintrc.cjs` and `.eslintignore`
- **Coverage Config:** `server/vitest.config.ts`
- **Project Guidelines:** `CLAUDE.md`
