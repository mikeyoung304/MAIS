/**
 * Playwright Auth Fixture
 *
 * Provides per-test tenant isolation for E2E tests.
 * Each test gets its own authenticated tenant context.
 * Automatically cleans up created tenants after each test.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../fixtures/auth.fixture';
 *
 * test('my test', async ({ authenticatedPage, testTenant }) => {
 *   await authenticatedPage.goto('/tenant/dashboard');
 *   // testTenant has: email, password, businessName, slug
 * });
 * ```
 */
import { test as base, Page } from '@playwright/test';

export interface TestTenant {
  email: string;
  password: string;
  businessName: string;
  slug: string;
  token: string | null;
}

export const test = base.extend<{
  authenticatedPage: Page;
  testTenant: TestTenant;
}>({
  /**
   * Test tenant info - unique per test
   * Slug follows pattern: e2e-test-{testHash}-{timestamp}
   */
  testTenant: async ({}, use, testInfo) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    // Include test name hash for uniqueness across parallel tests
    const testHash = testInfo.title.replace(/\s+/g, '-').substring(0, 10).toLowerCase();

    const tenant: TestTenant = {
      email: `e2e-${testHash}-${timestamp}-${random}@example.com`,
      password: 'SecurePass123!',
      businessName: `E2E Test ${testHash} ${timestamp}`,
      slug: `e2e-test-${testHash}-${timestamp}`, // Predictable slug for cleanup
      token: null,
    };

    await use(tenant);
  },

  /**
   * Authenticated page - signs up and logs in before each test
   */
  authenticatedPage: async ({ page, testTenant }, use) => {
    // Navigate to signup
    await page.goto('/signup');

    // Wait for signup form
    await page.waitForSelector('#businessName', { timeout: 10000 });

    // Fill signup form (Note: confirmPassword was removed in Next.js migration)
    await page.fill('#businessName', testTenant.businessName);
    await page.fill('#email', testTenant.email);
    await page.fill('#password', testTenant.password);

    // Submit and wait for response
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup'),
      { timeout: 30000 }
    );
    await page.click('button[type="submit"]');

    const response = await responsePromise;
    if (response.status() === 429) {
      throw new Error('Rate limited - run tests with lower parallelism or wait');
    }
    if (response.status() !== 201) {
      const body = await response.text();
      throw new Error(`Signup failed with status ${response.status()}: ${body}`);
    }

    // Wait for redirect to dashboard
    await page.waitForURL('/tenant/dashboard', { timeout: 15000 });

    // Cache token for reference
    testTenant.token = await page.evaluate(() => localStorage.getItem('tenantToken'));

    await use(page);
  },
});

export { expect } from '@playwright/test';
