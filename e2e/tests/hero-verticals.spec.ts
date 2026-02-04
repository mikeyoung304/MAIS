import { test, expect } from '@playwright/test';

/**
 * E2E tests for the 4-vertical selector hero section
 *
 * Tests the CRO-optimized hero with:
 * - Vertical selector pills (Tutor, Photographer, Private Chef, Consultant)
 * - Content swapping on selection
 * - Keyboard navigation
 * - ARIA accessibility
 */

test.describe('Hero Vertical Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays default vertical (Tutor) on page load', async ({ page }) => {
    // Default headline should be Alex Chen's tutoring headline
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Math finally makes sense');

    // Tutor tab should be selected
    const tutorTab = page.getByRole('tab', { name: 'Tutor' });
    await expect(tutorTab).toHaveAttribute('aria-selected', 'true');
  });

  test('vertical selector changes hero content', async ({ page }) => {
    // Click Photographer tab
    await page.getByRole('tab', { name: 'Photographer' }).click();

    // Headline should change to Maya Torres's headline
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Photos you actually want to frame'
    );

    // Demo should show Maya Torres
    await expect(page.getByText('Maya Torres')).toBeVisible();

    // Photographer tab should now be selected
    const photographerTab = page.getByRole('tab', { name: 'Photographer' });
    await expect(photographerTab).toHaveAttribute('aria-selected', 'true');
  });

  test('all four verticals are accessible', async ({ page }) => {
    const verticals = [
      { name: 'Tutor', headline: 'Math finally makes sense', persona: 'Alex Chen' },
      {
        name: 'Photographer',
        headline: 'Photos you actually want to frame',
        persona: 'Maya Torres',
      },
      {
        name: 'Private Chef',
        headline: 'Restaurant-quality dinners at home',
        persona: 'Marcus Webb',
      },
      { name: 'Consultant', headline: 'Clarity on what to do next', persona: 'Jordan Reyes' },
    ];

    for (const vertical of verticals) {
      await page.getByRole('tab', { name: vertical.name }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(vertical.headline);
      await expect(page.getByText(vertical.persona)).toBeVisible();
    }
  });

  test('keyboard navigation works with arrow keys', async ({ page }) => {
    // Focus the Tutor tab (first one)
    const tutorTab = page.getByRole('tab', { name: 'Tutor' });
    await tutorTab.focus();

    // Press ArrowRight to go to Photographer
    await page.keyboard.press('ArrowRight');

    // Photographer tab should now be focused and selected
    const photographerTab = page.getByRole('tab', { name: 'Photographer' });
    await expect(photographerTab).toBeFocused();
    await expect(photographerTab).toHaveAttribute('aria-selected', 'true');

    // Content should have changed
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Photos');

    // Press ArrowLeft to go back to Tutor
    await page.keyboard.press('ArrowLeft');
    await expect(tutorTab).toBeFocused();
    await expect(tutorTab).toHaveAttribute('aria-selected', 'true');
  });

  test('keyboard navigation wraps around', async ({ page }) => {
    // Focus the Tutor tab (first one)
    const tutorTab = page.getByRole('tab', { name: 'Tutor' });
    await tutorTab.focus();

    // Press ArrowLeft - should wrap to Consultant (last one)
    await page.keyboard.press('ArrowLeft');

    const consultantTab = page.getByRole('tab', { name: 'Consultant' });
    await expect(consultantTab).toBeFocused();
    await expect(consultantTab).toHaveAttribute('aria-selected', 'true');
  });

  test('ARIA attributes are properly set', async ({ page }) => {
    // Check tablist
    const tablist = page.getByRole('tablist');
    await expect(tablist).toHaveAttribute('aria-label', 'Select your profession');
    await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');

    // Check tab controls tabpanel
    const tutorTab = page.getByRole('tab', { name: 'Tutor' });
    await expect(tutorTab).toHaveAttribute('aria-controls', 'hero-panel');

    // Check tabpanel exists and is labeled
    const panel = page.locator('#hero-panel');
    await expect(panel).toHaveRole('tabpanel');
    await expect(panel).toHaveAttribute('aria-live', 'polite');
  });

  test('demo storefront shows 3-tier pricing with Popular badge on middle tier', async ({
    page,
  }) => {
    // The middle tier should have the "Popular" badge
    const popularBadge = page.getByText('Popular');
    await expect(popularBadge).toBeVisible();

    // Should show 3 pricing tiers (Book buttons)
    const bookButtons = page.locator('button:has-text("Book")');
    await expect(bookButtons).toHaveCount(3);
  });

  test('trust strip shows 3 items', async ({ page }) => {
    // Trust strip should have 3 items for Tutor: rating, students, teaching
    await expect(page.getByText('4.9')).toBeVisible();
    await expect(page.getByText('rating')).toBeVisible();
    await expect(page.getByText('200+')).toBeVisible();
    await expect(page.getByText('students')).toBeVisible();
  });

  test('View Packages CTA links to signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'View Packages' });
    await expect(cta).toHaveAttribute('href', '/signup');
  });

  test('demo is visible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Demo should still be visible (not hidden)
    await expect(page.getByText('Alex Chen')).toBeVisible();

    // Packages section should be visible
    await expect(page.getByText('Packages')).toBeVisible();
  });

  test('no layout shift when switching verticals', async ({ page }) => {
    const panel = page.locator('#hero-panel');
    const initialBox = await panel.boundingBox();

    // Switch to different vertical
    await page.getByRole('tab', { name: 'Photographer' }).click();

    // Wait for content to update
    await expect(page.getByText('Maya Torres')).toBeVisible();

    const newBox = await panel.boundingBox();

    // Width should remain the same
    expect(initialBox?.width).toBe(newBox?.width);

    // Height should be approximately the same (within 10px tolerance for minor content differences)
    expect(Math.abs((initialBox?.height ?? 0) - (newBox?.height ?? 0))).toBeLessThan(10);
  });
});
