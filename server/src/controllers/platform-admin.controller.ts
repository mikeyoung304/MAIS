/**
 * Platform Admin Controller
 * Handles platform-level operations (tenant management, system monitoring, etc.)
 */

import type { PrismaClient } from '../generated/prisma/index.js';
import type { TenantDto, PlatformStats } from '@macon/contracts';
import { logger } from '../lib/core/logger';

export class PlatformAdminController {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all tenants with their stats
   * @param includeTestTenants - Whether to include test tenants (default: false)
   */
  async getAllTenants(includeTestTenants = false): Promise<TenantDto[]> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: includeTestTenants ? undefined : { isTestTenant: false },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              packages: true,
              bookings: true,
            },
          },
        },
      });

      return tenants.map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        commissionPercent: Number(tenant.commissionPercent),
        stripeAccountId: tenant.stripeAccountId,
        stripeOnboarded: tenant.stripeOnboarded,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        packageCount: tenant._count.packages,
        bookingCount: tenant._count.bookings,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch tenants');
      throw error;
    }
  }

  /**
   * Get platform-wide statistics
   * Aggregates data across all real tenants (excludes test tenants)
   * @param includeTestTenants - Whether to include test tenant data (default: false)
   */
  async getStats(includeTestTenants = false): Promise<PlatformStats> {
    try {
      // Base filter for excluding test tenants from related data
      const tenantFilter = includeTestTenants ? {} : { isTestTenant: false };
      const relatedTenantFilter = includeTestTenants ? {} : { tenant: { isTestTenant: false } };

      // Aggregate tenant counts
      const totalTenants = await this.prisma.tenant.count({
        where: tenantFilter,
      });
      const activeTenants = await this.prisma.tenant.count({
        where: { ...tenantFilter, isActive: true },
      });

      // Aggregate segment counts (from real tenants only)
      const totalSegments = await this.prisma.segment.count({
        where: relatedTenantFilter,
      });
      const activeSegments = await this.prisma.segment.count({
        where: { ...relatedTenantFilter, active: true },
      });

      // Aggregate booking metrics (from real tenants only)
      const totalBookings = await this.prisma.booking.count({
        where: relatedTenantFilter,
      });
      const confirmedBookings = await this.prisma.booking.count({
        where: { ...relatedTenantFilter, status: 'CONFIRMED' },
      });
      const pendingBookings = await this.prisma.booking.count({
        where: { ...relatedTenantFilter, status: 'PENDING' },
      });

      // Aggregate revenue metrics (from real tenants only)
      const revenueStats = await this.prisma.booking.aggregate({
        _sum: {
          totalPrice: true,
          commissionAmount: true,
        },
        where: {
          ...relatedTenantFilter,
          status: 'CONFIRMED',
        },
      });

      const totalRevenue = revenueStats._sum.totalPrice || 0;
      const platformCommission = revenueStats._sum.commissionAmount || 0;
      const tenantRevenue = totalRevenue - platformCommission;

      // Optional: Current month stats (from real tenants only)
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const monthStats = await this.prisma.booking.aggregate({
        _count: true,
        _sum: {
          totalPrice: true,
        },
        where: {
          ...relatedTenantFilter,
          status: 'CONFIRMED',
          confirmedAt: {
            gte: startOfMonth,
          },
        },
      });

      return {
        // Tenant metrics
        totalTenants,
        activeTenants,

        // Segment metrics
        totalSegments,
        activeSegments,

        // Booking metrics
        totalBookings,
        confirmedBookings,
        pendingBookings,

        // Revenue metrics (in cents)
        totalRevenue,
        platformCommission,
        tenantRevenue,

        // Time-based metrics (optional)
        revenueThisMonth: monthStats._sum.totalPrice || 0,
        bookingsThisMonth: monthStats._count || 0,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch platform stats');
      throw error;
    }
  }
}
