/**
 * Agent Read Tools
 *
 * Read-only tools for the MAIS Business Growth Agent.
 * These tools wrap existing API endpoints and provide data for agent context.
 *
 * Security:
 * - All tools use tenantId from JWT context
 * - Never expose sensitive fields (see DENY_LIST_FIELDS)
 * - Sanitize user-controlled data before returning
 */

import type { AgentTool, ToolContext, AgentToolResult } from './types';
import { sanitizeForContext } from './types';
import { PrismaTenantRepository } from '../../adapters/prisma';
import { logger } from '../../lib/core/logger';

/**
 * get_tenant - Business profile
 *
 * Returns: name, slug, branding, Stripe status
 */
export const getTenantTool: AgentTool = {
  name: 'get_tenant',
  description: 'Get business profile including name, branding, and payment setup status',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          emailVerified: true,
          branding: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          backgroundColor: true,
          stripeOnboarded: true,
          depositPercent: true,
          balanceDueDays: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      return {
        success: true,
        data: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          email: tenant.email,
          emailVerified: tenant.emailVerified,
          branding: tenant.branding,
          colors: {
            primary: tenant.primaryColor,
            secondary: tenant.secondaryColor,
            accent: tenant.accentColor,
            background: tenant.backgroundColor,
          },
          stripeConnected: tenant.stripeOnboarded,
          depositPercent: tenant.depositPercent ? Number(tenant.depositPercent) : null,
          balanceDueDays: tenant.balanceDueDays,
          isActive: tenant.isActive,
          createdAt: tenant.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_tenant tool');
      return { success: false, error: 'Failed to fetch tenant profile' };
    }
  },
};

/**
 * get_dashboard - Business overview
 *
 * Returns: revenue, booking count, upcoming bookings
 */
export const getDashboardTool: AgentTool = {
  name: 'get_dashboard',
  description: 'Get business dashboard with package count, booking stats, and revenue overview',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Get counts
      const [packageCount, addOnCount, bookingStats] = await Promise.all([
        prisma.package.count({ where: { tenantId } }),
        prisma.addOn.count({ where: { tenantId } }),
        prisma.booking.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
          _sum: { totalCents: true },
        }),
      ]);

      // Calculate stats
      const now = new Date();
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get upcoming bookings
      const upcomingBookings = await prisma.booking.count({
        where: {
          tenantId,
          eventDate: { gte: now, lte: next30Days },
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
      });

      // Calculate revenue from confirmed bookings
      const revenueStats = bookingStats
        .filter((s) => ['PAID', 'CONFIRMED', 'FULFILLED'].includes(s.status))
        .reduce((acc, s) => acc + (s._sum.totalCents || 0), 0);

      // Get this month's revenue
      const thisMonthBookings = await prisma.booking.aggregate({
        where: {
          tenantId,
          createdAt: { gte: thisMonthStart },
          status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
        },
        _sum: { totalCents: true },
      });

      // Format status counts
      const statusCounts: Record<string, number> = {};
      let totalBookings = 0;
      for (const stat of bookingStats) {
        statusCounts[stat.status.toLowerCase()] = stat._count;
        totalBookings += stat._count;
      }

      return {
        success: true,
        data: {
          packages: packageCount,
          addOns: addOnCount,
          bookings: {
            total: totalBookings,
            upcoming: upcomingBookings,
            byStatus: statusCounts,
          },
          revenue: {
            totalCents: revenueStats,
            thisMonthCents: thisMonthBookings._sum.totalCents || 0,
          },
        },
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_dashboard tool');
      return { success: false, error: 'Failed to fetch dashboard' };
    }
  },
};

/**
 * get_packages - All packages
 *
 * Returns: array of packages or single package if ID provided
 */
export const getPackagesTool: AgentTool = {
  name: 'get_packages',
  description: 'Get all packages or a single package by ID. Returns pricing, photos, and booking settings.',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Optional package ID to get a single package',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include inactive packages (default: false)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageId = params.packageId as string | undefined;
    const includeInactive = params.includeInactive as boolean | undefined;

    try {
      if (packageId) {
        const pkg = await prisma.package.findFirst({
          where: { id: packageId, tenantId },
          include: { addOns: true },
        });

        if (!pkg) {
          return { success: false, error: 'Package not found' };
        }

        return {
          success: true,
          data: formatPackage(pkg),
        };
      }

      const packages = await prisma.package.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { active: true }),
        },
        include: { addOns: true },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: packages.map(formatPackage),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_packages tool');
      return { success: false, error: 'Failed to fetch packages' };
    }
  },
};

