/**
 * Typed API Response Schemas for Agent ↔ MAIS Contract
 *
 * Zod schemas for every API response the tenant agent consumes.
 * Used with `callMaisApiTyped` to validate responses at runtime,
 * replacing unsafe `as` casts with proper validation.
 *
 * Design decisions:
 * - `.passthrough()` on all object schemas for forward compatibility
 *   (extra fields from the backend don't cause validation failures)
 * - Schemas derived from actual tool code casts as source of truth
 * - Both Zod schemas and inferred TypeScript types exported
 *
 * @see server/src/agent-v2/deploy/tenant/src/utils.ts — callMaisApiTyped
 * @see docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md — Todo 6010
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Storefront Structure: /storefront/structure
// ─────────────────────────────────────────────────────────────────────────────

export const StorefrontStructureResponse = z
  .object({
    sections: z.array(
      z
        .object({
          id: z.string(),
          page: z.string(),
          type: z.string(),
          headline: z.string(),
          hasPlaceholder: z.boolean(),
        })
        .passthrough()
    ),
    totalCount: z.number(),
    hasDraft: z.boolean(),
  })
  .passthrough();

export type StorefrontStructureResponse = z.infer<typeof StorefrontStructureResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Section Content: /storefront/section
// ─────────────────────────────────────────────────────────────────────────────

/** Full section content — used by storefront-read, refinement, marketing */
export const SectionContentResponse = z
  .object({
    type: z.string().optional(),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    content: z.string().optional(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().optional(),
    blockType: z.string().optional(),
    imageUrl: z.string().optional(),
    backgroundImageUrl: z.string().optional(),
  })
  .passthrough();

export type SectionContentResponse = z.infer<typeof SectionContentResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Discovery Facts: /get-discovery-facts
// ─────────────────────────────────────────────────────────────────────────────

export const GetDiscoveryFactsResponse = z
  .object({
    success: z.boolean(),
    facts: z.record(z.unknown()),
    factCount: z.number(),
    factKeys: z.array(z.string()),
    message: z.string().optional(),
  })
  .passthrough();

export type GetDiscoveryFactsResponse = z.infer<typeof GetDiscoveryFactsResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Store Discovery Fact: /store-discovery-fact
// ─────────────────────────────────────────────────────────────────────────────

export const StoreDiscoveryFactResponse = z
  .object({
    stored: z.boolean(),
    key: z.string(),
    value: z.unknown(),
    totalFactsKnown: z.number(),
    knownFactKeys: z.array(z.string()),
    currentPhase: z.string(),
    readyForReveal: z.boolean(),
    missingForMVP: z.array(z.string()),
    message: z.string().optional(),
  })
  .passthrough();

export type StoreDiscoveryFactResponse = z.infer<typeof StoreDiscoveryFactResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Research Data: /get-research-data
// ─────────────────────────────────────────────────────────────────────────────

const ResearchDataSchema = z
  .object({
    success: z.boolean().optional(),
    businessType: z.string().optional(),
    location: z.string().optional(),
    competitorPricing: z
      .object({
        low: z.number(),
        high: z.number(),
        currency: z.string(),
        summary: z.string(),
      })
      .passthrough()
      .optional(),
    marketPositioning: z.array(z.string()).optional(),
    localDemand: z.string().optional(),
    insights: z.array(z.string()).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const GetResearchDataResponse = z
  .object({
    hasData: z.boolean(),
    researchData: ResearchDataSchema.nullable(),
  })
  .passthrough();

export type GetResearchDataResponse = z.infer<typeof GetResearchDataResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Segment Management: /content-generation/manage-segments
// ─────────────────────────────────────────────────────────────────────────────

const SegmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    sortOrder: z.number(),
    active: z.boolean(),
  })
  .passthrough();

export const SegmentListResponse = z
  .object({
    segments: z.array(SegmentSchema),
    totalCount: z.number(),
    maxSegments: z.number(),
  })
  .passthrough();

export type SegmentListResponse = z.infer<typeof SegmentListResponse>;

export const SegmentMutationResponse = z
  .object({
    segment: SegmentSchema,
    totalCount: z.number(),
    maxSegments: z.number(),
  })
  .passthrough();

export type SegmentMutationResponse = z.infer<typeof SegmentMutationResponse>;

export const SegmentDeleteResponse = z
  .object({
    deletedId: z.string(),
    totalCount: z.number(),
  })
  .passthrough();

export type SegmentDeleteResponse = z.infer<typeof SegmentDeleteResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Tier Management: /content-generation/manage-tiers
// ─────────────────────────────────────────────────────────────────────────────

const TierSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    segmentId: z.string(),
    segmentName: z.string().optional(),
    sortOrder: z.number(),
    priceInDollars: z.number(),
    priceCents: z.number(),
    features: z.array(z.unknown()),
    bookingType: z.string(),
    active: z.boolean(),
  })
  .passthrough();

export const TierListResponse = z
  .object({
    tiers: z.array(TierSchema),
    totalCount: z.number(),
    segmentId: z.string().optional(),
  })
  .passthrough();

export type TierListResponse = z.infer<typeof TierListResponse>;

export const TierMutationResponse = z
  .object({
    tier: TierSchema,
    totalCount: z.number(),
  })
  .passthrough();

export type TierMutationResponse = z.infer<typeof TierMutationResponse>;

export const TierDeleteResponse = z
  .object({
    deletedId: z.string(),
    totalCount: z.number(),
  })
  .passthrough();

export type TierDeleteResponse = z.infer<typeof TierDeleteResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// AddOn Management: /content-generation/manage-addons
// ─────────────────────────────────────────────────────────────────────────────

const AddOnSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    priceInDollars: z.number(),
    priceCents: z.number(),
    segmentId: z.string().nullable(),
    segmentName: z.string().optional(),
    active: z.boolean(),
  })
  .passthrough();

export const AddOnListResponse = z
  .object({
    addOns: z.array(AddOnSchema),
    totalCount: z.number(),
  })
  .passthrough();

export type AddOnListResponse = z.infer<typeof AddOnListResponse>;

export const AddOnMutationResponse = z
  .object({
    addOn: AddOnSchema,
    totalCount: z.number(),
  })
  .passthrough();

export type AddOnMutationResponse = z.infer<typeof AddOnMutationResponse>;

export const AddOnDeleteResponse = z
  .object({
    deletedId: z.string(),
    totalCount: z.number(),
  })
  .passthrough();

export type AddOnDeleteResponse = z.infer<typeof AddOnDeleteResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Generate Variants: /content-generation/generate-variants
// ─────────────────────────────────────────────────────────────────────────────

const VariantContentSchema = z
  .object({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    content: z.string().optional(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().optional(),
  })
  .passthrough();

export const GenerateVariantsResponse = z
  .object({
    variants: z.record(VariantContentSchema),
    recommendation: z.string(),
    rationale: z.string(),
  })
  .passthrough();

export type GenerateVariantsResponse = z.infer<typeof GenerateVariantsResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Update Branding: /storefront/update-branding
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateBrandingResponse = z
  .object({
    success: z.boolean(),
    updated: z.array(z.string()),
    note: z.string().optional(),
  })
  .passthrough();

export type UpdateBrandingResponse = z.infer<typeof UpdateBrandingResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Remove Section: /storefront/remove-section
// ─────────────────────────────────────────────────────────────────────────────

export const RemoveSectionResponse = z
  .object({
    success: z.boolean(),
    sectionId: z.string().optional(),
    removedSectionId: z.string().optional(),
    hasDraft: z.boolean().optional(),
    note: z.string().optional(),
  })
  .passthrough();

export type RemoveSectionResponse = z.infer<typeof RemoveSectionResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Reorder Sections: /storefront/reorder-sections
// ─────────────────────────────────────────────────────────────────────────────

export const ReorderSectionsResponse = z
  .object({
    success: z.boolean(),
    sectionId: z.string().optional(),
    newPosition: z.number().optional(),
    hasDraft: z.boolean().optional(),
  })
  .passthrough();

export type ReorderSectionsResponse = z.infer<typeof ReorderSectionsResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Preview Draft: /storefront/preview
// ─────────────────────────────────────────────────────────────────────────────

export const PreviewDraftResponse = z
  .object({
    hasDraft: z.boolean(),
    previewUrl: z.string().nullable().optional(),
    liveUrl: z.string().nullable().optional(),
  })
  .passthrough();

export type PreviewDraftResponse = z.infer<typeof PreviewDraftResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Publish All: /storefront/publish
// ─────────────────────────────────────────────────────────────────────────────

export const PublishAllResponse = z
  .object({
    success: z.boolean(),
    action: z.string().optional(),
    publishedAt: z.string().optional(),
    publishedCount: z.number().optional(),
    hasDraft: z.boolean().optional(),
    liveUrl: z.string().nullable().optional(),
    note: z.string().optional(),
  })
  .passthrough();

export type PublishAllResponse = z.infer<typeof PublishAllResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Discard All: /storefront/discard
// ─────────────────────────────────────────────────────────────────────────────

export const DiscardAllResponse = z
  .object({
    success: z.boolean(),
    action: z.string().optional(),
    discardedCount: z.number().optional(),
    hasDraft: z.boolean().optional(),
    note: z.string().optional(),
  })
  .passthrough();

export type DiscardAllResponse = z.infer<typeof DiscardAllResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Add Section: /storefront/add-section
// ─────────────────────────────────────────────────────────────────────────────

export const AddSectionResponse = z
  .object({
    sectionId: z.string().optional(),
  })
  .passthrough();

export type AddSectionResponse = z.infer<typeof AddSectionResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Publish/Discard Section: /storefront/publish-section, /storefront/discard-section
// ─────────────────────────────────────────────────────────────────────────────

export const SectionLifecycleResponse = z
  .object({
    hasDraft: z.boolean().optional(),
    publishedAt: z.string().optional(),
  })
  .passthrough();

export type SectionLifecycleResponse = z.infer<typeof SectionLifecycleResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Project Management: /project-hub/*
// ─────────────────────────────────────────────────────────────────────────────

const ProjectRequestSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    status: z.string(),
    requestData: z.record(z.unknown()),
    expiresAt: z.string(),
    version: z.number().optional(),
  })
  .passthrough();

export const PendingRequestsResponse = z
  .object({
    requests: z.array(ProjectRequestSchema),
    count: z.number(),
  })
  .passthrough();

export type PendingRequestsResponse = z.infer<typeof PendingRequestsResponse>;

export const ProjectDetailsResponse = z
  .object({
    id: z.string(),
    status: z.string(),
    bookingDate: z.string(),
    serviceName: z.string(),
    customerPreferences: z.record(z.unknown()),
  })
  .passthrough();

export type ProjectDetailsResponse = z.infer<typeof ProjectDetailsResponse>;

export const RequestActionResponse = z
  .object({
    success: z.boolean(),
    request: ProjectRequestSchema,
    remainingPendingCount: z.number().optional(),
  })
  .passthrough();

export type RequestActionResponse = z.infer<typeof RequestActionResponse>;
