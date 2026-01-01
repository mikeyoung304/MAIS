/**
 * Onboarding Agent Schemas
 *
 * Type-safe schemas for the agent-powered tenant onboarding system.
 * Uses Zod discriminated unions for compile-time type safety (Kieran Fix #1).
 *
 * Architecture:
 * - Discriminated unions ensure phase/data type alignment
 * - Event payloads validated at runtime with Zod.parse()
 * - Tool input/output schemas for MCP tool integration
 */

import { z } from 'zod';

// ============================================================================
// Onboarding Phases
// ============================================================================

/**
 * Onboarding phase enum - matches Prisma OnboardingPhase
 */
export const OnboardingPhaseSchema = z.enum([
  'NOT_STARTED',
  'DISCOVERY',
  'MARKET_RESEARCH',
  'SERVICES',
  'MARKETING',
  'COMPLETED',
  'SKIPPED',
]);

export type OnboardingPhase = z.infer<typeof OnboardingPhaseSchema>;

/**
 * Safely parse an unknown value to OnboardingPhase
 * Returns 'NOT_STARTED' if value is invalid or null/undefined
 *
 * Prevents unsafe `as OnboardingPhase` type assertions throughout the codebase.
 */
export function parseOnboardingPhase(value: unknown): OnboardingPhase {
  const result = OnboardingPhaseSchema.safeParse(value);
  return result.success ? result.data : 'NOT_STARTED';
}

// ============================================================================
// Business Type and Industry
// ============================================================================

/**
 * Supported business types for onboarding
 * Used for industry benchmark lookups and pricing recommendations
 */
export const BusinessTypeSchema = z.enum([
  'photographer',
  'videographer',
  'wedding_planner',
  'florist',
  'caterer',
  'dj',
  'officiant',
  'makeup_artist',
  'hair_stylist',
  'event_designer',
  'venue',
  'coach',
  'therapist',
  'consultant',
  'wellness_practitioner',
  'personal_trainer',
  'tutor',
  'music_instructor',
  'other',
]);

export type BusinessType = z.infer<typeof BusinessTypeSchema>;

/**
 * Target market schema
 */
export const TargetMarketSchema = z.enum([
  'luxury',
  'premium',
  'mid_range',
  'budget_friendly',
  'mixed',
]);

export type TargetMarket = z.infer<typeof TargetMarketSchema>;

// ============================================================================
// Phase Data Schemas (Discriminated Union Components)
// ============================================================================

/**
 * Discovery phase data - initial business information
 */
export const DiscoveryDataSchema = z.object({
  businessType: BusinessTypeSchema,
  businessName: z.string().min(2).max(100),
  location: z.object({
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(50),
    country: z.string().default('US'),
  }),
  targetMarket: TargetMarketSchema,
  yearsInBusiness: z.number().int().min(0).max(100).optional(),
  currentAveragePrice: z.number().int().min(0).optional(), // In cents
  servicesOffered: z.array(z.string()).optional(),
});

export type DiscoveryData = z.infer<typeof DiscoveryDataSchema>;

/**
 * Market research source - tracks data provenance (Fix #6: no isFallback)
 */
export const MarketResearchSourceSchema = z.enum(['web_search', 'industry_benchmark', 'mixed']);

export type MarketResearchSource = z.infer<typeof MarketResearchSourceSchema>;

/**
 * Pricing tier recommendation from market research
 */
export const PricingTierRecommendationSchema = z.object({
  name: z.string(),
  description: z.string(),
  suggestedPriceCents: z.number().int().min(0),
  priceRangeLowCents: z.number().int().min(0),
  priceRangeHighCents: z.number().int().min(0),
  includedServices: z.array(z.string()),
});

export type PricingTierRecommendation = z.infer<typeof PricingTierRecommendationSchema>;

/**
 * Pricing benchmarks from market research
 */
export const PricingBenchmarksSchema = z.object({
  source: MarketResearchSourceSchema,
  marketLowCents: z.number().int().min(0),
  marketMedianCents: z.number().int().min(0),
  marketHighCents: z.number().int().min(0),
  recommendedTiers: z.array(PricingTierRecommendationSchema).min(1).max(5),
  competitorCount: z.number().int().min(0).optional(),
  dataFreshness: z.enum(['fresh', 'cached', 'fallback']),
});

