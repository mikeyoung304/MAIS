/**
 * Tenant Navigation Configuration
 *
 * Shared navigation items and utilities for TenantNav and TenantFooter.
 * Single source of truth for navigation structure.
 *
 * Derives navigation from PagesConfig — only enabled pages appear in nav.
 */

import type { PagesConfig, PageName } from '@macon/contracts';

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
 * URL paths for multi-page navigation
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
 * Anchor IDs for single-page navigation
 * Maps page names to section IDs on the landing page
 */
const PAGE_ANCHORS: Record<PageName, string> = {
  home: '', // Top of page, no anchor
  about: '#about',
  services: '#services',
  gallery: '#gallery',
  testimonials: '#testimonials',
  faq: '#faq',
  contact: '#contact',
};

/**
 * Get navigation items based on page configuration
 *
 * Returns only the pages that are enabled in the tenant's PagesConfig.
 *
 * @param pages - Pages configuration from SectionContent
 * @returns Array of navigation items for enabled pages
 */
export function getNavigationItems(pages?: PagesConfig | null): NavItem[] {
  if (!pages) {
    return [{ label: 'Home', path: '' }];
  }

  return PAGE_ORDER.filter((page) => {
    const pageConfig = pages[page];
    return pageConfig?.enabled !== false;
  }).map((page) => ({
    label: PAGE_LABELS[page],
    path: PAGE_PATHS[page],
  }));
}

/**
 * Build full href from basePath and nav item
 *
 * Handles both slug-based paths (/t/slug) and domain-based paths
 * with query parameters.
 */
export function buildNavHref(basePath: string, item: NavItem, domainParam?: string): string {
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

/**
 * Get anchor-based navigation items for single landing page mode
 *
 * Returns anchor links (#about, #services, etc.) instead of
 * separate page paths (/about, /services, etc.).
 *
 * @param pages - Pages configuration from SectionContent
 * @returns Array of navigation items with anchor-based paths
 */
export function getAnchorNavigationItems(pages?: PagesConfig | null): NavItem[] {
  if (!pages) {
    return [{ label: 'Home', path: '' }];
  }

  return PAGE_ORDER.filter((page) => {
    const pageConfig = pages[page];
    return pageConfig?.enabled !== false;
  }).map((page) => ({
    label: PAGE_LABELS[page],
    path: PAGE_ANCHORS[page],
  }));
}

/**
 * Build full href from basePath and anchor item
 *
 * For single-page mode with anchor navigation. Handles the base path
 * combined with anchor fragments.
 */
export function buildAnchorNavHref(basePath: string, item: NavItem): string {
  // For home/top of page (empty path)
  if (item.path === '') {
    return basePath || '/';
  }

  // For anchor links
  return `${basePath || ''}${item.path}`;
}
