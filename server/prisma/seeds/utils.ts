/**
 * Shared seed utilities for tenant and tier creation
 *
 * Provides reusable functions for creating tenants, tiers, and add-ons
 * across E2E and demo seeds.
 */

import type { PrismaClient, Tenant, Tier, AddOn, Segment } from '../../src/generated/prisma/client';
import { BookingType } from '../../src/generated/prisma/client';
import { apiKeyService } from '../../src/lib/api-key.service';

/**
 * Transaction client type for seed operations
 * Allows functions to work with both PrismaClient and transaction clients.
 * Includes $extends exclusion required for Prisma 7 compatibility.
 */
export type PrismaOrTransaction =
  | PrismaClient
  | Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;

/**
 * Options for creating/updating a tenant
 */
export interface TenantSeedOptions {
  slug: string;
  name: string;
  email?: string;
  passwordHash?: string; // Pre-hashed password for tenant admin login
  commissionPercent?: number;
  apiKeyPublic: string;
  apiKeySecret?: string; // Only for create, not update
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  isActive?: boolean;
}

/**
 * Options for creating/updating a segment
 */
export interface SegmentSeedOptions {
  slug: string;
  name: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroImage?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  sortOrder?: number;
  active?: boolean;
}

/**
 * Options for creating/updating a tier.
 * All optional fields are absent from the simpler seed files — defaults apply.
 */
export interface TierSeedOptions {
  tenantId: string;
  segmentId: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  sortOrder: number;
  /** Display price shown to customers (e.g., all-in price including accommodation). */
  displayPriceCents?: number;
  /** Max guests for this tier (null = no limit / flat pricing). */
  maxGuests?: number;
  /**
   * Per-person scaling pricing rules.
   * null explicitly clears any existing scaling; undefined leaves field unchanged on update.
   */
  scalingRules?: {
    components: Array<{
      name: string;
      includedGuests: number;
      perPersonCents: number;
      maxGuests?: number;
    }>;
  } | null;
  photos?: Array<{
    url: string;
    filename: string;
    size: number;
    order: number;
  }>;
  /**
   * Tier features.
   * Accepts `{text, highlighted}` shape.
   */
  features?: Array<{ text: string; highlighted: boolean }>;
  /** Booking model for this tier — defaults to DATE. */
  bookingType?: BookingType;
  /** Service duration in minutes for TIMESLOT-based tiers. */
  durationMinutes?: number | null;
}

/**
 * Options for creating/updating an add-on.
 * segmentId is optional — null means global (available to all segments).
 */
export interface AddOnSeedOptions {
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  /** null = global add-on available to all segments; omit for same behaviour. */
  segmentId?: string | null;
}

/**
 * Create or update a tenant with the provided options
 * Uses upsert to preserve existing data if tenant exists
 */
export async function createOrUpdateTenant(
  prisma: PrismaOrTransaction,
  options: TenantSeedOptions
): Promise<Tenant> {
  const {
    slug,
    name,
    email,
    passwordHash,
    commissionPercent = 5.0,
    apiKeyPublic,
    apiKeySecret,
    primaryColor = '#1C1917',
    secondaryColor = '#A78B5A',
    accentColor = '#5A7C65',
    backgroundColor = '#FAFAF7',
    fontFamily = 'Inter, system-ui, sans-serif',
    isActive = true,
  } = options;

  const branding = { fontFamily };

  // For upsert update: exclude sensitive fields that should only be set on create
  const updateData = {
    name,
    email,
    passwordHash, // Update password if provided
    commissionPercent,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    branding,
    isActive,
  };

  // For upsert create: include all fields including API keys
  const createData = {
    ...updateData,
    slug,
    apiKeyPublic,
    apiKeySecret: apiKeySecret ? apiKeyService.hashSecretKey(apiKeySecret) : '',
    stripeAccountId: null,
    stripeOnboarded: false,
  };

  return prisma.tenant.upsert({
    where: { slug },
    update: updateData,
    create: createData,
  });
}

/**
 * Create or update a segment with the provided options.
 * Promoted from individual seed files — all three had identical implementations.
 */
