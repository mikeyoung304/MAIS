/**
 * Tenant Default Configuration
 *
 * Shared constants for tenant provisioning and onboarding.
 * Used to ensure consistency when creating new tenants.
 *
 * @see TenantProvisioningService - Atomic tenant creation
 * @see TenantOnboardingService - Post-signup default data
 */

/**
 * Default segment configuration for new tenants
 * Every tenant starts with a "General" segment to organize their packages
 */
export const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

/**
 * Default pricing tier configurations
 * Guides users toward a 3-tier pricing structure (Good/Better/Best pattern)
 *
 * All prices start at 0 - tenants customize their own pricing
 */
export const DEFAULT_TIERS = {
  BASIC: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Your starter option - perfect for budget-conscious clients',
    basePrice: 0,
    groupingOrder: 1,
  },
  STANDARD: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Our most popular option - great value for most clients',
    basePrice: 0,
    groupingOrder: 2,
  },
  PREMIUM: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'The full experience - for clients who want the best',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;

/** Type for accessing default tier keys */
export type DefaultTierKey = keyof typeof DEFAULT_TIERS;

/** Type for a single default tier configuration */
export type DefaultTierConfig = (typeof DEFAULT_TIERS)[DefaultTierKey];

// ============================================
// Semantic Storefront Defaults
// ============================================

import type { TierFeatures } from '@macon/contracts';
import type { BlockType } from '../generated/prisma/client';

/**
 * Default Tier configurations by sortOrder (1=entry, 2=mid, 3=premium)
 * Every segment gets 3 tiers on provisioning.
 * sortOrder replaces the old TierLevel enum for flexible pricing structures.
 */
export const DEFAULT_TIER_CONFIGS: Record<
  number,
  {
    slug: string;
    name: string;
    description: string;
    priceCents: number;
    features: TierFeatures;
  }
> = {
  1: {
    slug: 'essential',
    name: 'Essential',
    description: 'Perfect for getting started',
    priceCents: 0,
    features: [
      { text: 'Basic service package', highlighted: false },
      { text: 'Email support', highlighted: false },
      { text: 'Standard timeline', highlighted: false },
    ],
  },
  2: {
    slug: 'professional',
    name: 'Professional',
    description: 'Our most popular option',
    priceCents: 0,
    features: [
      { text: 'Enhanced service package', highlighted: true },
      { text: 'Priority email support', highlighted: false },
      { text: 'Expedited timeline', highlighted: false },
      { text: 'One revision included', highlighted: false },
    ],
  },
  3: {
    slug: 'premium',
    name: 'Premium',
    description: 'The complete experience',
    priceCents: 0,
    features: [
      { text: 'Premium service package', highlighted: true },
      { text: 'Dedicated support', highlighted: true },
      { text: 'Rush timeline available', highlighted: false },
      { text: 'Unlimited revisions', highlighted: false },
      { text: 'Priority booking', highlighted: false },
    ],
  },
};

/**
 * Default SectionContent for new tenants
 * Creates starter content for each block type
 */
export const DEFAULT_SECTION_CONTENT: Record<
  BlockType,
  { order: number; content: Record<string, unknown> }
> = {
  HERO: {
    order: 0,
    content: {
      visible: true,
      headline: 'Welcome to My Business',
      subheadline: 'Professional services tailored to your needs',
      ctaText: 'Get Started',
      alignment: 'center',
    },
  },
  ABOUT: {
    order: 1,
    content: {
      visible: true,
      title: 'About Me',
      body: 'Share your story, experience, and passion here. Help potential clients understand who you are and why they should work with you.',
      imagePosition: 'right',
    },
  },
  SERVICES: {
    order: 2,
    content: {
      visible: true,
      title: 'Our Services',
      subtitle: 'What we offer',
      layout: 'cards',
      showPricing: true,
    },
  },
  PRICING: {
    order: 3,
    content: {
      visible: false, // Hidden until services + tiers ready (reveal MVP scoping)
      title: 'Pricing',
      subtitle: 'Choose the package that fits your needs',
      showComparison: true,
      highlightedTier: 'BETTER',
    },
  },
  TESTIMONIALS: {
    order: 4,
    content: {
      visible: false, // Start hidden until testimonials are added
      title: 'What Clients Say',
      items: [],
      layout: 'grid',
    },
  },
  FAQ: {
    order: 5,
    content: {
      visible: false, // Start hidden until FAQs are added
      title: 'Frequently Asked Questions',
      items: [],
    },
  },
  CONTACT: {
    order: 6,
    content: {
      visible: false, // Hidden until agent gathers contact info (reveal MVP scoping)
      title: 'Get in Touch',
      showForm: true,
      formFields: ['name', 'email', 'message'],
    },
  },
  CTA: {
    order: 7,
    content: {
      visible: false, // Optional section
      headline: 'Ready to Get Started?',
      subheadline: 'Book your session today',
      buttonText: 'Book Now',
      style: 'primary',
    },
  },
  GALLERY: {
    order: 8,
    content: {
      visible: false, // Start hidden until gallery items are added
      title: 'Portfolio',
      items: [],
      columns: 3,
    },
  },
  FEATURES: {
    order: 9,
    content: {
      visible: false, // Optional section for feature highlights
      title: 'Features',
      items: [],
      layout: 'grid',
    },
  },
  CUSTOM: {
    order: 10,
    content: {
      visible: false,
    },
  },
};
