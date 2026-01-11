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
