---
title: Package Management Tools - Agent CRUD Pattern with ADK Workarounds
slug: package-management-tools-adk-discriminated-union-workaround
category: patterns
severity: P0
component: Agent Tools, Backend API, Package Database
symptoms:
  - Agent cannot create, update, or delete bookable service packages
  - Services section shows generic "$0/session" packages despite agent saying "Done"
  - User expectation mismatch between "edit pricing text" and "create bookable packages"
root_cause: |
  1. No tools existed for Package table CRUD (only landingPageConfigDraft JSON tools)
  2. Agent only had storefront tools that modify cosmetic pricing sections
  3. Services section renders from Package database table (different data source)
  4. Tried to use z.discriminatedUnion but ADK doesn't support it (pitfall #34)
solution_type: feature implementation with ADK workarounds
date_solved: 2026-02-01
time_to_solve: 4 hours (blocked by ADK schema limitations, then workaround implemented)
tags:
  - agent-tools
  - crud-operations
  - trust-tiers
  - adk-limitations
  - zod-validation
  - backend-api
  - multi-tenant
related_issues:
  - todos/811-pending-p1-missing-package-management-tools.md
  - docs/reports/2026-02-01-agent-testing-failure-report.md
related_docs:
  - docs/solutions/ui-bugs/preview-stale-package-prices-after-agent-creation.md
pitfalls_referenced:
  - '29: Discriminated unions unsupported in ADK'
  - '47: Tools return instructions instead of state'
  - '52: Tool confirmation-only response missing state'
  - '60: Dual-context prompt-only security'
  - '61: Context from user input'
  - '70: Missing Zod safeParse in agent tools'
  - '71: Over-engineering simple features'
---

# Package Management Tools: Agent CRUD Pattern with ADK Workarounds

## Problem

When a user said "Create my photography packages at $2,500 for elopements, $5,000 for full days," the agent could update cosmetic text sections but could NOT create actual bookable packages that appear in the Services section with "Book" buttons and functioning checkout flows.

**What happened in E2E testing (2026-02-01):**

```
User: "Help me set up my photography packages with pricing"
Agent: "I can help, but there's no tool to set up packages directly."
       (Later after user: "Update the services section...")
Agent: "Done. Take a look." ✓

Result: Preview still shows "Basic Package - $0/session"
```

**Why it failed:**

1. Agent only had storefront tools (`update_section`, `add_section`) that modify `landingPageConfigDraft` JSON
2. These create cosmetic text sections, NOT database records
3. Services section comes from `Package` table in database (completely different data source)
4. Agent confirmed success but visible result didn't match

## Root Cause Analysis

### Data Source Confusion

| Concept              | Storage                       | Agent Can Edit?       | Displays                                     |
| -------------------- | ----------------------------- | --------------------- | -------------------------------------------- |
| **Services Section** | `Package` table               | ❌ NO (missing tools) | Actual bookable packages with "Book" buttons |
| **Pricing Section**  | `landingPageConfigDraft` JSON | ✅ YES                | Text content only (cosmetic)                 |

When agent called `update_section(type="pricing")`, it modified landing page config. But Services section that shows packages comes from database - requires different tools.

### Technical Barriers

