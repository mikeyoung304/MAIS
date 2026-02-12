/**
 * Constants barrel export for tenant agent.
 *
 * Cloud Run rootDir constraint prevents importing from @macon/contracts
 * or server/src/shared/. These are manually synced copies.
 */

export { DISCOVERY_FACT_KEYS, type DiscoveryFactKey } from './discovery-facts.js';
export {
  MVP_SECTION_TYPES,
  PAGE_NAMES,
  SECTION_TYPES,
  TOTAL_SECTIONS,
  MAX_SEGMENTS_PER_TENANT,
  MAX_TIERS_PER_SEGMENT,
} from './shared.js';
