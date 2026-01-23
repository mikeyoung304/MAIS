/**
 * Feature Flags
 *
 * Runtime feature toggles for gradual rollouts and A/B testing.
 * Controlled via environment variables.
 *
 * IMPORTANT: Never commit `.env` files with feature flags enabled.
 * Document flag behavior in this file.
 */

/**
 * Enable context caching for Build Mode tools
 *
 * **What it does:**
 * - Pre-fetches draft config once per turn (instead of per-tool)
 * - Reduces database queries from 15+ to 3 per turn (80% reduction)
 * - Improves turn latency by ~60% (800ms → 320ms)
 *
 * **Rollback:**
 * Set `ENABLE_CONTEXT_CACHE=false` to instantly disable.
 * Tools will fall back to individual queries (previous behavior).
 *
 * **Requirements:**
 * - Post-T1 invalidation must be enabled (base-orchestrator.ts:1157)
 * - All storefront executors must return `updatedConfig`
 *
 * @default false (opt-in for safe rollout)
 */
export const ENABLE_CONTEXT_CACHE = process.env.ENABLE_CONTEXT_CACHE === 'true';

/**
 * Enable landing page config normalization
 *
 * **What it does:**
 * - Merges existing tenant configs with DEFAULT_PAGES_CONFIG to fill gaps
 * - Ensures legacy tenants get missing sections (About, Contact, etc.)
 * - Applied during read via normalizeToPages()
 *
 * **Rollback:**
 * Set `ENABLE_CONFIG_NORMALIZATION=false` to disable.
 * Tenants will see their raw config without default section merging.
 *
 * **Requirements:**
 * - Phase 4.3 normalizeToPages() changes must be deployed
 *
 * @default false (opt-in for safe rollout)
 */
export const ENABLE_CONFIG_NORMALIZATION = process.env.ENABLE_CONFIG_NORMALIZATION === 'true';

/**
 * Enable legacy section merge during normalization
 *
 * **What it does:**
 * - When ENABLE_CONFIG_NORMALIZATION is true, also merges default sections
 * - Adds missing sections from DEFAULT_PAGES_CONFIG to existing pages
 * - Preserves existing customizations, only adds what's missing
 *
 * **Rollback:**
 * Set `ENABLE_LEGACY_SECTION_MERGE=false` to disable merging.
 * Config normalization will still work but won't add missing sections.
 *
 * **Requirements:**
 * - ENABLE_CONFIG_NORMALIZATION must be true
 * - Phase 4.3 mergeSections() changes must be deployed
 *
 * @default false (opt-in for safe rollout)
 */
export const ENABLE_LEGACY_SECTION_MERGE = process.env.ENABLE_LEGACY_SECTION_MERGE === 'true';
