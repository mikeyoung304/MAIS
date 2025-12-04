# E2E Testing Advanced Patterns

**Status**: Reference Documentation for Complex Scenarios
**Date**: 2025-12-02
**Target Audience**: Developers extending E2E test infrastructure

---

## Table of Contents

1. Shared Helpers Module
2. Multi-Tenant Testing Patterns
3. Concurrent User Simulation
4. Performance Testing Integration
5. Debugging Flaky Tests
6. CI/CD Integration Patterns
7. Test Data Factories

---

## 1. Shared Helpers Module

### Problem

As E2E test suites grow, helper code gets duplicated across test files:

```typescript
// e2e/tests/visual-editor.spec.ts
async function ensureLoggedIn(page: Page) {
  /* ... */
}

// e2e/tests/tenant-signup.spec.ts
async function ensureLoggedIn(page: Page) {
  /* ... */
}

// ❌ DRY violation - same code in 3+ files
```

### Solution: Extract to Shared Module

**File**: `e2e/helpers/auth.ts`

```typescript
import { Page } from '@playwright/test';

export interface SignupOptions {
  email?: string;
  password?: string;
  businessName?: string;
}

export interface AuthToken {
  token: string;
  tenantId: string;
  slug: string;
}

/**
 * Sign up a new tenant and return auth token + details
 * Handles rate limiting gracefully with clear error messages
 */
export async function signupTenant(page: Page, options: SignupOptions = {}): Promise<AuthToken> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  const email = options.email || `signup-${timestamp}-${random}@example.com`;
  const password = options.password || 'SecurePass123!';
  const businessName = options.businessName || `Test Business ${timestamp}`;

  await page.goto('/signup');

  // Fill form
  await page.fill('#businessName', businessName);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);

  // Wait for response
  const response = await page.waitForResponse((r) => r.url().includes('/v1/auth/signup'), {
    timeout: 30000,
  });

  if (response.status() === 429) {
    throw new Error(
      'Rate limited: Too many signups. ' +
        'Note: Limits reset hourly. ' +
        'Run E2E tests in a different hour.'
    );
  }

  if (response.status() === 409) {
    throw new Error(
      `Email already registered: ${email}. ` + 'Use unique email or run tests in new hour.'
    );
  }

  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Signup failed (${response.status()}): ${body}`);
  }

  // Extract token from response
  const responseData = await response.json();

  // Also verify it's in localStorage
  const localToken = await page.evaluate(() => localStorage.getItem('tenantToken'));

  return {
    token: localToken || responseData.token,
    tenantId: responseData.tenantId,
    slug: responseData.slug,
  };
}

/**
 * Cache and restore auth token across page instances
 * Enables token reuse without repeated signups
 */
export class AuthTokenCache {
  private token: AuthToken | null = null;
  private initialized = false;

  async ensureLoggedIn(page: Page, forceSignup = false): Promise<AuthToken> {
    if (!this.initialized || forceSignup) {
      this.token = await signupTenant(page);
      this.initialized = true;
    }

    if (this.token) {
      await this.restoreToken(page, this.token);
    }

    return this.token!;
  }

  async restoreToken(page: Page, token: AuthToken): Promise<void> {
    await page.goto('/');
    await page.evaluate((t: AuthToken) => {
      localStorage.setItem('tenantToken', t.token);
      localStorage.setItem('tenantId', t.tenantId);
      localStorage.setItem('tenantSlug', t.slug);
    }, token);

    // Wait for auth context to update
    await page.waitForLoadState('networkidle');
  }

  getToken(): AuthToken | null {
    return this.token;
  }

  clear(): void {
    this.token = null;
    this.initialized = false;
  }
}
```

**Usage in Tests**:

```typescript
import { AuthTokenCache } from '../helpers/auth';

