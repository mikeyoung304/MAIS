/**
 * Unit tests for littlebit.farm seed (seeds/little-bit-horse-farm.ts)
 *
 * Tests:
 * - Segment creation (3 segments: Elopements, Corporate Retreats, Weekend Getaway)
 * - 8 tiers (3 + 3 + 2) with displayPriceCents + Airbnb split
 * - Section content (HERO, FEATURES, ABOUT, SERVICES, FAQ, CTA)
 * - Idempotency (safe to run multiple times)
 * - Production guard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing anything that uses it
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock api-key service
vi.mock('../../src/lib/api-key.service', () => ({
  apiKeyService: {
    hashSecretKey: vi.fn().mockReturnValue('hashed-secret-key'),
  },
}));

// Mock crypto for deterministic testing
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn().mockImplementation((size: number) => ({
        toString: () => '0'.repeat(size * 2),
      })),
    },
    randomBytes: vi.fn().mockImplementation((size: number) => ({
      toString: () => '0'.repeat(size * 2),
    })),
  };
});

import { seedLittleBitHorseFarm } from '../../prisma/seeds/little-bit-horse-farm';
import type { PrismaClient } from '../../src/generated/prisma/client';

describe('littlebit.farm Seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Segment Creation', () => {
    it('should create 3 segments (Elopements, Corporate Retreats, Weekend Getaway)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.segment.upsert).toHaveBeenCalledTimes(3);
      const slugs = mockPrisma.segment.upsert.mock.calls.map((c) => c[0].where.tenantId_slug.slug);
      expect(slugs).toContain('elopements');
      expect(slugs).toContain('corporate_retreats');
      expect(slugs).toContain('weekend_getaway');
    });

    it('should create Elopements segment with correct hero', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const call = mockPrisma.segment.upsert.mock.calls.find(
        (c) => c[0].where.tenantId_slug.slug === 'elopements'
      );
      expect(call).toBeDefined();
      expect(call![0].create.name).toBe('Elopements & Vow Renewals');
      expect(call![0].create.heroTitle).toBe('Simple. Calm. Beautiful.');
    });

    it('should include Airbnb pricing note in segment descriptions', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      mockPrisma.segment.upsert.mock.calls.forEach((call) => {
        const desc = call[0].create.description as string;
        expect(desc).toContain('Airbnb accommodation ($200/night)');
        expect(desc).toContain('House rules');
      });
    });
  });

  describe('Tier Creation (8 Total - 3+3+2)', () => {
    it('should create 8 tiers (3 elopement + 3 corporate + 2 weekend)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.tier.upsert).toHaveBeenCalledTimes(8);
    });

    it('should create Simple Ceremony with correct Airbnb split pricing', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.tier.upsert.mock.calls;
      const tier = calls.find((c) => c[0].where.tenantId_slug.slug === 'simple-ceremony');

      expect(tier).toBeDefined();
      expect(tier![0].create.name).toBe('Simple Ceremony');
      expect(tier![0].create.priceCents).toBe(80000); // $800 experience
      expect(tier![0].create.displayPriceCents).toBe(100000); // $1,000 all-in
      expect(tier![0].create.maxGuests).toBe(6); // Elopement T1 max 6
      expect(tier![0].create.sortOrder).toBe(1);
    });

    it('should enforce max 6 guests only on elopement tier 1', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.tier.upsert.mock.calls;

      // Simple Ceremony (elopement T1) = 6
      const simpleCeremony = calls.find((c) => c[0].where.tenantId_slug.slug === 'simple-ceremony');
      expect(simpleCeremony![0].create.maxGuests).toBe(6);

      // All others = 10
      const otherTiers = calls.filter((c) => c[0].where.tenantId_slug.slug !== 'simple-ceremony');
      otherTiers.forEach((call) => {
        expect(call[0].create.maxGuests).toBe(10);
      });
    });

    it('should set scaling rules on tiers with per-person pricing', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.tier.upsert.mock.calls;

      // Celebration Ceremony has grazing board scaling
      const celebration = calls.find(
        (c) => c[0].where.tenantId_slug.slug === 'celebration-ceremony'
      );
      const celebrationRules = celebration![0].create.scalingRules;
      expect(celebrationRules.components).toHaveLength(1);
      expect(celebrationRules.components[0].name).toBe('Grazing Board');
      expect(celebrationRules.components[0].perPersonCents).toBe(2500);

      // All dinner tiers use consistent $75/person scaling
      const dinnerTiers = calls.filter((c) =>
        ['ceremony-open-fire-dinner', 'retreat-fireside-dinner', 'girls-weekend-dinner'].includes(
          c[0].where.tenantId_slug.slug
        )
      );
      expect(dinnerTiers).toHaveLength(3);
      dinnerTiers.forEach((call) => {
        const rules = call[0].create.scalingRules;
        expect(rules.components).toHaveLength(1);
        expect(rules.components[0].name).toBe('Open Fire Dinner');
        expect(rules.components[0].perPersonCents).toBe(7500); // $75/person
      });
    });

    it('should set displayPriceCents on all tiers (Airbnb-inclusive)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.tier.upsert.mock.calls;

      // Every tier should have displayPriceCents > priceCents (by $200 = 20000 cents)
      calls.forEach((call) => {
        const displayPrice = call[0].create.displayPriceCents;
        const chargePrice = call[0].create.priceCents;
        expect(displayPrice).toBe(chargePrice + 20000);
      });
    });

    it('should assign tiers to their correct segments', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const tierCalls = mockPrisma.tier.upsert.mock.calls;

      // Elopements segment tiers should reference segment-elopements
      const simpleCeremony = tierCalls.find(
        (c) => c[0].where.tenantId_slug.slug === 'simple-ceremony'
      );
      expect(simpleCeremony).toBeDefined();
      expect(simpleCeremony![0].create.segmentId).toBe('segment-elopements');

      // Corporate Retreats segment tiers should reference segment-corporate_retreats
      const focusedDay = tierCalls.find((c) => c[0].where.tenantId_slug.slug === 'focused-day');
      expect(focusedDay).toBeDefined();
      expect(focusedDay![0].create.segmentId).toBe('segment-corporate_retreats');

      // Weekend Getaway segment tiers should reference segment-weekend_getaway
      const girlsWeekend = tierCalls.find((c) => c[0].where.tenantId_slug.slug === 'girls-weekend');
      expect(girlsWeekend).toBeDefined();
      expect(girlsWeekend![0].create.segmentId).toBe('segment-weekend_getaway');
    });
  });

  describe('Section Content', () => {
    it('should create 6 section content blocks (HERO, FEATURES, ABOUT, SERVICES, FAQ, CTA)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.sectionContent.create).toHaveBeenCalledTimes(6);
      const blockTypes = mockPrisma.sectionContent.create.mock.calls.map(
        (c) => c[0].data.blockType
      );
      expect(blockTypes).toContain('HERO');
      expect(blockTypes).toContain('FEATURES');
      expect(blockTypes).toContain('ABOUT');
      expect(blockTypes).toContain('SERVICES');
      expect(blockTypes).toContain('FAQ');
      expect(blockTypes).toContain('CTA');
    });

    it('should create FEATURES section with How It Works content', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const featuresCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'FEATURES'
      );
      expect(featuresCall).toBeDefined();
      const content = featuresCall![0].data.content as Record<string, unknown>;
      expect(content.title).toBe('How It Works');
      const items = content.items as Array<{ title: string; description: string }>;
      expect(items).toHaveLength(4);
      expect(items[2].description).toContain('Airbnb accommodation');
    });

    it('should create FAQ section with parking and Airbnb questions', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const faqCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'FAQ'
      );
      expect(faqCall).toBeDefined();
      const content = faqCall![0].data.content as Record<string, unknown>;
      const items = content.items as Array<{ question: string; answer: string }>;
      expect(items.length).toBeGreaterThanOrEqual(6);
      const questions = items.map((i) => i.question);
      expect(questions).toContain('How does pricing work?');
      expect(questions).toContain('How many cars can we bring?');
    });

    it('should create HERO section with background and CTA', async () => {
      const mockPrisma = createMockPrisma(null);
      await seedLittleBitHorseFarm(mockPrisma);
      const heroCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'HERO'
      );
      expect(heroCall).toBeDefined();
      const content = heroCall![0].data.content as Record<string, unknown>;
      expect(content.headline).toBeDefined();
      expect(content.alignment).toBe('center');
    });

    it('should create ABOUT section with story content and image', async () => {
      const mockPrisma = createMockPrisma(null);
      await seedLittleBitHorseFarm(mockPrisma);
      const aboutCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'ABOUT'
      );
      expect(aboutCall).toBeDefined();
      const content = aboutCall![0].data.content as Record<string, unknown>;
      expect(content.title).toBe('The Story');
      expect(content.imagePosition).toBe('right');
    });

    it('should create CTA section with booking prompt', async () => {
      const mockPrisma = createMockPrisma(null);
      await seedLittleBitHorseFarm(mockPrisma);
      const ctaCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'CTA'
      );
      expect(ctaCall).toBeDefined();
      const content = ctaCall![0].data.content as Record<string, unknown>;
      expect(content.headline).toBeDefined();
      expect(content.buttonText).toBeDefined();
      expect(content.style).toBeDefined();
    });

    it('should create SERVICES section with pricing cards', async () => {
      const mockPrisma = createMockPrisma(null);
      await seedLittleBitHorseFarm(mockPrisma);
      const servicesCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'SERVICES'
      );
      expect(servicesCall).toBeDefined();
      const content = servicesCall![0].data.content as Record<string, unknown>;
      expect(content.showPricing).toBe(true);
      expect(content.layout).toBe('cards');
    });

    it('should publish all section content (isDraft: false)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      mockPrisma.sectionContent.create.mock.calls.forEach((call) => {
        expect(call[0].data.isDraft).toBe(false);
        expect(call[0].data.publishedAt).toBeDefined();
      });
    });
  });

  describe('Idempotency', () => {
    it('should clear existing data before creating new data', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.tierAddOn.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.tier.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.addOn.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.sectionContent.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.segment.deleteMany).toHaveBeenCalled();
    });

    it('should preserve API keys on update', async () => {
      const existingTenant = {
        id: 'tenant-lbf-123',
        slug: 'littlebit-farm',
        name: 'littlebit.farm',
        apiKeyPublic: 'pk_live_littlebit-farm_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedLittleBitHorseFarm(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.update.apiKeyPublic).toBeUndefined();
      expect(upsertCall.update.apiKeySecret).toBeUndefined();
    });
  });

  describe('Booking Safety Guard (#11002)', () => {
    it('should skip destructive deleteMany when bookings exist', async () => {
      const mockPrisma = createMockPrisma(null);
      // Simulate existing bookings
      (
        mockPrisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
      ).booking.count = vi.fn().mockResolvedValue(3);

      await seedLittleBitHorseFarm(mockPrisma);

      // deleteMany should NOT be called on tier/addOn/segment (FK Restrict would fail)
      expect(mockPrisma.tier.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.addOn.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.segment.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.tierAddOn.deleteMany).not.toHaveBeenCalled();

      // sectionContent deleteMany IS safe (no FK from bookings)
      expect(mockPrisma.sectionContent.deleteMany).toHaveBeenCalled();

      // Upserts should still run (tiers, segments created via upsert)
      expect(mockPrisma.segment.upsert).toHaveBeenCalledTimes(3);
      expect(mockPrisma.tier.upsert).toHaveBeenCalledTimes(8);
    });

    it('should use clean slate deleteMany when no bookings exist', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.tier.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.addOn.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.segment.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Blackout Dates', () => {
    it('should create holiday blackout dates', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.blackoutDate.upsert).toHaveBeenCalled();
      const reasons = mockPrisma.blackoutDate.upsert.mock.calls.map((c) => c[0].create.reason);

      expect(reasons).toContain('Christmas Eve');
      expect(reasons).toContain('Christmas Day');
      expect(reasons).toContain("New Year's Eve");
      expect(reasons).toContain('Thanksgiving');
    });
  });

  describe('Production Guard', () => {
    it('should throw error in production without ALLOW_PRODUCTION_SEED', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PRODUCTION_SEED;

      const mockPrisma = createMockPrisma(null);

      await expect(seedLittleBitHorseFarm(mockPrisma)).rejects.toThrow(
        'Production seed blocked. Set ALLOW_PRODUCTION_SEED=true to override.'
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should proceed in production with ALLOW_PRODUCTION_SEED=true', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAllowSeed = process.env.ALLOW_PRODUCTION_SEED;
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_PRODUCTION_SEED = 'true';

      const mockPrisma = createMockPrisma(null);

      await expect(seedLittleBitHorseFarm(mockPrisma)).resolves.not.toThrow();

      process.env.NODE_ENV = originalNodeEnv;
      if (originalAllowSeed !== undefined) {
        process.env.ALLOW_PRODUCTION_SEED = originalAllowSeed;
      } else {
        delete process.env.ALLOW_PRODUCTION_SEED;
      }
    });
  });
});

/**
 * Create a mock PrismaClient for testing
 */
