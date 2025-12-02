# E2E Testing Documentation Index

**Purpose**: Central hub for E2E testing prevention strategies
**Date**: 2025-12-02
**Status**: Complete Documentation Set

---

## Quick Navigation

### I'm in a hurry (2 minutes)
→ Read: **E2E-TESTING-QUICK-REFERENCE.md**
- One-page cheat sheet
- Copy-paste code templates
- Common mistakes to avoid

### I'm implementing E2E tests (30 minutes)
→ Read: **E2E-TESTING-PREVENTION-STRATEGIES.md**
- Complete prevention strategy documentation
- Problem → Solution → Implementation details
- Code review checklist
- Test case recommendations

### I'm extending test infrastructure (1 hour)
→ Read: **E2E-TESTING-ADVANCED-PATTERNS.md**
- Shared helpers module
- Multi-tenant testing
- Concurrent user simulation
- Performance testing integration
- CI/CD patterns
- Test data factories

---

## Documentation Map

```
E2E Testing Documentation/
├── E2E-TESTING-QUICK-REFERENCE.md (Print & Pin!)
│   ├── Problem 1: Rate limiting blocks tests
│   ├── Problem 2: Missing test coverage
│   ├── Problem 3: Auth & test isolation
│   ├── Implementation checklist
│   ├── Common mistakes
│   └── Templates
│
├── E2E-TESTING-PREVENTION-STRATEGIES.md (Main document)
│   ├── Executive summary
│   ├── Problem 1: Rate limiting
│   │   ├── Prevention Strategy 1.1: Environment-based bypass
│   │   ├── Prevention Strategy 1.2: Playwright config
│   │   └── Prevention Strategy 1.3: Test coverage
│   ├── Problem 2: Missing coverage
│   │   ├── Prevention Strategy 2.1: Serial execution
│   │   ├── Prevention Strategy 2.2: Comprehensive coverage
│   │   └── Prevention Strategy 2.3: Documentation
│   ├── Problem 3: Test isolation
│   │   ├── Prevention Strategy 3.1: Token caching
│   │   ├── Prevention Strategy 3.2: State isolation
│   │   └── Prevention Strategy 3.3: Error handling
│   ├── Code review checklist
│   ├── Recommended test cases
│   ├── Common pitfalls
│   ├── Implementation checklist
│   └── Integration with existing tests
│
├── E2E-TESTING-ADVANCED-PATTERNS.md (Reference)
│   ├── Shared helpers module
│   ├── Multi-tenant testing
│   ├── Concurrent user simulation
│   ├── Performance testing integration
│   ├── Debugging flaky tests
│   ├── CI/CD integration
│   └── Test data factories
│
└── E2E-TESTING-INDEX.md (This file)
    └── Navigation guide
```

---

## Problem → Solution Mapping

### Problem: Rate Limiting Blocks E2E Tests

**Location**: `E2E-TESTING-PREVENTION-STRATEGIES.md` § Problem 1 (Lines 37-101)

**Quick Summary**:
- E2E tests hit signup rate limit after 5 attempts
- Solution: Set `E2E_TEST=1` env var to override limits

**Key Code**:
```typescript
// server/src/middleware/rateLimiter.ts
const isTestEnvironment = process.env.E2E_TEST === '1';
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,  // Higher in tests
});
```

```typescript
// e2e/playwright.config.ts
command: 'E2E_TEST=1 ADAPTERS_PRESET=real npm run dev:e2e'
```

**Related Files**:
- `server/src/middleware/rateLimiter.ts` - Rate limiter implementation
- `e2e/playwright.config.ts` - Playwright configuration
- `server/test/middleware/rateLimiter.spec.ts` - Rate limiter tests

---

### Problem: Missing E2E Test Coverage

**Location**: `E2E-TESTING-PREVENTION-STRATEGIES.md` § Problem 2 (Lines 103-241)

**Quick Summary**:
- Visual editor had no E2E tests
- Solution: Create 7-10 tests with serial execution

**Test Structure** (9 tests minimum):
1. Happy path (load dashboard)
2-4. Field editing (title, price, description)
5. Persistence (reload verification)
6-7. Bulk operations (publish, discard)
8. Loading states
9. Edge cases (escape key)

**Key Code**:
```typescript
// e2e/tests/visual-editor.spec.ts
test.describe.configure({ mode: 'serial' });

test.describe('Visual Editor', () => {
  test('1. loads dashboard', async ({ page }) => { });
  test('2. edits title', async ({ page }) => { });
  // ... 7 more tests
});
```

**Related Files**:
- `e2e/tests/visual-editor.spec.ts` - Example implementation
- `e2e/tests/tenant-signup.spec.ts` - Another example (12 tests)
- `e2e/tests/password-reset.spec.ts` - Email flow testing

