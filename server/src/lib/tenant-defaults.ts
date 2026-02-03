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
export const DEFAULT_PACKAGE_TIERS = {
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

/** Type for accessing package tier keys */
export type PackageTierKey = keyof typeof DEFAULT_PACKAGE_TIERS;

/** Type for a single package tier configuration */
export type PackageTierConfig = (typeof DEFAULT_PACKAGE_TIERS)[PackageTierKey];

// ============================================
// Semantic Storefront Defaults
// ============================================

import type { TierLevel, TierFeatures } from '@macon/contracts';
import type { BlockType } from '../generated/prisma/client';

/**
 * Default Tier configurations for the 3-tier pricing ontology
 * Every segment gets exactly 3 tiers: GOOD, BETTER, BEST
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */
export const DEFAULT_TIER_CONFIGS: Record<
  TierLevel,
  {
    name: string;
    description: string;
    price: number;
    features: TierFeatures;
  }
> = {
  GOOD: {
    name: 'Essential',
    description: 'Perfect for getting started',
    price: 0,
    features: [
      { text: 'Basic service package', highlighted: false },
      { text: 'Email support', highlighted: false },
      { text: 'Standard timeline', highlighted: false },
    ],
  },
  BETTER: {
    name: 'Professional',
    description: 'Our most popular option',
    price: 0,
    features: [
      { text: 'Enhanced service package', highlighted: true },
      { text: 'Priority email support', highlighted: false },
      { text: 'Expedited timeline', highlighted: false },
      { text: 'One revision included', highlighted: false },
    ],
  },
  BEST: {
    name: 'Premium',
    description: 'The complete experience',
    price: 0,
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
      visible: true,
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
      visible: true,
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
