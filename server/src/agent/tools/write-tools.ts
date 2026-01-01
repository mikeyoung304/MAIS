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
import { handleToolError, formatPrice, formatDateISO } from './utils';

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
 * Threshold for significant price changes that require T3 confirmation
 */
const SIGNIFICANT_PRICE_CHANGE_THRESHOLD = {
  relativePercent: 20, // >20% change
  absoluteCents: 10000, // >$100 change
};

/**
 * Check if a price change is significant enough to require T3 confirmation
 * Returns true if:
 * - Relative change exceeds 20% OR
 * - Absolute change exceeds $100 (10000 cents)
 */
function isSignificantPriceChange(oldPriceCents: number, newPriceCents: number): boolean {
  if (oldPriceCents === 0) {
    // If old price was 0, any non-zero new price is significant
    return newPriceCents > SIGNIFICANT_PRICE_CHANGE_THRESHOLD.absoluteCents;
  }

  const absoluteChange = Math.abs(newPriceCents - oldPriceCents);
  const relativeChange = (absoluteChange / oldPriceCents) * 100;

  return (
    relativeChange > SIGNIFICANT_PRICE_CHANGE_THRESHOLD.relativePercent ||
    absoluteChange > SIGNIFICANT_PRICE_CHANGE_THRESHOLD.absoluteCents
  );
}

/**
 * upsert_package - Create or update package
 *
 * Trust Tier:
 * - T2 (soft confirm) for new packages or minor price changes
 * - T3 (hard confirm) for significant price changes (>20% or >$100)
 */
export const upsertPackageTool: AgentTool = {
  name: 'upsert_package',
  trustTier: 'T2', // Package updates (price changes may escalate to T3 in execute)
  description:
    'Create a new package or update an existing one. Includes title, description, pricing, and photos. Large price changes (>20% or >$100) require additional confirmation.',
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
    const newPriceCents = params.priceCents as number;

    try {
      // Check if updating existing package
      const existing = packageId
        ? await prisma.package.findFirst({ where: { id: packageId, tenantId } })
        : null;

      const isUpdate = !!existing;
      const operation = isUpdate
        ? `Update package "${sanitizeForContext(existing!.name, 50)}"`
        : `Create new package "${sanitizeForContext(params.title as string, 50)}"`;

      // Determine trust tier based on price change significance
      // - New packages: T2
      // - Updates with significant price change (>20% or >$100): T3
      // - Updates with minor or no price change: T2
      let trustTier: 'T2' | 'T3' = 'T2';
      let priceChangeWarning: string | undefined;

      if (isUpdate && existing) {
        const oldPriceCents = existing.basePrice;
        if (isSignificantPriceChange(oldPriceCents, newPriceCents)) {
          trustTier = 'T3';
          const absoluteChange = Math.abs(newPriceCents - oldPriceCents);
          const relativeChange =
            oldPriceCents > 0 ? ((absoluteChange / oldPriceCents) * 100).toFixed(1) : 'N/A';
          const direction = newPriceCents > oldPriceCents ? 'increase' : 'decrease';
          priceChangeWarning = `Significant price ${direction}: ${formatPrice(absoluteChange)} (${relativeChange}%)`;
        }
      }

      // Build payload - map from input params to Prisma field names
      const payload: Record<string, unknown> = {
        packageId,
        slug: params.slug,
        name: params.title, // Map title -> name (Prisma field)
        description: params.description,
        basePrice: newPriceCents, // Map priceCents -> basePrice (Prisma field)
        photoUrl: params.photoUrl,
        bookingType: params.bookingType || 'DATE',
        active: params.active ?? true,
      };

      // Build preview
      const preview: Record<string, unknown> = {
        action: isUpdate ? 'update' : 'create',
        packageName: params.title,
        price: formatPrice(newPriceCents),
        ...(isUpdate ? { previousPrice: formatPrice(existing!.basePrice) } : {}),
        ...(priceChangeWarning ? { warning: priceChangeWarning } : {}),
      };

      return createProposal(context, 'upsert_package', operation, trustTier, payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'upsert_package',
        tenantId,
        'Failed to create package proposal. Verify the package details (title required, price must be in cents) and try again'
      );
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
  trustTier: 'T2', // Soft confirm for add-on changes
  description:
    'Create a new add-on or update an existing one. Add-ons are optional extras for packages.',
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
        price: formatPrice(params.priceCents as number),
        ...(isUpdate ? { previousPrice: formatPrice(existing!.price) } : {}),
      };

      return createProposal(context, 'upsert_addon', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'upsert_addon',
        tenantId,
        'Failed to create add-on proposal. Verify the add-on details (name required, price must be in cents) and try again'
      );
    }
  },
};

