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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_tenant tool');
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
      logger.error({ error, tenantId }, 'Error in get_dashboard tool');
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
        include: { addOns: { include: { addOn: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: packages.map(formatPackage),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_packages tool');
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
                date: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(toDate) } : {}),
                },
              }
            : {}),
        },
        include: { package: true, customer: true },
        orderBy: { date: 'asc' },
        take: Math.min(limit, 50),
      });

      return {
        success: true,
        data: bookings.map((b) => ({
          id: b.id,
          packageName: sanitizeForContext(b.package?.name || 'Unknown', 50),
          customerName: sanitizeForContext(b.customer?.name || 'Unknown', 50),
          customerEmail: b.customer?.email ?? null,
          date: b.date.toISOString().split('T')[0],
          totalPrice: b.totalPrice,
          status: b.status,
          notes: b.notes ? sanitizeForContext(b.notes, 500) : null,
          createdAt: b.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_bookings tool');
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
          packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
          customerId: booking.customerId,
          customerName: sanitizeForContext(booking.customer?.name || 'Unknown', 50),
          customerEmail: booking.customer?.email ?? null,
          customerPhone: booking.customer?.phone ?? null,
          date: booking.date.toISOString().split('T')[0],
          totalPrice: booking.totalPrice,
          status: booking.status,
          notes: booking.notes ? sanitizeForContext(booking.notes, 500) : null,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId, bookingId }, 'Error in get_booking tool');
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
          date: date,
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
      logger.error({ error, tenantId, date: dateStr }, 'Error in check_availability tool');
      return {
        success: false,
        error: `Failed to check availability for date "${dateStr}": ${errorMessage}. Ensure the date is in YYYY-MM-DD format.`,
        code: 'CHECK_AVAILABILITY_ERROR',
      };
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_blackouts tool');
      return {
        success: false,
        error: `Failed to fetch blackout dates: ${errorMessage}. Check that any date filters are in YYYY-MM-DD format.`,
        code: 'GET_BLACKOUTS_ERROR',
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_landing_page tool');
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_stripe_status tool');
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
          return { success: false, error: 'Add-on not found' };
        }

        return {
          success: true,
          data: formatAddOn(addOn),
        };
      }

      const addOns = await prisma.addOn.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { active: true }),
        },
        include: { segment: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: addOns.map(formatAddOn),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_addons tool');
      return {
        success: false,
        error: `Failed to fetch add-ons: ${errorMessage}. Verify your session is valid and try again.`,
        code: 'GET_ADDONS_ERROR',
      };
    }
  },
};

/**
 * Helper to format add-on for agent context
 */
function formatAddOn(addOn: any) {
  return {
    id: addOn.id,
    slug: addOn.slug,
    name: sanitizeForContext(addOn.name, 100),
    description: sanitizeForContext(addOn.description || '', 500),
    price: addOn.price,
    priceFormatted: `$${(addOn.price / 100).toFixed(2)}`,
    active: addOn.active,
    segmentId: addOn.segmentId,
    segmentName: addOn.segment ? sanitizeForContext(addOn.segment.name, 50) : null,
    createdAt: addOn.createdAt.toISOString(),
  };
}

/**
 * get_customers - Customer list with booking counts
 *
 * Returns: customers with search and booking count
 */
export const getCustomersTool: AgentTool = {
  name: 'get_customers',
  description: 'Get customers with booking counts. Supports search by email/name.',
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
    const limit = Math.min((params.limit as number) || 20, 50);

    try {
      // Single customer lookup
      if (customerId) {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, tenantId },
          include: { _count: { select: { bookings: true } } },
        });
        if (!customer) {
          return { success: false, error: 'Customer not found' };
        }
        return { success: true, data: formatCustomer(customer) };
      }

      // Search or list
      const where: {
        tenantId: string;
        OR?: {
          email?: { contains: string; mode: 'insensitive' };
          name?: { contains: string; mode: 'insensitive' };
        }[];
      } = {
        tenantId,
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where: where as any,
        include: { _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return { success: true, data: customers.map(formatCustomer) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_customers tool');
      return {
        success: false,
        error: `Failed to fetch customers: ${errorMessage}. If searching, try a simpler search term.`,
        code: 'GET_CUSTOMERS_ERROR',
      };
    }
  },
};

/**
 * Helper to format customer for agent context
 */
type CustomerWithCount = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  createdAt: Date;
  _count: { bookings: number };
};

function formatCustomer(c: CustomerWithCount) {
  return {
    id: c.id,
    email: c.email,
    phone: c.phone,
    name: sanitizeForContext(c.name, 100),
    bookingCount: c._count.bookings,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * get_segments - Service segments
 *
 * Returns: segments with package counts
 */
export const getSegmentsTool: AgentTool = {
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
          return { success: false, error: 'Segment not found' };
        }
        return { success: true, data: formatSegment(segment) };
      }

      const segments = await prisma.segment.findMany({
        where: { tenantId, ...(includeInactive ? {} : { active: true }) },
        include: { _count: { select: { packages: true } } },
        orderBy: { sortOrder: 'asc' },
      });

      return { success: true, data: segments.map(formatSegment) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, tenantId }, 'Error in get_segments tool');
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
 * Helper to format package for agent context
 */
function formatPackage(pkg: any) {
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: sanitizeForContext(pkg.name, 100),
    description: sanitizeForContext(pkg.description || '', 500),
    basePrice: pkg.basePrice,
    priceFormatted: `$${(pkg.basePrice / 100).toFixed(2)}`,
    photos: pkg.photos || [],
    bookingType: pkg.bookingType,
    active: pkg.active,
    segmentId: pkg.segmentId,
    grouping: pkg.grouping,
    addOns:
      pkg.addOns?.map((a: any) => ({
        id: a.id,
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
        return { success: false, error: 'Tenant not found' };
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
      logger.error({ error, tenantId }, 'Error in get_trial_status tool');
      return {
        success: false,
        error: `Failed to fetch trial and subscription status: ${errorMessage}. Try refreshing your session.`,
        code: 'GET_TRIAL_STATUS_ERROR',
      };
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
  getBlackoutsTool,
  getLandingPageTool,
  getStripeStatusTool,
  getCustomersTool,
  getSegmentsTool,
  getTrialStatusTool,
];
