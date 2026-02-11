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
  SEED_PACKAGE_NAMES,
  TOTAL_SECTIONS,
} from './shared.js';
