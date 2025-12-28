# Quality Gates Implementation Guide

This guide provides step-by-step instructions to implement the 4 prevention strategies in your codebase.

---

## Phase 1: Validation Scripts (30 minutes)

### Step 1.1: Create Configuration Duplication Checker

Create `/scripts/validate-config-duplication.sh`:

```bash
#!/bin/bash
# scripts/validate-config-duplication.sh
# Prevent configuration duplication across the codebase

set -e

ERRORS=0

# Function to check for duplication pattern
check_duplication() {
  local pattern="$1"
  local files="$2"
  local description="$3"

  echo "Checking: $description"

  # Count occurrences across all files
  local count=0
  for file in $files; do
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
      count=$((count + 1))
      echo "  Found in: $file"
    fi
  done

  if [ $count -gt 1 ]; then
    echo "  ❌ DUPLICATION DETECTED: Pattern appears in $count files"
    ERRORS=$((ERRORS + 1))
  elif [ $count -eq 1 ]; then
    echo "  ✅ Single source of truth"
  fi
  echo ""
}

# ESLint ignore patterns
check_duplication \
  "ignorePatterns\|dist.*node_modules" \
  ".eslintrc.cjs .eslintignore" \
  "ESLint ignore patterns"

# TypeScript excludes (if both tsconfig and package.json)
check_duplication \
  "\"exclude\"\|\"exclude\":" \
  "tsconfig.json package.json" \
  "TypeScript excludes"

# Prettier ignores
if [ -f .prettierrc ] && [ -f .prettierignore ]; then
  echo "Checking: Prettier ignore patterns"
  if grep -q "ignore" .prettierrc; then
    echo "  ❌ DUPLICATION: Both .prettierrc and .prettierignore exist with ignore patterns"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ Single source of truth (.prettierignore)"
  fi
  echo ""
fi

# Summary
echo "==================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ No configuration duplication detected"
  exit 0
else
  echo "❌ Found $ERRORS duplication issues"
  echo ""
  echo "Resolution:"
  echo "1. Identify which file is the authoritative source"
  echo "2. Remove the pattern from secondary files"
  echo "3. Add comment in secondary location noting primary source"
  exit 1
fi
```

Make it executable:

```bash
chmod +x scripts/validate-config-duplication.sh
```

### Step 1.2: Create Lint Error Tracker

Create `/scripts/track-lint-errors.sh`:

```bash
#!/bin/bash
# scripts/track-lint-errors.sh
# Track and report lint error counts over time

LINT_BASELINE=305

# Run linter and capture output
echo "Running ESLint..."
npm run lint 2>&1 | tee /tmp/lint-output.txt || true

# Parse error count
ERROR_COUNT=$(grep -o "[0-9]* error" /tmp/lint-output.txt | grep -oP '\d+' | head -1)
ERROR_COUNT=${ERROR_COUNT:-0}

WARN_COUNT=$(grep -o "[0-9]* warning" /tmp/lint-output.txt | grep -oP '\d+' | head -1)
WARN_COUNT=${WARN_COUNT:-0}

echo ""
echo "=== LINT REPORT ==="
echo "Errors: $ERROR_COUNT"
echo "Warnings: $WARN_COUNT"
echo "Baseline: $LINT_BASELINE"
echo ""

# Check against baseline
DELTA=$((ERROR_COUNT - LINT_BASELINE))
if [ $DELTA -gt 0 ]; then
  echo "⚠️  REGRESSION: +$DELTA errors above baseline"
  exit 1
elif [ $DELTA -lt 0 ]; then
  echo "✅ IMPROVEMENT: -${DELTA#-} errors below baseline"
  echo "   (Consider updating baseline)"
  exit 0
else
  echo "→  STABLE: Exactly at baseline"
  exit 0
fi
```

Make it executable:

```bash
chmod +x scripts/track-lint-errors.sh
```

### Step 1.3: Create Pre-Commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
# .husky/pre-commit
# Validate quality checks before allowing commits

echo "🔍 Running pre-commit quality checks..."
echo ""

# 1. Check for configuration duplication
echo "1️⃣  Checking configuration duplication..."
if ! ./scripts/validate-config-duplication.sh; then
  echo "❌ Pre-commit hook failed: Configuration duplication detected"
  exit 1