export type PricingBenchmarks = z.infer<typeof PricingBenchmarksSchema>;

/**
 * Market research phase data
 */
export const MarketResearchDataSchema = z.object({
  pricingBenchmarks: PricingBenchmarksSchema,
  marketInsights: z.array(z.string()).optional(),
  competitorNames: z.array(z.string()).optional(),
  researchCompletedAt: z.string().datetime(),
});

export type MarketResearchData = z.infer<typeof MarketResearchDataSchema>;

/**
 * Helper: Check if market research used fallback data
 * (Fix #6: Use source enum instead of isFallback boolean)
 */
export function isMarketResearchFallback(data: MarketResearchData): boolean {
  return data.pricingBenchmarks.source === 'industry_benchmark';
}

/**
 * Service configuration from onboarding
 */
export const ServiceConfigSchema = z.object({
  segmentName: z.string(),
  segmentSlug: z.string(),
  packages: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      priceCents: z.number().int().min(0),
      groupingOrder: z.number().int().min(0),
    })
  ),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

/**
 * Services phase data
 */
export const ServicesDataSchema = z.object({
  segments: z.array(ServiceConfigSchema).min(1),
  createdPackageIds: z.array(z.string()),
  createdSegmentIds: z.array(z.string()),
});

export type ServicesData = z.infer<typeof ServicesDataSchema>;

/**
 * Marketing phase data (landing page and brand voice)
 */
export const MarketingDataSchema = z.object({
  headline: z.string().max(200).optional(),
  tagline: z.string().max(300).optional(),
  brandVoice: z.enum(['professional', 'friendly', 'luxurious', 'approachable', 'bold']).optional(),
  heroImageUrl: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export type MarketingData = z.infer<typeof MarketingDataSchema>;

// ============================================================================
// Discriminated Unions (Fix #1: Type-safe phase/data alignment)
// ============================================================================

/**
 * Update onboarding state input - discriminated union
 * Ensures phase and data types are correctly paired at compile time.
 *
 * @example
 * // TypeScript knows `data` is DiscoveryData when phase is 'DISCOVERY'
 * const input: UpdateOnboardingStateInput = {
 *   phase: 'DISCOVERY',
 *   data: { businessType: 'photographer', ... }
 * };
 */
export const UpdateOnboardingStateInputSchema = z.discriminatedUnion('phase', [
  z.object({
    phase: z.literal('DISCOVERY'),
    data: DiscoveryDataSchema,
  }),
  z.object({
    phase: z.literal('MARKET_RESEARCH'),
    data: MarketResearchDataSchema,
  }),
  z.object({
    phase: z.literal('SERVICES'),
    data: ServicesDataSchema,
  }),
  z.object({
    phase: z.literal('MARKETING'),
    data: MarketingDataSchema,
  }),
  z.object({
    phase: z.literal('COMPLETED'),
    data: z.object({
      completedAt: z.string().datetime(),
      summary: z.string().optional(),
    }),
  }),
  z.object({
    phase: z.literal('SKIPPED'),
    data: z.object({
      skippedAt: z.string().datetime(),
      reason: z.string().optional(),
    }),
  }),
]);

export type UpdateOnboardingStateInput = z.infer<typeof UpdateOnboardingStateInputSchema>;

// ============================================================================
// Tool Result Types (Union-Based Error Handling)
// ============================================================================

/**
 * Result from update_onboarding_state tool
 *
 * Uses z.union instead of z.discriminatedUnion because we have multiple
 * error variants all with success: false. Zod's discriminatedUnion requires
 * unique discriminator values.
 */
const UpdateOnboardingStateSuccessSchema = z.object({
  success: z.literal(true),
  phase: OnboardingPhaseSchema,
  summary: z.string(),
  version: z.number().int(),
});

const UpdateOnboardingStateErrorSchema = z.union([
  z.object({
    success: z.literal(false),
    error: z.literal('INCOMPLETE_DATA'),
    missingFields: z.array(z.string()),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('CONCURRENT_MODIFICATION'),
    currentVersion: z.number().int(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('INVALID_TRANSITION'),
    currentPhase: OnboardingPhaseSchema,
    attemptedPhase: OnboardingPhaseSchema,
  }),
]);

export const UpdateOnboardingStateResultSchema = z.union([
  UpdateOnboardingStateSuccessSchema,
  UpdateOnboardingStateErrorSchema,
]);

export type UpdateOnboardingStateResult = z.infer<typeof UpdateOnboardingStateResultSchema>;

/**
 * Result from upsert_services tool
 */
const UpsertServicesSuccessSchema = z.object({
  success: z.literal(true),
  segmentId: z.string(),
  packages: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      priceCents: z.number().int(),
    })
  ),
  previewUrl: z.string().url(),
});

