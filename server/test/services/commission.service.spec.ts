/**
 * Unit tests for CommissionService
 *
 * Tests commission calculation, booking totals, and refund calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommissionService } from '../../src/services/commission.service';
import type { PrismaClient } from '../../src/generated/prisma';

describe('CommissionService', () => {
  let service: CommissionService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create a mock Prisma client
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      },
      addOn: {
        findMany: vi.fn(),
      },
    };

    service = new CommissionService(mockPrisma as unknown as PrismaClient);
  });

  describe('calculateCommission - Basic Calculation', () => {
    it('should calculate commission with standard rate (12%)', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_123',
        slug: 'test-tenant',
        commissionPercent: 12.0,
      });

      // Act
      const result = await service.calculateCommission('tenant_123', 50000);

      // Assert
      expect(result.amount).toBe(6000); // $500 * 12% = $60
      expect(result.percent).toBe(12.0);
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant_123' },
        select: { commissionPercent: true, slug: true },
      });
    });

    it('should perform tenant lookup to get commission rate', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_456',
        slug: 'another-tenant',
        commissionPercent: 15.0,
      });

      // Act
      const result = await service.calculateCommission('tenant_456', 100000);

      // Assert
      expect(result.amount).toBe(15000); // $1000 * 15% = $150
      expect(result.percent).toBe(15.0);
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should round up to nearest cent', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_789',
        slug: 'round-test',
        commissionPercent: 10.5,
      });

      // Act - $99.99 * 10.5% = $10.4990 should round up to $10.50
      const result = await service.calculateCommission('tenant_789', 9999);

      // Assert
      expect(result.amount).toBe(1050); // Rounds up to $10.50
      expect(result.percent).toBe(10.5);
    });

    it('should enforce Stripe minimum (0.5%)', async () => {
      // Arrange - tenant has 0.1% commission (below Stripe minimum)
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_min',
        slug: 'min-test',
        commissionPercent: 0.1,
      });

      // Act
      const result = await service.calculateCommission('tenant_min', 100000);

      // Assert - should enforce 0.5% minimum
      expect(result.amount).toBe(500); // $1000 * 0.5% = $5
      expect(result.percent).toBe(0.1); // Original percent is preserved
    });

    it('should enforce Stripe maximum (50%)', async () => {
      // Arrange - tenant has 75% commission (above Stripe maximum)
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_max',
        slug: 'max-test',
        commissionPercent: 75.0,
      });

      // Act
      const result = await service.calculateCommission('tenant_max', 100000);

      // Assert - should enforce 50% maximum
      expect(result.amount).toBe(50000); // $1000 * 50% = $500
      expect(result.percent).toBe(75.0); // Original percent is preserved
    });

    it('should throw error for invalid tenant', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.calculateCommission('nonexistent', 50000)).rejects.toThrow(
        'Tenant not found: nonexistent'
      );
    });
  });

  describe('calculateBookingTotal - Booking Total Calculation', () => {
    it('should calculate total for package only (no add-ons)', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_123',
        slug: 'test-tenant',
        commissionPercent: 12.0,
      });

      // Act
      const result = await service.calculateBookingTotal(
        'tenant_123',
        50000, // $500 package
        []
      );

      // Assert
      expect(result.packagePrice).toBe(50000);
      expect(result.addOnsTotal).toBe(0);
      expect(result.subtotal).toBe(50000);
      expect(result.commissionAmount).toBe(6000); // 12% of $500
      expect(result.commissionPercent).toBe(12.0);
      expect(result.tenantReceives).toBe(44000); // $500 - $60
    });

    it('should calculate total for package + multiple add-ons', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_123',
        slug: 'test-tenant',
        commissionPercent: 12.0,
      });

      mockPrisma.addOn.findMany.mockResolvedValue([
        { id: 'addon_1', price: 10000 }, // $100
        { id: 'addon_2', price: 15000 }, // $150
      ]);

      // Act
      const result = await service.calculateBookingTotal(
        'tenant_123',
        50000, // $500 package
        ['addon_1', 'addon_2']
      );

      // Assert
      expect(result.packagePrice).toBe(50000);
      expect(result.addOnsTotal).toBe(25000); // $250
      expect(result.subtotal).toBe(75000); // $750
      expect(result.commissionAmount).toBe(9000); // 12% of $750
      expect(result.tenantReceives).toBe(66000); // $750 - $90
    });

    it('should validate add-ons belong to tenant', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_123',
        slug: 'test-tenant',
        commissionPercent: 12.0,
      });

      // Only one add-on returned (missing addon_2)
      mockPrisma.addOn.findMany.mockResolvedValue([{ id: 'addon_1', price: 10000 }]);

      // Act & Assert
      await expect(
        service.calculateBookingTotal(
          'tenant_123',
          50000,
          ['addon_1', 'addon_2'] // Request 2, but only 1 exists
        )
      ).rejects.toThrow('Invalid or inactive add-ons: addon_2');

      // Verify tenantId was used in query
      expect(mockPrisma.addOn.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_123',
          id: { in: ['addon_1', 'addon_2'] },
          active: true,
        },
        select: { id: true, price: true },
      });
    });

    it('should throw error for inactive add-ons', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant_123',
        slug: 'test-tenant',
        commissionPercent: 12.0,
      });

      // No add-ons returned (both are inactive)
      mockPrisma.addOn.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.calculateBookingTotal('tenant_123', 50000, ['addon_inactive'])
      ).rejects.toThrow('Invalid or inactive add-ons: addon_inactive');
    });
  });

  describe('calculateRefundCommission - Refund Commission', () => {
    it('should calculate commission for full refund (100%)', () => {
      // Act
      const result = service.calculateRefundCommission(
        6000, // $60 original commission
        50000, // $500 refund (full)
        50000 // $500 original total
      );

      // Assert
      expect(result).toBe(6000); // Full commission reversed
    });

    it('should calculate commission for partial refund (50%)', () => {
      // Act
      const result = service.calculateRefundCommission(
        6000, // $60 original commission
        25000, // $250 refund (half)
        50000 // $500 original total
      );

      // Assert
      expect(result).toBe(3000); // Half commission reversed ($30)
    });
  });
});
