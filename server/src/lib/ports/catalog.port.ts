/**
 * Catalog Repository Port — Tier and AddOn persistence
 */

import type { Tier, TierPhoto, AddOn } from '../entities';

/**
 * Catalog Repository - Tier and AddOn persistence
 *
 * Phase 2: All Package methods renamed to Tier equivalents.
 * The Prisma Package model still exists (dropped in Phase 5) but is never queried.
 */
export interface CatalogRepository {
  // Tier read methods
  getAllTiers(tenantId: string, options?: { take?: number }): Promise<Tier[]>;
  getAllTiersWithAddOns(
    tenantId: string,
    options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>>;
  getTierBySlug(tenantId: string, slug: string): Promise<Tier | null>;
  getTierBySlugWithAddOns(
    tenantId: string,
    slug: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null>;
  getTierById(tenantId: string, id: string): Promise<Tier | null>;
  getTierByIdWithAddOns(tenantId: string, id: string): Promise<(Tier & { addOns: AddOn[] }) | null>;
  getTiersByIds(tenantId: string, ids: string[]): Promise<Tier[]>;

  // Tier write methods
  createTier(tenantId: string, data: CreateTierInput): Promise<Tier>;
  updateTier(tenantId: string, id: string, data: UpdateTierInput): Promise<Tier>;
  deleteTier(tenantId: string, id: string): Promise<void>;

  // Segment-scoped tier methods
  getTiersBySegment(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<Tier[]>;
  getTiersBySegmentWithAddOns(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>>;

  // AddOn methods
  getAllAddOns(tenantId: string, options?: { take?: number }): Promise<AddOn[]>;
  getAddOnsByTierId(tenantId: string, tierId: string): Promise<AddOn[]>;
  getAddOnById(tenantId: string, id: string): Promise<AddOn | null>;
  createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn>;
  updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn>;
  deleteAddOn(tenantId: string, id: string): Promise<void>;

  // Segment-scoped add-on methods
  getAddOnsForSegment(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<AddOn[]>;
}

/**
 * Input for creating a new tier
 */
export interface CreateTierInput {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  displayPriceCents?: number | null;
  segmentId?: string | null;
  groupingOrder?: number;
  photos?: TierPhoto[];
  maxGuests?: number | null;
  scalingRules?: import('@macon/contracts').ScalingRules | null;
}

/**
 * Input for updating an existing tier
 */
export interface UpdateTierInput {
  slug?: string;
  title?: string;
  description?: string;
  priceCents?: number;
  displayPriceCents?: number | null;
  segmentId?: string | null;
  groupingOrder?: number;
  photos?: TierPhoto[];
  maxGuests?: number | null;
  scalingRules?: import('@macon/contracts').ScalingRules | null;
}

/**
 * Input for creating a new add-on
 */
export interface CreateAddOnInput {
  tierId: string;
  title: string;
  priceCents: number;
  photoUrl?: string;
}

/**
 * Input for updating an existing add-on
 */
export interface UpdateAddOnInput {
  tierId?: string;
  title?: string;
  priceCents?: number;
  photoUrl?: string;
}