const UpsertServicesErrorSchema = z.union([
  z.object({
    success: z.literal(false),
    error: z.literal('SEGMENT_EXISTS'),
    existingSlug: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('DUPLICATE_PACKAGE_NAME'),
    duplicateName: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.literal('VALIDATION_ERROR'),
    message: z.string(),
  }),
]);

export const UpsertServicesResultSchema = z.union([
  UpsertServicesSuccessSchema,
  UpsertServicesErrorSchema,
]);

export type UpsertServicesResult = z.infer<typeof UpsertServicesResultSchema>;

// ============================================================================
// Event Sourcing Schemas
// ============================================================================

/**
 * Base event schema with common fields
 */
const BaseEventSchema = z.object({
  tenantId: z.string(),
  timestamp: z.string().datetime(),
  version: z.number().int().min(1),
});

/**
 * Event type enum
 */
export const OnboardingEventTypeSchema = z.enum([
  'DISCOVERY_STARTED',
  'DISCOVERY_COMPLETED',
  'MARKET_RESEARCH_STARTED',
  'MARKET_RESEARCH_COMPLETED',
  'SERVICES_STARTED',
  'SERVICES_CONFIGURED',
  'MARKETING_STARTED',
  'MARKETING_CONFIGURED',
  'ONBOARDING_COMPLETED',
  'ONBOARDING_SKIPPED',
  'PHASE_REVERTED', // For going back to fix something
]);

export type OnboardingEventType = z.infer<typeof OnboardingEventTypeSchema>;

/**
 * Event payload schemas - one for each event type
 */
export const EventPayloadSchemas = {
  DISCOVERY_STARTED: z.object({
    startedAt: z.string().datetime(),
    sessionId: z.string(),
  }),
  DISCOVERY_COMPLETED: DiscoveryDataSchema.extend({
    completedAt: z.string().datetime(),
  }),
  MARKET_RESEARCH_STARTED: z.object({
    startedAt: z.string().datetime(),
    businessType: BusinessTypeSchema,
    location: z.object({
      city: z.string(),
      state: z.string(),
    }),
  }),
  MARKET_RESEARCH_COMPLETED: MarketResearchDataSchema,
  SERVICES_STARTED: z.object({
    startedAt: z.string().datetime(),
    recommendedTierCount: z.number().int(),
  }),
  SERVICES_CONFIGURED: ServicesDataSchema.extend({
    configuredAt: z.string().datetime(),
  }),
  MARKETING_STARTED: z.object({
    startedAt: z.string().datetime(),
  }),
  MARKETING_CONFIGURED: MarketingDataSchema.extend({
    configuredAt: z.string().datetime(),
  }),
  ONBOARDING_COMPLETED: z.object({
    completedAt: z.string().datetime(),
    totalDurationMinutes: z.number().int().optional(),
    phasesCompleted: z.array(OnboardingPhaseSchema),
  }),
  ONBOARDING_SKIPPED: z.object({
    skippedAt: z.string().datetime(),
    reason: z.string().optional(),
    lastPhase: OnboardingPhaseSchema,
  }),
  PHASE_REVERTED: z.object({
    revertedAt: z.string().datetime(),
    fromPhase: OnboardingPhaseSchema,
    toPhase: OnboardingPhaseSchema,
    reason: z.string().optional(),
  }),
} as const;

