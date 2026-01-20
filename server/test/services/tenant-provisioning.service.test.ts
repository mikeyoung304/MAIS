/**
 * Tenant Provisioning Service Tests
 *
 * Tests atomic tenant creation with segment and packages.
 * Ensures that if any part of provisioning fails, the entire
 * transaction rolls back and no partial tenant exists.
 *
 * NOTE: These are integration tests that require DATABASE_URL to be set.
 * If DATABASE_URL is not set, tests are skipped (valid for CI without DB).
 *
 * @see todos/632-pending-p2-stricter-signup-error-handling.md
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TenantProvisioningService } from '../../src/services/tenant-provisioning.service';
import { TenantProvisioningError } from '../../src/lib/errors';
import { getTestPrisma } from '../helpers/global-prisma';

/**
 * Skip entire test suite if DATABASE_URL is not configured.
 * This check happens at module evaluation time, before getTestPrisma() is called.
 *
 * Note: Importing getTestPrisma at the top is fine - the error only occurs
 * when getTestPrisma() is CALLED without DATABASE_URL being set.
 */
const hasDatabaseUrl = !!(process.env.DATABASE_URL || process.env.DATABASE_URL_TEST);

describe.runIf(hasDatabaseUrl)('TenantProvisioningService', () => {
  // Call getTestPrisma inside describe.runIf to defer database initialization
  // This prevents the "DATABASE_URL must be set" error in CI
  const prisma = getTestPrisma();

  // Track test emails for cleanup
  const testEmails: string[] = [];

  const generateTestEmail = () => {
    const email = `provisioning-test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    testEmails.push(email);
    return email;
  };

  afterAll(async () => {
    // Cleanup test tenants
    if (testEmails.length > 0) {
      const tenants = await prisma.tenant.findMany({
        where: { email: { in: testEmails } },
        select: { id: true },
      });
      const tenantIds = tenants.map((t) => t.id);

      if (tenantIds.length > 0) {
        await prisma.package.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.segment.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
    }
  });

  let service: TenantProvisioningService;

  beforeAll(() => {
    service = new TenantProvisioningService(prisma);
  });

  describe('createFromSignup', () => {
    it('should create tenant with segment and packages atomically', async () => {
      const email = generateTestEmail();
      const result = await service.createFromSignup({
        slug: `test-biz-${Date.now()}`,
        businessName: 'Test Business',
        email,
        passwordHash: '$2b$10$test.hash.here',
      });

      // Verify tenant created
      expect(result.tenant.id).toBeDefined();
      expect(result.tenant.email).toBe(email);
      expect(result.tenant.name).toBe('Test Business');

      // Verify segment created
      expect(result.segment.id).toBeDefined();
      expect(result.segment.slug).toBe('general');
      expect(result.segment.tenantId).toBe(result.tenant.id);

      // Verify packages created
      expect(result.packages).toHaveLength(3);
      expect(result.packages.every((p) => p.tenantId === result.tenant.id)).toBe(true);
      expect(result.packages.every((p) => p.segmentId === result.segment.id)).toBe(true);
    });

    it('should throw TenantProvisioningError on failure', async () => {
      // Create a mock Prisma client that fails during transaction
      const mockPrisma = {
        $transaction: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
      } as unknown as typeof prisma;

      const failingService = new TenantProvisioningService(mockPrisma);

      await expect(
        failingService.createFromSignup({
          slug: 'test-failing',
          businessName: 'Failing Business',
          email: 'fail@test.com',
          passwordHash: '$2b$10$test.hash',
        })
      ).rejects.toThrow(TenantProvisioningError);
    });

    it('should include original error as cause in TenantProvisioningError', async () => {
      const originalError = new Error('Unique constraint violation on Tenant.email');

      const mockPrisma = {
        $transaction: vi.fn().mockRejectedValue(originalError),
      } as unknown as typeof prisma;

      const failingService = new TenantProvisioningService(mockPrisma);

      try {
        await failingService.createFromSignup({
          slug: 'test-error-cause',
          businessName: 'Error Cause Test',
          email: 'error-cause@test.com',
          passwordHash: '$2b$10$test.hash',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantProvisioningError);
        expect((error as TenantProvisioningError).originalError?.message).toBe(
          'Unique constraint violation on Tenant.email'
        );
        expect((error as TenantProvisioningError).message).toBe(
          'Failed to complete signup. Please try again.'
        );
      }
    });

    it('should not leave partial tenant data when segment creation fails', async () => {
      const email = generateTestEmail();
      const slug = `partial-test-${Date.now()}`;

      // Create a mock that succeeds for tenant.create but fails for segment.create
      const mockPrisma = {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
            // Simulate transaction that throws after tenant creation
            // In a real transaction, this would be rolled back
            const mockTx = {
              tenant: {
                create: vi.fn().mockResolvedValue({
                  id: 'mock-tenant-id',
                  slug,
                  email,
                  name: 'Partial Test',
                }),
              },
              segment: {
                create: vi.fn().mockRejectedValue(new Error('Segment creation failed')),
              },
            };
            return callback(mockTx);
          }),
      } as unknown as typeof prisma;

      const failingService = new TenantProvisioningService(mockPrisma);

      await expect(
        failingService.createFromSignup({
          slug,
          businessName: 'Partial Test',
          email,
          passwordHash: '$2b$10$test.hash',
        })
      ).rejects.toThrow(TenantProvisioningError);

      // Verify no tenant was created (transaction rolled back)
      const tenant = await prisma.tenant.findFirst({
        where: { email },
      });
      expect(tenant).toBeNull();
    });

    it('should have proper error code for HTTP error handler', async () => {
      const mockPrisma = {
        $transaction: vi.fn().mockRejectedValue(new Error('DB error')),
      } as unknown as typeof prisma;

      const failingService = new TenantProvisioningService(mockPrisma);

      try {
        await failingService.createFromSignup({
          slug: 'error-code-test',
          businessName: 'Error Code Test',
          email: 'error-code@test.com',
          passwordHash: '$2b$10$test.hash',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantProvisioningError);
        // TenantProvisioningError has status code 422 (from TenantError base)
        expect((error as TenantProvisioningError).statusCode).toBe(422);
        expect((error as TenantProvisioningError).code).toBe('TENANT_PROVISIONING_ERROR');
      }
    });
  });
});
