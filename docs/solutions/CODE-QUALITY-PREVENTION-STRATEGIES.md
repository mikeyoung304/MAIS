# Code Quality Prevention Strategies

## Overview

This document provides actionable prevention strategies for four critical quality issues discovered during the quality remediation sprint (Commit 21a9b3a):

1. **Mechanical Replacement Bug** - Undefined variables from sed/script replacements
2. **Configuration Duplication** - Maintenance burden from duplicate ignore patterns
3. **Disabled CI Gates** - Coverage thresholds that allow regression
4. **Tech Debt Masking** - Lint errors hidden by continue-on-error

Each strategy includes the root cause, detection mechanisms, and implementation patterns.

---

## 1. Prevention: Mechanical Replacement Bugs

### Problem
Batch sed/mechanical replacements can introduce subtle runtime bugs. In commit 21a9b3a, a parameter was renamed from `tenantId` to `_tenantId`, but internal usage of the original name was missed, causing `ReferenceError` at runtime.

**Example Bug:**
```typescript
// BEFORE - Parameter used throughout
async getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]> {
  const segmentPackages = await this.getPackagesBySegment(tenantId, segmentId);
}

// AFTER - Parameter renamed but one usage missed
async getAddOnsForSegment(_tenantId: string, segmentId: string): Promise<AddOn[]> {
  const segmentPackages = await this.getPackagesBySegment(tenantId, segmentId);  // BUG!
}
```

### Why TypeScript Didn't Catch It
The `tenantId` variable was undefined, but the receiving method (`getPackagesBySegment`) ignores its first parameter, so there was no type error - only a runtime `undefined` value.

### Detection Strategy

#### 1.1 Pre-Commit Hook: Validate sed Replacements
Add a hook that prevents committing results of sed operations without verification:

```bash
#!/bin/bash
# .husky/pre-commit

# Detect sed operations in recent commits
if git diff-index --cached --diff-filter=M HEAD | grep -q "\.ts$"; then
  # Check for undefined variable usage patterns
  if npm run lint -- --rule "no-undef:error" --fix-dry-run 2>&1 | grep -q "error"; then
    echo "❌ Pre-commit: Undefined variables detected. Review sed changes."
    exit 1
  fi
fi
```

#### 1.2 ESLint Rule: Undefined Variables
Enable strict undefined variable detection in TypeScript:

```javascript
// .eslintrc.cjs
module.exports = {
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',      // Allow unused args prefixed with _
        destructuredArrayIgnorePattern: '^_', // Allow unused destructured items
      }
    ],
    'no-undef': 'error',             // Catch undefined variables (critical!)
  }
};
```

#### 1.3 TypeScript Compiler: Strict Checking
Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true
  }
}
```

#### 1.4 Test Coverage for Modified Methods
After any batch replacement, run tests for affected methods:

```bash
# After sed replacement
npm test -- --grep "getAddOnsForSegment|getPackagesBySegment"
```

#### 1.5 Code Review Checklist for sed/Script Changes
When reviewing commits with mechanical replacements:

```markdown
## Mechanical Replacement Review Checklist

For commits using sed/find-replace:

- [ ] Search all files for old parameter name (e.g., `grep -r "tenantId" server/src/adapters/mock/`)
- [ ] Verify ALL usages updated (not just definitions)
- [ ] Check for dynamic references (e.g., strings containing old name)
- [ ] Run `npm run typecheck` - passes cleanly
- [ ] Run `npm test` - all tests pass
- [ ] Run affected service tests - pass with coverage
- [ ] Check for type mismatches in call sites

### Template Verification Script
```bash
#!/bin/bash
# verify-replacement.sh
OLD_VAR="tenantId"
NEW_VAR="_tenantId"
FILE="$1"

# Find all NEW_VAR occurrences
sed_count=$(grep -c "$NEW_VAR" "$FILE")

# Find all OLD_VAR usage (excluding comments)
old_count=$(grep -v "^[[:space:]]*\*\|^[[:space:]]*/\/" "$FILE" | grep -c "$OLD_VAR")

if [ "$old_count" -gt 0 ]; then
  echo "❌ Found $old_count uses of old name $OLD_VAR in $FILE"
  exit 1
fi

echo "✅ All occurrences of $OLD_VAR replaced with $NEW_VAR"
```

