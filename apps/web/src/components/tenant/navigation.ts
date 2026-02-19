/**
 * Tenant Navigation Configuration
 *
 * Shared navigation items and utilities for TenantNav and TenantFooter.
 * Single source of truth for navigation structure.
 *
 * Two derivation modes:
 * - getNavigationItems(): Multi-page mode — uses page-level `enabled` flags (TenantFooter)
 * - getNavItemsFromHomeSections(): Single-page scroll — derives from section types on home page (TenantNav)
 */

import type { PagesConfig, PageName, SectionTypeName } from '@macon/contracts';

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
 * Section types that map to nav items when present on the home page.
 *
 * Intentionally excluded:
 * - hero: always at top, no anchor nav needed
 * - cta: closing section, not a nav destination
 * - features: process steps (e.g. "How It Works"), not service offerings
 *   (SegmentTiersSection already renders at #services anchor)
 * - custom: no canonical nav label
 * - pricing: rendered through tiers, not standalone
 */
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  about: 'about',
  text: 'about',
  services: 'services',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
};

/**
 * Derive anchor navigation items from home page sections.
 *
 * For single-page storefronts where all sections live on the home page,
 * this scans the actual section types present and generates nav items
 * with anchor links. Iterates PAGE_ORDER for deterministic ordering.
 */
export function getNavItemsFromHomeSections(pages?: PagesConfig | null): NavItem[] {
  if (!pages?.home?.sections?.length) {
    return [{ label: 'Home', path: '' }];
  }

  const items: NavItem[] = [{ label: 'Home', path: '' }];
  for (const page of PAGE_ORDER) {
    if (page === 'home') continue;
    const hasSection = pages.home.sections.some(
      (s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page
    );
    if (hasSection) {
      items.push({ label: PAGE_LABELS[page], path: PAGE_ANCHORS[page] });
    }
  }
  return items;
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
