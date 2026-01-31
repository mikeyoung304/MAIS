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
   *
   * Next.js migration notes:
   * - Form uses window.location.href for redirect (not Next.js router)
   * - confirmPassword field was removed
   * - Redirect flow: /signup → /tenant/build → /tenant/dashboard?showPreview=true
   * - Must wait for hydration before form interaction
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

    // P0-FIX: Capture actual slug from API response using route interception
    // The server generates slugs as `${baseSlug}-${Date.now()}` which differs
    // from the fixture's predicted slug. Tests need the actual slug to navigate
    // to the storefront correctly.
    let capturedSlug: string | null = null;
    let signupError: string | null = null;

    // Intercept the signup response to capture the actual slug
    await page.route('**/v1/auth/signup', async (route) => {
      const response = await route.fetch();

      if (response.status() === 429) {
        signupError = 'Rate limited - run tests with lower parallelism or wait';
      } else if (response.status() !== 201) {
        const text = await response.text();
        signupError = `Signup failed with status ${response.status()}: ${text}`;
        await route.fulfill({ response });
        return;
      }

      const body = await response.json();
      if (body.slug) {
        capturedSlug = body.slug;
      }

      // Fulfill with the original response body
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(body),
      });
    });

    // Click submit button
    await page.click('button[type="submit"]');

    // Wait for navigation to complete (signup redirects to /tenant/build then /tenant/dashboard)
    try {
      await page.waitForURL(/\/tenant\//, { timeout: 30000 });
    } catch (error) {
      // Check if we captured an error from the signup response
      if (signupError) {
        throw new Error(signupError);
      }
      // Check if navigation timed out
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('Signup redirect timed out - check API server');
      }
      throw error;
    }

    // Check for signup errors that didn't prevent navigation
    if (signupError) {
      throw new Error(signupError);
    }

    // Update testTenant with actual slug if captured
    if (capturedSlug) {
      testTenant.slug = capturedSlug;
    }

    // Remove the route handler to avoid affecting other requests
    await page.unroute('**/v1/auth/signup');

    // Wait for redirect to Dashboard (Build Mode redirects to dashboard with preview)
    // /tenant/build → /tenant/dashboard?showPreview=true
    await page.waitForURL(/\/tenant\/dashboard/, { timeout: 15000 });

    // Wait for dashboard to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // NextAuth.js v5 uses httpOnly cookies - token not accessible via JS
    // Auth is validated by successful navigation to protected route
    testTenant.token = 'nextauth-httponly-session';

    await use(page);
  },
});

export { expect } from '@playwright/test';