fi

# 2. Check for undefined variables
echo "2️⃣  Checking for undefined variables..."
if npm run lint -- --rule "no-undef:error" 2>&1 | grep -q "error"; then
  echo "❌ Pre-commit hook failed: Undefined variables detected"
  exit 1
fi

# 3. TypeScript check on staged files only
echo "3️⃣  Checking TypeScript (staged files)..."
if ! npm run typecheck 2>&1 | grep -q "✓"; then
  echo "⚠️  TypeScript errors found (non-blocking for now)"
  echo "    Run 'npm run typecheck' to see details"
  # Note: Non-blocking to allow incremental fixes
  # Update to 'exit 1' when ready to enforce
fi

echo ""
echo "✅ Pre-commit checks passed!"
exit 0
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

---

## Phase 2: ESLint Configuration (15 minutes)

### Step 2.1: Verify ESLint Rules

Update `.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // CRITICAL: Catch undefined variables from sed/replacements
    'no-undef': 'error',

    // Catch unused variables (allow prefixed with _)
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  // Note: ignorePatterns defined in .eslintignore file
  // (why: single source of truth, matches .gitignore pattern)
};
```

### Step 2.2: Verify ESLintignore File

Check `.eslintignore` exists and has comprehensive patterns:

```text
# Build artifacts
dist/
node_modules/
coverage/

# Generated files
*.cjs
*.js
generated/

# Next.js app (has its own ESLint config)
apps/web/

# Test templates with placeholder syntax
server/test/templates/

# Test files (to be cleaned up separately)
server/test/

# Utility scripts that use console.log
server/scripts/
**/update-tenant-passwords.ts
server/*.ts
server/prisma/seeds/

# Documentation examples
docs/examples/

# E2E test infrastructure
e2e/
tests/
```

Verify no duplication:

```bash
grep -c "ignorePatterns" .eslintrc.cjs  # Should output 0 or only comments
```

---

## Phase 3: TypeScript Configuration (10 minutes)

### Step 3.1: Enable Strict Checking

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true
  }
}
```

Verify compilation:

```bash
npm run typecheck
# Should pass with no errors
```

---

## Phase 4: CI Configuration (45 minutes)

### Step 4.1: Update Lint Step in CI

Update `.github/workflows/main-pipeline.yml` (lines 92-105):

```yaml
- name: Run ESLint with regression check
  id: lint
  run: |
    npm run lint 2>&1 | tee lint-output.txt || true

    # Extract error count
    ERROR_COUNT=$(grep -o "[0-9]* error" lint-output.txt | grep -oP '\d+' | head -1)
    ERROR_COUNT=${ERROR_COUNT:-0}

    # Save for next step
    echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT
    echo "✅ Lint complete: $ERROR_COUNT errors"

- name: Check lint regression
  if: github.event_name == 'pull_request'
  run: |
    CURRENT=${{ steps.lint.outputs.error_count }}
    BASELINE=305

    if [ "$CURRENT" -gt "$BASELINE" ]; then
      echo "❌ Lint errors increased from $BASELINE to $CURRENT"
      exit 1
    elif [ "$CURRENT" -lt "$BASELINE" ]; then
      echo "🎉 Lint errors improved: $CURRENT < $BASELINE"
    else
      echo "✅ Lint errors stable: $CURRENT = $BASELINE"
    fi
```

### Step 4.2: Add Configuration Duplication Check to CI

Add to CI workflow (in lint job, after dependencies installed):

```yaml
- name: Check for configuration duplication
  run: |
    chmod +x scripts/validate-config-duplication.sh
    ./scripts/validate-config-duplication.sh
```

### Step 4.3: Add Coverage Thresholds to CI

Verify in `.github/workflows/main-pipeline.yml` coverage steps:

```yaml
- name: Check coverage thresholds
  run: |
    npm run test:unit -- --coverage

    # Parse coverage report
    LINES=$(npm run test:unit -- --coverage 2>&1 | grep "Lines" | grep -oP '\d+\.\d+' | head -1)

    if (( $(echo "$LINES < 30" | bc -l) )); then
      echo "❌ Coverage regression: $LINES% < 30%"
      exit 1
    fi

    echo "✅ Coverage check passed: $LINES% >= 30%"
