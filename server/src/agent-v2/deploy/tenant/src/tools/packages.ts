/**
 * Package Management Tools for Tenant Agent
 *
 * CRUD operations for bookable service packages.
 * These are the ACTUAL packages that appear in the Services section
 * and drive the booking flow - NOT the cosmetic "pricing section" text.
 *
 * Trust Tiers:
 * - list: T1 (read-only, execute immediately)
 * - create: T2 (creates database record, show preview)
 * - update: T2 (modifies database record, show preview)
 * - delete: T3 (requires explicit confirmation)
 *
 * CRITICAL: This addresses the core E2E failure where agent said "Done"
 * but Services section still showed generic $0 packages.
 *
 * @see docs/reports/2026-02-01-agent-testing-failure-report.md
 * @see todos/811-pending-p1-missing-package-management-tools.md
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { logger, callMaisApi, requireTenantId, validateParams, wrapToolExecute } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema for Package Management
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: ADK doesn't support z.discriminatedUnion (pitfall #30), so we use a
// flat object with optional fields and validate action-specific requirements
// at runtime in the execute function.

const ManagePackagesParams = z.object({
  action: z
    .enum(['list', 'create', 'update', 'delete'])
    .describe('The operation to perform on packages'),
  // For create/update
  name: z
    .string()
    .optional()
    .describe('Package name (e.g., "Elopement Package"). Required for create.'),
  description: z
    .string()
    .optional()
    .describe('What is included in this package. Required for create.'),
  priceInDollars: z
    .number()
    .optional()
    .describe('Price in dollars (e.g., 2500 for $2,500). Required for create.'),
  duration: z.string().optional().describe('Duration description (e.g., "4 hours"). Optional.'),
  // For update/delete
  packageId: z
    .string()
    .optional()
    .describe('ID of the package to update or delete. Required for update/delete.'),
  // For delete (T3 confirmation)
  confirmationReceived: z
    .boolean()
    .optional()
    .describe('Must be true to confirm deletion - this is destructive!'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate slug from name
// ─────────────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage Packages Tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manage Packages Tool
 *
 * Create, update, delete, or list bookable service packages.
 *
 * IMPORTANT: This modifies ACTUAL packages that:
 * - Appear in the Services section on the storefront
 * - Have "Book" buttons that lead to real checkout
 * - Must have price > $0 (no free packages allowed without explicit flag)
 *
 * This is DIFFERENT from update_section(type="pricing") which only
 * updates cosmetic marketing text.
 */
