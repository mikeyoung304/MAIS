/**
 * Booking Link Agent Tools
 *
 * MCP-compatible tools for Calendly-style scheduling link management.
 * Enables natural language creation: "Create me a 15-min Zoom link" → shareable URL
 *
 * Architecture:
 * - Tools use discriminated union results for type-safe error handling
 * - Write operations go through proposal system (T2 soft-confirm)
 * - Read operations return data directly (T1)
 *
 * Trust Tiers:
 * - manage_bookable_service: T2 (creates/modifies services)
 * - list_bookable_services: T1 (read-only)
 * - manage_working_hours: T2 (modifies availability)
 * - manage_date_overrides: T2 (modifies availability)
 */

import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from './types';
import { sanitizeForContext } from './types';
import { ProposalService } from '../proposals/proposal.service';
import { handleToolError, formatPrice } from './utils';
import { getTenantInfo } from '../utils/tenant-info';
import {
  ManageBookableServiceInputSchema,
  ManageWorkingHoursInputSchema,
  ManageDateOverridesInputSchema,
  generateServiceSlug,
  buildBookingUrl,
  isValidTimeRange,
  DEFAULT_WORKING_HOURS,
  type BookableService,
  type WorkingHoursEntry,
} from '@macon/contracts';
import { logger } from '../../lib/core/logger';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a proposal for a write operation
 */
