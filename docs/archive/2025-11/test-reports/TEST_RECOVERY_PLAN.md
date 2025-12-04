# Test Recovery Plan: Comprehensive Analysis & Action Plan

**Date:** 2025-11-08
**Author:** Test Infrastructure Audit
**Status:** 🚨 CRITICAL - Testing infrastructure requires immediate attention

---

## 🎯 Executive Summary

**Current Test Health Score: 3/10**

### The Honest Answer: Are we making progress or lost in test hell?

**We are at the edge of "test hell" but NOT lost.** Here's why:

**Good News (What's Working):**

- ✅ 63 unit tests passing (35% pass rate)
- ✅ Test infrastructure exists and is runnable
- ✅ `/v1/dev/reset` endpoint exists for E2E cleanup
- ✅ `/health` endpoint exists (required for CI/CD)
- ✅ Mock mode is properly implemented in API
- ✅ E2E tests are well-designed with proper structure
- ✅ Documentation exists (TESTING.md)

**Bad News (What's Broken):**

- ❌ 121 unit tests failing (65% failure rate)
- ❌ **CRITICAL**: Playwright config references wrong paths (`apps/web` instead of `client`)
- ❌ **CRITICAL**: GitHub Actions references wrong paths (`apps/api` instead of `server`)
- ❌ E2E tests have likely **never run successfully** in CI/CD
- ❌ Recent lint campaign appears to have broken test signatures
- ❌ Test service signatures don't match implementation (tenantId parameter added)

**Verdict:** We have the foundation, but recent refactoring broke the tests. This is **recoverable** with focused effort. We're NOT lost because:

1. The infrastructure is sound (tests run, just fail)
2. Root causes are identifiable (signature mismatches, config paths)
3. The fixes are mechanical, not architectural
4. No data corruption or architectural debt

---

## 📊 Before/After Comparison

### Where We Are (Current State)

| Category                | Status         | Details                                     |
| ----------------------- | -------------- | ------------------------------------------- |
| **Unit Tests**          | 🔴 35% passing | 63/184 tests pass, 121 fail                 |
| **E2E Tests**           | 🔴 Never run   | Config points to non-existent directories   |
| **CI/CD Pipeline**      | 🔴 Broken      | Workflow uses wrong workspace paths         |
| **Test Documentation**  | 🟡 Outdated    | TESTING.md doesn't reflect current failures |
| **Mock Infrastructure** | 🟢 Working     | API mock mode and dev endpoints functional  |
| **Test Coverage**       | ⚫ Unknown     | No coverage reporting configured            |

### Where We Should Be (Target State)

| Category                | Target          | Success Criteria                              |
| ----------------------- | --------------- | --------------------------------------------- |
| **Unit Tests**          | 🟢 95%+ passing | <5% flaky/skipped tests                       |
| **E2E Tests**           | 🟢 All passing  | 9 scenarios running in CI/CD                  |
| **CI/CD Pipeline**      | 🟢 Automated    | Tests run on every PR, block merge on failure |
| **Test Documentation**  | 🟢 Current      | Reflects actual test status and procedures    |
| **Mock Infrastructure** | 🟢 Enhanced     | Pre-test validation script                    |
| **Test Coverage**       | 🟢 Tracked      | >80% coverage on critical paths               |

---

## ❌ What's Broken (Root Causes)

### 1. E2E Configuration Mismatches (P0 - BLOCKER)

**File:** `/Users/mikeyoung/CODING/Elope/e2e/playwright.config.ts`

```typescript
// WRONG (Line 72):
webServer: {
  command: 'pnpm run dev',
  cwd: './apps/web',  // ❌ This directory doesn't exist!
  url: 'http://localhost:3000',
  // ...
}

// SHOULD BE:
webServer: {
  command: 'pnpm run dev',
  cwd: './client',  // ✅ Correct directory
  url: 'http://localhost:3000',
  // ...
}
```

**Impact:** E2E tests cannot start the web server, tests fail immediately.

---

### 2. GitHub Actions Workflow Path Errors (P0 - BLOCKER)

**File:** `/Users/mikeyoung/CODING/Elope/.github/workflows/e2e.yml`

```yaml
# WRONG (Line 52):
- name: Start API server in mock mode (background)
  run: |
    pnpm -C apps/api run dev &  # ❌ This directory doesn't exist!

# SHOULD BE:
- name: Start API server in mock mode (background)
  run: |
    pnpm -C server run dev &  # ✅ Correct directory
```

**File:** `/Users/mikeyoung/CODING/Elope/.github/workflows/ci.yml`

```yaml
# WRONG (Line 47):
- name: Run API unit tests
  run: pnpm -C apps/api run test # ❌ Wrong path!

# SHOULD BE:
- name: Run API unit tests
  run: pnpm -C server run test # ✅ Correct path
```

**Impact:** CI/CD workflows fail, no automated testing happens on PRs.

---

### 3. Unit Test Signature Mismatches (P0 - CRITICAL)

**Root Cause:** Multi-tenant refactoring added `tenantId` parameter to service methods, but tests weren't updated.

**Example Failures:**

```typescript
// catalog.service.spec.ts (Line 47)
// ❌ FAILS - Missing tenantId parameter
const result = await service.getPackageBySlug('basic');

// ✅ SHOULD BE:
const result = await service.getPackageBySlug('tenant_test', 'basic');

// booking.service.spec.ts
// ❌ FAILS - Service methods now require tenantId
const checkout = await service.createCheckout({
  packageId: 'pkg_1',
  date: '2025-07-01',
  addOnIds: [],
});

// ✅ SHOULD BE:
const checkout = await service.createCheckout('tenant_test', {
  packageId: 'pkg_1',
  date: '2025-07-01',
  addOnIds: [],
});
```

**Affected Test Files:**

- `server/test/catalog.service.spec.ts` (22 failures)
- `server/test/booking.service.spec.ts` (8 failures)
- `server/test/availability.service.spec.ts` (5 failures)

**Pattern:** All service methods now require `tenantId` as first parameter for multi-tenant isolation.

---

### 4. Test Documentation Out of Sync (P1)

**File:** `/Users/mikeyoung/CODING/Elope/TESTING.md`

**Claims:**

- "Unit Tests (44 passing)" → **FALSE** (Only 63 passing, 121 failing)
- "E2E Tests (9 scenarios)" → **UNKNOWN** (Can't verify, tests don't run)
- "CI-ready with automatic retries" → **FALSE** (CI config broken)

**Impact:** Developers follow outdated instructions, waste time debugging.

---

## 🚨 Blockers Preventing Testing

### Tier 1 (Critical - Nothing works without these)

| #   | Blocker                              | Impact                  | ETA       |
| --- | ------------------------------------ | ----------------------- | --------- |
| B1  | Playwright config wrong paths        | E2E tests can't start   | 5 min     |
| B2  | GitHub Actions wrong workspace paths | CI/CD completely broken | 10 min    |
| B3  | Unit test signature mismatches       | 65% of tests fail       | 2-3 hours |

### Tier 2 (High - Tests flaky/unreliable)

| #   | Blocker                    | Impact                             | ETA    |
| --- | -------------------------- | ---------------------------------- | ------ |
| B4  | No pre-test validation     | Tests fail silently with bad state | 30 min |
| B5  | No test coverage reporting | Can't track progress               | 15 min |
| B6  | TESTING.md outdated        | Developers use wrong commands      | 30 min |

---

## 📋 Tiered Recovery Plan

### TIER 1: Critical Fixes (Required for ANY tests to run)

#### Fix 1.1: Playwright Config Paths (5 minutes)

**Priority:** P0
**Risk:** Low
**Dependencies:** None

**File:** `e2e/playwright.config.ts`

```typescript
// Change line 72:
- cwd: './apps/web',
+ cwd: './client',
```

**Success Criteria:**

- ✅ `npm run test:e2e` starts without errors
- ✅ Web server starts on port 3000
- ✅ Tests can navigate to http://localhost:3000

**Test:**

```bash
npm run test:e2e -- --headed
# Should see browser open to home page
```

---

#### Fix 1.2: GitHub Actions Workflow Paths (10 minutes)

**Priority:** P0
**Risk:** Low
**Dependencies:** None

**File:** `.github/workflows/e2e.yml`

```yaml
# Line 52:
- name: Start API server in mock mode (background)
  run: |
-   pnpm -C apps/api run dev &
+   pnpm -C server run dev &
    echo "API_PID=$!" >> $GITHUB_ENV
```

**File:** `.github/workflows/ci.yml`

```yaml
# Line 47:
- name: Run API unit tests
- run: pnpm -C apps/api run test
+ run: pnpm -C server run test
```

**Success Criteria:**

- ✅ CI workflow runs without "directory not found" errors
- ✅ API server starts in CI environment
- ✅ Unit tests execute in CI

**Test:**

```bash
# Locally simulate CI:
pnpm -C server run test
# Should run tests (even if some fail)
```

---

#### Fix 1.3: Unit Test Signature Fixes (2-3 hours)

**Priority:** P0
**Risk:** Medium (manual changes across many files)
**Dependencies:** None

**Strategy:** Add `tenantId` parameter to all service method calls in tests.

**Files to Update:**

1. **server/test/catalog.service.spec.ts** (22 failures)
   - `getPackageBySlug()` → `getPackageBySlug('tenant_test', ...)`
   - `createPackage()` → `createPackage('tenant_test', ...)`
   - `updatePackage()` → `updatePackage('tenant_test', ...)`
   - `deletePackage()` → `deletePackage('tenant_test', ...)`
   - `createAddOn()` → `createAddOn('tenant_test', ...)`
   - `updateAddOn()` → `updateAddOn('tenant_test', ...)`
   - `deleteAddOn()` → `deleteAddOn('tenant_test', ...)`

2. **server/test/booking.service.spec.ts** (8 failures)
   - `createCheckout()` → `createCheckout('tenant_test', ...)`
   - `onPaymentCompleted()` → `onPaymentCompleted('tenant_test', ...)`

3. **server/test/availability.service.spec.ts** (5 failures)
   - Update fake repository methods to accept `tenantId`

**Pattern:**

```typescript
// Before:
await service.methodName(arg1, arg2);

// After:
await service.methodName('tenant_test', arg1, arg2);
```

**Success Criteria:**

- ✅ All catalog service tests pass (22 tests)
- ✅ All booking service tests pass (8 tests)
- ✅ All availability service tests pass (5 tests)
- ✅ Total passing tests: >150/184 (>80%)

**Test:**

```bash
npm run --workspace=server test
# Target: <10 failures
```

---

### TIER 2: Immediate Fixes (Unblock development)

#### Fix 2.1: Pre-Test Validation Script (30 minutes)

**Priority:** P1
**Risk:** Low
**Dependencies:** None

**Create:** `scripts/validate-test-setup.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Validating test environment..."

# Check required directories
if [ ! -d "client" ]; then
  echo "❌ ERROR: client/ directory not found"
  exit 1
fi

if [ ! -d "server" ]; then
  echo "❌ ERROR: server/ directory not found"
  exit 1
fi

# Check API server can start
echo "🔍 Checking API server..."
if ! command -v pnpm &> /dev/null; then
  echo "❌ ERROR: pnpm not installed"
  exit 1
fi

# Check port 3001 is free
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  WARNING: Port 3001 is in use (kill existing API server)"
fi

# Check environment variables for mock mode
if [ "$ADAPTERS_PRESET" != "mock" ]; then
  echo "⚠️  WARNING: ADAPTERS_PRESET not set to 'mock' (E2E tests may fail)"
fi

echo "✅ Test environment validated"
```

**Success Criteria:**

- ✅ Script detects missing directories
- ✅ Script warns about port conflicts
- ✅ Script checks for required tools (pnpm, node)

**Integration:**

```json
// package.json
{
  "scripts": {
    "pretest:e2e": "bash scripts/validate-test-setup.sh",
    "test:e2e": "playwright test -c e2e/playwright.config.ts"
  }
}
```

---

#### Fix 2.2: Update TESTING.md (30 minutes)

**Priority:** P1
**Risk:** Low
**Dependencies:** Fix 1.3 (need real test counts)

**Updates Required:**

```markdown
# TESTING.md Updates

## Current Status (as of 2025-11-08)

### Unit Tests

- **Status:** 🟡 Partially Passing
- **Passing:** 63/184 tests (35%)
- **Failing:** 121 tests (signature mismatches from multi-tenant refactor)
- **Action Required:** See TEST_RECOVERY_PLAN.md for fixes

### E2E Tests

- **Status:** 🔴 Not Running
- **Issue:** Playwright config references wrong directory (apps/web → client)
- **Fix:** Update `e2e/playwright.config.ts` line 72
- **Expected Scenarios:** 9 (after fix)

### Known Issues

1. Multi-tenant refactoring added `tenantId` parameter - tests need updating
2. Playwright config has wrong workspace paths
3. GitHub Actions workflows reference non-existent `apps/` directory

### Quick Fixes

\`\`\`bash

# Fix Playwright config:

# Edit e2e/playwright.config.ts line 72:

# Change: cwd: './apps/web'

# To: cwd: './client'

# Fix unit tests:

# See TEST_RECOVERY_PLAN.md Section "Fix 1.3"

\`\`\`
```

**Success Criteria:**

- ✅ Documentation reflects actual test status
- ✅ Known issues clearly documented
- ✅ Quick fix instructions provided
- ✅ Links to recovery plan included

---

#### Fix 2.3: Test Coverage Reporting (15 minutes)

**Priority:** P1
**Risk:** Low
**Dependencies:** None

**Update:** `server/package.json`

```json
{
  "scripts": {
    "coverage": "vitest run --coverage --reporter=html",
    "coverage:ci": "vitest run --coverage --reporter=json --reporter=json-summary"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.2.4" // Already installed
  }
}
```

**GitHub Actions Integration:**

```yaml
# .github/workflows/ci.yml
- name: Run API unit tests with coverage
  run: pnpm -C server run coverage:ci

- name: Upload coverage reports
  uses: codecov/codecov-action@v4
  with:
    files: ./server/coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
```

**Success Criteria:**

- ✅ Coverage report generated locally
- ✅ Coverage HTML report viewable in browser
- ✅ CI uploads coverage to Codecov (or similar)

---

### TIER 3: Quality Improvements (Next sprint)

#### Fix 3.1: Pre-Commit Test Hooks (1 hour)

**Priority:** P2
**Risk:** Low
**Dependencies:** Tier 1 fixes complete

**Install Husky:**

```bash
npm install --save-dev husky lint-staged
npx husky init
```

**Create:** `.husky/pre-commit`

```bash
#!/bin/bash
npx lint-staged
```

**Create:** `.lintstagedrc.json`

```json
{
  "server/src/**/*.ts": ["eslint --fix", "vitest related --run"],
  "client/src/**/*.{ts,tsx}": ["eslint --fix"]
}
```

**Success Criteria:**

- ✅ Tests run automatically before commit
- ✅ Only affected tests run (performance)
- ✅ Commits blocked if tests fail

---

#### Fix 3.2: PR Test Automation (30 minutes)

**Priority:** P2
**Risk:** Low
**Dependencies:** Tier 1 fixes complete

**Update:** `.github/workflows/ci.yml`

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      # ... existing steps ...

      - name: Run unit tests
        run: pnpm -C server run test

      - name: Require tests to pass
        run: |
          if [ $? -ne 0 ]; then
            echo "❌ Tests failed - blocking PR merge"
            exit 1
          fi
```

**Branch Protection Rules:**

```yaml
# GitHub Settings → Branches → Branch protection rules
Required status checks: ✅ test (CI workflow)
  ✅ typecheck
  ✅ lint (if added)
```

**Success Criteria:**

- ✅ PRs can't merge with failing tests
- ✅ Test results shown in PR status checks
- ✅ Clear error messages for failures

---

#### Fix 3.3: Visual Regression Testing (2 hours)

**Priority:** P3
**Risk:** Low
**Dependencies:** Tier 1 E2E fixes complete

**Install Percy:**

```bash
npm install --save-dev @percy/cli @percy/playwright
```

**Update:** `e2e/tests/booking-flow.spec.ts`

```typescript
import { percySnapshot } from '@percy/playwright';

test('visual regression - package page', async ({ page }) => {
  await page.goto('/package/intimate-ceremony');
  await percySnapshot(page, 'Package Page - Intimate Ceremony');
});
```

**Success Criteria:**

- ✅ Visual snapshots captured on each E2E run
- ✅ Percy detects visual regressions in PRs
- ✅ Team can approve/reject visual changes

---

## 💡 Long-Term Testing Strategy

### Phase 1: Stabilization (This Week)

- ✅ Fix critical blockers (Tier 1)
- ✅ Get unit tests to >80% passing
- ✅ Get E2E tests running in CI/CD
- ✅ Update documentation

### Phase 2: Automation (Next Sprint)

- ✅ Pre-commit hooks enforcing tests
- ✅ PR merge gates requiring passing tests
- ✅ Coverage reporting integrated
- ✅ Slack notifications for CI failures

### Phase 3: Enhancement (Month 2)

- ✅ Visual regression testing
- ✅ Performance benchmarking tests
- ✅ Load testing for booking endpoint
- ✅ Security testing (OWASP ZAP integration)

### Phase 4: Observability (Month 3)

- ✅ Test flakiness tracking
- ✅ Test execution time dashboards
- ✅ Automatic test retry logic
- ✅ Test result analytics

---

## 🏁 Definition of "Testing is Healthy"

We will declare testing healthy when:

### Unit Tests

- ✅ >95% passing (allows <5% for known flaky/skipped tests)
- ✅ <2 second average test execution time
- ✅ >80% code coverage on critical paths
- ✅ Zero tests skipped/disabled for >1 week

### E2E Tests

- ✅ All 9 scenarios passing in CI/CD
- ✅ <5 minute total execution time
- ✅ Zero flaky tests (3 consecutive passes required)
- ✅ Visual regression testing integrated

### Infrastructure

- ✅ CI/CD runs on every PR without manual intervention
- ✅ PRs blocked from merge if tests fail
- ✅ Test results visible in PR comments
- ✅ Coverage reports automatically generated

### Developer Experience

- ✅ Clear error messages when tests fail
- ✅ Documentation matches reality
- ✅ New developers can run tests in <5 minutes
- ✅ Pre-commit hooks catch issues before CI

---

## 📊 Progress Tracking

### Week 1 Milestones

| Day         | Goal                     | Success Metric                           |
| ----------- | ------------------------ | ---------------------------------------- |
| **Day 1**   | Fix E2E config paths     | `npm run test:e2e` runs without errors   |
| **Day 1**   | Fix GitHub Actions paths | CI workflows execute without path errors |
| **Day 2-3** | Fix unit test signatures | >150/184 tests passing (>80%)            |
| **Day 4**   | Update documentation     | TESTING.md reflects current state        |
| **Day 5**   | Add test coverage        | Coverage report generated in CI          |

### Success Dashboard

```
Current State → Target State

Unit Tests:       63/184 (35%) → 175/184 (95%)
E2E Tests:        0/9 (0%)     → 9/9 (100%)
CI/CD Status:     ❌ Broken    → ✅ Working
Documentation:    🟡 Outdated  → ✅ Current
Coverage:         ⚫ Unknown   → 🟢 >80%
```

---

## 🔥 Emergency Hotfix Procedures

If tests are blocking critical production fixes:

### Temporary Bypass (Use with caution!)

```yaml
# .github/workflows/ci.yml
# Add this temporarily to unblock deploys:
- name: Run unit tests
  run: pnpm -C server run test
  continue-on-error: true # ⚠️ TEMPORARY - Remove after fixes!
```

### Post-Hotfix Checklist

1. ✅ Create GitHub issue for test fix
2. ✅ Add `# FIXME` comment in bypassed test
3. ✅ Schedule fix for next sprint
4. ✅ Document bypass in CHANGELOG

---

## 📞 Support & Escalation

### Who to Contact

| Issue Type         | Contact              | Response Time |
| ------------------ | -------------------- | ------------- |
| CI/CD broken       | DevOps/Platform team | 2 hours       |
| Test writing help  | Tech Lead            | 1 day         |
| Playwright issues  | Frontend team        | 1 day         |
| Unit test patterns | Backend team         | 1 day         |

### Escalation Path

1. **Developer** → Try fixes in this plan
2. **Team Lead** → Review blockers, prioritize fixes
3. **Tech Lead** → Architectural decisions (if needed)
4. **CTO** → Resource allocation (if >1 week to fix)

---

## ✅ Action Items Summary

### Immediate (Today)

- [ ] Fix `e2e/playwright.config.ts` line 72 (`apps/web` → `client`)
- [ ] Fix `.github/workflows/e2e.yml` line 52 (`apps/api` → `server`)
- [ ] Fix `.github/workflows/ci.yml` line 47 (`apps/api` → `server`)
- [ ] Test E2E config fix: `npm run test:e2e:headed`

### This Week

- [ ] Update all unit test signatures with `tenantId` parameter
- [ ] Verify >80% unit tests passing
- [ ] Update TESTING.md with current status
- [ ] Add pre-test validation script
- [ ] Configure test coverage reporting

### Next Sprint

- [ ] Add pre-commit test hooks
- [ ] Configure PR merge gates
- [ ] Set up visual regression testing
- [ ] Add test flakiness tracking

---

## 📈 Metrics to Track

### Daily

- Unit test pass rate (target: >80% by end of week)
- E2E test execution success (target: 100% by Day 1)
- CI/CD pipeline success rate (target: 100% by Day 1)

### Weekly

- Test coverage percentage (target: >80% in 2 weeks)
- Average test execution time (target: <30s unit, <5min E2E)
- Number of flaky tests (target: 0 in 2 weeks)

### Monthly

- Test writing velocity (tests added per PR)
- Bug catch rate (bugs caught by tests vs production)
- Developer satisfaction (survey: "Can you trust the tests?")

---

## 🎓 Lessons Learned

### What Went Wrong

1. **Multi-tenant refactoring** added parameters without updating tests
2. **Directory restructure** (apps/ → client/server) broke config files
3. **No CI enforcement** allowed broken tests to accumulate
4. **Lint campaign** likely changed signatures without test updates

### How to Prevent

1. ✅ Run tests before committing refactors
2. ✅ Update CI configs when moving directories
3. ✅ Enforce tests in CI from day 1
4. ✅ Pair lint fixes with test signature updates

### Team Recommendations

1. **Code review checklist:** "Did you run tests?"
2. **Refactoring rule:** Update tests FIRST, then implementation
3. **CI/CD rule:** Never merge if CI is failing
4. **Documentation rule:** Update docs in same PR as code changes

---

## 📝 Appendix

### Test File Inventory

**Unit Tests:** (server/test/)

- ✅ `booking-concurrency.spec.ts` (14/14 passing)
- ❌ `availability.service.spec.ts` (2/7 passing)
- ❌ `booking.service.spec.ts` (4/12 passing)
- ❌ `catalog.service.spec.ts` (3/25 passing)
- 🟡 `middleware/auth.spec.ts` (14/15 passing)
- ✅ Other integration tests (mostly passing)

**E2E Tests:** (e2e/tests/)

- ⚫ `admin-flow.spec.ts` (5 scenarios - not running)
- ⚫ `booking-flow.spec.ts` (2 scenarios - not running)
- ⚫ `booking-mock.spec.ts` (2 scenarios - not running)

### Configuration Files

**Playwright:**

- `e2e/playwright.config.ts` - ❌ NEEDS FIX (line 72)

**CI/CD:**

- `.github/workflows/ci.yml` - ❌ NEEDS FIX (line 47)
- `.github/workflows/e2e.yml` - ❌ NEEDS FIX (line 52)

**Documentation:**

- `TESTING.md` - 🟡 NEEDS UPDATE
- `TEST_RECOVERY_PLAN.md` - ✅ THIS DOCUMENT

### Environment Variables

**Required for E2E:**

```bash
VITE_API_URL=http://localhost:3001
VITE_APP_MODE=mock
VITE_E2E=1
ADAPTERS_PRESET=mock
```

**Required for Unit:**

```bash
NODE_ENV=test
# No other vars needed (uses mock adapters)
```

---

**End of Test Recovery Plan**

_Next Review Date: 2025-11-15_
_Owner: Engineering Team_
_Reviewers: Tech Lead, QA Lead_
