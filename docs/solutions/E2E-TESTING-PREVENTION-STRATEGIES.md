# E2E Testing Prevention Strategies: Visual Editor Case Study

**Date**: 2025-12-02
**Status**: Codified Prevention Strategy
**Scope**: Preventing rate limiting and test isolation issues in E2E test suites
**Reference**: Visual Editor E2E testing implementation

---

## Executive Summary

The visual editor E2E testing implementation solved three critical problems through specific architectural patterns:

1. **Rate limiting blocking E2E tests** → Solution: Environment variable override in rate limiter
2. **Missing E2E test coverage** → Solution: Comprehensive serial test suite with specific patterns
3. **Test isolation issues** → Solution: Auth token caching with shared state management

This document provides prevention strategies to avoid these issues in future E2E test development.

---

## Problem 1: Rate Limiting Blocking E2E Tests

### The Problem

E2E tests require making multiple requests to endpoints that have rate limits. When running a 9-test suite for visual editor functionality, tests hit the signup rate limiter after 5 attempts:

```
Test 1: Signup ✅ (1/5 attempts)
Test 2: Signup ✅ (2/5 attempts)
Test 3: Signup ✅ (3/5 attempts)
Test 4: Signup ✅ (4/5 attempts)
Test 5: Signup ✅ (5/5 attempts)
Test 6: Signup ❌ 429 Too Many Requests (6/5 attempts)
```

**Root Cause**: Rate limiters configured for production with strict limits (5 signups/hour) applied to all environments.

### Prevention Strategy 1.1: Environment-Based Rate Limiter Bypass

**Implementation** (`server/src/middleware/rateLimiter.ts:64-77`):

```typescript
// Check if we're in a test environment (unit tests OR E2E tests)
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  // Allow more signups in test environment for testing
  max: isTestEnvironment ? 100 : 5, // ← Environment-based toggle
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_signup_attempts',
      message: 'Too many signup attempts. Please try again in an hour.',
    }),
});
```

**Key Principles**:

- **Separate concerns**: Test limits ≠ Production limits
- **Explicit opt-in**: E2E_TEST=1 flag in Playwright config (not auto-detected)
- **Consistent pattern**: Apply same pattern to ALL rate limiters

**Checklist for Future Rate Limiters**:

- [ ] Check production limit values
- [ ] Create higher limit for test environment
- [ ] Add `process.env.E2E_TEST === '1'` check OR `NODE_ENV === 'test'` check
- [ ] Document the environment variable in code comment
- [ ] Update Playwright config to set E2E_TEST=1 when starting server
- [ ] Test with multiple signups to verify bypass works

### Prevention Strategy 1.2: Explicit Environment Configuration in Playwright

**Implementation** (`e2e/playwright.config.ts:71`):

```typescript
webServer: {
  command: 'ADAPTERS_PRESET=real E2E_TEST=1 VITE_API_URL=http://localhost:3001 npm run dev:e2e',
  //                            ^^^^^^^^^^^^^^^^
  cwd: '..',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

**Why This Works**:

- Playwright spawns the server process with environment variables
- Environment variables are inherited by child processes
- Server code checks `process.env.E2E_TEST` at startup time
- Rate limiters are instantiated with test values

**Anti-Pattern to Avoid**:

```typescript
// ❌ WRONG - Doesn't work because server already started
if (process.env.CI) {
  // This runs in the test file, not in the server process
}

