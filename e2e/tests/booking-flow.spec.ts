import { test, expect } from '@playwright/test';

/**
 * E2E Test: Complete Booking Flow
 *
 * Tests the happy path for a customer booking a wedding package:
 * 1. Visit homepage
 * 2. Navigate to package catalog
 * 3. Select a package
 * 4. Choose a date
 * 5. Fill contact details
 * 6. Proceed to checkout
 * 7. Simulate payment (mock mode)
 * 8. Verify booking confirmation
 */
test.describe('Booking Flow', () => {
  test('complete booking journey from homepage to confirmation', async ({ page }) => {
    // 1. Start at homepage
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Verify hero section loaded
    await expect(
      page.getByRole('heading', { name: /Your Perfect Day, Simplified/i })
    ).toBeVisible();

    // 2. Click "View Packages" button to scroll to packages section
    await page.getByRole('button', { name: /View Packages/i }).click();

    // Wait for packages section to be visible
    await expect(page.locator('#packages')).toBeInViewport();

    // 3. Wait for packages to load (API call completes)
    await page.waitForLoadState('networkidle');

    // Wait for packages to be rendered
    const firstPackageLink = page.locator('a[href*="/package/"]').first();
    await expect(firstPackageLink).toBeVisible({ timeout: 10000 });
    await firstPackageLink.click();

    // 4. Verify package details page loaded
    await expect(page).toHaveURL(/\/package\/.+/);
    await page.waitForLoadState('networkidle');

    // Verify package title and details are visible
    await expect(page.locator('h1').first()).toBeVisible();

    // 5. Select a date (7 days from now to avoid blackouts)
    // The DatePicker uses react-day-picker, which renders dates as buttons
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Find and click an available date in the calendar (button inside non-disabled day cell)
    // react-day-picker uses button elements for selectable dates
    const dateButton = page
      .locator('.rdp-day:not([data-hidden]):not([data-outside]):not(.rdp-day_disabled) button')
      .first();
    await expect(dateButton).toBeVisible();
    await dateButton.click();

    // Wait for availability check API call to complete
    await page.waitForLoadState('networkidle');

    // Verify date was selected (should show blue background)
    await expect(page.locator('.rdp-day_selected')).toBeVisible();

    // 6. Fill contact form
    await page.fill('#coupleName', 'Test Couple E2E');
    await page.fill('#email', 'test-e2e@example.com');

    // 7. Optional: Select add-ons if available
    // The AddOnList component renders checkboxes for add-ons
    const addOnCheckboxes = page.locator('input[type="checkbox"]');
    const addOnCount = await addOnCheckboxes.count();
    if (addOnCount > 0) {
      // Select the first add-on if available
      await addOnCheckboxes.first().check();
    }

    // 8. Click "Proceed to Checkout" button
    const checkoutButton = page.getByRole('button', { name: /Proceed to Checkout/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    // 9. Verify redirect to Success page
    // In mock mode, should redirect to /success?session_id=mock_xxx
    await expect(page).toHaveURL(/\/success\?session_id=/);
    await page.waitForLoadState('networkidle');

    // Verify success page loaded
    await expect(page.locator('h1')).toContainText(/Almost There|Booking Confirmed/i);

    // 10. Mock mode: click "Mark as Paid" button
    // Only visible in mock mode when session_id is present and payment not complete
    const markPaidButton = page.getByRole('button', { name: /Mark as Paid/i });

    // Wait for the button to be visible
    await expect(markPaidButton).toBeVisible({ timeout: 5000 });
    await markPaidButton.click();

    // 11. Wait for booking details to load
    await page.waitForSelector('text=Booking Confirmed!', { timeout: 10000 });

    // 12. Verify confirmation details appear
    await expect(page.getByText('Confirmation Number')).toBeVisible();
    await expect(page.getByText('Test Couple E2E')).toBeVisible();
    await expect(page.getByText('test-e2e@example.com')).toBeVisible();

    // Verify booking status is confirmed
    await expect(page.getByText('confirmed', { exact: false })).toBeVisible();

    // Verify "Back to Home" button exists
    await expect(page.getByRole('button', { name: /Back to Home/i })).toBeVisible();
  });

  test('validation prevents checkout without required fields', async ({ page }) => {
    // Navigate to a package page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for packages to render
    const firstPackageLink = page.locator('a[href*="/package/"]').first();
    await expect(firstPackageLink).toBeVisible({ timeout: 10000 });
    await firstPackageLink.click();
    await page.waitForLoadState('networkidle');

    // Verify checkout button is disabled without date and contact info
    const checkoutButton = page.getByRole('button', { name: /Select a date/i });
    await expect(checkoutButton).toBeDisabled();

    // Select a date (button inside non-disabled day cell)
    const dateButton = page
      .locator('.rdp-day:not([data-hidden]):not([data-outside]):not(.rdp-day_disabled) button')
      .first();
    await expect(dateButton).toBeVisible();
    await dateButton.click();
    await page.waitForLoadState('networkidle');

    // Button should now ask for details
    await expect(page.getByRole('button', { name: /Enter your details/i })).toBeDisabled();

    // Fill only couple name
    await page.fill('#coupleName', 'Test Couple');
    await expect(page.getByRole('button', { name: /Enter your details/i })).toBeDisabled();

    // Fill email - now button should be enabled
    await page.fill('#email', 'test@example.com');
    await expect(page.getByRole('button', { name: /Proceed to Checkout/i })).toBeEnabled();
  });
});
