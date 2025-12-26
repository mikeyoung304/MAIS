/**
 * Tenant Navigation Configuration
 *
 * Shared navigation items and utilities for TenantNav and TenantFooter.
 * Single source of truth for navigation structure.
 *
 * Supports both legacy static navigation and new dynamic navigation
 * based on page configuration.
 */

import type { LandingPageConfig, PageName } from '@macon/contracts';

/**
 * Navigation item definition
 */
export interface NavItem {
  /** Display label for the link */
  label: string;
  /** Relative path from basePath (empty string for home) */
  path: string;
}

/**
 * Page order for consistent navigation display
 * Matches the order users expect to see in nav
 */
const PAGE_ORDER: PageName[] = [
  'home',
  'about',
  'services',
  'gallery',
  'testimonials',
  'faq',
  'contact',
];

/**
 * Human-readable labels for each page
 */
const PAGE_LABELS: Record<PageName, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  faq: 'FAQ',
  contact: 'Contact',
};

/**
 * URL paths for each page
 */
const PAGE_PATHS: Record<PageName, string> = {
  home: '',
  about: '/about',
  services: '/services',
  gallery: '/gallery',
  testimonials: '/testimonials',
  faq: '/faq',
  contact: '/contact',
};

/**
 * Get navigation items based on page configuration
 *
 * Returns only the pages that are enabled in the tenant's configuration.
 * Falls back to legacy NAV_ITEMS if no pages config is present.
 *
 * @param config - Landing page configuration (may include pages or legacy sections)
 * @returns Array of navigation items for enabled pages
 *
 * @example
 * ```ts
 * const navItems = getNavigationItems(tenant.branding?.landingPage);
 * // Returns: [{ label: 'Home', path: '' }, { label: 'About', path: '/about' }, ...]
 * ```
 */
export function getNavigationItems(config?: LandingPageConfig | null): NavItem[] {
  // If new pages config exists, use it
  if (config?.pages) {
    return PAGE_ORDER
      .filter((page) => {
        const pageConfig = config.pages![page];
        return pageConfig?.enabled !== false;
      })
      .map((page) => ({
        label: PAGE_LABELS[page],
        path: PAGE_PATHS[page],
      }));
  }

  // Fall back to legacy static navigation
  return NAV_ITEMS;
}

/**
 * Legacy static navigation items for tenant storefronts
 *
 * @deprecated Use getNavigationItems(config) for dynamic navigation
 *
 * @remarks
 * - 'path' is relative to the basePath
 * - Empty string '' represents the home page
 * - Kept for backward compatibility during migration
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
  { label: 'About', path: '/about' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

/**
 * Build full href from basePath and nav item
 *
 * Handles both slug-based paths (/t/slug) and domain-based paths
 * with query parameters.
 *
 * @param basePath - Base path for the tenant (e.g., '/t/jane-photography')
 * @param item - Navigation item with relative path
 * @param domainParam - Optional domain query param for custom domains
 * @returns Full href for the navigation link
 *
 * @example
 * // Slug-based navigation
 * buildNavHref('/t/jane', { label: 'Services', path: '/services' })
 * // Returns: '/t/jane/services'
 *
 * @example
 * // Domain-based navigation
 * buildNavHref('', { label: 'Services', path: '/services' }, '?domain=example.com')
 * // Returns: '/services?domain=example.com'
 */
export function buildNavHref(
  basePath: string,
  item: NavItem,
  domainParam?: string
): string {
  // For home page with domain param, return root with param
  if (item.path === '' && domainParam) {
    return `/${domainParam}`;
  }

  // For home page without domain param, return basePath
  if (item.path === '') {
    return basePath || '/';
  }

  // For other pages
  const fullPath = `${basePath}${item.path}`;

  // Append domain param if present
  if (domainParam) {
    return `${fullPath}${domainParam}`;
  }

  return fullPath;
}
