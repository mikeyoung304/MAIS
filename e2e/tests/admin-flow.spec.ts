import { test, expect } from '@playwright/test';

/**
 * E2E Test: Admin Flow
 *
 * Tests the admin dashboard functionality:
 * 1. Admin login
 * 2. View dashboard metrics
 * 3. Create a test package
 * 4. Edit the package
 * 5. Add an add-on
 * 6. Create a blackout date
 * 7. Clean up (delete package)
 *
 * Environment Variables:
 * - E2E_ADMIN_EMAIL: Admin email (default: admin@example.com)
 * - E2E_ADMIN_PASSWORD: Admin password (default: admin123admin)
 */

// Admin credentials from environment variables with test defaults
// SECURITY NOTE: These are test-only defaults. In CI, set proper env vars.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123admin';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth token
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('adminToken'));
  });

  test('admin can login and access dashboard', async ({ page }) => {
    // 1. Go to login page (unified login)
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    // Verify login form is visible
    await expect(page.getByRole('heading', { name: /^Login$/i })).toBeVisible();

    // 2. Fill login form
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);

    // 3. Click login button and wait for navigation
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });

    // 4. Wait for dashboard to fully load
    await page.waitForLoadState('domcontentloaded');

    // 5. Verify dashboard loads with heading
    await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible();

    // 6. Verify metrics cards are visible
    await expect(page.getByText('Total Bookings')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Packages')).toBeVisible();
    await expect(page.getByText('Blackout Dates')).toBeVisible();

    // 7. Verify tabs are present
    await expect(page.getByRole('button', { name: 'Bookings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blackouts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Packages' })).toBeVisible();
  });

  test('admin can manage packages', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // 1. Click "Packages" tab
    await page.getByRole('button', { name: 'Packages' }).click();

    // 2. Click "Create Package" button
    await page.getByRole('button', { name: 'Create Package' }).click();

    // Verify package form is visible
    await expect(page.getByRole('heading', { name: /Create New Package/i })).toBeVisible();

    // 3. Fill package form
    await page.fill('#slug', 'e2e-test-package');
    await page.fill('#title', 'E2E Test Package');
    await page.fill(
      'textarea#description',
      'This is a test package created by E2E automation tests'
    );
    await page.fill('#priceCents', '50000'); // $500.00

    // 4. Click "Create Package" button (submit form)
    await page.getByRole('button', { name: /Create Package/i, exact: true }).click();

    // 5. Wait for success message
    await expect(page.getByText(/Package created successfully/i)).toBeVisible({ timeout: 5000 });

    // 6. Verify package appears in the list
    await expect(page.getByText('E2E Test Package')).toBeVisible();
    await expect(page.getByText('e2e-test-package')).toBeVisible();

    // 7. Test editing the package
    // Find the Edit button near the E2E Test Package
    const packageCard = page.locator('text=E2E Test Package').locator('../..');
    await packageCard.getByRole('button', { name: 'Edit' }).click();

    // Verify edit form loaded with data
    await expect(page.getByRole('heading', { name: /Edit Package/i })).toBeVisible();
    await expect(page.locator('#title')).toHaveValue('E2E Test Package');

    // Update the title
    await page.fill('#title', 'E2E Test Package (Updated)');
    await page.getByRole('button', { name: /Update Package/i }).click();

    // Wait for success message
    await expect(page.getByText(/Package updated successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify updated package appears
    await expect(page.getByText('E2E Test Package (Updated)')).toBeVisible();

    // 8. Test adding an add-on
    // Find the package card again
    const updatedPackageCard = page.locator('text=E2E Test Package (Updated)').locator('../..');

    // Click "Show" to expand add-ons section
    await updatedPackageCard.getByRole('button', { name: 'Show' }).click();

    // Click "Add Add-on" button
    await updatedPackageCard.getByRole('button', { name: 'Add Add-on' }).click();

    // Fill add-on form
    await page.fill('#addOnTitle', 'E2E Test Add-on');
    await page.fill('#addOnPrice', '10000'); // $100.00

    // Click "Add" button to create add-on
    await updatedPackageCard.getByRole('button', { name: 'Add', exact: true }).click();

    // Wait for success message
    await expect(page.getByText(/Add-on created successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify add-on appears in the list
    await expect(page.getByText('E2E Test Add-on')).toBeVisible();

    // 9. Delete the test package (cleanup)
    // Find the Delete button
    const finalPackageCard = page.locator('text=E2E Test Package (Updated)').locator('../..');

    // Set up dialog handler before clicking delete
    page.on('dialog', (dialog) => dialog.accept());
    await finalPackageCard.getByRole('button', { name: 'Delete' }).click();

    // Wait for success message
    await expect(page.getByText(/Package deleted successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify package is removed from list
    await expect(page.getByText('E2E Test Package (Updated)')).not.toBeVisible();
  });

  test('admin can manage blackout dates', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // 1. Click "Blackouts" tab
    await page.getByRole('button', { name: 'Blackouts' }).click();

    // Verify blackouts section is visible
    await expect(page.getByRole('heading', { name: /Add Blackout Date/i })).toBeVisible();

    // 2. Add a blackout date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const blackoutDate = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    await page.fill('#blackoutDate', blackoutDate);
    await page.fill('#blackoutReason', 'E2E Test Blackout - Holiday');

    // 3. Click "Add" button
    await page.getByRole('button', { name: 'Add' }).click();

    // 4. Wait for the API response and verify blackout appears
    await page.waitForResponse(
      (response) => response.url().includes('/blackout') && response.status() === 201,
      { timeout: 10000 }
    );

    // Verify blackout date appears in the table
    await expect(page.getByText(blackoutDate)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('E2E Test Blackout - Holiday')).toBeVisible();
  });

  test('admin can view bookings table', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Bookings tab should be active by default
    await expect(page.getByRole('heading', { name: /Bookings/i })).toBeVisible();

    // Verify table columns
    await expect(page.getByText('Couple')).toBeVisible();
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Package')).toBeVisible();
    await expect(page.getByText('Total')).toBeVisible();

    // Verify Export CSV button exists
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });

  test('admin can logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Click logout button
    await page.getByRole('button', { name: /Logout/i }).click();

    // Verify redirect back to login page
    await expect(page).toHaveURL('/login');

    // Verify cannot access admin without auth
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
