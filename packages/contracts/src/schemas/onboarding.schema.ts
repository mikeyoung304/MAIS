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
// Onboarding Status (replaces OnboardingPhase — 2026-02-20 redesign)
// ============================================================================

/**
 * Onboarding status enum - matches Prisma OnboardingStatus
 * State machine: PENDING_PAYMENT → PENDING_INTAKE → BUILDING → SETUP → COMPLETE
 */
export const OnboardingStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PENDING_INTAKE',
  'BUILDING',
  'SETUP',
  'COMPLETE',
]);

export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;

/**
 * Safely parse an unknown value to OnboardingStatus
 * Returns 'PENDING_PAYMENT' if value is invalid or null/undefined
 *
 * Prevents unsafe `as OnboardingStatus` type assertions throughout the codebase.
 */
export function parseOnboardingStatus(value: unknown): OnboardingStatus {
  const result = OnboardingStatusSchema.safeParse(value);
  return result.success ? result.data : 'PENDING_PAYMENT';
}

/**
 * Build status tracking for background website generation pipeline
 */
export const BuildStatusSchema = z.enum([
  'QUEUED',
  'GENERATING_HERO',
  'GENERATING_ABOUT',
  'GENERATING_SERVICES',
  'COMPLETE',
  'FAILED',
]);

export type BuildStatus = z.infer<typeof BuildStatusSchema>;

/**
 * Per-section status during build pipeline.
 * Canonical definition — imported by background-build.service.ts and frontend components.
 */
export const SectionStatusSchema = z.enum(['pending', 'generating', 'complete', 'failed']);
export type SectionStatus = z.infer<typeof SectionStatusSchema>;

/**
 * Build status response returned by GET /build-status.
 * Canonical definition — imported by background-build.service.ts and frontend poll pages.
 */
export const BuildStatusResponseSchema = z.object({
  buildStatus: z.string().nullable(),
  buildError: z.string().nullable(),
  sections: z.record(z.string(), SectionStatusSchema),
});
export type BuildStatusResponse = z.infer<typeof BuildStatusResponseSchema>;

/**
 * Valid state transitions for OnboardingStatus
 * Used by route guards and service layer to enforce the state machine
 */
export const VALID_ONBOARDING_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  PENDING_PAYMENT: ['PENDING_INTAKE'],
  PENDING_INTAKE: ['BUILDING'],
  BUILDING: ['SETUP', 'COMPLETE'], // COMPLETE if build fails but we want to skip
  SETUP: ['COMPLETE'],
  COMPLETE: [], // Terminal state
};

// Legacy aliases for backward compatibility during migration
// TODO(2026-Q2): remove deprecated aliases
/** @deprecated Use OnboardingStatusSchema */
export const OnboardingPhaseSchema = OnboardingStatusSchema;
/** @deprecated Use OnboardingStatus */
export type OnboardingPhase = OnboardingStatus;
/** @deprecated Use parseOnboardingStatus */
export const parseOnboardingPhase = parseOnboardingStatus;

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
// Business Data Schemas (used during onboarding discovery + research)
// ============================================================================

/**
 * Discovery data - initial business information gathered during onboarding
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
  tiers: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      priceCents: z.number().int().min(0),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

/**
 * Services phase data
 */
export const ServicesDataSchema = z.object({
  segments: z.array(ServiceConfigSchema).min(1),
  createdTierIds: z.array(z.string()),
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
 * Update onboarding status input - discriminated union
 * Ensures status and data types are correctly paired at compile time.
 */
export const UpdateOnboardingStatusInputSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('PENDING_INTAKE'),
    data: z.object({
      paidAt: z.string().datetime(),
      stripeCustomerId: z.string().optional(),
    }),
  }),
  z.object({
    status: z.literal('BUILDING'),
    data: z.object({
      startedAt: z.string().datetime(),
      idempotencyKey: z.string().optional(),
    }),
  }),
  z.object({
    status: z.literal('SETUP'),
    data: z.object({
      completedAt: z.string().datetime(),
      sectionsBuilt: z.number().int().optional(),
    }),
  }),
  z.object({
    status: z.literal('COMPLETE'),
    data: z.object({
      completedAt: z.string().datetime(),
      summary: z.string().optional(),
    }),
  }),
]);

