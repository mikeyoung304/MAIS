/**
 * Shared seed utilities for tenant and tier creation
 *
 * Provides reusable functions for creating tenants, tiers, and add-ons
 * across E2E and demo seeds.
 */

import type { PrismaClient, Tenant, Tier, AddOn } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';
import { apiKeyService } from '../../src/lib/api-key.service';

/**
 * Transaction client type for seed operations
 * Allows functions to work with both PrismaClient and transaction clients
 */
type PrismaOrTransaction =
  | PrismaClient
  | Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use'>;

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
 * Options for creating/updating a tier
 */
export interface TierSeedOptions {
  tenantId: string;
  segmentId: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  sortOrder: number;
  photos?: Array<{
    url: string;
    filename: string;
    size: number;
    order: number;
  }>;
  features?: Array<{ name: string; included: boolean }>;
}

/**
 * Options for creating/updating an add-on
 */
export interface AddOnSeedOptions {
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  price: number;
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
 * Create or update a tier with the provided options
 */
export async function createOrUpdateTier(
  prisma: PrismaOrTransaction,
  options: TierSeedOptions
): Promise<Tier> {
  const {
    tenantId,
    segmentId,
    slug,
    name,
    description,
    priceCents,
    sortOrder,
    photos = [],
    features = [],
  } = options;

  return prisma.tier.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {},
    create: {
      slug,
      name,
      description,
      priceCents,
      sortOrder,
      photos: JSON.stringify(photos),
      features: JSON.stringify(features),
      tenantId,
      segmentId,
    },
  });
}

/**
 * Create or update an add-on with the provided options
 */
export async function createOrUpdateAddOn(
  prisma: PrismaOrTransaction,
  options: AddOnSeedOptions
): Promise<AddOn> {
  const { tenantId, slug, name, description, price } = options;

  return prisma.addOn.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {},
    create: {
      tenantId,
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
