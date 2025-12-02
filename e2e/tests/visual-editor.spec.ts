import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Visual Editor Flow
 *
 * Tests the visual editor functionality for tenant admins:
 * 1. Load visual editor dashboard
 * 2. Edit package title/description/price inline
 * 3. Auto-save draft functionality
 * 4. Publish all drafts
 * 5. Discard all drafts
 * 6. UI disabled during publish
 *
 * Note: These tests share a single tenant to avoid rate limiting on signup.
 * Each test navigates fresh to the visual editor and discards any leftover drafts.
 */

// Run tests serially - they share state and modify packages
test.describe.configure({ mode: 'serial' });

// Shared state - signup once, reuse across all tests
let isSetup = false;
let authToken: string | null = null;

/**
 * Helper: Sign up once and cache the auth token
 */
async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const testEmail = `ve-e2e-${timestamp}-${random}@example.com`;
    const testPassword = 'SecurePass123!';
    const businessName = `Visual Editor E2E ${timestamp}`;

    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /Sign Up/i })).toBeVisible({ timeout: 10000 });

    await page.fill('#businessName', businessName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);

    const responsePromise = page.waitForResponse(
      response => response.url().includes('/v1/auth/signup'),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /Create Account/i }).click();

    const response = await responsePromise;
    if (response.status() === 429) {
      throw new Error('Rate limited - run tests later or increase rate limit');
    }
    if (response.status() !== 201) {
      const body = await response.text();
      throw new Error(`Signup failed with status ${response.status()}: ${body}`);
    }

    await expect(page).toHaveURL('/tenant/dashboard', { timeout: 15000 });

    // Cache auth token from localStorage
    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
    isSetup = true;
  } else if (authToken) {
    // Restore cached auth token
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('tenantToken', token);
    }, authToken);
  }
}

/**
 * Helper: Navigate to visual editor and wait for load
 */
async function goToVisualEditor(page: Page): Promise<void> {
  await page.goto('/tenant/visual-editor');
  await expect(page.getByRole('heading', { name: /Visual Editor/i })).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Discard any existing drafts to start clean
 */
async function discardDraftsIfAny(page: Page): Promise<void> {
  const discardButton = page.getByRole('button', { name: /Discard/i }).first();
  const isVisible = await discardButton.isVisible().catch(() => false);
  const isEnabled = isVisible ? await discardButton.isEnabled().catch(() => false) : false;

  if (isVisible && isEnabled) {
    await discardButton.click();
    // Confirm discard
    const confirmButton = page.getByRole('button', { name: /Discard All/i });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('Visual Editor', () => {

  test('loads visual editor dashboard with packages', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);

    // Verify page loaded with expected elements
    await expect(page.getByText(/Edit your packages directly/i)).toBeVisible();

    // Back to dashboard link should exist
    await expect(page.locator('a[href="/tenant/dashboard"]')).toBeVisible();
  });

  test('edits package title inline and shows draft indicator', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Find the first editable title
    const titleField = page.locator('[aria-label="Package title"]').first();
    await expect(titleField).toBeVisible({ timeout: 10000 });

    // Click to enter edit mode and type
    await titleField.click();
    const input = titleField.locator('input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('E2E Updated Title');
    await input.blur();

    // Verify draft indicator appears
    await expect(page.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/unsaved change/i)).toBeVisible({ timeout: 5000 });
  });

  test('edits package price inline', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    const priceField = page.locator('[aria-label="Package price"]').first();
    await expect(priceField).toBeVisible({ timeout: 10000 });

    await priceField.click();
    const input = priceField.locator('input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('149.99');
    await input.blur();

    await expect(page.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
  });

  test('edits package description inline (multiline)', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    const descField = page.locator('[aria-label="Package description"]').first();
    await expect(descField).toBeVisible({ timeout: 10000 });

    await descField.click();
    const textarea = descField.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('This is an updated description.\nIt spans multiple lines.');
    await textarea.blur();

    await expect(page.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
  });

  test('auto-saves draft after debounce and persists on reload', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Edit title
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const uniqueTitle = `AutoSave Test ${Date.now()}`;
    await input.fill(uniqueTitle);
    await input.blur();

    // Wait for debounce (1s) + save
    await page.waitForTimeout(2500);

    // Reload and verify draft persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Visual Editor/i })).toBeVisible({ timeout: 15000 });

    // The edited title should still be visible
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });

    // Clean up
    await discardDraftsIfAny(page);
  });

  test('publishes all drafts successfully', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Make an edit
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    await input.fill('To Be Published');
    await input.blur();

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Click Publish All
    const publishButton = page.getByRole('button', { name: /Publish All/i });
    await expect(publishButton).toBeEnabled({ timeout: 5000 });
    await publishButton.click();

    // Wait for publish
    await page.waitForResponse(
      response => response.url().includes('/drafts/publish'),
      { timeout: 15000 }
    );

    // Verify success toast
    await expect(page.getByText(/Published/i)).toBeVisible({ timeout: 5000 });

    // Verify no more draft indicators on cards
    await page.waitForTimeout(1000);
    // Note: The action bar should hide when draftCount === 0
  });

  test('discards all drafts with confirmation dialog', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Get original title
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const originalTitle = await input.inputValue();

    // Make an edit
    await input.fill('Will Be Discarded');
    await input.blur();

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Verify draft exists
    await expect(page.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });

    // Click Discard
    const discardButton = page.getByRole('button', { name: /Discard/i }).first();
    await discardButton.click();

    // Verify confirmation dialog
    await expect(page.getByRole('heading', { name: /Discard Changes/i })).toBeVisible({ timeout: 5000 });

    // Confirm
    await page.getByRole('button', { name: /Discard All/i }).click();

    // Wait for API call
    await page.waitForResponse(
      response => response.url().includes('/drafts/discard'),
      { timeout: 10000 }
    );

    // Verify toast
    await expect(page.getByText(/Discarded/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify original title restored
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });
  });

  test('shows loading states during operations', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Make an edit
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    await input.fill('Loading State Test');
    await input.blur();

    // Wait for draft to save
    await page.waitForTimeout(2000);

    // Click publish and check for loading state
    const publishButton = page.getByRole('button', { name: /Publish All/i });
    await publishButton.click();

    // Should show "Publishing..." text
    await expect(page.getByText(/Publishing/i)).toBeVisible({ timeout: 2000 });

    // Wait for completion
    await page.waitForResponse(
      response => response.url().includes('/drafts/publish'),
      { timeout: 15000 }
    );
  });

  test('handles escape key to cancel edit', async ({ page }) => {
    await ensureLoggedIn(page);
    await goToVisualEditor(page);
    await discardDraftsIfAny(page);

    // Get original title
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const originalTitle = await input.inputValue();

    // Type something
    await input.fill('Should Be Cancelled');

    // Press Escape
    await input.press('Escape');

    // Verify original value is shown (edit cancelled, not saved)
    await page.waitForTimeout(500);
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 5000 });

    // Verify no draft indicator (edit was cancelled before blur)
    const unsavedText = page.getByText('Unsaved changes');
    await expect(unsavedText).not.toBeVisible({ timeout: 2000 });
  });
});
