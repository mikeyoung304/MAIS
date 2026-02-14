/**
 * Shared storefront page utilities
 *
 * Converts SectionContent rows from the database into PagesConfig
 * for the component tree. Also handles Schema.org generation and
 * safe JSON-LD serialization for SEO.
 *
 * Data flow: SectionContent → sectionsToPages() → PagesConfig → components
 */

import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';
import type {
  TenantPublicDto,
  ContactSection,
  PagesConfig,
  PageName,
  Section,
  SectionContentDto,
  SectionTypeName,
} from '@macon/contracts';

/**
 * Block type to section type mapping.
 * Maps database UPPER_CASE blockType to component lowercase section type.
 */
const BLOCK_TO_SECTION_TYPE: Record<string, SectionTypeName> = {
  HERO: 'hero',
  TEXT: 'text',
  ABOUT: 'about',
  GALLERY: 'gallery',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  CONTACT: 'contact',
  CTA: 'cta',
  PRICING: 'pricing',
  SERVICES: 'services',
  FEATURES: 'features',
  CUSTOM: 'custom',
};

/**
 * Transform database field names to component field names.
 *
 * The SectionContent table stores content with database-friendly names
 * (title, body, items) but components expect semantic names
 * (headline, content, features). This function bridges that gap.
 */
function transformContentForSection(
  sectionType: SectionTypeName,
  content: Record<string, unknown>
): Record<string, unknown> {
  const transformed: Record<string, unknown> = { ...content };

  // Common field mappings
  if ('title' in content && !('headline' in content)) {
    transformed.headline = content.title;
    delete transformed.title;
  }

  // Type-specific mappings
  switch (sectionType) {
    case 'text':
    case 'about':
      if ('body' in content && !('content' in content)) {
        transformed.content = content.body;
        delete transformed.body;
      }
      if ('image' in content && !('imageUrl' in content)) {
        transformed.imageUrl = content.image;
        delete transformed.image;
      }
      break;
    case 'hero':
      if ('backgroundImage' in content && !('backgroundImageUrl' in content)) {
        transformed.backgroundImageUrl = content.backgroundImage;
        delete transformed.backgroundImage;
      }
      break;
    case 'features':
    case 'services':
      if ('items' in content && !('features' in content)) {
        transformed.features = content.items;
        delete transformed.items;
      }
      break;
    case 'gallery':
      if ('items' in content && !('images' in content)) {
        transformed.images = content.items;
        delete transformed.items;
      }
      break;
  }

  return transformed;
}

/**
 * Convert SectionContent rows to PagesConfig.
 *
 * Single conversion from database format to component format.
 * Data flow: SectionContent rows → sectionsToPages() → PagesConfig → components
 *
 * @param sections - Published SectionContent rows from the database
 * @returns PagesConfig ready for component consumption
 */
export function sectionsToPages(sections: SectionContentDto[]): PagesConfig {
  if (!sections || sections.length === 0) {
    return DEFAULT_PAGES_CONFIG;
  }

  // Group sections by page
  const pageMap = new Map<PageName, Section[]>();

  for (const section of sections) {
    const sectionType = BLOCK_TO_SECTION_TYPE[section.blockType];
    if (!sectionType) continue;

    const pageName = (section.pageName || 'home') as PageName;

    const content = section.content as Record<string, unknown>;
    const transformed = transformContentForSection(sectionType, content);

    const sectionData: Section = {
      ...transformed,
      id: section.id,
      type: sectionType,
    } as Section;

    const existing = pageMap.get(pageName) || [];
    existing.push(sectionData);
    pageMap.set(pageName, existing);
  }

  // Sort sections within each page by order
  const sortedPageMap = new Map<PageName, Section[]>();
  for (const [pageName, pageSections] of pageMap) {
    const sectionOrder = new Map<string, number>();
    for (const section of sections) {
      sectionOrder.set(section.id, section.order);
    }
    const sorted = [...pageSections].sort((a, b) => {
      const orderA = a.id ? (sectionOrder.get(a.id) ?? 0) : 0;
      const orderB = b.id ? (sectionOrder.get(b.id) ?? 0) : 0;
      return orderA - orderB;
    });
    sortedPageMap.set(pageName, sorted);
  }

  // Build PagesConfig from grouped sections
  return {
    home: {
      enabled: true as const,
      sections: sortedPageMap.get('home') || DEFAULT_PAGES_CONFIG.home.sections,
    },
    about: {
      enabled: sortedPageMap.has('about'),
      sections: sortedPageMap.get('about') || [],
    },
    services: {
      enabled: sortedPageMap.has('services'),
      sections: sortedPageMap.get('services') || [],
    },
    faq: {
      enabled: sortedPageMap.has('faq'),
      sections: sortedPageMap.get('faq') || [],
    },
    contact: {
      enabled: sortedPageMap.has('contact'),
      sections: sortedPageMap.get('contact') || [],
    },
    gallery: {
      enabled: sortedPageMap.has('gallery'),
      sections: sortedPageMap.get('gallery') || [],
    },
    testimonials: {
      enabled: sortedPageMap.has('testimonials'),
      sections: sortedPageMap.get('testimonials') || [],
    },
  };
}

/**
 * Extract hero content from sections array.
 * Used for SEO metadata generation.
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
 * Used for Schema.org structured data.
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
 * Uses sections data for hero subheadline and contact info.
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

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: tenant.name,
    url: canonicalUrl,
  };

  if (heroFromSections?.subheadline) {
    schema.description = heroFromSections.subheadline;
  }

  if (contactFromSections?.email) {
    schema.email = contactFromSections.email;
  }

  if (contactFromSections?.phone) {
    schema.telephone = contactFromSections.phone;
  }

  if (contactFromSections?.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: contactFromSections.address,
    };
  }

  if (tenant.branding?.logoUrl) {
    schema.logo = tenant.branding.logoUrl;
  }

  if (contactFromSections?.hours) {
    schema.openingHours = contactFromSections.hours;
  }

  return schema;
}
