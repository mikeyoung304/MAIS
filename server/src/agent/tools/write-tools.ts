/**
 * Agent Write Tools
 *
 * Write tools for the MAIS Business Growth Agent.
 * All write operations use server-side proposal mechanism.
 *
 * Trust Tiers:
 * - T1: Auto-confirmed (blackouts, branding, visibility, uploads)
 * - T2: Soft confirm (package changes, landing page, pricing)
 * - T3: Hard confirm (cancellations, refunds, deletes)
 *
 * Security:
 * - All tools use tenantId from JWT context
 * - Server-side proposals prevent prompt injection bypass
 */

import type { AgentTool, ToolContext, AgentToolResult, WriteToolProposal } from './types';
import { sanitizeForContext } from './types';
import { ProposalService } from '../proposals/proposal.service';
import { logger } from '../../lib/core/logger';

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

/**
 * upsert_package - Create or update package
 *
 * Trust Tier: T2 (soft confirm)
 */
export const upsertPackageTool: AgentTool = {
  name: 'upsert_package',
  description: 'Create a new package or update an existing one. Includes title, description, pricing, and photos.',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package ID to update (omit for new package)',
      },
      slug: {
        type: 'string',
        description: 'URL-safe identifier (e.g., "wedding-premium")',
      },
      title: {
        type: 'string',
        description: 'Package display name',
      },
      description: {
        type: 'string',
        description: 'Package description (supports basic formatting)',
      },
      priceCents: {
        type: 'number',
        description: 'Price in cents (e.g., 299900 for $2,999.00)',
      },
      photoUrl: {
        type: 'string',
        description: 'Main photo URL',
      },
      bookingType: {
        type: 'string',
        description: 'Booking type',
        enum: ['DATE', 'TIMESLOT'],
      },
      active: {
        type: 'boolean',
        description: 'Whether package is visible to customers',
      },
    },
    required: ['title', 'priceCents'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageId = params.packageId as string | undefined;

    try {
      // Check if updating existing package
      const existing = packageId
        ? await prisma.package.findFirst({ where: { id: packageId, tenantId } })
        : null;

      const isUpdate = !!existing;
      const operation = isUpdate
        ? `Update package "${sanitizeForContext(existing!.name, 50)}"`
        : `Create new package "${sanitizeForContext(params.title as string, 50)}"`;

      // Build payload - map from input params to Prisma field names
      const payload: Record<string, unknown> = {
        packageId,
        slug: params.slug,
        name: params.title, // Map title -> name (Prisma field)
        description: params.description,
        basePrice: params.priceCents, // Map priceCents -> basePrice (Prisma field)
        photoUrl: params.photoUrl,
        bookingType: params.bookingType || 'DATE',
        active: params.active ?? true,
      };

      // Build preview
      const preview: Record<string, unknown> = {
        action: isUpdate ? 'update' : 'create',
        packageName: params.title,
        price: `$${((params.priceCents as number) / 100).toFixed(2)}`,
        ...(isUpdate ? { previousPrice: `$${(existing!.basePrice / 100).toFixed(2)}` } : {}),
      };

      return createProposal(context, 'upsert_package', operation, 'T2', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in upsert_package tool');
      return { success: false, error: 'Failed to create package proposal' };
    }
  },
};

/**
 * upsert_addon - Create or update add-on
 *
 * Trust Tier: T2 (soft confirm)
 */