/**
 * delete_addon - Remove add-on
 *
 * Trust Tier: T2 (soft confirm), upgrades to T3 if has bookings
 */
export const deleteAddOnTool: AgentTool = {
  name: 'delete_addon',
  trustTier: 'T2', // Base T2, dynamically escalates to T3 if has bookings
  description:
    'Delete an add-on (soft delete - marks as inactive). Requires confirmation if add-on has existing bookings.',
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
        include: {
          _count: { select: { bookingRefs: true } },
        },
      });

      if (!addOn) {
        return {
          success: false,
          error: 'Unable to access add-on. Please check the ID and try again.',
        };
      }

      const hasBookings = addOn._count.bookingRefs > 0;
      const trustTier = hasBookings ? 'T3' : 'T2';

      const operation = `Delete add-on "${sanitizeForContext(addOn.name, 50)}"`;
      const payload = { addOnId };
      const preview: Record<string, unknown> = {
        addOnName: sanitizeForContext(addOn.name, 50),
        price: formatPrice(addOn.price),
        bookingCount: addOn._count.bookingRefs,
        ...(hasBookings ? { warning: 'This add-on has existing bookings that reference it' } : {}),
      };

      return createProposal(context, 'delete_addon', operation, trustTier, payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'delete_addon',
        tenantId,
        `Failed to create delete proposal for add-on "${addOnId}". Verify the add-on ID is correct`
      );
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
  trustTier: 'T2', // Base T2, dynamically escalates to T3 if has bookings
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
        return {
          success: false,
          error: 'Unable to access package. Please check the ID and try again.',
        };
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
      return handleToolError(
        error,
        'delete_package',
        tenantId,
        `Failed to create delete proposal for package "${packageId}". Verify the package ID is correct`
      );
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
  trustTier: 'T1', // Auto-confirm for blackout management
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
      return handleToolError(
        error,
        'manage_blackout',
        tenantId,
        `Failed to create blackout proposal for date "${dateStr}". Ensure the date is in YYYY-MM-DD format`
      );
    }
  },
};

/**
 * add_blackout_date - Block date(s) for bookings
 *
 * Trust Tier: T1 (auto-confirm) - Low risk, adding restrictions
 * Supports single dates or date ranges (multi-day blocks)
 */