### Implementation Checklist
- [ ] Add `no-undef` ESLint rule (critical!)
- [ ] Enable TypeScript `noUnusedLocals`
- [ ] Add pre-commit hook for undefined variable validation
- [ ] Document mechanical replacement process
- [ ] Create test templates for batch changes
- [ ] Add reviewer checklist for sed/replacement PRs

---

## 2. Prevention: Configuration Duplication

### Problem
ESLint ignore patterns were duplicated in both `.eslintrc.cjs` (ignorePatterns) and `.eslintignore`, creating:
- **Maintenance burden**: Changes must be made in two places
- **Drift risk**: One file updated, the other isn't
- **Confusion**: Unclear which is authoritative

**Example Duplication:**
```javascript
// .eslintrc.cjs
ignorePatterns: [
  'dist', 'node_modules', 'coverage', '*.cjs', '*.js',
  'generated', 'apps/web', '**/test/templates/**',
  'server/scripts/**', '**/update-tenant-passwords.ts', 'tests/**',
],
```

```text
# .eslintignore (more patterns!)
dist/
node_modules/
coverage/
*.cjs
*.js
generated/
apps/web/
server/test/templates/
server/test/
server/scripts/
**/update-tenant-passwords.ts
server/*.ts
server/prisma/seeds/
docs/examples/
e2e/
tests/
```

### Single Source of Truth Pattern

#### 2.1 Choose Authoritative Configuration
**Recommended:** `.eslintignore` is ESLint's standard mechanism

```javascript
// .eslintrc.cjs - Single line reference
module.exports = {
  // ... other config ...
  // Note: ignorePatterns defined in .eslintignore file
  // (why: single source of truth, more readable for long lists)
};
```

**Reason:**
- ESLint standard practice (matches `.gitignore` pattern)
- More readable (separate file vs embedded in JS)
- Easier to diff changes
- Shared pattern with gitignore tools

#### 2.2 Drift Detection Strategy
Implement a CI check to prevent divergence:

```yaml
# .github/workflows/main-pipeline.yml
- name: Validate config duplication
  run: |
    # Check if both ignorePatterns and .eslintignore exist
    if grep -q "ignorePatterns" .eslintrc.cjs && [ -f .eslintignore ]; then
      echo "❌ Both ignorePatterns and .eslintignore detected"
      echo "Use only .eslintignore (single source of truth)"
      exit 1
    fi
```

#### 2.3 Configuration Validation Template
Create a helper script to catch duplicates:

```bash
#!/bin/bash
# scripts/validate-config-duplication.sh

# Detect config duplication patterns
check_eslint() {
  if grep -q "ignorePatterns" .eslintrc.cjs && [ -f .eslintignore ]; then
    echo "❌ ESLint: Both ignorePatterns and .eslintignore exist"
    return 1
  fi
}

check_jest() {
  # Similar pattern for Jest configurations
  if grep -q "testPathIgnorePatterns" jest.config.js && [ -f .jestignore ]; then
    echo "❌ Jest: Both testPathIgnorePatterns and .jestignore exist"
    return 1
  fi
}

check_prettier() {
  # Check Prettier config
  if grep -q "ignore" .prettierrc && [ -f .prettierignore ]; then
    echo "❌ Prettier: Both ignore and .prettierignore exist"
    return 1
  fi
}

# Run all checks
check_eslint || exit 1
check_jest || exit 1
check_prettier || exit 1

echo "✅ No configuration duplication detected"
```

#### 2.4 Code Review Patterns
When reviewing configuration changes:

```markdown
## Configuration Duplication Review Checklist

For ANY configuration file changes:

- [ ] Check if same pattern exists elsewhere (grep search)
- [ ] Identify single source of truth
- [ ] Remove duplicates in secondary locations
- [ ] Document why SOST was chosen
- [ ] Add CI check to prevent future duplication
- [ ] Test that primary config still works

### Examples of Common Duplications

| Config | Duplication Risk | SOST | Reason |
|--------|-----------------|------|--------|
| ESLint ignore | `ignorePatterns` + `.eslintignore` | `.eslintignore` | Standard |
| TypeScript exclude | `compilerOptions.exclude` + `.tsconfig` | `tsconfig.json` | Centralized |
| Vitest exclude | Config + comments | Config file | Single place |
| Coverage exclude | `exclude` array + glob patterns | Config file | Clarity |
```

#### 2.5 Naming Convention Pattern
Use descriptive names that indicate relationship:

```javascript
// ❌ AVOID: Ambiguous which is authoritative
// ignorePatterns in .eslintrc.cjs
// patterns in .eslintignore

// ✅ PREFER: Clear naming
// Comment in .eslintrc.cjs: "ignorePatterns defined in .eslintignore"
// File structure: .eslintignore (primary), .eslintrc.cjs (references it)
```

### Implementation Checklist
- [ ] Choose single source of truth for each config type
- [ ] Remove duplicates
- [ ] Add documentation in secondary location
- [ ] Add CI validation check (no duplication)
- [ ] Document in CLAUDE.md which is authoritative
- [ ] Create configuration style guide

---

## 3. Prevention: Disabled CI Quality Gates

### Problem
Coverage thresholds disabled in CI (`process.env.CI ? undefined : ...`) allows regressions:

```typescript
// server/vitest.config.ts - DANGEROUS!
thresholds: process.env.CI
  ? undefined  // ❌ No enforcement in CI!
  : { lines: 43, branches: 75, functions: 46, statements: 43 },
```

**Impact:**
- PRs can reduce coverage with no detection
- Silent regressions accumulate
- Developers don't know CI enforces quality locally only

### Detection and Enforcement Strategy

#### 3.1 Baseline Tracking Pattern
Establish and track coverage baselines:

```typescript
// server/vitest.config.ts - CORRECT PATTERN
const COVERAGE_BASELINES = {
  // Current baseline from 2025-12-26 measurement
  local: {
    lines: 43.27,       // Actual current coverage
    branches: 81.11,
    functions: 46.7,
    statements: 43.27,
  },
  // CI targets are lower because tests run separately
  ci: {
    lines: 30,          // Allow some regression in single suite
    branches: 60,
    functions: 35,
    statements: 30,
  },
  // Target (aspirational)
  target: {
    lines: 80,
    branches: 75,
    functions: 80,
    statements: 80,
  },
};

export default defineConfig(({ mode }) => ({
  test: {
    coverage: {
      thresholds: COVERAGE_BASELINES.ci,  // Always enforced
      // ... other config
    },
  },
}));
```

#### 3.2 Delta Checking Pattern (Lint Regression Prevention)
Track thresholds and fail if exceeded:

```yaml
# .github/workflows/main-pipeline.yml
- name: Run tests with coverage
  run: npm run test:unit -- --coverage

- name: Check coverage regression
  if: github.event_name == 'pull_request'
  run: |
    BASELINE_LINES=30
    BASELINE_BRANCHES=60
    BASELINE_FUNCTIONS=35

    CURRENT=$(grep "Lines" coverage/coverage-summary.json | grep -oP '\d+\.\d+' | head -1)

    if (( $(echo "$CURRENT < $BASELINE_LINES" | bc -l) )); then
      echo "❌ Coverage regression: $CURRENT% < $BASELINE_LINES%"
      exit 1
    fi

    echo "✅ Coverage acceptable: $CURRENT% >= $BASELINE_LINES%"
```

#### 3.3 Documentation Pattern
Document WHY thresholds exist and their values:

```markdown
# Coverage Threshold Documentation

## Current Baselines (as of 2025-12-26)

| Metric | Local | CI | Target | Rationale |
|--------|-------|----|---------|-----------|
| Lines | 43.27% | 30% | 80% | All production code |
| Branches | 81.11% | 60% | 75% | Critical paths |
| Functions | 46.7% | 35% | 80% | Service methods |

## Why Different in CI?

Unit and integration tests run separately in CI:
- Unit tests: High function coverage, lower branch coverage
- Integration tests: Different functions covered
- Combined: Would exceed current 80% target

**Solution:** Lower thresholds in CI catch regression, target higher locally.

## Increasing Thresholds

When coverage improves:
1. Measure actual coverage: `npm run test:coverage`
2. Update `COVERAGE_BASELINES` in `vitest.config.ts`
3. Document in this file with date
4. Add improvement story to next sprint
```

#### 3.4 Monitoring and Trending
Track coverage over time:

```bash
#!/bin/bash
# scripts/track-coverage.sh

COVERAGE_LOG="docs/quality/coverage-history.log"

# Get current coverage
LINES=$(grep "Lines" coverage/coverage-summary.json | grep -oP '\d+\.\d+' | head -1)
BRANCHES=$(grep "Branches" coverage/coverage-summary.json | grep -oP '\d+\.\d+' | head -1)

# Append to log
echo "$(date -u +'%Y-%m-%d') lines=$LINES branches=$BRANCHES" >> "$COVERAGE_LOG"

# Show trend (last 5 entries)
echo "Recent coverage trend:"
tail -5 "$COVERAGE_LOG"
```