export const managePackagesTool = new FunctionTool({
  name: 'manage_packages',
  description: `Create, update, delete, or list your bookable service packages.

IMPORTANT: This manages ACTUAL packages that appear in your Services section with "Book" buttons.
This is DIFFERENT from the "pricing section" which is just marketing text.

Actions:
- list: See all your current packages
- create: Add a new bookable package (requires name, description, price)
- update: Modify an existing package (requires packageId)
- delete: Remove a package (requires packageId AND confirmationReceived: true)

Examples:
- "Create a package called 'Elopement Package' for $2,500 with 4 hours coverage"
  → manage_packages(action: "create", name: "Elopement Package", description: "4 hours of coverage...", priceInDollars: 2500)

- "Update my Full Day package to $5,000"
  → manage_packages(action: "update", packageId: "pkg_xxx", priceInDollars: 5000)

- "Delete the Basic Package"
  → manage_packages(action: "delete", packageId: "pkg_xxx", confirmationReceived: true)

Price is in DOLLARS (e.g., 2500 = $2,500), not cents.`,

  parameters: ManagePackagesParams,

  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(ManagePackagesParams, params);
    const tenantId = requireTenantId(context);

    logger.info({ action: validParams.action, tenantId }, '[TenantAgent] manage_packages');

    // -------------------------------------------------------------------------
    // 3. Route to appropriate action handler with runtime validation
    // -------------------------------------------------------------------------
    switch (validParams.action) {
      case 'list':
        return handleListPackages(tenantId);

      case 'create': {
        // Validate required fields for create
        if (!validParams.name || !validParams.description || !validParams.priceInDollars) {
          return {
            success: false,
            error: 'Create requires: name, description, and priceInDollars',
            suggestion:
              'Example: "Create a package called Elopement for $2,500 with 4 hours coverage"',
          };
        }
        if (validParams.priceInDollars < 1) {
          return {
            success: false,
            error: 'Price must be at least $1',
          };
        }
        return handleCreatePackage(tenantId, {
          name: validParams.name,
          description: validParams.description,
          priceInDollars: validParams.priceInDollars,
          duration: validParams.duration,
        });
      }

      case 'update': {
        if (!validParams.packageId) {
          return {
            success: false,
            error: 'Update requires packageId. Use action: "list" first to see package IDs.',
          };
        }
        return handleUpdatePackage(tenantId, {
          packageId: validParams.packageId,
          name: validParams.name,
          description: validParams.description,
          priceInDollars: validParams.priceInDollars,
        });
      }

      case 'delete': {
        if (!validParams.packageId) {
          return {
            success: false,
            error: 'Delete requires packageId. Use action: "list" first to see package IDs.',
          };
        }
        if (!validParams.confirmationReceived) {
          return {
            success: false,
            error: 'Delete requires confirmationReceived: true (this is destructive)',
            requiresConfirmation: true,
          };
        }
        return handleDeletePackage(tenantId, {
          packageId: validParams.packageId,
        });
      }

      default:
        return {
          success: false,
          error: 'Unknown action. Use: list, create, update, or delete',
        };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleListPackages(tenantId: string) {
  const result = await callMaisApi('/content-generation/manage-packages', tenantId, {
    action: 'list',
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      suggestion: 'Could not retrieve packages. Try again.',
    };
  }

  const data = result.data as {
    packages: Array<{
      id: string;
      name: string;
      description: string;
      priceInDollars: number;
      slug: string;
      active: boolean;
    }>;
    totalCount: number;
  };

  return {
    success: true,
    packages: data.packages,
    totalCount: data.totalCount,
    message:
      data.totalCount > 0
        ? `You have ${data.totalCount} package(s): ${data.packages.map((p) => p.name).join(', ')}`
        : 'No packages yet. Create one with action: "create".',
    // State indicator for verification
    hasPackages: data.totalCount > 0,
  };
}

async function handleCreatePackage(
  tenantId: string,
  params: { name: string; description: string; priceInDollars: number; duration?: string }
) {
  // Convert dollars to cents for backend
  const priceCents = Math.round(params.priceInDollars * 100);

  // Generate slug from name
  const slug = slugify(params.name);

  // Build description with duration if provided
  const description = params.duration
    ? `${params.description} (${params.duration})`
    : params.description;

  const result = await callMaisApi('/content-generation/manage-packages', tenantId, {
    action: 'create',
    slug,
    title: params.name,
    description,
    priceCents,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      suggestion: 'Package could not be created. Check if a package with this name already exists.',
    };
  }

  const data = result.data as {
    package: {
      id: string;
      name: string;
      description: string;
      priceInDollars: number;
      slug: string;
    };
    totalCount: number;
  };

  // Return full state for verification (pitfall #48)
  return {
    success: true,
    created: true,
    package: data.package,
    totalCount: data.totalCount,
    message: `Created "${data.package.name}" at $${data.package.priceInDollars.toLocaleString()}`,
    // Verification: Agent can confirm this appears in Services section
    verificationSteps: [
      'Package created in database',
      'Should now appear in Services section',
      'Customers can book at the new price',
    ],
    // Dashboard action to show result
    dashboardAction: {
      type: 'NAVIGATE',
      section: 'scheduling',
      subSection: 'appointment-types',
    },
  };
}

async function handleUpdatePackage(
  tenantId: string,
  params: { packageId: string; name?: string; description?: string; priceInDollars?: number }
) {
  // Build update payload (only include provided fields)
  const updateData: Record<string, unknown> = {
    action: 'update',
    packageId: params.packageId,
  };

  if (params.name) {
    updateData.title = params.name;
    updateData.slug = slugify(params.name);
  }
  if (params.description) {
    updateData.description = params.description;
  }
  if (params.priceInDollars !== undefined) {
    updateData.priceCents = Math.round(params.priceInDollars * 100);
  }

  const result = await callMaisApi('/content-generation/manage-packages', tenantId, updateData);

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      suggestion: 'Package could not be updated. Verify the packageId exists.',
    };
  }

  const data = result.data as {
    package: {
      id: string;
      name: string;
      description: string;
      priceInDollars: number;
      slug: string;
    };
    totalCount: number;
  };

  // Return updated state for verification (pitfall #48)
  return {
    success: true,
    updated: true,
    package: data.package,
    message: `Updated "${data.package.name}" - now $${data.package.priceInDollars.toLocaleString()}`,
    verificationSteps: [
      'Package updated in database',
      'Services section will show new details',
      'Booking flow will use new price',
    ],
    dashboardAction: {
      type: 'NAVIGATE',
      section: 'scheduling',
      subSection: 'appointment-types',
    },
  };
}

async function handleDeletePackage(tenantId: string, params: { packageId: string }) {
  // Note: T3 confirmation check is done in the switch statement before calling this handler

  const result = await callMaisApi('/content-generation/manage-packages', tenantId, {
    action: 'delete',
    packageId: params.packageId,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      suggestion: 'Package could not be deleted. It may not exist or may have active bookings.',
    };
  }

  const data = result.data as {
    deletedId: string;
    totalCount: number;
  };

  return {
    success: true,
    deleted: true,
    deletedId: data.deletedId,
    remainingCount: data.totalCount,
    message: `Package deleted. You now have ${data.totalCount} package(s).`,
    verificationSteps: [
      'Package removed from database',
      'Will no longer appear in Services section',
      'Existing bookings for this package are preserved',
    ],
    dashboardAction: {
      type: 'NAVIGATE',
      section: 'scheduling',
      subSection: 'appointment-types',
    },
  };
}