export const addBlackoutDateTool: AgentTool = {
  name: 'add_blackout_date',
  trustTier: 'T1', // Auto-confirm - low risk, adding restrictions
  description:
    'Block a date or date range for bookings (e.g., vacation, holiday). Supports single day or multi-day ranges.',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date to block (YYYY-MM-DD format)',
      },
      endDate: {
        type: 'string',
        description: 'End date for range (YYYY-MM-DD format, optional - omit for single day block)',
      },
      reason: {
        type: 'string',
        description: 'Reason for blocking (e.g., "Vacation", "Holiday", "Personal day")',
      },
    },
    required: ['startDate'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const startDateStr = params.startDate as string;
    const endDateStr = params.endDate as string | undefined;
    const reason = params.reason as string | undefined;

    try {
      // Validate start date
      const startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return {
          success: false,
          error: 'Invalid start date format. Use YYYY-MM-DD format.',
        };
      }

      // Validate end date if provided
      let endDate = startDate;
      if (endDateStr) {
        endDate = new Date(endDateStr);
        if (isNaN(endDate.getTime())) {
          return {
            success: false,
            error: 'Invalid end date format. Use YYYY-MM-DD format.',
          };
        }
        if (endDate < startDate) {
          return {
            success: false,
            error: 'End date cannot be before start date.',
          };
        }
      }

      // Calculate number of days in range
      const msPerDay = 24 * 60 * 60 * 1000;
      const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;

      // Limit to 31 days to prevent accidental massive blocks
      if (dayCount > 31) {
        return {
          success: false,
          error: 'Cannot block more than 31 days at once. Please use smaller ranges.',
        };
      }

      // Build array of dates to block
      const datesToBlock: string[] = [];
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(startDate.getTime() + i * msPerDay);
        datesToBlock.push(formatDateISO(date));
      }

      // Check for existing blackouts in range
      const existingBlackouts = await prisma.blackoutDate.findMany({
        where: {
          tenantId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { date: true },
      });

      const existingDates = new Set(existingBlackouts.map((b) => formatDateISO(b.date)));
      const newDates = datesToBlock.filter((d) => !existingDates.has(d));

      // Build operation description
      const isRange = dayCount > 1;
      const operation = isRange
        ? `Block ${dayCount} days (${startDateStr} to ${endDateStr})${reason ? `: ${sanitizeForContext(reason, 30)}` : ''}`
        : `Block ${startDateStr}${reason ? `: ${sanitizeForContext(reason, 30)}` : ''}`;

      const payload = {
        dates: datesToBlock,
        newDates,
        reason: reason || null,
        isRange,
        startDate: startDateStr,
        endDate: endDateStr || startDateStr,
      };

      const preview: Record<string, unknown> = {
        action: 'add_blackout',
        startDate: startDateStr,
        ...(isRange ? { endDate: endDateStr } : {}),
        daysBlocked: dayCount,
        newDaysToBlock: newDates.length,
        ...(existingDates.size > 0 ? { alreadyBlocked: existingDates.size } : {}),
        ...(reason ? { reason: sanitizeForContext(reason, 50) } : {}),
      };

      return createProposal(context, 'add_blackout_date', operation, 'T1', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'add_blackout_date',
        tenantId,
        'Failed to create blackout proposal. Ensure dates are in YYYY-MM-DD format'
      );
    }
  },
};

/**
 * remove_blackout_date - Unblock a date for bookings
 *
 * Trust Tier: T2 (soft confirm) - Opens up availability, higher risk than blocking
 */