export const upsertAddOnTool: AgentTool = {
  name: 'upsert_addon',
  description: 'Create a new add-on or update an existing one. Add-ons are optional extras for packages.',
  inputSchema: {
    type: 'object',
    properties: {
      addOnId: {
        type: 'string',
        description: 'Add-on ID to update (omit for new add-on)',
      },
      slug: {
        type: 'string',
        description: 'URL-safe identifier (e.g., "extra-hour")',
      },
      name: {
        type: 'string',
        description: 'Add-on display name',
      },
      description: {
        type: 'string',
        description: 'Add-on description',
      },
      priceCents: {
        type: 'number',
        description: 'Price in cents (e.g., 5000 for $50.00)',
      },
      segmentId: {
        type: 'string',
        description: 'Optional segment ID to restrict add-on availability',
      },
      active: {
        type: 'boolean',
        description: 'Whether add-on is available (default: true)',
      },
    },
    required: ['name', 'priceCents'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const addOnId = params.addOnId as string | undefined;

    try {
      // Check if updating existing add-on
      const existing = addOnId
        ? await prisma.addOn.findFirst({ where: { id: addOnId, tenantId } })
        : null;

      const isUpdate = !!existing;
      const operation = isUpdate
        ? `Update add-on "${sanitizeForContext(existing!.name, 50)}"`
        : `Create new add-on "${sanitizeForContext(params.name as string, 50)}"`;

      // Build payload
      const payload: Record<string, unknown> = {
        addOnId,
        slug: params.slug,
        name: params.name,
        description: params.description,
        price: params.priceCents,
        segmentId: params.segmentId,
        active: params.active ?? true,
      };

      // Build preview
      const preview: Record<string, unknown> = {
        action: isUpdate ? 'update' : 'create',
        addOnName: params.name,
        price: `$${((params.priceCents as number) / 100).toFixed(2)}`,
        ...(isUpdate ? { previousPrice: `$${(existing!.price / 100).toFixed(2)}` } : {}),
      };

      return createProposal(context, 'upsert_addon', operation, 'T2', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in upsert_addon tool');
      return { success: false, error: 'Failed to create add-on proposal' };
    }
  },
};

/**
 * delete_addon - Remove add-on
 *
 * Trust Tier: T2 (soft confirm)
 */
export const deleteAddOnTool: AgentTool = {
  name: 'delete_addon',
  description: 'Delete an add-on (soft delete - marks as inactive).',
  inputSchema: {
    type: 'object',
    properties: {
      addOnId: {
        type: 'string',
        description: 'Add-on ID to delete',
      },
    },
    required: ['addOnId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const addOnId = params.addOnId as string;

    try {
      const addOn = await prisma.addOn.findFirst({
        where: { id: addOnId, tenantId },
      });

      if (!addOn) {
        return { success: false, error: 'Add-on not found' };
      }

      const operation = `Delete add-on "${sanitizeForContext(addOn.name, 50)}"`;
      const payload = { addOnId };
      const preview = {
        addOnName: sanitizeForContext(addOn.name, 50),
        price: `$${(addOn.price / 100).toFixed(2)}`,
      };

      return createProposal(context, 'delete_addon', operation, 'T2', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId, addOnId }, 'Error in delete_addon tool');
      return { success: false, error: 'Failed to create delete proposal' };
    }
  },
};

/**
 * delete_package - Remove package
 *
 * Trust Tier: T2 (soft confirm), upgrades to T3 if has bookings
 */
export const deletePackageTool: AgentTool = {
  name: 'delete_package',
  description: 'Delete a package. Requires confirmation if package has existing bookings.',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package ID to delete',
      },
    },
    required: ['packageId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageId = params.packageId as string;

    try {
      const pkg = await prisma.package.findFirst({
        where: { id: packageId, tenantId },
        include: {
          _count: { select: { bookings: true } },
        },
      });

      if (!pkg) {
        return { success: false, error: 'Package not found' };
      }

      const hasBookings = pkg._count.bookings > 0;
      const trustTier = hasBookings ? 'T3' : 'T2';

      const operation = `Delete package "${sanitizeForContext(pkg.name, 50)}"`;
      const payload = { packageId };
      const preview: Record<string, unknown> = {
        packageName: sanitizeForContext(pkg.name, 50),
        bookingCount: pkg._count.bookings,
        ...(hasBookings
          ? { warning: 'This package has existing bookings that will be orphaned' }
          : {}),
      };

      return createProposal(context, 'delete_package', operation, trustTier, payload, preview);
    } catch (error) {
      logger.error({ error, tenantId, packageId }, 'Error in delete_package tool');
      return { success: false, error: 'Failed to create delete proposal' };
    }
  },
};

/**
 * manage_blackout - Create or delete blackout
 *
 * Trust Tier: T1 (no confirm)
 */
