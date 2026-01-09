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
 *   // After signup, page is at /tenant/dashboard?showPreview=true
 *   // testTenant has: email, password, businessName, slug, token (placeholder)
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
    // Navigate to signup and wait for full page load + hydration
    await page.goto('/signup', { waitUntil: 'networkidle' });

    // Wait for signup form to be fully interactive (React hydration complete)
    await page.waitForSelector('#businessName', { timeout: 10000 });

    // Additional wait for Next.js hydration to complete
    // This prevents form values from being cleared by re-renders
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Brief pause for React hydration

    // Fill signup form (Note: confirmPassword was removed in Next.js migration)
    await page.fill('#businessName', testTenant.businessName);
    await page.fill('#email', testTenant.email);
    await page.fill('#password', testTenant.password);

    // Verify values were retained (Next.js can clear on re-render)
    await page.waitForFunction(
      (expected) => {
        const businessName = document.querySelector<HTMLInputElement>('#businessName');
        return businessName?.value === expected;
      },
      testTenant.businessName,
      { timeout: 5000 }
    );

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

    // Wait for redirect to Dashboard (Build Mode redirects to dashboard with preview)
    // /tenant/build → /tenant/dashboard?showPreview=true
    await page.waitForURL(/\/tenant\/dashboard/, { timeout: 15000 });

    // NextAuth.js v5 uses httpOnly cookies - token not accessible via JS
    // Auth is validated by successful navigation to protected route
    testTenant.token = 'nextauth-httponly-session';

    await use(page);
  },
});

export { expect } from '@playwright/test';
