import { test, expect } from '@playwright/test';

/**
 * E2E Test: Mock Mode Booking Happy Path
 *
 * This test verifies the complete booking flow in mock mode:
 * 1. Navigate from home to first package
 * 2. Select a future date
 * 3. Choose an add-on
 * 4. Complete checkout (mock payment)
 * 5. Mark as paid and verify booking
 * 6. Verify date becomes unavailable via API
 */
test.describe('Mock Booking Flow', () => {
  // Reset mock state before each test for determinism
  test.beforeEach(async ({ page, request }) => {
    // Reset API state
    const resetResponse = await request.post('http://localhost:3001/v1/dev/reset');
    expect(resetResponse.ok()).toBeTruthy();
  });

  test('complete booking with add-on and verify availability', async ({ page, request }) => {
    // Step 1: Go to Home and click first package
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

    // Click first package card
    const firstPackageLink = page.locator('a[href*="/package/"]').first();
    await expect(firstPackageLink).toBeVisible();
    await firstPackageLink.click();

    // Step 2: Choose a future date
    await expect(page).toHaveURL(/\/package\/.+/);

    // Extract package slug from URL for later API check
    const url = page.url();
    const packageSlug = url.split('/package/')[1];
    expect(packageSlug).toBeTruthy();

    // Click first available date in calendar (button inside non-disabled day cell)
    const dateButton = page
      .locator('.rdp-day:not([data-hidden]):not([data-outside]):not(.rdp-day_disabled) button')
      .first();
    await expect(dateButton).toBeVisible();
    await dateButton.click();

    // Wait for availability check to complete
    await page.waitForResponse(
      (response) => response.url().includes('/v1/availability') && response.status() === 200
    );

    // Verify date was selected
    await expect(page.locator('.rdp-day_selected')).toBeVisible();

    // Extract selected date for later verification
    const selectedDateText = await page.locator('.rdp-day_selected').textContent();
    expect(selectedDateText).toBeTruthy();

    // Get the current month/year from the calendar to construct full date
    const calendarCaption = await page.locator('.rdp-caption').first().textContent();
    const selectedDay = selectedDateText?.trim();

    // Step 3: Select one add-on
    const addOnCheckbox = page.locator('input[type="checkbox"]').first();
    const addOnCount = await page.locator('input[type="checkbox"]').count();

    if (addOnCount > 0) {
      await expect(addOnCheckbox).toBeVisible();
      await addOnCheckbox.check();
      await expect(addOnCheckbox).toBeChecked();
    }

    // Fill contact details
    await page.fill('#coupleName', 'Mock E2E Test Couple');
    await page.fill('#email', 'mock-e2e@example.com');

    // Step 4: Click Checkout → redirected to local success (mock)
    const checkoutButton = page.getByTestId('checkout');
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    // Verify redirect to success page with session_id
    await page.waitForURL(/\/success\?session_id=mock_session_/);

    // Extract session ID for tracking
    const successUrl = page.url();
    const sessionId = new URL(successUrl).searchParams.get('session_id');
    expect(sessionId).toContain('mock_session_');

    // Step 5: Click "Mark as Paid (mock)" → expect success message
    const markPaidButton = page.getByTestId('mock-paid');
    await expect(markPaidButton).toBeEnabled();
    await markPaidButton.click();

    // Wait for booking confirmation
    await expect(page.getByText('Booking Confirmed!')).toBeVisible({ timeout: 10000 });

    // Verify booking details
    await expect(page.getByText('Confirmation Number')).toBeVisible();
    await expect(page.getByText('Mock E2E Test Couple')).toBeVisible();
    await expect(page.getByText('mock-e2e@example.com')).toBeVisible();

    // Extract booking ID from confirmation
    const confirmationText = await page
      .locator('text=Confirmation Number')
      .locator('..')
      .textContent();
    expect(confirmationText).toContain('booking_');

    // Step 6: Verify date becomes unavailable via API
    // Calculate the first available date (tomorrow from today)
    const bookedDate = new Date();
    bookedDate.setDate(bookedDate.getDate() + 1);
    const formattedDate = bookedDate.toISOString().split('T')[0];

    // Check availability via API
    const availabilityResponse = await request.get(
      `http://localhost:3001/v1/availability?date=${formattedDate}`
    );

    expect(availabilityResponse.ok()).toBeTruthy();
    const availabilityData = await availabilityResponse.json();

    // The date should now be unavailable (booked)
    expect(availabilityData.available).toBe(false);
    expect(availabilityData.reason).toBe('booked');

    console.log('✅ Booking completed successfully');
    console.log(`✅ Session ID: ${sessionId}`);
    console.log(`✅ Date ${formattedDate} is now unavailable (${availabilityData.reason})`);
  });

  test('validates required fields before checkout', async ({ page }) => {
    // Navigate to first package
    await page.goto('/');

    // Click "View Packages" button
    await page.getByRole('button', { name: /View Packages/i }).click();

    // Wait for packages section
    await expect(page.locator('#packages')).toBeInViewport();

    const firstPackageLink = page.locator('a[href*="/package/"]').first();
    await expect(firstPackageLink).toBeVisible();
    await firstPackageLink.click();
    await expect(page).toHaveURL(/\/package\/.+/);

    // Verify checkout button is disabled initially
    const checkoutButton = page.getByRole('button', { name: /Select a date/i });
    await expect(checkoutButton).toBeDisabled();

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