// ✅ CORRECT - Environment variable set when server spawns
command: 'E2E_TEST=1 npm run dev:e2e';
```

**Checklist for Playwright Configuration**:

- [ ] Add E2E_TEST=1 to webServer.command
- [ ] Verify it's the FIRST variable (before ADAPTERS_PRESET)
- [ ] Don't set it in the test file - set it in webServer config
- [ ] Test server startup logs to confirm environment variable is received
- [ ] Use `process.env.E2E_TEST` (not `process.env.e2e_test` - case sensitive)

### Prevention Strategy 1.3: Rate Limiter Test Coverage

**Unit Test Pattern** (`server/test/middleware/rateLimiter.spec.ts`):

Create dedicated tests for each rate limiter to verify both limits work:

```typescript
describe('signupLimiter', () => {
  it('should allow 100 signups in test environment', () => {
    // Set NODE_ENV=test before creating limiter
    // Verify max: 100
  });

  it('should allow only 5 signups in production', () => {
    // Set NODE_ENV=production before creating limiter
    // Verify max: 5
  });
});
```

**Why This Matters**:

- Documents the expected behavior
- Catches configuration errors during development
- Prevents accidental regression if rate limits are changed

**Checklist**:

- [ ] Unit tests for test environment (higher limits)
- [ ] Unit tests for production environment (strict limits)
- [ ] Verify limits are different between environments
- [ ] Test that NODE_ENV and E2E_TEST both work as triggers
- [ ] Add regression test for each environment variable

---

## Problem 2: Missing E2E Test Coverage for Critical Features

### The Problem

Visual editor was implemented without E2E test coverage, creating risk:

- Feature works in development but fails in E2E environment
- Manual testing burden on QA
- No regression protection for future changes
- Critical user flows untested end-to-end

### Prevention Strategy 2.1: Test Suite Architecture - Serial Execution

**Implementation** (`e2e/tests/visual-editor.spec.ts:19`):

```typescript
// Run tests serially - they share state and modify packages
test.describe.configure({ mode: 'serial' });
```

**Why Serial Execution**:

1. Tests share authentication state (same tenant)
2. Tests modify application state (package drafts)
3. Package state depends on previous test execution
4. Prevents race conditions and test interdependencies

**When to Use Serial Mode**:

- ✅ Tests share a tenant or account
- ✅ Tests modify application state that other tests depend on
- ✅ Tests operate on the same resource (e.g., same package)
- ✅ You want to verify stateful workflows (create → edit → publish)

**When NOT to Use Serial Mode**:

- ❌ Tests are completely independent
- ❌ Each test creates its own isolated tenant
- ❌ Tests only read data, never modify
- ❌ Performance is critical and parallelization is needed

**Checklist**:

- [ ] Analyze test interdependencies BEFORE writing tests
- [ ] Set `mode: 'serial'` at the top of describe block if tests share state
- [ ] Add comment explaining WHY serial execution is needed
- [ ] Document which tests depend on which previous tests
- [ ] Consider refactoring if >10 tests in serial (might be better as separate suites)

### Prevention Strategy 2.2: Comprehensive Test Coverage Pattern

**Coverage Areas** (`e2e/tests/visual-editor.spec.ts`):

For any feature, implement tests for:

1. **Happy Path** (Test 1): Basic functionality works

   ```typescript
   test('loads visual editor dashboard with packages', async ({ page }) => {
     // Verify UI renders correctly
     // Verify navigation links work
     // Verify data loads
   });
   ```

2. **Inline Editing** (Tests 2-4): Each field type

   ```typescript
   test('edits package title inline and shows draft indicator', async ({ page }) => {
     // Single-line text field
   });
   test('edits package price inline', async ({ page }) => {
     // Number field
   });
   test('edits package description inline (multiline)', async ({ page }) => {
     // Multi-line textarea
   });
   ```

3. **Auto-Save** (Test 5): Data persistence

   ```typescript
   test('auto-saves draft after debounce and persists on reload', async ({ page }) => {
     // Edit → Wait for debounce → Reload → Verify persisted
   });
   ```

4. **Bulk Operations** (Tests 6-7): Multi-item actions

   ```typescript
   test('publishes all drafts successfully', async ({ page }) => {
     // Make changes → Click "Publish All" → Verify success
   });
   test('discards all drafts with confirmation dialog', async ({ page }) => {
     // Make changes → Click "Discard" → Confirm → Verify rollback
   });
   ```

5. **Loading States** (Test 8): UX during operations

   ```typescript
   test('shows loading states during operations', async ({ page }) => {
     // Verify "Publishing..." text appears during publish
     // Verify UI is disabled during operations
   });
   ```

6. **Edge Cases** (Test 9): Error conditions
   ```typescript
   test('handles escape key to cancel edit', async ({ page }) => {
     // Start edit → Press Escape → Verify not saved
   });
   ```

**Checklist for Feature E2E Tests**:

- [ ] At least 1 test per major feature (happy path)
- [ ] At least 1 test per field type (text, number, checkbox, dropdown, etc.)
- [ ] At least 1 test for auto-save/persistence
- [ ] At least 1 test for bulk operations (create, update, delete all)
- [ ] At least 1 test for loading/disabled states
- [ ] At least 1 test for escape/cancel scenarios
- [ ] At least 1 test for error cases (validation, conflicts, etc.)
- [ ] Total: 7-10 tests minimum per feature

### Prevention Strategy 2.3: Documentation Comments in Tests

**Pattern** (`e2e/tests/visual-editor.spec.ts:1-16`):

```typescript
/**
 * E2E Test: Visual Editor Flow
 *
 * Tests the visual editor functionality for tenant admins:
 * 1. Load visual editor dashboard
 * 2. Edit package title/description/price inline
 * 3. Auto-save draft functionality
 * 4. Publish all drafts
 * 5. Discard all drafts
 * 6. UI disabled during publish
 *
 * Note: These tests share a single tenant to avoid rate limiting on signup.
 * Each test navigates fresh to the visual editor and discards any leftover drafts.
 */