export const removeBlackoutDateTool: AgentTool = {
  name: 'remove_blackout_date',
  trustTier: 'T2', // Soft confirm - opens availability, higher risk
  description:
    'Remove a blackout (unblock a date) so bookings can be made again. Use get_blackout_dates to find blackout IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      blackoutId: {
        type: 'string',
        description: 'Blackout ID to remove (use get_blackout_dates to find IDs)',
      },
    },
    required: ['blackoutId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const blackoutId = params.blackoutId as string;

    try {
      // Find the blackout and verify ownership
      const blackout = await prisma.blackoutDate.findFirst({
        where: { id: blackoutId, tenantId },
      });

      if (!blackout) {
        return {
          success: false,
          error: 'Unable to access blackout date. Please check the ID and try again.',
        };
      }

      const dateStr = formatDateISO(blackout.date);
      const operation = `Unblock ${dateStr}${blackout.reason ? ` (was: ${sanitizeForContext(blackout.reason, 30)})` : ''}`;

      const payload = {
        blackoutId,
        date: dateStr,
      };

      const preview: Record<string, unknown> = {
        action: 'remove_blackout',
        date: dateStr,
        ...(blackout.reason ? { previousReason: sanitizeForContext(blackout.reason, 50) } : {}),
        note: 'This date will become available for bookings again.',
      };

      return createProposal(context, 'remove_blackout_date', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'remove_blackout_date',
        tenantId,
        'Failed to create unblock proposal. Verify the blackout ID is correct'
      );
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
  trustTier: 'T1', // Auto-confirm for branding changes
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
      return handleToolError(
        error,
        'update_branding',
        tenantId,
        'Failed to create branding proposal. Ensure colors are valid hex codes (e.g., "#1a365d")'
      );
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
  trustTier: 'T2', // Soft confirm for landing page updates
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
      return handleToolError(
        error,
        'update_landing_page',
        tenantId,
        'Failed to create landing page proposal. Verify the section data is properly formatted'
      );
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
  trustTier: 'T1', // Read-like operation - just returns upload instructions
  description:
    'Get instructions for uploading a file (logo, photo, etc.). The user will need to upload via UI.',
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
  async execute(_context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
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
  trustTier: 'T3', // Hard confirm - always requires explicit confirmation
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
        return {
          success: false,
          error: 'Unable to access booking. Please check the ID and try again.',
        };
      }

      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        return { success: false, error: 'This booking is already cancelled or refunded.' };
      }

      // Customer name from Customer relation, date from Booking.date, price from Booking.totalPrice
      const customerName = booking.customer?.name || 'Unknown Customer';
      const eventDate = formatDateISO(booking.date);
      const operation = `Cancel booking for ${sanitizeForContext(customerName, 30)} on ${eventDate}`;
      const payload = { bookingId, reason: reason || 'Cancelled by tenant' };
      const preview = {
        customerName: sanitizeForContext(customerName, 30),
        eventDate,
        packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
        totalPrice: booking.totalPrice,
        refundAmount: formatPrice(booking.totalPrice),
        warning: 'Customer will be notified and refund will be processed',
      };

      return createProposal(context, 'cancel_booking', operation, 'T3', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'cancel_booking',
        tenantId,
        `Failed to create cancellation proposal for booking "${bookingId}". Verify the booking ID is correct and belongs to your business`
      );
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
  trustTier: 'T3', // Hard confirm - always requires explicit confirmation
  description:
    'Create a manual booking (for phone orders, walk-ins). ALWAYS requires explicit confirmation. Checks availability before creating.',
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
        return {
          success: false,
          error: 'Unable to access package. Please check the ID and try again.',
        };
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
          error: `Date ${dateStr} is already booked. Please choose another date.`,
        };
      }

      // Check for blackout
      const blackout = await prisma.blackoutDate.findFirst({
        where: { tenantId, date: bookingDate },
      });

      if (blackout) {
        return {
          success: false,
          error: `Date ${dateStr} is blocked${blackout.reason ? `: ${blackout.reason}` : ''}`,
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
        price: formatPrice(totalPrice),
        note: 'This creates a confirmed booking. No payment will be processed - handle payment separately.',
      };

      return createProposal(context, 'create_booking', operation, 'T3', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'create_booking',
        tenantId,
        'Failed to create booking proposal. Verify the package ID is correct, date is in YYYY-MM-DD format, and customer email is valid'
      );
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
  trustTier: 'T3', // Hard confirm - financial operation
  description:
    'Process a refund for a booking. Can do full or partial refund. ALWAYS requires explicit confirmation.',
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
        return {
          success: false,
          error: 'Unable to access booking. Please check the ID and try again.',
        };
      }

      // Check if already fully refunded
      if (booking.refundStatus === 'COMPLETED') {
        return { success: false, error: 'This booking has already been fully refunded.' };
      }

      // Calculate refund amount
      const paidAmount = (booking.depositPaidAmount || 0) + (booking.balancePaidAmount || 0);
      const alreadyRefunded = booking.refundAmount || 0;
      const maxRefundable = paidAmount - alreadyRefunded;

      if (maxRefundable <= 0) {
        return { success: false, error: 'No refundable amount available for this booking' };
      }

      const refundAmount = amountCents ? Math.min(amountCents, maxRefundable) : maxRefundable;

      const isFullRefund = refundAmount >= maxRefundable;
      const customerName = booking.customer?.name || 'Unknown Customer';

      const operation = isFullRefund
        ? `Process full refund for ${sanitizeForContext(customerName, 30)}`
        : `Process partial refund (${formatPrice(refundAmount)}) for ${sanitizeForContext(customerName, 30)}`;

      const payload = {
        bookingId,
        refundAmount,
        isFullRefund,
        reason: reason || 'Refund processed by business owner',
      };

      const preview = {
        customerName: sanitizeForContext(customerName, 30),
        eventDate: formatDateISO(booking.date),
        packageName: sanitizeForContext(booking.package?.name || 'Unknown', 50),
        totalPaid: formatPrice(paidAmount),
        previouslyRefunded: alreadyRefunded > 0 ? formatPrice(alreadyRefunded) : null,
        refundAmount: formatPrice(refundAmount),
        refundType: isFullRefund ? 'Full refund' : 'Partial refund',
        warning: 'Refund will be processed via Stripe. This cannot be undone.',
      };

      return createProposal(context, 'process_refund', operation, 'T3', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'process_refund',
        tenantId,
        `Failed to create refund proposal for booking "${bookingId}". Verify the booking ID is correct and has paid amounts to refund`
      );
    }
  },
};