test.describe('Feature Suite', () => {
  const authCache = new AuthTokenCache();

  test('test 1', async ({ page }) => {
    await authCache.ensureLoggedIn(page);
    // ... test logic ...
  });

  test('test 2', async ({ page }) => {
    await authCache.ensureLoggedIn(page);
    // Token reused from test 1
    // ... test logic ...
  });
});
```

### Benefits

- ✅ DRY: Code written once, used everywhere
- ✅ Maintainability: Update once, fixes all tests
- ✅ Type Safety: AuthToken interface prevents errors
- ✅ Error Messages: Clear, actionable error handling
- ✅ Testability: Helper can be unit tested

---

## 2. Multi-Tenant Testing Patterns

### Problem

Some features require testing interactions between multiple tenants:

```typescript
// ❌ How do you test multi-tenant isolation without rate limiting?
// ❌ How do you verify tenant A can't access tenant B's data?
```

### Solution: Tenant Factory

**File**: `e2e/helpers/tenant.ts`

```typescript
import { Page } from '@playwright/test';
import { AuthTokenCache } from './auth';

export interface TestTenant {
  cache: AuthTokenCache;
  email: string;
  slug: string;
  tenantId: string;
}

/**
 * Factory for creating multiple test tenants
 * Manages signup rate limiting for multi-tenant tests
 */
export class TenantFactory {
  private tenants: Map<string, TestTenant> = new Map();
  private tenantCount = 0;

  /**
   * Create a new test tenant with unique identity
   * Handles rate limiting by spreading signups across unique emails
   */
  async createTenant(page: Page, name?: string): Promise<TestTenant> {
    const identifier = name || `tenant-${this.tenantCount++}`;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    const email = `${identifier}-${timestamp}-${random}@example.com`;
    const cache = new AuthTokenCache();

    // Signup with cache (only does signup once)
    const token = await cache.ensureLoggedIn(page);

    const tenant: TestTenant = {
      cache,
      email,
      slug: token.slug,
      tenantId: token.tenantId,
    };

    this.tenants.set(identifier, tenant);
    return tenant;
  }

  /**
   * Get previously created tenant by name
   */
  getTenant(name: string): TestTenant | undefined {
    return this.tenants.get(name);
  }

  /**
   * Switch browser context to different tenant
   */
  async switchTenant(page: Page, tenant: TestTenant): Promise<void> {
    await tenant.cache.restoreToken(page, {
      token: tenant.cache.getToken()!.token,
      tenantId: tenant.tenantId,
      slug: tenant.slug,
    });
  }
}
```

**Multi-Tenant Test Example**:

```typescript
import { TenantFactory } from '../helpers/tenant';

test.describe('Multi-Tenant Isolation', () => {
  const factory = new TenantFactory();

  test('tenant A cannot access tenant B packages', async ({ page }) => {
    // Create tenant A
    const tenantA = await factory.createTenant(page, 'tenant-a');
    await page.goto('/tenant/dashboard');
    // ... create package as tenant A ...

    // Create tenant B
    const tenantB = await factory.createTenant(page, 'tenant-b');
    // Manually switch page context to new tenant
    await page.goto('/login');
    // Verify tenant B's packages don't include tenant A's packages

    // Switch back to tenant A
    await factory.switchTenant(page, tenantA);
    // Verify tenant A's package is still there
  });
});
```

### Rate Limiting Consideration

Multiple signups hit the rate limit faster. Solutions:

1. **Run tests at different hours**:

   ```bash
   # Hour 1: Run multi-tenant tests
   npm run test:e2e -- multi-tenant.spec.ts

   # Hour 2: Run other tests
   npm run test:e2e -- visual-editor.spec.ts
   ```

2. **Increase test limit**:

   ```typescript
   // server/src/middleware/rateLimiter.ts
   const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

   export const signupLimiter = rateLimit({
     max: isTestEnvironment ? 200 : 5, // ← Higher for multi-tenant tests
   });
   ```

3. **Use existing test tenants**:
   ```typescript
   // Don't create new tenants - reuse seed data
   const existingTenant = await getTenantFromDatabase('elope-e2e');
   ```

---

## 3. Concurrent User Simulation

### Problem

Need to test concurrent access without creating many users:

```typescript
// ❌ How do you test race conditions with multiple users?
// ❌ How do you verify concurrent edits don't corrupt data?
```

### Solution: Browser Context Isolation

**File**: `e2e/helpers/concurrent.ts`

```typescript
import { Page, Browser } from '@playwright/test';

/**
 * Simulate concurrent users by creating multiple browser contexts
 * Each context is isolated (separate localStorage, cookies, cache)
 */
