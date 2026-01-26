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
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import type { Prisma } from '../../generated/prisma/client';
import { BookingStatus } from '../../generated/prisma/client';
import { handleToolError, buildDateRangeFilter, formatPrice, formatDateISO } from './utils';
import { ErrorMessages } from '../errors/agent-error';

/**
 * Type guard for BookingStatus enum
 */
function isValidBookingStatus(status: string): status is BookingStatus {
  return Object.values(BookingStatus).includes(status as BookingStatus);
}

/**
 * get_tenant - Business profile
 *
 * Returns: name, slug, branding, Stripe status
 */
export const getTenantTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_tenant tool');
      return {
        success: false,
        error: `Failed to fetch business profile: ${errorMessage}. Try refreshing your session or contact support if the issue persists.`,
        code: 'GET_TENANT_ERROR',
      };
    }
  },
};

/**
 * get_dashboard - Business overview
 *
 * Returns: revenue, booking count, upcoming bookings
 */
export const getDashboardTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
          _count: { _all: true },
          _sum: { totalPrice: true },
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
          date: { gte: now, lte: next30Days },
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
      });

      // Calculate revenue from confirmed bookings
      const revenueStats = bookingStats
        .filter((s) => ['PAID', 'CONFIRMED', 'FULFILLED'].includes(s.status))
        .reduce((acc, s) => acc + (s._sum.totalPrice ?? 0), 0);

      // Get this month's revenue
      const thisMonthBookings = await prisma.booking.aggregate({
        where: {
          tenantId,
          createdAt: { gte: thisMonthStart },
          status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
        },
        _sum: { totalPrice: true },
      });

      // Format status counts
      const statusCounts: Record<string, number> = {};
      let totalBookings = 0;
      for (const stat of bookingStats) {
        statusCounts[stat.status.toLowerCase()] = stat._count._all;
        totalBookings += stat._count._all;
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
            thisMonthCents: thisMonthBookings._sum.totalPrice ?? 0,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_dashboard tool');
      return {
        success: false,
        error: `Failed to fetch dashboard data: ${errorMessage}. This may be a temporary database issue. Try again in a few moments.`,
        code: 'GET_DASHBOARD_ERROR',
      };
    }
  },
};

/**
 * get_packages - All packages
 *
 * Returns: array of packages or single package if ID provided
 */
