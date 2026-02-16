/**
 * Shared redirect utilities for tenant sub-page routes.
 *
 * Tenant storefronts use a single-page scroll design (Issue #6).
 * Sub-page routes (about, contact, faq, etc.) permanently redirect
 * to the landing page anchor. Two routing patterns exist:
 *
 * - Slug-based: /t/[slug]/about → /t/[slug]#about
 * - Domain-based: /t/_domain/about?domain=x → /?domain=x#about
 *
 * This module centralizes the redirect logic so both route trees
 * share the same behavior.
 */

import { permanentRedirect, notFound } from 'next/navigation';

/**
 * Redirect a slug-based sub-page to the landing page anchor.
 *
 * @param slug - Tenant slug from route params
 * @param section - Section anchor ID (e.g., 'about', 'faq')
 */
export function redirectSlugSubPage(slug: string, section: string): never {
  permanentRedirect(`/t/${slug}#${section}`);
}

/**
 * Redirect a domain-based sub-page to the landing page anchor.
 *
 * @param domain - Custom domain from search params (may be undefined)
 * @param section - Section anchor ID (e.g., 'about', 'faq')
 */
export function redirectDomainSubPage(domain: string | undefined, section: string): never {
  if (!domain) {
    notFound();
  }
  permanentRedirect(`/?domain=${encodeURIComponent(domain)}#${section}`);
}
