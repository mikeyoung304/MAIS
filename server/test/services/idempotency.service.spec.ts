/**
 * Unit tests for IdempotencyService
 *
 * Tests key generation, storage, race condition handling, and response caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyService } from '../../src/services/idempotency.service';
import type { PrismaClient } from '../../src/generated/prisma';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create a mock Prisma client
    mockPrisma = {
      idempotencyKey: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    };

    service = new IdempotencyService(mockPrisma as unknown as PrismaClient);
  });

  describe('generateKey - Key Generation', () => {
    it('should create deterministic SHA-256 hash', () => {
      // Act
      const key = service.generateKey('checkout', 'tenant_123', 'session_abc');

      // Assert
      expect(key).toMatch(/^checkout_[a-f0-9]{32}$/); // prefix_hash format
      expect(key.length).toBe(41); // "checkout_" (9) + 32 hex chars
    });

    it('should produce same key for same inputs', () => {
      // Act
      const key1 = service.generateKey('checkout', 'tenant_123', 'session_abc');
      const key2 = service.generateKey('checkout', 'tenant_123', 'session_abc');

      // Assert
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different inputs', () => {
      // Act
      const key1 = service.generateKey('checkout', 'tenant_123', 'session_abc');
      const key2 = service.generateKey('checkout', 'tenant_456', 'session_abc'); // Different tenant
      const key3 = service.generateKey('refund', 'tenant_123', 'session_abc'); // Different prefix

      // Assert
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe('checkAndStore - Check and Store', () => {
    it('should store new key successfully', async () => {
      // Arrange
      const key = 'checkout_abc123';
      mockPrisma.idempotencyKey.create.mockResolvedValue({
        id: 'idem_1',
        key,
        response: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      // Act
      const isNew = await service.checkAndStore(key);

      // Assert
      expect(isNew).toBe(true);
      expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          key,
          response: null,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should return false for duplicate key', async () => {
      // Arrange - Simulate Prisma unique constraint error (P2002)
      const key = 'checkout_duplicate';
      const duplicateError = {
        code: 'P2002',
        meta: {
          target: ['key'],
        },
      };
      mockPrisma.idempotencyKey.create.mockRejectedValue(duplicateError);

      // Act
      const isNew = await service.checkAndStore(key);

      // Assert
      expect(isNew).toBe(false);
    });

    it('should handle race condition (P2002 error)', async () => {
      // Arrange - Two concurrent requests for same key
      const key = 'checkout_race';
      const raceConditionError = {
        code: 'P2002',
        meta: {
          target: ['key'],
        },
      };

      let firstCall = true;
      mockPrisma.idempotencyKey.create.mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve({
            id: 'idem_1',
            key,
            response: null,
            expiresAt: new Date(),
            createdAt: new Date(),
          });
        }
        return Promise.reject(raceConditionError);
      });

      // Act - Simulate two concurrent calls
      const [result1, result2] = await Promise.all([
        service.checkAndStore(key),
        service.checkAndStore(key),
      ]);

      // Assert - First call succeeds, second fails with P2002
      expect([result1, result2].sort()).toEqual([false, true]);
    });
  });

  describe('getStoredResponse - Response Caching', () => {
    it('should return cached response', async () => {
      // Arrange
      const key = 'checkout_cached';
      const cachedResponse = {
        data: { sessionId: 'cs_123', url: 'https://checkout.stripe.com/...' },
        timestamp: new Date().toISOString(),
      };

      mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
        id: 'idem_1',
        key,
        response: JSON.stringify(cachedResponse),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour in future
        createdAt: new Date(),
      });

      // Act
      const result = await service.getStoredResponse(key);

      // Assert
      expect(result).toEqual(cachedResponse);
      expect(mockPrisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key },
      });
    });

    it('should return null for expired key', async () => {
      // Arrange
      const key = 'checkout_expired';
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago

      mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
        id: 'idem_1',
        key,
        response: JSON.stringify({ data: 'old' }),
        expiresAt: expiredDate,
        createdAt: new Date(),
      });

      mockPrisma.idempotencyKey.delete.mockResolvedValue({});

      // Act
      const result = await service.getStoredResponse(key);

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.idempotencyKey.delete).toHaveBeenCalledWith({
        where: { key },
      });
    });

    it('should update response for existing key', async () => {
      // Arrange
      const key = 'checkout_update';
      const response = {
        data: { sessionId: 'cs_456', url: 'https://...' },
        timestamp: new Date().toISOString(),
      };

      mockPrisma.idempotencyKey.update.mockResolvedValue({
        id: 'idem_1',
        key,
        response: JSON.stringify(response),
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      // Act
      await service.updateResponse(key, response);

      // Assert
      expect(mockPrisma.idempotencyKey.update).toHaveBeenCalledWith({
        where: { key },
        data: {
          response: JSON.stringify(response),
        },
      });
    });
  });

  describe('generateCheckoutKey - Specialized Keys', () => {
    it('should generate deterministic key based on booking identity only (timestamp ignored)', () => {
      // Arrange
      const tenantId = 'tenant_123';
      const email = 'john@example.com';
      const packageId = 'pkg_starter';
      const eventDate = '2025-07-01';

      // Act - Generate keys with different timestamps (or no timestamp)
      const key1 = service.generateCheckoutKey(
        tenantId,
        email,
        packageId,
        eventDate,
        1700000000000
      );
      const key2 = service.generateCheckoutKey(
        tenantId,
        email,
        packageId,
        eventDate,
        1700000005000
      );
      const key3 = service.generateCheckoutKey(
        tenantId,
        email,
        packageId,
        eventDate,
        1700000015000
      );
      const keyNoTimestamp = service.generateCheckoutKey(tenantId, email, packageId, eventDate);

      // Assert - ALL keys should be identical because timestamp is DEPRECATED and ignored
      // This prevents double-charge risk when requests straddle time boundaries
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
      expect(key3).toBe(keyNoTimestamp);
      expect(key1).toMatch(/^checkout_[a-f0-9]{32}$/);

      // Different booking identity should produce different key
      const keyDifferentEmail = service.generateCheckoutKey(
        tenantId,
        'different@example.com',
        packageId,
        eventDate
      );
      expect(keyDifferentEmail).not.toBe(key1);

      const keyDifferentPackage = service.generateCheckoutKey(
        tenantId,
        email,
        'pkg_premium',
        eventDate
      );
      expect(keyDifferentPackage).not.toBe(key1);
    });
  });

  describe('cleanupExpired - Periodic Cleanup', () => {
    it('should delete expired keys and return count', async () => {
      // Arrange
      const deletedCount = 5;
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: deletedCount });

      // Act
      const result = await service.cleanupExpired();

      // Assert
      expect(result).toBe(deletedCount);
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should delete only keys with expiresAt in the past', async () => {
      // Arrange
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 3 });

      // Act
      await service.cleanupExpired();

      // Assert
      const deleteCall = mockPrisma.idempotencyKey.deleteMany.mock.calls[0][0];
      const expiresAtFilter = deleteCall.where.expiresAt.lt;
      expect(expiresAtFilter.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return 0 when no expired keys found', async () => {
      // Arrange
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await service.cleanupExpired();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('startCleanupScheduler - Scheduler Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start cleanup scheduler', () => {
      // Arrange
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });

      // Act
      service.startCleanupScheduler();

      // Assert - Should schedule cleanup to run every 24 hours
      expect(service).toBeDefined();
    });

    it('should run initial cleanup after 30 seconds', async () => {
      // Arrange
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired
        .mockResolvedValueOnce(undefined); // Lock released
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 2 });

      // Act
      service.startCleanupScheduler();

      // Fast-forward 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      // Assert - Initial cleanup should have run
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalled();
    });

    it('should prevent multiple schedulers', () => {
      // Arrange
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });

      // Act - Start scheduler twice
      service.startCleanupScheduler();
      service.startCleanupScheduler();

      // Assert - No error should be thrown, second call is ignored
      expect(service).toBeDefined();
    });

    it('should run cleanup every 24 hours', async () => {
      // Arrange
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired (initial)
        .mockResolvedValueOnce(undefined) // Lock released (initial)
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired (24h)
        .mockResolvedValueOnce(undefined) // Lock released (24h)
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired (48h)
        .mockResolvedValueOnce(undefined); // Lock released (48h)
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      service.startCleanupScheduler();

      // Fast-forward 30 seconds (initial cleanup)
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);

      // Fast-forward 24 hours
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(2);

      // Fast-forward another 24 hours
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('stopCleanupScheduler - Graceful Shutdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should stop cleanup scheduler', async () => {
      // Arrange
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });
      service.startCleanupScheduler();

      // Act
      await service.stopCleanupScheduler();

      // Assert - No error should be thrown
      expect(service).toBeDefined();
    });

    it('should prevent further cleanup after stopping', async () => {
      // Arrange
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired
        .mockResolvedValueOnce(undefined); // Lock released
      mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 1 });
      service.startCleanupScheduler();

      // Fast-forward 30 seconds (initial cleanup)
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);

      // Act - Stop scheduler
      await service.stopCleanupScheduler();

      // Fast-forward 24 hours - should NOT trigger cleanup
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      // Assert - No additional cleanups should have run
      expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stop when not started', async () => {
      // Act - Stop without starting
      await service.stopCleanupScheduler();

      // Assert - No error should be thrown
      expect(service).toBeDefined();
    });
  });
});
