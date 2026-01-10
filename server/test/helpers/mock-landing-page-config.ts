/**
 * Mock Landing Page Configuration for Tests
 *
 * IMPORTANT: This file exists because DEFAULT_PAGES_CONFIG from @macon/contracts
 * contains intentionally long placeholder text designed for user guidance,
 * NOT schema compliance.
 *
 * Example placeholder (72 chars, but schema max is 60):
 *   "[Your Transformation Headline - what change do you create for clients?]"
 *
 * When tests use DEFAULT_PAGES_CONFIG and the data goes through Zod validation
 * (via LandingPageService, getDraftConfigWithSlug, etc.), validation fails
 * and hasDraft returns false, breaking test expectations.
 *
 * SOLUTION: Use VALID_MOCK_PAGES_CONFIG for tests that need schema-compliant data.
 *
 * WHEN TO USE WHICH:
 * - DEFAULT_PAGES_CONFIG: When testing defaults/fallback behavior
 * - VALID_MOCK_PAGES_CONFIG: When testing draft detection, publish flow, or any
 *   path that validates config through Zod schemas
 */

import type { PagesConfig, LandingPageConfig } from '@macon/contracts';

/**
 * Schema-compliant pages configuration for tests.
 *
 * All text fields are within schema max lengths:
 * - headline: max 60 chars
 * - ctaText: max 30 chars
 * - content: max 2000 chars
 * - quote: max 300 chars
 * - etc.
 */
export const VALID_MOCK_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      {
        id: 'home-hero-main',
        type: 'hero',
        headline: 'Welcome to Our Studio',
        subheadline: 'Professional services for all your needs',
        ctaText: 'Book Now',
      },
      {
        id: 'home-text-about',
        type: 'text',
        headline: 'About Us',
        content: 'We are a professional service provider dedicated to excellence.',
        imagePosition: 'right',
      },
      {
        id: 'home-testimonials-main',
        type: 'testimonials',
        headline: 'What Clients Say',
        items: [
          {
            quote: 'Excellent service! Highly recommend.',
            authorName: 'Jane Smith',
            authorRole: 'Happy Customer',
            rating: 5,
          },
          {
            quote: 'Professional and reliable.',
            authorName: 'John Doe',
            rating: 5,
          },
        ],
      },
      {
        id: 'home-faq-main',
        type: 'faq',
        headline: 'Frequently Asked Questions',
        items: [
          {
            question: 'What are your hours?',
            answer: 'We are open Monday to Friday, 9am to 5pm.',
          },
          {
            question: 'How do I book?',
            answer: 'Click the Book Now button to schedule an appointment.',
          },
        ],
      },
      {
        id: 'home-contact-main',
        type: 'contact',
        headline: 'Get in Touch',
        email: 'hello@example.com',
        phone: '5550123',
        hours: 'Mon-Fri 9am-5pm',
      },
      {
        id: 'home-cta-main',
        type: 'cta',
        headline: 'Ready to Get Started?',
        subheadline: 'Book your consultation today.',
        ctaText: 'Schedule Now',
      },
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        id: 'about-text-main',
        type: 'text',
        headline: 'Our Story',
        content:
          'Founded with a passion for excellence, we have been serving our community for years.',
        imagePosition: 'left',
      },
    ],
  },
  services: {
    enabled: true,
    sections: [],
  },
  faq: {
    enabled: true,
    sections: [],
  },
  contact: {
    enabled: true,
    sections: [],
  },
  gallery: {
    enabled: false,
    sections: [],
  },
  testimonials: {
    enabled: false,
    sections: [],
  },
};

/**
 * Complete landing page config wrapper for tests.
 * Use when you need a full LandingPageConfig object.
 */
export const VALID_MOCK_LANDING_PAGE_CONFIG: LandingPageConfig = {
  pages: VALID_MOCK_PAGES_CONFIG,
};
