/**
 * Tenant Provisioning Service Tests
 *
 * Tests:
 * - createFromSignup: Simplified signup (tenant record only — no defaults)
 * - createFullyProvisioned: Admin API (tenant + segment + tiers + sections atomically)
 * - Error handling and rollback behavior
 *
 * NOTE: These are integration tests that require DATABASE_URL to be set.
 * If DATABASE_URL is not set, tests are skipped (valid for CI without DB).
 *
 * Onboarding redesign (2026-02-20): createFromSignup no longer creates
 * default segments, tiers, or sections. The background build pipeline
 * creates those after the intake form is completed (Phase 4).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TenantProvisioningService } from '../../src/services/tenant-provisioning.service';
import { TenantProvisioningError } from '../../src/lib/errors';
import { getTestPrisma } from '../helpers/global-prisma';

const hasDatabaseUrl = !!(process.env.DATABASE_URL || process.env.DATABASE_URL_TEST);

describe.runIf(hasDatabaseUrl)('TenantProvisioningService', () => {
  const prisma = getTestPrisma()!;

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
        // Get segment IDs for tier cleanup
        const segments = await prisma.segment.findMany({
          where: { tenantId: { in: tenantIds } },
          select: { id: true },
        });
        const segmentIds = segments.map((s) => s.id);

        // Delete in correct order (respecting foreign keys)
        await prisma.tier.deleteMany({ where: { segmentId: { in: segmentIds } } });
        await prisma.sectionContent.deleteMany({ where: { tenantId: { in: tenantIds } } });
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
    it('should create tenant record only (no defaults) for simplified onboarding', async () => {
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
      expect(result.tenant.onboardingStatus).toBe('PENDING_PAYMENT');

      // Verify NO defaults created (simplified signup — build pipeline creates later)
      expect(result.tiers).toHaveLength(0);
      expect(result.sectionContent).toHaveLength(0);

      // Verify no segment in database for this tenant
      const segments = await prisma.segment.findMany({
        where: { tenantId: result.tenant.id },
      });
      expect(segments).toHaveLength(0);
    });

    it('should throw TenantProvisioningError on failure', async () => {
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
