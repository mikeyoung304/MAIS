import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Tests: Accessibility (WCAG 2.1 AA)
 *
 * Automated accessibility testing using axe-core.
 * Tests critical pages for WCAG 2.1 Level AA compliance.
 *
 * Pages tested:
 * - Homepage/Landing
 * - Storefront/Tiers
 * - Booking flow
 * - Admin login
 * - Signup
 */
test.describe('Accessibility - WCAG 2.1 AA', () => {
  test.describe('Public Pages', () => {
    test('Homepage should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .exclude('.third-party-widget') // Exclude third-party widgets we can't control
        .analyze();

      // Filter to only critical and serious violations
      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      // Log violations for debugging
      if (criticalViolations.length > 0) {
        console.error(
          'Accessibility violations found:',
          JSON.stringify(criticalViolations, null, 2)
        );
      }

      expect(criticalViolations).toHaveLength(0);
    });

    test('Storefront/Tiers page should have no critical accessibility violations', async ({
      page,
    }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      // Wait for tier cards to load
      await page
        .locator('[data-testid^="tier-card-"]')
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {
          // If no tier cards, page still needs to be accessible
        });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (criticalViolations.length > 0) {
        console.error(
          'Tiers page accessibility violations:',
          JSON.stringify(criticalViolations, null, 2)
        );
      }

      expect(criticalViolations).toHaveLength(0);
    });
  });

  test.describe('Auth Pages', () => {
    test('Login page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (criticalViolations.length > 0) {
        console.error(
          'Login page accessibility violations:',
          JSON.stringify(criticalViolations, null, 2)
        );
      }

      expect(criticalViolations).toHaveLength(0);
    });

    test('Signup page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (criticalViolations.length > 0) {
        console.error(
          'Signup page accessibility violations:',
          JSON.stringify(criticalViolations, null, 2)
        );
      }

      expect(criticalViolations).toHaveLength(0);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('Can navigate homepage with keyboard only', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Tab through the page
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Check that something is focused
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });

      // Should have focused on an interactive element
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement);
    });

    test('Focus is visible on interactive elements', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Tab to first input
      await page.keyboard.press('Tab');

      // Get the focused element
      const focusVisible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;

        const styles = window.getComputedStyle(el);
        // Check for outline or box-shadow (common focus indicators)
        return (
          styles.outline !== 'none' || styles.outlineWidth !== '0px' || styles.boxShadow !== 'none'
        );
      });

      expect(focusVisible).toBe(true);
    });
  });

  test.describe('Color Contrast', () => {
    test('Text has sufficient color contrast', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      if (contrastViolations.length > 0) {
        console.error('Color contrast violations:', JSON.stringify(contrastViolations, null, 2));
      }

      // Allow some minor contrast issues but flag critical ones
      const criticalContrast = contrastViolations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalContrast).toHaveLength(0);
    });
  });
});