**ADK Schema Limitation (Pitfall #34):**

Initially tried to use Zod `z.discriminatedUnion()` for clean action routing:

```typescript
// ❌ DOESN'T WORK - ADK rejects it silently
const params = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string(), ... }),
  z.object({ action: z.literal('update'), packageId: z.string(), ... }),
  z.object({ action: z.literal('delete'), packageId: z.string(), ... }),
  z.object({ action: z.literal('list') }),
]);
```

**Why:** ADK's schema validation doesn't support complex Zod types. It needs flat objects and `z.any()` with `.describe()` for documentation.

## Solution Implemented

### 1. Agent Tool: Single Tool with Flat Schema + Runtime Validation

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/tenant/src/tools/packages.ts`

The key insight: Use flat Zod object with optional fields, then validate action-specific requirements at runtime in the switch statement.

```typescript
/**
 * Package Management Tools for Tenant Agent
 *
 * CRUD operations for bookable service packages.
 * These are the ACTUAL packages that appear in the Services section
 * and drive the booking flow - NOT the cosmetic "pricing section" text.
 */

import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { logger, callMaisApi, getTenantId } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema: Flat object with optional fields (ADK-compatible)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: ADK doesn't support z.discriminatedUnion (pitfall #34), so we use a
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
// Main Tool
// ─────────────────────────────────────────────────────────────────────────────

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
- "Update my Full Day package to $5,000"
- "Delete the Basic Package" (requires confirmation)

Price is in DOLLARS (e.g., 2500 = $2,500), not cents.`,

  parameters: ManagePackagesParams,

  execute: async (params, context: ToolContext | undefined) => {
    // ───────────────────────────────────────────────────────────────────────
    // 1. Validate parameters (pitfall #62, #70)
    // ───────────────────────────────────────────────────────────────────────
    const parseResult = ManagePackagesParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parseResult.error.message}`,
        suggestion: 'Check the action type and required fields.',
      };
    }

    const validParams = parseResult.data;

    // ───────────────────────────────────────────────────────────────────────
    // 2. Extract tenant ID (pitfall #60, #61 - use session, never user input)
    // ───────────────────────────────────────────────────────────────────────
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context available',
        suggestion: 'Session may have expired. Please refresh and try again.',
      };
    }

    logger.info({ action: validParams.action, tenantId }, '[TenantAgent] manage_packages');

    // ───────────────────────────────────────────────────────────────────────
    // 3. Route to handler with RUNTIME VALIDATION of action-specific fields
    // ───────────────────────────────────────────────────────────────────────
    switch (validParams.action) {
      case 'list':
        return handleListPackages(tenantId);

      case 'create': {
        // ✓ Runtime validation: Check required fields for this action
        if (!validParams.name || !validParams.description || !validParams.priceInDollars) {
          return {
            success: false,
            error: 'Create requires: name, description, and priceInDollars',
            suggestion:
              'Example: "Create a package called Elopement for $2,500 with 4 hours coverage"',
          };
        }
        // ✓ Business rule: No free packages
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
        // ✓ Runtime validation: Check required fields for this action
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
        // ✓ Runtime validation: Check required fields for this action
        if (!validParams.packageId) {
          return {
            success: false,
            error: 'Delete requires packageId. Use action: "list" first to see package IDs.',
          };
        }
        // ✓ T3 confirmation: Trust tier enforcement (pitfall #49)
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
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers: Each returns full state for agent verification (pitfall #52)
// ─────────────────────────────────────────────────────────────────────────────

async function handleListPackages(tenantId: string) {
  const result = await callMaisApi('/manage-packages', tenantId, {
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
    // ✓ State indicator for verification (pitfall #52)
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

  const result = await callMaisApi('/manage-packages', tenantId, {
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

  // ✓ Return full state for verification (pitfall #52)
  return {
    success: true,
    created: true,
    package: data.package,
    totalCount: data.totalCount,
    message: `Created "${data.package.name}" at $${data.package.priceInDollars.toLocaleString()}`,
    // Verification indicators for agent and frontend
    verificationSteps: [
      'Package created in database',
      'Should now appear in Services section',
      'Customers can book at the new price',
    ],
    // ✓ Dashboard action for frontend (pitfall #90)
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

  const result = await callMaisApi('/manage-packages', tenantId, updateData);

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

  // ✓ Return updated state for verification (pitfall #52)
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
  const result = await callMaisApi('/manage-packages', tenantId, {
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
```

### 2. Backend Route: Package Management API

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/internal-agent.routes.ts` (lines 2337-2535)

```typescript
const ManagePackagesSchema = TenantIdSchema.extend({
  action: z.enum(['list', 'create', 'update', 'delete']),
  // Create fields
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().min(100, 'Price must be at least $1 (100 cents)').optional(),
  // Update/Delete fields
  packageId: z.string().min(1).optional(),
});

/**
 * POST /manage-packages - Create, update, delete, or list packages
 *
 * IMPORTANT: This modifies ACTUAL bookable packages that:
 * - Appear in the Services section on the storefront
 * - Have "Book" buttons that lead to real checkout
 * - Must have price >= $1 (P0 fix for $0 booking path)
 *
 * Called by: Tenant Agent's manage_packages tool
 */
router.post('/manage-packages', async (req: Request, res: Response) => {
  try {
    const params = ManagePackagesSchema.parse(req.body);
    const { tenantId, action } = params;

    logger.info(
      { tenantId, action, endpoint: '/manage-packages' },
      '[Agent] Package management request'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Verify tenant exists (security: pitfall #1)
    // ──────────────────────────────────────────────────────────────────────────
    const tenant = await tenantRepo.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    switch (action) {
      case 'list': {
        const packages = await catalogService.getAllPackages(tenantId);
        const formatted = packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.title || pkg.name || 'Unnamed Package',
          description: pkg.description || '',
          priceInDollars: Math.round((pkg.priceCents || pkg.basePrice || 0) / 100),
          slug: pkg.slug,
          active: pkg.active !== false,
        }));

        res.json({
          packages: formatted,
          totalCount: formatted.length,
        });
        return;
      }

      case 'create': {
        // Validate required create fields
        if (!params.slug || !params.title || !params.priceCents) {
          res.status(400).json({
            error: 'Missing required fields for create: slug, title, priceCents',
          });
          return;
        }

        // ✓ P0 FIX: Enforce minimum price to prevent $0 booking path
        if (params.priceCents < 100) {
          res.status(400).json({
            error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
          });
          return;
        }

        const newPackage = await catalogService.createPackage(tenantId, {
          slug: params.slug,
          title: params.title,
          description: params.description || '',
          priceCents: params.priceCents,
        });

        // Get updated count for verification
        const allPackages = await catalogService.getAllPackages(tenantId);

        logger.info(
          { tenantId, packageId: newPackage.id, name: newPackage.title },
          '[Agent] Package created'
        );

        res.json({
          package: {
            id: newPackage.id,
            name: newPackage.title || newPackage.name,
            description: newPackage.description,
            priceInDollars: Math.round((newPackage.priceCents || newPackage.basePrice || 0) / 100),
            slug: newPackage.slug,
          },
          totalCount: allPackages.length,
        });
        return;
      }

      case 'update': {
        if (!params.packageId) {
          res.status(400).json({ error: 'packageId is required for update' });
          return;
        }

        // ✓ SECURITY: Verify package belongs to tenant (pitfall #816)
        const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
        if (!existingPkg) {
          res.status(404).json({ error: 'Package not found' });
          return;
        }

        // ✓ P0 FIX: Enforce minimum price if updating price
        if (params.priceCents !== undefined && params.priceCents < 100) {
          res.status(400).json({
            error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
          });
          return;
        }

        // Build update payload (only include provided fields)
        const updateData: {
          slug?: string;
          title?: string;
          description?: string;
          priceCents?: number;
        } = {};

        if (params.slug) updateData.slug = params.slug;
        if (params.title) updateData.title = params.title;
        if (params.description) updateData.description = params.description;
        if (params.priceCents !== undefined) updateData.priceCents = params.priceCents;

        const updatedPackage = await catalogService.updatePackage(
          tenantId,
          params.packageId,
          updateData
        );

        const allPackages = await catalogService.getAllPackages(tenantId);

        logger.info(
          { tenantId, packageId: updatedPackage.id, updates: Object.keys(updateData) },
          '[Agent] Package updated'
        );

        res.json({
          package: {
            id: updatedPackage.id,
            name: updatedPackage.title || updatedPackage.name,
            description: updatedPackage.description,
            priceInDollars: Math.round(
              (updatedPackage.priceCents || updatedPackage.basePrice || 0) / 100
            ),
            slug: updatedPackage.slug,
          },
          totalCount: allPackages.length,
        });
        return;
      }

      case 'delete': {
        if (!params.packageId) {
          res.status(400).json({ error: 'packageId is required for delete' });
          return;
        }

        // ✓ SECURITY: Verify package belongs to tenant (pitfall #816)
        const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
        if (!existingPkg) {
          res.status(404).json({ error: 'Package not found' });
          return;
        }

        await catalogService.deletePackage(tenantId, params.packageId);

        const remainingPackages = await catalogService.getAllPackages(tenantId);

        logger.info({ tenantId, deletedPackageId: params.packageId }, '[Agent] Package deleted');

        res.json({
          deletedId: params.packageId,
          totalCount: remainingPackages.length,
        });
        return;
      }

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    handleError(res, error, '/manage-packages');
  }
});
```

### 3. Tool Registration

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/tenant/src/tools/index.ts`

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Package Management Tools (T1/T2/T3) - P0 Fix for E2E Failures
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: These manage ACTUAL bookable packages (Package table), NOT the
// cosmetic "pricing section" in landingPageConfigDraft. This addresses the
// core E2E failure where agent said "Done" but Services section showed $0.
//
// @see docs/reports/2026-02-01-agent-testing-failure-report.md
// @see todos/811-pending-p1-missing-package-management-tools.md
// ─────────────────────────────────────────────────────────────────────────────

export { managePackagesTool } from './packages.js';
```

### 4. System Prompt Clarification

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (lines 109-127)

```typescript
| "Add a package", "Create a service", "I offer X for $Y" | Bookable service with Book button | manage_packages(action: "create") |

**manage_packages** creates REAL packages that:
- Appear in the Services section with "Book" buttons
- Users can add to cart and checkout
- Appear in customer-facing booking flow
- Are NOT the same as the "Pricing" text section

**If ambiguous:** Ask ONE question: "Create a new bookable package, or just update the pricing text on your site?"

Examples:
- "Add Elopement Package at $2,500" → manage_packages(action: "create", name: "Elopement Package", priceInDollars: 2500, description: "...")
- "I want to offer wedding photography for $3,000" → manage_packages (they're describing a real service)
```

## Key Implementation Details

### ADK Compatibility Workaround

| Issue                   | Problem                                          | Solution                                                         |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| **Discriminated Union** | ADK doesn't support `z.discriminatedUnion()`     | Use flat object with optional fields + runtime switch validation |
| **Action Routing**      | Need conditional required fields                 | Validate in switch statement: `if (!params.name) return error`   |
| **Trust Tiers**         | Different security levels per action             | T1 (list), T2 (create/update), T3 (delete with confirmation)     |
| **State Return**        | Tool must return updated state, not just success | Include `package`, `totalCount`, `verificationSteps` in response |

### Trust Tier Enforcement

```typescript
// T1: List (execute immediately, read-only)
case 'list':
  return handleListPackages(tenantId);

// T2: Create/Update (show preview)
case 'create':
case 'update':
  return handleCreatePackage(...);

// T3: Delete (requires confirmation)
case 'delete':
  if (!validParams.confirmationReceived) {
    return { success: false, requiresConfirmation: true };
  }
  return handleDeletePackage(...);
```

### Multi-Tenant Security (Pitfall #1)

```typescript
// ✓ ALWAYS scope by tenantId
const packages = await catalogService.getAllPackages(tenantId);

// ✓ Verify ownership before mutations
const existingPkg = await catalogService.getPackageById(tenantId, params.packageId);
if (!existingPkg) {
  res.status(404).json({ error: 'Package not found' });
  return;
}
```

### Price Validation (P0 Fix)

```typescript
// ✓ NO free packages - minimum $1
if (params.priceCents < 100) {
  res.status(400).json({
    error: 'Price must be at least $1 (100 cents). Free packages are not allowed.',
  });
  return;
}
```

### State Return Pattern (Pitfall #52)

Instead of:

```typescript
// ❌ WRONG - Agent loses context, asks redundant questions
return { success: true };
```

Return full state for verification:

```typescript
// ✓ CORRECT - Agent can confirm result and continue
return {
  success: true,
  created: true,
  package: { id, name, description, priceInDollars, slug },
  totalCount: 3,
  message: 'Created "Elopement Package" at $2,500',
  verificationSteps: [
    'Package created in database',
    'Should now appear in Services section',
    'Customers can book at the new price',
  ],
};
```

### Dashboard Action (Pitfall #90)

Frontend extracts and processes dashboard actions:

```typescript
dashboardAction: {
  type: 'NAVIGATE',
  section: 'scheduling',
  subSection: 'appointment-types',
}
```

In `apps/web/src/components/agent/AgentPanel.tsx`:

```typescript
if (call.result?.dashboardAction) {
  const action = call.result.dashboardAction;
  if (action.type === 'NAVIGATE') {
    handleNavigation(action.section, action.subSection);
  }
}
```

## Deployment

### Backend (Render)

```bash
# Auto-deploys on push to main
# Check: https://dashboard.render.com (backend logs)
```

### Agent (Cloud Run)

```bash
# Manual deploy from tenant-agent directory
cd server/src/agent-v2/deploy/tenant
npm run deploy

# Or via GitHub Actions
# Check: GitHub Actions → Deploy AI Agents to Cloud Run
```

### Verify Deployment

```bash
# Check service is running
gcloud run services list --project=handled-484216 | grep tenant-agent

# Check tool is registered
curl https://tenant-agent-506923455711.us-central1.run.app/tools
# Should include: manage_packages
```

## Prevention Strategies

### 1. When Adding New Agent Tools

**Checklist:**

- [ ] Does this modify database records (not just JSON config)?
  - YES → Implement backend route that calls service layer
  - NO → Modify draft config only
- [ ] Does it need different trust tiers?
  - YES → Use flat schema + switch validation pattern
  - NO → Single action tool
- [ ] Does it modify state that backend will read?
  - YES → Return full updated state in result
  - NO → Return success indicator only
- [ ] Does it work with multiple tenants?
  - ALWAYS → Verify tenant ownership, filter by tenantId

### 2. ADK Schema Anti-Pattern Detection

```
If using z.discriminatedUnion → ❌ WILL FAIL
If using z.record() → ❌ WILL FAIL
If using z.tuple() → ❌ WILL FAIL
If using z.intersection() → ❌ WILL FAIL
If using z.lazy() → ❌ WILL FAIL

If using z.object() with optional fields + describe() → ✅ WORKS
```

### 3. Tool Result State Pattern

```typescript
// ❌ ANTI-PATTERN: Tool returns instruction, loses state
return { success: true, instruction: 'Agent should verify the package was created' };

// ✓ PATTERN: Tool returns full state for agent verification
return {
  success: true,
  created: true,
  package: { id, name, priceInDollars },
  totalCount: 3,
  message: 'Created "Elopement Package" at $2,500',
  verificationSteps: [...],
  dashboardAction: { type: 'NAVIGATE', ... },
};
```

## Testing

### Manual Test: Create Package

```
1. Navigate to https://www.gethandled.ai/login
2. Login as tenant
3. Open agent chat
4. Say: "Create a package called 'Elopement Package' priced at $2,500 with 4 hours of coverage"
5. Verify: Package appears in Services section with correct name/price
6. Verify: Database Package table has new record with tenantId, title, priceCents
```

### E2E Test Coverage

```typescript
test('manage_packages creates actual bookable packages', async ({ page }) => {
  // 1. Start agent session
  const sessionId = await startAgentSession(tenantId);

  // 2. Create package via agent
  const response = await agentMessage(
    sessionId,
    'Create a package called Elopement for $2500 with 4 hours'
  );

  // 3. Verify tool was called
  expect(response.toolCalls).toContainEqual({
    toolName: 'manage_packages',
    params: {
      action: 'create',
      name: 'Elopement',
      priceInDollars: 2500,
      // ...
    },
  });

  // 4. Verify database record created
  const packages = await db.package.findMany({ where: { tenantId } });
  expect(packages).toContainEqual(
    expect.objectContaining({
      tenantId,
      title: 'Elopement',
      priceCents: 250000,
    })
  );

  // 5. Verify UI reflection (after preview refresh)
  await page.goto(`/t/${tenantSlug}`);
  const serviceCard = page.locator('text=Elopement');
  await expect(serviceCard).toBeVisible();
  await expect(page.locator('text=$2,500')).toBeVisible();
});
```

## Related Pitfalls

- **Pitfall #34:** Unsupported Zod types in ADK (z.discriminatedUnion, z.record, etc.)
- **Pitfall #49:** T3 without confirmation parameter (enforce programmatically)
- **Pitfall #52:** Tool confirmation-only response missing state (return full updated object)
- **Pitfall #60:** Dual-context prompt-only security (use requireContext() guard)
- **Pitfall #62:** Type assertion without validation (use safeParse as FIRST LINE)
- **Pitfall #70:** Missing Zod safeParse in agent tools (always safeParse params first)
- **Pitfall #88:** Fact-to-Storefront bridge missing (must call BOTH store fact AND apply tool)
- **Pitfall #90:** dashboardAction not extracted from tool results (frontend must detect and process)

## References

- **Failure Report:** `docs/reports/2026-02-01-agent-testing-failure-report.md`
- **Todo:** `todos/811-pending-p1-missing-package-management-tools.md`
- **Preview Refresh:** `docs/solutions/ui-bugs/preview-stale-package-prices-after-agent-creation.md`
- **ADK Docs:** `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`
- **Tool Patterns:** `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