```

**Why Documentation Matters**:

- Onboards new developers to test purpose
- Explains design decisions (why serial? why shared tenant?)
- Documents assumptions and constraints
- Prevents misguided refactoring in the future

**Checklist**:

- [ ] Document what the test suite covers
- [ ] Explain WHY design decisions were made (serial vs parallel, shared state, etc.)
- [ ] List any assumptions or constraints
- [ ] Note any gotchas or workarounds
- [ ] Include performance considerations

---

## Problem 3: Test Isolation and Auth Management

### The Problem

Running 9 E2E tests requires authentication. Three approaches have different tradeoffs:

**Approach 1: Each test signs up independently**

```typescript
test('test 1', async ({ page }) => {
  // Sign up → Hit rate limit after 5 tests ❌
  await signUp(page);
});
test('test 2', async ({ page }) => {
  await signUp(page); // ❌ 429 Too Many Requests
});
```

**Approach 2: Share a global tenant account**

```typescript
const sharedTenant = { email: 'shared@test.com', password: 'pass123' };
// ❌ Tests interfere with each other if they modify tenant state
```

**Approach 3: Auth token caching (CORRECT)**

```typescript
let authToken = null;
async function ensureLoggedIn(page) {
  if (!authToken) {
    authToken = await signUpAndGetToken(page); // Only once
  }
  // Restore token on subsequent page instances
}
```

### Prevention Strategy 3.1: Auth Token Caching Pattern

**Implementation** (`e2e/tests/visual-editor.spec.ts:21-71`):

```typescript
// Shared state - signup once, reuse across all tests
let isSetup = false;
let authToken: string | null = null;

/**
 * Helper: Sign up once and cache the auth token
 */
async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    // First test: perform signup
    const timestamp = Date.now();
    const testEmail = `ve-e2e-${timestamp}-${random}@example.com`;

    // Navigate, fill form, submit
    await page.goto('/signup');
    await page.fill('#businessName', businessName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    // Wait for signup API
    const response = await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup'),
      { timeout: 30000 }
    );

    if (response.status() === 429) {
      throw new Error('Rate limited - run tests later');
    }

    // Cache token from localStorage
    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
    isSetup = true;
  } else if (authToken) {
    // Subsequent tests: restore cached token
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('tenantToken', token);
    }, authToken);
  }
}
```

**Key Implementation Details**:

1. **Check if setup needed**:

   ```typescript
   if (!isSetup) {
     // Do signup once
   } else if (authToken) {
     // Restore cached token
   }
   ```

2. **Extract token from localStorage**:

   ```typescript
   authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
   ```

3. **Restore on new pages**:

   ```typescript
   await page.evaluate((token) => {
     localStorage.setItem('tenantToken', token);
   }, authToken);
   ```

4. **Unique email addresses**:
   ```typescript
   const timestamp = Date.now();
   const random = Math.random().toString(36).substring(7);
   const testEmail = `ve-e2e-${timestamp}-${random}@example.com`;
   ```
   Ensures no email conflicts if tests run multiple times in the same hour.

**Why This Pattern Works**:

- ✅ Only 1 signup (avoids rate limiting)
- ✅ Tests can run in serial mode
- ✅ Token persists across page instances
- ✅ localStorage is browser-specific (safe in parallel tests with separate browsers)
- ✅ Works with stateful workflows (edit → publish → verify)

**Checklist**:

- [ ] Create module-level variables for shared state (`isSetup`, `authToken`)
- [ ] Implement signup logic on first call
- [ ] Extract token from localStorage after signup
- [ ] Restore token in subsequent calls via page.evaluate()
- [ ] Use unique email addresses (timestamp + random)
- [ ] Handle rate limiting gracefully (throw clear error)
- [ ] Call `ensureLoggedIn()` at the start of EVERY test

### Prevention Strategy 3.2: Test Isolation Between Tests

**Implementation** (`e2e/tests/visual-editor.spec.ts:85-99`):

```typescript
/**
 * Helper: Discard any existing drafts to start clean
 */