/** @deprecated Use UpdateOnboardingStatusInputSchema */
export const UpdateOnboardingStateInputSchema = UpdateOnboardingStatusInputSchema;

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
const UpdateOnboardingStatusSuccessSchema = z.object({
  success: z.literal(true),
  status: OnboardingStatusSchema,
  summary: z.string(),
  version: z.number().int(),
});

const UpdateOnboardingStatusErrorSchema = z.union([
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
    currentStatus: OnboardingStatusSchema,
    attemptedStatus: OnboardingStatusSchema,
  }),
]);

export const UpdateOnboardingStatusResultSchema = z.union([
  UpdateOnboardingStatusSuccessSchema,
  UpdateOnboardingStatusErrorSchema,
]);

export type UpdateOnboardingStatusResult = z.infer<typeof UpdateOnboardingStatusResultSchema>;

/** @deprecated Use UpdateOnboardingStatusResultSchema */
export const UpdateOnboardingStateResultSchema = UpdateOnboardingStatusResultSchema;
/** @deprecated Use UpdateOnboardingStatusResult */
export type UpdateOnboardingStateResult = UpdateOnboardingStatusResult;

/**
 * Result from upsert_services tool
 */
const UpsertServicesSuccessSchema = z.object({
  success: z.literal(true),
  segmentId: z.string(),
  tiers: z.array(
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
  'ONBOARDING_STARTED',
  'ONBOARDING_COMPLETED',
  'ONBOARDING_SKIPPED',
  'PHASE_REVERTED', // For going back to fix something
]);

export type OnboardingEventType = z.infer<typeof OnboardingEventTypeSchema>;

/**
 * Event payload schemas - one for each event type
 */
export const EventPayloadSchemas = {
  ONBOARDING_STARTED: z.object({
    startedAt: z.string().datetime(),
    sessionId: z.string(),
  }),
  ONBOARDING_COMPLETED: z.object({
    completedAt: z.string().datetime(),
    totalDurationMinutes: z.number().int().optional(),
    phasesCompleted: z.array(OnboardingStatusSchema),
  }),
  ONBOARDING_SKIPPED: z.object({
    skippedAt: z.string().datetime(),
    reason: z.string().optional(),
    lastStatus: OnboardingStatusSchema,
  }),
  PHASE_REVERTED: z.object({
    revertedAt: z.string().datetime(),
    fromStatus: OnboardingStatusSchema,
    toStatus: OnboardingStatusSchema,
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
    eventType: z.literal('ONBOARDING_STARTED'),
    payload: EventPayloadSchemas.ONBOARDING_STARTED,
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
  currentStatus: OnboardingStatusSchema,
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
  eventVersion: z.number().int().default(0),
  error: z.string().optional(),
});

export type OnboardingContext = z.infer<typeof OnboardingContextSchema>;

/**
 * XState machine events - discriminated union
 */
export const OnboardingMachineEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('COMPLETE') }),
  z.object({ type: z.literal('SKIP'), reason: z.string().optional() }),
  z.object({ type: z.literal('ERROR'), error: z.string() }),
  z.object({ type: z.literal('RETRY') }),
]);

export type OnboardingMachineEvent = z.infer<typeof OnboardingMachineEventSchema>;

// ============================================================================
// Setup Progress (Phase 6 — Checklist)
// ============================================================================

export const SetupActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agent_prompt'), prompt: z.string() }),
  z.object({ type: z.literal('navigate'), path: z.string() }),
  z.object({ type: z.literal('modal'), modal: z.string() }),
]);

export type SetupAction = z.infer<typeof SetupActionSchema>;

export const SetupItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  completed: z.boolean(),
  dismissed: z.boolean(),
  action: SetupActionSchema,
  weight: z.number().int().min(1),
});

export type SetupItem = z.infer<typeof SetupItemSchema>;

export const SetupProgressSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  items: z.array(SetupItemSchema),
});

export type SetupProgress = z.infer<typeof SetupProgressSchema>;

/**
 * Valid checklist item IDs (must match deriveSetupProgress() in tenant-onboarding.service.ts)
 */
export const CHECKLIST_ITEM_IDS = [
  'review_sections',
  'upload_photos',
  'add_testimonials',
  'add_faq',
  'add_gallery',
  'connect_stripe',
  'set_availability',
  'publish_website',
] as const;

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];

export const DismissChecklistItemSchema = z.object({
  itemId: z.enum(CHECKLIST_ITEM_IDS),
});

export type DismissChecklistItemInput = z.infer<typeof DismissChecklistItemSchema>;