export const manageBlackoutTool: AgentTool = {
  name: 'manage_blackout',
  description: 'Add or remove a blackout date (blocked date for bookings)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform',
        enum: ['create', 'delete'],
      },
      date: {
        type: 'string',
        description: 'Date to block/unblock (YYYY-MM-DD)',
      },
      reason: {
        type: 'string',
        description: 'Reason for blackout (for create only)',
      },
    },
    required: ['action', 'date'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;
    const action = params.action as 'create' | 'delete';
    const dateStr = params.date as string;
    const reason = params.reason as string | undefined;

    try {
      const operation =
        action === 'create'
          ? `Block date ${dateStr}${reason ? ` (${sanitizeForContext(reason, 30)})` : ''}`
          : `Unblock date ${dateStr}`;

      const payload = { action, date: dateStr, reason };
      const preview = {
        action,
        date: dateStr,
        ...(reason ? { reason: sanitizeForContext(reason, 50) } : {}),
      };

      return createProposal(context, 'manage_blackout', operation, 'T1', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in manage_blackout tool');
      return { success: false, error: 'Failed to create blackout proposal' };
    }
  },
};

/**
 * update_branding - Update brand settings
 *
 * Trust Tier: T1 (no confirm)
 */
export const updateBrandingTool: AgentTool = {
  name: 'update_branding',
  description: 'Update business branding settings (colors, logo, fonts)',
  inputSchema: {
    type: 'object',
    properties: {
      primaryColor: {
        type: 'string',
        description: 'Primary brand color (hex, e.g., "#1a365d")',
      },
      secondaryColor: {
        type: 'string',
        description: 'Secondary accent color (hex)',
      },
      accentColor: {
        type: 'string',
        description: 'Accent color (hex)',
      },
      backgroundColor: {
        type: 'string',
        description: 'Page background color (hex)',
      },
      logoUrl: {
        type: 'string',
        description: 'Business logo URL',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;

    try {
      const changes: string[] = [];
      if (params.primaryColor) changes.push('primary color');
      if (params.secondaryColor) changes.push('secondary color');
      if (params.accentColor) changes.push('accent color');
      if (params.backgroundColor) changes.push('background color');
      if (params.logoUrl) changes.push('logo');

      const operation = `Update branding (${changes.join(', ')})`;
      const payload = { ...params };
      const preview = { changes };

      return createProposal(context, 'update_branding', operation, 'T1', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in update_branding tool');
      return { success: false, error: 'Failed to create branding proposal' };
    }
  },
};

/**
 * update_landing_page - Update storefront
 *
 * Trust Tier: T2 (soft confirm)
 */
export const updateLandingPageTool: AgentTool = {
  name: 'update_landing_page',
  description: 'Update storefront landing page content and sections',
  inputSchema: {
    type: 'object',
    properties: {
      hero: {
        type: 'object',
        description: 'Hero section (headline, subheadline, backgroundImageUrl)',
      },
      about: {
        type: 'object',
        description: 'About section (title, description, imageUrl)',
      },
      testimonials: {
        type: 'object',
        description: 'Testimonials section (items array)',
      },
      gallery: {
        type: 'object',
        description: 'Gallery section (images array)',
      },
      faq: {
        type: 'object',
        description: 'FAQ section (items array)',
      },
      sections: {
        type: 'object',
        description: 'Section visibility toggles',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId } = context;

    try {
      const sections = Object.keys(params).filter((k) => params[k] !== undefined);
      const operation = `Update landing page (${sections.join(', ')})`;
      const payload = { ...params };
      const preview = { updatedSections: sections };

      return createProposal(context, 'update_landing_page', operation, 'T2', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in update_landing_page tool');
      return { success: false, error: 'Failed to create landing page proposal' };
    }
  },
};

/**
 * request_file_upload - Get upload URL
 *
 * Trust Tier: T1 (no confirm) - this is a read-like operation
 */
export const requestFileUploadTool: AgentTool = {
  name: 'request_file_upload',
  description: 'Get instructions for uploading a file (logo, photo, etc.). The user will need to upload via UI.',
  inputSchema: {
    type: 'object',
    properties: {
      fileType: {
        type: 'string',
        description: 'Type of file to upload',
        enum: ['logo', 'package-photo', 'gallery', 'segment'],
      },
      filename: {
        type: 'string',
        description: 'Original filename (for extension detection)',
      },
    },
    required: ['fileType', 'filename'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const fileType = params.fileType as string;
    const filename = params.filename as string;

    // This is essentially a read operation - just returns upload instructions
    const uploadInfo = {
      method: 'POST',
      endpoint:
        fileType === 'logo'
          ? '/v1/tenant-admin/logo'
          : fileType === 'segment'
            ? '/v1/tenant-admin/segment-image'
            : '/v1/tenant-admin/packages/{packageId}/photos',
      fieldName: fileType === 'logo' ? 'logo' : fileType === 'segment' ? 'file' : 'photo',
      maxSizeMB: fileType === 'logo' ? 2 : 5,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      instructions:
        'Upload file using multipart/form-data. For package photos, specify the package ID.',
    };

    return {
      success: true,
      data: uploadInfo,
    };
  },
};

/**
 * cancel_booking - Cancel and refund
 *
 * Trust Tier: T3 (hard confirm) - ALWAYS requires explicit confirmation
 */
export const cancelBookingTool: AgentTool = {
  name: 'cancel_booking',
  description: 'Cancel a booking and process refund. ALWAYS requires explicit confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'Booking ID to cancel',
      },
      reason: {
        type: 'string',
        description: 'Cancellation reason',
      },
    },
    required: ['bookingId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const bookingId = params.bookingId as string;
    const reason = params.reason as string | undefined;

    try {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { package: true, customer: true },
      });

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        return { success: false, error: 'Booking is already cancelled or refunded' };
      }

      // Customer name from Customer relation, date from Booking.date, price from Booking.totalPrice
      const customerName = booking.customer?.name || 'Unknown Customer';
      const operation = `Cancel booking for ${sanitizeForContext(customerName, 30)} on ${booking.date.toISOString().split('T')[0]}`;
      const payload = { bookingId, reason: reason || 'Cancelled by tenant' };
      const preview = {
        customerName: sanitizeForContext(customerName, 30),
        eventDate: booking.date.toISOString().split('T')[0],
        packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
        totalPrice: booking.totalPrice,
        refundAmount: `$${(booking.totalPrice / 100).toFixed(2)}`,
        warning: 'Customer will be notified and refund will be processed',
      };

      return createProposal(context, 'cancel_booking', operation, 'T3', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId, bookingId }, 'Error in cancel_booking tool');
      return { success: false, error: 'Failed to create cancellation proposal' };
    }
  },
};