/**
 * get_bookings - Bookings with filters
 *
 * Returns: array of bookings
 */
export const getBookingsTool: AgentTool = {
  name: 'get_bookings',
  description: 'Get bookings with optional filters for status, date range, or search',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED'],
      },
      fromDate: {
        type: 'string',
        description: 'Filter bookings from this date (YYYY-MM-DD)',
      },
      toDate: {
        type: 'string',
        description: 'Filter bookings until this date (YYYY-MM-DD)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of bookings to return (default: 20)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const status = params.status as string | undefined;
    const fromDate = params.fromDate as string | undefined;
    const toDate = params.toDate as string | undefined;
    const limit = (params.limit as number) || 20;

    try {
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId,
          ...(status ? { status: status as any } : {}),
          ...(fromDate || toDate
            ? {
                eventDate: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(toDate) } : {}),
                },
              }
            : {}),
        },
        include: { package: true },
        orderBy: { eventDate: 'asc' },
        take: Math.min(limit, 50),
      });

      return {
        success: true,
        data: bookings.map((b) => ({
          id: b.id,
          packageTitle: sanitizeForContext(b.package?.title || 'Unknown', 50),
          coupleName: sanitizeForContext(b.coupleName, 50),
          email: b.email,
          eventDate: b.eventDate.toISOString().split('T')[0],
          totalCents: b.totalCents,
          status: b.status,
          createdAt: b.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_bookings tool');
      return { success: false, error: 'Failed to fetch bookings' };
    }
  },
};

/**
 * get_booking - Single booking details
 *
 * Returns: full booking with customer details
 */
export const getBookingTool: AgentTool = {
  name: 'get_booking',
  description: 'Get full details of a single booking including customer info and payment status',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'Booking ID to retrieve',
      },
    },
    required: ['bookingId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const bookingId = params.bookingId as string;

    try {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { package: true, customer: true },
      });

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      return {
        success: true,
        data: {
          id: booking.id,
          packageId: booking.packageId,
          packageTitle: sanitizeForContext(booking.package?.title || 'Unknown', 50),
          coupleName: sanitizeForContext(booking.coupleName, 50),
          email: booking.email,
          phone: booking.phone,
          eventDate: booking.eventDate.toISOString().split('T')[0],
          totalCents: booking.totalCents,
          status: booking.status,
          depositPaidAmount: booking.depositPaidAmount,
          balanceDueDate: booking.balanceDueDate?.toISOString().split('T')[0],
          balancePaidAmount: booking.balancePaidAmount,
          cancelledBy: booking.cancelledBy,
          cancellationReason: booking.cancellationReason
            ? sanitizeForContext(booking.cancellationReason, 100)
            : null,
          refundStatus: booking.refundStatus,
          refundAmount: booking.refundAmount,
          createdAt: booking.createdAt.toISOString(),
          confirmedAt: booking.confirmedAt?.toISOString(),
          cancelledAt: booking.cancelledAt?.toISOString(),
        },
      };
    } catch (error) {
      logger.error({ error, tenantId, bookingId }, 'Error in get_booking tool');
      return { success: false, error: 'Failed to fetch booking' };
    }
  },
};

/**
 * check_availability - Date availability
 *
 * Returns: boolean availability and any conflicts
 */
