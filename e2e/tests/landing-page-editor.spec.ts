/**
 * E2E Test: Landing Page Editor
 *
 * Tests the landing page visual editor functionality for tenant admins:
 * 1. Load landing page editor
 * 2. Enable/disable sections via sidebar
 * 3. Auto-save draft functionality
 * 4. Publish changes
 * 5. Discard changes with confirmation
 *
 * Each test uses a fresh authenticated tenant via the auth fixture.
 * Tests run in parallel for faster CI execution.
 */
import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Helper: Navigate to landing page editor and wait for load
 */
async function goToLandingPageEditor(page: Page): Promise<void> {
  await page.goto('/tenant/landing-page');
  await expect(page.getByRole('heading', { name: /Landing Page Editor/i })).toBeVisible({
    timeout: 15000,
  });
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Wait for auto-save to complete after making edits
 */
async function waitForAutoSave(page: Page): Promise<void> {
  // Wait for the draft save API response
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/landing-page/draft') && response.request().method() === 'PUT',
      { timeout: 10000 }
    )
    .catch(() => {
      // Draft might already be saved or debounce not triggered yet
    });
}

/**
 * Helper: Discard any existing drafts to start clean
 */
async function discardDraftsIfAny(page: Page): Promise<void> {
  // Check the sidebar for "Published" status - if visible, no draft to discard
  const publishedIndicator = page.getByText(/^Published$/i);
  const isPublished = await publishedIndicator.isVisible().catch(() => false);

  if (isPublished) {
    return;
  }

  // Check if toolbar is actually in viewport (not translated off-screen)
  const hasVisibleToolbar = await page.evaluate(() => {
    const toolbar = document.querySelector('[class*="fixed"][class*="bottom"]');
    if (!toolbar) return false;
    const rect = toolbar.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });

  if (!hasVisibleToolbar) {
    return;
  }

  // Click discard
  const discardButton = page.getByRole('button', { name: /Discard/i }).first();
  await discardButton.click();

  // Wait for confirmation dialog and confirm
  const confirmButton = page.getByRole('button', { name: /Discard All/i });
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();

  // Wait for API response
  await page
    .waitForResponse((response) => response.url().includes('/landing-page/draft'), {
      timeout: 10000,
    })
    .catch(() => {});

  await page.waitForTimeout(500);
}

/**
 * @deprecated Visual Editor is deprecated as of 2026-02-01.
 * All storefront editing now happens through the AI agent chatbot (Build Mode).
 * See docs/architecture/BUILD_MODE_VISION.md and CLAUDE.md "Landing Page Config Terminology"
 *
 * These tests are skipped because:
 * 1. The Visual Editor frontend routes have been removed
 * 2. The backend PUT /landing-page and PUT /draft routes have been deleted
 * 3. All edits go through the agent's storefront-write tool now
 *
 * TODO: Delete this file after confirming Build Mode E2E tests cover storefront editing
 */
