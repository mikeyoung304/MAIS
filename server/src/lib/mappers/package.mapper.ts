/**
 * Package mapping utilities
 * Converts domain entities to DTOs
 */

import type { PackageDto, AddOnDto } from '@macon/contracts';
import type { Package, AddOn, PackagePhoto } from '../entities';

/**
 * Package entity with add-ons (extended from domain Package type)
 */
export interface PackageWithAddOns extends Package {
  addOns: AddOn[];
}

/**
 * Maps a single PackagePhoto to PackagePhotoDto
 */
function mapPackagePhoto(photo: PackagePhoto, index: number) {
  return {
    url: photo.url,
    filename: photo.filename ?? `photo-${index}`,
    size: photo.size ?? 0,
    order: photo.order ?? index,
  };
}

/**
 * Maps a single AddOn to AddOnDto
 */
function mapAddOn(addOn: AddOn): AddOnDto {
  return {
    id: addOn.id,
    packageId: addOn.packageId,
    title: addOn.title,
    priceCents: addOn.priceCents,
    photoUrl: addOn.photoUrl,
  };
}

/**
 * Maps a Package entity (with add-ons) to PackageDto
 * Used by all package routes to ensure consistent DTO structure
 *
 * @param pkg - Package entity with add-ons
 * @returns PackageDto with all fields mapped
 */
export function mapPackageToDto(pkg: PackageWithAddOns): PackageDto {
  // Map grouping to tier for frontend consumption
  // Frontend uses tier for display sorting and tier label lookup
  const tier = (pkg.grouping?.toUpperCase() ?? 'BASIC') as
    | 'BASIC'
    | 'STANDARD'
    | 'PREMIUM'
    | 'CUSTOM';

  return {
    id: pkg.id,
    slug: pkg.slug,
    title: pkg.title,
    description: pkg.description,
    priceCents: pkg.priceCents,
    photoUrl: pkg.photoUrl,
    isActive: pkg.active ?? true,
    photos: (pkg.photos ?? []).map(mapPackagePhoto),
    segmentId: pkg.segmentId ?? null,
    grouping: pkg.grouping ?? null,
    groupingOrder: pkg.groupingOrder ?? null,
    bookingType: pkg.bookingType ?? 'DATE',
    tier,
    addOns: pkg.addOns.map(mapAddOn),
  };
}

/**
 * Maps an array of Package entities to PackageDto array
 * Convenience method for mapping multiple packages at once
 *
 * @param packages - Array of package entities with add-ons
 * @returns Array of PackageDto
 */
export function mapPackagesToDto(packages: PackageWithAddOns[]): PackageDto[] {
  return packages.map(mapPackageToDto);
}
