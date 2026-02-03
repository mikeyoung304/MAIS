/**
 * Section Transform Utilities
 *
 * Bidirectional conversion between SectionContent[] and PagesConfig.
 * Used for backward compatibility during migration and for components
 * that still expect the legacy PagesConfig format.
 *
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md Phase 4
 */

import type { BlockType } from '../generated/prisma/client';
import type { SectionContentEntity, PageName } from './ports';
import { blockTypeToSectionType, sectionTypeToBlockType } from './block-type-mapper';

// ============================================================================
// Types (matching @macon/contracts)
// ============================================================================

/**
 * Section types supported by the storefront
 */
type SectionType =
  | 'hero'
  | 'text'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'contact'
  | 'cta'
  | 'pricing'
  | 'services'
  | 'features';

/**
 * Base section with common properties
 */
interface BaseSection {
  type: SectionType;
  visible?: boolean;
}

/**
 * Hero section content
 */
interface HeroSection extends BaseSection {
  type: 'hero';
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundImageUrl?: string;
  alignment?: 'left' | 'center' | 'right';
}

/**
 * Text section content (maps to ABOUT block)
 */
interface TextSection extends BaseSection {
  type: 'text';
  title?: string;
  body?: string;
  image?: string;
  imagePosition?: 'left' | 'right';
}

/**
 * Union of all section types
 */
type Section = HeroSection | TextSection | BaseSection;

/**
 * Page configuration with sections
 */
interface PageConfig {
  enabled?: boolean;
  sections: Section[];
}

/**
 * Full pages configuration (legacy format)
 */
interface PagesConfig {
  home: PageConfig;
  about?: PageConfig;
  services?: PageConfig;
  pricing?: PageConfig;
  contact?: PageConfig;
  [key: string]: PageConfig | undefined;
}

/**
 * Input for creating a section from PagesConfig
 */
interface SectionContentInput {
  tenantId: string;
  blockType: BlockType;
  pageName: string;
  content: unknown;
  order: number;
  segmentId?: string | null;
}

// ============================================================================
// PagesConfig → SectionContent[] (for migration/import)
// ============================================================================

/**
 * Convert legacy PagesConfig to SectionContent array.
 *
 * Used for:
 * - Migrating existing tenant data
 * - Importing content from external sources
 * - Converting from agent tools that still use PagesConfig
 *
 * @param tenantId - Tenant ID for the sections
 * @param pages - Legacy PagesConfig object
 * @returns Array of SectionContentInput ready for repository upsert
 */
export function pagesToSections(tenantId: string, pages: PagesConfig): SectionContentInput[] {
  const sections: SectionContentInput[] = [];

  // Process each page
  const pageNames = Object.keys(pages) as PageName[];

  for (const pageName of pageNames) {
    const page = pages[pageName];
    if (!page?.sections) continue;

    page.sections.forEach((section, index) => {
      const blockType = sectionTypeToBlockType(section.type);
      if (!blockType) {
        // Skip unknown section types
        return;
      }

      // Extract content from section (remove 'type' as it's redundant with blockType)
      const { type: _type, ...content } = section;

      sections.push({
        tenantId,
        blockType,
        pageName,
        content,
        order: index,
      });
    });
  }

  return sections;
}

// ============================================================================
// SectionContent[] → PagesConfig (for backward compatibility)
// ============================================================================

/**
 * Convert SectionContent array to legacy PagesConfig format.
 *
 * Used for:
 * - Backward compatibility with existing frontend components
 * - API responses that need legacy format
 * - Preview rendering in legacy storefront
 *
 * @param sections - Array of SectionContentEntity from database
 * @returns PagesConfig object for legacy components
 */
export function sectionsToPages(sections: SectionContentEntity[]): PagesConfig {
  // Group sections by page
  const pageMap = new Map<string, Section[]>();

  for (const section of sections) {
    const sectionType = blockTypeToSectionType(section.blockType) as SectionType;
    const content = section.content as Record<string, unknown>;

    // Build section object
    const legacySection: Section = {
      type: sectionType,
      visible: content.visible !== false, // Default to visible
      ...content,
    };

    const existing = pageMap.get(section.pageName) || [];
    existing.push(legacySection);
    pageMap.set(section.pageName, existing);
  }

  // Build PagesConfig
  const pages: PagesConfig = {
    home: { enabled: true, sections: [] },
  };

  for (const [pageName, pageSections] of pageMap) {
    // Sort by order (order is preserved in the entity)
    const sortedSections = [...pageSections];

    pages[pageName] = {
      enabled: true,
      sections: sortedSections,
    };
  }

  // Ensure required pages exist with empty sections if not populated
  const requiredPages: PageName[] = ['home', 'about', 'services', 'pricing', 'contact'];
  for (const pageName of requiredPages) {
    if (!pages[pageName]) {
      pages[pageName] = { enabled: false, sections: [] };
    }
  }

  return pages;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract sections for a specific page from SectionContent array.
 *
 * @param sections - Full sections array
 * @param pageName - Page to extract
 * @returns Sections for the specified page, sorted by order
 */
export function getSectionsForPage(
  sections: SectionContentEntity[],
  pageName: PageName
): SectionContentEntity[] {
  return sections.filter((s) => s.pageName === pageName).sort((a, b) => a.order - b.order);
}

/**
 * Get unique page names from sections array.
 *
 * @param sections - Full sections array
 * @returns Array of unique page names
 */
export function getPageNames(sections: SectionContentEntity[]): string[] {
  const names = new Set<string>();
  for (const section of sections) {
    names.add(section.pageName);
  }
  return Array.from(names);
}

/**
 * Check if a page has any visible sections.
 *
 * @param sections - Full sections array
 * @param pageName - Page to check
 * @returns True if page has at least one visible section
 */
export function isPageEnabled(sections: SectionContentEntity[], pageName: PageName): boolean {
  const pageSections = getSectionsForPage(sections, pageName);
  return pageSections.some((s) => {
    const content = s.content as Record<string, unknown>;
    return content.visible !== false;
  });
}

/**
 * Find a section by block type within a page.
 *
 * @param sections - Full sections array
 * @param pageName - Page to search
 * @param blockType - Block type to find
 * @returns First matching section or undefined
 */
export function findSectionByType(
  sections: SectionContentEntity[],
  pageName: PageName,
  blockType: BlockType
): SectionContentEntity | undefined {
  return sections.find((s) => s.pageName === pageName && s.blockType === blockType);
}
