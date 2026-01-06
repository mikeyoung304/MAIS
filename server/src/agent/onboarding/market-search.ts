/**
 * Market Search Service
 *
 * Retrieves pricing benchmarks for businesses during onboarding.
 * Uses a fallback-first pattern to ensure data is always available.
 *
 * Architecture:
 * 1. Attempt web search for real-time market data (future enhancement)
 * 2. Fall back to industry benchmarks if web search fails
 * 3. Apply location-based cost-of-living adjustments
 * 4. Return standardized PricingBenchmarks with source attribution (Fix #6)
 *
 * The source enum ('web_search' | 'industry_benchmark' | 'mixed') replaces
 * the problematic isFallback boolean for clearer data provenance.
 */

import type {
  BusinessType,
  TargetMarket,
  PricingBenchmarks,
  MarketResearchData,
  MarketResearchSource,
  PricingTierRecommendation,
} from '@macon/contracts';
import { getIndustryBenchmarks, type IndustryBenchmarks } from './industry-benchmarks';
import { logger } from '../../lib/core/logger';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal benchmark data structure for COL adjustments
 */
export interface IndustryBenchmarkData {
  lowCents: number;
  medianCents: number;
  highCents: number;
  recommendedTiers: PricingTierRecommendation[];
}

// ============================================================================
// Types
// ============================================================================

export interface MarketSearchOptions {
  /** Business type for benchmark lookup */
  businessType: BusinessType;
  /** Target market segment */
  targetMarket: TargetMarket;
  /** City for location-specific adjustments */
  city?: string;
  /** State/province code */
  state?: string;
  /** Country code (default: US) */
  country?: string;
  /** Tenant ID for logging */
  tenantId: string;
  /** Skip web search, go straight to benchmarks (useful for testing) */
  skipWebSearch?: boolean;
}

export interface MarketSearchResult {
  success: true;
  data: MarketResearchData;
  source: MarketResearchSource;
}

export interface MarketSearchError {
  success: false;
  error: string;
  code: 'NO_DATA' | 'INVALID_INPUT' | 'SEARCH_FAILED';
}

export type MarketSearchResponse = MarketSearchResult | MarketSearchError;

// ============================================================================
// Cost of Living Adjustments
// ============================================================================

/**
 * Cost of living multipliers by state
 * Based on general COL indexes relative to national average (1.0)
 * Source: Bureau of Economic Analysis regional price parities
 */
const STATE_COL_MULTIPLIERS: Record<string, number> = {
  // High cost states (>1.1)
  CA: 1.25,
  NY: 1.2,
  MA: 1.18,
  HI: 1.22,
  DC: 1.15,
  WA: 1.12,
  NJ: 1.15,
  CT: 1.12,
  MD: 1.1,
  CO: 1.08,

  // Above average (1.0-1.1)
  OR: 1.05,
  AK: 1.08,
  NH: 1.05,
  VT: 1.04,
  RI: 1.05,
  IL: 1.02,
  MN: 1.02,
  VA: 1.03,
  AZ: 1.01,

  // Average (0.95-1.0)
  FL: 1.0,
  TX: 0.98,
  PA: 0.99,
  NC: 0.97,
  GA: 0.97,
  NV: 1.0,
  UT: 0.99,

  // Below average (<0.95)
  OH: 0.93,
  MI: 0.94,
  TN: 0.92,
  IN: 0.91,
  MO: 0.91,
  WI: 0.94,
  KY: 0.9,
  SC: 0.92,
  AL: 0.89,
  LA: 0.91,
  OK: 0.89,
  AR: 0.88,
  MS: 0.87,
  WV: 0.88,
  KS: 0.9,
  NE: 0.92,
  IA: 0.91,
  SD: 0.9,
  ND: 0.92,
  MT: 0.95,
  ID: 0.95,
  WY: 0.94,
  NM: 0.93,
};

/**
 * Get cost of living multiplier for a state
 */
function getCOLMultiplier(state?: string): number {
  if (!state) return 1.0;
  const normalized = state.toUpperCase().trim();
  return STATE_COL_MULTIPLIERS[normalized] ?? 1.0;
}