function createMockPrisma(
  existingTenant?: {
    id: string;
    slug: string;
    name: string;
    apiKeyPublic: string;
    apiKeySecret: string;
  } | null
): PrismaClient {
  const mockTenant = existingTenant || {
    id: 'tenant-lbf-123',
    slug: 'littlebit-farm',
    name: 'littlebit.farm',
    apiKeyPublic: 'pk_live_littlebit-farm_0000000000000000',
    apiKeySecret: 'hashed-secret-key',
  };

  const mockTier = {
    id: 'tier-1',
    slug: 'simple-ceremony',
    tenantId: mockTenant.id,
  };

  const mockModels = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(existingTenant || null),
      upsert: vi.fn().mockResolvedValue(mockTenant),
    },
    segment: {
      upsert: vi.fn().mockImplementation((args) => {
        const slug = args.where.tenantId_slug.slug;
        return Promise.resolve({
          id: `segment-${slug}`,
          slug,
          name: `Segment ${slug}`,
          tenantId: mockTenant.id,
        });
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    tier: {
      upsert: vi.fn().mockResolvedValue(mockTier),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    addOn: {
      upsert: vi.fn().mockResolvedValue({ id: 'addon-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    tierAddOn: {
      upsert: vi.fn().mockResolvedValue({ tierId: mockTier.id, addOnId: 'addon-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    sectionContent: {
      create: vi.fn().mockResolvedValue({ id: 'section-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    booking: {
      count: vi.fn().mockResolvedValue(0),
    },
    blackoutDate: {
      upsert: vi.fn().mockResolvedValue({ id: 'blackout-1' }),
    },
  };

  return {
    ...mockModels,
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockModels);
    }),
  } as unknown as PrismaClient;
}
