/**
 * Customer Chatbot Tools
 *
 * MVP tools for customer-facing booking assistant:
 * - get_services: Browse available packages
 * - browse_service_categories: List service categories (segments)
 * - check_availability: Check available dates
 * - book_service: Create booking with T3 confirmation
 * - confirm_proposal: Confirm pending T3 proposals via conversation
 * - get_business_info: Hours, policies, FAQ
 */

import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from '../tools/types';
import type { ProposalService } from '../proposals/proposal.service';
import { getCustomerProposalExecutor } from './executor-registry';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { ErrorMessages } from '../errors';
import { formatPrice, formatDateDisplay } from '../tools/utils';

// ============================================================================
// Tool Parameter Schemas (TS-5: Typed parameter validators)
// ============================================================================

/** get_services parameter schema */
const GetServicesParamsSchema = z.object({
  category: z.string().optional(),
});

/** check_availability parameter schema */
const CheckAvailabilityParamsSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)')
    .optional(),
});

/** book_service parameter schema */
const BookServiceParamsSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Please provide a valid email address'),
  notes: z.string().optional(),
});

/** confirm_proposal parameter schema */
const ConfirmProposalParamsSchema = z.object({
  proposalId: z.string().min(1, 'Proposal ID is required'),
});

/** get_business_info parameter schema */
const GetBusinessInfoParamsSchema = z.object({
  topic: z
    .enum(['hours', 'cancellation', 'location', 'contact', 'faq', 'payment', 'all'])
    .optional(),
});

/**
 * Extended context for customer tools
 */
export interface CustomerToolContext extends ToolContext {
  customerId?: string | null;
  proposalService: ProposalService;
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
    trustTier: 'T1', // Read-only
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

