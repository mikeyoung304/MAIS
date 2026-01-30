/**
 * Section Content Schema Tests
 *
 * Unit tests for all SectionContent block type schemas.
 * Tests discriminated union and individual block content validation.
 *
 * @see packages/contracts/src/schemas/section-content.schema.ts
 */

import { describe, it, expect } from 'vitest';
import {
  BlockTypeSchema,
  HeroContentSchema,
  AboutContentSchema,
  TestimonialsContentSchema,
  FaqContentSchema,
  ContactContentSchema,
  SectionContentSchema,
  validateBlockContent,
} from '@macon/contracts';

describe('BlockTypeSchema', () => {
  it('should accept all valid block types', () => {
    const validTypes = [
      'HERO',
      'ABOUT',
      'SERVICES',
      'PRICING',
      'TESTIMONIALS',
      'FAQ',
      'CONTACT',
      'CTA',
      'GALLERY',
      'CUSTOM',
    ];

    for (const type of validTypes) {
      const result = BlockTypeSchema.safeParse(type);
      expect(result.success, `Expected ${type} to be valid`).toBe(true);
    }
  });

  it('should reject invalid block type', () => {
    const result = BlockTypeSchema.safeParse('INVALID');
    expect(result.success).toBe(false);
  });
});

describe('HeroContentSchema', () => {
  it('should validate a complete hero section', () => {
    const result = HeroContentSchema.safeParse({
      visible: true,
      headline: 'Welcome to My Business',
      subheadline: 'Professional services',
      ctaText: 'Get Started',
      ctaLink: 'https://example.com/book',
      backgroundImage: 'https://example.com/hero.jpg',
      alignment: 'center',
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for optional fields', () => {
    const result = HeroContentSchema.safeParse({
      headline: 'Minimal Hero',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visible).toBe(true);
      expect(result.data.alignment).toBe('center');
    }
  });

  it('should reject headline over 100 characters', () => {
    const result = HeroContentSchema.safeParse({
      headline: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid ctaLink URL', () => {
    const result = HeroContentSchema.safeParse({
      headline: 'Test',
      ctaLink: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('AboutContentSchema', () => {
  it('should validate a complete about section', () => {
    const result = AboutContentSchema.safeParse({
      visible: true,
      title: 'About Me',
      body: 'I am a professional photographer with 10 years of experience.',
      image: 'https://example.com/profile.jpg',
      imagePosition: 'right',
    });
    expect(result.success).toBe(true);
  });

  it('should reject body over 2000 characters', () => {
    const result = AboutContentSchema.safeParse({
      title: 'About',
      body: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('TestimonialsContentSchema', () => {
  it('should validate testimonials with items', () => {
    const result = TestimonialsContentSchema.safeParse({
      visible: true,
      title: 'What Clients Say',
      items: [
        {
          id: 'test-id-1',
          name: 'John Doe',
          role: 'Happy Client',
          quote: 'Amazing service!',
          rating: 5,
        },
        {
          id: 'test-id-2',
          name: 'Jane Smith',
          quote: 'Would recommend to everyone.',
        },
      ],
      layout: 'grid',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });

  it('should reject more than 20 testimonials', () => {
    const items = Array(21)
      .fill(null)
      .map((_, i) => ({
        id: `id-${i}`,
        name: `Person ${i}`,
        quote: 'Great!',
      }));
    const result = TestimonialsContentSchema.safeParse({
      title: 'Reviews',
      items,
      layout: 'grid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid rating', () => {
    const result = TestimonialsContentSchema.safeParse({
      title: 'Reviews',
      items: [
        {
          id: 'test-id',
          name: 'Test',
          quote: 'Test',
          rating: 6, // Invalid - max is 5
        },
      ],
      layout: 'grid',
    });
    expect(result.success).toBe(false);
  });
});

describe('FaqContentSchema', () => {
  it('should validate FAQ section', () => {
    const result = FaqContentSchema.safeParse({
      visible: true,
      title: 'Frequently Asked Questions',
      items: [
        {
          id: 'faq-1',
          question: 'How do I book?',
          answer: 'Visit our booking page and select your preferred time.',
        },
        {
          id: 'faq-2',
          question: 'What is your cancellation policy?',
          answer: 'We offer full refunds up to 48 hours before the appointment.',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });

  it('should reject more than 30 FAQs', () => {
    const items = Array(31)
      .fill(null)
      .map((_, i) => ({
        id: `faq-${i}`,
        question: `Question ${i}?`,
        answer: `Answer ${i}`,
      }));
    const result = FaqContentSchema.safeParse({
      title: 'FAQs',
      items,
    });
    expect(result.success).toBe(false);
  });
});

describe('ContactContentSchema', () => {
  it('should validate contact section', () => {
    const result = ContactContentSchema.safeParse({
      visible: true,
      title: 'Contact Us',
      email: 'hello@example.com',
      phone: '+1-555-123-4567',
      showForm: true,
      formFields: ['name', 'email', 'message'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = ContactContentSchema.safeParse({
      title: 'Contact',
      email: 'not-an-email',
      showForm: true,
      formFields: ['name', 'email'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid form field', () => {
    const result = ContactContentSchema.safeParse({
      title: 'Contact',
      showForm: true,
      formFields: ['name', 'invalid_field'],
    });
    expect(result.success).toBe(false);
  });
});

describe('SectionContentSchema (discriminated union)', () => {
  it('should validate HERO content', () => {
    const result = SectionContentSchema.safeParse({
      blockType: 'HERO',
      content: {
        headline: 'Welcome',
        alignment: 'center',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate ABOUT content', () => {
    const result = SectionContentSchema.safeParse({
      blockType: 'ABOUT',
      content: {
        title: 'About Me',
        body: 'My story...',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatched blockType and content', () => {
    // HERO blockType with ABOUT content structure
    const result = SectionContentSchema.safeParse({
      blockType: 'HERO',
      content: {
        title: 'About Me', // This is ABOUT content, not HERO
        body: 'My story...',
      },
    });
    // This should fail because HERO requires headline, not title/body
    expect(result.success).toBe(false);
  });

  it('should reject unknown blockType', () => {
    const result = SectionContentSchema.safeParse({
      blockType: 'UNKNOWN',
      content: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('validateBlockContent helper', () => {
  it('should validate HERO content correctly', () => {
    const result = validateBlockContent('HERO', {
      headline: 'Test',
      alignment: 'left',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid HERO content', () => {
    const result = validateBlockContent('HERO', {
      // Missing required headline
      alignment: 'center',
    });
    expect(result.success).toBe(false);
  });

  it('should validate CONTACT content correctly', () => {
    const result = validateBlockContent('CONTACT', {
      title: 'Get in Touch',
      showForm: true,
      formFields: ['name', 'email'],
    });
    expect(result.success).toBe(true);
  });
});
