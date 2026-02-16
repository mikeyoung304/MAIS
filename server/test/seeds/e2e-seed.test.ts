/**
 * Unit tests for E2E seed (seeds/e2e.ts)
 *
 * Tests:
 * - Production environment guard (security critical)
 * - Tenant creation with fixed keys
 * - Tier creation
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

import { seedE2E, E2E_KEYS } from '../../prisma/seeds/e2e';
import type { PrismaClient } from '../../src/generated/prisma/client';

describe('E2E Seed', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Production Environment Guard', () => {
    it('should throw error when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).rejects.toThrow(
        'FATAL: E2E seed cannot run in production environment!'
      );

      // Verify no database operations were performed
      expect(mockPrisma.tenant.upsert).not.toHaveBeenCalled();
    });

    it('should include helpful error message about fixed keys', async () => {
      process.env.NODE_ENV = 'production';

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).rejects.toThrow(/fixed test keys.*publicly visible/i);
    });

    it('should suggest using SEED_MODE=production in error message', async () => {
      process.env.NODE_ENV = 'production';

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).rejects.toThrow(/SEED_MODE=production/);
    });

    it('should allow execution in development environment', async () => {
      process.env.NODE_ENV = 'development';

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).resolves.not.toThrow();
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
    });

    it('should allow execution in test environment', async () => {
      process.env.NODE_ENV = 'test';

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).resolves.not.toThrow();
      expect(mockPrisma.tenant.upsert).toHaveBeenCalled();
    });

    it('should allow execution when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;

      const mockPrisma = createMockPrisma();

      await expect(seedE2E(mockPrisma)).resolves.not.toThrow();
    });
  });

  describe('E2E Test Tenant Creation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should create tenant with slug "handled-e2e"', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      expect(mockPrisma.tenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'handled-e2e' },
        })
      );
    });

    it('should use fixed public key format', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.create.apiKeyPublic).toBe('pk_live_handled-e2e_0000000000000000');
    });

    it('should hash the secret key before storing', async () => {
      const { apiKeyService } = await import('../../src/lib/api-key.service');
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      expect(apiKeyService.hashSecretKey).toHaveBeenCalledWith(
        'sk_live_handled-e2e_00000000000000000000000000000000'
      );
    });

    it('should set tenant as active', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      const upsertCall = mockPrisma.tenant.upsert.mock.calls[0][0];
      expect(upsertCall.create.isActive).toBe(true);
    });
  });

  describe('E2E Tier Creation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should create starter and growth tiers', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      // Should be called twice (starter and growth)
      expect(mockPrisma.tier.upsert).toHaveBeenCalledTimes(2);

      const slugs = mockPrisma.tier.upsert.mock.calls.map(
        (call) => call[0].where.tenantId_slug.slug
      );
      expect(slugs).toContain('starter');
      expect(slugs).toContain('growth');
    });

    it('should create add-on and link to starter tier', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      expect(mockPrisma.addOn.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_slug: expect.objectContaining({
              slug: 'test-addon',
            }),
          }),
        })
      );

      expect(mockPrisma.tierAddOn.upsert).toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should use upsert for tenant (safe to run multiple times)', async () => {
      const mockPrisma = createMockPrisma();

      // Run twice
      await seedE2E(mockPrisma);
      await seedE2E(mockPrisma);

      // Should use upsert, not create
      expect(mockPrisma.tenant.upsert).toHaveBeenCalledTimes(2);
    });

    it('should use upsert for tiers (safe to run multiple times)', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      // Verify all tier operations use upsert
      expect(mockPrisma.tier.upsert).toHaveBeenCalled();
      mockPrisma.tier.upsert.mock.calls.forEach((call) => {
        expect(call[0]).toHaveProperty('where');
        expect(call[0]).toHaveProperty('update');
        expect(call[0]).toHaveProperty('create');
      });
    });

    it('should use upsert for add-ons (safe to run multiple times)', async () => {
      const mockPrisma = createMockPrisma();

      await seedE2E(mockPrisma);

      expect(mockPrisma.addOn.upsert).toHaveBeenCalled();
      expect(mockPrisma.tierAddOn.upsert).toHaveBeenCalled();
    });
  });

  describe('Exported Keys', () => {
    it('should export E2E_KEYS with correct tenant slug', () => {
      expect(E2E_KEYS.tenantSlug).toBe('handled-e2e');
    });

    it('should export E2E_KEYS with correct public key', () => {
      expect(E2E_KEYS.publicKey).toBe('pk_live_handled-e2e_0000000000000000');
    });

    it('should export E2E_KEYS with correct secret key', () => {
      expect(E2E_KEYS.secretKey).toBe('sk_live_handled-e2e_00000000000000000000000000000000');
    });
  });
});

/**
 * Create a mock PrismaClient for testing
 */
function createMockPrisma(): PrismaClient {
  const mockTenant = {
    id: 'tenant-e2e-123',
    slug: 'handled-e2e',
    name: 'Handled E2E Test Tenant',
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
    slug: 'test-addon',
    tenantId: mockTenant.id,
  };

  const mockModels = {
    tenant: {
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
  };

  return {
    ...mockModels,
    // Mock $transaction to execute the callback with a transaction client
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockModels);
    }),
  } as unknown as PrismaClient;
}
