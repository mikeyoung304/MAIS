/**
 * Platform Admin Controller
 * Handles platform-level operations (tenant management, system monitoring, etc.)
 */

import type { PrismaClient, Tenant } from '../generated/prisma/client';
import type { TenantDto, PlatformStats } from '@macon/contracts';
import { logger } from '../lib/core/logger';

export class PlatformAdminController {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all tenants with their stats
   *
   * Retrieves all tenants with package and booking counts for the platform admin dashboard.
   * By default excludes test tenants to show only production data.
   *
   * @param includeTestTenants - Whether to include test tenants in the results (default: false)
   * @returns Promise resolving to array of TenantDto objects ordered by creation date descending,
   *          each containing tenant metadata and aggregated stats (packageCount, bookingCount)
   * @throws Error if database query fails
   */
  async getAllTenants(includeTestTenants = false): Promise<TenantDto[]> {
    try {
      if (!includeTestTenants) {
        logger.debug({ method: 'getAllTenants' }, 'Excluding test tenants from tenant list');
      }

      const tenants = await this.prisma.tenant.findMany({
        where: includeTestTenants ? undefined : { isTestTenant: false },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              tiers: true,
              bookings: true,
            },
          },
        },
      });

      return tenants.map((tenant: Tenant & { _count: { tiers: number; bookings: number } }) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        commissionPercent: Number(tenant.commissionPercent),
        stripeAccountId: tenant.stripeAccountId,
        stripeOnboarded: tenant.stripeOnboarded,
        stripeConnected: tenant.stripeOnboarded, // Alias for frontend compatibility
        isActive: tenant.isActive,
        isTestTenant: tenant.isTestTenant,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        tierCount: tenant._count.tiers,
        bookingCount: tenant._count.bookings,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch tenants');
      throw error;
    }
  }

  /**
   * Get platform-wide statistics
   *
   * Aggregates data across all tenants for the platform admin dashboard.
   * By default excludes test tenants to provide accurate production metrics.
   *
   * Metrics include:
   * - Tenant counts (total, active)
   * - Segment counts (total, active)
   * - Booking metrics (total, confirmed, pending)
   * - Revenue metrics (total, platform commission, tenant revenue)
   * - Current month metrics (bookings, revenue)
   *
   * Performance optimization: Pre-fetches real tenant IDs once, then uses IN clause
   * for all related queries. This uses existing tenantId indexes instead of JOINing
   * to the Tenant table on every COUNT/aggregate query.
   *
   * @param includeTestTenants - Whether to include test tenant data in aggregations (default: false)
   * @returns Promise resolving to PlatformStats object containing all aggregated metrics
   * @throws Error if any database aggregation query fails
   */
  async getStats(includeTestTenants = false): Promise<PlatformStats> {
    try {
      if (!includeTestTenants) {
        logger.debug({ method: 'getStats' }, 'Excluding test tenants from platform stats');
      }

      // Base filter for tenant table queries
      const tenantFilter = includeTestTenants ? {} : { isTestTenant: false };

      // Pre-fetch real tenant IDs once (uses isTestTenant index on Tenant table)
      // Then use IN clause for related queries (uses existing tenantId indexes)
      const realTenantIds = includeTestTenants
        ? undefined // undefined means no filter - include all
        : await this.prisma.tenant
            .findMany({
              where: { isTestTenant: false },
              select: { id: true },
            })
            .then((tenants: { id: string }[]) => tenants.map((t) => t.id));

      // Build related filter using IN clause (uses tenantId indexes, avoids JOINs)
      const relatedTenantFilter = realTenantIds ? { tenantId: { in: realTenantIds } } : {};

      // Current month start for time-based metrics
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      // Execute all independent queries in parallel for optimal performance
      // This reduces latency from 10 sequential round-trips to 1 parallel batch
      const [
        totalTenants,
        activeTenants,
        totalSegments,
        activeSegments,
        totalBookings,
        confirmedBookings,
        pendingBookings,
        revenueStats,
        monthStats,
      ] = await Promise.all([
        // Tenant counts
        this.prisma.tenant.count({
          where: tenantFilter,
        }),
        this.prisma.tenant.count({
          where: { ...tenantFilter, isActive: true },
        }),

        // Segment counts (from real tenants only)
        this.prisma.segment.count({
          where: relatedTenantFilter,
        }),
        this.prisma.segment.count({
          where: { ...relatedTenantFilter, active: true },
        }),

        // Booking metrics (from real tenants only)
        this.prisma.booking.count({
          where: relatedTenantFilter,
        }),
        this.prisma.booking.count({
          where: { ...relatedTenantFilter, status: 'CONFIRMED' },
        }),
        this.prisma.booking.count({
          where: { ...relatedTenantFilter, status: 'PENDING' },
        }),

        // Revenue metrics (from real tenants only)
        this.prisma.booking.aggregate({
          _sum: {
            totalPrice: true,
            commissionAmount: true,
          },
          where: {
            ...relatedTenantFilter,
            status: 'CONFIRMED',
          },
        }),

        // Current month stats (from real tenants only)
        this.prisma.booking.aggregate({
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
        }),
      ]);

      // Calculate derived revenue metrics
      const totalRevenue = revenueStats._sum.totalPrice || 0;
      const platformCommission = revenueStats._sum.commissionAmount || 0;
      const tenantRevenue = totalRevenue - platformCommission;

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
