/**
 * Customer Chatbot Tools
 *
 * MVP tools for customer-facing booking assistant:
 * - get_services: Browse available packages
 * - check_availability: Check available dates
 * - book_service: Create booking with T3 confirmation
 * - get_business_info: Hours, policies, FAQ
 */

import type { PrismaClient, Prisma } from '../../generated/prisma';
import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from '../tools/types';
import { ProposalService } from '../proposals/proposal.service';
import { logger } from '../../lib/core/logger';

/**
 * Extended context for customer tools
 */
export interface CustomerToolContext extends ToolContext {
  customerId?: string | null;
  proposalService: ProposalService;
}

/**
 * Format money from cents to display string
 */
function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Customer-facing tools - read-heavy, minimal writes
 */
export const CUSTOMER_TOOLS: AgentTool[] = [
  // ============================================================================
  // 1. GET SERVICES - Browse available packages
  // ============================================================================
  {
    name: 'get_services',
    description:
      'Browse available services and packages. Returns active packages with name, description, price, and duration.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional filter by category/segment slug',
        },
      },
    },
    async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
      const { tenantId, prisma } = context;
      const { category } = params as { category?: string };

      try {
        // Build where clause
        const where: Prisma.PackageWhereInput = {
          tenantId,
          active: true,
        };

        // Filter by segment if category provided
        if (category) {
          const segment = await prisma.segment.findFirst({
            where: { tenantId, slug: category, active: true },
          });
          if (segment) {
            where.segmentId = segment.id;
          }
        }

        const packages = await prisma.package.findMany({
          where,
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            basePrice: true,
            bookingType: true,
            segment: {
              select: { name: true, slug: true },
            },
          },
          orderBy: [{ segment: { sortOrder: 'asc' } }, { name: 'asc' }],
        });

        return {
          success: true,
          data: packages.map((pkg) => ({
            id: pkg.id,
            slug: pkg.slug,
            name: pkg.name,
            description: pkg.description,
            price: formatMoney(pkg.basePrice),
            priceInCents: pkg.basePrice,
            bookingType: pkg.bookingType,
            category: pkg.segment?.name || null,
          })),
        };
      } catch (error) {
        logger.error({ error, tenantId }, 'Failed to get services');
        return { success: false, error: 'Failed to load services' };
      }
    },
  },

  // ============================================================================
  // 2. CHECK AVAILABILITY - Get available dates for a service
  // ============================================================================
  {
    name: 'check_availability',
    description:
      'Check available dates for booking a service. Returns a list of available dates within the date range.',
    inputSchema: {
      type: 'object',
      properties: {
        packageId: {
          type: 'string',
          description: 'ID of the package to check availability for',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (defaults to today)',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (defaults to 14 days out)',
        },
      },
      required: ['packageId'],
    },
    async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
      const { tenantId, prisma } = context;
      const {
        packageId,
        startDate: startDateParam,
        endDate: endDateParam,
      } = params as {
        packageId: string;
        startDate?: string;
        endDate?: string;
      };

      try {
        // Verify package exists and belongs to tenant
        const pkg = await prisma.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          return { success: false, error: 'Service not found' };
        }

        // Calculate date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = startDateParam ? new Date(startDateParam) : today;
        const endDate = endDateParam
          ? new Date(endDateParam)
          : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Get booked dates and blackout dates in parallel for better performance
        const [bookedDates, blackoutDates] = await Promise.all([
          prisma.booking.findMany({
            where: {
              tenantId,
              date: { gte: startDate, lte: endDate },
              status: { notIn: ['CANCELED', 'REFUNDED'] },
            },
            select: { date: true },
          }),
          prisma.blackoutDate.findMany({
            where: {
              tenantId,
              date: { gte: startDate, lte: endDate },
            },
            select: { date: true },
          }),
        ]);

        const bookedDateStrings = new Set(
          bookedDates.map((b) => b.date.toISOString().split('T')[0])
        );

        const blackoutDateStrings = new Set(
          blackoutDates.map((b) => b.date.toISOString().split('T')[0])
        );

        // Build available dates list
        const availableDates: string[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];

          if (!bookedDateStrings.has(dateStr) && !blackoutDateStrings.has(dateStr)) {
            availableDates.push(dateStr);
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        return {
          success: true,
          data: {
            packageId,
            packageName: pkg.name,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            availableDates,
            totalAvailable: availableDates.length,
          },
        };
      } catch (error) {
        logger.error({ error, tenantId, packageId }, 'Failed to check availability');
        return { success: false, error: 'Failed to check availability' };
      }
    },
  },

  // ============================================================================
  // 3. BOOK SERVICE - Create booking with T3 confirmation
  // ============================================================================
  {
    name: 'book_service',
    description:
      'Book an appointment. Requires customer name, email, and selected date. Creates a proposal that must be confirmed.',
    inputSchema: {
      type: 'object',
      properties: {
        packageId: {
          type: 'string',
          description: 'ID of the package to book',
        },
        date: {
          type: 'string',
          description: 'Booking date in YYYY-MM-DD format',
        },
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
        customerEmail: {
          type: 'string',
          description: 'Customer email address',
        },
        notes: {
          type: 'string',
          description: 'Optional notes or special requests',
        },
      },
      required: ['packageId', 'date', 'customerName', 'customerEmail'],
    },
    async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
      const customerContext = context as CustomerToolContext;
      const { tenantId, prisma, sessionId } = customerContext;
      const { packageId, date, customerName, customerEmail, notes } = params as {
        packageId: string;
        date: string;
        customerName: string;
        customerEmail: string;
        notes?: string;
      };

      try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
          return { success: false, error: 'Please provide a valid email address' };
        }

        // Verify package exists and is active
        const pkg = await prisma.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          return { success: false, error: 'Service not found or unavailable' };
        }

        // Check availability
        const bookingDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
          return { success: false, error: 'Cannot book dates in the past' };
        }

        // Check for existing booking on this date
        const existingBooking = await prisma.booking.findFirst({
          where: {
            tenantId,
            date: bookingDate,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        });

        if (existingBooking) {
          return {
            success: false,
            error: 'This date is no longer available. Please choose another date.',
          };
        }

        // Check for blackout
        const blackout = await prisma.blackoutDate.findFirst({
          where: { tenantId, date: bookingDate },
        });

        if (blackout) {
          return {
            success: false,
            error: 'This date is not available for booking. Please choose another date.',
          };
        }

        // Create or find customer
        let customer = await prisma.customer.findFirst({
          where: { tenantId, email: customerEmail },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              tenantId,
              email: customerEmail,
              name: customerName,
            },
          });
          logger.info({ tenantId, customerId: customer.id }, 'Customer created via chatbot');
        }

        // Create proposal (T3 - requires explicit confirmation)
        const proposalService = customerContext.proposalService;
        const proposal = await proposalService.createProposal({
          tenantId,
          sessionId,
          toolName: 'book_service',
          operation: 'create_customer_booking',
          trustTier: 'T3', // Customer bookings require explicit confirmation
          payload: {
            packageId,
            customerId: customer.id,
            date,
            notes: notes || null,
            totalPrice: pkg.basePrice,
            customerName,
            customerEmail,
          },
          preview: {
            service: pkg.name,
            date: formatDate(date),
            price: formatMoney(pkg.basePrice),
            customerName,
            customerEmail,
          },
        });

        // Update proposal with customerId for ownership verification
        await prisma.agentProposal.update({
          where: { id: proposal.proposalId },
          data: { customerId: customer.id },
        });

        return {
          success: true,
          proposalId: proposal.proposalId,
          operation: proposal.operation,
          preview: proposal.preview,
          trustTier: proposal.trustTier,
          requiresApproval: true,
          expiresAt: proposal.expiresAt,
          message: `Ready to book ${pkg.name} on ${formatDate(date)} for ${formatMoney(pkg.basePrice)}. Click "Confirm Booking" to proceed.`,
        } as WriteToolProposal;
      } catch (error) {
        logger.error({ error, tenantId, packageId }, 'Failed to create booking proposal');
        return { success: false, error: 'Failed to create booking. Please try again.' };
      }
    },
  },

  // ============================================================================
  // 4. GET BUSINESS INFO - Hours, policies, FAQ
  // ============================================================================
  {
    name: 'get_business_info',
    description:
      'Get business information including name, hours, policies, and FAQ. Use topic parameter to filter.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Specific topic: hours, cancellation, location, contact, faq, or all',
        },
      },
    },
    async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
      const { tenantId, prisma } = context;
      const { topic } = params as { topic?: string };

      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            email: true,
            landingPageConfig: true,
            depositPercent: true,
            balanceDueDays: true,
          },
        });

        if (!tenant) {
          return { success: false, error: 'Business information not found' };
        }

        // Parse landing page config for FAQ and other info
        const config = tenant.landingPageConfig as Record<string, unknown> | null;
        const pages = (config?.pages as Array<{ type: string; sections?: unknown[] }>) || [];

        // Find FAQ section
        const faqPage = pages.find((p) => p.type === 'faq');
        const faqSections = (faqPage?.sections as Array<{ title: string; content: string }>) || [];

        // Build response based on topic
        const info: Record<string, unknown> = {
          businessName: tenant.name,
          contact: tenant.email,
        };

        // Add cancellation policy
        if (!topic || topic === 'all' || topic === 'cancellation') {
          info.cancellationPolicy = 'Please contact us directly for cancellation requests.';
        }

        // Add deposit info
        if (!topic || topic === 'all' || topic === 'payment') {
          if (tenant.depositPercent) {
            info.depositRequired = `${tenant.depositPercent}% deposit required at booking`;
            info.balanceDue = `Balance due ${tenant.balanceDueDays} days before your appointment`;
          } else {
            info.paymentPolicy = 'Full payment required at booking';
          }
        }

        // Add FAQ
        if (!topic || topic === 'all' || topic === 'faq') {
          info.faq = faqSections.map((s) => ({
            question: s.title,
            answer: s.content,
          }));
        }

        return {
          success: true,
          data: info,
        };
      } catch (error) {
        logger.error({ error, tenantId }, 'Failed to get business info');
        return { success: false, error: 'Failed to load business information' };
      }
    },
  },
];

export default CUSTOMER_TOOLS;
