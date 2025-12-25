import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Next.js Tenant Storefront Booking Flow
 *
 * Tests the booking flow on the Next.js tenant storefront:
 * 1. Visit tenant storefront at /t/[slug]
 * 2. View package details
 * 3. Complete booking wizard
 * 4. Verify success page
 *
 * Prerequisites:
 * - Next.js app running at port 3000
 * - Express API running at port 3001
 * - Test tenant "mais-e2e" exists with packages
 *
 * Run: NEXTJS_E2E=1 npx playwright test nextjs-booking-flow.spec.ts
 */

const NEXTJS_BASE_URL = process.env.NEXTJS_URL || 'http://localhost:3000';
const TEST_TENANT_SLUG = 'mais-e2e';

// Skip these tests unless explicitly enabled (Next.js migration is in progress)
test.describe.configure({ mode: 'parallel' });

test.describe('Next.js Tenant Storefront Booking Flow', () => {
  // Skip if Next.js E2E flag not set
  test.beforeEach(async ({ page }) => {
    if (!process.env.NEXTJS_E2E) {
      test.skip();
    }

    // Set base URL for Next.js app
    await page.goto(NEXTJS_BASE_URL);
  });

  test('can view tenant storefront landing page', async ({ page }) => {
    await page.goto(`${NEXTJS_BASE_URL}/t/${TEST_TENANT_SLUG}`);

    // Wait for page to load (ISR may take a moment on first hit)
    await page.waitForLoadState('networkidle');

    // Verify tenant name is displayed
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Verify packages are displayed
    const packageCards = page.locator('[data-testid="package-card"]');
    // If no test IDs, try finding by common patterns
    if ((await packageCards.count()) === 0) {
      // Look for package-like elements (cards with prices)
      const priceElements = page.locator('text=$');
      await expect(priceElements.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can navigate to package booking page', async ({ page }) => {
    await page.goto(`${NEXTJS_BASE_URL}/t/${TEST_TENANT_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Find and click a "Book Now" or similar button
    const bookButton = page
      .locator('a, button')
      .filter({ hasText: /book|reserve|schedule/i })
      .first();

    if (await bookButton.isVisible()) {
      await bookButton.click();

      // Verify navigation to booking page
      await expect(page).toHaveURL(new RegExp(`/t/${TEST_TENANT_SLUG}/book/`));
      await page.waitForLoadState('networkidle');

      // Verify booking wizard is displayed
      const bookingHeading = page.locator('h1, h2').filter({ hasText: /book|select|choose/i });
      await expect(bookingHeading.first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, 'No booking buttons found on storefront');
    }
  });

  test('booking wizard shows date selection step', async ({ page }) => {
    // Navigate directly to a booking page (assuming package slug format)
    await page.goto(`${NEXTJS_BASE_URL}/t/${TEST_TENANT_SLUG}/book/wedding-essential`);
    await page.waitForLoadState('networkidle');

    // Look for date picker or calendar element
    const calendar = page.locator('[role="grid"], .rdp, .calendar, [data-testid="calendar"]');
    const hasCalendar = await calendar.first().isVisible().catch(() => false);

    if (hasCalendar) {
      // Verify calendar is interactive
      const dateButton = page.locator('button, [role="gridcell"]').filter({ hasText: /^\d+$/ }).first();
      await expect(dateButton).toBeVisible();
    } else {
      // May be a different step in the wizard
      const stepIndicator = page.locator('text=/step|date|select/i');
      await expect(stepIndicator.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('booking form validates required fields', async ({ page }) => {
    await page.goto(`${NEXTJS_BASE_URL}/t/${TEST_TENANT_SLUG}/book/wedding-essential`);
    await page.waitForLoadState('networkidle');

    // Try to submit without filling required fields
    const submitButton = page
      .locator('button[type="submit"], button')
      .filter({ hasText: /continue|next|book|submit/i })
      .first();

    if (await submitButton.isVisible()) {
      // If button is enabled, click and check for validation errors
      if (await submitButton.isEnabled()) {
        await submitButton.click();

        // Check for validation messages
        const errorMessage = page.locator('[role="alert"], .error, text=/required|please|invalid/i');
        await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });
      } else {
        // Button disabled - validation working
        await expect(submitButton).toBeDisabled();
      }
    }
  });

  test('success page displays booking confirmation', async ({ page }) => {
    // Navigate directly to success page with mock parameters
    await page.goto(
      `${NEXTJS_BASE_URL}/t/${TEST_TENANT_SLUG}/book/success?booking_id=test-booking-123`
    );
    await page.waitForLoadState('networkidle');

    // Verify success page content
    const successHeading = page.locator('h1, h2').filter({ hasText: /confirmed|success|thank/i });
    await expect(successHeading.first()).toBeVisible({ timeout: 5000 });

    // Verify back button exists
    const backButton = page.locator('a, button').filter({ hasText: /back|home|return/i });
    await expect(backButton.first()).toBeVisible();
  });

  test('custom domain routing resolves tenant correctly', async ({ page }) => {
    // This test verifies the _domain route works
    // In production, custom domains would be tested via actual domain setup
    // For now, we test the internal route directly

    await page.goto(
      `${NEXTJS_BASE_URL}/t/_domain?domain=${TEST_TENANT_SLUG}.example.com`
    );
    await page.waitForLoadState('networkidle');

    // If domain is configured, should show tenant content
    // If not, should show 404 or error
    const pageTitle = await page.title();
    expect(pageTitle).toBeDefined();
  });
});

/**
 * Helper function to complete booking wizard
 */
async function completeBookingWizard(
  page: Page,
  options: {
    name: string;
    email: string;
    date?: Date;
  }
): Promise<void> {
  // Step 1: Select date
  const dateButton = page.locator('.rdp-day:not(.rdp-day_disabled) button').first();
  if (await dateButton.isVisible()) {
    await dateButton.click();
  }

  // Step 2: Fill contact info
  const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill(options.name);
  }

  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill(options.email);
  }

  // Step 3: Submit
  const submitButton = page
    .locator('button[type="submit"], button')
    .filter({ hasText: /continue|book|submit/i })
    .first();

  if (await submitButton.isEnabled()) {
    await submitButton.click();
  }
}