export const getPackagesTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_packages',
  description:
    'Get all packages or a single package by ID. Returns pricing, photos, and booking settings.',
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
          include: { addOns: { include: { addOn: true } } },
        });

        if (!pkg) {
          return {
            success: false,
            error: 'Unable to access package. Please check the ID and try again.',
          };
        }

        return {
          success: true,
          data: formatPackage(pkg),
        };
      }

      const limit = 50;
      const packages = await prisma.package.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { active: true }),
        },
        include: { addOns: { include: { addOn: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        data: packages.map(formatPackage),
        meta: {
          returned: packages.length,
          limit,
          hasMore: packages.length === limit,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_packages tool');
      return {
        success: false,
        error: `Failed to fetch packages: ${errorMessage}. Verify your session is valid and try again.`,
        code: 'GET_PACKAGES_ERROR',
      };
    }
  },
};

/**
 * get_bookings - Bookings with filters
 *
 * Returns: array of bookings
 */
export const getBookingsTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
    const requestedLimit = (params.limit as number) || 20;
    const effectiveLimit = Math.min(requestedLimit, 50);

    try {
      // Validate status if provided
      if (status && !isValidBookingStatus(status)) {
        return {
          success: false,
          error: `Invalid status "${status}". Valid values: ${Object.values(BookingStatus).join(', ')}`,
        };
      }

      const bookings = await prisma.booking.findMany({
        where: {
          tenantId,
          ...(status && isValidBookingStatus(status) ? { status } : {}),
          ...buildDateRangeFilter(fromDate, toDate),
        },
        include: { package: true, customer: true },
        orderBy: { date: 'asc' },
        take: effectiveLimit,
      });

      return {
        success: true,
        data: bookings.map((b) => ({
          id: b.id,
          packageName: sanitizeForContext(b.package?.name || 'Unknown', 50),
          customerName: sanitizeForContext(b.customer?.name || 'Unknown', 50),
          customerEmail: b.customer?.email ?? null,
          date: formatDateISO(b.date),
          totalPrice: b.totalPrice,
          status: b.status,
          notes: b.notes ? sanitizeForContext(b.notes, 500) : null,
          createdAt: b.createdAt.toISOString(),
        })),
        meta: {
          returned: bookings.length,
          limit: effectiveLimit,
          hasMore: bookings.length === effectiveLimit,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_bookings tool');
      return {
        success: false,
        error: `Failed to fetch bookings: ${errorMessage}. Check that date filters are in YYYY-MM-DD format and try again.`,
        code: 'GET_BOOKINGS_ERROR',
      };
    }
  },
};

/**
 * get_booking - Single booking details
 *
 * Returns: full booking with customer details
 */
export const getBookingTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
        return {
          success: false,
          error: 'Unable to access booking. Please check the ID and try again.',
        };
      }

      return {
        success: true,
        data: {
          id: booking.id,
          packageId: booking.packageId,
          packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
          customerId: booking.customerId,
          customerName: sanitizeForContext(booking.customer?.name || 'Unknown', 50),
          customerEmail: booking.customer?.email ?? null,
          customerPhone: booking.customer?.phone ?? null,
          date: formatDateISO(booking.date),
          totalPrice: booking.totalPrice,
          status: booking.status,
          notes: booking.notes ? sanitizeForContext(booking.notes, 500) : null,
          depositPaidAmount: booking.depositPaidAmount,
          balanceDueDate: booking.balanceDueDate ? formatDateISO(booking.balanceDueDate) : null,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: sanitizeError(error), tenantId, bookingId },
        'Error in get_booking tool'
      );
      return {
        success: false,
        error: `Failed to fetch booking "${bookingId}": ${errorMessage}. Verify the booking ID is correct and belongs to your business.`,
        code: 'GET_BOOKING_ERROR',
      };
    }
  },
};

/**
 * check_availability - Date availability
 *
 * Returns: boolean availability and any conflicts
 */
export const checkAvailabilityTool: AgentTool = {
  trustTier: 'T1', // Read-only
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

      // Check for existing booking and blackout in parallel
      const [existingBooking, blackout] = await Promise.all([
        prisma.booking.findFirst({
          where: {
            tenantId,
            date: date,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
          select: { id: true, status: true },
        }),
        prisma.blackoutDate.findFirst({
          where: {
            tenantId,
            date,
          },
          select: { reason: true },
        }),
      ]);

      const isAvailable = !existingBooking && !blackout;
      const conflict = existingBooking
        ? { type: 'booking', status: existingBooking.status }
        : blackout
          ? {
              type: 'blackout',
              reason: blackout.reason ? sanitizeForContext(blackout.reason, 50) : null,
            }
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: sanitizeError(error), tenantId, date: dateStr },
        'Error in check_availability tool'
      );
      return {
        success: false,
        error: `Failed to check availability for date "${dateStr}": ${errorMessage}. Ensure the date is in YYYY-MM-DD format.`,
        code: 'CHECK_AVAILABILITY_ERROR',
      };
    }
  },
};

/**
 * get_landing_page - Storefront config
 *
 * Returns: pages, sections, content
 */
export const getLandingPageTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
      }

      return {
        success: true,
        data: tenant.landingPageConfig || { sections: {} },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_landing_page tool');
      return {
        success: false,
        error: `Failed to fetch landing page configuration: ${errorMessage}. Try refreshing your session.`,
        code: 'GET_LANDING_PAGE_ERROR',
      };
    }
  },
};

/**
 * get_stripe_status - Payment setup
 *
 * Returns: connected status, requirements, dashboard URL
 */
