/**
 * Section ID Schema Tests
 *
 * Tests for the stable section identifier system used by AI chatbot
 * to reliably reference and update tenant storefront sections.
 *
 * @see packages/contracts/src/landing-page.ts
 */

import { describe, it, expect } from 'vitest';
import {
  SectionIdSchema,
  isSectionWithId,
  generateSectionId,
  PAGE_NAMES,
  SECTION_TYPES,
  type PageName,
  type SectionTypeName,
} from '@macon/contracts';

describe('SectionIdSchema', () => {
  describe('valid section IDs', () => {
    it('accepts {page}-{type}-main format', () => {
      expect(SectionIdSchema.safeParse('home-hero-main').success).toBe(true);
      expect(SectionIdSchema.safeParse('about-text-main').success).toBe(true);
      expect(SectionIdSchema.safeParse('faq-faq-main').success).toBe(true);
      expect(SectionIdSchema.safeParse('contact-contact-main').success).toBe(true);
    });

    it('accepts {page}-{type}-{number} format', () => {
      expect(SectionIdSchema.safeParse('home-hero-2').success).toBe(true);
      expect(SectionIdSchema.safeParse('about-text-10').success).toBe(true);
      expect(SectionIdSchema.safeParse('gallery-gallery-99').success).toBe(true);
    });

    it('accepts {page}-{type}-{word} format', () => {
      expect(SectionIdSchema.safeParse('home-hero-intro').success).toBe(true);
      expect(SectionIdSchema.safeParse('about-text-story').success).toBe(true);
    });

    it('accepts all valid page names', () => {
      for (const page of PAGE_NAMES) {
        expect(SectionIdSchema.safeParse(`${page}-hero-main`).success).toBe(true);
      }
    });

    it('accepts all valid section types', () => {
      for (const type of SECTION_TYPES) {
        expect(SectionIdSchema.safeParse(`home-${type}-main`).success).toBe(true);
      }
    });
  });

  describe('invalid section IDs', () => {
    it('rejects invalid page names', () => {
      const result = SectionIdSchema.safeParse('invalid-hero-main');
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('Section ID must be');
    });

    it('rejects invalid section types', () => {
      const result = SectionIdSchema.safeParse('home-invalid-main');
      expect(result.success).toBe(false);
    });

    it('rejects missing qualifier', () => {
      const result = SectionIdSchema.safeParse('home-hero');
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = SectionIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects IDs over 50 characters', () => {
      // Create an ID that would be over 50 chars
      const longQualifier = 'a'.repeat(45);
      const longId = `home-hero-${longQualifier}`;
      expect(longId.length).toBeGreaterThan(50);

      const result = SectionIdSchema.safeParse(longId);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('50 characters');
    });
  });

  describe('reserved pattern validation (security)', () => {
    it('rejects __proto__ pattern', () => {
      // Would pass regex but should fail reserved pattern check
      // Note: This ID format won't actually match the regex since it's not a valid qualifier
      // But we test the refine step in case regex changes
      const result = SectionIdSchema.safeParse('home-hero-__proto__');
      expect(result.success).toBe(false);
    });

    it('rejects constructor pattern', () => {
      const result = SectionIdSchema.safeParse('home-hero-constructor');
      expect(result.success).toBe(false);
    });

    it('rejects prototype pattern', () => {
      const result = SectionIdSchema.safeParse('home-hero-prototype');
      expect(result.success).toBe(false);
    });
  });
});

