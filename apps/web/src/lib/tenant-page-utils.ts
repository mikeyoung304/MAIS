/**
 * Shared utilities for tenant page implementations
 *
 * Provides unified tenant resolution, metadata generation, and domain validation
 * to reduce code duplication between [slug] and _domain route implementations.
 *
 * @see TODO #431 - Tenant Page Code Duplication
 */

import type { Metadata } from 'next';
import type { TenantPublicDto, LandingPageConfig, PageName } from '@macon/contracts';
import {
  getTenantStorefrontData,
  getTenantByDomain,
  validateDomain,
  isPageEnabled,
  TenantNotFoundError,
  InvalidDomainError,
  type TenantStorefrontData,
} from './tenant';

/**
 * Tenant identifier - either by slug or domain
 */
export type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };

/**
 * Resolved tenant context with all necessary data for page rendering
 */
export interface ResolvedTenantContext {
  tenant: TenantPublicDto;
  config: LandingPageConfig | undefined;
  basePath: string;
  domainParam?: string;
}

/**
 * Full storefront context including packages and segments
 */
export interface ResolvedStorefrontContext extends ResolvedTenantContext {
  packages: TenantStorefrontData['packages'];
  segments: TenantStorefrontData['segments'];
}

/**
 * Tenant resolution result - either success or error
 */
export type TenantResolutionResult<T> =
  | { success: true; data: T }
  | { success: false; error: 'not_found' | 'invalid_domain' };

/**
 * Resolve tenant by identifier (slug or domain)
 *
 * Unified tenant resolution that handles both [slug] and _domain routes.
 * Returns a normalized context object with basePath and optional domain param.
 *
 * @param identifier - Tenant identifier (slug or domain)
 * @returns Resolved tenant context or error
 *
 * @example
 * // From [slug] route
 * const result = await resolveTenant({ type: 'slug', slug: params.slug });
 *
 * // From _domain route
 * const result = await resolveTenant({ type: 'domain', domain: searchParams.domain! });
 */
export async function resolveTenant(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedTenantContext>> {
  try {
    if (identifier.type === 'slug') {
      const { tenant } = await getTenantStorefrontData(identifier.slug);
      const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
      return {
        success: true,
        data: {
          tenant,
          config,
          basePath: `/t/${identifier.slug}`,
        },
      };
    } else {
      const validatedDomain = validateDomain(identifier.domain);
      const tenant = await getTenantByDomain(validatedDomain);
      const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
      return {
        success: true,
        data: {
          tenant,
          config,
          basePath: '',
          domainParam: `?domain=${validatedDomain}`,
        },
      };
    }
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return { success: false, error: 'not_found' };
    }
    if (error instanceof InvalidDomainError) {
      return { success: false, error: 'invalid_domain' };
    }
    throw error;
  }
}

/**
 * Resolve tenant with full storefront data (packages and segments)
 *
 * Use this for pages that need package/segment data (e.g., Services page).
 *
 * @param identifier - Tenant identifier (slug or domain)
 * @returns Resolved storefront context or error
 */
export async function resolveTenantWithStorefront(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedStorefrontContext>> {
  try {
    if (identifier.type === 'slug') {
      const data = await getTenantStorefrontData(identifier.slug);
      const config = data.tenant.branding?.landingPage as LandingPageConfig | undefined;
      return {
        success: true,
        data: {
          tenant: data.tenant,
          packages: data.packages,
          segments: data.segments,
          config,
          basePath: `/t/${identifier.slug}`,
        },
      };
    } else {
      const validatedDomain = validateDomain(identifier.domain);
      const tenant = await getTenantByDomain(validatedDomain);
      const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

      // For domain routes, we need to fetch packages/segments separately
      const { getTenantPackages, getTenantSegments } = await import('./tenant');
      const [packages, segments] = await Promise.all([
        getTenantPackages(tenant.apiKeyPublic),
        getTenantSegments(tenant.apiKeyPublic),
      ]);

      return {
        success: true,
        data: {
          tenant,
          packages,
          segments,
          config,
          basePath: '',
          domainParam: `?domain=${validatedDomain}`,
        },
      };
    }
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return { success: false, error: 'not_found' };
    }
    if (error instanceof InvalidDomainError) {
      return { success: false, error: 'invalid_domain' };
    }
    throw error;
  }
}