      // Validate parameters
      const parseResult = GetServicesParamsSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid parameters',
        };
      }
      const { category } = parseResult.data;

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
            price: formatPrice(pkg.basePrice),
            priceInCents: pkg.basePrice,
            bookingType: pkg.bookingType,
            category: pkg.segment?.name || null,
          })),
        };
      } catch (error) {
        logger.error({ error: sanitizeError(error), tenantId }, 'Failed to get services');
        return { success: false, error: ErrorMessages.LOAD_SERVICES };
      }
    },
  },

  // ============================================================================
  // 2. BROWSE SERVICE CATEGORIES - List available segments
  // ============================================================================
  {
    name: 'browse_service_categories',
    trustTier: 'T1', // Read-only, no confirmation needed
    description:
      'Browse available service categories. Returns list of service types with names, descriptions, and package counts. Use when customer asks about service types or categories.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [] as string[],
    },
    async execute(context: ToolContext): Promise<AgentToolResult> {
      const { tenantId, prisma } = context;

      try {
        const segments = await prisma.segment.findMany({
          where: { tenantId, active: true },
          select: {
            id: true,
            slug: true,
            name: true,
            heroTitle: true,
            heroSubtitle: true,
            heroImage: true,
            description: true,
            _count: { select: { packages: { where: { active: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        });

        return {
          success: true,
          data: segments.map((s) => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            title: s.heroTitle,
            subtitle: s.heroSubtitle,
            image: s.heroImage,
            description: s.description,
            packageCount: s._count.packages,
          })),
        };
      } catch (error) {
        logger.error(
          { error: sanitizeError(error), tenantId },
          'Failed to browse service categories'
        );
        return { success: false, error: 'Unable to load service categories. Please try again.' };
      }
    },
  },

  // ============================================================================
  // 3. CHECK AVAILABILITY - Get available dates for a service
  // ============================================================================
  {
    name: 'check_availability',
    trustTier: 'T1', // Read-only
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

      // Validate parameters
      const parseResult = CheckAvailabilityParamsSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid parameters',
        };
      }
      const { packageId, startDate: startDateParam, endDate: endDateParam } = parseResult.data;

      try {
        // Verify package exists and belongs to tenant
        const pkg = await prisma.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          return { success: false, error: ErrorMessages.SERVICE_NOT_FOUND };
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
        logger.error(
          { error: sanitizeError(error), tenantId, packageId },
          'Failed to check availability'
        );
        return { success: false, error: ErrorMessages.CHECK_AVAILABILITY };
      }
    },
  },

  // ============================================================================
  // 4. BOOK SERVICE - Create booking with T3 confirmation
  // ============================================================================
  {
    name: 'book_service',
    trustTier: 'T3', // Booking requires explicit confirmation
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

      // Validate parameters (includes email format validation)
      const parseResult = BookServiceParamsSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid parameters',
        };
      }
      const { packageId, date, customerName, customerEmail, notes } = parseResult.data;

      try {
        // Verify package exists and is active
        const pkg = await prisma.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          return { success: false, error: ErrorMessages.SERVICE_UNAVAILABLE };
        }

        // Check availability
        const bookingDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
          return {
            success: false,
            error: 'Unable to book a past date. Please choose an upcoming date.',
          };
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
        // customerId passed upfront to prevent orphaned proposals if crash occurs
        const proposalService = customerContext.proposalService;
        const proposal = await proposalService.createProposal({
          tenantId,
          sessionId,
          customerId: customer.id, // For ownership verification
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
            date: formatDateDisplay(date),
            price: formatPrice(pkg.basePrice),
            customerName,
            customerEmail,
          },
        });

        return {
          success: true,
          proposalId: proposal.proposalId,
          operation: proposal.operation,
          preview: proposal.preview,
          trustTier: proposal.trustTier,
          requiresApproval: true,
          expiresAt: proposal.expiresAt,
          message: `Ready to book ${pkg.name} on ${formatDateDisplay(date)} for ${formatPrice(pkg.basePrice)}. Say "yes, confirm" or "go ahead" to complete your booking.`,
        } as WriteToolProposal;
      } catch (error) {
        logger.error(
          { error: sanitizeError(error), tenantId, packageId },
          'Failed to create booking proposal'
        );
        return { success: false, error: 'Failed to create booking. Please try again.' };
      }
    },
  },

  // ============================================================================
  // 5. CONFIRM PROPOSAL - Confirm pending T3 proposals via conversation
  // ============================================================================
  {
    name: 'confirm_proposal',
    trustTier: 'T1', // The confirmation step itself is safe - risk was in creation
    description:
      'Confirm a pending booking proposal after the customer explicitly approves. Use when customer says "yes", "confirm", "go ahead", etc.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: {
          type: 'string',
          description: 'ID of the proposal to confirm',
        },
      },
      required: ['proposalId'],
    },
    async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
      const customerContext = context as CustomerToolContext;
      const { tenantId, prisma, sessionId } = customerContext;

      // Validate parameters
      const parseResult = ConfirmProposalParamsSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid parameters',
        };
      }
      const { proposalId } = parseResult.data;

      try {
        // Atomic proposal confirmation with race condition prevention
        // Uses updateMany with status check in WHERE clause for compare-and-swap semantics
        const now = new Date();
        const result = await prisma.agentProposal.updateMany({
          where: {
            id: proposalId,
            tenantId, // CRITICAL: Tenant isolation
            sessionId, // Must belong to this session
            status: 'PENDING', // CRITICAL: Only update if still pending (prevents race condition)
            expiresAt: { gt: now }, // Must not be expired
          },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now,
          },
        });

        // If update failed, proposal was already processed, expired, or doesn't exist
        if (result.count === 0) {
          // Fetch proposal to provide helpful error message
          const proposal = await prisma.agentProposal.findFirst({
            where: { id: proposalId, tenantId, sessionId },
          });

          if (!proposal) {
            return {
              success: false,
              error: 'Booking proposal not found. It may have expired or already been processed.',
            };
          }

          // Proposal exists but wasn't updated - check why
          if (proposal.status !== 'PENDING') {
            const statusMessages: Record<string, string> = {
              CONFIRMED: 'This booking is already being processed.',
              EXECUTED: 'This booking has already been completed.',
              REJECTED: 'This booking was cancelled.',
              EXPIRED: 'This booking proposal has expired. Please start a new booking.',
              FAILED: 'This booking encountered an error. Please try again.',
            };
            return {
              success: false,
              error: statusMessages[proposal.status] || 'This booking has already been processed.',
            };
          }

          // Check expiration
          if (now > proposal.expiresAt) {
            // Mark as expired (this may also race, but it's idempotent)
            await prisma.agentProposal.update({
              where: { id: proposalId },
              data: { status: 'EXPIRED' },
            });
            return {
              success: false,
              error: 'This booking proposal has expired. Please start a new booking.',
            };
          }

          // Shouldn't reach here, but handle gracefully
          return {
            success: false,
            error: 'Unable to confirm booking. Please try again.',
          };
        }

        // Success - proposal was atomically confirmed
        logger.info(
          { tenantId, proposalId, sessionId },
          'Customer proposal confirmed via conversation (atomic update)'
        );

        // Fetch the confirmed proposal to execute it
        const proposal = await prisma.agentProposal.findFirst({
          where: { id: proposalId, tenantId, sessionId },
        });

        if (!proposal) {
          // Race condition: proposal was deleted between update and fetch
          return {
            success: false,
            error: 'Booking proposal not found. Please try again.',
          };
        }

        // Execute the proposal immediately
        const executor = getCustomerProposalExecutor(proposal.operation);
        if (!executor) {
          // Mark as failed if no executor found
          await prisma.agentProposal.update({
            where: { id: proposalId },
            data: { status: 'FAILED', error: 'No executor registered for this operation' },
          });
          logger.error(
            { tenantId, proposalId, operation: proposal.operation },
            'No executor found for customer proposal'
          );
          return {
            success: false,
            error: 'Unable to complete booking. Please try again or contact support.',
          };
        }

        // Execute with customer ID from proposal
        const customerId = proposal.customerId;
        if (!customerId) {
          await prisma.agentProposal.update({
            where: { id: proposalId },
            data: { status: 'FAILED', error: 'Missing customer ID on proposal' },
          });
          return {
            success: false,
            error: 'Unable to complete booking. Please try again.',
          };
        }

        const payload = (proposal.payload as Record<string, unknown>) || {};
        const executionResult = await executor(tenantId, customerId, payload);

        // Mark as executed
        await prisma.agentProposal.update({
          where: { id: proposalId },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            result: executionResult as Prisma.JsonObject,
          },
        });

        logger.info(
          { tenantId, proposalId, customerId, bookingId: executionResult.bookingId },
          'Customer booking executed successfully'
        );

        // Return success with booking details
        return {
          success: true,
          data: {
            action: 'booking_confirmed',
            bookingId: executionResult.bookingId,
            confirmationCode: executionResult.confirmationCode,
            packageName: executionResult.packageName,
            date: executionResult.formattedDate,
            price: executionResult.formattedPrice,
            checkoutUrl: executionResult.checkoutUrl,
            message: executionResult.message || 'Your booking has been confirmed!',
          },
        };
      } catch (error) {
        logger.error(
          { error: sanitizeError(error), tenantId, proposalId },
          'Failed to confirm customer proposal'
        );
        return {
          success: false,
          error: 'Failed to complete your booking. Please try again.',
        };
      }
    },
  },

  // ============================================================================
  // 6. GET BUSINESS INFO - Hours, policies, FAQ
  // ============================================================================
  {
    name: 'get_business_info',
    trustTier: 'T1', // Read-only
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

      // Validate parameters
      const parseResult = GetBusinessInfoParamsSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid parameters',
        };
      }
      const { topic } = parseResult.data;

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
          return { success: false, error: ErrorMessages.BUSINESS_INFO };
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
        logger.error({ error: sanitizeError(error), tenantId }, 'Failed to get business info');
        return { success: false, error: ErrorMessages.BUSINESS_INFO };
      }
    },
  },
];

export default CUSTOMER_TOOLS;
