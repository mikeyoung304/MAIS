/**
 * Prisma Catalog Repository Adapter
 */

import { Prisma, type PrismaClient } from '../../generated/prisma';
import type {
  CatalogRepository,
  CreatePackageInput,
  UpdatePackageInput,
  CreateAddOnInput,
  UpdateAddOnInput,
  PackagePhoto,
  PackageWithDraft,
  UpdatePackageDraftInput,
} from '../lib/ports';
import type { Package, AddOn } from '../lib/entities';
import { DomainError } from '../lib/errors';
import { NotFoundError } from '../lib/errors/http';

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAllPackages(tenantId: string): Promise<Package[]> {
    const packages = await this.prisma.package.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map((pkg) => this.toDomainPackage(pkg));
  }

  async getAllPackagesWithAddOns(tenantId: string): Promise<Array<Package & { addOns: AddOn[] }>> {
    const packages = await this.prisma.package.findMany({
      where: { tenantId },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map((pkg) => ({
      ...this.toDomainPackage(pkg),
      addOns: pkg.addOns.map((pa) =>
        this.toDomainAddOn({
          id: pa.addOn.id,
          name: pa.addOn.name,
          description: pa.addOn.description,
          price: pa.addOn.price,
          packages: [{ packageId: pkg.id }],
        })
      ),
    }));
  }

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    const pkg = await this.prisma.package.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    return pkg ? this.toDomainPackage(pkg) : null;
  }

  /**
   * Get package by slug with add-ons in a single query
   *
   * PERFORMANCE FIX: Eliminates N+1 query pattern by fetching package and add-ons together.
   * Used by onPaymentCompleted to avoid separate getPackageBySlug + getAddOnsByPackageId calls.
   *
   * @param tenantId - Tenant ID for isolation
   * @param slug - Package slug identifier
   * @returns Package with add-ons, or null if not found
   */
  async getPackageBySlugWithAddOns(
    tenantId: string,
    slug: string
  ): Promise<(Package & { addOns: AddOn[] }) | null> {
    const pkg = await this.prisma.package.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
    });

    if (!pkg) {
      return null;
    }

    return {
      ...this.toDomainPackage(pkg),
      addOns: pkg.addOns.map((pa) =>
        this.toDomainAddOn({
          id: pa.addOn.id,
          name: pa.addOn.name,
          description: pa.addOn.description,
          price: pa.addOn.price,
          packages: [{ packageId: pkg.id }],
        })
      ),
    };
  }

  async getPackageById(tenantId: string, id: string): Promise<Package | null> {
    const pkg = await this.prisma.package.findFirst({
      where: { tenantId, id },
    });

    return pkg ? this.toDomainPackage(pkg) : null;
  }

  async getPackagesByIds(tenantId: string, ids: string[]): Promise<Package[]> {
    const packages = await this.prisma.package.findMany({
      where: { tenantId, id: { in: ids } },
    });

    return packages.map((pkg) => this.toDomainPackage(pkg));
  }

  async getAllAddOns(tenantId: string): Promise<AddOn[]> {
    const addOns = await this.prisma.addOn.findMany({
      where: { tenantId },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  async getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]> {
    // CRITICAL: Verify package belongs to tenant before querying add-ons
    // This prevents cross-tenant reference attacks where an attacker
    // provides a packageId from another tenant
    const pkg = await this.prisma.package.findFirst({
      where: { tenantId, id: packageId },
      select: { id: true },
    });

    if (!pkg) {
      throw new NotFoundError('Package not found or unauthorized');
    }

    // Now safe to query add-ons - package ownership verified
    const addOns = await this.prisma.addOn.findMany({
      where: {
        tenantId,
        packages: {
          some: {
            packageId: packageId,
          },
        },
      },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    const addOn = await this.prisma.addOn.findFirst({
      where: { tenantId, id },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
    });

    if (!addOn) {
      return null;
    }

    return this.toDomainAddOn(addOn);
  }

  async createPackage(tenantId: string, data: CreatePackageInput): Promise<Package> {
    // Check for slug uniqueness within tenant - use select to minimize data transfer
    const existing = await this.prisma.package.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
      select: { id: true },
    });

    if (existing) {
      throw new DomainError('DUPLICATE_SLUG', `Package with slug '${data.slug}' already exists`);
    }

    const pkg = await this.prisma.package.create({
      data: {
        tenantId,
        slug: data.slug,
        name: data.title,
        description: data.description,
        basePrice: data.priceCents,
        // Tier/segment organization fields
        segmentId: data.segmentId ?? null,
        grouping: data.grouping ?? null,
        groupingOrder: data.groupingOrder ?? null,
      },
    });

    return this.toDomainPackage(pkg);
  }

  async updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package> {
    // Check if package exists for this tenant AND validate slug uniqueness in a single query
    // This reduces database roundtrips from 3 queries to 1 query + 1 update
    const existing = await this.prisma.package.findFirst({
      where: { tenantId, id },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `Package with id '${id}' not found`);
    }

    // If updating slug, check for uniqueness within tenant
    if (data.slug && data.slug !== existing.slug) {
      const duplicateSlug = await this.prisma.package.findUnique({
        where: { tenantId_slug: { tenantId, slug: data.slug } },
        select: { id: true },
      });

      if (duplicateSlug) {
        throw new DomainError('DUPLICATE_SLUG', `Package with slug '${data.slug}' already exists`);
      }
    }

    const pkg = await this.prisma.package.update({
      where: { id, tenantId },
      data: {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.title !== undefined && { name: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priceCents !== undefined && { basePrice: data.priceCents }),
        ...(data.photos !== undefined && {
          photos: data.photos as unknown as Prisma.InputJsonValue,
        }),
        // Tier/segment organization fields
        ...(data.segmentId !== undefined && { segmentId: data.segmentId }),
        ...(data.grouping !== undefined && { grouping: data.grouping }),
        ...(data.groupingOrder !== undefined && { groupingOrder: data.groupingOrder }),
      },
    });

    return this.toDomainPackage(pkg);
  }

  async deletePackage(tenantId: string, id: string): Promise<void> {
    // Check if package exists for this tenant - optimize with select
    const existing = await this.prisma.package.findFirst({
      where: { tenantId, id },
      select: { id: true },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `Package with id '${id}' not found`);
    }

    // Prisma will cascade delete add-ons automatically
    await this.prisma.package.delete({
      where: { id, tenantId },
    });
  }

  async createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn> {
    // Verify package exists for this tenant - optimize with select
    const pkg = await this.prisma.package.findFirst({
      where: { tenantId, id: data.packageId },
      select: { id: true },
    });

    if (!pkg) {
      throw new DomainError('NOT_FOUND', `Package with id '${data.packageId}' not found`);
    }

    const addOn = await this.prisma.addOn.create({
      data: {
        tenantId,
        slug: `${data.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: data.title,
        price: data.priceCents,
        packages: {
          create: {
            packageId: data.packageId,
          },
        },
      },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
    });

    return this.toDomainAddOn(addOn);
  }

  async updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn> {
    // Check if add-on exists for this tenant - optimize with select
    const existing = await this.prisma.addOn.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        packages: {
          select: {
            packageId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `AddOn with id '${id}' not found`);
    }

    // If updating packageId, verify new package exists for this tenant - optimize with select
    if (data.packageId && data.packageId !== existing.packages[0]?.packageId) {
      const pkg = await this.prisma.package.findFirst({
        where: { tenantId, id: data.packageId },
        select: { id: true },
      });

      if (!pkg) {
        throw new DomainError('NOT_FOUND', `Package with id '${data.packageId}' not found`);
      }
    }

    const addOn = await this.prisma.addOn.update({
      where: { id, tenantId },
      data: {
        ...(data.title !== undefined && { name: data.title }),
        ...(data.priceCents !== undefined && { price: data.priceCents }),
        ...(data.packageId !== undefined && {
          packages: {
            deleteMany: {},
            create: {
              packageId: data.packageId,
            },
          },
        }),
      },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
    });

    return this.toDomainAddOn(addOn);
  }

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
    // Check if add-on exists for this tenant - optimize with select
    const existing = await this.prisma.addOn.findFirst({
      where: { tenantId, id },
      select: { id: true },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `AddOn with id '${id}' not found`);
    }

    await this.prisma.addOn.delete({
      where: { id, tenantId },
    });
  }

  /**
   * Get packages for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   * Used for segment landing pages
   *
   * @param tenantId - Tenant ID for isolation
   * @param segmentId - Segment ID to filter packages
   * @returns Array of packages ordered by groupingOrder then createdAt
   */
  async getPackagesBySegment(tenantId: string, segmentId: string): Promise<Package[]> {
    const packages = await this.prisma.package.findMany({
      where: {
        tenantId,
        segmentId,
        active: true,
      },
      orderBy: [{ groupingOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return packages.map((pkg) => this.toDomainPackage(pkg));
  }

  /**
   * Get packages with add-ons for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   * Returns packages with both segment-specific and global add-ons
   * Used for segment landing pages
   *
   * @param tenantId - Tenant ID for isolation
   * @param segmentId - Segment ID to filter packages
   * @returns Array of packages with add-ons, ordered by grouping
   */
  async getPackagesBySegmentWithAddOns(
    tenantId: string,
    segmentId: string
  ): Promise<Array<Package & { addOns: AddOn[] }>> {
    const packages = await this.prisma.package.findMany({
      where: {
        tenantId,
        segmentId,
        active: true,
      },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
      orderBy: [{ groupingOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Filter add-ons to include only those that are segment-specific or global
    return packages.map((pkg) => ({
      ...this.toDomainPackage(pkg),
      addOns: pkg.addOns
        .filter((pa: any) => {
          // Include add-ons that are either segment-specific OR global (null segmentId)
          const addOn = pa.addOn;
          return addOn.active && (addOn.segmentId === segmentId || addOn.segmentId === null);
        })
        .map((pa: any) =>
          this.toDomainAddOn({
            id: pa.addOn.id,
            name: pa.addOn.name,
            description: pa.addOn.description,
            price: pa.addOn.price,
            packages: [{ packageId: pkg.id }],
          })
        ),
    }));
  }

  /**
   * Get add-ons available for a segment
   *
   * Returns both:
   * - Add-ons scoped to this specific segment (segmentId = specified)
   * - Global add-ons available to all segments (segmentId = null)
   *
   * Used for segment landing pages and package detail pages
   *
   * @param tenantId - Tenant ID for isolation
   * @param segmentId - Segment ID to filter add-ons
   * @returns Array of add-ons ordered by createdAt
   */
  async getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]> {
    const addOns = await this.prisma.addOn.findMany({
      where: {
        tenantId,
        // Include add-ons that are either segment-specific OR global
        OR: [{ segmentId }, { segmentId: null }],
        active: true,
      },
      include: {
        packages: {
          select: {
            packageId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  // ============================================================================
  // DRAFT METHODS (Visual Editor)
  // ============================================================================

  /**
   * Get all packages with draft fields for visual editor
   */
  async getAllPackagesWithDrafts(tenantId: string): Promise<PackageWithDraft[]> {
    const packages = await this.prisma.package.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map((pkg) => this.toDomainPackageWithDraft(pkg));
  }

  /**
   * Update draft fields for a package (autosave)
   */
  async updateDraft(
    tenantId: string,
    packageId: string,
    draft: UpdatePackageDraftInput
  ): Promise<PackageWithDraft> {
    const pkg = await this.prisma.package.update({
      where: { id: packageId, tenantId },
      data: {
        ...(draft.title !== undefined && { draftTitle: draft.title }),
        ...(draft.description !== undefined && { draftDescription: draft.description }),
        ...(draft.priceCents !== undefined && { draftPriceCents: draft.priceCents }),
        ...(draft.photos !== undefined && {
          draftPhotos: draft.photos as unknown as Prisma.InputJsonValue,
        }),
        hasDraft: true,
        draftUpdatedAt: new Date(),
      },
    });

    return this.toDomainPackageWithDraft(pkg);
  }

  /**
   * Publish all drafts to live values atomically
   */
  async publishDrafts(tenantId: string, packageIds?: string[]): Promise<Package[]> {
    // Get packages with drafts
    const where: Prisma.PackageWhereInput = {
      tenantId,
      hasDraft: true,
      ...(packageIds && { id: { in: packageIds } }),
    };

    const packagesWithDrafts = await this.prisma.package.findMany({ where });

    if (packagesWithDrafts.length === 0) {
      return [];
    }

    // Apply drafts to live fields in a transaction
    // IMPORTANT: Use explicit null checks (not ??) to preserve intentional field clearing
    // When draftField is "" (empty string), we WANT to apply it, not fall back to live value
    // nullish coalescing (??) treats empty strings correctly, but explicit checks are clearer
    const publishedPackages = await this.prisma.$transaction(
      packagesWithDrafts.map((pkg) =>
        this.prisma.package.update({
          where: { id: pkg.id, tenantId },
          data: {
            // Apply draft values - use draft if edited (not null), else keep current live value
            // Empty strings are valid edits and should NOT fall back to live values
            name: pkg.draftTitle !== null ? pkg.draftTitle : pkg.name,
            description: pkg.draftDescription !== null ? pkg.draftDescription : pkg.description,
            basePrice: pkg.draftPriceCents !== null ? pkg.draftPriceCents : pkg.basePrice,
            photos:
              pkg.draftPhotos !== null
                ? (pkg.draftPhotos as Prisma.InputJsonValue)
                : (pkg.photos as Prisma.InputJsonValue),
            // Clear all draft fields
            draftTitle: null,
            draftDescription: null,
            draftPriceCents: null,
            draftPhotos: Prisma.JsonNull,
            hasDraft: false,
            draftUpdatedAt: null,
          },
        })
      )
    );

    return publishedPackages.map((pkg) => this.toDomainPackage(pkg));
  }

  /**
   * Discard all drafts without publishing
   */
  async discardDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
    const where: Prisma.PackageWhereInput = {
      tenantId,
      hasDraft: true,
      ...(packageIds && { id: { in: packageIds } }),
    };

    const result = await this.prisma.package.updateMany({
      where,
      data: {
        draftTitle: null,
        draftDescription: null,
        draftPriceCents: null,
        draftPhotos: Prisma.JsonNull,
        hasDraft: false,
        draftUpdatedAt: null,
      },
    });

    return result.count;
  }

  /**
   * Count packages with unpublished drafts
   */
  async countDrafts(tenantId: string): Promise<number> {
    return this.prisma.package.count({
      where: { tenantId, hasDraft: true },
    });
  }

  // Mappers
  private toDomainPackage(pkg: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    basePrice: number;
    active: boolean;
    segmentId?: string | null;
    grouping?: string | null;
    groupingOrder?: number | null;
    photos?: Prisma.JsonValue;
    bookingType?: 'DATE' | 'TIMESLOT';
  }): Package {
    return {
      id: pkg.id,
      tenantId: pkg.tenantId,
      slug: pkg.slug,
      title: pkg.name,
      description: pkg.description || '',
      priceCents: pkg.basePrice,
      photoUrl: undefined,
      photos: this.parsePhotosJson(pkg.photos),
      active: pkg.active,
      segmentId: pkg.segmentId,
      grouping: pkg.grouping,
      groupingOrder: pkg.groupingOrder,
      bookingType: pkg.bookingType || 'DATE',
    };
  }

  /**
   * Safely parse photos JSON field which may be:
   * - An actual array (from Prisma JSON deserialization)
   * - A JSON string (from default value "[]" or legacy data)
   * - null/undefined
   */
  private parsePhotosJson(photos: Prisma.JsonValue | undefined): PackagePhoto[] {
    if (!photos) return [];

    // If it's already an array, use it directly
    if (Array.isArray(photos)) {
      return photos as unknown as PackagePhoto[];
    }

    // If it's a string, try to parse it
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private toDomainAddOn(addOn: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    packages: { packageId: string }[];
  }): AddOn {
    if (addOn.packages.length === 0 || !addOn.packages[0]?.packageId) {
      throw new Error(`AddOn ${addOn.id} has no associated package`);
    }

    return {
      id: addOn.id,
      packageId: addOn.packages[0].packageId,
      title: addOn.name,
      description: addOn.description ?? null,
      priceCents: addOn.price,
      photoUrl: undefined,
    };
  }

  /**
   * Map Prisma package to domain PackageWithDraft
   */
  private toDomainPackageWithDraft(pkg: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    basePrice: number;
    active: boolean;
    segmentId: string | null;
    grouping: string | null;
    groupingOrder: number | null;
    photos: Prisma.JsonValue;
    draftTitle: string | null;
    draftDescription: string | null;
    draftPriceCents: number | null;
    draftPhotos: Prisma.JsonValue;
    hasDraft: boolean;
    draftUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PackageWithDraft {
    return {
      id: pkg.id,
      tenantId: pkg.tenantId,
      slug: pkg.slug,
      name: pkg.name,
      description: pkg.description,
      basePrice: pkg.basePrice,
      active: pkg.active,
      segmentId: pkg.segmentId,
      grouping: pkg.grouping,
      groupingOrder: pkg.groupingOrder,
      photos: this.parsePhotosJson(pkg.photos),
      draftTitle: pkg.draftTitle,
      draftDescription: pkg.draftDescription,
      draftPriceCents: pkg.draftPriceCents,
      draftPhotos: pkg.draftPhotos ? this.parsePhotosJson(pkg.draftPhotos) : null,
      hasDraft: pkg.hasDraft,
      draftUpdatedAt: pkg.draftUpdatedAt,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    };
  }
}
