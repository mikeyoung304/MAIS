/**
 * Tests for Section Transform Utilities
 *
 * @see section-transforms.ts
 */

import { describe, it, expect } from 'vitest';
import type { BlockType } from '../generated/prisma/client';
import type { SectionContentEntity } from './ports';
import {
  sectionsToPages,
  pagesToSections,
  getSectionsForPage,
  getPageNames,
  isPageEnabled,
  findSectionByType,
} from './section-transforms';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSection(overrides: Partial<SectionContentEntity> = {}): SectionContentEntity {
  return {
    id: 'test-id',
    tenantId: 'tenant-123',
    segmentId: null,
    blockType: 'HERO' as BlockType,
    pageName: 'home',
    content: { headline: 'Test Headline', visible: true },
    order: 0,
    isDraft: true,
    publishedAt: null,
    versions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// sectionsToPages Tests
// ============================================================================

describe('sectionsToPages', () => {
  it('converts empty sections array to default pages', () => {
    const result = sectionsToPages([]);

    expect(result.home).toBeDefined();
    expect(result.home.sections).toEqual([]);
    expect(result.about?.enabled).toBe(false);
    expect(result.services?.enabled).toBe(false);
  });

  it('converts hero section correctly', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        blockType: 'HERO',
        pageName: 'home',
        content: { headline: 'Welcome', subheadline: 'Test', visible: true },
        order: 0,
      }),
    ];

    const result = sectionsToPages(sections);

    expect(result.home.sections).toHaveLength(1);
    expect(result.home.sections[0].type).toBe('hero');
    expect((result.home.sections[0] as { headline: string }).headline).toBe('Welcome');
  });

  it('converts ABOUT blockType to about section type', () => {
    // Note: ABOUT maps to 'about' (canonical name), not 'text' (legacy alias)
    const sections: SectionContentEntity[] = [
      createMockSection({
        blockType: 'ABOUT',
        pageName: 'home',
        content: { title: 'About Us', body: 'Description', visible: true },
        order: 0,
      }),
    ];

    const result = sectionsToPages(sections);

    expect(result.home.sections[0].type).toBe('about');
  });

  it('groups sections by page name', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        id: 'home-hero',
        blockType: 'HERO',
        pageName: 'home',
        order: 0,
      }),
      createMockSection({
        id: 'about-text',
        blockType: 'ABOUT',
        pageName: 'about',
        order: 0,
      }),
      createMockSection({
        id: 'home-cta',
        blockType: 'CTA',
        pageName: 'home',
        order: 1,
      }),
    ];

    const result = sectionsToPages(sections);

    expect(result.home.sections).toHaveLength(2);
    expect(result.about?.sections).toHaveLength(1);
    expect(result.home.enabled).toBe(true);
    expect(result.about?.enabled).toBe(true);
  });

  it('sets visible to true by default', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        content: { headline: 'Test' }, // No visible property
      }),
    ];

    const result = sectionsToPages(sections);

    expect(result.home.sections[0].visible).toBe(true);
  });

  it('preserves visible: false when set', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        content: { headline: 'Test', visible: false },
      }),
    ];

    const result = sectionsToPages(sections);

    expect(result.home.sections[0].visible).toBe(false);
  });
});

// ============================================================================
// pagesToSections Tests
// ============================================================================