async function createProposal(
  context: ToolContext,
  toolName: string,
  operation: string,
  trustTier: 'T1' | 'T2' | 'T3',
  payload: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<WriteToolProposal> {
  const proposalService = new ProposalService(context.prisma);

  const result = await proposalService.createProposal({
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    toolName,
    operation,
    trustTier,
    payload,
    preview,
  });

  return {
    success: true,
    proposalId: result.proposalId,
    operation: result.operation,
    preview: result.preview,
    trustTier: result.trustTier,
    requiresApproval: result.requiresApproval,
    expiresAt: result.expiresAt,
  };
}

// ============================================================================
// Tool 1: manage_bookable_service
// ============================================================================

/**
 * manage_bookable_service - Create, update, or delete bookable services (scheduling links)
 *
 * Trust Tier: T2 (soft confirm) - Creates/modifies real service records
 *
 * Use when tenant asks to:
 * - Create a booking link for calls/meetings
 * - Add a new appointment type
 * - Update scheduling settings
 * - Disable or delete a service
 */
export const manageBookableServiceTool: AgentTool = {
  name: 'manage_bookable_service',
  trustTier: 'T2',
  description: `Create, update, or delete bookable services (scheduling links).

Use when tenant asks to:
- Create a booking link for calls/meetings ("Create me a 15-min Zoom link")
- Add a new appointment type
- Update scheduling settings (duration, price, buffer time)
- Disable or delete a service

Parameters:
- operation: "create" | "update" | "delete"
- name: Display name (e.g., "15-Minute Intro Call")
- durationMinutes: 15, 30, 45, 60, 90, etc.
- priceCents: 0 for free, or price in cents
- bufferMinutes: Rest time between appointments (default 0)
- minNoticeMinutes: How much advance notice (default 120 = 2 hours)
- maxAdvanceDays: How far ahead can book (default 60)

Returns the shareable booking URL on success.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'Operation to perform',
      },
      serviceId: {
        type: 'string',
        description: 'Service ID (required for update/delete)',
      },
      name: {
        type: 'string',
        description: 'Display name (e.g., "15-Minute Intro Call")',
      },
      durationMinutes: {
        type: 'number',
        description: 'Service duration in minutes (15, 30, 45, 60, etc.)',
      },
      priceCents: {
        type: 'number',
        description: 'Price in cents (0 for free)',
      },
      description: {
        type: 'string',
        description: 'Service description',
      },
      bufferMinutes: {
        type: 'number',
        description: 'Buffer time after each appointment',
      },
      minNoticeMinutes: {
        type: 'number',
        description: 'Minimum advance notice required',
      },
      maxAdvanceDays: {
        type: 'number',
        description: 'How far in advance appointments can be booked',
      },
      active: {
        type: 'boolean',
        description: 'Whether the service is active (for update)',
      },
    },
    required: ['operation'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Validate input using Zod schema
      const parseResult = ManageBookableServiceInputSchema.safeParse(params);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => i.message).join(', ');
        return {
          success: false,
          error: `Invalid input: ${issues}`,
        };
      }

      const input = parseResult.data;
      const tenantInfo = await getTenantInfo(prisma, tenantId);

      if (!tenantInfo) {
        return {
          success: false,
          error: 'Unable to access tenant information. Please try again.',
        };
      }

      // Handle based on operation
      if (input.operation === 'create') {
        const slug = generateServiceSlug(input.name);

        // Check if service with this slug already exists
        const existingService = await prisma.service.findFirst({
          where: { tenantId, slug },
        });

        if (existingService) {
          return {
            success: false,
            error: 'SERVICE_EXISTS',
            code: 'SERVICE_EXISTS',
          } as AgentToolResult;
        }

        const bookingUrl = buildBookingUrl(tenantInfo.slug, slug, tenantInfo.customDomain);

        const operation = `Create scheduling link "${sanitizeForContext(input.name, 50)}"`;
        const payload = {
          name: input.name,
          slug,
          description: input.description,
          durationMinutes: input.durationMinutes,
          priceCents: input.priceCents ?? 0,
          bufferMinutes: input.bufferMinutes ?? 0,
          minNoticeMinutes: input.minNoticeMinutes ?? 120,
          maxAdvanceDays: input.maxAdvanceDays ?? 60,
        };
        const preview = {
          name: sanitizeForContext(input.name, 50),
          duration: `${input.durationMinutes} minutes`,
          price: input.priceCents ? formatPrice(input.priceCents) : 'Free',
          bookingUrl,
        };

        return createProposal(context, 'manage_bookable_service', operation, 'T2', payload, preview);
      } else if (input.operation === 'update') {
        // Verify service exists and belongs to tenant
        const service = await prisma.service.findFirst({
          where: { id: input.serviceId, tenantId },
        });

        if (!service) {
          return {
            success: false,
            error: 'SERVICE_NOT_FOUND',
            code: 'SERVICE_NOT_FOUND',
          } as AgentToolResult;
        }

        // Build update payload
        const updates: Record<string, unknown> = {};
        const previewUpdates: string[] = [];

        if (input.name !== undefined) {
          updates.name = input.name;
          previewUpdates.push(`name: "${input.name}"`);
        }
        if (input.durationMinutes !== undefined) {
          updates.durationMinutes = input.durationMinutes;
          previewUpdates.push(`duration: ${input.durationMinutes} min`);
        }
        if (input.priceCents !== undefined) {
          updates.priceCents = input.priceCents;
          previewUpdates.push(`price: ${formatPrice(input.priceCents)}`);
        }
        if (input.description !== undefined) {
          updates.description = input.description;
          previewUpdates.push('description updated');
        }
        if (input.bufferMinutes !== undefined) {
          updates.bufferMinutes = input.bufferMinutes;
          previewUpdates.push(`buffer: ${input.bufferMinutes} min`);
        }
        if (input.minNoticeMinutes !== undefined) {
          updates.minNoticeMinutes = input.minNoticeMinutes;
          previewUpdates.push(`notice: ${input.minNoticeMinutes} min`);
        }
        if (input.maxAdvanceDays !== undefined) {
          updates.maxAdvanceDays = input.maxAdvanceDays;
          previewUpdates.push(`advance: ${input.maxAdvanceDays} days`);
        }
        if (input.active !== undefined) {
          updates.active = input.active;
          previewUpdates.push(`active: ${input.active}`);
        }

        if (Object.keys(updates).length === 0) {
          return {
            success: false,
            error: 'No updates specified',
          };
        }

        const operation = `Update "${sanitizeForContext(service.name, 30)}"`;
        const payload = {
          serviceId: input.serviceId,
          updates,
        };
        const preview = {
          serviceName: service.name,
          changes: previewUpdates,
        };

        return createProposal(context, 'manage_bookable_service', operation, 'T2', payload, preview);
      } else {
        // Delete operation
        const service = await prisma.service.findFirst({
          where: { id: input.serviceId, tenantId },
          include: {
            _count: {
              select: {
                bookings: {
                  where: {
                    date: { gte: new Date() },
                    status: { in: ['PENDING', 'CONFIRMED'] },
                  },
                },
              },
            },
          },
        });

        if (!service) {
          return {
            success: false,
            error: 'SERVICE_NOT_FOUND',
            code: 'SERVICE_NOT_FOUND',
          } as AgentToolResult;
        }

        // Warn if there are upcoming bookings
        if (service._count.bookings > 0) {
          return {
            success: false,
            error: 'HAS_UPCOMING_BOOKINGS',
            code: 'HAS_UPCOMING_BOOKINGS',
          } as AgentToolResult;
        }

        const operation = `Delete "${sanitizeForContext(service.name, 30)}"`;
        const payload = {
          serviceId: input.serviceId,
        };
        const preview = {
          serviceName: service.name,
          warning: 'This scheduling link will be permanently deleted.',
        };

        return createProposal(context, 'manage_bookable_service', operation, 'T2', payload, preview);
      }
    } catch (error) {
      return handleToolError(
        error,
        'manage_bookable_service',
        tenantId,
        'Failed to manage booking service'
      );
    }
  },
};

// ============================================================================
// Tool 2: list_bookable_services
// ============================================================================

/**
 * list_bookable_services - List all scheduling links for the tenant
 *
 * Trust Tier: T1 (read-only)
 */
export const listBookableServicesTool: AgentTool = {
  name: 'list_bookable_services',
  trustTier: 'T1',
  description: `List all booking links for this tenant with their shareable URLs.

Returns:
- All active and inactive services
- Shareable booking URL for each
- Duration, price, and buffer settings`,
  inputSchema: {
    type: 'object',
    properties: {
      includeInactive: {
        type: 'boolean',
        description: 'Include inactive services (default: false)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const includeInactive = params.includeInactive === true;

    try {
      const tenantInfo = await getTenantInfo(prisma, tenantId, { includeTimezone: true });
      if (!tenantInfo) {
        return {
          success: false,
          error: 'Unable to access tenant information.',
        };
      }

      const services = await prisma.service.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { active: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      const formattedServices: BookableService[] = services.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
        bufferMinutes: s.bufferMinutes,
        minNoticeMinutes: 120, // Default, should be stored in DB
        maxAdvanceDays: 60, // Default, should be stored in DB
        maxPerDay: null,
        active: s.active,
        bookingUrl: buildBookingUrl(tenantInfo.slug, s.slug, tenantInfo.customDomain),
        createdAt: s.createdAt.toISOString(),
      }));

      logger.info(
        { tenantId, serviceCount: formattedServices.length },
        'Listed bookable services via agent'
      );

      return {
        success: true,
        data: {
          services: formattedServices,
          tenantTimezone: tenantInfo.timezone,
        },
      };
    } catch (error) {
      return handleToolError(
        error,
        'list_bookable_services',
        tenantId,
        'Failed to list booking services'
      );
    }
  },
};

// ============================================================================
// Tool 3: manage_working_hours
// ============================================================================

/**
 * manage_working_hours - Set business hours for when appointments can be booked
 *
 * Trust Tier: T2 (soft confirm) - Modifies availability rules
 */
export const manageWorkingHoursTool: AgentTool = {
  name: 'manage_working_hours',
  trustTier: 'T2',
  description: `Set business hours for when appointments can be booked.

Days: 0=Sunday, 1=Monday, ..., 6=Saturday
Times: 24-hour format ("09:00", "17:00")

Example working hours:
[
  { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "isActive": true },
  { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "isActive": true },
  ...
]

Set isActive: false to mark a day as unavailable.`,
  inputSchema: {
    type: 'object',
    properties: {
      workingHours: {
        type: 'array',
        description: 'Array of working hours entries by day of week',
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., "America/New_York")',
      },
    },
    required: ['workingHours'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    try {
      // Validate input
      const parseResult = ManageWorkingHoursInputSchema.safeParse(params);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => i.message).join(', ');
        return {
          success: false,
          error: `Invalid input: ${issues}`,
        };
      }

      const { workingHours, timezone } = parseResult.data;

      // Validate time ranges
      for (const entry of workingHours) {
        if (entry.isActive && !isValidTimeRange(entry.startTime, entry.endTime)) {
          return {
            success: false,
            error: `Invalid time range for day ${entry.dayOfWeek}: start must be before end`,
          };
        }
      }

      // Build preview
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const activeDays = workingHours
        .filter((h) => h.isActive)
        .map((h) => `${dayNames[h.dayOfWeek]}: ${h.startTime}-${h.endTime}`);

      const operation = `Update working hours (${activeDays.length} active days)`;
      const payload = { workingHours, timezone };
      const preview = {
        activeDays,
        timezone: timezone || 'unchanged',
      };

      return createProposal(context, 'manage_working_hours', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'manage_working_hours',
        tenantId,
        'Failed to update working hours'
      );
    }
  },
};

// ============================================================================
// Tool 4: manage_date_overrides
// ============================================================================

/**
 * manage_date_overrides - Block specific dates or set special hours
 *
 * Trust Tier: T2 (soft confirm) - Modifies availability
 */
export const manageDateOverridesTool: AgentTool = {
  name: 'manage_date_overrides',
  trustTier: 'T2',
  description: `Block specific dates or set special hours (vacation, holidays, special events).

Operations:
- "add": Block a date or set special hours
- "remove": Remove an override for a specific date
- "clear_range": Clear all overrides in a date range

For blocking (vacation, holidays):
{ "operation": "add", "date": "2025-01-15", "available": false, "reason": "Holiday" }

For special hours:
{ "operation": "add", "date": "2025-01-15", "available": true, "startTime": "10:00", "endTime": "14:00" }`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'remove', 'clear_range'],
        description: 'Operation to perform',
      },
      date: {
        type: 'string',
        description: 'Date in YYYY-MM-DD format',
      },
      available: {
        type: 'boolean',
        description: 'Whether the date should be available (false = blocked)',
      },
      startTime: {
        type: 'string',
        description: 'Special start time (HH:MM format)',
      },
      endTime: {
        type: 'string',
        description: 'Special end time (HH:MM format)',
      },
      reason: {
        type: 'string',
        description: 'Reason for the override (e.g., "Vacation", "Holiday")',
      },
      startDate: {
        type: 'string',
        description: 'Start date for clear_range (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        description: 'End date for clear_range (YYYY-MM-DD)',
      },
    },
    required: ['operation'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;

    try {
      // Validate input
      const parseResult = ManageDateOverridesInputSchema.safeParse(params);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => i.message).join(', ');
        return {
          success: false,
          error: `Invalid input: ${issues}`,
        };
      }

      const input = parseResult.data;

      if (input.operation === 'add') {
        // Validate special hours if provided
        if (input.available && input.startTime && input.endTime) {
          if (!isValidTimeRange(input.startTime, input.endTime)) {
            return {
              success: false,
              error: 'Invalid time range: start must be before end',
            };
          }
        }

        const operation = input.available
          ? `Set special hours for ${input.date}`
          : `Block ${input.date}${input.reason ? ` (${input.reason})` : ''}`;

        const payload = {
          date: input.date,
          available: input.available,
          startTime: input.startTime,
          endTime: input.endTime,
          reason: input.reason,
        };

        const preview = input.available
          ? { date: input.date, hours: `${input.startTime}-${input.endTime}` }
          : { date: input.date, status: 'Blocked', reason: input.reason };

        return createProposal(context, 'manage_date_overrides', operation, 'T2', payload, preview);
      } else if (input.operation === 'remove') {
        const operation = `Remove override for ${input.date}`;
        const payload = { date: input.date };
        const preview = { date: input.date, action: 'Remove override' };

        return createProposal(context, 'manage_date_overrides', operation, 'T2', payload, preview);
      } else {
        // clear_range
        const operation = `Clear overrides from ${input.startDate} to ${input.endDate}`;
        const payload = { startDate: input.startDate, endDate: input.endDate };
        const preview = {
          range: `${input.startDate} to ${input.endDate}`,
          action: 'Clear all date overrides in range',
        };

        return createProposal(context, 'manage_date_overrides', operation, 'T2', payload, preview);
      }
    } catch (error) {
      return handleToolError(
        error,
        'manage_date_overrides',
        tenantId,
        'Failed to manage date overrides'
      );
    }
  },
};

// ============================================================================
// Export All Booking Link Tools
// ============================================================================

export const bookingLinkTools: AgentTool[] = [
  manageBookableServiceTool,
  listBookableServicesTool,
  manageWorkingHoursTool,
  manageDateOverridesTool,
];
