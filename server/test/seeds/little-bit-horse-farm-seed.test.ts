/**
 * Unit tests for littlebit.farm seed (seeds/little-bit-horse-farm.ts)
 *
 * Tests:
 * - Segment creation (3 segments: Elopements, Corporate Retreats, Weekend Getaway)
 * - 9 tiers (3 per segment) with displayPriceCents + Airbnb split
 * - Section content (HERO, ABOUT, SERVICES)
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

  describe('Tier Creation (9 Total - 3 per segment)', () => {
    it('should create 9 tiers (3 per segment)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.tier.upsert).toHaveBeenCalledTimes(9);
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

      // Curated Weekend has 2 scaling components
      const curated = calls.find((c) => c[0].where.tenantId_slug.slug === 'curated-weekend');
      const curatedRules = curated![0].create.scalingRules;
      expect(curatedRules.components).toHaveLength(2);
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
  });

  describe('Section Content', () => {
    it('should create 3 section content blocks (HERO, ABOUT, SERVICES)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.sectionContent.create).toHaveBeenCalledTimes(3);
      const blockTypes = mockPrisma.sectionContent.create.mock.calls.map(
        (c) => c[0].data.blockType
      );
      expect(blockTypes).toContain('HERO');
      expect(blockTypes).toContain('ABOUT');
      expect(blockTypes).toContain('SERVICES');
    });

    it('should create ABOUT section with Airbnb "How It Works" copy', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const aboutCall = mockPrisma.sectionContent.create.mock.calls.find(
        (c) => c[0].data.blockType === 'ABOUT'
      );
      expect(aboutCall).toBeDefined();
      const content = aboutCall![0].data.content as Record<string, unknown>;
      expect(content.title).toBe('How It Works');
      expect(content.body).toContain('Airbnb accommodation ($200/night)');
      expect(content.body).toContain('experience portion only');
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

  const mockSegment = {
    id: 'segment-elopements-123',
    slug: 'elopements',
    tenantId: mockTenant.id,
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
      upsert: vi.fn().mockResolvedValue(mockSegment),
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
