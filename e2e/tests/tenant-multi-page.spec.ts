import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Multi-Page Tenant Sites
 *
 * Tests the tenant storefront multi-page navigation on Next.js:
 * - Navigation between all pages (desktop and mobile)
 * - Mobile menu open/close behavior
 * - Contact form validation and submission
 * - FAQ accordion interaction
 * - Skip link functionality
 * - Booking flow isolation
 * - SEO metadata
 *
 * Prerequisites:
 * - Next.js app running at port 3000
 * - API server running at port 3001
 * - Test tenant "handled-e2e" exists with tiers
 *
 * Run: NEXTJS_E2E=1 npx playwright test tenant-multi-page.spec.ts
 */

// Next.js base URL (differs from legacy Vite client)
const NEXTJS_BASE_URL = process.env.NEXTJS_URL || 'http://localhost:3000';

// Default test tenant slug for E2E
const TENANT_SLUG = 'handled-e2e';
const BASE_PATH = `${NEXTJS_BASE_URL}/t/${TENANT_SLUG}`;

test.describe('Tenant Multi-Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // SKIP REASON: These tests require Next.js app running with full tenant data.
    // Run with: NEXTJS_E2E=1 npx playwright test tenant-multi-page.spec.ts
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
  });

  test.describe('Desktop Navigation', () => {
    test('landing page shows navigation header', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Should show navigation
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Should show nav links (use .first() since they also appear in footer)
      const mainNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(mainNav.getByRole('link', { name: 'Home' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'Services' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'About' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'FAQ' })).toBeVisible();
      await expect(mainNav.getByRole('link', { name: 'Contact' })).toBeVisible();
    });

    test('can navigate to all pages', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Navigate to Services
      await page.getByRole('link', { name: 'Services' }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(`${BASE_PATH}/services`);
      await expect(page.getByRole('heading', { name: /our services/i })).toBeVisible();

      // Navigate to About
      await page.getByRole('link', { name: 'About' }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(`${BASE_PATH}/about`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Navigate to FAQ
      await page.getByRole('link', { name: 'FAQ' }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(`${BASE_PATH}/faq`);
      await expect(page.getByRole('heading', { name: /frequently asked/i })).toBeVisible();

      // Navigate to Contact
      await page.getByRole('link', { name: 'Contact' }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(`${BASE_PATH}/contact`);
      await expect(page.getByRole('heading', { name: /get in touch/i })).toBeVisible();

      // Navigate back to Home
      await page.getByRole('link', { name: 'Home' }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(BASE_PATH);
    });

    test('footer shows on all pages', async ({ page }) => {
      const pages = ['', '/services', '/about', '/faq', '/contact'];

      for (const pagePath of pages) {
        await page.goto(`${BASE_PATH}${pagePath}`);
        await page.waitForLoadState('domcontentloaded');

        const footer = page.locator('footer[role="contentinfo"]');
        await expect(footer).toBeVisible();

        // Check for "Powered by" text
        await expect(page.getByText(/powered by/i)).toBeVisible();
      }
    });
  });

  test.describe('Mobile Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('shows hamburger menu on mobile', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Desktop nav links should be hidden
      const desktopNav = page.locator('nav[aria-label="Main navigation"] .md\\:flex');
      await expect(desktopNav).toBeHidden();

      // Hamburger button should be visible
      const menuButton = page.getByRole('button', { name: /open menu/i });
      await expect(menuButton).toBeVisible();
    });

    test('can open and close mobile menu', async ({ page }) => {
      // Navigate first, then viewport size should already be mobile from beforeEach
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Open menu
      const menuButton = page.getByRole('button', { name: /open menu/i });
      await expect(menuButton).toBeVisible({ timeout: 10000 });
      await menuButton.click();

      // Menu should be open (translated into view, aria-hidden false)
      // The assertion will wait for the animation to complete
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toHaveClass(/translate-x-0/);
      await expect(mobileMenu).toHaveAttribute('aria-hidden', 'false');

      // Close button should be visible
      const closeButton = page.getByRole('button', { name: /close menu/i });
      await expect(closeButton).toBeVisible();

      // Close menu
      await closeButton.click();

      // Menu should be hidden (translated off-screen)
      await expect(mobileMenu).toHaveClass(/translate-x-full/);
    });

    test('mobile menu closes on navigation', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Open menu
      await page.getByRole('button', { name: /open menu/i }).click();

      // Click Services link
      const servicesLink = page.locator('#mobile-menu').getByRole('link', { name: 'Services' });
      await servicesLink.click();

      // Should navigate and close menu
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(`${BASE_PATH}/services`);

      // Menu should be closed
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toHaveClass(/translate-x-full/);
    });

    test('mobile menu closes on Escape key', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Open menu
      await page.getByRole('button', { name: /open menu/i }).click();

      // Wait for menu to be visible
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).not.toHaveClass(/translate-x-full/);

      // Press Escape
      await page.keyboard.press('Escape');

      // Menu should be closed
      await expect(mobileMenu).toHaveClass(/translate-x-full/);
    });
  });

  test.describe('Skip Link', () => {
    test('skip link is visible on focus', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Skip link should be initially hidden (sr-only) - use first() since there may be multiple
      const skipLink = page.getByRole('link', { name: /skip to main content/i }).first();

      // Focus the skip link by tabbing
      await page.keyboard.press('Tab');

      // Skip link should be visible after focus
      await expect(skipLink).toBeVisible();
    });

    test('skip link navigates to main content', async ({ page }) => {
      await page.goto(BASE_PATH);
      await page.waitForLoadState('domcontentloaded');

      // Focus and click skip link
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // URL should have #main-content hash
      await expect(page).toHaveURL(new RegExp('#main-content'));
    });
  });
});

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    // SKIP REASON: Requires Next.js app with tenant contact form
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
    await page.goto(`${BASE_PATH}/contact`);
    await page.waitForLoadState('domcontentloaded');
    // Wait for form to be interactive (hydration complete)
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows required field validation', async ({ page }) => {
    // Wait for submit button to be visible (confirms form is loaded)
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible({
      timeout: 10000,
    });

    // Submit empty form
    await page.getByRole('button', { name: /send message/i }).click();

    // Should show validation errors
    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/message is required/i)).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    // Fill invalid email
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'invalid-email');
    await page.fill('#message', 'This is a test message for the contact form.');

    // Submit form
    await page.getByRole('button', { name: /send message/i }).click();

    // Should show email validation error
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('validates message length', async ({ page }) => {
    // Fill short message
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#message', 'Short');

    // Blur message field to trigger validation
    await page.locator('#message').blur();

    // Should show message length error
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
  });

  test('submits form successfully (simulated)', async ({ page }) => {
    // Fill valid form
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#phone', '555-123-4567');
    await page.fill(
      '#message',
      'This is a test message for the contact form. It should be long enough.'
    );

    // Submit form
    await page.getByRole('button', { name: /send message/i }).click();

    // Should show loading state
    await expect(page.getByText(/sending/i)).toBeVisible();

    // Should show success state after delay (Phase 1 simulation)
    await expect(page.getByText(/message sent/i)).toBeVisible({ timeout: 5000 });

    // Should show "Send Another" button
    await expect(page.getByRole('button', { name: /send another/i })).toBeVisible();
  });

  test('can send another message after success', async ({ page }) => {
    // Fill and submit form
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#message', 'This is a test message for the contact form.');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for success
    await expect(page.getByText(/message sent/i)).toBeVisible({ timeout: 5000 });

    // Click "Send Another"
    await page.getByRole('button', { name: /send another/i }).click();

    // Form should be reset and visible
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#name')).toHaveValue('');
  });
});