export async function simulateConcurrentUsers(
  browser: Browser,
  count: number,
  testFn: (page: Page, userIndex: number) => Promise<void>
): Promise<void[]> {
  const pages: Page[] = [];

  try {
    // Create isolated contexts for each user
    const contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext()));

    pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    // Run test function concurrently for each page
    await Promise.all(pages.map((page, index) => testFn(page, index)));
  } finally {
    // Cleanup
    await Promise.all(pages.map((p) => p.close()));
  }
}
```

**Concurrent Test Example**:

```typescript
import { test, expect, Browser } from '@playwright/test';
import { simulateConcurrentUsers } from '../helpers/concurrent';
import { signupTenant } from '../helpers/auth';

test('concurrent draft editing prevents race condition', async ({ browser }) => {
  // Setup: Single tenant
  const singlePage = await browser.newPage();
  const tenant = await signupTenant(singlePage);
  await singlePage.goto('/tenant/visual-editor');

  // Simulate 3 concurrent users editing the same package
  await simulateConcurrentUsers(browser, 3, async (page, userIndex) => {
    // Each user logs in as same tenant
    await page.evaluate((token) => localStorage.setItem('tenantToken', token), tenant.token);

    // All 3 users navigate to visual editor
    await page.goto('/tenant/visual-editor');

    // All 3 users click edit on same package (at slightly different times)
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');

    // User stagger edits by 100ms
    await page.waitForTimeout(userIndex * 100);

    // All try to edit simultaneously
    await input.fill(`User ${userIndex} Edit`);
    await input.blur();
  });

  // Verify: Only last edit should win (application behavior)
  await singlePage.reload();
  const title = await singlePage.locator('[aria-label="Package title"]').first().inputValue();

  // Should be one of the user edits (depending on last write wins)
  expect(title).toMatch(/User [0-2] Edit/);

  await singlePage.close();
});
```

### Important Notes

- Each browser context has isolated storage (no localStorage collision)
- Network requests are real and sequential (not parallelized at HTTP level)
- Timing differences are realistic (100ms stagger between users)
- Cleanup must happen in finally block to avoid resource leaks

---

## 4. Performance Testing Integration

### Problem

E2E tests should also verify performance characteristics:

```typescript
// ❌ Tests pass but feature takes 5 seconds to load
// ❌ No performance regression detection
```

### Solution: Performance Metrics in Tests

**File**: `e2e/helpers/performance.ts`

```typescript
import { Page } from '@playwright/test';

export interface PerformanceMetrics {
  navigationTime: number;
  loadTime: number;
  firstPaintTime: number;
  contentfulPaintTime: number;
  interactiveTime: number;
}

/**
 * Measure performance metrics during test
 * Helps catch performance regressions
 */
export async function measurePerformance(page: Page, name: string): Promise<PerformanceMetrics> {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paints = performance.getEntriesByType('paint');
    const largestContentfulPaint = performance.getEntriesByType('largest-contentful-paint');

    return {
      navigationTime: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
      loadTime: navigation?.loadEventEnd - navigation?.loadEventStart,
      firstPaintTime: paints.find((p) => p.name === 'first-paint')?.startTime || 0,
      contentfulPaintTime: paints.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
      interactiveTime: (largestContentfulPaint[0] as any)?.startTime || 0,
    };
  });

  console.log(`Performance [${name}]:`, metrics);

  return metrics;
}

/**
 * Assert performance threshold
 */
export function assertPerformance(
  metrics: PerformanceMetrics,
  threshold: {
    navigationTime?: number;
    loadTime?: number;
    contentfulPaintTime?: number;
  } = {}
): void {
  const defaults = {
    navigationTime: 1000, // 1 second
    loadTime: 2000, // 2 seconds
    contentfulPaintTime: 3000, // 3 seconds
    ...threshold,
  };

  if (metrics.navigationTime > defaults.navigationTime) {
    throw new Error(
      `Navigation took ${metrics.navigationTime}ms (threshold: ${defaults.navigationTime}ms)`
    );
  }

  if (metrics.contentfulPaintTime > defaults.contentfulPaintTime) {
    throw new Error(
      `First Contentful Paint took ${metrics.contentfulPaintTime}ms (threshold: ${defaults.contentfulPaintTime}ms)`
    );
  }
}
```

**Performance Test Example**:

```typescript
import { measurePerformance, assertPerformance } from '../helpers/performance';

