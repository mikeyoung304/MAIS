/**
 * Mock Catalog Repository
 *
 * In-memory implementation of CatalogRepository for testing and local development.
 */

import type { Tier, AddOn } from '../../lib/entities';
import type { CatalogRepository, CreateTierInput, UpdateTierInput } from '../../lib/ports';
import { tiers, addOns } from './state';

export class MockCatalogRepository implements CatalogRepository {
  async getAllTiers(_tenantId: string, _options?: { take?: number }): Promise<Tier[]> {
    return Array.from(tiers.values());
  }

  async getAllTiersWithAddOns(
    _tenantId: string,
    _options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const allTiers = Array.from(tiers.values());
    return allTiers.map((tier) => ({
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    }));
  }

  async getTierBySlug(_tenantId: string, slug: string): Promise<Tier | null> {
    const tier = Array.from(tiers.values()).find((t) => t.slug === slug);
    return tier || null;
  }

  async getTierBySlugWithAddOns(
    _tenantId: string,
    slug: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = Array.from(tiers.values()).find((t) => t.slug === slug);
    if (!tier) {
      return null;
    }
    return {
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    };
  }

  async getTierById(_tenantId: string, id: string): Promise<Tier | null> {
    return tiers.get(id) || null;
  }

  async getTierByIdWithAddOns(
    _tenantId: string,
    id: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = tiers.get(id);
    if (!tier) return null;
    return {
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    };
  }

  async getTiersByIds(_tenantId: string, ids: string[]): Promise<Tier[]> {
    return ids.map((id) => tiers.get(id)).filter((tier): tier is Tier => tier !== undefined);
  }

  async getAllAddOns(_tenantId: string, _options?: { take?: number }): Promise<AddOn[]> {
    return Array.from(addOns.values());
  }

  async getAddOnsByTierId(_tenantId: string, tierId: string): Promise<AddOn[]> {
    return Array.from(addOns.values()).filter((a) => a.tierId === tierId);
  }

  async getAddOnById(_tenantId: string, id: string): Promise<AddOn | null> {
    return addOns.get(id) || null;
  }

  async createTier(tenantId: string, data: CreateTierInput): Promise<Tier> {
    // Check slug uniqueness
    const existing = await this.getTierBySlug(tenantId, data.slug);
    if (existing) {
      throw new Error(`Tier with slug "${data.slug}" already exists`);
    }

    const tier: Tier = {
      id: `tier_${Date.now()}`,
      tenantId,
      slug: data.slug,
      title: data.title,
      description: data.description,
      priceCents: data.priceCents,
      displayPriceCents: data.displayPriceCents ?? null,
      photos: data.photos || [],
      active: true,
      segmentId: data.segmentId ?? null,
      groupingOrder: data.groupingOrder ?? null,
      bookingType: 'DATE',
      maxGuests: data.maxGuests ?? null,
      scalingRules: data.scalingRules ?? null,
    };
    tiers.set(tier.id, tier);
    return tier;
  }

  async updateTier(tenantId: string, id: string, data: UpdateTierInput): Promise<Tier> {
    const tier = tiers.get(id);
    if (!tier) {
      throw new Error(`Tier with id "${id}" not found`);
    }

    // Check slug uniqueness if updating slug
    if (data.slug && data.slug !== tier.slug) {
      const existing = await this.getTierBySlug(tenantId, data.slug);
      if (existing) {
        throw new Error(`Tier with slug "${data.slug}" already exists`);
      }
    }

    const updated: Tier = {
      ...tier,
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.displayPriceCents !== undefined && { displayPriceCents: data.displayPriceCents }),
      ...(data.segmentId !== undefined && { segmentId: data.segmentId }),
      ...(data.groupingOrder !== undefined && { groupingOrder: data.groupingOrder }),
      ...(data.photos !== undefined && { photos: data.photos }),
      ...(data.maxGuests !== undefined && { maxGuests: data.maxGuests }),
      ...(data.scalingRules !== undefined && { scalingRules: data.scalingRules }),
    };
    tiers.set(id, updated);
    return updated;
  }

  async deleteTier(_tenantId: string, id: string): Promise<void> {
    const tier = tiers.get(id);
    if (!tier) {
      throw new Error(`Tier with id "${id}" not found`);
    }

    // Also delete associated add-ons
    const tierAddOns = Array.from(addOns.values()).filter((a) => a.tierId === id);
    tierAddOns.forEach((addOn) => addOns.delete(addOn.id));

    tiers.delete(id);
  }

  async createAddOn(
    _tenantId: string,
    data: {
      tierId: string;
      title: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    // Verify tier exists
    const tier = tiers.get(data.tierId);
    if (!tier) {
      throw new Error(`Tier with id "${data.tierId}" not found`);
    }

    const addOn: AddOn = {
      id: `addon_${Date.now()}`,
      ...data,
    };
    addOns.set(addOn.id, addOn);
    return addOn;
  }

  async updateAddOn(
    _tenantId: string,
    id: string,
    data: {
      tierId?: string;
      title?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }

    // Verify tier exists if updating tierId
    if (data.tierId && data.tierId !== addOn.tierId) {
      const tier = tiers.get(data.tierId);
      if (!tier) {
        throw new Error(`Tier with id "${data.tierId}" not found`);
      }
    }

    const updated: AddOn = {
      ...addOn,
      ...data,
    };
    addOns.set(id, updated);
    return updated;
  }

  async deleteAddOn(_tenantId: string, id: string): Promise<void> {
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }
    addOns.delete(id);
  }

  // Segment-scoped methods
  async getTiersBySegment(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<Tier[]> {
    return Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
  }

  async getTiersBySegmentWithAddOns(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const segmentTiers = Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
    return segmentTiers.map((tier) => ({
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    }));
  }

  async getAddOnsForSegment(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<AddOn[]> {
    const segmentTiers = Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
    const tierIds = new Set(segmentTiers.map((t) => t.id));
    return Array.from(addOns.values()).filter((a) => tierIds.has(a.tierId));
  }
}