#### 3.5 PR Comment with Coverage Report
Automatically comment on PRs with coverage status:

```yaml
# .github/workflows/main-pipeline.yml
- name: Post coverage to PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const coverage = JSON.parse(fs.readFileSync('./server/coverage/coverage-summary.json'));

      const comment = `## Coverage Report

      | Metric | Coverage | Baseline | Status |
      |--------|----------|----------|--------|
      | Lines | ${coverage.total.lines.pct}% | 30% | ${coverage.total.lines.pct >= 30 ? '✅' : '❌'} |
      | Branches | ${coverage.total.branches.pct}% | 60% | ${coverage.total.branches.pct >= 60 ? '✅' : '❌'} |
      | Functions | ${coverage.total.functions.pct}% | 35% | ${coverage.total.functions.pct >= 35 ? '✅' : '❌'} |
      `;

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment,
      });
```

### Implementation Checklist
- [ ] Define `COVERAGE_BASELINES` object in vitest.config.ts
- [ ] Document current, CI, and target thresholds
- [ ] Add delta checking to CI pipeline
- [ ] Create coverage trending script
- [ ] Add PR comment with coverage report
- [ ] Document why thresholds differ by context
- [ ] Set up coverage improvement backlog

---

## 4. Prevention: Tech Debt Masking (Lint continue-on-error)

### Problem
ESLint in CI used `continue-on-error: true`, masking new lint errors:

```yaml
# .github/workflows/main-pipeline.yml - DANGEROUS!
- name: Run ESLint
  run: npm run lint
  continue-on-error: true  # ❌ Hides new errors!
```

**Impact:**
- New lint errors can be merged without detection
- Tech debt accumulates invisibly
- No visibility into error count changes

### Detection and Prevention Strategy

#### 4.1 Baseline Tracking and Delta Checking
Replace `continue-on-error` with intelligent error tracking:

```yaml
# .github/workflows/main-pipeline.yml - CORRECT PATTERN
- name: Run ESLint
  id: lint
  run: |
    # Run linter, save exit code
    npm run lint 2>&1 | tee lint-output.txt || LINT_EXIT=$?

    # Parse error count
    ERROR_COUNT=$(grep -o "[0-9]* error" lint-output.txt | grep -oP '\d+' | head -1)
    ERROR_COUNT=${ERROR_COUNT:-0}

    # Save for next step
    echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT
    echo "Lint errors: $ERROR_COUNT"

- name: Check lint regression
  if: github.event_name == 'pull_request'
  run: |
    CURRENT=${{ steps.lint.outputs.error_count }}
    BASELINE=305  # Current error count (2025-12-26)

    if [ "$CURRENT" -gt "$BASELINE" ]; then
      echo "❌ Lint errors increased: $CURRENT > $BASELINE"
      echo "Fix errors before merging"
      exit 1
    elif [ "$CURRENT" -lt "$BASELINE" ]; then
      echo "🎉 Lint errors decreased: $CURRENT < $BASELINE"
      echo "Consider updating baseline in CI config"
    else
      echo "✅ Lint errors stable: $CURRENT = $BASELINE"
    fi
```

#### 4.2 Baseline Tracking Document
Maintain a baseline history:

```markdown
# Lint Error Baseline History

## Current Baseline: 305 errors
**Last Updated:** 2025-12-26
**Measurement Method:** `npm run lint 2>&1 | grep -o "[0-9]* error"`

### Error Distribution
- 251 errors (82%)
- 54 warnings (18%)

### Top Categories (estimate from 2025-12-26)
- Unused imports/variables: ~80
- Type issues: ~120
- Console statements: ~45
- Other: ~60

### Historical Trend
| Date | Count | Δ | Status |
|------|-------|---|--------|
| 2025-12-20 | 612 | - | Initial state |
| 2025-12-26 | 305 | -307 | Phase cleanup |
| (Next check) | ? | ? | Monitoring |

### Plan to Reduce
- Unused imports: Fix by 2025-12-31 (20 errors)
- Type issues: Fix by 2026-01-15 (30 errors)
- Gradual reduction: Target 150 by Q1 2026

## How to Update Baseline

When error count significantly changes:

1. Run linter locally: `npm run lint 2>&1`
2. Count errors: `npm run lint 2>&1 | grep -c " error "`
3. Update this file with date and count
4. Update CI baseline in `.github/workflows/main-pipeline.yml`
5. Commit both changes together
```