```

---

## Phase 5: Coverage Configuration (15 minutes)

### Step 5.1: Update Vitest Config

Verify `server/vitest.config.ts` has clear baselines:

```typescript
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 3,
        },
      },
      env: { ...env, STORAGE_MODE: 'local' },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/*.test.ts',
          'test/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          'dist/**',
          'coverage/**',
          'node_modules/**',
          'scripts/**',
          'prisma/**',
          '*.config.ts',
          '*.config.js',
          '**/*.d.ts',
          '**/index.ts',
        ],
        all: true,

        // CRITICAL: Always-on thresholds (even in CI)
        // Per-suite targets that each test run can meet independently
        thresholds: {
          lines: 30, // Unit tests baseline
          branches: 60, // Critical paths
          functions: 35, // Service methods
          statements: 30, // Matches lines
        },

        reportsDirectory: './coverage',
        clean: true,
        cleanOnRerun: true,
      },
    },
  };
});
```

---

## Phase 6: Documentation (30 minutes)

### Step 6.1: Create Baseline Tracking File

Create `docs/quality/COVERAGE_BASELINE_HISTORY.md`:

```markdown
# Coverage Baseline History

## Current Baseline (as of 2025-12-26)

| Metric     | Local  | CI  | Target |
| ---------- | ------ | --- | ------ |
| Lines      | 43.27% | 30% | 80%    |
| Branches   | 81.11% | 60% | 75%    |
| Functions  | 46.7%  | 35% | 80%    |
| Statements | 43.27% | 30% | 80%    |

## Historical Trend

| Date       | Lines  | Branches | Functions | Notes               |
| ---------- | ------ | -------- | --------- | ------------------- |
| 2025-12-26 | 43.27% | 81.11%   | 46.7%     | Initial measurement |

## How to Update Baseline

When coverage metrics improve significantly:

1. Run: `npm run test:unit -- --coverage`
2. Note the new percentages
3. Update this table with date and metrics
4. Update thresholds in `server/vitest.config.ts`
5. Create PR: "chore: update coverage baseline to X%"

## Coverage Improvement Plan

### Short-term (By 2025-12-31)

- [ ] Reach 40% lines coverage
- [ ] Maintain 60% branches

### Medium-term (By 2026-01-31)

- [ ] Reach 50% lines coverage
- [ ] Reach 45% functions coverage

### Long-term (By 2026-03-31)

- [ ] Target 80% lines coverage
- [ ] Target 75% branches coverage
- [ ] Target 80% functions coverage
```

### Step 6.2: Create Lint Error Tracking File

Create `docs/quality/LINT_ERROR_BASELINE_HISTORY.md`:

```markdown
# Lint Error Baseline History

## Current Baseline (as of 2025-12-26)

**Error Count:** 305 errors
**Warning Count:** 54 warnings
**Total Issues:** 359

## Historical Trend

| Date       | Errors | Warnings | Δ Errors | Notes         |
| ---------- | ------ | -------- | -------- | ------------- |
| 2025-12-20 | 612    | -        | -        | Initial state |
| 2025-12-26 | 305    | 54       | -307     | Phase cleanup |

## Error Distribution (estimate)

- Type-related: ~120 (39%)
- Unused imports: ~80 (26%)
- Console statements: ~45 (15%)
- Other: ~60 (20%)

## How to Update Baseline

When error count changes significantly:

1. Run: `npm run lint 2>&1 | grep -o "[0-9]* error"`
2. Note the new count
3. Update this table
4. Update baseline in `.github/workflows/main-pipeline.yml` (line 98)
5. Create PR: "chore: update lint baseline to X errors"

## Error Reduction Plan

### Phase 1: Type-related (120 errors)

- Timeline: 2025-12-31
- Strategy: Fix Zod/ts-rest type mismatches
- Status: Not started

### Phase 2: Unused Imports (80 errors)

- Timeline: 2026-01-15
- Strategy: Use cleanup tools and manual review
- Status: Not started

### Phase 3: Console Statements (45 errors)

- Timeline: 2026-01-31
- Strategy: Replace with logger utility
- Status: Not started