describe('pagesToSections', () => {
  it('converts empty pages config', () => {
    const pages = {
      home: { enabled: true, sections: [] },
    };

    const result = pagesToSections('tenant-123', pages);

    expect(result).toEqual([]);
  });

  it('converts hero section with correct blockType', () => {
    const pages = {
      home: {
        enabled: true,
        sections: [
          {
            type: 'hero' as const,
            headline: 'Welcome',
            subheadline: 'Tagline',
            visible: true,
          },
        ],
      },
    };

    const result = pagesToSections('tenant-123', pages);

    expect(result).toHaveLength(1);
    expect(result[0].blockType).toBe('HERO');
    expect(result[0].tenantId).toBe('tenant-123');
    expect(result[0].pageName).toBe('home');
    expect(result[0].order).toBe(0);
    expect((result[0].content as { headline: string }).headline).toBe('Welcome');
  });

  it('converts text section to ABOUT blockType', () => {
    const pages = {
      home: {
        enabled: true,
        sections: [
          {
            type: 'text' as const,
            title: 'About',
            body: 'Content',
          },
        ],
      },
    };

    const result = pagesToSections('tenant-123', pages);

    expect(result[0].blockType).toBe('ABOUT');
  });

  it('preserves section order', () => {
    const pages = {
      home: {
        enabled: true,
        sections: [
          { type: 'hero' as const, headline: 'First' },
          { type: 'text' as const, title: 'Second' },
          { type: 'cta' as const, headline: 'Third' },
        ],
      },
    };

    const result = pagesToSections('tenant-123', pages);

    expect(result).toHaveLength(3);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
    expect(result[2].order).toBe(2);
  });

  it('handles multiple pages', () => {
    const pages = {
      home: {
        enabled: true,
        sections: [{ type: 'hero' as const }],
      },
      about: {
        enabled: true,
        sections: [{ type: 'text' as const }],
      },
    };

    const result = pagesToSections('tenant-123', pages);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.pageName === 'home')).toBeDefined();
    expect(result.find((s) => s.pageName === 'about')).toBeDefined();
  });

  it('removes type from content (redundant with blockType)', () => {
    const pages = {
      home: {
        enabled: true,
        sections: [
          {
            type: 'hero' as const,
            headline: 'Test',
          },
        ],
      },
    };

    const result = pagesToSections('tenant-123', pages);

    expect((result[0].content as { type?: string }).type).toBeUndefined();
    expect((result[0].content as { headline: string }).headline).toBe('Test');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('getSectionsForPage', () => {
  it('filters sections by page name', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({ id: '1', pageName: 'home', order: 0 }),
      createMockSection({ id: '2', pageName: 'about', order: 0 }),
      createMockSection({ id: '3', pageName: 'home', order: 1 }),
    ];

    const result = getSectionsForPage(sections, 'home');

    expect(result).toHaveLength(2);
    expect(result.every((s) => s.pageName === 'home')).toBe(true);
  });

  it('sorts sections by order', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({ id: '1', pageName: 'home', order: 2 }),
      createMockSection({ id: '2', pageName: 'home', order: 0 }),
      createMockSection({ id: '3', pageName: 'home', order: 1 }),
    ];

    const result = getSectionsForPage(sections, 'home');

    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
    expect(result[2].order).toBe(2);
  });
});

describe('getPageNames', () => {
  it('returns unique page names', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({ pageName: 'home' }),
      createMockSection({ pageName: 'about' }),
      createMockSection({ pageName: 'home' }),
      createMockSection({ pageName: 'contact' }),
    ];

    const result = getPageNames(sections);

    expect(result).toHaveLength(3);
    expect(result).toContain('home');
    expect(result).toContain('about');
    expect(result).toContain('contact');
  });
});

describe('isPageEnabled', () => {
  it('returns true if page has visible sections', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        pageName: 'home',
        content: { visible: true },
      }),
    ];

    expect(isPageEnabled(sections, 'home')).toBe(true);
  });

  it('returns false if all sections are hidden', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({
        pageName: 'home',
        content: { visible: false },
      }),
    ];

    expect(isPageEnabled(sections, 'home')).toBe(false);
  });

  it('returns false for empty page', () => {
    const sections: SectionContentEntity[] = [createMockSection({ pageName: 'about' })];

    expect(isPageEnabled(sections, 'home')).toBe(false);
  });
});

describe('findSectionByType', () => {
  it('finds section by blockType and pageName', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({ id: '1', pageName: 'home', blockType: 'HERO' }),
      createMockSection({ id: '2', pageName: 'home', blockType: 'CTA' }),
      createMockSection({ id: '3', pageName: 'about', blockType: 'HERO' }),
    ];

    const result = findSectionByType(sections, 'home', 'HERO');

    expect(result?.id).toBe('1');
  });

  it('returns undefined if not found', () => {
    const sections: SectionContentEntity[] = [
      createMockSection({ pageName: 'home', blockType: 'HERO' }),
    ];

    const result = findSectionByType(sections, 'home', 'CTA');

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Round-trip Tests
// ============================================================================

describe('round-trip conversion', () => {
  it('preserves data through pages → sections → pages', () => {
    // Note: 'text' is a legacy alias that maps to ABOUT blockType
    // When converted back, ABOUT maps to 'about' (canonical name)
    const originalPages = {
      home: {
        enabled: true,
        sections: [
          {
            type: 'hero' as const,
            headline: 'Welcome',
            subheadline: 'Tagline',
            visible: true,
          },
          {
            type: 'text' as const, // Legacy alias
            title: 'About',
            body: 'Description',
            visible: true,
          },
        ],
      },
    };

    // Convert pages → sections
    const sections = pagesToSections('tenant-123', originalPages);

    // Convert sections back → pages (simulating entities)
    const entities: SectionContentEntity[] = sections.map((s, i) => ({
      ...s,
      id: `id-${i}`,
      segmentId: null,
      isDraft: true,
      publishedAt: null,
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const resultPages = sectionsToPages(entities);

    // Verify key data is preserved
    // Note: 'text' -> ABOUT -> 'about' (canonical name wins on round-trip)
    expect(resultPages.home.sections).toHaveLength(2);
    expect(resultPages.home.sections[0].type).toBe('hero');
    expect((resultPages.home.sections[0] as { headline: string }).headline).toBe('Welcome');
    expect(resultPages.home.sections[1].type).toBe('about'); // Canonical, not 'text'
    expect((resultPages.home.sections[1] as { title: string }).title).toBe('About');
  });
});