---

### Problem: Test Isolation & Auth Management

**Location**: `E2E-TESTING-PREVENTION-STRATEGIES.md` § Problem 3 (Lines 243-325)

**Quick Summary**:
- Tests need shared auth without rate limiting on repeated signups
- Solution: Cache auth token, reuse across tests

**Key Code**:
```typescript
let authToken: string | null = null;
let isSetup = false;

async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    // First test: signup once
    authToken = await page.evaluate(() =>
      localStorage.getItem('tenantToken')
    );
    isSetup = true;
  } else if (authToken) {
    // Subsequent tests: restore token
    await page.evaluate((token) =>
      localStorage.setItem('tenantToken', token),
      authToken
    );
  }
}
```

**Related Files**:
- `e2e/tests/visual-editor.spec.ts` - Token caching implementation
- `e2e/helpers/` - Proposed shared helpers location

---

## Implementation Guides

### When to Use This Documentation

| Scenario | Document | Time |
|----------|----------|------|
| "I need to add E2E tests to my feature" | PREVENTION-STRATEGIES.md | 30 min |
| "Tests are flaky and failing" | QUICK-REFERENCE.md + ADVANCED-PATTERNS.md | 1 hour |
| "Rate limiting is blocking my tests" | QUICK-REFERENCE.md § Problem 1 | 5 min |
| "I'm implementing shared helpers" | ADVANCED-PATTERNS.md § Shared Helpers | 1 hour |
| "I need to test multiple tenants" | ADVANCED-PATTERNS.md § Multi-Tenant | 45 min |
| "Tests are slow in CI" | ADVANCED-PATTERNS.md § CI/CD | 30 min |

---

## Code Review Checklist

**Use this when reviewing E2E tests:**

```
☐ Rate Limiting
  ☐ E2E_TEST env var set in Playwright config?
  ☐ All rate limiters check E2E_TEST or NODE_ENV?
  ☐ Different limits for test vs production?

☐ Test Execution
  ☐ Serial mode configured if shared state?
  ☐ 7-10 tests for feature (minimum)?
  ☐ Each test independent from previous?

☐ Auth & Isolation
  ☐ Token caching implemented?
  ☐ Cleanup helpers called at START of tests?
  ☐ Unique emails (timestamp + random)?

☐ Implementation Quality
  ☐ Accessibility roles (getByRole) not CSS selectors?
  ☐ Realistic timeouts (30s+ for auth)?
  ☐ Clear error messages for debugging?
  ☐ No arbitrary waitForTimeout() calls?

☐ Documentation
  ☐ Test suite purpose documented?
  ☐ Design decisions explained?
  ☐ Known limitations/gotchas noted?
```

---

## File Organization

### Test Files
```
e2e/
├── tests/
│   ├── visual-editor.spec.ts        (9 tests, serial)
│   ├── tenant-signup.spec.ts        (12 tests, independent)
│   ├── password-reset.spec.ts       (9 tests, independent)
│   └── booking-flow.spec.ts         (3 tests, serial)
```

### Helper Files (Proposed)
```
e2e/
├── helpers/
│   ├── auth.ts                      (ensureLoggedIn, signupTenant)
│   ├── navigation.ts                (goToPage helpers)
│   ├── assertions.ts                (custom assertions)
│   ├── concurrent.ts                (multi-user simulation)
│   ├── performance.ts               (performance metrics)
│   └── debug.ts                     (debugging utilities)
├── fixtures/
│   └── data-factories.ts            (package, tenant factories)
```

### Configuration
```
e2e/
├── playwright.config.ts             (E2E_TEST=1 in webServer.command)
└── .gitignore
```

---

## Key Metrics for Success

When E2E testing is working correctly, you should observe:

✅ **Rate Limiting Not Blocking Tests**
- 9+ tests pass without 429 errors
- Signup happens only once (token reused)
- E2E_TEST env var properly wired

✅ **Reliable Tests**
- Same test passes consistently (no flakiness)
- Works in CI without special configuration
- Timeouts are realistic (30s+ for auth)

✅ **Maintainable Test Code**
- New tests reuse existing helpers
- Code is DRY (no duplication)
- Tests document their purpose

✅ **Comprehensive Coverage**
- All critical user paths covered
- Field validation tested
- Error cases handled
- Persistence verified (reload test)

✅ **Performance**
- Full E2E suite completes in <5 minutes
- Parallel execution where safe
- No unnecessary waits

---

## Common Questions

### Q: Should I test every field?
**A**: Yes, at least one test per field type (text, number, checkbox, dropdown, etc.)

### Q: How many tests is enough?
**A**: Minimum 7-10 tests per feature. Target 10-15 for comprehensive coverage.

