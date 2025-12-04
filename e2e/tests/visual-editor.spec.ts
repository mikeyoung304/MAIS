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
 * Each test uses a fresh authenticated tenant via the auth fixture.
 * Tests run in parallel for faster CI execution.
 */
import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Helper: Navigate to visual editor and wait for load
 */
async function goToVisualEditor(page: Page): Promise<void> {
  await page.goto('/tenant/visual-editor');
  await expect(page.getByRole('heading', { name: /Visual Editor/i })).toBeVisible({
    timeout: 15000,
  });
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
    // Wait for confirmation dialog
    const confirmButton = page.getByRole('button', { name: /Discard All/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    // Wait for discard API response
    await page.waitForResponse(
      (response) => response.url().includes('/drafts/discard'),
      { timeout: 10000 }
    ).catch(() => {
      // No draft to discard - that's fine
    });
  }
}

/**
 * Helper: Wait for auto-save to complete after making edits
 */
async function waitForAutoSave(page: Page): Promise<void> {
  // Wait for the draft save API response
  await page.waitForResponse(
    (response) => response.url().includes('/drafts') && response.request().method() === 'PUT',
    { timeout: 10000 }
  ).catch(() => {
    // Draft might already be saved or debounce not triggered yet
  });
}

test.describe('Visual Editor', () => {
  test('loads visual editor dashboard with packages', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);

    // Verify page loaded with expected elements
    await expect(authenticatedPage.getByText(/Edit your packages directly/i)).toBeVisible();

    // Back to dashboard link should exist
    await expect(authenticatedPage.locator('a[href="/tenant/dashboard"]')).toBeVisible();
  });

  test('edits package title inline and shows draft indicator', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Find the first editable title
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await expect(titleField).toBeVisible({ timeout: 10000 });

    // Click to enter edit mode and type
    await titleField.click();
    const input = titleField.locator('input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('E2E Updated Title');
    await input.blur();

    // Verify draft indicator appears
    await expect(authenticatedPage.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
  });

  test('edits package price inline', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    const priceField = authenticatedPage.locator('[aria-label="Package price"]').first();
    await expect(priceField).toBeVisible({ timeout: 10000 });

    await priceField.click();
    const input = priceField.locator('input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('149.99');
    await input.blur();

    await expect(authenticatedPage.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
  });

  test('edits package description inline (multiline)', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    const descField = authenticatedPage.locator('[aria-label="Package description"]').first();
    await expect(descField).toBeVisible({ timeout: 10000 });

    await descField.click();
    const textarea = descField.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('This is an updated description.\nIt spans multiple lines.');
    await textarea.blur();

    await expect(authenticatedPage.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });
  });

  test('auto-saves draft after debounce and persists on reload', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Edit title
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const uniqueTitle = `AutoSave Test ${Date.now()}`;
    await input.fill(uniqueTitle);
    await input.blur();

    // Wait for auto-save API response
    await waitForAutoSave(authenticatedPage);

    // Reload and verify draft persisted
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.getByRole('heading', { name: /Visual Editor/i })).toBeVisible({
      timeout: 15000,
    });

    // The edited title should still be visible
    await expect(authenticatedPage.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });

    // Clean up
    await discardDraftsIfAny(authenticatedPage);
  });

  test('publishes all drafts successfully', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Make an edit
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    await input.fill('To Be Published');
    await input.blur();

    // Wait for auto-save
    await waitForAutoSave(authenticatedPage);

    // Click Publish All
    const publishButton = authenticatedPage.getByRole('button', { name: /Publish All/i });
    await expect(publishButton).toBeEnabled({ timeout: 5000 });
    await publishButton.click();

    // Wait for publish API response
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes('/drafts/publish'),
      { timeout: 15000 }
    );

    // Verify success toast
    await expect(authenticatedPage.getByText(/Published/i)).toBeVisible({ timeout: 5000 });
  });

  test('discards all drafts with confirmation dialog', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Get original title
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const originalTitle = await input.inputValue();

    // Make an edit
    await input.fill('Will Be Discarded');
    await input.blur();

    // Wait for auto-save
    await waitForAutoSave(authenticatedPage);

    // Verify draft exists
    await expect(authenticatedPage.getByText('Unsaved changes').first()).toBeVisible({ timeout: 5000 });

    // Click Discard
    const discardButton = authenticatedPage.getByRole('button', { name: /Discard/i }).first();
    await discardButton.click();

    // Verify confirmation dialog
    await expect(authenticatedPage.getByRole('heading', { name: /Discard Changes/i })).toBeVisible({
      timeout: 5000,
    });

    // Confirm
    await authenticatedPage.getByRole('button', { name: /Discard All/i }).click();

    // Wait for API call
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes('/drafts/discard'),
      { timeout: 10000 }
    );

    // Verify toast
    await expect(authenticatedPage.getByText(/Discarded/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify original title restored
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.getByText(originalTitle)).toBeVisible({ timeout: 10000 });
  });

  test('shows loading states during operations', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Make an edit
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    await input.fill('Loading State Test');
    await input.blur();

    // Wait for draft to save
    await waitForAutoSave(authenticatedPage);

    // Click publish and check for loading state
    const publishButton = authenticatedPage.getByRole('button', { name: /Publish All/i });
    await publishButton.click();

    // Should show "Publishing..." text
    await expect(authenticatedPage.getByText(/Publishing/i)).toBeVisible({ timeout: 2000 });

    // Wait for completion
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes('/drafts/publish'),
      { timeout: 15000 }
    );
  });

  test('handles escape key to cancel edit', async ({ authenticatedPage }) => {
    await goToVisualEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Get original title
    const titleField = authenticatedPage.locator('[aria-label="Package title"]').first();
    await titleField.click();
    const input = titleField.locator('input');
    const originalTitle = await input.inputValue();

    // Type something
    await input.fill('Should Be Cancelled');

    // Press Escape
    await input.press('Escape');

    // Verify original value is shown (edit cancelled, not saved)
    await expect(authenticatedPage.getByText(originalTitle)).toBeVisible({ timeout: 5000 });

    // Verify no draft indicator (edit was cancelled before blur)
    const unsavedText = authenticatedPage.getByText('Unsaved changes');
    await expect(unsavedText).not.toBeVisible({ timeout: 2000 });
  });
});
