/**
 * Unit tests for Demo seed (seeds/demo.ts)
 *
 * Tests:
 * - Random key generation (security) on first create
 * - Key preservation on subsequent seeds (idempotency)
 * - Tenant creation with demo data
 * - Tier and add-on creation
 * - Blackout date creation
 * - Idempotency (safe to run multiple times)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockImplementation((size: number) => ({
      toString: () => '0'.repeat(size * 2), // Hex encoding doubles size
    })),
  },
}));

import { seedDemo } from '../../prisma/seeds/demo';
import type { PrismaClient } from '../../src/generated/prisma/client';

describe('Demo Seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Demo Tenant Creation', () => {
    it('should create new tenant when it does not exist (via upsert)', async () => {
      const mockPrisma = createMockPrisma(null); // No existing tenant

      await seedDemo(mockPrisma);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'demo-business' },
      });
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.create).toBeDefined();
    });

    it('should update existing tenant without changing keys (via upsert)', async () => {
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'demo-business' },
      });
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      // Verify update does not include API keys
      expect(upsertCall.update.apiKeyPublic).toBeUndefined();
      expect(upsertCall.update.apiKeySecret).toBeUndefined();
    });

    it('should set tenant as active on create (via upsert)', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.create.isActive).toBe(true);
    });

    it('should preserve active status on update (via upsert)', async () => {
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.update.isActive).toBe(true);
    });

    it('should set demo email', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.create.email).toBe('demo@handled-demo.com');
    });

    it('should set password hash for demo login', async () => {
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      // Password hash should be a bcrypt hash (starts with $2b$)
      expect(upsertCall.create.passwordHash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('Random Key Generation (Security)', () => {
    it('should generate public key with random suffix on first create', async () => {
      const mockPrisma = createMockPrisma(null); // No existing tenant

      await seedDemo(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      // Public key format: pk_live_demo-business_{16 hex chars}
      expect(upsertCall.create.apiKeyPublic).toMatch(/^pk_live_demo-business_[0-9a-f]{16}$/);
    });

    it('should NOT regenerate keys on subsequent seeds (idempotency)', async () => {
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      // Should use upsert with update (not create)
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];

      // Update should NOT include API keys
      expect(upsertCall.update.apiKeyPublic).toBeUndefined();
      expect(upsertCall.update.apiKeySecret).toBeUndefined();
    });

    it('should hash secret key before storing on first create', async () => {
      const { apiKeyService } = await import('../../src/lib/api-key.service');
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      expect(apiKeyService.hashSecretKey).toHaveBeenCalled();
      const hashCall = (apiKeyService.hashSecretKey as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Secret key format: sk_live_demo-business_{32 hex chars}
      expect(hashCall).toMatch(/^sk_live_demo-business_[0-9a-f]{32}$/);
    });

    it('should NOT hash secret key on update (keys preserved)', async () => {
      vi.clearAllMocks(); // Clear any previous calls
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      const { apiKeyService } = await import('../../src/lib/api-key.service');
      expect(apiKeyService.hashSecretKey).not.toHaveBeenCalled();
    });
  });

  describe('Demo Tier Creation', () => {
    it('should create starter, growth, and enterprise tiers', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      // Should be called 3 times (starter, growth, enterprise)
      expect(mockPrisma.tier.upsert).toHaveBeenCalledTimes(3);

      const slugs = mockPrisma.tier.upsert.mock.calls.map(
        (call) => call[0].where.tenantId_slug.slug
      );
      expect(slugs).toContain('starter');
      expect(slugs).toContain('growth');
      expect(slugs).toContain('enterprise');
    });

    it('should set realistic prices for tiers', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      const prices = mockPrisma.tier.upsert.mock.calls.map((call) => call[0].create.priceCents);

      // Verify prices are in cents and reasonable
      prices.forEach((price) => {
        expect(price).toBeGreaterThan(0);
        expect(price).toBe(Math.floor(price)); // Should be integer (cents)
      });
    });

    it('should include photo URLs for tiers', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      mockPrisma.tier.upsert.mock.calls.forEach((call) => {
        const photos = call[0].create.photos;
        expect(photos).toBeDefined();
        // Photos is stored as JSON string
        const parsedPhotos = JSON.parse(photos);
        expect(parsedPhotos).toBeInstanceOf(Array);
      });
    });
  });

  describe('Demo Add-On Creation', () => {
    it('should create multiple add-ons', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      // Should create 4 add-ons
      expect(mockPrisma.addOn.upsert).toHaveBeenCalledTimes(4);
    });

    it('should create add-ons with expected slugs', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      const slugs = mockPrisma.addOn.upsert.mock.calls.map(
        (call) => call[0].where.tenantId_slug.slug
      );

      expect(slugs).toContain('social-media-management');
      expect(slugs).toContain('email-marketing');
      expect(slugs).toContain('crm-setup');
      expect(slugs).toContain('dedicated-account-manager');
    });

    it('should link add-ons to appropriate tiers', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      // Should create tier-addon links
      expect(mockPrisma.tierAddOn.upsert).toHaveBeenCalled();
      expect(mockPrisma.tierAddOn.upsert.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Demo Blackout Dates', () => {
    it('should create blackout dates for holidays', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      expect(mockPrisma.blackoutDate.upsert).toHaveBeenCalledTimes(2);
    });

    it('should create Christmas blackout date', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      const reasons = mockPrisma.blackoutDate.upsert.mock.calls.map(
        (call) => call[0].create.reason
      );
      expect(reasons).toContain('Christmas Holiday');
    });

    it('should create New Years blackout date', async () => {
      const mockPrisma = createMockPrisma();

      await seedDemo(mockPrisma);

      const reasons = mockPrisma.blackoutDate.upsert.mock.calls.map(
        (call) => call[0].create.reason
      );
      expect(reasons).toContain('New Years Day');
    });
  });

  describe('Idempotency', () => {
    it('should be safe to run multiple times (upserts for tiers/add-ons)', async () => {
      const mockPrisma = createMockPrisma();

      // Run twice
      await seedDemo(mockPrisma);
      await seedDemo(mockPrisma);

      // All operations except tenant should use upsert
      expect(mockPrisma.tier.upsert).toHaveBeenCalled();
      expect(mockPrisma.addOn.upsert).toHaveBeenCalled();
      expect(mockPrisma.tierAddOn.upsert).toHaveBeenCalled();
      expect(mockPrisma.blackoutDate.upsert).toHaveBeenCalled();
    });

    it('should preserve keys on second run (tenant upsert with update)', async () => {
      const mockPrisma = createMockPrisma(null);

      // First run: creates tenant via upsert
      await seedDemo(mockPrisma);
      expect(mockPrisma.tenant.upsert).toHaveBeenCalledOnce();

      // Second run: updates tenant (keys preserved)
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrismaUpdate = createMockPrisma(existingTenant);
      await seedDemo(mockPrismaUpdate);

      expect(mockPrismaUpdate.tenant.upsert).toHaveBeenCalled();
      const upsertCall = mockPrismaUpdate.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.update.apiKeyPublic).toBeUndefined();
      expect(upsertCall.update.apiKeySecret).toBeUndefined();
    });
  });

  describe('Logging', () => {
    it('should log created tenant info on first create', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Demo tenant created'));
    });

    it('should log updated tenant info on subsequent seeds', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Demo tenant updated (keys preserved)')
      );
    });

    it('should warn about secret key on first create (save it!)', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Secret Key'));
    });

    it('should warn that keys will NOT be regenerated on first create', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const mockPrisma = createMockPrisma(null);

      await seedDemo(mockPrisma);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('will not be regenerated'));
    });

    it('should inform that keys are unchanged on update', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const existingTenant = {
        id: 'tenant-demo-123',
        slug: 'demo-business',
        name: 'Demo Business Services',
        apiKeyPublic: 'pk_live_demo-business_existing1234',
        apiKeySecret: 'hashed-existing-secret',
      };
      const mockPrisma = createMockPrisma(existingTenant);

      await seedDemo(mockPrisma);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Secret key unchanged'));
    });
  });
});

/**
 * Create a mock PrismaClient for testing
 * @param existingTenant - Pass existing tenant to simulate update scenario, null for create scenario
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
    id: 'tenant-demo-123',
    slug: 'demo-business',
    name: 'Demo Business Services',
    apiKeyPublic: 'pk_live_demo-business_0000000000000000',
    apiKeySecret: 'hashed-secret-key',
  };

  const mockSegment = {
    id: 'segment-general-123',
    slug: 'general',
    tenantId: mockTenant.id,
  };

  const mockTier = {
    id: 'tier-1',
    slug: 'starter',
    tenantId: mockTenant.id,
  };

  const mockAddOn = {
    id: 'addon-1',
    slug: 'social-media-management',
    tenantId: mockTenant.id,
  };

  const mockModels = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(existingTenant || null),
      create: vi.fn().mockResolvedValue(mockTenant),
      update: vi.fn().mockResolvedValue(mockTenant),
      upsert: vi.fn().mockResolvedValue(mockTenant),
    },
    segment: {
      upsert: vi.fn().mockResolvedValue(mockSegment),
    },
    tier: {
      upsert: vi.fn().mockResolvedValue(mockTier),
    },
    addOn: {
      upsert: vi.fn().mockResolvedValue(mockAddOn),
    },
    tierAddOn: {
      upsert: vi.fn().mockResolvedValue({ tierId: mockTier.id, addOnId: mockAddOn.id }),
    },
    blackoutDate: {
      upsert: vi.fn().mockResolvedValue({ id: 'blackout-1' }),
    },
  };

  return {
    ...mockModels,
    // Mock $transaction to execute the callback with a transaction client
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockModels);
    }),
  } as unknown as PrismaClient;
}