test('visual editor loads performantly', async ({ page }) => {
  await ensureLoggedIn(page);

  // Measure dashboard load time
  await page.goto('/tenant/visual-editor');
  const metrics = await measurePerformance(page, 'visual-editor-load');

  // Assert thresholds
  assertPerformance(metrics, {
    navigationTime: 500,
    contentfulPaintTime: 2000, // Should load in <2 seconds
  });

  // Verify no performance regression
  expect(metrics.contentfulPaintTime).toBeLessThan(2000);
});
```

---

## 5. Debugging Flaky Tests

### Common Causes

1. **Async race conditions**

   ```typescript
   // ❌ FLAKY: Assumes data loaded after .click()
   await editButton.click();
   const value = await field.inputValue();

   // ✅ FIXED: Wait for API response
   await page.waitForResponse((r) => r.url().includes('/api/edit'));
   const value = await field.inputValue();
   ```

2. **Timing issues in CI**

   ```typescript
   // ❌ FLAKY: 5 second timeout too aggressive in CI
   await expect(element).toBeVisible({ timeout: 5000 });

   // ✅ FIXED: CI has longer timeout
   const timeout = process.env.CI ? 30000 : 5000;
   await expect(element).toBeVisible({ timeout });
   ```

3. **Selector instability**

   ```typescript
   // ❌ FLAKY: CSS selector brittle to style changes
   await page.locator('button.btn-blue.btn-lg.btn-primary').click();

   // ✅ FIXED: Use accessibility roles
   await page.getByRole('button', { name: /Save/i }).click();
   ```

### Debug Strategy

**File**: `e2e/helpers/debug.ts`

```typescript
import { Page } from '@playwright/test';

/**
 * Enable verbose debugging for flaky test
 * Captures screenshots, console logs, and network activity
 */
export async function enableDebug(page: Page): Promise<void> {
  // Capture all console messages
  page.on('console', (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  // Capture all network requests
  page.on('response', (response) => {
    console.log(`[NETWORK] ${response.status()} ${response.url()}`);
  });

  // Capture uncaught exceptions
  page.on('pageerror', (error) => {
    console.log(`[ERROR] ${error.message}`);
  });
}

/**
 * Wait with debugging output
 */
export async function debugWait(
  page: Page,
  condition: () => Promise<boolean>,
  timeoutMs: number = 10000,
  name: string = 'condition'
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      if (await condition()) {
        console.log(`[DEBUG] ${name} satisfied after ${Date.now() - startTime}ms`);
        return;
      }
    } catch (e) {
      console.log(`[DEBUG] ${name} check failed: ${e}`);
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`${name} not satisfied after ${timeoutMs}ms`);
}
```

**Usage**:

```typescript
test('flaky test with debug', async ({ page }) => {
  await enableDebug(page);

  await page.goto('/some-page');

  // Debug specific condition
  await debugWait(
    page,
    async () => {
      const element = page.getByRole('button', { name: /Save/i });
      return element.isEnabled();
    },
    5000,
    'Save button enabled'
  );

  // Now run assertion
  await page.getByRole('button', { name: /Save/i }).click();
});
```

---

## 6. CI/CD Integration Patterns

### Problem

Tests work locally but fail in CI due to:

- Different timing (CI is slower)
- Different environment variables
- Server startup delays
- Parallel test execution causing conflicts

### Solution: CI-Aware Test Configuration

**File**: `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,

  // Different settings for CI
  fullyParallel: !process.env.CI, // Serial in CI, parallel locally
  retries: process.env.CI ? 2 : 0, // Retry flaky tests in CI
  workers: process.env.CI ? 1 : undefined, // Single worker in CI

  use: {
    baseURL: 'http://localhost:5173',
    // Generous timeouts in CI
    expect: { timeout: process.env.CI ? 15000 : 7000 },
  },

  webServer: {
    command: 'E2E_TEST=1 ADAPTERS_PRESET=real npm run dev:e2e',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // Fresh server in CI
    timeout: 180 * 1000, // Longer startup timeout in CI
  },

  // Reporter for CI
  reporter: process.env.CI ? [['html'], ['junit', { outputFile: 'test-results.xml' }]] : [['html']],
});
```

### Environment Variables for CI

**GitHub Actions Example** (`.github/workflows/e2e.yml`):

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Run E2E tests
        env:
          # CI environment variables
          CI: 'true'
          E2E_TEST: '1'
          NODE_ENV: 'test'
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          JWT_SECRET: 'test-secret-key-not-for-production'
          ADAPTERS_PRESET: 'real'
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

---

## 7. Test Data Factories

### Problem

Tests need consistent, predictable data:

```typescript
// ❌ Hardcoded test data scattered across tests
const package = {
  title: 'Package 1',
  description: 'Description 1',
  price: 100,
};