/**
 * Apply COL adjustment to pricing benchmarks
 */
function adjustBenchmarksForCOL(
  benchmarks: IndustryBenchmarkData,
  state?: string
): IndustryBenchmarkData {
  const multiplier = getCOLMultiplier(state);

  return {
    lowCents: Math.round(benchmarks.lowCents * multiplier),
    medianCents: Math.round(benchmarks.medianCents * multiplier),
    highCents: Math.round(benchmarks.highCents * multiplier),
    recommendedTiers: benchmarks.recommendedTiers.map((tier) => ({
      ...tier,
      suggestedPriceCents: Math.round(tier.suggestedPriceCents * multiplier),
      priceRangeLowCents: Math.round(tier.priceRangeLowCents * multiplier),
      priceRangeHighCents: Math.round(tier.priceRangeHighCents * multiplier),
    })),
  };
}

// ============================================================================
// Web Search (Future Enhancement)
// ============================================================================

/**
 * Attempt to get market data from web search
 *
 * This is a placeholder for future web search integration.
 * When implemented, it will:
 * 1. Search for "{businessType} pricing {city} {state}"
 * 2. Parse competitor websites for pricing info
 * 3. Aggregate and normalize results
 *
 * For now, always returns null to trigger fallback.
 */
async function attemptWebSearch(
  _options: MarketSearchOptions
): Promise<IndustryBenchmarkData | null> {
  // TODO: Implement web search in Phase 3
  // For now, always fall back to industry benchmarks
  return null;
}

/**
 * Target market multipliers
 * Adjusts base prices based on target market segment
 */
const TARGET_MARKET_MULTIPLIERS: Record<TargetMarket, number> = {
  luxury: 1.5,
  premium: 1.2,
  mid_range: 1.0,
  budget_friendly: 0.7,
  mixed: 1.0,
};

/**
 * Convert IndustryBenchmarks to IndustryBenchmarkData format
 * Also applies target market adjustments
 */