export async function createOrUpdateSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  options: SegmentSeedOptions
): Promise<Segment> {
  const {
    slug,
    name,
    heroTitle,
    heroSubtitle,
    heroImage,
    description,
    metaTitle,
    metaDescription,
    sortOrder = 0,
    active = true,
  } = options;

  return prisma.segment.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      heroTitle,
      heroSubtitle,
      heroImage,
      description,
      metaTitle,
      metaDescription,
      sortOrder,
      active,
    },
    create: {
      tenantId,
      slug,
      name,
      heroTitle,
      heroSubtitle,
      heroImage,
      description,
      metaTitle,
      metaDescription,
      sortOrder,
      active,
    },
  });
}

/**
 * Create or update a tier with full field support.
 * Supports displayPriceCents, maxGuests, scalingRules, bookingType, and the
 * {text, highlighted} feature shape used by all current seed files.
 *
 * Replaces the local createOrUpdateTierWithSegment helpers that were duplicated
 * across little-bit-horse-farm.ts, plate.ts, and la-petit-mariage.ts.
 */
export async function createOrUpdateTierWithSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string,
  options: Omit<TierSeedOptions, 'tenantId' | 'segmentId'>
): Promise<Tier> {
  const {
    slug,
    name,
    description,
    priceCents,
    displayPriceCents,
    maxGuests,
    scalingRules,
    features = [],
    sortOrder,
    photos = [],
    bookingType = BookingType.DATE,
    durationMinutes,
  } = options;

  // Runtime validation: guard against invalid bookingType values passed at runtime
  if (!Object.values(BookingType).includes(bookingType)) {
    throw new Error(`Invalid bookingType: ${bookingType}`);
  }

  const data = {
    name,
    description,
    priceCents,
    displayPriceCents: displayPriceCents ?? null,
    maxGuests: maxGuests ?? null,
    scalingRules: scalingRules ?? undefined,
    durationMinutes: durationMinutes ?? null,
    segmentId,
    sortOrder,
    photos,
    features,
    bookingType,
  };

  return prisma.tier.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: data,
    create: {
      tenantId,
      slug,
      ...data,
    },
  });
}

/**
 * @deprecated Use createOrUpdateTierWithSegment instead — it supports all fields
 * and takes tenantId + segmentId as positional params matching the seed pattern.
 * Kept for backwards compatibility; remove once all callers are migrated.
 */
export async function createOrUpdateTier(
  prisma: PrismaOrTransaction,
  options: TierSeedOptions
): Promise<Tier> {
  const { tenantId, segmentId, ...rest } = options;
  return createOrUpdateTierWithSegment(prisma, tenantId, segmentId, rest);
}

/**
 * Create or update an add-on with the provided options.
 * segmentId is optional — null means the add-on is global (available to all segments).
 */
export async function createOrUpdateAddOn(
  prisma: PrismaOrTransaction,
  options: AddOnSeedOptions
): Promise<AddOn> {
  const { tenantId, slug, name, description, price, segmentId = null } = options;

  return prisma.addOn.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      description,
      price,
      segmentId,
    },
    create: {
      tenantId,
      segmentId,
      slug,
      name,
      description,
      price,
    },
  });
}

/**
 * Link an add-on to a tier
 */
export async function linkAddOnToTier(
  prisma: PrismaOrTransaction,
  tierId: string,
  addOnId: string
): Promise<void> {
  await prisma.tierAddOn.upsert({
    where: { tierId_addOnId: { tierId, addOnId } },
    update: {},
    create: { tierId, addOnId },
  });
}

/**
 * Create multiple tiers concurrently
 */
export async function createOrUpdateTiers(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string,
  tierOptions: Array<Omit<TierSeedOptions, 'tenantId' | 'segmentId'>>
): Promise<Tier[]> {
  return Promise.all(
    tierOptions.map((opts) => createOrUpdateTier(prisma, { ...opts, tenantId, segmentId }))
  );
}

/**
 * Create multiple add-ons concurrently
 */
export async function createOrUpdateAddOns(
  prisma: PrismaOrTransaction,
  tenantId: string,
  addOnOptions: Array<Omit<AddOnSeedOptions, 'tenantId'>>
): Promise<AddOn[]> {
  return Promise.all(
    addOnOptions.map((opts) => createOrUpdateAddOn(prisma, { ...opts, tenantId }))
  );
}

/**
 * Link multiple add-ons to a tier concurrently
 */
export async function linkAddOnsToTier(
  prisma: PrismaOrTransaction,
  tierId: string,
  addOnIds: string[]
): Promise<void> {
  await Promise.all(addOnIds.map((addOnId) => linkAddOnToTier(prisma, tierId, addOnId)));
}