/**
 * create_booking - Manual booking creation
 *
 * Trust Tier: T3 (hard confirm) - ALWAYS requires explicit confirmation
 * This is for phone orders, walk-ins, and manual booking entry
 */
export const createBookingTool: AgentTool = {
  name: 'create_booking',
  description: 'Create a manual booking (for phone orders, walk-ins). ALWAYS requires explicit confirmation. Checks availability before creating.',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package ID to book',
      },
      date: {
        type: 'string',
        description: 'Booking date (YYYY-MM-DD format)',
      },
      customerName: {
        type: 'string',
        description: 'Customer full name',
      },
      customerEmail: {
        type: 'string',
        description: 'Customer email address',
      },
      customerPhone: {
        type: 'string',
        description: 'Customer phone number (optional)',
      },
      notes: {
        type: 'string',
        description: 'Booking notes (optional)',
      },
      priceCents: {
        type: 'number',
        description: 'Override price in cents (optional, defaults to package price)',
      },
    },
    required: ['packageId', 'date', 'customerName', 'customerEmail'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const packageId = params.packageId as string;
    const dateStr = params.date as string;
    const customerName = params.customerName as string;
    const customerEmail = params.customerEmail as string;
    const customerPhone = params.customerPhone as string | undefined;
    const notes = params.notes as string | undefined;
    const priceCentsOverride = params.priceCents as number | undefined;

    try {
      // Validate package exists and belongs to tenant
      const pkg = await prisma.package.findFirst({
        where: { id: packageId, tenantId, active: true },
      });

      if (!pkg) {
        return { success: false, error: 'Package not found or inactive' };
      }

      // Check availability (prevent double-booking)
      const bookingDate = new Date(dateStr);
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
          error: `Date ${dateStr} is already booked. Please choose another date.`
        };
      }

      // Check for blackout
      const blackout = await prisma.blackoutDate.findFirst({
        where: { tenantId, date: bookingDate },
      });

      if (blackout) {
        return {
          success: false,
          error: `Date ${dateStr} is blocked${blackout.reason ? `: ${blackout.reason}` : ''}`
        };
      }

      // Determine price
      const totalPrice = priceCentsOverride ?? pkg.basePrice;

      const operation = `Create manual booking for ${sanitizeForContext(customerName, 30)} on ${dateStr}`;
      const payload = {
        packageId,
        date: dateStr,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        totalPrice,
      };
      const preview = {
        customerName: sanitizeForContext(customerName, 30),
        customerEmail: sanitizeForContext(customerEmail, 50),
        eventDate: dateStr,
        packageName: sanitizeForContext(pkg.name, 50),
        price: `$${(totalPrice / 100).toFixed(2)}`,
        note: 'This creates a confirmed booking. No payment will be processed - handle payment separately.',
      };

      return createProposal(context, 'create_booking', operation, 'T3', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId, packageId }, 'Error in create_booking tool');
      return { success: false, error: 'Failed to create booking proposal' };
    }
  },
};