describe('isSectionWithId', () => {
  it('returns true for sections with valid IDs', () => {
    const section = { id: 'home-hero-main', type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(true);
  });

  it('returns false for sections without IDs', () => {
    const section = { type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(false);
  });

  it('returns false for sections with undefined ID', () => {
    const section = { id: undefined, type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(false);
  });

  it('returns false for sections with invalid ID format', () => {
    const section = { id: 'invalid-format', type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(false);
  });

  it('returns false for sections with non-string ID', () => {
    const section = { id: 123, type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section as { id?: string })).toBe(false);
  });

  it('narrows type correctly', () => {
    const section: { id?: string; type: string } = {
      id: 'home-hero-main',
      type: 'hero',
    };

    if (isSectionWithId(section)) {
      // TypeScript should know section.id is SectionId (string) here
      const id: string = section.id;
      expect(id).toBe('home-hero-main');
    } else {
      // Should not reach here
      expect.fail('Expected section to have valid ID');
    }
  });
});

describe('generateSectionId', () => {
  it('generates {page}-{type}-main for first section', () => {
    const id = generateSectionId('home', 'hero', new Set());
    expect(id).toBe('home-hero-main');
  });

  it('generates {page}-{type}-2 when main exists', () => {
    const existing = new Set(['home-hero-main']);
    const id = generateSectionId('home', 'hero', existing);
    expect(id).toBe('home-hero-2');
  });

  it('generates sequential numbers for additional sections', () => {
    const existing = new Set(['home-text-main', 'home-text-2']);
    const id = generateSectionId('home', 'text', existing);
    expect(id).toBe('home-text-3');
  });

  it('never reuses deleted IDs (monotonic)', () => {
    // Simulate: main exists, 2 was deleted, 3 exists
    const existing = new Set(['home-text-main', 'home-text-3']);
    const id = generateSectionId('home', 'text', existing);
    // Should be 4, not 2 (even though 2 is "available")
    expect(id).toBe('home-text-4');
  });

  it('handles large counter values', () => {
    const existing = new Set(['home-cta-main', 'home-cta-99']);
    const id = generateSectionId('home', 'cta', existing);
    expect(id).toBe('home-cta-100');
  });

  it('works for all valid page/type combinations', () => {
    const page: PageName = 'gallery';
    const type: SectionTypeName = 'gallery';
    const id = generateSectionId(page, type, new Set());
    expect(id).toBe('gallery-gallery-main');
    expect(SectionIdSchema.safeParse(id).success).toBe(true);
  });

  it('generated IDs always pass schema validation', () => {
    const existingIds = new Set<string>();

    // Generate several IDs for the same page/type
    for (let i = 0; i < 5; i++) {
      const id = generateSectionId('about', 'text', existingIds);
      expect(SectionIdSchema.safeParse(id).success).toBe(true);
      existingIds.add(id);
    }

    // Verify we got unique IDs
    expect(existingIds.size).toBe(5);
    expect(existingIds.has('about-text-main')).toBe(true);
    expect(existingIds.has('about-text-2')).toBe(true);
    expect(existingIds.has('about-text-3')).toBe(true);
    expect(existingIds.has('about-text-4')).toBe(true);
    expect(existingIds.has('about-text-5')).toBe(true);
  });

  it('handles mixed existing IDs correctly', () => {
    // Mix of main, numeric, and word qualifiers
    const existing = new Set([
      'home-hero-main',
      'home-hero-intro', // word qualifier
      'home-hero-5', // numeric
    ]);

    const id = generateSectionId('home', 'hero', existing);
    // Should be 6 (max numeric + 1)
    expect(id).toBe('home-hero-6');
  });
});

describe('constants', () => {
  it('PAGE_NAMES contains all expected pages', () => {
    expect(PAGE_NAMES).toContain('home');
    expect(PAGE_NAMES).toContain('about');
    expect(PAGE_NAMES).toContain('services');
    expect(PAGE_NAMES).toContain('faq');
    expect(PAGE_NAMES).toContain('contact');
    expect(PAGE_NAMES).toContain('gallery');
    expect(PAGE_NAMES).toContain('testimonials');
    expect(PAGE_NAMES.length).toBe(7);
  });

  it('SECTION_TYPES contains all expected types', () => {
    expect(SECTION_TYPES).toContain('hero');
    expect(SECTION_TYPES).toContain('text');
    expect(SECTION_TYPES).toContain('gallery');
    expect(SECTION_TYPES).toContain('testimonials');
    expect(SECTION_TYPES).toContain('faq');
    expect(SECTION_TYPES).toContain('contact');
    expect(SECTION_TYPES).toContain('cta');
    expect(SECTION_TYPES).toContain('pricing');
    expect(SECTION_TYPES).toContain('features');
    expect(SECTION_TYPES.length).toBe(9);
  });
});
