/**
 * Unit tests for Little Bit Horse Farm seed (seeds/little-bit-horse-farm.ts)
 *
 * Tests:
 * - Segment creation (3 segments: Wellness, Elopements, Weekend Getaways)
 * - 9 packages (3 per segment, tier_1/tier_2/tier_3)
 * - 33 add-ons creation (segment-scoped)
 * - PackageAddOn links (99 total)
 * - Idempotency (safe to run multiple times)
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
import type { PrismaClient } from '../../src/generated/prisma';

describe('Little Bit Horse Farm Seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Segment Creation', () => {
    it('should create 3 segments (Wellness, Elopements, Weekend Getaways)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.segment.upsert).toHaveBeenCalledTimes(3);
      const slugs = mockPrisma.segment.upsert.mock.calls.map((c) => c[0].where.tenantId_slug.slug);
      expect(slugs).toContain('corporate-wellness-retreat');
      expect(slugs).toContain('elopements');
      expect(slugs).toContain('weekend-getaways');
    });

    it('should create Corporate Wellness Retreat segment with correct hero', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const wellnessCall = mockPrisma.segment.upsert.mock.calls.find(
        (c) => c[0].where.tenantId_slug.slug === 'corporate-wellness-retreat'
      );
      expect(wellnessCall).toBeDefined();
      expect(wellnessCall![0].create.name).toBe('Corporate Wellness Retreats');
      expect(wellnessCall![0].create.heroTitle).toBe('Reset. Reconnect. Return Stronger.');
    });
  });

  describe('Package Creation (9 Total - 3 per segment)', () => {
    it('should create 9 packages (3 per segment)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.package.upsert).toHaveBeenCalledTimes(9);
    });

    it('should create Grounding Reset (tier_1) at $450', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const groundingReset = calls.find((c) => c[0].where.tenantId_slug.slug === 'grounding-reset');

      expect(groundingReset).toBeDefined();
      expect(groundingReset![0].create.name).toBe('The Grounding Reset');
      expect(groundingReset![0].create.basePrice).toBe(45000); // $450
      expect(groundingReset![0].create.grouping).toBe('tier_1');
      expect(groundingReset![0].create.groupingOrder).toBe(1);
    });

    it('should create Team Recharge (tier_2) at $650', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const teamRecharge = calls.find((c) => c[0].where.tenantId_slug.slug === 'team-recharge');

      expect(teamRecharge).toBeDefined();
      expect(teamRecharge![0].create.name).toBe('The Team Recharge');
      expect(teamRecharge![0].create.basePrice).toBe(65000); // $650
      expect(teamRecharge![0].create.grouping).toBe('tier_2');
      expect(teamRecharge![0].create.groupingOrder).toBe(2);
    });

    it('should create Executive Reset (tier_3) at $950', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const executiveReset = calls.find((c) => c[0].where.tenantId_slug.slug === 'executive-reset');

      expect(executiveReset).toBeDefined();
      expect(executiveReset![0].create.name).toBe('The Executive Reset');
      expect(executiveReset![0].create.basePrice).toBe(95000); // $950
      expect(executiveReset![0].create.grouping).toBe('tier_3');
      expect(executiveReset![0].create.groupingOrder).toBe(3);
    });
  });

  describe('Add-on Creation (33 Total - segment-scoped)', () => {
    it('should create 33 add-ons (18 wellness + 4 elopements + 11 weekends)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.addOn.upsert).toHaveBeenCalledTimes(33);
    });

    it('should create food & hospitality add-ons', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const slugs = mockPrisma.addOn.upsert.mock.calls.map((c) => c[0].where.tenantId_slug.slug);

      expect(slugs).toContain('pastry-bar');
      expect(slugs).toContain('coffee-tea');
      expect(slugs).toContain('hydration-station');
      expect(slugs).toContain('hospitality-essentials');
      expect(slugs).toContain('lunch-boxed');
      expect(slugs).toContain('lunch-buffet');
      expect(slugs).toContain('lunch-chef');
      expect(slugs).toContain('dinner-chef');
    });

    it('should create wellness upgrade add-ons', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const slugs = mockPrisma.addOn.upsert.mock.calls.map((c) => c[0].where.tenantId_slug.slug);

      expect(slugs).toContain('extra-yoga');
      expect(slugs).toContain('extra-breathwork');
      expect(slugs).toContain('meditation-sound-bath');
      expect(slugs).toContain('extended-pemf');
    });

    it('should create corporate polish add-ons', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const slugs = mockPrisma.addOn.upsert.mock.calls.map((c) => c[0].where.tenantId_slug.slug);

      expect(slugs).toContain('photo-recap');
      expect(slugs).toContain('meeting-kit');
      expect(slugs).toContain('welcome-gifts-basic');
      expect(slugs).toContain('welcome-gifts-premium');
    });

    it('should create consolidated mocktail bar add-on', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.addOn.upsert.mock.calls;
      const mocktailBar = calls.find((c) => c[0].where.tenantId_slug.slug === 'mocktail-bar');

      expect(mocktailBar).toBeDefined();
      expect(mocktailBar![0].create.name).toBe('Signature Mocktail Bar');
      expect(mocktailBar![0].create.price).toBe(25000); // $250 base
    });

    it('should set all add-ons as segment-scoped (not global)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      // All add-ons should have a segmentId (not null)
      mockPrisma.addOn.upsert.mock.calls.forEach((call) => {
        expect(call[0].create.segmentId).not.toBeNull();
      });
    });
  });

  describe('PackageAddOn Links', () => {
    it('should create 99 package-addon links (54 wellness + 12 elopement + 33 weekend)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      // 18 add-ons × 3 wellness packages = 54
      // 4 add-ons × 3 elopement packages = 12
      // 11 add-ons × 3 weekend packages = 33
      // Total = 99
      expect(mockPrisma.packageAddOn.upsert).toHaveBeenCalledTimes(99);
    });
  });

  describe('Idempotency', () => {
    it('should clear existing data before creating new data', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      // Should delete in order: packageAddOn, package, addOn, segment
      expect(mockPrisma.packageAddOn.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.package.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.addOn.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.segment.deleteMany).toHaveBeenCalled();
    });

    it('should preserve API keys on update', async () => {
      const existingTenant = {
        id: 'tenant-lbhf-123',
        slug: 'little-bit-farm',
        name: 'Little Bit Horse Farm',
        apiKeyPublic: 'pk_live_little-bit-farm_existing1234',
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
      expect(reasons).toContain("New Year's Day");
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
    id: 'tenant-lbhf-123',
    slug: 'little-bit-farm',
    name: 'Little Bit Horse Farm',
    apiKeyPublic: 'pk_live_little-bit-farm_0000000000000000',
    apiKeySecret: 'hashed-secret-key',
  };

  const mockSegment = {
    id: 'segment-wellness-123',
    slug: 'corporate-wellness-retreat',
    tenantId: mockTenant.id,
  };

  const mockPackage = {
    id: 'pkg-1',
    slug: 'grounding-reset',
    tenantId: mockTenant.id,
  };

  const mockAddOn = {
    id: 'addon-1',
    slug: 'pastry-bar',
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
    package: {
      upsert: vi.fn().mockResolvedValue(mockPackage),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    addOn: {
      upsert: vi.fn().mockResolvedValue(mockAddOn),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    packageAddOn: {
      upsert: vi.fn().mockResolvedValue({ packageId: mockPackage.id, addOnId: mockAddOn.id }),
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
