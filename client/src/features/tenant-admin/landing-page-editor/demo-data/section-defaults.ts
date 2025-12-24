/**
 * Section Default Content
 * Demo content used when a tenant first adds a section
 */

import type {
  HeroSectionConfig,
  SocialProofBarConfig,
  AboutSectionConfig,
  TestimonialsSectionConfig,
  AccommodationSectionConfig,
  GallerySectionConfig,
  FaqSectionConfig,
  FinalCtaSectionConfig,
} from '@macon/contracts';

export const SECTION_DEFAULTS = {
  hero: {
    headline: 'Welcome to Your Business',
    subheadline: 'Discover our amazing services and experiences',
    ctaText: 'Explore Our Offerings',
    backgroundImageUrl: undefined,
  } satisfies HeroSectionConfig,

  socialProofBar: {
    items: [
      { icon: 'star', text: '5-Star Rated' },
      { icon: 'users', text: '500+ Happy Clients' },
      { icon: 'calendar', text: 'Easy Booking' },
    ],
  } satisfies SocialProofBarConfig,

  about: {
    headline: 'About Us',
    content:
      'Tell your story here. What makes your business special? Share your passion, experience, and what clients can expect when they work with you.',
    imageUrl: undefined,
    imagePosition: 'right',
  } satisfies AboutSectionConfig,

  testimonials: {
    headline: 'What Our Customers Say',
    items: [
      {
        quote: 'Amazing experience! Highly recommended to anyone looking for quality service.',
        author: 'Happy Customer',
        role: 'Verified Client',
        imageUrl: undefined,
        rating: 5,
      },
    ],
  } satisfies TestimonialsSectionConfig,

  accommodation: {
    headline: 'Local Accommodations',
    description:
      'We partner with excellent local accommodations to make your stay comfortable and convenient.',
    imageUrl: undefined,
    ctaText: 'View Accommodations',
    ctaUrl: 'https://airbnb.com',
    highlights: ['Wifi', 'Free Parking', 'Pet Friendly'],
  } satisfies AccommodationSectionConfig,

  gallery: {
    headline: 'Our Gallery',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop',
        alt: 'Sample image 1',
      },
      {
        url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
        alt: 'Sample image 2',
      },
    ],
    instagramHandle: undefined,
  } satisfies GallerySectionConfig,

  faq: {
    headline: 'Frequently Asked Questions',
    items: [
      {
        question: 'How do I book?',
        answer:
          'Simply browse our offerings and click "Book Now" on any package that interests you. You can also contact us directly for custom arrangements.',
      },
      {
        question: 'What is your cancellation policy?',
        answer:
          'Contact us at least 48 hours before your appointment for a full refund. Late cancellations may be subject to a fee.',
      },
    ],
  } satisfies FaqSectionConfig,

  finalCta: {
    headline: 'Ready to Get Started?',
    subheadline: 'Book your experience today and discover something amazing',
    ctaText: 'Book Now',
  } satisfies FinalCtaSectionConfig,
} as const;

/**
 * Get default content for a section type
 */
export function getSectionDefault<T extends keyof typeof SECTION_DEFAULTS>(
  section: T
): (typeof SECTION_DEFAULTS)[T] {
  return SECTION_DEFAULTS[section];
}
