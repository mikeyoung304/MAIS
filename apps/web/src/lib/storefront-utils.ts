/**
 * Shared storefront page utilities
 *
 * Extracted from [slug]/(site)/page.tsx to enable code sharing
 * between slug-based and domain-based route trees.
 *
 * Functions handle sections-to-config bridging, Schema.org generation,
 * and safe JSON-LD serialization for SEO.
 */

import { normalizeToPages, sectionsToLandingConfig, type TenantStorefrontData } from './tenant';
import type {
  TenantPublicDto,
  ContactSection,
  LandingPageConfig,
  SectionContentDto,
} from '@macon/contracts';

/**
 * Inject sections from SectionContent table into TenantStorefrontData.
 *
 * Bridges the new SectionContent table with existing components that
 * expect LandingPageConfig. If sections exist, converts to config format.
 * Otherwise, keeps existing branding.landingPage (fallback for legacy tenants).
 */
export function injectSectionsIntoData(
  data: TenantStorefrontData,
  sections: SectionContentDto[]
): TenantStorefrontData {
  if (!sections || sections.length === 0) {
    return data;
  }

  const landingConfig = sectionsToLandingConfig(
    sections.map((s) => ({
      id: s.id,
      blockType: s.blockType,
      pageName: s.pageName,
      content: s.content as Record<string, unknown>,
      order: s.order,
    }))
  );

  return {
    ...data,
    tenant: {
      ...data.tenant,
      branding: {
        ...data.tenant.branding,
        landingPage: landingConfig,
      },
    },
  };
}

/**
 * Extract hero content from landing page config.
 * Handles both page-based and legacy config formats consistently.
 */
export function getHeroContent(config: LandingPageConfig | undefined): {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
} | null {
  if (!config) return null;

  const pages = normalizeToPages(config);
  const heroSection = pages.home.sections.find((s) => s.type === 'hero');

  if (heroSection && heroSection.type === 'hero') {
    return {
      headline: heroSection.headline,
      subheadline: heroSection.subheadline,
      ctaText: heroSection.ctaText,
      backgroundImageUrl: heroSection.backgroundImageUrl,
    };
  }

  if (config.hero) {
    return {
      headline: config.hero.headline,
      subheadline: config.hero.subheadline,
      ctaText: config.hero.ctaText,
      backgroundImageUrl: config.hero.backgroundImageUrl,
    };
  }

  return null;
}

/**
 * Extract hero content from sections array.
 * Used for SEO metadata generation with new section format.
 */
export function getHeroFromSections(sections: SectionContentDto[]): {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
} | null {
  const heroSection = sections.find((s) => s.blockType === 'HERO');
  if (!heroSection) return null;

  const content = heroSection.content as Record<string, unknown>;
  return {
    headline: content.headline as string | undefined,
    subheadline: content.subheadline as string | undefined,
    ctaText: content.ctaText as string | undefined,
    backgroundImageUrl: content.backgroundImage as string | undefined,
  };
}

/**
 * Extract contact info from sections array.
 * Used for Schema.org structured data with new section format.
 */
export function getContactFromSections(sections: SectionContentDto[]): ContactSection | null {
  const contactSection = sections.find((s) => s.blockType === 'CONTACT');
  if (!contactSection) return null;

  const content = contactSection.content as Record<string, unknown>;
  return {
    type: 'contact',
    headline: (content.title as string) || 'Get in Touch',
    email: content.email as string | undefined,
    phone: content.phone as string | undefined,
  };
}

/**
 * Extract contact information from landing page config.
 * Handles both legacy and new page-based config formats.
 */
export function getContactInfo(config: LandingPageConfig | undefined): ContactSection | null {
  if (!config) return null;

  if (config.pages?.contact?.sections) {
    const contactSection = config.pages.contact.sections.find(
      (s): s is ContactSection => s.type === 'contact'
    );
    if (contactSection) return contactSection;
  }

  const pages = normalizeToPages(config);
  const contactSections = pages.contact?.sections || [];
  const contactSection = contactSections.find((s): s is ContactSection => s.type === 'contact');

  return contactSection || null;
}

/**
 * Safely serialize data for JSON-LD script injection.
 *
 * JSON-LD content injected via dangerouslySetInnerHTML is an XSS vector
 * if tenant data contains unescaped characters like "</script>".
 * Uses Unicode escape sequences which are valid JSON but prevent injection.
 */
export function safeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Generate Schema.org LocalBusiness JSON-LD structured data.
 *
 * Prefers sections data over legacy landingConfig when available.
 *
 * @see https://schema.org/LocalBusiness
 */
export function generateLocalBusinessSchema(
  tenant: TenantPublicDto,
  canonicalUrl: string,
  sections: SectionContentDto[] = []
): Record<string, unknown> {
  const heroFromSections = sections.length > 0 ? getHeroFromSections(sections) : null;
  const contactFromSections = sections.length > 0 ? getContactFromSections(sections) : null;

  const landingConfig = tenant.branding?.landingPage;
  const contact = contactFromSections || getContactInfo(landingConfig);
  const heroSubheadline = heroFromSections?.subheadline || landingConfig?.hero?.subheadline;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: tenant.name,
    url: canonicalUrl,
  };

  if (heroSubheadline) {
    schema.description = heroSubheadline;
  }

  if (contact?.email) {
    schema.email = contact.email;
  }

  if (contact?.phone) {
    schema.telephone = contact.phone;
  }

  if (contact?.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: contact.address,
    };
  }

  if (tenant.branding?.logoUrl) {
    schema.logo = tenant.branding.logoUrl;
  }

  if (contact?.hours) {
    schema.openingHours = contact.hours;
  }

  return schema;
}