/**
 * upsert_segment - Create or update segment
 *
 * Trust Tier: T2 (soft confirm)
 */
export const upsertSegmentTool: AgentTool = {
  name: 'upsert_segment',
  trustTier: 'T2', // Soft confirm for segment changes
  description: 'Create a new segment or update an existing one. Segments organize packages.',
  inputSchema: {
    type: 'object',
    properties: {
      segmentId: {
        type: 'string',
        description: 'Segment ID to update (omit for new segment)',
      },
      slug: {
        type: 'string',
        description: 'URL-safe identifier (e.g., "wellness-retreat")',
      },
      name: {
        type: 'string',
        description: 'Display name',
      },
      heroTitle: {
        type: 'string',
        description: 'Hero section title',
      },
      heroSubtitle: {
        type: 'string',
        description: 'Hero section subtitle',
      },
      description: {
        type: 'string',
        description: 'Segment description',
      },
      sortOrder: {
        type: 'number',
        description: 'Display order',
      },
      active: {
        type: 'boolean',
        description: 'Visibility',
      },
    },
    required: ['slug', 'name', 'heroTitle'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const segmentId = params.segmentId as string | undefined;

    try {
      // Check if updating existing segment
      const existing = segmentId
        ? await prisma.segment.findFirst({ where: { id: segmentId, tenantId } })
        : null;

      const isUpdate = !!existing;
      const operation = isUpdate
        ? `Update segment "${sanitizeForContext(existing!.name, 50)}"`
        : `Create new segment "${sanitizeForContext(params.name as string, 50)}"`;

      // Build payload
      const payload: Record<string, unknown> = {
        segmentId,
        slug: params.slug,
        name: params.name,
        heroTitle: params.heroTitle,
        heroSubtitle: params.heroSubtitle,
        description: params.description,
        sortOrder: params.sortOrder,
        active: params.active ?? true,
      };

      // Build preview
      const preview: Record<string, unknown> = {
        action: isUpdate ? 'update' : 'create',
        segmentName: params.name,
        slug: params.slug,
      };

      return createProposal(context, 'upsert_segment', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'upsert_segment',
        tenantId,
        'Failed to create segment proposal. Verify required fields (slug, name, heroTitle) are provided'
      );
    }
  },
};

/**
 * delete_segment - Remove segment
 *
 * Trust Tier: T2 (soft confirm), T3 if has packages
 */
export const deleteSegmentTool: AgentTool = {
  name: 'delete_segment',
  trustTier: 'T2', // Base T2, dynamically escalates to T3 if has packages
  description:
    'Delete a segment (soft delete - marks as inactive). Requires confirmation if segment has packages.',
  inputSchema: {
    type: 'object',
    properties: {
      segmentId: {
        type: 'string',
        description: 'Segment ID to delete',
      },
    },
    required: ['segmentId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const segmentId = params.segmentId as string;

    try {
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

      const hasPackages = segment._count.packages > 0;
      const trustTier = hasPackages ? 'T3' : 'T2';

      const operation = `Delete segment "${sanitizeForContext(segment.name, 50)}"`;
      const payload = { segmentId };
      const preview: Record<string, unknown> = {
        segmentName: sanitizeForContext(segment.name, 50),
        packageCount: segment._count.packages,
        ...(hasPackages ? { warning: 'This segment has packages that will be orphaned' } : {}),
      };

      return createProposal(context, 'delete_segment', operation, trustTier, payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'delete_segment',
        tenantId,
        `Failed to create delete proposal for segment "${segmentId}". Verify the segment ID is correct`
      );
    }
  },
};

/**
 * update_booking - Update booking details (reschedule, notes, status)
 *
 * Trust Tier: T2 (soft confirm)
 * - Validates booking belongs to tenant (tenant isolation)
 * - Checks new date/time isn't blacked out or already booked
 * - Preserves payment status and customer info
 */
export const updateBookingTool: AgentTool = {
  name: 'update_booking',
  trustTier: 'T2', // Soft confirm - preserves payment status
  description:
    'Reschedule a booking to a new date/time, add notes, or update status. Preserves payment info and customer details.',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'Booking ID to update (required)',
      },
      newDate: {
        type: 'string',
        description: 'New date in YYYY-MM-DD format',
      },
      newTime: {
        type: 'string',
        description: 'New time in HH:MM format (24-hour, for timeslot bookings)',
      },
      notes: {
        type: 'string',
        description: 'Internal notes to add or update',
      },
      status: {
        type: 'string',
        description: 'Status update',
        enum: ['CONFIRMED', 'FULFILLED'],
      },
      notifyCustomer: {
        type: 'boolean',
        description: 'Whether to notify the customer of changes (default: true)',
      },
    },
    required: ['bookingId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const bookingId = params.bookingId as string;
    const newDate = params.newDate as string | undefined;
    const newTime = params.newTime as string | undefined;
    const notes = params.notes as string | undefined;
    const status = params.status as string | undefined;
    const notifyCustomer = (params.notifyCustomer as boolean) ?? true; // Default to true

    try {
      // Verify ownership - CRITICAL: tenant isolation check
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: {
          package: { select: { name: true, bookingType: true } },
          customer: { select: { name: true, email: true } },
        },
      });

      if (!booking) {
        return {
          success: false,
          error: 'Unable to access booking. Please check the ID and try again.',
        };
      }

      // Cannot update cancelled/refunded bookings
      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        return {
          success: false,
          error: `Cannot update a ${booking.status.toLowerCase()} booking. Create a new booking instead.`,
        };
      }

      // Validate time format if provided
      if (newTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(newTime)) {
        return {
          success: false,
          error: 'Invalid time format. Use HH:MM in 24-hour format (e.g., "14:30").',
        };
      }

      // If date change, check availability and blackouts
      if (newDate) {
        const dateObj = new Date(newDate);
        if (isNaN(dateObj.getTime())) {
          return { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
        }

        // Check if new date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateObj < today) {
          return { success: false, error: 'Cannot reschedule to a date in the past.' };
        }

        // Check for conflicting booking on new date
        const conflict = await prisma.booking.findFirst({
          where: {
            tenantId,
            date: dateObj,
            id: { not: bookingId },
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        });

        if (conflict) {
          return {
            success: false,
            error: `Date ${newDate} is already booked. Use check_availability to find an open date.`,
          };
        }

        // Check for blackout date
        const blackout = await prisma.blackoutDate.findFirst({
          where: { tenantId, date: dateObj },
        });

        if (blackout) {
          return {
            success: false,
            error: `Date ${newDate} is blocked${blackout.reason ? ` (${blackout.reason})` : ''}. Choose another date.`,
          };
        }
      }

      // Build payload for executor - preserves payment status and customer info
      const payload: Record<string, unknown> = {
        bookingId,
        newDate,
        newTime,
        notes,
        status,
        notifyCustomer,
      };

      // Build changes summary for preview
      const changes: Record<string, string> = {};

      if (newDate) {
        changes.date = `${formatDateISO(booking.date)} → ${newDate}`;
      }
      if (newTime) {
        const currentTime = booking.startTime
          ? `${String(booking.startTime.getHours()).padStart(2, '0')}:${String(booking.startTime.getMinutes()).padStart(2, '0')}`
          : 'not set';
        changes.time = `${currentTime} → ${newTime}`;
      }
      if (notes !== undefined) {
        changes.notes = 'updated';
      }
      if (status) {
        changes.status = `${booking.status} → ${status}`;
      }

      // Determine operation description
      const hasScheduleChange = newDate || newTime;
      const operation = hasScheduleChange
        ? `Reschedule booking for ${sanitizeForContext(booking.customer?.name || 'Unknown', 30)}`
        : `Update booking for ${sanitizeForContext(booking.customer?.name || 'Unknown', 30)}`;

      const preview: Record<string, unknown> = {
        action: hasScheduleChange ? 'reschedule' : 'update',
        booking: `${sanitizeForContext(booking.package?.name || 'Unknown', 30)} - ${sanitizeForContext(booking.customer?.name || 'Unknown', 30)}`,
        currentDate: formatDateISO(booking.date),
        changes,
        customerNotification: notifyCustomer
          ? 'Customer will be notified of changes'
          : 'Customer will NOT be notified',
        preservedInfo: 'Payment status and customer details are preserved',
      };

      // T2 for all updates - payment status and customer info are preserved
      return createProposal(context, 'update_booking', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'update_booking',
        tenantId,
        `Failed to create update proposal for booking "${bookingId}". Verify the booking ID is correct and dates/times are properly formatted`
      );
    }
  },
};

