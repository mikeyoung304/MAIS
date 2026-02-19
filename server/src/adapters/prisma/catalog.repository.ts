/**
 * Prisma Catalog Repository Adapter
 *
 * All queries use prisma.tier.* — Package model was dropped in Phase 3.1.
 */

import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import type {
  CatalogRepository,
  CreateTierInput,
  UpdateTierInput,
  CreateAddOnInput,
  UpdateAddOnInput,
} from '../../lib/ports';
import type { Tier, TierPhoto, AddOn } from '../../lib/entities';
import { DomainError } from '../../lib/errors';
import { NotFoundError } from '../../lib/errors/http';
import { QueryLimits } from '../../lib/core/query-limits';

const DEFAULT_PAGE_SIZE = QueryLimits.DEFAULT_PAGE_SIZE;
const MAX_PAGE_SIZE = QueryLimits.CATALOG_MAX;

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAllTiers(tenantId: string, options?: { take?: number }): Promise<Tier[]> {
    const tiers = await this.prisma.tier.findMany({
      where: { tenantId },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: { createdAt: 'asc' },
    });

    return tiers.map((tier) => this.toDomainTier(tier));
  }

  async getAllTiersWithAddOns(
    tenantId: string,
    options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const tiers = await this.prisma.tier.findMany({
      where: { tenantId },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: { createdAt: 'asc' },
    });

    return tiers.map((tier) => ({
      ...this.toDomainTier(tier),
      addOns: tier.addOns.map((ta) =>
        this.toDomainAddOn({
          id: ta.addOn.id,
          name: ta.addOn.name,
          description: ta.addOn.description,
          price: ta.addOn.price,
          tiers: [{ tierId: tier.id }],
        })
      ),
    }));
  }

  async getTierBySlug(tenantId: string, slug: string): Promise<Tier | null> {
    const tier = await this.prisma.tier.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    return tier ? this.toDomainTier(tier) : null;
  }

  /**
   * Get tier by slug with add-ons in a single query
   *
   * PERFORMANCE FIX: Eliminates N+1 query pattern by fetching tier and add-ons together.
   * Used by onPaymentCompleted to avoid separate getTierBySlug + getAddOnsByTierId calls.
   */
  async getTierBySlugWithAddOns(
    tenantId: string,
    slug: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = await this.prisma.tier.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
    });

    if (!tier) {
      return null;
    }

    return {
      ...this.toDomainTier(tier),
      addOns: tier.addOns.map((ta) =>
        this.toDomainAddOn({
          id: ta.addOn.id,
          name: ta.addOn.name,
          description: ta.addOn.description,
          price: ta.addOn.price,
          tiers: [{ tierId: tier.id }],
        })
      ),
    };
  }

  async getTierById(tenantId: string, id: string): Promise<Tier | null> {
    const tier = await this.prisma.tier.findFirst({
      where: { tenantId, id },
    });

    return tier ? this.toDomainTier(tier) : null;
  }

  /**
   * Get tier by ID with add-ons in a single query.
   * Used by onPaymentCompleted when we have tier ID from Stripe metadata.
   */
  async getTierByIdWithAddOns(
    tenantId: string,
    id: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = await this.prisma.tier.findFirst({
      where: { tenantId, id },
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
    });

    if (!tier) {
      return null;
    }

    return {
      ...this.toDomainTier(tier),
      addOns: tier.addOns.map((ta) =>
        this.toDomainAddOn({
          id: ta.addOn.id,
          name: ta.addOn.name,
          description: ta.addOn.description,
          price: ta.addOn.price,
          tiers: [{ tierId: tier.id }],
        })
      ),
    };
  }

  async getTiersByIds(tenantId: string, ids: string[]): Promise<Tier[]> {
    // Inherently bounded: `in: ids` limits results to the caller-provided ID array
    const tiers = await this.prisma.tier.findMany({
      where: { tenantId, id: { in: ids } },
    });

    return tiers.map((tier) => this.toDomainTier(tier));
  }

  async getAllAddOns(tenantId: string, options?: { take?: number }): Promise<AddOn[]> {
    const addOns = await this.prisma.addOn.findMany({
      where: { tenantId },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  async getAddOnsByTierId(tenantId: string, tierId: string): Promise<AddOn[]> {
    // CRITICAL: Verify tier belongs to tenant before querying add-ons
    // This prevents cross-tenant reference attacks where an attacker
    // provides a tierId from another tenant
    const tier = await this.prisma.tier.findFirst({
      where: { tenantId, id: tierId },
      select: { id: true },
    });

    if (!tier) {
      throw new NotFoundError('Tier not found or unauthorized');
    }

    // Now safe to query add-ons - tier ownership verified
    const addOns = await this.prisma.addOn.findMany({
      where: {
        tenantId,
        tiers: {
          some: {
            tierId: tierId,
          },
        },
      },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
      take: MAX_PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    const addOn = await this.prisma.addOn.findFirst({
      where: { tenantId, id },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
    });

    if (!addOn) {
      return null;
    }

    return this.toDomainAddOn(addOn);
  }

  async createTier(tenantId: string, data: CreateTierInput): Promise<Tier> {
    // Check for slug uniqueness within tenant
    const existing = await this.prisma.tier.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
      select: { id: true },
    });

    if (existing) {
      throw new DomainError('DUPLICATE_SLUG', `Tier with slug '${data.slug}' already exists`);
    }

    const tier = await this.prisma.tier.create({
      data: {
        tenantId,
        slug: data.slug,
        name: data.title,
        description: data.description,
        priceCents: data.priceCents,
        displayPriceCents: data.displayPriceCents ?? null,
        segmentId: data.segmentId ?? '',
        sortOrder: data.groupingOrder ?? 0,
        features: {},
        maxGuests: data.maxGuests ?? null,
        scalingRules: (data.scalingRules as unknown as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return this.toDomainTier(tier);
  }

  async updateTier(tenantId: string, id: string, data: UpdateTierInput): Promise<Tier> {
    const existing = await this.prisma.tier.findFirst({
      where: { tenantId, id },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `Tier with id '${id}' not found`);
    }

    // If updating slug, check for uniqueness within tenant
    if (data.slug && data.slug !== existing.slug) {
      const duplicateSlug = await this.prisma.tier.findUnique({
        where: { tenantId_slug: { tenantId, slug: data.slug } },
        select: { id: true },
      });

      if (duplicateSlug) {
        throw new DomainError('DUPLICATE_SLUG', `Tier with slug '${data.slug}' already exists`);
      }
    }

    // Build update data as TierUncheckedUpdateInput to avoid Prisma 7
    // discriminated union conflict between checked/unchecked update paths
    const updateData: Prisma.TierUncheckedUpdateInput = {};
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.title !== undefined) updateData.name = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
    if (data.displayPriceCents !== undefined) updateData.displayPriceCents = data.displayPriceCents;
    if (data.photos !== undefined)
      updateData.photos = data.photos as unknown as Prisma.InputJsonValue;
    if (data.segmentId !== undefined && data.segmentId !== null)
      updateData.segmentId = data.segmentId;
    if (data.groupingOrder !== undefined) updateData.sortOrder = data.groupingOrder;
    if (data.maxGuests !== undefined) updateData.maxGuests = data.maxGuests;
    if (data.scalingRules !== undefined)
      updateData.scalingRules = data.scalingRules as unknown as Prisma.InputJsonValue;

    const tier = await this.prisma.tier.update({
      where: { id, tenantId },
      data: updateData,
    });

    return this.toDomainTier(tier);
  }

  async deleteTier(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.tier.findFirst({
      where: { tenantId, id },
      select: { id: true },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `Tier with id '${id}' not found`);
    }

    await this.prisma.tier.delete({
      where: { id, tenantId },
    });
  }

  async createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn> {
    // Verify tier exists for this tenant
    const tier = await this.prisma.tier.findFirst({
      where: { tenantId, id: data.tierId },
      select: { id: true },
    });

    if (!tier) {
      throw new DomainError('NOT_FOUND', `Tier with id '${data.tierId}' not found`);
    }

    const addOn = await this.prisma.addOn.create({
      data: {
        tenantId,
        slug: `${data.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: data.title,
        price: data.priceCents,
        tiers: {
          create: {
            tierId: data.tierId,
          },
        },
      },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
    });

    return this.toDomainAddOn(addOn);
  }

  async updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn> {
    const existing = await this.prisma.addOn.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new DomainError('NOT_FOUND', `AddOn with id '${id}' not found`);
    }

    // If updating tierId, verify new tier exists for this tenant
    if (data.tierId && data.tierId !== existing.tiers[0]?.tierId) {
      const tier = await this.prisma.tier.findFirst({
        where: { tenantId, id: data.tierId },
        select: { id: true },
      });

      if (!tier) {
        throw new DomainError('NOT_FOUND', `Tier with id '${data.tierId}' not found`);
      }
    }

    const addOn = await this.prisma.addOn.update({
      where: { id, tenantId },
      data: {
        ...(data.title !== undefined && { name: data.title }),
        ...(data.priceCents !== undefined && { price: data.priceCents }),
        ...(data.tierId !== undefined && {
          tiers: {
            deleteMany: {},
            create: {
              tierId: data.tierId,
            },
          },
        }),
      },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
    });

    return this.toDomainAddOn(addOn);
  }

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
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
   * Get tiers for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   */
  async getTiersBySegment(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<Tier[]> {
    const tiers = await this.prisma.tier.findMany({
      where: {
        tenantId,
        segmentId,
        active: true,
      },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return tiers.map((tier) => this.toDomainTier(tier));
  }

  /**
   * Get tiers with add-ons for a specific segment
   *
   * MULTI-TENANT: Scoped by tenantId and segmentId
   * Returns tiers with both segment-specific and global add-ons
   */
  async getTiersBySegmentWithAddOns(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const tiers = await this.prisma.tier.findMany({
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
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return tiers.map((tier) => ({
      ...this.toDomainTier(tier),
      addOns: tier.addOns
        .filter((ta: any) => {
          const addOn = ta.addOn;
          return addOn.active && (addOn.segmentId === segmentId || addOn.segmentId === null);
        })
        .map((ta: any) =>
          this.toDomainAddOn({
            id: ta.addOn.id,
            name: ta.addOn.name,
            description: ta.addOn.description,
            price: ta.addOn.price,
            tiers: [{ tierId: tier.id }],
          })
        ),
    }));
  }

  /**
   * Get add-ons available for a segment
   *
   * Returns both segment-specific and global add-ons
   */
  async getAddOnsForSegment(
    tenantId: string,
    segmentId: string,
    options?: { take?: number }
  ): Promise<AddOn[]> {
    const addOns = await this.prisma.addOn.findMany({
      where: {
        tenantId,
        OR: [{ segmentId }, { segmentId: null }],
        active: true,
      },
      include: {
        tiers: {
          select: {
            tierId: true,
          },
        },
      },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      orderBy: { createdAt: 'asc' },
    });

    return addOns.map(this.toDomainAddOn);
  }

  // Mappers
  private toDomainTier(tier: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    displayPriceCents?: number | null;
    active: boolean;
    segmentId?: string | null;
    sortOrder?: number | null;
    photos?: Prisma.JsonValue;
    bookingType?: 'DATE' | 'TIMESLOT';
    maxGuests?: number | null;
    scalingRules?: Prisma.JsonValue;
  }): Tier {
    return {
      id: tier.id,
      tenantId: tier.tenantId,
      slug: tier.slug,
      title: tier.name,
      description: tier.description || '',
      priceCents: tier.priceCents,
      displayPriceCents: tier.displayPriceCents ?? null,
      photoUrl: undefined,
      photos: this.parsePhotosJson(tier.photos),
      active: tier.active,
      segmentId: tier.segmentId,
      grouping: null,
      groupingOrder: tier.sortOrder,
      bookingType: tier.bookingType || 'DATE',
      maxGuests: tier.maxGuests ?? null,
      scalingRules: tier.scalingRules as Tier['scalingRules'],
    };
  }

  /**
   * Safely parse photos JSON field
   */
  private parsePhotosJson(photos: Prisma.JsonValue | undefined): TierPhoto[] {
    if (!photos) return [];

    if (Array.isArray(photos)) {
      return photos as unknown as TierPhoto[];
    }

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
    tiers: { tierId: string }[];
  }): AddOn {
    if (addOn.tiers.length === 0 || !addOn.tiers[0]?.tierId) {
      throw new Error(`AddOn ${addOn.id} has no associated tier`);
    }

    return {
      id: addOn.id,
      tierId: addOn.tiers[0].tierId,
      title: addOn.name,
      description: addOn.description ?? null,
      priceCents: addOn.price,
      photoUrl: undefined,
    };
  }
}