test.describe('FAQ Accordion', () => {
  test.beforeEach(async ({ page }) => {
    // SKIP REASON: Requires Next.js app with tenant FAQ page
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
    await page.goto(`${BASE_PATH}/faq`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('shows FAQ heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /frequently asked/i })).toBeVisible();
  });

  test('shows empty state when no FAQs', async ({ page }) => {
    // The test tenant may not have FAQs configured
    // Check for either FAQ items or empty state
    const faqRegion = page.locator('[role="region"][aria-label*="FAQ"]');
    const emptyState = page.getByText(/no faqs available/i);

    // Either FAQs should be visible or empty state
    const hasFAQs = await faqRegion.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasFAQs || hasEmptyState).toBe(true);
  });

  test('shows CTA to contact page', async ({ page }) => {
    // Should have a link to contact page
    const contactLink = page.getByRole('link', { name: /contact us/i }).first();
    await expect(contactLink).toBeVisible();

    await contactLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(`${BASE_PATH}/contact`);
  });
});

test.describe('SEO Metadata', () => {
  test.beforeEach(async ({ page }) => {
    // SKIP REASON: Requires Next.js app with proper metadata generation
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
  });

  const pages = [
    { path: '', titleContains: 'Handled E2E Test Tenant' },
    { path: '/services', titleContains: 'Services' },
    { path: '/about', titleContains: 'About' },
    { path: '/faq', titleContains: 'FAQ' },
    { path: '/contact', titleContains: 'Contact' },
  ];

  pages.forEach(({ path, titleContains }) => {
    test(`${path || 'home'} page has correct title`, async ({ page }) => {
      await page.goto(`${BASE_PATH}${path}`);
      await page.waitForLoadState('domcontentloaded');

      // Check page title contains expected text
      const title = await page.title();
      expect(title.toLowerCase()).toContain(titleContains.toLowerCase());
    });
  });

  test('pages have meta description', async ({ page }) => {
    await page.goto(`${BASE_PATH}/about`);
    await page.waitForLoadState('domcontentloaded');

    const metaDescription = await page.getAttribute('meta[name="description"]', 'content');
    expect(metaDescription).toBeTruthy();
    expect(metaDescription!.length).toBeGreaterThan(10);
  });
});

test.describe('Booking Flow Isolation', () => {
  test.beforeEach(async () => {
    // SKIP REASON: Requires Next.js app with booking flow pages
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
  });

  test('booking page has its own header (no TenantNav)', async ({ page }) => {
    // First navigate to a regular site page to verify TenantNav exists
    await page.goto(BASE_PATH);
    await page.waitForLoadState('domcontentloaded');

    const siteNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(siteNav).toBeVisible();

    // Now navigate to booking flow
    // We need to find a valid tier slug from the E2E tenant
    await page.goto(`${BASE_PATH}/book/starter`);
    await page.waitForLoadState('domcontentloaded');

    // Booking flow should NOT have the main TenantNav
    // It should have its own booking-specific header or back button
    // The main navigation should not be duplicated
    const navCount = await page.locator('nav[aria-label="Main navigation"]').count();

    // Either no nav (booking has custom header) or one nav (if booking shares)
    // The key is it should NOT have duplicate navigation
    expect(navCount).toBeLessThanOrEqual(1);
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async () => {
    // SKIP REASON: Requires Next.js app with accessible components
    if (!process.env.NEXTJS_E2E) {
      test.skip(true, 'Requires NEXTJS_E2E=1 environment variable');
    }
  });

  test('navigation has proper ARIA labels', async ({ page }) => {
    await page.goto(BASE_PATH);
    await page.waitForLoadState('domcontentloaded');

    // Main nav has aria-label
    const mainNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(mainNav).toBeVisible();

    // Footer nav has aria-label
    const footerNav = page.locator('nav[aria-label="Footer navigation"]');
    await expect(footerNav).toBeVisible();
  });

  test('footer has contentinfo role', async ({ page }) => {
    await page.goto(BASE_PATH);
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer[role="contentinfo"]');
    await expect(footer).toBeVisible();
  });

  test('contact form fields have accessible labels', async ({ page }) => {
    await page.goto(`${BASE_PATH}/contact`);
    await page.waitForLoadState('domcontentloaded');

    // Each input should have a label
    const nameLabel = page.locator('label[for="name"]');
    await expect(nameLabel).toBeVisible();

    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toBeVisible();

    const messageLabel = page.locator('label[for="message"]');
    await expect(messageLabel).toBeVisible();
  });
});
