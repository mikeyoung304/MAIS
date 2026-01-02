/**
 * Shared Prisma Mock Helper
 *
 * Provides consistent, type-safe Prisma mocks for unit tests.
 * Uses vitest-mock-extended for proper TypeScript support.
 *
 * Usage:
 * ```typescript
 * import { createMockPrisma } from '../helpers/mock-prisma';
 *
 * let mockPrisma: DeepMockProxy<PrismaClient>;
 *
 * beforeEach(() => {
 *   mockPrisma = createMockPrisma();
 * });
 * ```
 *
 * @see todos/615-pending-p3-mock-pattern-inconsistency.md
 */

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';

/**
 * Create a type-safe Prisma mock with common configurations.
 *
 * Features:
 * - Uses mockDeep for full type safety
 * - Pre-configures $transaction to pass through callback
 * - All model methods are automatically mocked
 *
 * @returns DeepMockProxy<PrismaClient> - Type-safe mock client
 *
 * @example
 * ```typescript
 * const mockPrisma = createMockPrisma();
 *
 * // Mock a findMany call
 * mockPrisma.conversationTrace.findMany.mockResolvedValue([{ id: '1' }]);
 *
 * // Mock a transaction
 * mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
 * ```
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();

  // Configure $transaction to execute callback with the mock
  // This is the most common pattern in MAIS tests
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    // For array-based transactions, return empty array
    return [];
  });

  return mock;
}

// Re-export types for convenience
export type { DeepMockProxy } from 'vitest-mock-extended';