/**
 * process_refund - Process refund for a booking
 *
 * Trust Tier: T3 (hard confirm) - ALWAYS requires explicit confirmation
 * This is for processing refunds independently of cancellation
 */
export const processRefundTool: AgentTool = {
  name: 'process_refund',
  description: 'Process a refund for a booking. Can do full or partial refund. ALWAYS requires explicit confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'Booking ID to refund',
      },
      amountCents: {
        type: 'number',
        description: 'Amount to refund in cents (omit for full refund)',
      },
      reason: {
        type: 'string',
        description: 'Reason for the refund',
      },
    },
    required: ['bookingId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const bookingId = params.bookingId as string;
    const amountCents = params.amountCents as number | undefined;
    const reason = params.reason as string | undefined;

    try {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { package: true, customer: true },
      });

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Check if already fully refunded
      if (booking.refundStatus === 'COMPLETED') {
        return { success: false, error: 'Booking has already been fully refunded' };
      }

      // Calculate refund amount
      const paidAmount = (booking.depositPaidAmount || 0) + (booking.balancePaidAmount || 0);
      const alreadyRefunded = booking.refundAmount || 0;
      const maxRefundable = paidAmount - alreadyRefunded;

      if (maxRefundable <= 0) {
        return { success: false, error: 'No refundable amount available for this booking' };
      }

      const refundAmount = amountCents
        ? Math.min(amountCents, maxRefundable)
        : maxRefundable;

      const isFullRefund = refundAmount >= maxRefundable;
      const customerName = booking.customer?.name || 'Unknown Customer';

      const operation = isFullRefund
        ? `Process full refund for ${sanitizeForContext(customerName, 30)}`
        : `Process partial refund ($${(refundAmount / 100).toFixed(2)}) for ${sanitizeForContext(customerName, 30)}`;

      const payload = {
        bookingId,
        refundAmount,
        isFullRefund,
        reason: reason || 'Refund processed by business owner',
      };

      const preview = {
        customerName: sanitizeForContext(customerName, 30),
        eventDate: booking.date.toISOString().split('T')[0],
        packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
        totalPaid: `$${(paidAmount / 100).toFixed(2)}`,
        previouslyRefunded: alreadyRefunded > 0 ? `$${(alreadyRefunded / 100).toFixed(2)}` : null,
        refundAmount: `$${(refundAmount / 100).toFixed(2)}`,
        refundType: isFullRefund ? 'Full refund' : 'Partial refund',
        warning: 'Refund will be processed via Stripe. This cannot be undone.',
      };

      return createProposal(context, 'process_refund', operation, 'T3', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId, bookingId }, 'Error in process_refund tool');
      return { success: false, error: 'Failed to create refund proposal' };
    }
  },
};

/**
 * All write tools exported as array for registration
 */
export const writeTools: AgentTool[] = [
  upsertPackageTool,
  upsertAddOnTool,
  deleteAddOnTool,
  deletePackageTool,
  manageBlackoutTool,
  updateBrandingTool,
  updateLandingPageTool,
  requestFileUploadTool,
  cancelBookingTool,
  createBookingTool,
  processRefundTool,
];