export const checkAvailabilityTool: AgentTool = {
  name: 'check_availability',
  description: 'Check if a specific date is available for booking',
  inputSchema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Date to check (YYYY-MM-DD)',
      },
    },
    required: ['date'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const dateStr = params.date as string;

    try {
      const date = new Date(dateStr);

      // Check for existing booking
      const existingBooking = await prisma.booking.findFirst({
        where: {
          tenantId,
          eventDate: date,
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
        select: { id: true, status: true },
      });

      // Check for blackout
      const blackout = await prisma.blackoutDate.findFirst({
        where: {
          tenantId,
          date,
        },
        select: { reason: true },
      });

      const isAvailable = !existingBooking && !blackout;
      const conflict = existingBooking
        ? { type: 'booking', status: existingBooking.status }
        : blackout
          ? { type: 'blackout', reason: blackout.reason ? sanitizeForContext(blackout.reason, 50) : null }
          : null;

      return {
        success: true,
        data: {
          date: dateStr,
          available: isAvailable,
          conflict,
        },
      };
    } catch (error) {
      logger.error({ error, tenantId, date: dateStr }, 'Error in check_availability tool');
      return { success: false, error: 'Failed to check availability' };
    }
  },
};

/**
 * get_blackouts - Blocked dates
 *
 * Returns: array of blackout dates
 */
export const getBlackoutsTool: AgentTool = {
  name: 'get_blackouts',
  description: 'Get all blocked dates (blackouts)',
  inputSchema: {
    type: 'object',
    properties: {
      fromDate: {
        type: 'string',
        description: 'Filter blackouts from this date (YYYY-MM-DD)',
      },
      toDate: {
        type: 'string',
        description: 'Filter blackouts until this date (YYYY-MM-DD)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const fromDate = params.fromDate as string | undefined;
    const toDate = params.toDate as string | undefined;

    try {
      const blackouts = await prisma.blackoutDate.findMany({
        where: {
          tenantId,
          ...(fromDate || toDate
            ? {
                date: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(toDate) } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: 'asc' },
      });

      return {
        success: true,
        data: blackouts.map((b) => ({
          id: b.id,
          date: b.date.toISOString().split('T')[0],
          reason: b.reason ? sanitizeForContext(b.reason, 100) : null,
        })),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_blackouts tool');
      return { success: false, error: 'Failed to fetch blackouts' };
    }
  },
};

/**
 * get_landing_page - Storefront config
 *
 * Returns: pages, sections, content
 */
export const getLandingPageTool: AgentTool = {
  name: 'get_landing_page',
  description: 'Get storefront landing page configuration including sections and content',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfig: true },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      return {
        success: true,
        data: tenant.landingPageConfig || { sections: {} },
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_landing_page tool');
      return { success: false, error: 'Failed to fetch landing page config' };
    }
  },
};

/**
 * get_stripe_status - Payment setup
 *
 * Returns: connected status, requirements, dashboard URL
 */
export const getStripeStatusTool: AgentTool = {
  name: 'get_stripe_status',
  description: 'Get Stripe Connect payment setup status and any pending requirements',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeOnboarded: true, stripeAccountId: true },
      });

      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      return {
        success: true,
        data: {
          connected: tenant.stripeOnboarded,
          hasAccount: !!tenant.stripeAccountId,
          // Don't expose the actual account ID
          needsOnboarding: !tenant.stripeOnboarded,
        },
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in get_stripe_status tool');
      return { success: false, error: 'Failed to fetch Stripe status' };
    }
  },
};

/**
 * Helper to format package for agent context
 */
function formatPackage(pkg: any) {
  return {
    id: pkg.id,
    slug: pkg.slug,
    title: sanitizeForContext(pkg.title, 100),
    description: sanitizeForContext(pkg.description || '', 500),
    priceCents: pkg.priceCents,
    priceFormatted: `$${(pkg.priceCents / 100).toFixed(2)}`,
    photoUrl: pkg.photoUrl,
    photos: pkg.photos || [],
    bookingType: pkg.bookingType,
    active: pkg.active,
    segmentId: pkg.segmentId,
    addOns: pkg.addOns?.map((a: any) => ({
      id: a.id,
      title: sanitizeForContext(a.title, 50),
      priceCents: a.priceCents,
    })) || [],
    createdAt: pkg.createdAt.toISOString(),
  };
}

/**
 * All read tools exported as array for registration
 */
export const readTools: AgentTool[] = [
  getTenantTool,
  getDashboardTool,
  getPackagesTool,
  getBookingsTool,
  getBookingTool,
  checkAvailabilityTool,
  getBlackoutsTool,
  getLandingPageTool,
  getStripeStatusTool,
];