### Q: Can I run tests in parallel?
**A**: Only if tests create their own isolated tenants. Shared state = serial execution.

### Q: My tests are slow - what do I do?
**A**: Check for arbitrary `waitForTimeout()`. Use `waitForResponse()` and `waitForLoadState()` instead.

### Q: Tests pass locally but fail in CI?
**A**: Increase timeouts in CI (30s+ for auth). CI servers are slower.

### Q: How do I test with multiple users?
**A**: See ADVANCED-PATTERNS.md § Concurrent User Simulation

### Q: How do I prevent test isolation issues?
**A**: Call cleanup helpers at START of each test (not after)

### Q: Where should I put shared helpers?
**A**: Propose creating `e2e/helpers/*.ts` module with reusable functions

---

## Version Control

### Committing Test Files
```bash
# Tests are committed to git
git add e2e/tests/*.spec.ts
git add e2e/playwright.config.ts
git add e2e/helpers/           # When created

# But NOT test output
echo 'e2e/playwright-report/' >> .gitignore
echo 'e2e/test-results/' >> .gitignore
```

### Branch Strategy
- E2E tests run on every commit
- Feature branches need passing E2E tests
- CI blocks PR merge if tests fail

---

## Related Documentation

### Testing Documentation
- `TESTING-PREVENTION-STRATEGIES.md` - General test strategies
- `TEST-FAILURE-PREVENTION-STRATEGIES.md` - Test isolation patterns
- `PREVENTION-QUICK-REFERENCE.md` - General prevention strategies

### Security & Reliability
- `SECURITY-INCIDENT-PREVENTION.md` - Multi-tenant isolation
- `SCHEMA-DRIFT-PREVENTION.md` - Database stability
- `WEBHOOK-IDEMPOTENCY-PREVENTION.md` - Webhook testing

### Architecture
- `ARCHITECTURE.md` - System design overview
- `DEVELOPING.md` - Development workflow
- `TESTING.md` - Test strategy overview

---

## Quick Links

| Need | Link |
|------|------|
| Rate limiting solution | `QUICK-REFERENCE.md` § Problem 1 |
| Test coverage checklist | `PREVENTION-STRATEGIES.md` § Problem 2 |
| Auth token caching | `PREVENTION-STRATEGIES.md` § Problem 3 |
| Shared helpers module | `ADVANCED-PATTERNS.md` § 1 |
| Multi-tenant testing | `ADVANCED-PATTERNS.md` § 2 |
| Concurrent users | `ADVANCED-PATTERNS.md` § 3 |
| Performance metrics | `ADVANCED-PATTERNS.md` § 4 |
| Debugging flaky tests | `ADVANCED-PATTERNS.md` § 5 |
| CI/CD integration | `ADVANCED-PATTERNS.md` § 6 |
| Data factories | `ADVANCED-PATTERNS.md` § 7 |

---

## Getting Started

### Step 1: Understand the Problem (5 min)
- Read executive summary in PREVENTION-STRATEGIES.md
- Review the 3 problems addressed

### Step 2: Learn the Solution (15 min)
- Read QUICK-REFERENCE.md (print and pin)
- Review code templates

### Step 3: Implement for Your Feature (30 min)
- Follow "Implementation Checklist" in QUICK-REFERENCE.md
- Copy templates
- Verify rate limiter bypass works

### Step 4: Add Comprehensive Tests (45 min)
- Create 7-10 tests
- Use helpers (ensureLoggedIn, cleanup)
- Document test purpose

### Step 5: Code Review (30 min)
- Self-review against checklist
- Ask reviewer to verify accessibility
- Verify timeout values realistic

---

## Support & Questions

### Debugging Issues
1. Check QUICK-REFERENCE.md "Common Mistakes" section
2. Review ADVANCED-PATTERNS.md "Debugging Flaky Tests"
3. Look at existing test files (visual-editor.spec.ts)
4. Enable debug logging with helpers/debug.ts

### Contributing Improvements
- Add new patterns to ADVANCED-PATTERNS.md
- Update code templates in QUICK-REFERENCE.md
- Share learnings in team discussions

---

## Document Status

| Document | Status | Last Updated | Completeness |
|----------|--------|--------------|--------------|
| QUICK-REFERENCE.md | FINAL | 2025-12-02 | 100% |
| PREVENTION-STRATEGIES.md | FINAL | 2025-12-02 | 100% |
| ADVANCED-PATTERNS.md | FINAL | 2025-12-02 | 100% |
| INDEX.md | FINAL | 2025-12-02 | 100% |

---

**Last Updated**: 2025-12-02
**Maintained By**: Claude Code
**Status**: APPROVED FOR TEAM USE
