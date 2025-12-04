import { test, expect } from '@playwright/test';

/**
 * E2E Test: Tenant Signup Flow
 *
 * This test suite verifies the self-service tenant signup functionality:
 * 1. Happy path signup with valid credentials
 * 2. Validation error handling (client-side)
 * 3. Duplicate email conflict (server-side)
 * 4. Automatic login and dashboard redirect
 * 5. Authentication persistence
 *
 * Tests ensure tenants can register, receive credentials, and access their dashboard.
 */
test.describe('Tenant Signup Flow', () => {
  /**
   * Test 1: Happy Path - Complete Signup Journey
   *
   * Verifies a new business can successfully sign up and access their dashboard.
   * Flow: Navigate to signup → Fill form → Submit → Auto-login → Dashboard
   */
  test('successfully signs up new tenant and redirects to dashboard', async ({ page }) => {
    // Generate unique email to avoid conflicts
    const timestamp = Date.now();
    const testEmail = `signup-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';
    const businessName = `E2E Test Business ${timestamp}`;

    // Step 1: Navigate to signup page
    await page.goto('/signup');
    await expect(page).toHaveURL('/signup');

    // Verify signup page loaded
    await expect(page.getByRole('heading', { name: /Sign Up/i })).toBeVisible();
    await expect(page.getByText(/Create your business account/i)).toBeVisible();

    // Verify "Back to Home" link is present
    await expect(page.getByRole('link', { name: /Back to Home/i })).toBeVisible();

    // Step 2: Fill out signup form
    await page.fill('#businessName', businessName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    // Verify all fields are filled
    await expect(page.locator('#businessName')).toHaveValue(businessName);
    await expect(page.locator('#email')).toHaveValue(testEmail);
    await expect(page.locator('#password')).toHaveValue(testPassword);
    await expect(page.locator('#confirmPassword')).toHaveValue(testPassword);

    // Step 3: Submit form
    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for signup API request to complete
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 201,
      { timeout: 10000 }
    );

    // Step 4: Verify redirect to tenant dashboard
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    // Verify dashboard loaded successfully
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });

    // Verify user is authenticated (check for logout button or user menu)
    const logoutButton = page.getByRole('button', { name: /Logout|Log out/i });
    await expect(logoutButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Tenant signup successful');
    console.log(`✅ Email: ${testEmail}`);
    console.log(`✅ Business: ${businessName}`);
  });

  /**
   * Test 2: Validation Errors - Business Name
   *
   * Verifies client-side validation for business name field.
   */
  test('validates business name length requirements', async ({ page }) => {
    await page.goto('/signup');

    const testEmail = `validation-test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';

    // Test: Business name too short (< 2 characters)
    await page.fill('#businessName', 'A');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    const submitButton = page.getByRole('button', { name: /Create Account/i });
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
   * Verifies client-side validation for email field.
   */
  test('validates email format', async ({ page }) => {
    await page.goto('/signup');

    const testPassword = 'SecurePass123!';

    // Test: Invalid email format
    await page.fill('#businessName', 'Test Business');
    await page.fill('#email', 'invalid-email'); // Missing @ and domain
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await submitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/valid email/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');
  });

  /**
   * Test 4: Validation Errors - Password Length
   *
   * Verifies client-side validation for password minimum length.
   */
  test('validates password minimum length', async ({ page }) => {
    await page.goto('/signup');

    const testEmail = `password-test-${Date.now()}@example.com`;
    const shortPassword = 'Short1!'; // Only 7 characters

    // Test: Password too short (< 8 characters)
    await page.fill('#businessName', 'Test Business');
    await page.fill('#email', testEmail);
    await page.fill('#password', shortPassword);
    await page.fill('#confirmPassword', shortPassword);

    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await submitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/Password must be at least 8 characters/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');
  });

  /**
   * Test 5: Validation Errors - Password Mismatch
   *
   * Verifies password confirmation validation.
   */
  test('validates password confirmation matches', async ({ page }) => {
    await page.goto('/signup');

    const testEmail = `mismatch-test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';
    const differentPassword = 'DifferentPass456!';

    // Test: Passwords don't match
    await page.fill('#businessName', 'Test Business');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', differentPassword);

    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await submitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');

    // Test: Error clears when passwords match
    await page.fill('#confirmPassword', testPassword);
    await submitButton.click();

    // Mismatch error should be gone
    await expect(page.getByText(/Passwords do not match/i)).not.toBeVisible();
  });

  /**
   * Test 6: Duplicate Email Conflict
   *
   * Verifies server-side handling of duplicate email registration.
   * This test creates a tenant, then attempts to register again with the same email.
   */
  test('prevents duplicate email registration', async ({ page }) => {
    const timestamp = Date.now();
    const duplicateEmail = `duplicate-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';
    const businessName1 = `First Business ${timestamp}`;
    const businessName2 = `Second Business ${timestamp}`;

    // Step 1: First signup - should succeed
    await page.goto('/signup');

    await page.fill('#businessName', businessName1);
    await page.fill('#email', duplicateEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    await page.getByRole('button', { name: /Create Account/i }).click();

    // Wait for successful signup
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 201,
      { timeout: 10000 }
    );

    // Should redirect to dashboard
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    // Step 2: Logout (go back to signup)
    await page.goto('/signup');

    // Step 3: Attempt to signup again with same email - should fail
    await page.fill('#businessName', businessName2);
    await page.fill('#email', duplicateEmail); // Same email!
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    await page.getByRole('button', { name: /Create Account/i }).click();

    // Wait for conflict response
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup') && response.status() === 409,
      { timeout: 10000 }
    );

    // Step 4: Verify error message appears
    await expect(page.getByText(/account with this email already exists/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify we're still on signup page (not redirected)
    await expect(page).toHaveURL('/signup');

    // Verify suggestion to login instead
    await expect(page.getByText(/log in instead/i)).toBeVisible();

    console.log('✅ Duplicate email correctly rejected');
  });

  /**
   * Test 7: Password Visibility Toggle
   *
   * Verifies password show/hide functionality works correctly.
   */
  test('toggles password visibility', async ({ page }) => {
    await page.goto('/signup');

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
   * Test 8: Navigation - Back to Home
   *
   * Verifies the "Back to Home" link works correctly.
   */
  test('navigates back to home page', async ({ page }) => {
    await page.goto('/signup');

    // Click "Back to Home" link
    const backLink = page.getByRole('link', { name: /Back to Home/i });
    await expect(backLink).toBeVisible();
    await backLink.click();

    // Verify redirect to home page
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Your Perfect Day/i })).toBeVisible();
  });

  /**
   * Test 9: Navigation - Link to Login
   *
   * Verifies the "Already have an account?" link works correctly.
   */
  test('navigates to login page from signup', async ({ page }) => {
    await page.goto('/signup');

    // Find and click login link
    const loginLink = page.getByRole('link', { name: /Log in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    // Verify redirect to login page
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /Log In/i })).toBeVisible();
  });

  /**
   * Test 10: Form State - Loading During Submission
   *
   * Verifies the form shows loading state during signup API call.
   */
  test('shows loading state during submission', async ({ page }) => {
    await page.goto('/signup');

    const timestamp = Date.now();
    const testEmail = `loading-test-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';

    // Fill form
    await page.fill('#businessName', `Loading Test ${timestamp}`);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    // Start monitoring button text
    const submitButton = page.getByRole('button', { name: /Create Account/i });

    // Click submit
    await submitButton.click();

    // Verify button shows loading state (text changes)
    await expect(page.getByRole('button', { name: /Creating account/i })).toBeVisible({
      timeout: 2000,
    });

    // Wait for completion
    await page.waitForURL('/tenant/dashboard', { timeout: 10000 });
  });

  /**
   * Test 11: Already Authenticated Redirect
   *
   * Verifies that authenticated users are redirected away from signup page.
   */
  test('redirects authenticated tenant admin to dashboard', async ({ page }) => {
    // Step 1: Sign up and authenticate
    const timestamp = Date.now();
    const testEmail = `auth-redirect-${timestamp}@example.com`;
    const testPassword = 'SecurePass123!';

    await page.goto('/signup');
    await page.fill('#businessName', `Auth Test ${timestamp}`);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.getByRole('button', { name: /Create Account/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 10000 });

    // Step 2: Try to visit signup page while authenticated
    await page.goto('/signup');

    // Should be redirected back to dashboard (already logged in)
    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 5000 });
  });

  /**
   * Test 12: Multiple Validation Errors
   *
   * Verifies that multiple validation errors are shown together.
   */
  test('displays multiple validation errors simultaneously', async ({ page }) => {
    await page.goto('/signup');

    // Submit form with multiple invalid fields
    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await submitButton.click();

    // Should show errors for all required fields
    await expect(page.getByText(/Business name is required/i)).toBeVisible();
    await expect(page.getByText(/Email is required/i)).toBeVisible();
    await expect(page.getByText(/Password is required/i)).toBeVisible();
    await expect(page.getByText(/confirm your password/i)).toBeVisible();

    // Verify we're still on signup page
    await expect(page).toHaveURL('/signup');
  });
});