test.describe.skip('Landing Page Editor (DEPRECATED)', () => {
  test('loads landing page editor with sidebar and preview', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);

    // Verify page loaded with expected elements
    await expect(
      authenticatedPage.getByText(/Customize your storefront landing page/i)
    ).toBeVisible();

    // Sidebar should exist with section options
    await expect(authenticatedPage.getByText(/Active Sections/i)).toBeVisible({ timeout: 5000 });
    await expect(authenticatedPage.getByText(/Available Sections/i)).toBeVisible({ timeout: 5000 });

    // Back to dashboard link should exist
    await expect(authenticatedPage.locator('a[href="/tenant/dashboard"]')).toBeVisible();
  });

  test('enables and disables sections via sidebar', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Find the Hero section "Add" button in Available Sections
    const addHeroButton = authenticatedPage.getByRole('button', { name: /Add Hero/i });
    await expect(addHeroButton).toBeVisible({ timeout: 5000 });

    // Click to add the section
    await addHeroButton.click();

    // Wait for auto-save
    await waitForAutoSave(authenticatedPage);

    // After adding, "Remove Hero" button should be visible
    const removeHeroButton = authenticatedPage.getByRole('button', { name: /Remove Hero/i });
    await expect(removeHeroButton).toBeVisible({ timeout: 5000 });

    // Clean up
    await discardDraftsIfAny(authenticatedPage);
  });

  test('auto-saves draft and shows unsaved indicator', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Add a section to create a change
    const addHeroButton = authenticatedPage.getByRole('button', { name: /Add Hero/i });
    await addHeroButton.click();

    // Wait for auto-save API response
    await waitForAutoSave(authenticatedPage);

    // Should show "Unsaved changes" indicator in sidebar (use first() to avoid strict mode violation)
    await expect(authenticatedPage.getByText(/Unsaved changes/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Clean up
    await discardDraftsIfAny(authenticatedPage);
  });

  test('publishes changes successfully', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Make a change by adding a section
    const addHeroButton = authenticatedPage.getByRole('button', { name: /Add Hero/i });
    await addHeroButton.click();

    // Wait for auto-save
    await waitForAutoSave(authenticatedPage);

    // Publish button should be enabled
    const publishButton = authenticatedPage.getByRole('button', { name: /Publish/i });
    await expect(publishButton).toBeEnabled({ timeout: 5000 });

    // Click publish
    await publishButton.click();

    // Wait for publish API response
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes('/landing-page/publish'),
      { timeout: 15000 }
    );

    // Verify success - should show "Published" status
    await expect(authenticatedPage.getByText(/^Published$/i)).toBeVisible({ timeout: 5000 });
  });

  test('discards changes with confirmation dialog', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Make a change
    const addHeroButton = authenticatedPage.getByRole('button', { name: /Add Hero/i });
    await addHeroButton.click();

    // Wait for auto-save
    await waitForAutoSave(authenticatedPage);

    // Click Discard
    const discardButton = authenticatedPage.getByRole('button', { name: /Discard/i });
    await expect(discardButton).toBeEnabled({ timeout: 5000 });
    await discardButton.click();

    // Verify confirmation dialog appears
    await expect(authenticatedPage.getByRole('heading', { name: /Discard Changes/i })).toBeVisible({
      timeout: 5000,
    });

    // Confirm discard
    await authenticatedPage.getByRole('button', { name: /Discard All/i }).click();

    // Wait for API call
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes('/landing-page/draft'),
      { timeout: 10000 }
    );

    // Verify "Published" status returned
    await expect(authenticatedPage.getByText(/^Published$/i)).toBeVisible({ timeout: 5000 });
  });

  test('shows empty state when no sections enabled', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // When no sections are active, show empty state
    // This is the default state for a new tenant
    await expect(
      authenticatedPage.getByText(/No sections enabled|Add sections from the sidebar/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigates back to dashboard via back button', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);

    // Click the back button (arrow left icon)
    const backButton = authenticatedPage.locator('a[href="/tenant/dashboard"]');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should navigate to dashboard
    await expect(authenticatedPage).toHaveURL(/\/tenant\/dashboard/);
  });

  test('refresh button reloads configuration', async ({ authenticatedPage }) => {
    await goToLandingPageEditor(authenticatedPage);

    // Find the refresh button
    const refreshButton = authenticatedPage.getByTitle('Refresh');
    await expect(refreshButton).toBeVisible();

    // Click refresh and wait for API response
    const responsePromise = authenticatedPage.waitForResponse(
      (response) => response.url().includes('/landing-page/draft'),
      { timeout: 10000 }
    );

    await refreshButton.click();
    await responsePromise;

    // Page should still be on landing page editor
    await expect(
      authenticatedPage.getByRole('heading', { name: /Landing Page Editor/i })
    ).toBeVisible();
  });

  test('handles rapid section toggles without race conditions (TODO-247)', async ({
    authenticatedPage,
  }) => {
    await goToLandingPageEditor(authenticatedPage);
    await discardDraftsIfAny(authenticatedPage);

    // Collect all API responses to verify batching and no errors
    const saveResponses: { status: number; timestamp: number }[] = [];

    authenticatedPage.on('response', (response) => {
      if (response.url().includes('/landing-page/draft') && response.request().method() === 'PUT') {
        saveResponses.push({ status: response.status(), timestamp: Date.now() });
      }
    });

    // Rapidly toggle sections 10 times (faster than debounce window)
    const sections = ['Hero', 'About', 'FAQ', 'Gallery', 'Testimonials'];

    for (let i = 0; i < 10; i++) {
      const sectionName = sections[i % sections.length];

      // Try to find Add or Remove button for this section
      const addButton = authenticatedPage.getByRole('button', {
        name: new RegExp(`Add ${sectionName}`, 'i'),
      });
      const removeButton = authenticatedPage.getByRole('button', {
        name: new RegExp(`Remove ${sectionName}`, 'i'),
      });

      const addVisible = await addButton.isVisible().catch(() => false);

      if (addVisible) {
        await addButton.click();
      } else {
        const removeVisible = await removeButton.isVisible().catch(() => false);
        if (removeVisible) {
          await removeButton.click();
        }
      }

      // Small delay to simulate rapid user input (50ms between clicks)
      await authenticatedPage.waitForTimeout(50);
    }

    // Wait for debounce to flush (1 second debounce + buffer)
    await authenticatedPage.waitForTimeout(2000);

    // Wait for any pending saves to complete
    await waitForAutoSave(authenticatedPage);

    // Verify: Should have batched saves (fewer than 10 API calls due to debouncing)
    // Debounce window is 1 second, so rapid clicks should be batched
    expect(saveResponses.length).toBeLessThan(10);

    // Verify: All saves should succeed (no 429 rate limit, no 500 errors)
    for (const response of saveResponses) {
      expect(response.status).toBe(200);
    }

    // Verify: Page is still functional - can still see editor
    await expect(
      authenticatedPage.getByRole('heading', { name: /Landing Page Editor/i })
    ).toBeVisible();

    // Verify: No error toasts visible
    const errorToast = authenticatedPage.getByText(/failed|error/i);
    await expect(errorToast).not.toBeVisible();

    // Clean up
    await discardDraftsIfAny(authenticatedPage);
  });
});
