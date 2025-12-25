/**
 * Tenant Navigation Configuration
 *
 * Shared navigation items and utilities for TenantNav and TenantFooter.
 * Single source of truth for navigation structure.
 */

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
 * Navigation items for tenant storefronts
 *
 * @remarks
 * - 'path' is relative to the basePath
 * - Empty string '' represents the home page
 * - Update this array to add/remove pages from all navigations
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