#### 4.3 Lint Error Tracking Dashboard
Create a visible metric:

```bash
#!/bin/bash
# scripts/lint-dashboard.sh

echo "=== LINT ERROR DASHBOARD ==="
echo "Baseline: 305 errors (as of 2025-12-26)"
echo ""

npm run lint 2>&1 > /tmp/lint-report.txt || true

ERROR_COUNT=$(grep -c " error " /tmp/lint-report.txt)
WARN_COUNT=$(grep -c " warning " /tmp/lint-report.txt)

echo "Current: $ERROR_COUNT errors, $WARN_COUNT warnings"
echo ""

DELTA=$((ERROR_COUNT - 305))
if [ $DELTA -gt 0 ]; then
  echo "⚠️  REGRESSION: +$DELTA errors"
elif [ $DELTA -lt 0 ]; then
  echo "✅ IMPROVEMENT: $DELTA errors"
else
  echo "→  STABLE: No change"
fi

echo ""
echo "Top issues:"
grep " error " /tmp/lint-report.txt | cut -d: -f3- | sort | uniq -c | sort -rn | head -10
```

#### 4.4 Code Review Checklist
When reviewing PRs that change lint:

```markdown
## Lint Change Review Checklist

- [ ] No increase in error count (run `npm run lint` locally)
- [ ] If errors fixed, baseline updated in CI config
- [ ] If errors introduced, clearly documented with plan to fix
- [ ] No new `/* eslint-disable */` comments (document why if necessary)
- [ ] Changes follow project lint rules (check `.eslintrc.cjs`)

### Questions to Ask

- "Do we need `eslint-disable` or should we fix the code?"
- "Is this a rule we disagree with? (should update config)"
- "Does this hide a real problem?"
- "Can we fix this incrementally instead?"
```

#### 4.5 CI Step Comparison: Before vs After
Show the evolution:

```yaml
# OLD APPROACH - DANGEROUS
- name: Run ESLint
  run: npm run lint
  continue-on-error: true  # ❌ Errors hidden, no visibility

# NEW APPROACH - SAFE
- name: Run ESLint with error tracking
  id: lint
  run: |
    npm run lint 2>&1 | tee lint-report.txt || true
    ERROR_COUNT=$(grep -o "[0-9]* error" lint-report.txt | head -1 | grep -oP '\d+' || echo 0)
    echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT

- name: Check lint regression
  run: |
    CURRENT=${{ steps.lint.outputs.error_count }}
    BASELINE=305

    if [ "$CURRENT" -gt "$BASELINE" ]; then
      echo "❌ Lint regression detected"
      exit 1
    fi
    echo "✅ Lint check passed"
```

### Implementation Checklist
- [ ] Remove `continue-on-error: true` from lint step
- [ ] Add error count parsing to lint step
- [ ] Add delta checking step for PRs
- [ ] Document baseline in CI file and this guide
- [ ] Create lint-dashboard.sh script
- [ ] Add code review checklist for lint changes
- [ ] Set up baseline tracking document
- [ ] Plan incremental error reduction

---

## 5. Integrated Prevention Framework

### Combined Approach: Quality Gates Dashboard

Use these four strategies together as an integrated system:

```yaml
# .github/workflows/main-pipeline.yml - COMPREHENSIVE QUALITY GATES

# 1. Code Duplication Check
- name: Validate no config duplication
  run: ./scripts/validate-config-duplication.sh

# 2. Mechanical Replacement Safety
- name: Check for undefined variables
  run: npm run lint -- --rule "no-undef:error"

# 3. Lint Regression Detection (Tech Debt)
- name: Run ESLint with regression check
  id: lint
  run: |
    npm run lint 2>&1 | tee lint-output.txt || true
    ERROR_COUNT=$(grep -c " error " lint-output.txt || echo 0)
    echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT

- name: Check lint regression
  if: github.event_name == 'pull_request'
  run: |
    CURRENT=${{ steps.lint.outputs.error_count }}
    BASELINE=305
    if [ "$CURRENT" -gt "$BASELINE" ]; then
      exit 1
    fi

# 4. Coverage Enforcement (Quality Gates)
- name: Run tests with coverage
  run: npm run test:unit -- --coverage

- name: Check coverage thresholds
  run: npm run test:coverage-check

# 5. Overall Status
- name: Report quality gate status
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const checks = {
        'Config Duplication': 'passed',
        'Undefined Variables': 'passed',
        'Lint Regression': '${{ steps.lint.conclusion }}',
        'Coverage Thresholds': 'passed',
      };

      const body = Object.entries(checks)
        .map(([name, status]) => `- ${status === 'passed' ? '✅' : '❌'} ${name}`)
        .join('\n');

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## Quality Gates Report\n\n${body}`,
      });
