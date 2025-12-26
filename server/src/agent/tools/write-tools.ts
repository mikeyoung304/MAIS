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
        ? `Update package "${sanitizeForContext(existing!.title, 50)}"`
        : `Create new package "${sanitizeForContext(params.title as string, 50)}"`;

      // Build payload
      const payload: Record<string, unknown> = {
        packageId,
        slug: params.slug,
        title: params.title,
        description: params.description,
        priceCents: params.priceCents,
        photoUrl: params.photoUrl,
        bookingType: params.bookingType || 'DATE',
        active: params.active ?? true,
      };

      // Build preview
      const preview: Record<string, unknown> = {
        action: isUpdate ? 'update' : 'create',
        packageName: params.title,
        price: `$${((params.priceCents as number) / 100).toFixed(2)}`,
        ...(isUpdate ? { previousPrice: `$${(existing!.priceCents / 100).toFixed(2)}` } : {}),
      };

      return createProposal(context, 'upsert_package', operation, 'T2', payload, preview);
    } catch (error) {
      logger.error({ error, tenantId }, 'Error in upsert_package tool');
      return { success: false, error: 'Failed to create package proposal' };
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

      const operation = `Delete package "${sanitizeForContext(pkg.title, 50)}"`;
      const payload = { packageId };
      const preview: Record<string, unknown> = {
        packageName: sanitizeForContext(pkg.title, 50),
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
        include: { package: true },
      });

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        return { success: false, error: 'Booking is already cancelled or refunded' };
      }

      const operation = `Cancel booking for ${sanitizeForContext(booking.coupleName, 30)} on ${booking.eventDate.toISOString().split('T')[0]}`;
      const payload = { bookingId, reason: reason || 'Cancelled by tenant' };
      const preview = {
        customerName: sanitizeForContext(booking.coupleName, 30),
        eventDate: booking.eventDate.toISOString().split('T')[0],
        packageTitle: sanitizeForContext(booking.package?.title || 'Unknown', 50),
        totalCents: booking.totalCents,
        refundAmount: `$${(booking.totalCents / 100).toFixed(2)}`,
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
 * All write tools exported as array for registration
 */
export const writeTools: AgentTool[] = [
  upsertPackageTool,
  deletePackageTool,
  manageBlackoutTool,
  updateBrandingTool,
  updateLandingPageTool,
  requestFileUploadTool,
  cancelBookingTool,
];
