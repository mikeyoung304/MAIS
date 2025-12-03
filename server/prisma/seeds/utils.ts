/**
 * Shared seed utilities for tenant and package creation
 *
 * Provides reusable functions for creating tenants, packages, and add-ons
 * across E2E and demo seeds.
 */

import { PrismaClient, Tenant, Package, AddOn } from '../../src/generated/prisma';
import { apiKeyService } from '../../src/lib/api-key.service';

/**
 * Options for creating/updating a tenant
 */
export interface TenantSeedOptions {
  slug: string;
  name: string;
  email?: string;
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
 * Options for creating/updating a package
 */
export interface PackageSeedOptions {
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  photos?: Array<{
    url: string;
    filename: string;
    size: number;
    order: number;
  }>;
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
  prisma: PrismaClient,
  options: TenantSeedOptions
): Promise<Tenant> {
  const {
    slug,
    name,
    email,
    commissionPercent = 5.0,
    apiKeyPublic,
    apiKeySecret,
    primaryColor = '#1a365d',
    secondaryColor = '#fb923c',
    accentColor = '#38b2ac',
    backgroundColor = '#ffffff',
    fontFamily = 'Inter, system-ui, sans-serif',
    isActive = true,
  } = options;

  const branding = { fontFamily };

  // For upsert update: exclude sensitive fields that should only be set on create
  const updateData = {
    name,
    email,
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
 * Create or update a package with the provided options
 */
export async function createOrUpdatePackage(
  prisma: PrismaClient,
  options: PackageSeedOptions
): Promise<Package> {
  const {
    tenantId,
    slug,
    name,
    description,
    basePrice,
    photos = [],
  } = options;

  return prisma.package.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {},
    create: {
      slug,
      name,
      description,
      basePrice,
      photos: JSON.stringify(photos),
      tenantId,
    },
  });
}

/**
 * Create or update an add-on with the provided options
 */
export async function createOrUpdateAddOn(
  prisma: PrismaClient,
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
 * Link an add-on to a package
 */
export async function linkAddOnToPackage(
  prisma: PrismaClient,
  packageId: string,
  addOnId: string
): Promise<void> {
  await prisma.packageAddOn.upsert({
    where: { packageId_addOnId: { packageId, addOnId } },
    update: {},
    create: { packageId, addOnId },
  });
}

/**
 * Create multiple packages concurrently
 */
export async function createOrUpdatePackages(
  prisma: PrismaClient,
  tenantId: string,
  packageOptions: Array<Omit<PackageSeedOptions, 'tenantId'>>
): Promise<Package[]> {
  return Promise.all(
    packageOptions.map((opts) =>
      createOrUpdatePackage(prisma, { ...opts, tenantId })
    )
  );
}

/**
 * Create multiple add-ons concurrently
 */
export async function createOrUpdateAddOns(
  prisma: PrismaClient,
  tenantId: string,
  addOnOptions: Array<Omit<AddOnSeedOptions, 'tenantId'>>
): Promise<AddOn[]> {
  return Promise.all(
    addOnOptions.map((opts) =>
      createOrUpdateAddOn(prisma, { ...opts, tenantId })
    )
  );
}

/**
 * Link multiple add-ons to a package concurrently
 */
export async function linkAddOnsToPackage(
  prisma: PrismaClient,
  packageId: string,
  addOnIds: string[]
): Promise<void> {
  await Promise.all(
    addOnIds.map((addOnId) =>
      linkAddOnToPackage(prisma, packageId, addOnId)
    )
  );
}
