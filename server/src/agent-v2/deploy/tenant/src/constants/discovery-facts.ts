/**
 * Discovery Fact Keys — Local Copy for Cloud Run Agent
 *
 * IMPORTANT: This is a local copy of server/src/shared/constants/discovery-facts.ts
 * Cloud Run agents cannot import from server internals (rootDir constraint).
 * Keep in sync with the canonical source. See CLAUDE.md Pitfall #18.
 *
 * Used by:
 * - tools/discovery.ts (store_discovery_fact, get_known_facts)
 * - tools/index.ts (re-export)
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
] as const;

export type DiscoveryFactKey = (typeof DISCOVERY_FACT_KEYS)[number];