/**
 * Page metadata configuration
 */
interface PageMetadataConfig {
  pageName: Exclude<PageName, 'home'>;
  titlePrefix: string;
  getDescription: (tenantName: string) => string;
  getCustomDescription?: (config: LandingPageConfig | undefined) => string | undefined;
}

/**
 * Pre-configured metadata for each page type
 */
const PAGE_METADATA_CONFIGS: Record<Exclude<PageName, 'home'>, PageMetadataConfig> = {
  about: {
    pageName: 'about',
    titlePrefix: 'About',
    getDescription: (name) => `Learn more about ${name}.`,
    getCustomDescription: (config) => config?.about?.content?.slice(0, 160),
  },
  services: {
    pageName: 'services',
    titlePrefix: 'Services',
    getDescription: (name) =>
      `Explore our services and packages at ${name}. Find the perfect option for your needs.`,
  },
  contact: {
    pageName: 'contact',
    titlePrefix: 'Contact',
    getDescription: (name) => `Get in touch with ${name}. We'd love to hear from you.`,
  },
  faq: {
    pageName: 'faq',
    titlePrefix: 'FAQ',
    getDescription: (name) =>
      `Frequently asked questions about ${name}. Find answers to common questions about our services.`,
  },
  gallery: {
    pageName: 'gallery',
    titlePrefix: 'Gallery',
    getDescription: (name) =>
      `View our portfolio and work at ${name}. See examples of what we can do for you.`,
  },
  testimonials: {
    pageName: 'testimonials',
    titlePrefix: 'Testimonials',
    getDescription: (name) =>
      `Read what our clients say about ${name}. See reviews and testimonials from happy customers.`,
  },
};

/**
 * Generate consistent metadata for tenant pages
 *
 * Handles the common pattern of checking page enabled status and
 * generating appropriate metadata with OpenGraph tags.
 *
 * @param identifier - Tenant identifier (slug or domain)
 * @param pageName - Name of the page (about, services, etc.)
 * @returns Next.js Metadata object
 *
 * @example
 * export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
 *   const { slug } = await params;
 *   return generateTenantPageMetadata({ type: 'slug', slug }, 'about');
 * }
 */
export async function generateTenantPageMetadata(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<Metadata> {
  const config = PAGE_METADATA_CONFIGS[pageName];
  const result = await resolveTenant(identifier);

  if (!result.success) {
    return {
      title: `${config.titlePrefix} | Business Not Found`,
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const { tenant, config: landingConfig } = result.data;

  // If page is disabled, return noindex metadata
  if (!isPageEnabled(landingConfig, pageName)) {
    return {
      title: 'Page Not Found',
      robots: { index: false, follow: false },
    };
  }

  const title = `${config.titlePrefix} | ${tenant.name}`;
  const customDescription = config.getCustomDescription?.(landingConfig);
  const description = customDescription || config.getDescription(tenant.name);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Check if a page is accessible for a tenant
 *
 * Combines tenant resolution with page enabled check.
 * Returns the resolved context if page is enabled, null otherwise.
 *
 * @param identifier - Tenant identifier
 * @param pageName - Page to check
 * @returns Resolved context or null if page should 404
 */
export async function checkPageAccessible(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<ResolvedTenantContext | null> {
  const result = await resolveTenant(identifier);

  if (!result.success) {
    return null;
  }

  if (!isPageEnabled(result.data.config, pageName)) {
    return null;
  }

  return result.data;
}

/**
 * Check if a page is accessible with full storefront data
 *
 * Use for pages that need packages/segments (e.g., Services).
 *
 * @param identifier - Tenant identifier
 * @param pageName - Page to check
 * @returns Resolved storefront context or null if page should 404
 */
export async function checkPageAccessibleWithStorefront(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<ResolvedStorefrontContext | null> {
  const result = await resolveTenantWithStorefront(identifier);

  if (!result.success) {
    return null;
  }

  if (!isPageEnabled(result.data.config, pageName)) {
    return null;
  }

  return result.data;
}

// Re-export commonly used utilities for convenience
export { isPageEnabled, normalizeToPages, TenantNotFoundError, InvalidDomainError } from './tenant';
