/**
 * Tier mapping utilities
 * Converts Tier Prisma records to TierDto
 */

import type { TierDto, AddOnDto } from '@macon/contracts';
import type { AddOn } from '../entities';

/**
 * Tier record from Prisma (subset of fields needed for mapping)
 */
export interface TierRecord {
  id: string;
  tenantId: string;
  segmentId: string;
  sortOrder: number;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  features: unknown; // JSON — validated downstream by TierFeaturesSchema
  bookingType: 'DATE' | 'TIMESLOT';
  durationMinutes: number | null;
  depositPercent: number | null;
  active: boolean;
  photos: unknown; // JSON — [{url, filename, size, order}]
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tier record with add-ons included
 */
export interface TierWithAddOns extends TierRecord {
  addOns: AddOn[];
}

/**
 * Photo shape stored in the Tier.photos JSON column
 */
interface TierPhotoJson {
  url: string;
  filename?: string;
  size?: number;
  order?: number;
}

/**
 * Maps a single AddOn to AddOnDto
 */
function mapAddOn(addOn: AddOn): AddOnDto {
  return {
    id: addOn.id,
    tierId: addOn.tierId,
    title: addOn.title,
    priceCents: addOn.priceCents,
    photoUrl: addOn.photoUrl,
  };
}

/**
 * Maps a Tier record to TierDto
 * Used by all tier routes to ensure consistent DTO structure
 *
 * @param tier - Tier Prisma record (optionally with addOns)
 * @returns TierDto with all fields mapped
 */
export function mapTierToDto(tier: TierRecord): TierDto {
  const photos = (Array.isArray(tier.photos) ? tier.photos : []) as TierPhotoJson[];
  const features = (Array.isArray(tier.features) ? tier.features : []) as Array<{
    text: string;
    highlighted?: boolean;
    icon?: string;
  }>;

  return {
    id: tier.id,
    tenantId: tier.tenantId,
    segmentId: tier.segmentId,
    sortOrder: tier.sortOrder,
    slug: tier.slug,
    name: tier.name,
    description: tier.description,
    priceCents: tier.priceCents,
    currency: tier.currency,
    features,
    bookingType: tier.bookingType,
    durationMinutes: tier.durationMinutes,
    depositPercent: tier.depositPercent,
    active: tier.active,
    photos: photos.map((p, i) => ({
      url: p.url,
      filename: p.filename ?? `photo-${i}`,
      size: p.size ?? 0,
      order: p.order ?? i,
    })),
    createdAt: tier.createdAt.toISOString(),
    updatedAt: tier.updatedAt.toISOString(),
  };
}

/**
 * Maps an array of Tier records to TierDto array
 * Convenience method for mapping multiple tiers at once
 *
 * @param tiers - Array of Tier Prisma records
 * @returns Array of TierDto
 */
export function mapTiersToDto(tiers: TierRecord[]): TierDto[] {
  return tiers.map(mapTierToDto);
}
