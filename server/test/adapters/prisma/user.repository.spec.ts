/**
 * Unit tests for PrismaUserRepository
 * Tests user repository adapter with mocked Prisma client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaUserRepository } from '../../../src/adapters/prisma/user.repository';
import { createMockPrismaClient, type MockPrismaClient } from '../../mocks/prisma.mock';
import { buildUser, sampleAdminUser, platformAdminUser, regularUser } from '../../fixtures/users';

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    // Cast to any to bypass type checking for mock
    repository = new PrismaUserRepository(mockPrisma as any);
    vi.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('returns user when exists and is PLATFORM_ADMIN', async () => {
      // Arrange
      const user = buildUser({
        email: 'admin@example.com',
        role: 'PLATFORM_ADMIN' as any,
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await repository.findByEmail('admin@example.com');

      // Assert
      expect(result).toBeDefined();
      expect(result?.email).toBe('admin@example.com');
      // NOTE: The implementation casts the role but doesn't transform it
      // so it remains uppercase 'PLATFORM_ADMIN' from the database
      expect(result?.role).toBe('PLATFORM_ADMIN');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns null when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns null when user exists but is not PLATFORM_ADMIN', async () => {
      // Arrange - user with USER role
      const user = buildUser({
        email: 'user@example.com',
        role: 'USER' as any,
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await repository.findByEmail('user@example.com');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('returns null for TENANT_ADMIN role', async () => {
      // Arrange - user with TENANT_ADMIN role
      const user = buildUser({
        email: 'tenant@example.com',
        role: 'TENANT_ADMIN' as any,
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await repository.findByEmail('tenant@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('maps user fields correctly to port interface', async () => {
      // Arrange
      const dbUser = buildUser({
        id: 'user_123',
        email: 'admin@test.com',
        passwordHash: '$2a$10$TESTHASHABCDEF123456789012',
        role: 'PLATFORM_ADMIN' as any,
      });
      mockPrisma.user.findUnique.mockResolvedValue(dbUser);

      // Act
      const result = await repository.findByEmail('admin@test.com');

      // Assert
      // NOTE: The implementation casts the role but doesn't transform it
      // so it remains uppercase 'PLATFORM_ADMIN' from the database
      expect(result).toEqual({
        id: 'user_123',
        email: 'admin@test.com',
        passwordHash: '$2a$10$TESTHASHABCDEF123456789012',
        role: 'PLATFORM_ADMIN',
      });
    });
  });

});
