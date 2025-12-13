/**
 * Unit tests for Little Bit Horse Farm seed (seeds/little-bit-horse-farm.ts)
 *
 * Tests:
 * - Segment creation (Corporate Wellness Retreat)
 * - 3-tier package creation (Good/Better/Best)
 * - 18 add-ons creation (global scope)
 * - PackageAddOn links (54 total)
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
    it('should create Corporate Wellness Retreat segment', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.segment.upsert).toHaveBeenCalledTimes(1);
      const segmentCall = mockPrisma.segment.upsert.mock.calls[0][0];
      expect(segmentCall.where.tenantId_slug.slug).toBe('corporate-wellness-retreat');
      expect(segmentCall.create.name).toBe('Corporate Wellness Retreats');
      expect(segmentCall.create.heroTitle).toBe('Reset. Reconnect. Return Stronger.');
    });
  });

  describe('Package Creation (3 Tiers)', () => {
    it('should create 3 packages', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.package.upsert).toHaveBeenCalledTimes(3);
    });

    it('should create Grounding Reset (Good tier) at $450', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const groundingReset = calls.find((c) => c[0].where.tenantId_slug.slug === 'grounding-reset');

      expect(groundingReset).toBeDefined();
      expect(groundingReset![0].create.name).toBe('The Grounding Reset');
      expect(groundingReset![0].create.basePrice).toBe(45000); // $450
      expect(groundingReset![0].create.grouping).toBe('Good');
      expect(groundingReset![0].create.groupingOrder).toBe(1);
    });

    it('should create Team Recharge (Better tier) at $650', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const teamRecharge = calls.find((c) => c[0].where.tenantId_slug.slug === 'team-recharge');

      expect(teamRecharge).toBeDefined();
      expect(teamRecharge![0].create.name).toBe('The Team Recharge');
      expect(teamRecharge![0].create.basePrice).toBe(65000); // $650
      expect(teamRecharge![0].create.grouping).toBe('Better');
      expect(teamRecharge![0].create.groupingOrder).toBe(2);
    });

    it('should create Executive Reset (Best tier) at $950', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      const calls = mockPrisma.package.upsert.mock.calls;
      const executiveReset = calls.find((c) => c[0].where.tenantId_slug.slug === 'executive-reset');

      expect(executiveReset).toBeDefined();
      expect(executiveReset![0].create.name).toBe('The Executive Reset');
      expect(executiveReset![0].create.basePrice).toBe(95000); // $950
      expect(executiveReset![0].create.grouping).toBe('Best');
      expect(executiveReset![0].create.groupingOrder).toBe(3);
    });
  });

  describe('Add-on Creation (18 Total)', () => {
    it('should create 18 add-ons', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.addOn.upsert).toHaveBeenCalledTimes(18);
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

    it('should set all add-ons as global (segmentId: null)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      mockPrisma.addOn.upsert.mock.calls.forEach((call) => {
        expect(call[0].create.segmentId).toBeNull();
      });
    });
  });

  describe('PackageAddOn Links', () => {
    it('should create 54 package-addon links (18 add-ons × 3 packages)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedLittleBitHorseFarm(mockPrisma);

      expect(mockPrisma.packageAddOn.upsert).toHaveBeenCalledTimes(54);
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
