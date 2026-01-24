/**
 * Unit tests for PrismaTenantRepository
 * Tests tenant repository adapter with mocked Prisma client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaTenantRepository } from '../../../src/adapters/prisma/tenant.repository';
import { createMockPrismaClient, type MockPrismaClient } from '../../mocks/prisma.mock';
import { buildTenant, sampleTenant } from '../../fixtures/tenants';
import { Prisma } from '../../../src/generated/prisma/client';

describe('PrismaTenantRepository', () => {
  let repository: PrismaTenantRepository;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    // Cast to any to bypass type checking for mock
    repository = new PrismaTenantRepository(mockPrisma as any);
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns tenant when exists', async () => {
      // Arrange
      const tenant = buildTenant({ id: 'tenant_123' });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

      // Act
      const result = await repository.findById('tenant_123');

      // Assert - returns TenantEntity (mapped from Prisma Tenant)
      expect(result).toEqual({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        apiKeyPublic: tenant.apiKeyPublic,
        stripeAccountId: tenant.stripeAccountId,
        stripeOnboarded: tenant.stripeOnboarded,
        commissionPercent: Number(tenant.commissionPercent),
        depositPercent: tenant.depositPercent ? Number(tenant.depositPercent) : null,
        balanceDueDays: tenant.balanceDueDays,
        isActive: tenant.isActive,
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant_123' },
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns null when not found', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findById('nonexistent');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('findBySlug', () => {
    it('returns tenant by slug', async () => {
      // Arrange
      const tenant = buildTenant({ slug: 'bella-weddings' });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

      // Act
      const result = await repository.findBySlug('bella-weddings');

      // Assert - returns TenantEntity (mapped from Prisma Tenant)
      expect(result?.slug).toBe('bella-weddings');
      expect(result?.commissionPercent).toBe(Number(tenant.commissionPercent));
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'bella-weddings' },
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns null when slug not found', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findBySlug('nonexistent-slug');

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'nonexistent-slug' },
      });
    });
  });

  describe('update', () => {
    it('updates tenant fields', async () => {
      // Arrange
      const originalTenant = buildTenant({
        id: 'tenant_123',
        name: 'Original Name',
        commissionPercent: new Prisma.Decimal(10.0),
      });
      const updatedTenant = {
        ...originalTenant,
        name: 'Updated Name',
        commissionPercent: new Prisma.Decimal(15.0),
      };
      mockPrisma.tenant.update.mockResolvedValue(updatedTenant);

      // Act
      const result = await repository.update('tenant_123', {
        name: 'Updated Name',
        commissionPercent: 15.0,
      });

      // Assert
      expect(result.name).toBe('Updated Name');
      expect(result.commissionPercent.toNumber()).toBe(15.0);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant_123' },
        data: {
          name: 'Updated Name',
          commissionPercent: 15.0,
        },
      });
      expect(mockPrisma.tenant.update).toHaveBeenCalledTimes(1);
    });

    it('updates branding configuration', async () => {
      // Arrange
      const branding = {
        primaryColor: '#8B7355',
        secondaryColor: '#D4A574',
        fontFamily: 'Inter',
      };
      const updatedTenant = buildTenant({
        id: 'tenant_123',
        branding,
      });
      mockPrisma.tenant.update.mockResolvedValue(updatedTenant);

      // Act
      const result = await repository.update('tenant_123', { branding });

      // Assert
      expect(result.branding).toEqual(branding);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant_123' },
        data: { branding },
      });
    });

    it('updates Stripe onboarding status', async () => {
      // Arrange
      const updatedTenant = buildTenant({
        id: 'tenant_123',
        stripeAccountId: 'acct_test123',
        stripeOnboarded: true,
      });
      mockPrisma.tenant.update.mockResolvedValue(updatedTenant);

      // Act
      const result = await repository.update('tenant_123', {
        stripeAccountId: 'acct_test123',
        stripeOnboarded: true,
      });

      // Assert
      expect(result.stripeAccountId).toBe('acct_test123');
      expect(result.stripeOnboarded).toBe(true);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant_123' },
        data: {
          stripeAccountId: 'acct_test123',
          stripeOnboarded: true,
        },
      });
    });
  });
});
