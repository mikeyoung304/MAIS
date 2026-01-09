import { test, expect } from '@playwright/test';

/**
 * E2E Test: Tenant Signup Flow
 *
 * This test suite verifies the self-service tenant signup functionality:
 * 1. Happy path signup with valid credentials
 * 2. Validation error handling (client-side)
 * 3. Duplicate email conflict (server-side)
 * 4. Automatic login and Build Mode redirect
 * 5. Authentication persistence
 *
 * Tests ensure tenants can register, receive credentials, and access their dashboard.
 *
 * NOTE: Next.js migration changes:
 * - confirmPassword field removed (single password field only)
 * - Post-signup redirects to /tenant/dashboard (not /tenant/dashboard)
 * - CTA button text is tier-aware ("Get Handled" by default, not "Create Account")
 * - Heading is tier-aware ("Bring your passion." by default, not "Sign Up")
 * - All tests must wait for hydration before interacting with form
 */

/**
 * Helper: Wait for Next.js signup page to be fully hydrated
 * This prevents form values from being cleared by React re-renders
 */
async function waitForSignupPageHydration(page: import('@playwright/test').Page) {
  await page.goto('/signup', { waitUntil: 'networkidle' });
  await page.waitForSelector('#businessName', { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  // Brief pause for React hydration to complete
  await page.waitForTimeout(500);
}

test.describe('Tenant Signup Flow', () => {
  /**
   * Test 1: Happy Path - Complete Signup Journey
   *
   * Verifies a new business can successfully sign up and access Build Mode.
   * Flow: Navigate to signup -> Fill form -> Submit -> Auto-login -> Build Mode
   */
  test('successfully signs up new tenant and redirects to build mode', async ({ page }) => {
    // Generate unique email to avoid conflicts
    const timestamp = Date.now();
    const testEmail = `signup-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';
    const businessName = `E2E Test Business ${timestamp}`;

    // Step 1: Navigate to signup page and wait for hydration
    await waitForSignupPageHydration(page);
    await expect(page).toHaveURL('/signup');

    // Verify signup page loaded (Next.js tier-aware copy)
    await expect(page.locator('#businessName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Step 2: Fill out signup form (NO confirmPassword in Next.js)
    await page.fill('#businessName', businessName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);

    // Verify all fields are filled (with retry for hydration race conditions)
    await expect(page.locator('#businessName')).toHaveValue(businessName, { timeout: 5000 });
    await expect(page.locator('#email')).toHaveValue(testEmail);
    await expect(page.locator('#password')).toHaveValue(testPassword);

    // Step 3: Submit form (button text varies by tier, use type="submit")
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for signup API request to complete
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 201,
      { timeout: 10000 }
    );

    // Step 4: Verify redirect to Build Mode (Next.js change from dashboard)
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    console.log('Tenant signup successful');
    console.log(`Email: ${testEmail}`);
    console.log(`Business: ${businessName}`);
  });

  /**
   * Test 2: Validation Errors - Business Name
   *
   * Verifies client-side validation for business name field.
   */
  test('validates business name length requirements', async ({ page }) => {
    await waitForSignupPageHydration(page);

    const testEmail = `validation-test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';

    // Test: Business name too short (< 2 characters)
    await page.fill('#businessName', 'A');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/Business name must be at least 2 characters/i)).toBeVisible();

    // Verify we're still on signup page (no redirect)
    await expect(page).toHaveURL('/signup');

    // Test: Clear error when field is corrected
    await page.fill('#businessName', 'Valid Business Name');
    await submitButton.click();

    // Error should be cleared (we'll get different error or success)
    await expect(page.getByText(/Business name must be at least 2 characters/i)).not.toBeVisible();
  });

  /**
   * Test 3: Validation Errors - Email Format
   *
   * Verifies that invalid email prevents form submission.
   * Note: The input has type="email" which triggers browser validation BEFORE
   * React's onSubmit handler runs. The browser shows a native tooltip (not in DOM).
   *
   * We verify:
   * 1. Form doesn't submit (stays on signup page)
   * 2. No successful signup occurs (no redirect)
   */
  test('validates email format', async ({ page }) => {
    await waitForSignupPageHydration(page);

    const testPassword = 'SecurePass123!';

    // Fill form with invalid email
    await page.fill('#businessName', 'Test Business');
    await page.locator('#email').click();
    await page.locator('#email').pressSequentially('invalid-email');
    await page.fill('#password', testPassword);

    // Verify email field has the invalid value
    await expect(page.locator('#email')).toHaveValue('invalid-email');

    // Click submit - browser validation will show native tooltip
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait a bit to ensure any redirect would have happened
    await page.waitForTimeout(1000);

    // Verify we're STILL on signup page (form didn't submit due to invalid email)
    await expect(page).toHaveURL('/signup');

    // Verify the form is still showing (not loading/redirecting)
    await expect(page.locator('#businessName')).toBeVisible();
    await expect(page.locator('#email')).toHaveValue('invalid-email');
  });

  /**
   * Test 4: Validation Errors - Password Length
   *
   * Verifies client-side validation for password minimum length.
   */
  test('validates password minimum length', async ({ page }) => {
    await waitForSignupPageHydration(page);

    const testEmail = `password-test-${Date.now()}@example.com`;
    const shortPassword = 'Short1!'; // Only 7 characters

    // Test: Password too short (< 8 characters) - NO confirmPassword in Next.js
    await page.fill('#businessName', 'Test Business');
    await page.fill('#email', testEmail);
    await page.fill('#password', shortPassword);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/Password must be at least 8 characters/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');
  });

  // NOTE: Test 5 (Password Mismatch) REMOVED
  // The confirmPassword field was removed in the Next.js migration.
  // Password confirmation is no longer part of the signup flow.

  /**
   * Test 5: Duplicate Email Conflict (was Test 6)
   *
   * Verifies server-side handling of duplicate email registration.
   * This test creates a tenant, then uses a fresh browser context to attempt
   * registration with the same email (NextAuth session makes logout tricky).
   */
  test('prevents duplicate email registration', async ({ page, browser }) => {
    const timestamp = Date.now();
    const duplicateEmail = `duplicate-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';
    const businessName1 = `First Business ${timestamp}`;
    const businessName2 = `Second Business ${timestamp}`;

    // Step 1: First signup - should succeed
    await waitForSignupPageHydration(page);

    await page.fill('#businessName', businessName1);
    await page.fill('#email', duplicateEmail);
    await page.fill('#password', testPassword);

    await page.locator('button[type="submit"]').click();

    // Wait for successful signup
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 201,
      { timeout: 10000 }
    );

    // Should redirect to Dashboard
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    // Step 2: Create a fresh browser context for second signup attempt
    // This avoids NextAuth session complexities
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();

    // Navigate to signup page in fresh context
    await newPage.goto('/signup', { waitUntil: 'networkidle' });
    await newPage.waitForSelector('#businessName', { timeout: 10000 });
    await newPage.waitForLoadState('domcontentloaded');
    await newPage.waitForTimeout(500);

    // Step 3: Attempt to signup again with same email - should fail
    await newPage.fill('#businessName', businessName2);
    await newPage.fill('#email', duplicateEmail); // Same email!
    await newPage.fill('#password', testPassword);

    await newPage.locator('button[type="submit"]').click();

    // Wait for conflict response
    await newPage.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 409,
      { timeout: 10000 }
    );

    // Step 4: Verify error message appears
    // Next.js error message may differ - check for common patterns
    await expect(newPage.getByText(/already exists|already registered|email already/i)).toBeVisible(
      {
        timeout: 5000,
      }
    );

    // Verify we're still on signup page (not redirected)
    await expect(newPage).toHaveURL('/signup');

    // Cleanup
    await newContext.close();

    console.log('Duplicate email correctly rejected');
  });

  /**
   * Test 6: Password Visibility Toggle (was Test 7)
   *
   * Verifies password show/hide functionality works correctly.
   */
  test('toggles password visibility', async ({ page }) => {
    await waitForSignupPageHydration(page);

    const testPassword = 'SecurePass123!';

    // Fill password field
    await page.fill('#password', testPassword);

    // Verify password is hidden by default (type="password")
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');

    // Find and click the show password button (Eye icon)
    const showPasswordButton = page.locator('button[aria-label*="Show password"]').first();
    await showPasswordButton.click();

    // Verify password is now visible (type="text")
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');

    // Click again to hide
    const hidePasswordButton = page.locator('button[aria-label*="Hide password"]').first();
    await hidePasswordButton.click();

    // Verify password is hidden again
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  /**
   * Test 7: Navigation - Link to Login (was Test 9)
   *
   * Verifies the "Already have an account?" link works correctly.
   */
  test('navigates to login page from signup', async ({ page }) => {
    await waitForSignupPageHydration(page);

    // Find and click login link (text: "Sign in" in Next.js)
    const loginLink = page.getByRole('link', { name: /Sign in|Log in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    // Verify redirect to login page
    await expect(page).toHaveURL('/login');
  });

  /**
   * Test 8: Form State - Loading During Submission (was Test 10)
   *
   * Verifies the form shows loading state during signup API call.
   */
  test('shows loading state during submission', async ({ page }) => {
    await waitForSignupPageHydration(page);

    const timestamp = Date.now();
    const testEmail = `loading-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';

    // Fill form (NO confirmPassword in Next.js)
    await page.fill('#businessName', `Loading Test ${timestamp}`);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);

    // Start monitoring button
    const submitButton = page.locator('button[type="submit"]');

    // Click submit
    await submitButton.click();

    // Verify button shows loading state
    // Next.js uses tier-aware loading text like "Setting up your storefront..."
    await expect(page.locator('button[type="submit"]')).toBeDisabled({
      timeout: 2000,
    });

    // Wait for completion (redirects to Build Mode)
    await page.waitForURL('/tenant/dashboard', { timeout: 10000 });
  });

  /**
   * Test 9: Already Authenticated Redirect (was Test 11)
   *
   * Verifies that authenticated users are redirected away from signup page.
   */
  test('redirects authenticated tenant admin to build mode', async ({ page }) => {
    // Step 1: Sign up and authenticate
    const timestamp = Date.now();
    const testEmail = `auth-redirect-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';

    await waitForSignupPageHydration(page);
    await page.fill('#businessName', `Auth Test ${timestamp}`);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to Build Mode (Next.js change)
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    // Step 2: Try to visit signup page while authenticated
    await page.goto('/signup');

    // Should be redirected back to Build Mode (already logged in)
    // Next.js redirects authenticated users to /tenant/dashboard
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 5000 });
  });

  /**
   * Test 10: Multiple Validation Errors (was Test 12)
   *
   * Verifies that multiple validation errors are shown together.
   */
  test('displays multiple validation errors simultaneously', async ({ page }) => {
    await waitForSignupPageHydration(page);

    // Submit form with multiple invalid fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show errors for all required fields
    // Note: confirmPassword error removed - field doesn't exist in Next.js
    await expect(page.getByText(/Business name is required/i)).toBeVisible();
    await expect(page.getByText(/Email is required/i)).toBeVisible();
    await expect(page.getByText(/Password is required/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');
  });
});