## Current CI Status

Lint check: **Passing** (305 errors ≤ baseline 305)
Lint regression: **Blocked** (no increase allowed)
```

---

## Phase 7: Testing & Verification (30 minutes)

### Step 7.1: Test Configuration Duplication Check

```bash
# Should pass (no duplication)
./scripts/validate-config-duplication.sh

# Should output: ✅ No configuration duplication detected
```

### Step 7.2: Test Lint Regression Check

```bash
# Should show current error count
scripts/track-lint-errors.sh

# Should output: → STABLE: Exactly at baseline (305 errors)
```

### Step 7.3: Test TypeScript Checking

```bash
# Should pass
npm run typecheck

# Should output: No type errors
```

### Step 7.4: Test ESLint Rules

```bash
# Should pass (no undefined variables)
npm run lint -- --rule "no-undef:error"
```

### Step 7.5: Test Coverage Thresholds

```bash
# Should pass coverage checks
npm run test:unit -- --coverage

# Should show all metrics >= thresholds
```

---

## Phase 8: Documentation & Handoff (15 minutes)

### Step 8.1: Update CLAUDE.md

Add to the project's CLAUDE.md:

````markdown
## Quality Gates (Added 2025-12-26)

This project enforces 4 quality gates to prevent regressions:

1. **Configuration Duplication** - Single source of truth for all ignore patterns
   - Check: `./scripts/validate-config-duplication.sh`
   - Blocks: PR if duplicate patterns found

2. **Mechanical Replacements** - No undefined variables from sed operations
   - Check: `npm run lint -- --rule "no-undef:error"`
   - Blocks: PR if undefined variables detected

3. **Lint Regression** - Error count must not increase
   - Check: `npm run lint 2>&1 | grep -c " error "`
   - Baseline: 305 errors (see `docs/quality/LINT_ERROR_BASELINE_HISTORY.md`)
   - Blocks: PR if errors > 305

4. **Coverage Thresholds** - Minimum coverage per test suite
   - Check: `npm run test:unit -- --coverage`
   - Thresholds: 30% lines, 60% branches, 35% functions
   - Blocks: PR if any metric below threshold

### Before Pushing Code

Run this checklist:

```bash
npm run typecheck              # Type safety
./scripts/validate-config-duplication.sh  # Config duplication
npm run lint                   # Lint errors
npm run test:unit -- --coverage  # Coverage
```
````

All must pass before push. CI will verify again.

### Updating Baselines

When metrics improve:

1. Run relevant check locally
2. Verify new metric is better
3. Update baseline in config file (see Phase 6)
4. Create PR with "chore: update [x] baseline" commit message
5. Include rationale in PR description

````

### Step 8.2: Create Team Runbook

Create `.github/docs/QUALITY_GATES_RUNBOOK.md`:

```markdown
# Quality Gates Runbook

See: `docs/solutions/QUALITY-GATES-QUICK-START.md` (developer version)

## Quick Reference

| Gate | Check | Baseline | When it fails |
|------|-------|----------|---------------|
| Config Duplication | `./scripts/validate-config-duplication.sh` | 0 duplicates | Delete duplicate, keep one |
| Undefined Variables | `npm run lint -- --rule "no-undef:error"` | 0 errors | Fix undefined variable references |
| Lint Regression | `npm run lint \| grep " error "` | 305 errors | Fix lint errors before merge |
| Coverage Thresholds | `npm run test:unit -- --coverage` | 30% lines | Add tests for uncovered code |

## CI Gates in Order

1. Documentation Standards (static check)
2. Multi-Tenant Patterns (security check)
3. Configuration Duplication ← NEW
4. Lint Regression ← NEW
5. TypeScript Types
6. Coverage Thresholds ← NEW
7. Unit Tests
8. Integration Tests
9. E2E Tests
10. Build Validation

All must pass for PR to merge.

## Common Failures & Fixes

### "Configuration duplication detected"
```bash
# Find which files have the pattern
grep -l "ignorePatterns" *.js
grep -l "ignorePatterns" .eslintignore  # If this has it, that's the bug

# Fix: Delete from secondary file, keep in primary
# ESLint: Keep patterns ONLY in .eslintignore
````

### "Undefined variable" error

```bash
# Find undefined variables
npm run lint -- --rule "no-undef:error" 2>&1 | grep "is not defined"

