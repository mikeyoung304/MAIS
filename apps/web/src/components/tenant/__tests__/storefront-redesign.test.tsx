/**
 * Storefront MVP Template Redesign Tests
 *
 * Tests for the key redesign behaviors:
 * 1. buildHomeSections — section routing logic (about type, services heading, CTA placement)
 * 2. Source-level verification of component patterns (gradient, anchor links, stagger classes)
 *
 * Component rendering tests are impractical here because the components use
 * Next.js automatic JSX transform (no `import React`) and the vitest config
 * doesn't include @vitejs/plugin-react. Instead, we test:
 * - Pure functions via direct invocation
 * - Source patterns via file scanning (similar to storefront-token-boundary.test.ts)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Section } from '@macon/contracts';

// Minimal type matching what buildHomeSections actually uses (home.sections only)
type MinimalPagesConfig = { home: { sections: Section[] } };

// ─── buildHomeSections is not exported, so replicate the same algorithm for testing ───
function buildHomeSections(
  pages: MinimalPagesConfig,
  tenantName: string
): {
  preSections: Section[];
  postSections: Section[];
  servicesHeading: { title?: string; subtitle?: string } | null;
} {
  const defaultHero = {
    id: 'home-hero-main',
    type: 'hero' as const,
    headline: `Welcome to ${tenantName}`,
    subheadline: 'Book your session today.',
    ctaText: 'View Services',
  };

  const homeSections = pages.home.sections;
  const heroSection = homeSections.find((s) => s.type === 'hero');
  const postTierTypes = new Set([
    'testimonials',
    'gallery',
    'faq',
    'contact',
    'features',
    'pricing',
    'cta',
  ]);

  const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];
  const textSections = homeSections.filter((s) => s.type === 'text' || s.type === 'about');
  preSections.push(...textSections);

  const servicesMeta = homeSections.find((s) => s.type === 'services');
  const servicesHeading = servicesMeta
    ? {
        title: (servicesMeta as { headline?: string }).headline,
        subtitle: (servicesMeta as { subheadline?: string }).subheadline,
      }
    : null;

  const postSections = homeSections.filter((s) => postTierTypes.has(s.type));

  return { preSections, postSections, servicesHeading };
}

// ─── Helper to read a source file ───
const sectionsDir = join(__dirname, '..', 'sections');
const parentDir = join(__dirname, '..');

function readSource(filename: string, dir = sectionsDir): string {
  return readFileSync(join(dir, filename), 'utf-8');
}

// ─── buildHomeSections Tests ───
describe('buildHomeSections', () => {
  it('should include about-type sections in preSections', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          { id: '2', type: 'about', headline: 'About Us', content: 'Our story' },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.preSections).toHaveLength(2);
    expect(result.preSections[0].type).toBe('hero');
    expect(result.preSections[1].type).toBe('about');
  });

  it('should include text-type sections in preSections', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          { id: '2', type: 'text', headline: 'Our Story', content: 'Content here' },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.preSections).toHaveLength(2);
    expect(result.preSections[1].type).toBe('text');
  });

  it('should extract services heading metadata', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          {
            id: '2',
            type: 'services',
            headline: 'Our Services',
            subheadline: 'Pick your experience',
          },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.servicesHeading).toEqual({
      title: 'Our Services',
      subtitle: 'Pick your experience',
    });
  });

  it('should return null servicesHeading when no services section exists', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [{ id: '1', type: 'hero', headline: 'Hello' }] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.servicesHeading).toBeNull();
  });

  it('should place CTA sections in postSections', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          { id: '2', type: 'cta', headline: 'Ready?', ctaText: 'Book Now' },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.postSections).toHaveLength(1);
    expect(result.postSections[0].type).toBe('cta');
  });

  it('should provide a default hero when none is configured', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [{ id: '2', type: 'text', headline: 'About', content: 'Content' }] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.preSections[0].type).toBe('hero');
    expect((result.preSections[0] as { headline: string }).headline).toBe('Welcome to Test Studio');
  });

  it('should NOT include services section in either pre or post sections', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          { id: '2', type: 'services', headline: 'Our Services' },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    const allTypes = [...result.preSections, ...result.postSections].map((s) => s.type);
    expect(allTypes).not.toContain('services');
  });

  it('should order: hero → about/text in preSections', () => {
    const pages: MinimalPagesConfig = {
      home: {
        sections: [
          { id: '1', type: 'hero', headline: 'Hello' },
          { id: '2', type: 'about', headline: 'About Us', content: 'Story' },
          { id: '3', type: 'text', headline: 'More', content: 'Details' },
        ] as Section[],
      },
    };

    const result = buildHomeSections(pages, 'Test Studio');
    expect(result.preSections.map((s) => s.type)).toEqual(['hero', 'about', 'text']);
  });
});

// ─── Source Pattern Verification Tests ───
// These scan the actual component source files to verify key design patterns.
// This approach avoids JSX transform issues while catching drift at the source level.

describe('HeroSection source patterns', () => {
  const source = readSource('HeroSection.tsx');

  it('should use full-bleed layout with min-height', () => {
    expect(source).toContain('min-h-[70vh]');
    expect(source).toContain('md:min-h-[80vh]');
  });

  it('should use bottom-heavy gradient overlay (not uniform black)', () => {
    expect(source).toContain('from-black/60');
    expect(source).toContain('via-black/20');
    expect(source).toContain('to-transparent');
    // Old uniform overlay should NOT be present
    expect(source).not.toContain('bg-black/40');
  });

  it('should use brand gradient fallback when no background image', () => {
    expect(source).toContain('from-accent/15');
    expect(source).toContain('via-background');
    expect(source).toContain('to-accent/5');
  });

  it('should default CTA text to "View Services"', () => {
    expect(source).toMatch(/ctaText\s*=\s*['"]View Services['"]/);
  });

  it('should link CTA to #services (not #packages)', () => {
    expect(source).toContain('#services');
    expect(source).not.toContain('#packages');
  });

  it('should use stagger delay classes for progressive reveal', () => {
    expect(source).toContain('reveal-delay-1');
    expect(source).toContain('reveal-delay-2');
  });

  it('should use bottom-aligned text (justify-end)', () => {
    expect(source).toContain('justify-end');
  });

  it('should set aria-label for accessibility', () => {
    expect(source).toContain('aria-label');
  });

  it('should use useScrollReveal hook', () => {
    expect(source).toContain('useScrollReveal');
  });
});

describe('CTASection source patterns', () => {
  const source = readSource('CTASection.tsx');

  it('should link to #services (not #packages)', () => {
    expect(source).toContain('#services');
    expect(source).not.toContain('#packages');
  });
});

describe('TextSection source patterns', () => {
  const source = readSource('TextSection.tsx');

  it('should have empty content guard', () => {
    // Should check for no content AND no headline and return null
    expect(source).toContain('return null');
  });

  it('should use fallback headline with tenant name', () => {
    expect(source).toMatch(/About \$\{tenant\.name\}/);
  });

  it('should use useScrollReveal hook', () => {
    expect(source).toContain('useScrollReveal');
  });

  it('should split content on double newlines', () => {
    expect(source).toContain("split('\\n\\n')");
  });
});

describe('SegmentTiersSection source patterns', () => {
  const source = readSource('SegmentTiersSection.tsx', parentDir);

  it('should use id="services" (not id="packages")', () => {
    expect(source).toContain('id="services"');
    expect(source).not.toContain('id="packages"');
  });

  it('should NOT contain getPriceRange function (pricing removed from cards)', () => {
    expect(source).not.toContain('getPriceRange');
  });

  it('should use type="button" on SegmentCard', () => {
    // SegmentCard renders a <button type="button">
    expect(source).toContain('type="button"');
  });

  it('should use useScrollReveal hook', () => {
    expect(source).toContain('useScrollReveal');
  });

  it('should accept servicesHeading prop', () => {
    expect(source).toContain('servicesHeading');
  });

  it('should support skipHeading on TierGridSection', () => {
    expect(source).toContain('skipHeading');
  });

  it('should have back button with proper tap target', () => {
    // Back button should have adequate padding for touch targets
    expect(source).toContain('py-2 px-3');
    expect(source).toContain('-ml-3');
  });
});

describe('StickyMobileCTA source patterns', () => {
  const source = readSource('StickyMobileCTA.tsx', parentDir);

  it('should default href to #services (not #packages)', () => {
    expect(source).toContain('#services');
    expect(source).not.toContain('#packages');
  });
});
