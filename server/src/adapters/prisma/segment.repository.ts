/**
 * Prisma repository for Segment data access
 * Provides data layer for tenant segment operations (e.g., "Wellness Retreat", "Micro-Wedding")
 */

import { PrismaClient, Segment } from '../../generated/prisma';

/**
 * Decode HTML entities in a URL string
 * Fixes cases where URLs get accidentally HTML-encoded (e.g., &#x2F; instead of /)
 * This can happen due to browser extensions, clipboard operations, or XML serialization
 */
function decodeHtmlEntitiesInUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Decode common HTML entities that might appear in URLs
  return url
    .replace(/&#x2F;/g, '/')
    .replace(/&#47;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#x3A;/g, ':')
    .replace(/&#58;/g, ':')
    .replace(/&#x3F;/g, '?')
    .replace(/&#63;/g, '?')
    .replace(/&#x3D;/g, '=')
    .replace(/&#61;/g, '=');
}

export interface CreateSegmentInput {
  tenantId: string;
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

export interface UpdateSegmentInput {
  slug?: string;
  name?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  sortOrder?: number;
  active?: boolean;
}

/**
 * Segment repository for CRUD operations
 * Handles tenant-scoped segment management
 */
export class PrismaSegmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find segment by ID with tenant isolation
   *
   * @param tenantId - Tenant ID for isolation (CRITICAL: prevents cross-tenant access)
   * @param id - Segment ID (CUID)
   * @returns Segment or null if not found
   */
  async findById(tenantId: string, id: string): Promise<Segment | null> {
    return await this.prisma.segment.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Find segment by tenant and slug
   * Used for URL routing (e.g., /wellness-retreat)
   *
   * @param tenantId - Tenant ID for isolation
   * @param slug - URL-safe segment identifier
   * @returns Segment or null if not found
   */
  async findBySlug(tenantId: string, slug: string): Promise<Segment | null> {
    return await this.prisma.segment.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });
  }

  /**
   * List all segments for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @param onlyActive - Filter to only active segments (default: true)
   * @returns Array of segments ordered by sortOrder
   */
  async findByTenant(tenantId: string, onlyActive = true): Promise<Segment[]> {
    return await this.prisma.segment.findMany({
      where: {
        tenantId,
        ...(onlyActive ? { active: true } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create new segment
   *
   * @param data - Segment creation data
   * @returns Created segment
   */
  async create(data: CreateSegmentInput): Promise<Segment> {
    return await this.prisma.segment.create({
      data: {
        tenantId: data.tenantId,
        slug: data.slug,
        name: data.name,
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        // Sanitize heroImage URL to prevent HTML-encoded entities
        heroImage: decodeHtmlEntitiesInUrl(data.heroImage),
        description: data.description,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        sortOrder: data.sortOrder ?? 0,
        active: data.active ?? true,
      },
    });
  }

  /**
   * Update segment by ID with tenant isolation
   *
   * @param tenantId - Tenant ID for isolation (CRITICAL: prevents cross-tenant modification)
   * @param id - Segment ID
   * @param data - Partial segment update data
   * @returns Updated segment
   * @throws Error if segment not found or belongs to different tenant
   */
  async update(tenantId: string, id: string, data: UpdateSegmentInput): Promise<Segment> {
    // First verify ownership
    const existing = await this.prisma.segment.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error(`Segment not found or access denied: ${id}`);
    }

    // Sanitize heroImage URL if present to prevent HTML-encoded entities
    const sanitizedData = {
      ...data,
      heroImage: data.heroImage !== undefined ? decodeHtmlEntitiesInUrl(data.heroImage) : undefined,
    };

    return await this.prisma.segment.update({
      where: { id, tenantId },
      data: sanitizedData,
    });
  }

  /**
   * Delete segment by ID with tenant isolation
   * Note: Packages will have segmentId set to null (onDelete: SetNull)
   *
   * @param tenantId - Tenant ID for isolation (CRITICAL: prevents cross-tenant deletion)
   * @param id - Segment ID
   * @throws Error if segment not found or belongs to different tenant
   */
  async delete(tenantId: string, id: string): Promise<void> {
    // Verify ownership before deletion
    const existing = await this.prisma.segment.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error(`Segment not found or access denied: ${id}`);
    }

    await this.prisma.segment.delete({
      where: { id, tenantId },
    });
  }

  /**
   * Get segment with related packages with tenant isolation
   *
   * @param tenantId - Tenant ID for isolation (CRITICAL: prevents cross-tenant data access)
   * @param id - Segment ID
   * @returns Segment with packages or null if not found
   */
  async findByIdWithPackages(
    tenantId: string,
    id: string
  ): Promise<
    | (Segment & {
        packages: any[];
      })
    | null
  > {
    return await this.prisma.segment.findFirst({
      where: { id, tenantId },
      include: {
        packages: {
          where: { active: true },
          orderBy: [{ groupingOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  /**
   * Get segment by slug with related packages and add-ons
   * Used for public segment landing pages
   *
   * @param tenantId - Tenant ID for isolation
   * @param slug - URL-safe segment identifier
   * @returns Segment with packages and add-ons or null if not found
   */
  async findBySlugWithRelations(
    tenantId: string,
    slug: string
  ): Promise<
    | (Segment & {
        packages: any[];
        addOns: any[];
      })
    | null
  > {
    // Use Promise.all to fetch segment and global add-ons in parallel (single round-trip)
    const [segment, globalAddOns] = await Promise.all([
      this.prisma.segment.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug,
          },
        },
        include: {
          packages: {
            where: { active: true },
            orderBy: [{ groupingOrder: 'asc' }, { name: 'asc' }],
            include: {
              addOns: {
                include: {
                  addOn: true,
                },
              },
            },
          },
          addOns: {
            where: { active: true },
          },
        },
      }),
      // Fetch global add-ons (segmentId = null) in parallel
      this.prisma.addOn.findMany({
        where: {
          tenantId,
          segmentId: null,
          active: true,
        },
      }),
    ]);

    if (!segment) {
      return null;
    }

    // Merge segment-specific and global add-ons
    return {
      ...segment,
      addOns: [...segment.addOns, ...globalAddOns],
    };
  }

  /**
   * Get segment statistics (package count, booking count) with tenant isolation
   *
   * @param tenantId - Tenant ID for isolation (CRITICAL: prevents cross-tenant data access)
   * @param id - Segment ID
   * @returns Object with counts
   * @throws Error if segment not found or belongs to different tenant
   */
  async getStats(
    tenantId: string,
    id: string
  ): Promise<{
    packageCount: number;
    addOnCount: number;
  }> {
    const segment = await this.prisma.segment.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            packages: true,
            addOns: true,
          },
        },
      },
    });

    if (!segment) {
      throw new Error(`Segment not found or access denied: ${id}`);
    }

    return {
      packageCount: segment._count.packages,
      addOnCount: segment._count.addOns,
    };
  }

  /**
   * Check if segment slug is available for tenant
   *
   * @param tenantId - Tenant ID
   * @param slug - Desired slug
   * @param excludeId - Segment ID to exclude (for updates)
   * @returns True if slug is available
   */
  async isSlugAvailable(tenantId: string, slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.segment.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });

    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    return false;
  }
}