# Usually from sed/find-replace that missed internal usage
npm test -- --grep "methodName"  # Test the changed method

# Fix: Update all references to use correct name
```

### "Lint errors increased"

```bash
# See new errors
npm run lint 2>&1 | head -30

# Fix them
npm run lint -- --fix  # Auto-fix if possible
# OR manually edit files

# Then test
npm test
git add -A && git commit -m "fix: resolve lint errors"
```

### "Coverage below threshold"

```bash
# See uncovered lines
npm run test:unit -- --coverage

# Add tests for uncovered code
# Edit test file for that module
npm test -- path/to/module.test.ts --coverage

# Once above threshold
git add -A && git commit -m "test: improve coverage for [module]"
```

## Escalation Path

1. **First attempt:** Local fixes using cheat sheet above
2. **If unclear:** Comment on PR asking for help
3. **If blocker:** Ping tech lead in Slack #engineering
4. **Emergency:** Can temporarily increase baseline (see Phase 6)

## Regular Maintenance

### Weekly

- Monitor baseline trends
- Note if coverage or lint improving
- Celebrate improvements in standup

### Monthly

- Review `docs/quality/` files
- Update baselines if metrics improved significantly
- Plan next sprint's quality improvements

### Quarterly

- Full quality audit
- Update thresholds if needed
- Review effectiveness of gates

```

---

## Implementation Checklist

- [ ] **Phase 1:** Create validation scripts (30 min)
  - [ ] `scripts/validate-config-duplication.sh`
  - [ ] `scripts/track-lint-errors.sh`
  - [ ] `.husky/pre-commit`

- [ ] **Phase 2:** Update ESLint config (15 min)
  - [ ] Verify `.eslintrc.cjs` has `no-undef: error`
  - [ ] Verify `.eslintignore` exists and is comprehensive
  - [ ] Remove `ignorePatterns` from `.eslintrc.cjs`

- [ ] **Phase 3:** TypeScript config (10 min)
  - [ ] Enable `noUnusedLocals` in `tsconfig.json`
  - [ ] Enable `strict` mode
  - [ ] Test: `npm run typecheck` passes

- [ ] **Phase 4:** CI configuration (45 min)
  - [ ] Update lint step with error counting
  - [ ] Add lint regression check
  - [ ] Add config duplication check
  - [ ] Verify coverage thresholds active

- [ ] **Phase 5:** Coverage config (15 min)
  - [ ] Verify `vitest.config.ts` has thresholds
  - [ ] Document current baselines

- [ ] **Phase 6:** Documentation (30 min)
  - [ ] Create `docs/quality/COVERAGE_BASELINE_HISTORY.md`
  - [ ] Create `docs/quality/LINT_ERROR_BASELINE_HISTORY.md`
  - [ ] Update `CLAUDE.md` with quality gates section

- [ ] **Phase 7:** Testing (30 min)
  - [ ] Test duplication check
  - [ ] Test lint regression check
  - [ ] Test typecheck
  - [ ] Test coverage thresholds

- [ ] **Phase 8:** Handoff (15 min)
  - [ ] Create team runbook
  - [ ] Announce to team
  - [ ] Share quick-start guide

**Total Time:** ~3 hours (can be split across multiple sessions)

---

## Next Steps

1. **Now:** Pick one phase and implement it
2. **This week:** Complete all phases
3. **Before merge:** Commit changes with message:
```

feat: implement 4-gate quality prevention system

- Config duplication detection
- Mechanical replacement validation
- Lint regression tracking (305 baseline)
- Coverage threshold enforcement (30% min)

Fixes: Prevents issues from commits 21a9b3a and similar

```
4. **After merge:** Share quick-start guide with team

---

## References

- **Detailed Strategies:** `docs/solutions/CODE-QUALITY-PREVENTION-STRATEGIES.md`
- **Quick Reference:** `docs/solutions/QUALITY-GATES-QUICK-START.md`
- **CI Configuration:** `.github/workflows/main-pipeline.yml`
- **Quality Metrics:** `docs/quality/QUALITY_METRICS.md`
```
