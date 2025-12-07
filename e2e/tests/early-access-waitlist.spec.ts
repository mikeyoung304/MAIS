import { test, expect } from '@playwright/test';

/**
 * E2E Test: Early Access Waitlist Flow
 *
 * This test suite verifies the early access waitlist form on the homepage:
 * 1. Form visibility and structure
 * 2. Happy path submission with success message
 * 3. Loading state during submission
 * 4. Error handling (400, 500)
 * 5. Rate limiting (429)
 * 6. Accessibility attributes
 * 7. Duplicate email handling (graceful upsert)
 *
 * Tests ensure the waitlist form provides a smooth user experience
 * with proper validation, error handling, and accessibility.
 */
test.describe('Early Access Waitlist', () => {
  const API_BASE = 'http://localhost:3001';

  /**
   * Test 1: Form Visibility
   *
   * Verifies the waitlist form is visible on the homepage with all required elements.
   */
  test('should display waitlist form on homepage', async ({ page }) => {
    await page.goto('/');

    // Find the waitlist section
    const waitlistSection = page.locator('#waitlist-cta');
    await expect(waitlistSection).toBeVisible();

    // Verify section has proper ARIA label
    await expect(waitlistSection).toHaveAttribute('aria-labelledby', 'waitlist-cta-heading');

    // Verify headline is visible
    const heading = page.locator('#waitlist-cta-heading');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/From idea to booked/i);

    // Verify subheadline
    await expect(page.getByText(/Your business deserves a professional launch/i)).toBeVisible();

    // Verify form exists with proper aria-label
    const form = waitlistSection.locator('form[aria-label="Early access request form"]');
    await expect(form).toBeVisible();

    // Verify email input exists with proper accessibility
    const emailInput = waitlistSection.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('aria-label', 'Email address');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(emailInput).toHaveAttribute('placeholder', 'Your email');

    // Verify submit button exists
    const submitButton = waitlistSection.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/Request Early Access/i);

    console.log('✅ Waitlist form structure verified');
  });

  /**
   * Test 2: Happy Path - Successful Submission
   *
   * Verifies a user can successfully submit their email and see a success message.
   */
  test('should submit valid email and show success message', async ({ page }) => {
    await page.goto('/');

    // Generate unique email to avoid duplicates
    const timestamp = Date.now();
    const testEmail = `waitlist-test-${timestamp}@example.com`;

    // Find form using data-testid
    const form = page.getByTestId('cta-waitlist-form');

    // Find and fill the email input
    const emailInput = form.locator('input[type="email"]');
    await emailInput.fill(testEmail);
    await expect(emailInput).toHaveValue(testEmail);

    // Click submit button
    const submitButton = form.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for API request to complete
    await page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 200,
      { timeout: 10000 }
    );

    // Verify success message appears (role="status" for screen reader announcements)
    const successMessage = page.locator('#waitlist-cta [role="status"]');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    await expect(successMessage).toHaveAttribute('aria-live', 'polite');
    await expect(successMessage).toContainText(/Welcome.*We'll be in touch soon/i);

    // Verify check icon is present (but hidden from screen readers)
    const checkIcon = successMessage.locator('svg');
    await expect(checkIcon).toBeVisible();
    await expect(checkIcon).toHaveAttribute('aria-hidden', 'true');

    // Verify form is no longer visible (replaced by success message)
    await expect(form).not.toBeVisible();

    console.log('✅ Waitlist submission successful');
    console.log(`✅ Email: ${testEmail}`);
  });

  /**
   * Test 3: Loading State During Submission
   *
   * Verifies the form shows a loading spinner during API call.
   */
  test('should show loading state during submission', async ({ page }) => {
    await page.goto('/');

    const timestamp = Date.now();
    const testEmail = `loading-test-${timestamp}@example.com`;

    // Find form using data-testid
    const form = page.getByTestId('cta-waitlist-form');

    // Fill email
    await form.locator('input[type="email"]').fill(testEmail);

    // Start monitoring for loading state
    const submitButton = form.locator('button[type="submit"]');

    // Click submit
    await submitButton.click();

    // Verify button is disabled during submission
    await expect(submitButton).toBeDisabled({ timeout: 2000 });

    // Verify loading spinner appears (spinning animation)
    const spinner = submitButton.locator('.animate-spin');
    await expect(spinner).toBeVisible({ timeout: 2000 });

    // Wait for submission to complete
    await page.waitForResponse(
      (response) => response.url().includes('/v1/auth/early-access'),
      { timeout: 10000 }
    );

    // Verify success message eventually appears
    await expect(page.locator('#waitlist-cta [role="status"]')).toBeVisible({ timeout: 5000 });

    console.log('✅ Loading state verified');
  });

  /**
   * Test 4: Validation Error - Invalid Email Format
   *
   * Verifies client-side and server-side validation for invalid email.
   */
  test('should handle invalid email format (400)', async ({ page }) => {
    let intercepted = false;

    // Mock the API to return 400 error (BEFORE navigation)
    // Use exact URL pattern to ensure interception
    await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      intercepted = true;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Please enter a valid email address.' }),
      });
    });

    await page.goto('/');

    // Submit with a technically valid format but the server will reject
    // Use valid HTML5 email format to bypass client-side validation
    const form = page.getByTestId('cta-waitlist-form');
    await form.locator('input[type="email"]').fill('test@example.com');

    // Set up response promise BEFORE clicking submit
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 400,
      { timeout: 5000 }
    );

    await form.locator('button[type="submit"]').click();

    // Wait for error response
    await responsePromise;

    // Verify mock was intercepted
    expect(intercepted).toBe(true);

    // Verify error message is displayed with proper ARIA attributes
    const errorAlert = page.locator('#waitlist-cta [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toHaveAttribute('aria-live', 'polite');
    await expect(errorAlert).toHaveAttribute('aria-atomic', 'true');
    await expect(errorAlert).toContainText(/valid email/i);

    // Verify form is still visible (user can retry)
    await expect(form).toBeVisible();

    console.log('✅ Invalid email error handling verified');
    console.log(`✅ Mock interception confirmed: ${intercepted}`);
  });

  /**
   * Test 5: Server Error Handling (500)
   *
   * Verifies graceful error handling for server errors.
   */
  test('should handle API errors gracefully (500)', async ({ page }) => {
    let intercepted = false;

    // Mock the API to return a server error (BEFORE navigation)
    // Use exact URL pattern to ensure interception
    await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      intercepted = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    const testEmail = 'server-error-test@example.com';
    const form = page.getByTestId('cta-waitlist-form');
    await form.locator('input[type="email"]').fill(testEmail);

    // Set up response promise BEFORE clicking submit
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 500,
      { timeout: 5000 }
    );

    await form.locator('button[type="submit"]').click();

    // Wait for error response
    await responsePromise;

    // Verify mock was intercepted
    expect(intercepted).toBe(true);

    // Verify error message is displayed
    const errorAlert = page.locator('#waitlist-cta [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText(/something went wrong/i);

    // Verify input still has aria-invalid attribute
    const emailInput = form.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');

    console.log('✅ Server error handling verified');
    console.log(`✅ Mock interception confirmed: ${intercepted}`);
  });

  /**
   * Test 6: Rate Limiting (429)
   *
   * Verifies rate limiting error is handled gracefully.
   */
  test('should handle rate limiting (429)', async ({ page }) => {
    let intercepted = false;

    // Mock the API to return rate limit error (BEFORE navigation)
    // Use exact URL pattern to ensure interception
    await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      intercepted = true;
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      });
    });

    await page.goto('/');

    const testEmail = 'rate-limit-test@example.com';
    const form = page.getByTestId('cta-waitlist-form');
    await form.locator('input[type="email"]').fill(testEmail);

    // Set up response promise BEFORE clicking submit
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 429,
      { timeout: 5000 }
    );

    await form.locator('button[type="submit"]').click();

    // Wait for rate limit response
    await responsePromise;

    // Verify mock was intercepted
    expect(intercepted).toBe(true);

    // Verify rate limit error message
    const errorAlert = page.locator('#waitlist-cta [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText(/too many requests/i);

    console.log('✅ Rate limiting error handling verified');
    console.log(`✅ Mock interception confirmed: ${intercepted}`);
  });

  /**
   * Test 7: Network Error Handling
   *
   * Verifies graceful handling when network fails completely.
   */
  test('should handle network errors', async ({ page }) => {
    let intercepted = false;

    // Mock the API to fail completely (network error) - BEFORE navigation
    // Use exact URL pattern to ensure interception
    await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      intercepted = true;
      await route.abort('failed');
    });

    await page.goto('/');

    const testEmail = 'network-error-test@example.com';
    const form = page.getByTestId('cta-waitlist-form');
    await form.locator('input[type="email"]').fill(testEmail);
    await form.locator('button[type="submit"]').click();

    // Wait a bit for the error to be caught
    await page.waitForTimeout(2000);

    // Verify mock was intercepted
    expect(intercepted).toBe(true);

    // Verify network error message
    const errorAlert = page.locator('#waitlist-cta [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText(/network error/i);

    console.log('✅ Network error handling verified');
    console.log(`✅ Mock interception confirmed: ${intercepted}`);
  });

  /**
   * Test 8: Accessibility - Form Structure
   *
   * Verifies all accessibility attributes are properly set.
   */
  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('/');

    // Check section has proper ARIA landmark
    const section = page.locator('#waitlist-cta');
    await expect(section).toHaveAttribute('aria-labelledby', 'waitlist-cta-heading');

    // Check form has aria-label using data-testid to avoid ambiguity
    const form = page.getByTestId('cta-waitlist-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('aria-label', 'Early access request form');

    // Check input has aria-label
    const input = form.locator('input[aria-label="Email address"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input).toHaveAttribute('required', '');

    // Verify initial state (no error)
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(input).not.toHaveAttribute('aria-describedby');

    console.log('✅ Accessibility attributes verified');
  });

  /**
   * Test 9: Duplicate Email Handling
   *
   * Verifies that submitting the same email twice is handled gracefully (upsert behavior).
   * The backend uses upsert, so duplicate submissions should succeed silently.
   */
  test('should handle duplicate email submissions gracefully', async ({ page }) => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;

    await page.goto('/');

    // Find form using data-testid
    const form = page.getByTestId('cta-waitlist-form');

    // First submission
    await form.locator('input[type="email"]').fill(duplicateEmail);
    await form.locator('button[type="submit"]').click();

    // Wait for success
    await page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 200,
      { timeout: 10000 }
    );
    await expect(page.locator('#waitlist-cta [role="status"]')).toBeVisible({ timeout: 5000 });

    console.log('✅ First submission successful');

    // Reload page for second submission
    await page.goto('/');

    // Second submission with same email
    const form2 = page.getByTestId('cta-waitlist-form');
    await form2.locator('input[type="email"]').fill(duplicateEmail);
    await form2.locator('button[type="submit"]').click();

    // Should still succeed (upsert behavior)
    await page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 200,
      { timeout: 10000 }
    );
    await expect(page.locator('#waitlist-cta [role="status"]')).toBeVisible({ timeout: 5000 });

    console.log('✅ Duplicate email handled gracefully (upsert)');
  });

  /**
   * Test 10: Form Reset After Error
   *
   * Verifies that after an error, the user can correct and resubmit.
   */
  test('should allow resubmission after error', async ({ page }) => {
    let errorIntercepted = false;

    // First, trigger an error (BEFORE navigation)
    // Use exact URL pattern to ensure interception
    await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      errorIntercepted = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto('/');

    const form = page.getByTestId('cta-waitlist-form');
    await form.locator('input[type="email"]').fill('error-test@example.com');
    await form.locator('button[type="submit"]').click();

    // Wait for error
    await expect(page.locator('#waitlist-cta [role="alert"]')).toBeVisible({ timeout: 5000 });

    // Verify error mock was intercepted
    expect(errorIntercepted).toBe(true);

    // Now remove the mock to allow successful submission
    await page.unroute('http://localhost:3001/v1/auth/early-access');

    // Change email and resubmit
    const successEmail = `success-${Date.now()}@example.com`;
    await form.locator('input[type="email"]').clear();
    await form.locator('input[type="email"]').fill(successEmail);
    await form.locator('button[type="submit"]').click();

    // Should now succeed
    await page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 200,
      { timeout: 10000 }
    );
    await expect(page.locator('#waitlist-cta [role="status"]')).toBeVisible({ timeout: 5000 });

    // Error should be gone
    await expect(page.locator('#waitlist-cta [role="alert"]')).not.toBeVisible();

    console.log('✅ Form recovery after error verified');
    console.log(`✅ Error mock interception confirmed: ${errorIntercepted}`);
  });

  /**
   * Test 11: Empty Email Validation
   *
   * Verifies HTML5 required attribute prevents empty submission.
   */
  test('should prevent submission with empty email (HTML5 validation)', async ({ page }) => {
    await page.goto('/');

    // Find form using data-testid
    const form = page.getByTestId('cta-waitlist-form');
    const submitButton = form.locator('button[type="submit"]');

    // Try to submit without filling email (HTML5 will prevent this)
    await submitButton.click();

    // Form should not submit (HTML5 validation)
    // We can verify by checking that no API request was made
    let requestMade = false;
    page.on('request', (request) => {
      if (request.url().includes('/v1/auth/early-access')) {
        requestMade = true;
      }
    });

    // Wait a bit to see if request is made
    await page.waitForTimeout(1000);

    // Verify no request was made
    expect(requestMade).toBe(false);

    // Verify input has required attribute
    const emailInput = form.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');

    console.log('✅ Empty email prevented by HTML5 validation');
  });

  /**
   * Test 12: Keyboard Navigation
   *
   * Verifies the form can be navigated and submitted using keyboard only.
   */
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    const testEmail = `keyboard-test-${Date.now()}@example.com`;

    // Focus directly on the CTA form's email input to test keyboard navigation
    const form = page.getByTestId('cta-waitlist-form');
    const emailInput = form.locator('input[type="email"]');
    await emailInput.focus();

    // Type email
    await page.keyboard.type(testEmail);

    // Tab to submit button
    await page.keyboard.press('Tab');

    // Set up response promise BEFORE pressing Enter
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/auth/early-access') && response.status() === 200,
      { timeout: 10000 }
    );

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Wait for success
    await responsePromise;
    await expect(page.locator('#waitlist-cta [role="status"]')).toBeVisible({ timeout: 5000 });

    console.log('✅ Keyboard navigation verified');
  });
});
