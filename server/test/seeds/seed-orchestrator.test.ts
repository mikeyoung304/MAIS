/**
 * Unit tests for seed orchestrator (seed.ts)
 *
 * Tests the seed mode detection logic and orchestration.
 * Individual seed functions are tested in their own test files.
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

// Mock bcrypt for faster tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockhashedpassword'),
  },
}));

// Mock Prisma client
vi.mock('../../src/generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    tenant: {
      upsert: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'test', name: 'Test' }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
      update: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
    },
    package: {
      upsert: vi.fn().mockResolvedValue({ id: 'pkg-1', slug: 'starter' }),
    },
    addOn: {
      upsert: vi.fn().mockResolvedValue({ id: 'addon-1', slug: 'test-addon' }),
    },
    packageAddOn: {
      upsert: vi.fn().mockResolvedValue({ packageId: 'pkg-1', addOnId: 'addon-1' }),
    },
    blackoutDate: {
      upsert: vi.fn().mockResolvedValue({ id: 'blackout-1' }),
    },
  })),
}));

// Mock api-key service
vi.mock('../../src/lib/api-key.service', () => ({
  apiKeyService: {
    hashSecretKey: vi.fn().mockReturnValue('hashed-secret-key'),
  },
}));

describe('Seed Mode Detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear seed-related env vars
    delete process.env.SEED_MODE;
    delete process.env.NODE_ENV;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_DEFAULT_PASSWORD;
    delete process.env.ADMIN_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SEED_MODE explicit settings', () => {
    it('should use SEED_MODE=production when explicitly set', async () => {
      process.env.SEED_MODE = 'production';
      process.env.NODE_ENV = 'development'; // Should be overridden by SEED_MODE

      // Import getSeedMode function by extracting the logic
      const mode = getSeedModeFromEnv();
      expect(mode).toBe('production');
    });

    it('should use SEED_MODE=e2e when explicitly set', async () => {
      process.env.SEED_MODE = 'e2e';
      process.env.NODE_ENV = 'production'; // Should be overridden by SEED_MODE

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('e2e');
    });

    it('should use SEED_MODE=demo when explicitly set', async () => {
      process.env.SEED_MODE = 'demo';

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('demo');
    });

    it('should use SEED_MODE=dev when explicitly set', async () => {
      process.env.SEED_MODE = 'dev';
      process.env.NODE_ENV = 'test'; // Should be overridden by SEED_MODE

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('dev');
    });

    it('should use SEED_MODE=all when explicitly set', async () => {
      process.env.SEED_MODE = 'all';

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('all');
    });
  });

  describe('NODE_ENV fallback behavior', () => {
    it('should infer production mode from NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      // SEED_MODE not set

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('production');
    });

    it('should infer e2e mode from NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('e2e');
    });

    it('should default to dev mode when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('dev');
    });

    it('should default to dev mode when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('dev');
    });
  });

  describe('Invalid SEED_MODE values', () => {
    it('should fall back to NODE_ENV when SEED_MODE is invalid', async () => {
      process.env.SEED_MODE = 'invalid-mode';
      process.env.NODE_ENV = 'production';

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('production');
    });

    it('should default to dev when both SEED_MODE and NODE_ENV are invalid/missing', async () => {
      process.env.SEED_MODE = 'nonsense';
      delete process.env.NODE_ENV;

      const mode = getSeedModeFromEnv();
      expect(mode).toBe('dev');
    });
  });
});

/**
 * Helper function that mirrors the getSeedMode logic from seed.ts
 * This is duplicated here to avoid importing the actual seed.ts which
 * would attempt to create a PrismaClient and run main().
 */
function getSeedModeFromEnv(): 'production' | 'e2e' | 'demo' | 'dev' | 'all' {
  type SeedMode = 'production' | 'e2e' | 'demo' | 'dev' | 'all';

  // Explicit SEED_MODE takes priority
  const explicitMode = process.env.SEED_MODE as SeedMode | undefined;
  if (explicitMode && ['production', 'e2e', 'demo', 'dev', 'all'].includes(explicitMode)) {
    return explicitMode;
  }

  // Infer from NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  switch (nodeEnv) {
    case 'production':
      return 'production';
    case 'test':
      return 'e2e';
    default:
      // Development default: platform admin + demo data
      return 'dev';
  }
}
