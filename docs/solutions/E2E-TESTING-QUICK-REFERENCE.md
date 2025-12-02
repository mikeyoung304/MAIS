# E2E Testing Quick Reference - Print & Pin!

## Problem 1: Rate Limiting Blocks E2E Tests

### Solution: Environment Variable Override

**Rate Limiter Code** (`server/src/middleware/rateLimiter.ts`):
```typescript
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,  // ← Higher in test env
});
```

**Playwright Config** (`e2e/playwright.config.ts`):
```typescript
webServer: {
  command: 'E2E_TEST=1 ADAPTERS_PRESET=real ... npm run dev:e2e',
  //        ^^^^^^^^^^^^^^^^
  // Must be in webServer.command, not in test file!
},
```

**Checklist**:
- [ ] Rate limiter checks `E2E_TEST=1` or `NODE_ENV=test`
- [ ] Playwright config sets `E2E_TEST=1` in webServer.command
- [ ] Different limits for test vs production
- [ ] Test limit is high enough (100+)
- [ ] All rate limiters follow same pattern

---

## Problem 2: Missing E2E Test Coverage

### Solution: Serial Execution + Comprehensive Coverage

**Test Structure**:
```typescript
// Run tests serially - they share state
test.describe.configure({ mode: 'serial' });

test.describe('Visual Editor', () => {
  test('1. loads dashboard', async ({ page }) => { });
  test('2. edits title inline', async ({ page }) => { });
  test('3. edits price inline', async ({ page }) => { });
  test('4. edits description', async ({ page }) => { });
  test('5. auto-saves and persists', async ({ page }) => { });
  test('6. publishes all drafts', async ({ page }) => { });
  test('7. discards all drafts', async ({ page }) => { });
  test('8. shows loading states', async ({ page }) => { });
  test('9. handles escape key', async ({ page }) => { });
});
```

**Why 7-10 Tests**:
- 1 happy path (basic functionality)
- 2-4 field tests (one per field type)
- 1 persistence test (reload verification)
- 1-2 bulk operation tests (publish/discard/delete all)
- 1 loading state test
- 1+ edge case test (escape, cancel, validation)

**Checklist**:
- [ ] Serial execution for shared state
- [ ] 7-10 tests minimum per feature
- [ ] Each test has clear, specific name
- [ ] Tests documented with comments
- [ ] Happy path is first test
- [ ] Persistence is verified

---

## Problem 3: Auth & Test Isolation

### Solution: Token Caching + Cleanup Helpers

**Token Caching Pattern**:
```typescript
let authToken: string | null = null;
let isSetup = false;

async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    // First test: signup
    const email = `ve-e2e-${Date.now()}-${Math.random()}\@example.com`;
    await page.goto('/signup');
    await page.fill('#email', email);
    // ... fill form ...
    await page.getByRole('button', { name: /Create Account/i }).click();

    // Wait for response
    const response = await page.waitForResponse(
      r => r.url().includes('/v1/auth/signup'),
      { timeout: 30000 }
    );

    if (response.status() === 429) {
      throw new Error('Rate limited - run tests later');
    }

    // Cache token
    authToken = await page.evaluate(() =>
      localStorage.getItem('tenantToken')
    );
    isSetup = true;
  } else if (authToken) {
    // Subsequent tests: restore token
    await page.goto('/');
    await page.evaluate((token) =>
      localStorage.setItem('tenantToken', token),
      authToken
    );
  }
}
```

**Cleanup Pattern**:
```typescript
async function discardDraftsIfAny(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /Discard/i }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    const confirmBtn = page.getByRole('button', { name: /Discard All/i });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
  }
}

// Call in EVERY test before assertions
test('some test', async ({ page }) => {
  await ensureLoggedIn(page);
  await goToFeature(page);
  await discardDraftsIfAny(page);  // ← Reset state first

  // Test logic...
});
```