/**
 * Type-safe payload map for event types
 */
export type OnboardingEventPayloads = {
  [K in OnboardingEventType]: z.infer<(typeof EventPayloadSchemas)[K]>;
};

/**
 * Full event schema (discriminated by eventType)
 */
export const OnboardingEventSchema = z.discriminatedUnion('eventType', [
  BaseEventSchema.extend({
    eventType: z.literal('DISCOVERY_STARTED'),
    payload: EventPayloadSchemas.DISCOVERY_STARTED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('DISCOVERY_COMPLETED'),
    payload: EventPayloadSchemas.DISCOVERY_COMPLETED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('MARKET_RESEARCH_STARTED'),
    payload: EventPayloadSchemas.MARKET_RESEARCH_STARTED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('MARKET_RESEARCH_COMPLETED'),
    payload: EventPayloadSchemas.MARKET_RESEARCH_COMPLETED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('SERVICES_STARTED'),
    payload: EventPayloadSchemas.SERVICES_STARTED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('SERVICES_CONFIGURED'),
    payload: EventPayloadSchemas.SERVICES_CONFIGURED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('MARKETING_STARTED'),
    payload: EventPayloadSchemas.MARKETING_STARTED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('MARKETING_CONFIGURED'),
    payload: EventPayloadSchemas.MARKETING_CONFIGURED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('ONBOARDING_COMPLETED'),
    payload: EventPayloadSchemas.ONBOARDING_COMPLETED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('ONBOARDING_SKIPPED'),
    payload: EventPayloadSchemas.ONBOARDING_SKIPPED,
  }),
  BaseEventSchema.extend({
    eventType: z.literal('PHASE_REVERTED'),
    payload: EventPayloadSchemas.PHASE_REVERTED,
  }),
]);

export type OnboardingEvent = z.infer<typeof OnboardingEventSchema>;

// ============================================================================
// Advisor Memory Schema
// ============================================================================

/**
 * Advisor memory - projected state from events
 * Used for session resumption and context building
 */
export const AdvisorMemorySchema = z.object({
  tenantId: z.string(),
  currentPhase: OnboardingPhaseSchema,
  discoveryData: DiscoveryDataSchema.optional(),
  marketResearchData: MarketResearchDataSchema.optional(),
  servicesData: ServicesDataSchema.optional(),
  marketingData: MarketingDataSchema.optional(),
  lastEventVersion: z.number().int(),
  lastEventTimestamp: z.string().datetime(),
  conversationSummary: z.string().optional(),
});

export type AdvisorMemory = z.infer<typeof AdvisorMemorySchema>;

// ============================================================================
// XState Machine Context & Events
// ============================================================================

/**
 * XState machine context
 */
export const OnboardingContextSchema = z.object({
  tenantId: z.string(),
  sessionId: z.string(),
  discovery: DiscoveryDataSchema.optional(),
  marketResearch: MarketResearchDataSchema.optional(),
  services: ServicesDataSchema.optional(),
  marketing: MarketingDataSchema.optional(),
  eventVersion: z.number().int().default(0),
  error: z.string().optional(),
});

export type OnboardingContext = z.infer<typeof OnboardingContextSchema>;

/**
 * XState machine events - discriminated union
 */
export const OnboardingMachineEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('COMPLETE_DISCOVERY'), data: DiscoveryDataSchema }),
  z.object({ type: z.literal('COMPLETE_MARKET_RESEARCH'), data: MarketResearchDataSchema }),
  z.object({ type: z.literal('COMPLETE_SERVICES'), data: ServicesDataSchema }),
  z.object({ type: z.literal('COMPLETE_MARKETING'), data: MarketingDataSchema }),
  z.object({ type: z.literal('SKIP'), reason: z.string().optional() }),
  z.object({ type: z.literal('GO_BACK') }),
  z.object({ type: z.literal('ERROR'), error: z.string() }),
  z.object({ type: z.literal('RETRY') }),
]);

export type OnboardingMachineEvent = z.infer<typeof OnboardingMachineEventSchema>;