function industryBenchmarksToData(
  benchmarks: IndustryBenchmarks,
  targetMarket: TargetMarket
): IndustryBenchmarkData {
  const multiplier = TARGET_MARKET_MULTIPLIERS[targetMarket];

  return {
    lowCents: Math.round(benchmarks.marketLowCents * multiplier),
    medianCents: Math.round(benchmarks.marketMedianCents * multiplier),
    highCents: Math.round(benchmarks.marketHighCents * multiplier),
    recommendedTiers: benchmarks.recommendedTiers.map((tier) => ({
      ...tier,
      suggestedPriceCents: Math.round(tier.suggestedPriceCents * multiplier),
      priceRangeLowCents: Math.round(tier.priceRangeLowCents * multiplier),
      priceRangeHighCents: Math.round(tier.priceRangeHighCents * multiplier),
    })),
  };
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search for market pricing data
 *
 * Implements fallback-first pattern:
 * 1. Try web search if enabled
 * 2. Fall back to industry benchmarks
 * 3. Apply location-based adjustments
 * 4. Return standardized result with source attribution
 */
export async function searchMarketPricing(
  options: MarketSearchOptions
): Promise<MarketSearchResponse> {
  const { businessType, targetMarket, city, state, tenantId, skipWebSearch = false } = options;

  logger.debug({ tenantId, businessType, targetMarket, city, state }, 'Starting market search');

  let source: MarketResearchSource = 'industry_benchmark';
  let benchmarks: IndustryBenchmarkData | null = null;

  // Step 1: Try web search (unless skipped)
  if (!skipWebSearch) {
    try {
      const webResult = await attemptWebSearch(options);
      if (webResult) {
        benchmarks = webResult;
        source = 'web_search';
        logger.info({ tenantId, businessType, source }, 'Market data retrieved from web search');
      }
    } catch (error) {
      logger.warn(
        { tenantId, businessType, error: String(error) },
        'Web search failed, falling back to benchmarks'
      );
    }
  }

  // Step 2: Fall back to industry benchmarks
  if (!benchmarks) {
    try {
      const industryData = await getIndustryBenchmarks(businessType);
      benchmarks = industryBenchmarksToData(industryData, targetMarket);
      source = 'industry_benchmark';

      logger.info({ tenantId, businessType, source }, 'Using industry benchmark data');
    } catch (error) {
      logger.warn(
        { tenantId, businessType, targetMarket, error: String(error) },
        'No benchmark data available'
      );
      return {
        success: false,
        error: `No pricing data available for ${businessType} in ${targetMarket} market`,
        code: 'NO_DATA',
      };
    }
  }

  // Step 3: Apply location-based adjustments
  const adjustedBenchmarks = adjustBenchmarksForCOL(benchmarks, state);

  // Step 4: Build market research result
  const pricingBenchmarks: PricingBenchmarks = {
    source,
    marketLowCents: adjustedBenchmarks.lowCents,
    marketMedianCents: adjustedBenchmarks.medianCents,
    marketHighCents: adjustedBenchmarks.highCents,
    recommendedTiers: adjustedBenchmarks.recommendedTiers,
    dataFreshness: source === 'web_search' ? 'fresh' : 'fallback',
  };

  // Generate market insights
  const insights: string[] = [
    `${formatBusinessType(businessType)} services in the ${formatTargetMarket(targetMarket)} market typically range from ${formatPrice(adjustedBenchmarks.lowCents)} to ${formatPrice(adjustedBenchmarks.highCents)}.`,
    `The median price point is ${formatPrice(adjustedBenchmarks.medianCents)}.`,
  ];

  if (state) {
    const multiplier = getCOLMultiplier(state);
    if (multiplier > 1.05) {
      insights.push(
        `Prices adjusted +${Math.round((multiplier - 1) * 100)}% for ${state}'s higher cost of living.`
      );
    } else if (multiplier < 0.95) {
      insights.push(
        `Prices adjusted ${Math.round((multiplier - 1) * 100)}% for ${state}'s lower cost of living.`
      );
    }
  }

  if (adjustedBenchmarks.recommendedTiers.length > 0) {
    insights.push(
      `Recommended ${adjustedBenchmarks.recommendedTiers.length} pricing tiers: ${adjustedBenchmarks.recommendedTiers.map((t) => t.name).join(', ')}.`
    );
  }

  const marketResearch: MarketResearchData = {
    pricingBenchmarks,
    marketInsights: insights,
    researchCompletedAt: new Date().toISOString(),
  };

  return {
    success: true,
    data: marketResearch,
    source,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format price in dollars
 */
function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format business type for display
 */
function formatBusinessType(type: BusinessType): string {
  const mapping: Record<BusinessType, string> = {
    photographer: 'Photography',
    videographer: 'Videography',
    wedding_planner: 'Wedding planning',
    florist: 'Floral design',
    caterer: 'Catering',
    dj: 'DJ',
    officiant: 'Officiant',
    makeup_artist: 'Makeup artistry',
    hair_stylist: 'Hair styling',
    event_designer: 'Event design',
    venue: 'Venue',
    coach: 'Coaching',
    therapist: 'Therapy',
    consultant: 'Consulting',
    wellness_practitioner: 'Wellness',
    personal_trainer: 'Personal training',
    tutor: 'Tutoring',
    music_instructor: 'Music instruction',
    other: 'Service',
  };
  return mapping[type] || 'Service';
}

/**
 * Format target market for display
 */
function formatTargetMarket(market: TargetMarket): string {
  const mapping: Record<TargetMarket, string> = {
    luxury: 'luxury',
    premium: 'premium',
    mid_range: 'mid-range',
    budget_friendly: 'budget-friendly',
    mixed: 'mixed',
  };
  return mapping[market] || 'general';
}

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Get market research with all defaults
 * Convenience wrapper for common use case
 */
export async function getMarketResearch(
  tenantId: string,
  businessType: BusinessType,
  targetMarket: TargetMarket,
  location?: { city?: string; state?: string }
): Promise<MarketSearchResponse> {
  return searchMarketPricing({
    tenantId,
    businessType,
    targetMarket,
    city: location?.city,
    state: location?.state,
  });
}