/**
 * All write tools exported as array for registration
 */
/**
 * update_deposit_settings - Configure deposit requirements
 *
 * Trust Tier: T3 (hard confirm) - financial configuration changes
 */
export const updateDepositSettingsTool: AgentTool = {
  name: 'update_deposit_settings',
  trustTier: 'T3', // Hard confirm - financial configuration changes
  description:
    'Configure deposit requirements for bookings. Set percentage (0-100) or null for full payment.',
  inputSchema: {
    type: 'object',
    properties: {
      depositPercent: {
        type: 'number',
        description: 'Deposit percentage (0-100), or null for full payment upfront',
      },
      balanceDueDays: {
        type: 'number',
        description: 'Days before event that balance is due',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const depositPercent = params.depositPercent as number | null | undefined;
    const balanceDueDays = params.balanceDueDays as number | undefined;

    try {
      // Validate depositPercent if provided
      if (depositPercent !== null && depositPercent !== undefined) {
        if (depositPercent < 0 || depositPercent > 100) {
          return { success: false, error: 'Deposit percent must be between 0 and 100' };
        }
      }

      // Validate balanceDueDays if provided
      if (balanceDueDays !== undefined && balanceDueDays < 0) {
        return { success: false, error: 'Balance due days cannot be negative' };
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { depositPercent: true, balanceDueDays: true },
      });

      if (!tenant) {
        return { success: false, error: 'Unable to access business profile. Please try again.' };
      }

      const changes: string[] = [];
      const payload: Record<string, unknown> = {};

      if (depositPercent !== undefined) {
        payload.depositPercent = depositPercent;
        const currentPercent = tenant.depositPercent ? Number(tenant.depositPercent) : null;
        changes.push(
          `deposit: ${currentPercent ?? 'full payment'} → ${depositPercent ?? 'full payment'}%`
        );
      }

      if (balanceDueDays !== undefined) {
        payload.balanceDueDays = balanceDueDays;
        changes.push(
          `balance due: ${tenant.balanceDueDays ?? 'unset'} → ${balanceDueDays} days before`
        );
      }

      if (changes.length === 0) {
        return { success: false, error: 'No changes specified' };
      }

      const operation = `Update deposit settings`;
      const preview = {
        action: 'update_deposit_settings',
        changes,
      };

      return createProposal(context, 'update_deposit_settings', operation, 'T3', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'update_deposit_settings',
        tenantId,
        'Failed to create deposit settings proposal. Ensure deposit percent is 0-100 and balance due days is non-negative'
      );
    }
  },
};

/**
 * start_trial - Start 14-day trial
 *
 * Trust Tier: T2 (soft confirm)
 */
export const startTrialTool: AgentTool = {
  name: 'start_trial',
  trustTier: 'T2', // Soft confirm for trial start
  description:
    'Start a 14-day trial for the business. Only available if no trial has been started.',
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
        select: { subscriptionStatus: true, trialEndsAt: true },
      });

      if (!tenant) {
        return { success: false, error: 'Unable to access business profile. Please try again.' };
      }

      // Only allow starting trial if status is NONE
      if (tenant.subscriptionStatus !== 'NONE') {
        return {
          success: false,
          error: `Cannot start trial - current status is ${tenant.subscriptionStatus}`,
        };
      }

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const operation = 'Start 14-day trial';
      const payload = { trialEndsAt: trialEndsAt.toISOString() };
      const preview = {
        action: 'start_trial',
        trialEndsAt: formatDateISO(trialEndsAt),
        daysUntilExpiry: 14,
      };

      return createProposal(context, 'start_trial', operation, 'T2', payload, preview);
    } catch (error) {
      return handleToolError(
        error,
        'start_trial',
        tenantId,
        'Failed to create trial proposal. Trial can only be started if subscription status is NONE'
      );
    }
  },
};