```

### Documentation Pattern
Create a single reference guide:

```markdown
# QUALITY_GATES.md

## Overview
This project enforces four quality gates to prevent regressions:

1. **Configuration Duplication** - No duplicate ignore patterns
2. **Mechanical Changes** - No undefined variables from sed/script replacements
3. **Lint Regression** - Error count must not increase from baseline
4. **Coverage Thresholds** - All test suites must meet minimum coverage

## Current Status

| Gate | Status | Baseline | Threshold |
|------|--------|----------|-----------|
| Duplication | ✅ Passing | - | - |
| Undefined Vars | ✅ Passing | - | - |
| Lint Errors | ✅ Passing | 305 errors | 305 max |
| Coverage | ✅ Passing | 30% lines | 30% min |

## How Each Works

### 1. Configuration Duplication
- **Why:** Prevent maintenance burden and drift
- **Check:** `./scripts/validate-config-duplication.sh`
- **Fails if:** Same pattern in multiple config files
- **Fix:** Delete duplicate, use single source of truth

### 2. Mechanical Changes
- **Why:** Catch typos from find-replace operations
- **Check:** `npm run lint -- --rule "no-undef:error"`
- **Fails if:** Undefined variable detected
- **Fix:** Review sed script, run tests on changed code

### 3. Lint Regression
- **Why:** Prevent accumulating tech debt
- **Check:** Parse error count from `npm run lint`
- **Fails if:** Error count > 305
- **Fix:** Fix new lint errors before merging

### 4. Coverage Thresholds
- **Why:** Prevent regression in tested code
- **Check:** Coverage report from `npm run test -- --coverage`
- **Fails if:** Any metric < baseline
- **Fix:** Increase test coverage for changed code

## Updating Baselines

When you intentionally improve metrics:

1. Make the improvement
2. Verify locally: run the check
3. Update baseline in appropriate file (CI, tsconfig, doc)
4. Create PR with improvement + baseline update
5. Document reason for update
```

### Maintenance Pattern
Regular reviews and adjustments:

```bash
#!/bin/bash
# scripts/quality-audit.sh
# Run monthly to assess gate effectiveness

echo "=== QUALITY AUDIT ==="
echo "Last Run: $(date)"
echo ""

echo "1. Configuration Health"
./scripts/validate-config-duplication.sh || echo "⚠️  Issues found"

echo ""
echo "2. Lint Error Trend"
npm run lint 2>&1 | grep -o "[0-9]* error" | head -1

echo ""
echo "3. Coverage Status"
npm run test:unit -- --coverage 2>&1 | grep "Lines\|Branches\|Functions"

echo ""
echo "Recommendations:"
echo "- If coverage trend up: Consider raising threshold"
echo "- If lint errors down: Update baseline"
echo "- If duplication issues: Review config pattern"
```

### Implementation Checklist (Full Framework)
- [ ] Implement all 4 prevention strategies
- [ ] Update CI pipeline with gates
- [ ] Create integrated dashboard in PR comments
- [ ] Document each gate with baseline
- [ ] Set up monthly audit schedule
- [ ] Create escalation policy for gate failures
- [ ] Add team runbooks for each gate type

---

## References

### Related ADRs and Documentation
- **ADR-013:** Advisory locks for booking conflict prevention
- **SCHEMA_DRIFT_PREVENTION.md:** Database migration patterns
- **Prevention Strategies Index:** docs/solutions/PREVENTION-STRATEGIES-INDEX.md

### Key Files
- `.eslintrc.cjs` - ESLint configuration (no ignorePatterns)
- `.eslintignore` - ESLint patterns (single source)
- `.github/workflows/main-pipeline.yml` - CI configuration with gates
- `server/vitest.config.ts` - Coverage thresholds
- `CLAUDE.md` - Project guidelines

### Commit References
- **21a9b3a** - Phase 2-4 quality infrastructure (introduced issues and fixes)
- **136a948** - Address code review findings (verification)
