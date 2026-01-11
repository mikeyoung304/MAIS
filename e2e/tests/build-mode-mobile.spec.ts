import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Build Mode Mobile UX (Phase 4)
 *
 * Tests the Vaul drawer implementation for mobile Build Mode:
 * - iOS keyboard handling (issue #574: scroll doesn't trigger focus)
 * - Drawer stability on keyboard dismiss (issue #216: no jumping)
 * - WCAG AA accessibility (focus trap, screen reader announcements)
 * - Touch target compliance (WCAG 2.5.8: 24px minimum)
 *
 * These tests validate Phase 4 of the Build Mode optimization.
 */

// iPhone SE viewport for mobile testing
test.use({ viewport: { width: 375, height: 667 } });

test.describe('Mobile Build Mode - Vaul Drawer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Build Mode (test tenant required)
    await page.goto('/t/test-tenant?mode=build');
    await page.waitForLoadState('networkidle');
  });

  test('FAB button visible and clickable', async ({ page }) => {
    // Verify FAB (Floating Action Button) is visible
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await expect(fab).toBeVisible();

    // Click FAB to open drawer
    await fab.click();

    // Drawer should be visible
    const drawer = page.locator('[role="dialog"][aria-label="AI Assistant Chat"]');
    await expect(drawer).toBeVisible();
  });

  test('drawer opens and closes with screen reader announcements', async ({ page }) => {
    // Check for screen reader announcer element
    const announcer = page.locator('[aria-live="polite"]');
    await expect(announcer).toBeAttached();

    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Check announcement text (should mention "opened")
    await expect(announcer).toContainText(/drawer opened/i);

    // Close drawer
    const closeButton = page.locator('[aria-label="Close drawer"]');
    await closeButton.click();

    // Wait for drawer to be hidden
    await expect(drawer).not.toBeVisible();

    // Check announcement text (should mention "closed")
    await expect(announcer).toContainText(/drawer closed/i);
  });

  test('drag handle meets WCAG 2.5.8 touch target minimum (24px)', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Find drag handle (first div with aria-hidden inside drawer)
    const handle = drawer.locator('[aria-hidden="true"]').first();
    await expect(handle).toBeVisible();

    // Verify height >= 24px (WCAG 2.5.8 Level AA)
    const box = await handle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(24);
  });

  test('focus trap works within drawer', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Press Tab multiple times to cycle through focusable elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that focused element is still inside drawer
    const focused = page.locator(':focus');
    const isInDrawer = await focused.evaluate((el) => {
      return el.closest('[role="dialog"]') !== null;
    });

    expect(isInDrawer).toBe(true);
  });

  test('scrolling messages does not accidentally focus input (iOS issue #574)', async ({
    page,
  }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Find messages container
    const messages = page.locator('[role="log"]');
    await expect(messages).toBeVisible();

    // Find input
    const input = page.locator('[data-testid="agent-input"]');
    await expect(input).toBeVisible();

    // Scroll messages container
    await messages.evaluate((el) => {
      el.scrollTop = 100;
    });

    // Wait for touch delay (iOS)
    await page.waitForTimeout(300);

    // Verify input is NOT focused
    const isFocused = await input.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(false);
  });

  test('drawer stays stable when keyboard dismissed (iOS issue #216)', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Find input
    const input = page.locator('[data-testid="agent-input"]');
    await expect(input).toBeVisible();

    // Focus input (simulates keyboard opening)
    await input.focus();
    await page.waitForTimeout(500); // Wait for keyboard animation

    // Get drawer position with keyboard open
    const positionWithKeyboard = await drawer.boundingBox();
    expect(positionWithKeyboard).not.toBeNull();

    // Dismiss keyboard by clicking outside input
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500); // Wait for keyboard animation

    // Get drawer position after keyboard dismissed
    const positionAfterDismiss = await drawer.boundingBox();
    expect(positionAfterDismiss).not.toBeNull();

    // Drawer should not jump significantly (allow 10px tolerance for animation)
    const yDiff = Math.abs(positionAfterDismiss!.y - positionWithKeyboard!.y);
    expect(yDiff).toBeLessThan(10);
  });

  test('escape key closes drawer', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Drawer should be hidden
    await expect(drawer).not.toBeVisible();
  });

  test('background content is inert when drawer open', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Check if main content has inert attribute
    const main = page.locator('#main-content');
    const isInert = await main.evaluate((el) => {
      return el.hasAttribute('inert');
    });

    expect(isInert).toBe(true);
  });

  test('drawer has correct ARIA attributes', async ({ page }) => {
    // Open drawer
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await fab.click();

    // Wait for drawer to be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Verify ARIA attributes
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect(drawer).toHaveAttribute('aria-label', 'AI Assistant Chat');
    await expect(drawer).toHaveAttribute('role', 'dialog');
  });
});

test.describe('Mobile Build Mode - Desktop Unchanged (Regression)', () => {
  // Desktop viewport to verify desktop implementation unchanged
  test.use({ viewport: { width: 1280, height: 720 } });

  test('desktop uses aside panel (not drawer)', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');
    await page.waitForLoadState('networkidle');

    // Should have aside panel, not drawer
    const aside = page.locator('[data-testid="agent-panel"]');
    await expect(aside).toBeVisible();

    // Should NOT have Vaul drawer trigger (FAB)
    const fab = page.locator('[aria-label="Open AI Assistant chat"]');
    await expect(fab).not.toBeVisible();

    // Should NOT have drawer portal
    const drawer = page.locator('[role="dialog"][aria-label="AI Assistant Chat"]');
    await expect(drawer).not.toBeVisible();
  });
});
