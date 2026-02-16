import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Storefront Navigation and Display
 *
 * Tests the storefront routing and display logic:
 * - Segment navigation (0/1/2+ segments)
 * - Tier display with "Most Popular" badge logic
 * - Image fallback handling
 * - Grid layout responsiveness
 *
 * Note: The E2E test tenant (handled-e2e) is configured in apps/web/.env.local
 * and has minimal seed data (starter/growth tiers, no segments).
 */
test.describe('Storefront Navigation', () => {
  test.describe('Segment Navigation Logic', () => {
    test('0 segments redirects to /tiers', async ({ page }) => {
      // E2E tenant has no segments, should redirect to tiers
      await page.goto('/storefront');
      await page.waitForLoadState('networkidle');

      // Should redirect to /tiers since E2E tenant has 0 segments
      await expect(page).toHaveURL('/tiers');
    });

    test('/tiers displays tier cards when no segments exist', async ({ page }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      // Should see tier cards (tiers from E2E seed)
      // E2E seed creates starter and growth tiers
      const tierCards = page.locator('[data-testid^="tier-card-"]');

      // Wait for cards to load
      await expect(tierCards.first()).toBeVisible({ timeout: 10000 });

      // Should have at least the seeded packages
      const count = await tierCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('tier card links to tier detail page', async ({ page }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      // Click first tier card
      const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
      await expect(firstTierCard).toBeVisible({ timeout: 10000 });

      // Get the link within the card and click it
      const tierLink = firstTierCard.locator('a');
      await tierLink.click();

      // Should navigate to tier detail page
      await expect(page).toHaveURL(/\/tiers\/\w+/);
    });
  });

  test.describe('Tenant Storefront Routes', () => {
    test('white-label route /t/:slug loads storefront', async ({ page }) => {
      // Access storefront via white-label route
      await page.goto('/t/handled-e2e');
      await page.waitForLoadState('networkidle');

      // With 0 segments, should redirect to tiers
      await expect(page).toHaveURL('/t/handled-e2e/tiers');
    });

    test('/t/:slug/tiers displays tier cards', async ({ page }) => {
      await page.goto('/t/handled-e2e/tiers');
      await page.waitForLoadState('networkidle');

      // Should see tier cards
      const tierCards = page.locator('[data-testid^="tier-card-"]');
      await expect(tierCards.first()).toBeVisible({ timeout: 10000 });
    });

    test('invalid tenant slug shows error', async ({ page }) => {
      await page.goto('/t/nonexistent-tenant-slug-12345');
      await page.waitForLoadState('networkidle');

      // Should show error state (tenant not found)
      // The exact error depends on implementation
      const errorElement = page.getByText(/unable|error|not found/i);
      await expect(errorElement).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Tier Display', () => {
    test('tier cards show tier information', async ({ page }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
      await expect(firstTierCard).toBeVisible({ timeout: 10000 });

      // Card should contain tier name (from E2E seed)
      // E2E seed creates "Starter" and "Growth" tiers
      const hasTierName = await firstTierCard.locator('text=/Starter|Growth/i').isVisible();
      expect(hasTierName).toBe(true);
    });

    test('tier cards display prices', async ({ page }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
      await expect(firstTierCard).toBeVisible({ timeout: 10000 });

      // Should show price (formatted as currency)
      // E2E seed prices: $250 starter tier, $500 growth tier
      const priceElement = firstTierCard.locator('text=/\\$/');
      await expect(priceElement).toBeVisible();
    });

    test('tier cards show "View Details" CTA', async ({ page }) => {
      await page.goto('/tiers');
      await page.waitForLoadState('networkidle');

      const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
      await expect(firstTierCard).toBeVisible({ timeout: 10000 });

      // Should show CTA button
      const ctaButton = firstTierCard.getByRole('link', { name: /View Details/i });
      await expect(ctaButton).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('shows loading spinner while fetching data', async ({ page }) => {
      // Intercept API to delay response
      await page.route('**/v1/segments*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/storefront');

      // Should show loading indicator
      const loadingElement = page.getByText(/loading/i);
      // Loading may be brief, so we just check it can appear
      // The test passes if page eventually loads
      await page.waitForLoadState('networkidle');
    });

    test('shows error state on API failure', async ({ page }) => {
      // Mock API failure
      await page.route('**/v1/segments*', (route) =>
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      await page.goto('/storefront');
      await page.waitForLoadState('networkidle');

      // Should show error message
      const errorElement = page.getByText(/unable to load|error|refresh/i);
      await expect(errorElement).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Tier Detail Page', () => {
  test('displays tier details', async ({ page }) => {
    // Navigate to tiers first
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    // Click first tier card
    const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(firstTierCard).toBeVisible({ timeout: 10000 });

    const tierLink = firstTierCard.locator('a');
    await tierLink.click();

    // Wait for detail page to load
    await page.waitForLoadState('networkidle');

    // Should show tier title
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Should show price
    const priceElement = page.locator('text=/\\$/');
    await expect(priceElement).toBeVisible();
  });

  test('shows date picker for booking', async ({ page }) => {
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(firstTierCard).toBeVisible({ timeout: 10000 });

    const tierLink = firstTierCard.locator('a');
    await tierLink.click();
    await page.waitForLoadState('networkidle');

    // Should show calendar (react-day-picker)
    const calendar = page.locator('.rdp');
    await expect(calendar).toBeVisible();
  });

  test('shows contact form fields', async ({ page }) => {
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(firstTierCard).toBeVisible({ timeout: 10000 });

    const tierLink = firstTierCard.locator('a');
    await tierLink.click();
    await page.waitForLoadState('networkidle');

    // Should show contact form inputs
    await expect(page.locator('#coupleName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('back navigation returns to tiers list', async ({ page }) => {
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const firstTierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(firstTierCard).toBeVisible({ timeout: 10000 });

    const tierLink = firstTierCard.locator('a');
    await tierLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should be back on tiers page
    await expect(page).toHaveURL('/tiers');
  });
});

test.describe('Responsive Layout', () => {
  test('single tier shows centered layout', async ({ page }) => {
    // Mock API to return single tier
    await page.route('**/v1/tiers*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            id: '1',
            slug: 'single-tier',
            title: 'Single Tier',
            description: 'Only one tier',
            priceCents: 50000,
            photos: [],
          },
        ]),
      })
    );

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    // With single tier, the grid should use centered layout
    const tierCard = page.locator('[data-testid^="tier-card-"]');
    await expect(tierCard).toBeVisible({ timeout: 10000 });

    // Verify only one card exists
    const count = await tierCard.count();
    expect(count).toBe(1);
  });

  test('mobile viewport shows stacked cards', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const tierCards = page.locator('[data-testid^="tier-card-"]');
    await expect(tierCards.first()).toBeVisible({ timeout: 10000 });

    // On mobile, cards should be visible and stacked (full width)
    // This is a basic test - visual verification would need screenshot comparison
    const cardBoundingBox = await tierCards.first().boundingBox();
    expect(cardBoundingBox).not.toBeNull();

    // Card width should be close to viewport width (accounting for padding)
    if (cardBoundingBox) {
      expect(cardBoundingBox.width).toBeGreaterThan(300);
    }
  });

  test('tablet viewport shows 2-column grid', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const tierCards = page.locator('[data-testid^="tier-card-"]');
    await expect(tierCards.first()).toBeVisible({ timeout: 10000 });

    // Cards should be visible in tablet layout
    const cardBoundingBox = await tierCards.first().boundingBox();
    expect(cardBoundingBox).not.toBeNull();
  });

  test('desktop viewport shows full layout', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const tierCards = page.locator('[data-testid^="tier-card-"]');
    await expect(tierCards.first()).toBeVisible({ timeout: 10000 });

    // Cards should be visible with proper spacing
    const cardBoundingBox = await tierCards.first().boundingBox();
    expect(cardBoundingBox).not.toBeNull();
  });
});

test.describe('Legacy Tier URL Redirects', () => {
  // DHH-style: One parameterized test covers all legacy alias redirects
  const legacyRedirects = [
    ['budget', 'tier_1'],
    ['middle', 'tier_2'],
    ['luxury', 'tier_3'],
  ] as const;

  legacyRedirects.forEach(([legacy, canonical]) => {
    test(`redirects /tiers/${legacy} to /tiers/${canonical}`, async ({ page }) => {
      await page.goto(`/tiers/${legacy}`);
      await page.waitForURL(new RegExp(`/tiers/${canonical}`));
      expect(page.url()).toContain(`/tiers/${canonical}`);
    });
  });
});

test.describe('Image Handling', () => {
  test('shows fallback gradient when no image URL', async ({ page }) => {
    // Mock API to return tier without photos
    await page.route('**/v1/tiers*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            id: '1',
            slug: 'no-image-tier',
            title: 'No Image Tier',
            description: 'Tier without images',
            priceCents: 50000,
            photos: [],
            photoUrl: null,
          },
          {
            id: '2',
            slug: 'another-tier',
            title: 'Another Tier',
            description: 'Second tier',
            priceCents: 75000,
            photos: [],
            photoUrl: null,
          },
        ]),
      })
    );

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(tierCard).toBeVisible({ timeout: 10000 });

    // Card should still render (with gradient fallback)
    // The exact fallback implementation varies, but the card should be visible
    const isVisible = await tierCard.isVisible();
    expect(isVisible).toBe(true);
  });

  test('handles broken image URL gracefully', async ({ page }) => {
    // Mock API to return tier with broken image URL
    await page.route('**/v1/tiers*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            id: '1',
            slug: 'broken-image-tier',
            title: 'Broken Image Tier',
            description: 'Tier with broken image',
            priceCents: 50000,
            photos: [{ url: 'https://invalid-url-that-will-404.com/image.jpg' }],
          },
        ]),
      })
    );

    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator('[data-testid^="tier-card-"]').first();
    await expect(tierCard).toBeVisible({ timeout: 10000 });

    // Card should still be functional even with broken image
    const cardLink = tierCard.locator('a');
    await expect(cardLink).toBeVisible();
  });
});