export const getStripeStatusTool: AgentTool = {
  trustTier: 'T1', // Read-only
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
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_stripe_status tool');
      return {
        success: false,
        error: `Failed to fetch payment setup status: ${errorMessage}. This may be a temporary issue with the payment system.`,
        code: 'GET_STRIPE_STATUS_ERROR',
      };
    }
  },
};

/**
 * get_addons - All add-ons
 *
 * Returns: array of add-ons or single add-on if ID provided
 */
export const getAddonsTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_addons',
  description:
    'Get all add-ons or a single add-on by ID. Add-ons are optional extras that can be added to packages.',
  inputSchema: {
    type: 'object',
    properties: {
      addOnId: {
        type: 'string',
        description: 'Optional add-on ID to get a single add-on',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include inactive add-ons (default: false)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const addOnId = params.addOnId as string | undefined;
    const includeInactive = params.includeInactive as boolean | undefined;

    try {
      if (addOnId) {
        const addOn = await prisma.addOn.findFirst({
          where: { id: addOnId, tenantId },
          include: { segment: { select: { id: true, name: true } } },
        });

        if (!addOn) {
          return {
            success: false,
            error: 'Unable to access add-on. Please check the ID and try again.',
          };
        }

        return {
          success: true,
          data: formatAddOn(addOn),
        };
      }

      const limit = 50;
      const addOns = await prisma.addOn.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { active: true }),
        },
        include: { segment: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        data: addOns.map(formatAddOn),
        meta: {
          returned: addOns.length,
          limit,
          hasMore: addOns.length === limit,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_addons tool');
      return {
        success: false,
        error: `Failed to fetch add-ons: ${errorMessage}. Verify your session is valid and try again.`,
        code: 'GET_ADDONS_ERROR',
      };
    }
  },
};

/**
 * Type for AddOn with optional segment include.
 * Uses Prisma.AddOn type for proper type safety.
 */
type AddOnWithSegment = Prisma.AddOnGetPayload<{
  include: { segment: { select: { id: true; name: true } } };
}>;

/**
 * Helper to format add-on for agent context
 */
function formatAddOn(addOn: AddOnWithSegment) {
  return {
    id: addOn.id,
    slug: addOn.slug,
    name: sanitizeForContext(addOn.name, 100),
    description: sanitizeForContext(addOn.description || '', 500),
    price: addOn.price,
    priceFormatted: formatPrice(addOn.price),
    active: addOn.active,
    segmentId: addOn.segmentId,
    segmentName: addOn.segment ? sanitizeForContext(addOn.segment.name, 50) : null,
    createdAt: addOn.createdAt.toISOString(),
  };
}

/**
 * get_customers - Customer list with booking counts and revenue
 *
 * Returns: customers with booking count and total spent
 * Supports: date range filtering, search, single customer lookup
 */
export const getCustomersTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_customers',
  description:
    'Get customers who have booked with booking counts and total spent. Supports search by email/name and date range filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Get single customer by ID',
      },
      search: {
        type: 'string',
        description: 'Search by email or name',
      },
      startDate: {
        type: 'string',
        description: 'Filter customers with bookings from this date (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        description: 'Filter customers with bookings until this date (YYYY-MM-DD)',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 50)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const customerId = params.customerId as string | undefined;
    const search = params.search as string | undefined;
    const startDate = params.startDate as string | undefined;
    const endDate = params.endDate as string | undefined;
    const limit = Math.min((params.limit as number) || 20, 50);

    try {
      // Single customer lookup with aggregated stats
      if (customerId) {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, tenantId },
        });
        if (!customer) {
          return {
            success: false,
            error: 'Unable to access customer. Please check the ID and try again.',
          };
        }

        // Get booking stats for this customer
        const stats = await prisma.booking.aggregate({
          where: {
            tenantId,
            customerId: customer.id,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
          _count: { _all: true },
          _sum: { totalPrice: true },
        });

        return {
          success: true,
          data: formatCustomerWithStats(customer, stats._count._all, stats._sum.totalPrice ?? 0),
        };
      }

      // Build date filter for bookings (if provided)
      const bookingDateFilter: { date?: { gte?: Date; lte?: Date } } = {};
      if (startDate || endDate) {
        bookingDateFilter.date = {};
        if (startDate) bookingDateFilter.date.gte = new Date(startDate);
        if (endDate) bookingDateFilter.date.lte = new Date(endDate);
      }

      // Build customer search filter using Prisma's proper types
      const customerSearchFilter: Prisma.CustomerWhereInput = { tenantId };

      if (search) {
        customerSearchFilter.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      // If date range is provided, we need to find customers with bookings in that range
      if (startDate || endDate) {
        // Aggregate bookings within date range, grouped by customer
        const bookingAggregates = await prisma.booking.groupBy({
          by: ['customerId'],
          where: {
            tenantId,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
            ...bookingDateFilter,
          },
          _count: { _all: true },
          _sum: { totalPrice: true },
          orderBy: { _sum: { totalPrice: 'desc' } },
          take: limit,
        });

        if (bookingAggregates.length === 0) {
          return {
            success: true,
            data: [],
            meta: {
              returned: 0,
              limit,
              hasMore: false,
            },
          };
        }

        // Get customer details for those who have bookings in the date range
        const customerIds = bookingAggregates.map((b) => b.customerId);
        const customers = await prisma.customer.findMany({
          where: {
            id: { in: customerIds },
            tenantId,
            ...(search ? customerSearchFilter : {}),
          },
        });

        // Build lookup map
        const customerMap = new Map(customers.map((c) => [c.id, c]));

        // Combine customer data with aggregates
        const results = bookingAggregates
          .map((agg) => {
            const customer = customerMap.get(agg.customerId);
            if (!customer) return null;
            return formatCustomerWithStats(customer, agg._count._all, agg._sum.totalPrice ?? 0);
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        return {
          success: true,
          data: results,
          meta: {
            returned: results.length,
            limit,
            hasMore: bookingAggregates.length === limit,
          },
        };
      }

      // No date range - get customers with their all-time stats
      const customers = await prisma.customer.findMany({
        where: customerSearchFilter,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Get booking stats for all customers in one query
      const customerIds = customers.map((c) => c.id);
      const bookingStats = await prisma.booking.groupBy({
        by: ['customerId'],
        where: {
          tenantId,
          customerId: { in: customerIds },
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
        _count: { _all: true },
        _sum: { totalPrice: true },
      });

      // Build stats lookup map
      const statsMap = new Map(
        bookingStats.map((s) => [
          s.customerId,
          { count: s._count._all, total: s._sum.totalPrice ?? 0 },
        ])
      );

      // Combine customer data with stats
      const results = customers.map((customer) => {
        const stats = statsMap.get(customer.id) || { count: 0, total: 0 };
        return formatCustomerWithStats(customer, stats.count, stats.total);
      });

      return {
        success: true,
        data: results,
        meta: {
          returned: results.length,
          limit,
          hasMore: customers.length === limit,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_customers tool');
      return {
        success: false,
        error: `Failed to fetch customers: ${errorMessage}. If searching, try a simpler search term. Ensure dates are in YYYY-MM-DD format.`,
        code: 'GET_CUSTOMERS_ERROR',
      };
    }
  },
};

/**
 * Helper to format customer with stats for agent context
 */
type CustomerBase = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  createdAt: Date;
};

function formatCustomerWithStats(
  customer: CustomerBase,
  bookingCount: number,
  totalSpentCents: number
) {
  return {
    id: customer.id,
    email: customer.email,
    phone: customer.phone,
    name: sanitizeForContext(customer.name, 100),
    bookingCount,
    totalSpentCents,
    totalSpentFormatted: formatPrice(totalSpentCents),
    createdAt: customer.createdAt.toISOString(),
  };
}

/**
 * get_segments - Service segments
 *
 * Returns: segments with package counts
 */
export const getSegmentsTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_segments',
  description: 'Get service segments that organize packages',
  inputSchema: {
    type: 'object',
    properties: {
      segmentId: {
        type: 'string',
        description: 'Get single segment by ID',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include inactive segments',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const segmentId = params.segmentId as string | undefined;
    const includeInactive = (params.includeInactive as boolean) || false;

    try {
      if (segmentId) {
        const segment = await prisma.segment.findFirst({
          where: { id: segmentId, tenantId },
          include: { _count: { select: { packages: true } } },
        });
        if (!segment) {
          return {
            success: false,
            error: 'Unable to access segment. Please check the ID and try again.',
          };
        }
        return { success: true, data: formatSegment(segment) };
      }

      const limit = 25;
      const segments = await prisma.segment.findMany({
        where: { tenantId, ...(includeInactive ? {} : { active: true }) },
        include: { _count: { select: { packages: true } } },
        orderBy: { sortOrder: 'asc' },
        take: limit,
      });

      return {
        success: true,
        data: segments.map(formatSegment),
        meta: {
          returned: segments.length,
          limit,
          hasMore: segments.length === limit,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_segments tool');
      return {
        success: false,
        error: `Failed to fetch service segments: ${errorMessage}. Verify your session is valid and try again.`,
        code: 'GET_SEGMENTS_ERROR',
      };
    }
  },
};

/**
 * Helper to format segment for agent context
 */
type SegmentWithCount = {
  id: string;
  slug: string;
  name: string;
  heroTitle: string;
  heroSubtitle: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  _count: { packages: number };
};

function formatSegment(s: SegmentWithCount) {
  return {
    id: s.id,
    slug: s.slug,
    name: sanitizeForContext(s.name, 100),
    heroTitle: sanitizeForContext(s.heroTitle, 200),
    heroSubtitle: s.heroSubtitle ? sanitizeForContext(s.heroSubtitle, 200) : null,
    description: s.description ? sanitizeForContext(s.description, 500) : null,
    sortOrder: s.sortOrder,
    active: s.active,
    packageCount: s._count.packages,
  };
}

/**
 * Type for Package with addOns include.
 * Uses Prisma.Package type for proper type safety.
 */
type PackageWithAddOns = Prisma.PackageGetPayload<{
  include: { addOns: { include: { addOn: true } } };
}>;

/**
 * Helper to format package for agent context
 */
function formatPackage(pkg: PackageWithAddOns) {
  // Cast photos from JsonValue to string[] (safe, validated at insert)
  const photos = Array.isArray(pkg.photos) ? (pkg.photos as string[]) : [];
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: sanitizeForContext(pkg.name, 100),
    description: sanitizeForContext(pkg.description || '', 500),
    basePrice: pkg.basePrice,
    priceFormatted: formatPrice(pkg.basePrice),
    photos,
    bookingType: pkg.bookingType,
    active: pkg.active,
    segmentId: pkg.segmentId,
    grouping: pkg.grouping,
    addOns:
      pkg.addOns?.map((a) => ({
        id: a.addOnId, // Use addOnId from join table
        name: sanitizeForContext(a.addOn?.name || '', 50),
        price: a.addOn?.price,
      })) || [],
    createdAt: pkg.createdAt.toISOString(),
  };
}

/**
 * All read tools exported as array for registration
 */
/**
 * get_trial_status - Trial and subscription status
 *
 * Returns: trial status, days remaining, subscription status
 */
export const getTrialStatusTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_trial_status',
  description: 'Get trial and subscription status for the business',
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
        select: { trialEndsAt: true, subscriptionStatus: true },
      });

      if (!tenant) {
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
      }

      const now = new Date();
      const trialActive =
        tenant.subscriptionStatus === 'TRIALING' &&
        tenant.trialEndsAt !== null &&
        tenant.trialEndsAt > now;

      return {
        success: true,
        data: {
          trialActive,
          trialEndsAt: tenant.trialEndsAt?.toISOString() || null,
          subscriptionStatus: tenant.subscriptionStatus,
          daysRemaining: trialActive
            ? Math.ceil((tenant.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_trial_status tool');
      return {
        success: false,
        error: `Failed to fetch trial and subscription status: ${errorMessage}. Try refreshing your session.`,
        code: 'GET_TRIAL_STATUS_ERROR',
      };
    }
  },
};

/**
 * get_booking_link - Get storefront booking URLs
 *
 * Returns: storefront URL and optional package-specific booking URL
 */
export const getBookingLinkTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_booking_link',
  description:
    'Get the storefront URL where customers can book. Optionally get a direct link to a specific package.',
  inputSchema: {
    type: 'object',
    properties: {
      packageSlug: {
        type: 'string',
        description: 'Optional package slug to get a direct booking link for a specific package',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageSlug = params.packageSlug as string | undefined;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          slug: true,
        },
      });

      if (!tenant) {
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
      }

      // Determine the base URL
      const baseAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gethandled.ai';
      const storefrontUrl = `${baseAppUrl}/t/${tenant.slug}`;

      const result: {
        storefrontUrl: string;
        packageUrl?: string;
        packageSlug?: string;
      } = {
        storefrontUrl,
      };

      // If package slug provided, verify it exists and add package URL
      if (packageSlug) {
        const pkg = await prisma.package.findFirst({
          where: { tenantId, slug: packageSlug, active: true },
          select: { slug: true, name: true },
        });

        if (!pkg) {
          return {
            success: false,
            error: 'Unable to access package. Please check the slug and try again.',
          };
        }

        result.packageUrl = `${storefrontUrl}/book/${pkg.slug}`;
        result.packageSlug = pkg.slug;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in get_booking_link tool');
      return {
        success: false,
        error: `Failed to get booking link: ${errorMessage}. Try again or verify the package slug if provided.`,
        code: 'GET_BOOKING_LINK_ERROR',
      };
    }
  },
};

/**
 * refresh_context - Refresh session context for long sessions
 *
 * Returns: stripeConnected, packageCount, upcomingBookings, revenueThisMonth
 * Use this when a session has been active for a while and data may be stale.
 */
export const refreshContextTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'refresh_context',
  description:
    'Refresh business context data that may have become stale during a long session. Returns current Stripe status, package count, upcoming bookings, and revenue this month.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Fetch tenant Stripe status
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          slug: true,
          stripeOnboarded: true,
        },
      });

      if (!tenant) {
        return { success: false, error: ErrorMessages.BUSINESS_PROFILE };
      }

      // Calculate date ranges
      const now = new Date();
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch current stats in parallel
      const [packageCount, upcomingBookings, revenueThisMonth] = await Promise.all([
        prisma.package.count({ where: { tenantId } }),
        prisma.booking.count({
          where: {
            tenantId,
            date: { gte: now, lte: next30Days },
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        }),
        prisma.booking.aggregate({
          where: {
            tenantId,
            createdAt: { gte: thisMonthStart },
            status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
          },
          _sum: { totalPrice: true },
        }),
      ]);

      const revenueThisMonthCents = revenueThisMonth._sum?.totalPrice ?? 0;

      return {
        success: true,
        data: {
          refreshedAt: now.toISOString(),
          businessName: sanitizeForContext(tenant.name, 100),
          businessSlug: tenant.slug,
          stripeConnected: tenant.stripeOnboarded,
          packageCount,
          upcomingBookings,
          revenueThisMonth: revenueThisMonthCents,
          revenueThisMonthFormatted: `$${(revenueThisMonthCents / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: sanitizeError(error), tenantId }, 'Error in refresh_context tool');
      return {
        success: false,
        error: `Failed to refresh context: ${errorMessage}. Try again in a few moments.`,
        code: 'REFRESH_CONTEXT_ERROR',
      };
    }
  },
};

/**
 * get_blackout_dates - Blocked dates (user-friendly alias)
 *
 * Returns: array of blackout dates with IDs and reasons
 * This is a more user-friendly tool that matches natural language like
 * "show me my blocked dates" or "what are my blackout dates"
 */
export const getBlackoutDatesTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_blackout_dates',
  description:
    'Get all blackout (blocked) dates. Returns list of dates when you are unavailable for bookings, with IDs and reasons.',
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
      const limit = 100;
      const blackouts = await prisma.blackoutDate.findMany({
        where: {
          tenantId,
          ...buildDateRangeFilter(fromDate, toDate),
        },
        orderBy: { date: 'asc' },
        take: limit,
      });

      // Format blackout dates with all relevant info
      const formattedBlackouts = blackouts.map((b) => ({
        id: b.id,
        date: formatDateISO(b.date),
        reason: b.reason ? sanitizeForContext(b.reason, 100) : null,
      }));

      return {
        success: true,
        data: {
          blackoutDates: formattedBlackouts,
          count: formattedBlackouts.length,
        },
        meta: {
          returned: formattedBlackouts.length,
          limit,
          hasMore: blackouts.length === limit,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'get_blackout_dates',
        tenantId,
        'Failed to fetch blackout dates. Check that any date filters are in YYYY-MM-DD format'
      );
    }
  },
};

/**
 * get_availability_rules - Weekly availability rules
 *
 * Returns: array of availability rules with days, times, and service assignments
 * This enables agents to understand the tenant's working hours configuration.
 */
export const getAvailabilityRulesTool: AgentTool = {
  trustTier: 'T1', // Read-only
  name: 'get_availability_rules',
  description:
    'Get all availability rules that define working hours. Returns day of week, start/end times, and optional service assignments.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string',
        description: 'Filter by service ID (omit for default/all-service rules)',
      },
      dayOfWeek: {
        type: 'number',
        description: 'Filter by day of week (0=Sunday, 6=Saturday)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const serviceId = params.serviceId as string | undefined;
    const dayOfWeek = params.dayOfWeek as number | undefined;

    try {
      const limit = 100;

      // Build where clause with optional filters
      const whereClause: {
        tenantId: string;
        serviceId?: string | null;
        dayOfWeek?: number;
      } = { tenantId };

      if (serviceId !== undefined) {
        whereClause.serviceId = serviceId;
      }
      if (dayOfWeek !== undefined) {
        whereClause.dayOfWeek = dayOfWeek;
      }

      const rules = await prisma.availabilityRule.findMany({
        where: whereClause,
        include: {
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        take: limit,
      });

      // Format rules for agent context
      const formattedRules = rules.map((rule) => ({
        id: rule.id,
        dayOfWeek: rule.dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          rule.dayOfWeek
        ],
        startTime: rule.startTime,
        endTime: rule.endTime,
        serviceId: rule.serviceId,
        serviceName: rule.service ? sanitizeForContext(rule.service.name, 50) : null,
        effectiveFrom: formatDateISO(rule.effectiveFrom),
        effectiveTo: rule.effectiveTo ? formatDateISO(rule.effectiveTo) : null,
      }));

      return {
        success: true,
        data: {
          rules: formattedRules,
          count: formattedRules.length,
        },
        meta: {
          returned: formattedRules.length,
          limit,
          hasMore: rules.length === limit,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'get_availability_rules',
        tenantId,
        'Failed to fetch availability rules. Verify your session is valid and try again'
      );
    }
  },
};

export const readTools: AgentTool[] = [
  getTenantTool,
  getDashboardTool,
  getPackagesTool,
  getAddonsTool,
  getBookingsTool,
  getBookingTool,
  checkAvailabilityTool,
  getBlackoutDatesTool,
  getAvailabilityRulesTool,
  getLandingPageTool,
  getStripeStatusTool,
  getCustomersTool,
  getSegmentsTool,
  getTrialStatusTool,
  getBookingLinkTool,
  refreshContextTool,
];
