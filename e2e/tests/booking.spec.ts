import { test, expect } from '@playwright/test';

/**
 * E2E Test: Booking Flow
 *
 * Consolidated tests for the complete customer booking journey:
 * 1. Navigate from home to tier selection
 * 2. Select a date and add-ons
 * 3. Complete checkout (mock payment)
 * 4. Verify booking confirmation and API state
 *
 * Uses mock mode for deterministic testing.
 */
test.describe('Booking Flow', () => {
  // Reset mock state before each test for determinism
  test.beforeEach(async ({ request }) => {
    const resetResponse = await request.post('http://localhost:3001/v1/dev/reset');
    expect(resetResponse.ok()).toBeTruthy();
  });

  test('complete booking journey with add-on and verify availability', async ({
    page,
    request,
  }) => {
    // Step 1: Go to Home and click first tier
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Verify hero section loaded
    await expect(
      page.getByRole('heading', { name: /Your Perfect Day, Simplified/i })
    ).toBeVisible();

    // Click "View Packages" to scroll to packages section
    await page.getByRole('button', { name: /View Packages/i }).click();

    // Wait for packages section to be visible
    await expect(page.locator('#packages')).toBeInViewport();

    // Click first tier card
    const firstTierLink = page.locator('a[href*="/book/"]').first();
    await expect(firstTierLink).toBeVisible({ timeout: 10000 });
    await firstTierLink.click();

    // Step 2: Choose a future date
    await expect(page).toHaveURL(/\/book\/.+/);

    // Extract tier slug from URL for later API check
    const url = page.url();
    const tierSlug = url.split('/book/')[1];
    expect(tierSlug).toBeTruthy();

    // Click first available date in calendar (button inside non-disabled day cell)
    const dateButton = page
      .locator('.rdp-day:not([data-hidden]):not([data-outside]):not(.rdp-day_disabled) button')
      .first();
    await expect(dateButton).toBeVisible();
    await dateButton.click();

    // Wait for availability check to complete (more reliable than networkidle)
    await page.waitForResponse(
      (response) => response.url().includes('/v1/availability') && response.status() === 200
    );

    // Verify date was selected
    await expect(page.locator('.rdp-day_selected')).toBeVisible();

    // Step 3: Select one add-on if available
    const addOnCheckboxes = page.locator('input[type="checkbox"]');
    const addOnCount = await addOnCheckboxes.count();

    if (addOnCount > 0) {
      await expect(addOnCheckboxes.first()).toBeVisible();
      await addOnCheckboxes.first().check();
      await expect(addOnCheckboxes.first()).toBeChecked();
    }

    // Fill contact details
    await page.fill('#coupleName', 'E2E Test Couple');
    await page.fill('#email', 'booking-e2e@example.com');

    // Step 4: Click Checkout → redirected to success page (mock)
    const checkoutButton = page.getByRole('button', { name: /Proceed to Checkout/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    // Verify redirect to success page with session_id
    await expect(page).toHaveURL(/\/success\?session_id=/);

    // Extract session ID for tracking
    const successUrl = page.url();
    const sessionId = new URL(successUrl).searchParams.get('session_id');
    expect(sessionId).toBeTruthy();

    // Step 5: Click "Mark as Paid" button (mock mode only)
    const markPaidButton = page.getByRole('button', { name: /Mark as Paid/i });
    await expect(markPaidButton).toBeVisible({ timeout: 5000 });
    await markPaidButton.click();

    // Wait for booking confirmation
    await page.waitForSelector('text=Booking Confirmed!', { timeout: 10000 });

    // Step 6: Verify confirmation details
    await expect(page.getByText('Confirmation Number')).toBeVisible();
    await expect(page.getByText('E2E Test Couple')).toBeVisible();
    await expect(page.getByText('booking-e2e@example.com')).toBeVisible();
    await expect(page.getByText('confirmed', { exact: false })).toBeVisible();

    // Verify "Back to Home" button exists
    await expect(page.getByRole('button', { name: /Back to Home/i })).toBeVisible();

    // Step 7: Verify date becomes unavailable via API
    const bookedDate = new Date();
    bookedDate.setDate(bookedDate.getDate() + 1);
    const formattedDate = bookedDate.toISOString().split('T')[0];

    const availabilityResponse = await request.get(
      `http://localhost:3001/v1/availability?date=${formattedDate}`
    );

    expect(availabilityResponse.ok()).toBeTruthy();
    const availabilityData = await availabilityResponse.json();
    expect(availabilityData.available).toBe(false);
  });

  test('validation prevents checkout without required fields', async ({ page }) => {
    // Navigate to first tier
    await page.goto('/');

    // Click "View Packages" button
    await page.getByRole('button', { name: /View Packages/i }).click();

    // Wait for packages section
    await expect(page.locator('#packages')).toBeInViewport();

    const firstTierLink = page.locator('a[href*="/book/"]').first();
    await expect(firstTierLink).toBeVisible({ timeout: 10000 });
    await firstTierLink.click();
    await expect(page).toHaveURL(/\/book\/.+/);

    // Verify checkout button is disabled initially
    const selectDateButton = page.getByRole('button', { name: /Select a date/i });
    await expect(selectDateButton).toBeDisabled();

    // Select a date (button inside non-disabled day cell)
    const dateButton = page
      .locator('.rdp-day:not([data-hidden]):not([data-outside]):not(.rdp-day_disabled) button')
      .first();
    await dateButton.click();

    // Wait for availability check
    await page.waitForResponse(
      (response) => response.url().includes('/v1/availability') && response.status() === 200
    );

    // Button should now ask for details
    await expect(page.getByRole('button', { name: /Enter your details/i })).toBeDisabled();

    // Fill couple name only
    await page.fill('#coupleName', 'Test Couple');
    await expect(page.getByRole('button', { name: /Enter your details/i })).toBeDisabled();

    // Fill email - button should now be enabled
    await page.fill('#email', 'test@example.com');
    await expect(page.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
  });
});
