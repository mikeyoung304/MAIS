# fix: Remediate "Vibe Coding Debt" and Pre-existing CI Issues

## Status: Phase 1 Complete (Minimal Fix Applied)

**Completed 2024-12-04**: Applied focused fix per Code Simplicity reviewer recommendation.

### Changes Made (Commit b24a020)

- ✅ Created `e2e/fixtures/auth.fixture.ts` - Per-test tenant isolation
- ✅ Removed `test.describe.configure({ mode: 'serial' })` from visual-editor.spec.ts
- ✅ Replaced all `waitForTimeout` calls with event-based waits (`waitForResponse`)
- ✅ Removed module-level mutable state (`isSetup`, `authToken`) anti-pattern
- ✅ Enabled 2 parallel workers in CI (up from 1)

### Why This Minimal Approach

Per plan review feedback:

- **ESLint** has `continue-on-error: true` in CI - **not blocking**
- **E2E timeout** is the actual CI blocker
- **70% of original plan was scope creep**

---

## Overview (Original Plan - For Reference)

This plan addresses systemic technical debt accumulated through rapid development ("vibe coding"). The MAIS codebase has **1,194 ESLint violations**, **70+ flaky E2E tests**, **10 untracked documentation files**, and **245 tracked TODOs**. This remediation will restore CI stability and improve developer experience.

## Problem Statement / Motivation

### Current State

- **CI Pipeline Failing**: E2E tests timeout after 20 minutes with many `××F` failure patterns
- **ESLint Blocking**: 972 errors + 222 warnings prevent clean builds
- **Developer Friction**: New developers face confusing lint errors and flaky tests
- **Hidden Bugs**: Missing `exhaustive-deps` rules mask React hook bugs
- **Security Risk**: Hardcoded test credentials in committed code

### Root Causes

1. Rapid feature development prioritized velocity over code quality
2. Example/demo files left in production source tree
3. ESLint configuration incomplete (missing react-hooks plugin)
4. E2E tests use anti-patterns (hardcoded waits, shared state)
5. Documentation not committed to version control

## Proposed Solution

A **4-phase remediation** approach with clear rollback points:

```
Phase 0: Pre-Flight (baseline metrics)
    ↓
Phase 1a: Safe ESLint Fixes (low risk)
    ↓
Phase 1b: Risky ESLint Fixes (high risk, test each file)
    ↓
Phase 2: E2E Test Stabilization
    ↓
Phase 3: Documentation Cleanup
    ↓
Phase 4: Validation & Metrics
```

## Technical Approach

### Phase 0: Pre-Flight Checks (1 hour)

**Purpose**: Establish baseline metrics for comparison.

```bash
# Create feature branch
git checkout -b fix/vibe-coding-debt

# Capture baselines
npm run lint > reports/lint-before.txt 2>&1
npm test > reports/tests-before.txt 2>&1

# Document current state
echo "ESLint Errors: $(grep -c 'error' reports/lint-before.txt)"
echo "ESLint Warnings: $(grep -c 'warning' reports/lint-before.txt)"
```

**Deliverables**:

- [ ] Feature branch created
- [ ] Baseline lint report saved
- [ ] Baseline test report saved

---

### Phase 1a: Safe ESLint Fixes (2 hours)

**Purpose**: Fix low-risk issues that won't cause regressions.

#### Task 1.1: Remove Unused Imports (30 min)

**Files affected** (15+):
| File | Unused Imports |
|------|----------------|
| `client/src/components/navigation/RoleBasedNav.tsx:9` | Package, Calendar, Settings, Palette, XCircle |
| `client/src/components/ui/form-field.tsx:4` | ReactNode |
| `client/src/contexts/AuthContext/AuthProvider.tsx:9` | useMemo |
| `client/src/hooks/usePackagePhotos.ts` | ApiError |
| `client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx:10` | AppointmentDto, ServiceDto, CustomerDto |

**Command**:

```bash
npm run lint -- --fix
git add -A && git commit -m "fix(lint): remove unused imports"
```

#### Task 1.2: Remove Example Files from Source (30 min)

**Files to remove**:

```
client/src/components/PackagePhotoUploader.example.tsx
client/src/features/scheduling/TimeSlotPicker.example.tsx
client/src/lib/package-photo-api.test.example.ts
```

**Pre-removal check**:

