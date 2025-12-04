import { test, expect } from '@playwright/test';

/**
 * E2E Test: Booking Management (Reschedule/Cancel)
 *
 * Tests the customer self-service booking management flow:
 * 1. View booking details via JWT token URL
 * 2. Reschedule booking to a new date
 * 3. Cancel booking with confirmation
 * 4. Handle invalid/expired tokens
 */
test.describe('Booking Management', () => {
  // API base URL
  const API_BASE = 'http://localhost:3001';

  // Helper to get tomorrow's date in YYYY-MM-DD format
  function getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Helper to get a date N days from now
  function getFutureDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  // Reset mock state before each test
  test.beforeEach(async ({ request }) => {
    const resetResponse = await request.post(`${API_BASE}/v1/dev/reset`);
    expect(resetResponse.ok()).toBeTruthy();
  });

  test.describe('View Booking', () => {
    test('can view booking details with valid token', async ({ page, request }) => {
      // Create a booking and get management token
      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: getTomorrowDate(),
          email: 'test@example.com',
          coupleName: 'Test Couple',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url, bookingId } = await createResponse.json();

      // Navigate to booking management page
      await page.goto(url);

      // Verify booking details are displayed
      await expect(page.getByText('Booking Details')).toBeVisible();
      await expect(page.getByText('Test Couple')).toBeVisible();
      await expect(page.getByText('test@example.com')).toBeVisible();
      await expect(page.getByText('PAID')).toBeVisible();

      // Verify action buttons are available
      await expect(page.getByRole('button', { name: /Reschedule/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Cancel Booking/i })).toBeVisible();
    });

    test('shows error for invalid token', async ({ page }) => {
      // Navigate with invalid token
      await page.goto('/bookings/manage?token=invalid_token_12345');

      // Should show error message
      await expect(page.getByText(/Unable to Load Booking/i)).toBeVisible();
    });

    test('shows error for missing token', async ({ page }) => {
      // Navigate without token
      await page.goto('/bookings/manage');

      // Should show invalid link message
      await expect(page.getByText(/Invalid Link/i)).toBeVisible();
      await expect(page.getByText(/No access token was provided/i)).toBeVisible();
    });
  });

  test.describe('Reschedule Booking', () => {
    test('can reschedule booking to a new date', async ({ page, request }) => {
      // Create a booking for tomorrow
      const originalDate = getTomorrowDate();
      const newDate = getFutureDate(3); // 3 days from now

      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: originalDate,
          email: 'reschedule@example.com',
          coupleName: 'Reschedule Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url } = await createResponse.json();

      // Navigate to booking management page
      await page.goto(url);

      // Wait for page to load
      await expect(page.getByText('Booking Details')).toBeVisible();

      // Click reschedule button
      await page.getByRole('button', { name: /Reschedule/i }).click();

      // Verify dialog opened
      await expect(page.getByRole('heading', { name: /Reschedule Your Booking/i })).toBeVisible();

      // Select new date
      await page.fill('input[type="date"]', newDate);

      // Click confirm
      await page.getByRole('button', { name: /Confirm Reschedule/i }).click();

      // Wait for API call to complete
      await page.waitForResponse(
        (response) =>
          response.url().includes('/v1/public/bookings/reschedule') && response.status() === 200
      );

      // Verify dialog closed and new date is shown
      await expect(
        page.getByRole('heading', { name: /Reschedule Your Booking/i })
      ).not.toBeVisible();

      // The page should update with the new date
      const newDateFormatted = new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      await expect(page.getByText(newDateFormatted)).toBeVisible();
    });

    test('shows error when rescheduling to same date', async ({ page, request }) => {
      const eventDate = getTomorrowDate();

      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate,
          email: 'samedate@example.com',
          coupleName: 'Same Date Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url } = await createResponse.json();

      await page.goto(url);
      await expect(page.getByText('Booking Details')).toBeVisible();

      // Open reschedule dialog
      await page.getByRole('button', { name: /Reschedule/i }).click();

      // Enter the same date
      await page.fill('input[type="date"]', eventDate);

      // Click confirm
      await page.getByRole('button', { name: /Confirm Reschedule/i }).click();

      // Should show error (client-side validation)
      await expect(page.getByText(/Please select a different date/i)).toBeVisible();
    });
  });

  test.describe('Cancel Booking', () => {
    test('can cancel booking with confirmation', async ({ page, request }) => {
      // Create a booking
      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: getTomorrowDate(),
          email: 'cancel@example.com',
          coupleName: 'Cancel Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url } = await createResponse.json();

      await page.goto(url);
      await expect(page.getByText('Booking Details')).toBeVisible();

      // Click cancel button
      await page.getByRole('button', { name: /Cancel Booking/i }).click();

      // Verify dialog opened
      await expect(page.getByRole('heading', { name: /Cancel Your Booking/i })).toBeVisible();
      await expect(page.getByText(/This action cannot be undone/i)).toBeVisible();

      // Add cancellation reason (optional)
      await page.fill('textarea', 'Change of plans');

      // Type confirmation text
      await page.fill('input[placeholder*="cancel"]', 'cancel');

      // Click confirm cancellation
      await page.getByRole('button', { name: /Confirm Cancellation/i }).click();

      // Wait for API call to complete
      await page.waitForResponse(
        (response) =>
          response.url().includes('/v1/public/bookings/cancel') && response.status() === 200
      );

      // Verify success state
      await expect(page.getByText(/Booking Cancelled/i)).toBeVisible();
      await expect(page.getByText('CANCELED')).toBeVisible();

      // Action buttons should no longer be visible
      await expect(page.getByRole('button', { name: /Reschedule/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Cancel Booking/i })).not.toBeVisible();
    });

    test('requires confirmation text to cancel', async ({ page, request }) => {
      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: getTomorrowDate(),
          email: 'confirm@example.com',
          coupleName: 'Confirm Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url } = await createResponse.json();

      await page.goto(url);
      await page.getByRole('button', { name: /Cancel Booking/i }).click();

      // Confirm button should be disabled without confirmation text
      await expect(page.getByRole('button', { name: /Confirm Cancellation/i })).toBeDisabled();

      // Type wrong text
      await page.fill('input[placeholder*="cancel"]', 'wrong');
      await expect(page.getByRole('button', { name: /Confirm Cancellation/i })).toBeDisabled();

      // Type correct text
      await page.fill('input[placeholder*="cancel"]', 'cancel');
      await expect(page.getByRole('button', { name: /Confirm Cancellation/i })).toBeEnabled();
    });

    test('can close cancel dialog without cancelling', async ({ page, request }) => {
      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: getTomorrowDate(),
          email: 'keep@example.com',
          coupleName: 'Keep Booking Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url } = await createResponse.json();

      await page.goto(url);
      await page.getByRole('button', { name: /Cancel Booking/i }).click();

      // Click "Keep Booking" button
      await page.getByRole('button', { name: /Keep Booking/i }).click();

      // Dialog should close
      await expect(page.getByRole('heading', { name: /Cancel Your Booking/i })).not.toBeVisible();

      // Booking should still be PAID
      await expect(page.getByText('PAID')).toBeVisible();
    });
  });

  test.describe('Already Cancelled Booking', () => {
    test('shows cancelled state and no action buttons', async ({ page, request }) => {
      // Create and cancel a booking via API
      const createResponse = await request.post(`${API_BASE}/v1/dev/create-booking-with-token`, {
        data: {
          packageId: 'pkg_001',
          eventDate: getTomorrowDate(),
          email: 'precancelled@example.com',
          coupleName: 'Pre-cancelled Test',
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { url, token } = await createResponse.json();

      // Cancel via API
      const cancelResponse = await request.post(
        `${API_BASE}/v1/public/bookings/cancel?token=${token}`,
        {
          data: { reason: 'API cancel' },
        }
      );
      expect(cancelResponse.ok()).toBeTruthy();

      // Now visit the page
      await page.goto(url);

      // Should show cancelled status
      await expect(page.getByText('CANCELED')).toBeVisible();
      await expect(page.getByText(/Booking Cancelled/i)).toBeVisible();

      // No action buttons should be visible
      await expect(page.getByRole('button', { name: /Reschedule/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Cancel Booking/i })).not.toBeVisible();
    });
  });
});
