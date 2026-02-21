/**
 * Discovery Fact Keys - Shared Constants
 *
 * Valid keys for discovery facts stored during tenant onboarding.
 * These map to fields that get applied to the storefront.
 *
 * Centralized location for DISCOVERY_FACT_KEYS to prevent duplication
 * across backend routes and agent tools.
 *
 * Used by:
 * - server/src/routes/internal-agent-discovery.routes.ts
 * - server/src/agent-v2/deploy/tenant/src/tools/discovery.ts
 */

/**
 * Valid keys for discovery facts.
 * These map to fields that get applied to the storefront.
 */
export const DISCOVERY_FACT_KEYS = [
  'businessType',
  'businessName',
  'location',
  'targetMarket',
  'priceRange',
  'yearsInBusiness',
  'teamSize',
  'uniqueValue',
  'servicesOffered',
  'specialization',
  'approach',
  'dreamClient',
  'testimonial',
  'faq',
  'contactInfo',
  // Phase 4: Onboarding redesign — track segment/tier configuration progress
  'primarySegment',
  'tiersConfigured',
  // Onboarding redesign intake form (2026-02-20)
  'segmentDetails',
  'websiteUrl',
] as const;

export type DiscoveryFactKey = (typeof DISCOVERY_FACT_KEYS)[number];