```bash
# Verify no imports reference these files
grep -r "PackagePhotoUploader.example" client/src/
grep -r "TimeSlotPicker.example" client/src/
grep -r "package-photo-api.test.example" client/src/
```

**Action**:

```bash
rm client/src/components/PackagePhotoUploader.example.tsx
rm client/src/features/scheduling/TimeSlotPicker.example.tsx
rm client/src/lib/package-photo-api.test.example.ts
git add -A && git commit -m "chore: remove example files from source tree"
```

#### Task 1.3: Add Justification Comments for Valid `any` Types (1 hour)

Per `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md`, ts-rest requires `any` for Express compatibility.

**Pattern to apply** in `server/src/routes/*.routes.ts`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ts-rest library limitation (see PREVENTION-TS-REST-ANY-TYPE.md)
async ({ req }: { req: any }) => {
```

**Files requiring comments** (~20):

- All files in `server/src/routes/` using ts-rest handlers
- `client/src/lib/error-handler.ts:73,87,131`
- `client/src/hooks/useErrorHandler.ts:14,48`

**Checkpoint**:

```bash
npm test  # All 771 tests pass
npm run lint  # Errors reduced
```

---

### Phase 1b: Risky ESLint Fixes (4 hours)

**Purpose**: Fix issues that may cause regressions. Test after each file.

#### Task 1.4: Fix ESLint Configuration for react-hooks (30 min)

**Problem**: `react-hooks/exhaustive-deps` rule not found in 3 files:

- `client/src/features/admin/segments/SegmentsManager.tsx:32`
- `client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/index.tsx:79`
- `client/src/features/tenant-admin/scheduling/ServicesManager/index.tsx:64`

**Root Cause**: ESLint react-hooks plugin not properly configured.

**Fix** in `client/.eslintrc.cjs` or `eslint.config.js`:

```javascript
// Ensure react-hooks plugin is installed and configured
module.exports = {
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

**Verification**:

```bash
npm run lint -- --rule 'react-hooks/exhaustive-deps: warn'
```

#### Task 1.5: Fix Hook Dependency Arrays (3 hours)

**High-risk files** (test each after modification):

| File                                 | Line | Current Issue                     |
| ------------------------------------ | ---- | --------------------------------- |
| `SegmentsManager.tsx`                | 32   | Missing dependencies in useEffect |
| `AvailabilityRulesManager/index.tsx` | 79   | Missing dependencies              |
| `ServicesManager/index.tsx`          | 64   | Missing dependencies              |

**Pattern to fix**:

```typescript
// BEFORE (missing dependency)
useEffect(() => {
  fetchData(tenantId);
}, []); // ESLint: missing 'tenantId'

// AFTER (with useCallback to prevent infinite loop)
const fetchDataCallback = useCallback(() => {
  fetchData(tenantId);
}, [tenantId]);

useEffect(() => {
  fetchDataCallback();
}, [fetchDataCallback]);
```

**Test after each file**:

```bash
npm run typecheck
npm test -- --grep "SegmentsManager"
```

#### Task 1.6: Replace Invalid `any` Types (30 min)

**Files with fixable `any` usage**:

| File                   | Line | Fix                                      |
| ---------------------- | ---- | ---------------------------------------- |
| `TenantForm/index.tsx` | 92   | `catch (error: unknown)` + type guard    |
| `PackagesList.tsx`     | 23   | Define proper type for `addOn` parameter |
| `ErrorFallback.tsx`    | 75   | Prefix unused `error` with `_error`      |

**Example fix** for `TenantForm/index.tsx:92`:

```typescript
// BEFORE
} catch (error: any) {
  setErrors({ submit: error.message || 'Failed' });
}

// AFTER
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  setErrors({ submit: message || 'Failed to save tenant.' });
}
```

**Checkpoint**:

```bash
npm run typecheck  # No type errors
npm test           # All tests pass
npm run lint       # Errors significantly reduced
```

---

### Phase 2: E2E Test Stabilization (4 hours)

**Purpose**: Make E2E tests reliable and fast.

#### Task 2.1: Extract Hardcoded Credentials (1 hour)

**Current violations** in `e2e/tests/`:

```typescript
// admin-flow.spec.ts (lines 31-32, 59-60, and 5+ more)
await page.fill('[name="email"]', 'admin@example.com');
await page.fill('[name="password"]', 'admin123admin');
```

**Create** `e2e/.env.test.example`:

```env
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=admin123admin
E2E_API_URL=http://localhost:3001
```

**Create** `e2e/fixtures/credentials.ts`:

```typescript
export const testCredentials = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin123admin',
  },
};

export const apiUrl = process.env.E2E_API_URL || 'http://localhost:3001';
```

**Update tests** to use fixtures:

```typescript
import { testCredentials, apiUrl } from '../fixtures/credentials';

await page.fill('[name="email"]', testCredentials.admin.email);
```

#### Task 2.2: Replace `waitForTimeout` with Event-Based Waits (2 hours)

**Anti-pattern locations** in `e2e/tests/visual-editor.spec.ts`:
| Line | Current | Replacement |
|------|---------|-------------|
| 98 | `waitForTimeout(1000)` | `waitForLoadState('networkidle')` |
| 184 | `waitForTimeout(2500)` | `waitForResponse(r => r.url().includes('/drafts'))` |
| 213 | `waitForTimeout(1500)` | `waitForSelector('[data-testid="saved"]')` |
| 229 | `waitForTimeout(2000)` | `waitForLoadState('networkidle')` |
| 249 | `waitForTimeout(1000)` | `waitForSelector('.toast-success')` |
| 293 | `waitForTimeout(2000)` | `waitForResponse(r => r.status() === 200)` |

**Pattern**:

```typescript
// BEFORE
await page.click('[data-testid="save"]');
await page.waitForTimeout(2000);

// AFTER
await page.click('[data-testid="save"]');
await page.waitForResponse(
  (response) => response.url().includes('/api/drafts') && response.status() === 200,
  { timeout: 5000 }
);
```

#### Task 2.3: Remove Serial Execution / Fix Shared State (1 hour)

**Problem** in `visual-editor.spec.ts:18-71`:

```typescript
// Module-level mutable state (anti-pattern)
let isSetup = false;
let authToken: string | null = null;

test.describe.serial('Visual Editor', () => {
  // Tests share state, must run serially
});
```

**Fix** using Playwright fixtures:

```typescript
// e2e/fixtures/auth.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Setup auth for each test
    await loginAsAdmin(page);
    await use(page);
  },
});

// visual-editor.spec.ts
import { test } from '../fixtures/auth';

test.describe('Visual Editor', () => {
  test('creates draft', async ({ authenticatedPage }) => {
    // Each test gets fresh auth state
  });
});
```

**Checkpoint**:

```bash
# Run 3x to verify stability
npm run test:e2e -- --repeat-each=3

# Verify parallel execution works
npm run test:e2e -- --workers=4
```

---

### Phase 3: Documentation Cleanup (2 hours)

#### Task 3.1: Commit Untracked Documentation (1 hour)

**Files to commit** (from `git status`):

```
ARCHITECTURE_REVIEW_LANDING_PAGE_EDITOR.md
docs/solutions/LANDING-PAGE-EDITOR-ANALYSIS-INDEX.md
docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-ANALYSIS.md
docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-CHECKLIST.md
docs/solutions/LANDING-PAGE-EDITOR-FINDINGS-SUMMARY.md
docs/solutions/LANDING-PAGE-EDITOR-IMPLEMENTATION-CHECKLIST.md
docs/solutions/LANDING-PAGE-EDITOR-INDEX.md
docs/solutions/PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md
docs/solutions/PATTERN-ANALYSIS-SUMMARY.md
docs/solutions/PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md
```

**Action**:

```bash
git add ARCHITECTURE_REVIEW_LANDING_PAGE_EDITOR.md
git add docs/solutions/LANDING-PAGE-EDITOR-*.md
git add docs/solutions/PATTERN-*.md
git commit -m "docs: commit landing page editor analysis documentation"
```

#### Task 3.2: File GitHub Issues for Critical TODOs (1 hour)

**P1 Issues to file** (from research):

1. **Landing Page Editor: Publish Operation Not Atomic** - Data loss risk
2. **Landing Page Editor: Auto-Save Race with Publish** - Silent data loss
3. **Landing Page Editor: Discard Not Server-Backed** - UI/DB inconsistency

**Issue template**:

```markdown
## Summary

[Brief description]

## Impact

- **Severity**: CRITICAL / Data Loss Risk
- **Affected Users**: All tenants using landing page editor

## Reproduction Steps

1. ...

## Proposed Fix

[Technical approach]

## Acceptance Criteria

- [ ] ...
```

---

### Phase 4: Validation (1 hour)

**Run final metrics**:

```bash
npm run lint > reports/lint-after.txt 2>&1
npm test > reports/tests-after.txt 2>&1
npm run test:e2e -- --repeat-each=3 > reports/e2e-after.txt 2>&1
```

**Compare results**:

```bash
echo "=== BEFORE ==="
grep -c "error" reports/lint-before.txt
grep -c "warning" reports/lint-before.txt

echo "=== AFTER ==="
grep -c "error" reports/lint-after.txt
grep -c "warning" reports/lint-after.txt
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] `npm run lint` exits with code 0 (zero errors)
- [ ] ESLint warnings ≤ 50 (down from 222)
- [ ] All 771 server tests pass
- [ ] E2E tests pass 100% on 3 consecutive runs
- [ ] E2E test duration < 5 minutes (parallel execution)
- [ ] No hardcoded credentials in committed code
- [ ] All documentation files tracked in git

### Non-Functional Requirements

- [ ] No new security vulnerabilities introduced
- [ ] No performance regressions in tests
- [ ] Developer experience improved (clean IDE, fast tests)

### Quality Gates

- [ ] All changes reviewed in PR
- [ ] CI pipeline passes on feature branch
- [ ] Rollback procedure documented and tested

---

## Success Metrics

| Metric            | Before  | Target  | Measurement                       |
| ----------------- | ------- | ------- | --------------------------------- |
| ESLint Errors     | 972     | 0       | `npm run lint \| grep -c error`   |
| ESLint Warnings   | 222     | ≤ 50    | `npm run lint \| grep -c warning` |
| E2E Pass Rate     | ~40%    | 100%    | 3 consecutive runs                |
| E2E Duration      | 20+ min | < 5 min | Playwright report                 |
| Hardcoded Secrets | 6+      | 0       | `git grep -c "admin@example"`     |
| Untracked Docs    | 10      | 0       | `git status --short`              |

---

## Dependencies & Prerequisites

### Technical Dependencies

- Node.js 20.x
- npm 10.x
- Playwright installed with browsers

### Process Dependencies

- Feature branch approval
- CI/CD pipeline access
- GitHub issue creation permissions

---

## Risk Analysis & Mitigation

| Risk                                      | Likelihood | Impact | Mitigation                                             |
| ----------------------------------------- | ---------- | ------ | ------------------------------------------------------ |
| `exhaustive-deps` causes infinite loops   | Medium     | High   | Test each component manually, review useCallback usage |
| Parallel E2E tests expose race conditions | High       | Medium | Use Playwright fixtures, avoid shared state            |
| Removing example files breaks docs        | Low        | Low    | Grep for references before removal                     |
| Type fixes cause runtime errors           | Medium     | High   | Run full test suite after each file                    |

### Rollback Procedure

```bash
# If any phase fails catastrophically
git reset --hard origin/main
git clean -fdx
npm install
```

---

## Resource Requirements

- **Time**: 14 hours (2 developer days)
- **Team**: 1-2 developers
- **Infrastructure**: CI/CD pipeline, GitHub

---

## Future Considerations

### Post-Remediation

1. **Add ESLint to pre-commit hook** - Prevent future regressions
2. **E2E test coverage expansion** - Add missing scenarios
3. **TODO grooming session** - Triage remaining 236 items
4. **Quarterly debt review** - Prevent accumulation

### Technical Debt Prevention

- Establish lint-free PR policy
- Add E2E stability checks to CI
- Document patterns in CLAUDE.md

---

## References & Research

### Internal References

- Prevention strategies: `docs/solutions/PREVENTION-QUICK-REFERENCE.md`
- ts-rest `any` limitation: `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md`
- TODO tracking: `docs/cli-todos.md` (245 items)
- ADR for concurrency: `docs/adrs/ADR-013-advisory-locks.md`

### External References

- [Playwright Fixtures](https://playwright.dev/docs/test-fixtures)
- [ESLint react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- [TypeScript Error Handling](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

### Related Work

- Recent CI fixes: Commit `1863a32` (schema drift, env vars)
- PR #15: Landing page editor improvements