**Checklist**:
- [ ] Module-level `authToken` and `isSetup` variables
- [ ] Signup only happens on first `ensureLoggedIn()` call
- [ ] Subsequent calls restore cached token
- [ ] Unique email: `\`test-${Date.now()}-${Math.random()}\`
- [ ] Clear error if rate limited (429)
- [ ] Cleanup helper called at START of each test
- [ ] Cleanup verifies state before acting

---

## Implementation Checklist

### Before Writing Tests
- [ ] List all user workflows
- [ ] Decide: serial execution? (shared state = YES)
- [ ] Plan auth: shared tenant with token caching
- [ ] Estimate test count (minimum 7, target 10)
- [ ] Check for existing rate limiters on feature endpoints

### Rate Limiter Setup
- [ ] Find all rate limiters on feature endpoints
- [ ] Add `E2E_TEST` check to each limiter
- [ ] Higher limits in test: 100+ vs production: 5
- [ ] Update Playwright config: `E2E_TEST=1` in webServer.command
- [ ] Verify rate limiter tests cover both environments

### Test Implementation
- [ ] `test.describe.configure({ mode: 'serial' })`
- [ ] Create `ensureLoggedIn()` helper
- [ ] Create cleanup helpers (`discardDraftsIfAny()`, etc.)
- [ ] Create navigation helpers (`goToFeature()`, etc.)
- [ ] Write 7-10 tests covering all scenarios
- [ ] Call `ensureLoggedIn()` at start of EVERY test
- [ ] Call cleanup helpers BEFORE assertions
- [ ] Use `getByRole()` for selectors, not CSS

### Verification
- [ ] Tests pass locally: `npm run test:e2e`
- [ ] Tests pass individually: `npm run test:e2e -- file.spec.ts`
- [ ] No flaky tests (run 3x)
- [ ] Token caching works (verify signup happens once)
- [ ] Cleanup works (state is fresh each test)
- [ ] E2E_TEST env var is working (rate limit not hit)

### Code Review
- [ ] Check for hardcoded email addresses (use timestamp/random)
- [ ] Check for arbitrary `waitForTimeout()` (use waitForResponse, waitForLoadState)
- [ ] Check for CSS selectors (should use getByRole)
- [ ] Check for clear error messages and helpful debugging info
- [ ] Verify timeout values are realistic (30s+ for auth, 15s+ for operations)
- [ ] Verify rate limiter bypass is in place

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| "E2E_TEST=1 in test file" | Set in Playwright `webServer.command` |
| "Each test does signup" | Cache token, reuse across tests |
| "Tests fail randomly" | Use waitForResponse/waitForLoadState, not sleep |
| "Email conflicts" | Use `\`test-${Date.now()}-${Math.random()}\`` |
| "Tests interfere" | Add cleanup at START of each test |
| "Rate limit 429" | Verify E2E_TEST=1 in Playwright config |
| "Escape key doesn't work" | Use `input.press('Escape')` not `.blur()` |
| "Data not persisted" | Add reload test with waitForLoadState |
| "Hardcoded selectors break" | Use getByRole, getByLabel, not locator('button.foo') |

---

## Rate Limiter Environment Check Template

Use this template for ALL rate limiters:

```typescript
// server/src/middleware/rateLimiter.ts

const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const featureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnvironment ? 100 : 5,  // ← Different limits
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Rate limit exceeded',
    }),
});
```

---

## Playwright Config Template

Use this template for E2E_TEST env var:

```typescript
// e2e/playwright.config.ts

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,

  use: {
    baseURL: 'http://localhost:5173',
    timezoneId: 'UTC',
  },

  webServer: {
    // Set E2E_TEST=1 when starting server
    command: 'E2E_TEST=1 ADAPTERS_PRESET=real VITE_API_URL=http://localhost:3001 npm run dev:e2e',
    //        ^^^^^^^^^^^^^^^^
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

---

## Test File Template

```typescript
import { test, expect, Page } from '@playwright/test';

// Serial execution for shared state
test.describe.configure({ mode: 'serial' });

// Shared state - signup once
let isSetup = false;
let authToken: string | null = null;

async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    // First test: signup
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const testEmail = `feature-e2e-${timestamp}-${random}@example.com`;

    await page.goto('/signup');
    await page.fill('#email', testEmail);
    // ... fill form ...

    const response = await page.waitForResponse(
      r => r.url().includes('/v1/auth/signup'),
      { timeout: 30000 }
    );

    if (response.status() === 429) {
      throw new Error('Rate limited - run later');
    }

    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
    isSetup = true;
  } else if (authToken) {
    // Restore token
    await page.goto('/');
    await page.evaluate((token) =>
      localStorage.setItem('tenantToken', token),
      authToken
    );
  }
}

async function cleanupState(page: Page): Promise<void> {
  // Reset application state before assertions
}

test.describe('Feature Name', () => {
  test('1. loads correctly', async ({ page }) => {
    await ensureLoggedIn(page);
    await cleanupState(page);

    // Test assertions
  });

  test('2. edits field', async ({ page }) => {
    await ensureLoggedIn(page);
    await cleanupState(page);

    // Test assertions
  });

  // ... more tests ...
});
```

---

## When to Use Serial vs Parallel

**USE SERIAL** (`test.describe.configure({ mode: 'serial' })`) when:
- ✅ Tests share authentication (same tenant/user)
- ✅ Tests modify state that other tests depend on
- ✅ Tests operate on same resource (same package, same booking)
- ✅ You need to verify stateful workflows (create → edit → publish)

**USE PARALLEL** (default) when:
- ✅ Each test creates its own isolated tenant/account
- ✅ Tests only read data, never write
- ✅ Tests are completely independent
- ✅ Performance is critical

---

## Success Indicators

You've done E2E testing RIGHT when:

✅ Tests run 9+ times without hitting rate limit
✅ Same test always passes (not flaky)
✅ Tests work in CI without special configuration
✅ Test suite completes in <5 minutes
✅ New tests reuse existing helpers (code is DRY)
✅ Failures have clear error messages
✅ Tests document critical user workflows

---

## File Locations

| Item | Location |
|------|----------|
| Rate Limiters | `server/src/middleware/rateLimiter.ts` |
| E2E Tests | `e2e/tests/*.spec.ts` |
| Playwright Config | `e2e/playwright.config.ts` |
| Auth Routes | `server/src/routes/auth.routes.ts` |
| Rate Limiter Tests | `server/test/middleware/rateLimiter.spec.ts` |
| E2E Helpers (proposed) | `e2e/helpers/*.ts` |

---

## See Also

- `E2E-TESTING-PREVENTION-STRATEGIES.md` - Full documentation
- `TESTING-PREVENTION-STRATEGIES.md` - General testing strategies
- `TEST-FAILURE-PREVENTION-STRATEGIES.md` - Test isolation deep dive
