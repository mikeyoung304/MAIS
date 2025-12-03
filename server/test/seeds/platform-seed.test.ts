/**
 * Unit tests for Platform seed (seeds/platform.ts)
 *
 * Tests:
 * - Required environment variable validation
 * - Password length validation
 * - Admin user creation
 * - Idempotency (existing user handling)
 * - Password security (never update existing password)
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

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockhashedpassword'),
  },
}));

import { seedPlatform } from '../../prisma/seeds/platform';
import type { PrismaClient } from '../../src/generated/prisma';

describe('Platform Seed', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_DEFAULT_PASSWORD;
    delete process.env.ADMIN_NAME;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    it('should throw error when ADMIN_EMAIL is missing', async () => {
      process.env.ADMIN_DEFAULT_PASSWORD = 'securepassword123';
      // ADMIN_EMAIL not set

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        'ADMIN_EMAIL environment variable is required'
      );

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw error when ADMIN_DEFAULT_PASSWORD is missing', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      // ADMIN_DEFAULT_PASSWORD not set

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        'ADMIN_DEFAULT_PASSWORD environment variable is required'
      );
    });

    it('should include helpful message in ADMIN_EMAIL error', async () => {
      process.env.ADMIN_DEFAULT_PASSWORD = 'securepassword123';

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        /platform admin email/i
      );
    });

    it('should include secure generation tip in ADMIN_DEFAULT_PASSWORD error', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        /openssl rand/i
      );
    });
  });

  describe('Password Length Validation', () => {
    it('should reject password shorter than 12 characters', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'short'; // Only 5 chars

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        'ADMIN_DEFAULT_PASSWORD must be at least 12 characters'
      );
    });

    it('should reject password with exactly 11 characters', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = '12345678901'; // 11 chars

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).rejects.toThrow(
        /at least 12 characters/
      );
    });

    it('should accept password with exactly 12 characters', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = '123456789012'; // 12 chars

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).resolves.not.toThrow();
    });

    it('should accept password longer than 12 characters', async () => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'verylongsecurepassword123!@#';

      const mockPrisma = createMockPrisma();

      await expect(seedPlatform(mockPrisma)).resolves.not.toThrow();
    });
  });

  describe('New Admin User Creation', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'securepassword123';
    });

    it('should create new user when admin does not exist', async () => {
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should create user with PLATFORM_ADMIN role', async () => {
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('PLATFORM_ADMIN');
    });

    it('should hash password with bcrypt before storing', async () => {
      const bcrypt = await import('bcryptjs');
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      expect(bcrypt.default.hash).toHaveBeenCalledWith(
        'securepassword123',
        12 // BCRYPT_ROUNDS constant
      );

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBe('$2b$12$mockhashedpassword');
    });

    it('should use default name when ADMIN_NAME not set', async () => {
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('Platform Admin');
    });

    it('should use custom ADMIN_NAME when provided', async () => {
      process.env.ADMIN_NAME = 'John Doe';
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('John Doe');
    });
  });

  describe('Idempotency - Existing Admin Handling', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'securepassword123';
    });

    it('should update existing user role and name', async () => {
      const mockPrisma = createMockPrisma({ userExists: true });

      await seedPlatform(mockPrisma);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
        data: {
          role: 'PLATFORM_ADMIN',
          name: 'Platform Admin',
        },
      });
    });

    it('should NOT update password for existing user (security)', async () => {
      const bcrypt = await import('bcryptjs');
      const mockPrisma = createMockPrisma({ userExists: true });

      await seedPlatform(mockPrisma);

      // bcrypt.hash should not be called for existing users
      expect(bcrypt.default.hash).not.toHaveBeenCalled();

      // Update should not include passwordHash
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('passwordHash');
    });

    it('should not call create when user exists', async () => {
      const mockPrisma = createMockPrisma({ userExists: true });

      await seedPlatform(mockPrisma);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'securepassword123';
    });

    it('should log when new admin is created', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const mockPrisma = createMockPrisma({ userExists: false });

      await seedPlatform(mockPrisma);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('created with new password')
      );
    });

    it('should log when existing admin is found (password NOT updated)', async () => {
      const { logger } = await import('../../src/lib/core/logger');
      const mockPrisma = createMockPrisma({ userExists: true });

      await seedPlatform(mockPrisma);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('password NOT updated')
      );
    });
  });
});

interface MockPrismaOptions {
  userExists?: boolean;
}

/**
 * Create a mock PrismaClient for testing
 */
function createMockPrisma(options: MockPrismaOptions = {}): PrismaClient {
  const { userExists = false } = options;

  const existingUser = userExists
    ? { id: 'user-existing', email: 'admin@example.com', role: 'PLATFORM_ADMIN' }
    : null;

  const mockUser = {
    findUnique: vi.fn().mockResolvedValue(existingUser),
    create: vi.fn().mockResolvedValue({
      id: 'user-new',
      email: 'admin@example.com',
      role: 'PLATFORM_ADMIN',
    }),
    update: vi.fn().mockResolvedValue({
      id: 'user-existing',
      email: 'admin@example.com',
      role: 'PLATFORM_ADMIN',
    }),
  };

  const mockPrisma = {
    user: mockUser,
    // Mock $transaction to execute the callback with a transaction client
    // that proxies to the same mock objects
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Create a transaction client that uses the same mocks
      const txClient = {
        user: mockUser,
      };
      return callback(txClient);
    }),
  };

  return mockPrisma as unknown as PrismaClient;
}