async function discardDraftsIfAny(page: Page): Promise<void> {
  const discardButton = page.getByRole('button', { name: /Discard/i }).first();
  const isVisible = await discardButton.isVisible().catch(() => false);
  const isEnabled = isVisible ? await discardButton.isEnabled().catch(() => false) : false;

  if (isVisible && isEnabled) {
    await discardButton.click();
    // Confirm discard
    const confirmButton = page.getByRole('button', { name: /Discard All/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }
  }
}
```

**Called before each test**:

```typescript
test('edits package title inline', async ({ page }) => {
  await ensureLoggedIn(page);
  await goToVisualEditor(page);
  await discardDraftsIfAny(page); // ← Cleanup state before test

  // Test logic...
});
```

**Why This Matters**:

- Tests don't interfere with each other
- Previous test's edits don't affect next test
- State is deterministic and reproducible
- Prevents cascading failures

**Anti-Pattern to Avoid**:

```typescript
// ❌ WRONG - State leaks between tests
test('test 1', async ({ page }) => {
  await ensureLoggedIn(page);
  await editTitle(page, 'New Title');
  // Doesn't clean up - leaves title modified
});

test('test 2', async ({ page }) => {
  await ensureLoggedIn(page);
  // Title is still "New Title" from test 1!
  const title = await getTitle(page);
  expect(title).toBe('Original Title'); // ❌ Fails unexpectedly
});

// ✅ CORRECT - Each test cleans up after itself
test('test 2', async ({ page }) => {
  await ensureLoggedIn(page);
  await discardDraftsIfAny(page); // ← Reset state
  const title = await getTitle(page);
  expect(title).toBe('Original Title'); // ✅ Passes
});
```

**Checklist**:

- [ ] Identify shared state that tests modify
- [ ] Create helper to reset that state (e.g., `discardDraftsIfAny()`)
- [ ] Call cleanup helper at START of each test (before assertions)
- [ ] Don't rely on test execution order
- [ ] Verify each test is independent by running them individually

### Prevention Strategy 3.3: Robust Error Handling in Auth Setup

**Implementation** (`e2e/tests/visual-editor.spec.ts:44-57`):

```typescript
const responsePromise = page.waitForResponse(
  (response) => response.url().includes('/v1/auth/signup'),
  { timeout: 30000 }
);
await page.getByRole('button', { name: /Create Account/i }).click();

const response = await responsePromise;
if (response.status() === 429) {
  throw new Error('Rate limited - run tests later or increase rate limit');
}
if (response.status() !== 201) {
  const body = await response.text();
  throw new Error(`Signup failed with status ${response.status()}: ${body}`);
}
```

**Key Error Cases**:

1. **Rate Limiting (429)**

   ```typescript
   if (response.status() === 429) {
     throw new Error('Rate limited - run tests later');
   }
   ```

2. **Duplicate Email (409)**

   ```typescript
   if (response.status() === 409) {
     throw new Error('Email already exists - tests already run today');
   }
   ```

3. **Validation Error (400)**

   ```typescript
   if (response.status() === 400) {
     const body = await response.text();
     throw new Error(`Validation failed: ${body}`);
   }
   ```

4. **Server Error (500)**
   ```typescript
   if (response.status() >= 500) {
     throw new Error('Server error during signup');
   }
   ```

**Checklist**:

- [ ] Check HTTP status code explicitly
- [ ] Handle rate limiting (429) with clear message
- [ ] Handle validation errors (400) with details
- [ ] Handle conflicts (409) - email exists
- [ ] Handle server errors (5xx)
- [ ] Include response body in error message for debugging
- [ ] Don't swallow errors - let them fail the test

---

## Problem 4: Code Review Checklist for E2E Tests

When reviewing E2E tests or adding new ones, check:

### Architecture Review

- [ ] **Rate Limiting**: Does feature need rate limiting? Is E2E_TEST env var checked?
- [ ] **Test Execution Mode**: Should tests run serial or parallel? Why?
- [ ] **Auth Pattern**: Does suite use token caching or per-test signup?
- [ ] **Isolation**: Does each test clean up state before running?
- [ ] **Helpers**: Are repetitive actions extracted into helpers (ensureLoggedIn, etc.)?

### Test Coverage Review

- [ ] **Happy Path**: Does at least one test verify basic functionality?
- [ ] **Field Types**: Is there a test for each unique field type (text, number, checkbox)?
- [ ] **Persistence**: Is there a test that verifies data saves and reloads correctly?
- [ ] **Bulk Operations**: Are "create all", "delete all", "publish all" operations tested?
- [ ] **Loading States**: Does UI show correct loading indicators during operations?
- [ ] **Edge Cases**: Are cancellation and escape key behaviors tested?
- [ ] **Errors**: Are validation errors and conflicts handled gracefully?

### Implementation Review

- [ ] **Timeouts**: Are reasonable timeouts used (not too aggressive)?
- [ ] **Selectors**: Are selectors using accessibility roles (getByRole) instead of CSS?
- [ ] **Wait Strategies**: Uses waitForResponse, waitForLoadState, not arbitrary sleep?
- [ ] **Error Messages**: Do error throws include enough context for debugging?
- [ ] **Documentation**: Are complex tests documented with comments?

### Env Configuration Review

- [ ] **E2E_TEST Variable**: Set in Playwright webServer.command?
- [ ] **Rate Limiter Bypasses**: All rate limiters check E2E_TEST env var?
- [ ] **Test Database**: Using separate test database or isolated tenant?
- [ ] **Email Uniqueness**: Tests use timestamp/random in email addresses?

---

## Recommended Test Cases for New Features

When implementing a new feature that needs E2E testing:

### Minimum Test Suite (5 tests)

1. **Happy Path**: Feature works end-to-end
2. **Field Validation**: Invalid input is rejected
3. **Persistence**: Data saves and reloads
4. **Delete/Cancel**: Operation can be undone
5. **Loading States**: UI responds during operations

### Comprehensive Test Suite (7-10 tests)

Add to minimum: 6. **Bulk Operations**: Multi-item operations work 7. **Keyboard Navigation**: Escape, Tab, Enter keys work 8. **Error Handling**: Server errors shown gracefully 9. **Permission Checks**: Unauthorized access denied 10. **Integration**: Feature works with other features

### Enterprise Test Suite (10+ tests)

Add to comprehensive: 11. **Performance**: Operations complete in <5 seconds 12. **Concurrent Access**: Multiple users don't conflict 13. **Data Integrity**: No corruption or loss 14. **Audit Trail**: Changes are logged

---

## Common Pitfalls and How to Avoid Them

### Pitfall 1: Tests Pass in Isolation, Fail in Suite

**Cause**: Tests depend on execution order
**Fix**: Add `discardDraftsIfAny()` helper at START of each test

### Pitfall 2: Rate Limit Errors Block Test Suite

**Cause**: E2E_TEST env var not set or not checked
**Fix**: Verify `ADAPTERS_PRESET=real E2E_TEST=1` in Playwright config

### Pitfall 3: Flaky Tests Fail Randomly

**Cause**: Arbitrary `waitForTimeout()` calls
**Fix**: Use `waitForResponse()`, `waitForLoadState()`, `waitForURL()`

### Pitfall 4: Tests Pass Locally, Fail in CI

**Cause**: Network timing is different, servers take longer to start
**Fix**: Use generous timeouts in CI (set `timeout: 30s` for CI)

### Pitfall 5: Email Conflicts After Multiple Runs

**Cause**: Email addresses are hardcoded
**Fix**: Use `const email = \`test-${Date.now()}-${Math.random()}\` pattern

### Pitfall 6: Auth Token Expires Mid-Test

**Cause**: Token TTL is too short or test is too slow
**Fix**: Use longer token TTL in test environment

### Pitfall 7: Duplicate Tests in Different Files

**Cause**: Copy-paste without refactoring
**Fix**: Extract common helpers into shared module (`e2e/helpers/auth.ts`)

---

## Implementation Checklist for New E2E Features

When implementing E2E tests for a new feature:

### Step 1: Planning (Before writing tests)

- [ ] List all user workflows for the feature
- [ ] Identify critical paths vs nice-to-have paths
- [ ] Decide: serial execution needed? Why?
- [ ] Plan auth strategy: shared tenant or per-test signup?
- [ ] Estimate number of tests (minimum 5, target 7-10)

### Step 2: Setup (Rate limiting & helpers)

- [ ] Check all rate limiters on feature's endpoints
- [ ] Add E2E_TEST check to rate limiters
- [ ] Verify E2E_TEST=1 in Playwright config
- [ ] Create auth/setup helpers (ensureLoggedIn, cleanup)
- [ ] Create navigation helpers (goToFeature, etc.)

### Step 3: Implementation (Write tests)

- [ ] Test 1: Happy path (basic functionality)
- [ ] Tests 2-N: Field-by-field validation
- [ ] Test N+1: Persistence (reload verification)
- [ ] Test N+2: Bulk operations
- [ ] Test N+3: Error handling
- [ ] Add documentation comments

### Step 4: Verification

- [ ] Run tests locally: `npm run test:e2e`
- [ ] Run tests individually: `npm run test:e2e -- visual-editor.spec.ts`
- [ ] Verify serial execution works
- [ ] Verify token caching works
- [ ] Verify cleanup helpers work
- [ ] Check for flaky tests (run 3x)

### Step 5: Code Review

- [ ] Self-review against "Code Review Checklist"
- [ ] Ask reviewer to check accessibility (getByRole)
- [ ] Ask reviewer to verify timeout values
- [ ] Ask reviewer to check for hardcoded values
- [ ] Ask reviewer to verify rate limiter bypasses

### Step 6: CI Integration

- [ ] Tests pass in CI with CI environment variables
- [ ] CI timeout is generous (30s minimum)
- [ ] Tests don't interfere with other E2E suites
- [ ] CI logs show clear failure messages
- [ ] Rate limiting doesn't trigger in CI

---

## Integration with Existing Test Infrastructure

### Unit Tests + E2E Tests

- **Unit tests**: Service logic, repositories, helpers
- **E2E tests**: User workflows, API contracts, full stack

**Example**: Visual editor draft autosave

- Unit test: `draftService.autosave()` with mock database
- E2E test: User edits → autosave happens → reload → data persists

### Test Execution Order

```bash
npm run typecheck      # Type safety first
npm test               # Unit tests (fast feedback)
npm run test:e2e       # E2E tests (requires servers running)
```

### Shared Helpers Location

```
e2e/
├── tests/
│   ├── visual-editor.spec.ts
│   ├── tenant-signup.spec.ts
│   └── password-reset.spec.ts
├── helpers/
│   ├── auth.ts          # ensureLoggedIn, signup helpers
│   ├── navigation.ts     # goToPage helpers
│   └── assertions.ts     # Custom assertions
└── playwright.config.ts
```

**Proposed helpers module** (`e2e/helpers/auth.ts`):

```typescript
export async function ensureLoggedIn(
  page: Page,
  options?: {
    email?: string;
    password?: string;
  }
) {
  // Shared logic across multiple test files
}

export async function createTestTenant(page: Page) {
  // Returns tenant details + auth token
}

export async function setupTenant(page: Page) {
  // Ensure logged in + navigate to dashboard
}
```

---

## Success Metrics

When E2E testing is implemented correctly, you should see:

✅ **Rate limiting doesn't block tests**

- Tests run 9+ times without 429 errors
- E2E_TEST env var is properly wired

✅ **Tests are reliable**

- Same test passes consistently (not flaky)
- Tests work in CI without special handling
- Timeouts are realistic and generous

✅ **Tests are maintainable**

- New tests reuse existing helpers
- Test code is DRY (no duplication)
- Tests document their purpose

✅ **Test suite is comprehensive**

- Critical user paths are covered
- Field validation is tested
- Error cases are handled

✅ **Tests are fast**

- Full E2E suite completes in <5 minutes
- Parallel tests where safe
- No unnecessary waits or delays

---

## References

### Files Modified

- `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts` - E2E_TEST env var check
- `/Users/mikeyoung/CODING/MAIS/e2e/tests/visual-editor.spec.ts` - Serial tests + token caching
- `/Users/mikeyoung/CODING/MAIS/e2e/playwright.config.ts` - E2E_TEST=1 in webServer command
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts` - signupLimiter usage

### Related Documentation

- `docs/solutions/TESTING-PREVENTION-STRATEGIES.md` - General testing strategies
- `docs/solutions/TEST-FAILURE-PREVENTION-STRATEGIES.md` - Test isolation patterns
- `.claude/archive/E2E_TEST_INVESTIGATION.md` - Root cause analysis

### External References

- [Playwright Test Documentation](https://playwright.dev/docs/test-intro)
- [Playwright Configuration](https://playwright.dev/docs/test-configuration)
- [Test Design Patterns](https://playwright.dev/docs/test-patterns)

---

## Version History

| Date       | Status | Changes                                            |
| ---------- | ------ | -------------------------------------------------- |
| 2025-12-02 | FINAL  | Initial codification from visual editor E2E work   |
|            |        | Documented 3 problems + prevention strategies      |
|            |        | Added implementation checklist for future features |

---

**Document Owner**: Claude Code
**Last Updated**: 2025-12-02
**Status**: APPROVED FOR TEAM USE