// ❌ Can't easily create variations (with different prices, etc.)
```

### Solution: Data Factories

**File**: `e2e/fixtures/data-factories.ts`

```typescript
import { faker } from '@faker-js/faker';

/**
 * Package data factory
 * Generates consistent test data with variations
 */
export function createPackageData(overrides?: Partial<typeof defaultPackage>) {
  const defaultPackage = {
    title: faker.company.catchPhrase(),
    description: faker.lorem.paragraph(),
    price: faker.datatype.number({ min: 10, max: 1000 }),
  };

  return { ...defaultPackage, ...overrides };
}

/**
 * Multiple packages for bulk tests
 */
export function createPackageVariations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Package ${i + 1}`,
    description: `Description for package ${i + 1}`,
    price: (i + 1) * 100,
  }));
}

/**
 * Test tenant data factory
 */
export function createTenantData(overrides?: Partial<typeof defaultTenant>) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  const defaultTenant = {
    email: `test-${timestamp}-${random}@example.com`,
    password: 'SecurePass123!',
    businessName: faker.company.name(),
  };

  return { ...defaultTenant, ...overrides };
}
```

**Factory Usage**:

```typescript
import { createPackageData, createTenantData } from '../fixtures/data-factories';

test('creates package with custom price', async ({ page }) => {
  await ensureLoggedIn(page);

  const packageData = createPackageData({
    price: 299.99, // Custom price
  });

  await editPackage(page, packageData);
  await publishPackage(page);

  // Verify price saved
  await page.reload();
  const savedPrice = await getPackagePrice(page);
  expect(savedPrice).toBe('$299.99');
});

test('creates multiple packages', async ({ page }) => {
  await ensureLoggedIn(page);

  const packages = createPackageVariations(5);

  for (const pkg of packages) {
    await createPackage(page, pkg);
  }

  // Verify all created
  await page.reload();
  for (const pkg of packages) {
    await expect(page.getByText(pkg.title)).toBeVisible();
  }
});
```

---

## Performance Considerations

### Test Execution Time

| Pattern                      | Time | Notes                   |
| ---------------------------- | ---- | ----------------------- |
| Serial 10 tests              | ~30s | Safe, shared state      |
| Parallel 10 tests            | ~5s  | Risky without isolation |
| With auth token caching      | ~30s | 1 signup + 9 tests      |
| Without caching (10 signups) | 60s+ | Rate limit risk         |

### Memory Usage

- Each browser context: ~100MB
- 10 concurrent contexts: ~1GB
- Use cleanup in finally blocks

### CI/CD Implications

- Serial tests: Single worker, slower but reliable
- Parallel tests: Multiple workers, fast but complex debugging
- CI should prefer serial for reproducibility

---

## Common Patterns Summary

| Pattern                 | Use Case               | Complexity |
| ----------------------- | ---------------------- | ---------- |
| **Token Caching**       | Avoid repeated signups | Low        |
| **Shared Helpers**      | DRY test code          | Medium     |
| **Tenant Factory**      | Multi-tenant tests     | Medium     |
| **Concurrent Users**    | Race condition testing | High       |
| **Performance Metrics** | Regression detection   | Medium     |
| **Data Factories**      | Consistent test data   | Medium     |
| **Debug Helpers**       | Flaky test diagnosis   | Medium     |

---

## References

- `E2E-TESTING-PREVENTION-STRATEGIES.md` - Core patterns
- `E2E-TESTING-QUICK-REFERENCE.md` - Quick lookup guide
- Playwright Documentation: https://playwright.dev/docs/api/class-test
- Faker.js Documentation: https://fakerjs.dev/