/**
 * initiate_stripe_onboarding - Start Stripe Connect onboarding
 *
 * Trust Tier: T2 (soft confirm) - user will be redirected to Stripe
 */
export const initiateStripeOnboardingTool: AgentTool = {
  name: 'initiate_stripe_onboarding',
  trustTier: 'T2', // Soft confirm - user will be redirected to Stripe
  description:
    'Start Stripe Connect payment setup. If already connected, returns that status. Otherwise creates a connected account and returns the onboarding URL.',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Business owner email (optional, uses tenant email if not provided)',
      },
      businessName: {
        type: 'string',
        description: 'Business name (optional, uses tenant name if not provided)',
      },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const email = params.email as string | undefined;
    const businessName = params.businessName as string | undefined;

    try {
      // Check current Stripe status
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeOnboarded: true,
          stripeAccountId: true,
          email: true,
          name: true,
          slug: true,
        },
      });

      if (!tenant) {
        return { success: false, error: 'Unable to access business profile. Please try again.' };
      }

      // If already connected, return early
      if (tenant.stripeOnboarded) {
        return {
          success: true,
          data: {
            alreadyConnected: true,
            message: 'Stripe is already connected. You can accept payments.',
          },
        };
      }

      // Resolve email and business name from context if not provided
      const resolvedEmail = email || tenant.email;
      const resolvedBusinessName = businessName || tenant.name;

      if (!resolvedEmail) {
        return {
          success: false,
          error: 'Email is required. Please provide an email or add one to your tenant profile.',
        };
      }

      const operation = `Set up Stripe payments for ${sanitizeForContext(resolvedBusinessName || 'your business', 50)}`;
      const payload = {
        email: resolvedEmail,
        businessName: resolvedBusinessName,
        hasExistingAccount: !!tenant.stripeAccountId,
      };
      const preview = {
        action: tenant.stripeAccountId ? 'resume_onboarding' : 'start_onboarding',
        email: sanitizeForContext(resolvedEmail, 50),
        businessName: sanitizeForContext(resolvedBusinessName || 'Your Business', 50),
        note: 'You will be redirected to Stripe to complete payment setup.',
      };

      return createProposal(
        context,
        'initiate_stripe_onboarding',
        operation,
        'T2',
        payload,
        preview
      );
    } catch (error) {
      return handleToolError(
        error,
        'initiate_stripe_onboarding',
        tenantId,
        'Failed to initiate Stripe onboarding. Try again or contact support if the issue persists'
      );
    }
  },
};

export const writeTools: AgentTool[] = [
  upsertPackageTool,
  upsertAddOnTool,
  deleteAddOnTool,
  deletePackageTool,
  // Note: manageBlackoutTool removed - superseded by add/remove_blackout_date (TODO #452)
  addBlackoutDateTool,
  removeBlackoutDateTool,
  updateBrandingTool,
  updateLandingPageTool,
  requestFileUploadTool,
  cancelBookingTool,
  createBookingTool,
  processRefundTool,
  updateBookingTool,
  upsertSegmentTool,
  deleteSegmentTool,
  updateDepositSettingsTool,
  startTrialTool,
  initiateStripeOnboardingTool,
];
