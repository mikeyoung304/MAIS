# Agent Tools Action Parity - Prevention Strategies

**Status:** Complete Prevention Pattern
**Severity:** P2 (Agent-Native Architecture)
**Last Updated:** 2026-01-05
**Related:** P2 Fixes #643, #644

## Problem Statement

Agents can perform actions in UI but lack corresponding agent tools, creating incomplete action parity:

```
UI Action: "List all availability rules" → /api/tenant-admin/availability-rules (GET)
Agent Tool: Missing get_availability_rules tool
Result: Agent cannot ask about current rules

UI Action: "Delete photo from package" → /api/tenant-admin/packages/:id/photos/:filename (DELETE)
Agent Tool: Missing delete_package_photo tool
Result: Agent cannot help with photo management
```

**Consequences:**

- Agent incomplete vs. UI capabilities (breaks agent-native principle)
- User guidance gaps (agent suggests action it can't perform)
- Inconsistent onboarding experience
- Poor agent usefulness perception

**Core principle:** Whatever the user can do via UI, the agent must be able to do via tools.

## Prevention Strategies

### 1. Capability Parity Audit

**When adding UI features:**

```markdown
New UI Endpoint Added
├─ [ ] GET /api/... (read) → Agent needs read*\* tool
├─ [ ] POST /api/... (create) → Agent needs create*\_ or upsert\__ tool
├─ [ ] PUT /api/... (update) → Agent needs update*\* or manage*_ tool
├─ [ ] DELETE /api/... (delete) → Agent needs delete\_\_ tool
└─ [ ] Tool implemented? → If not, create TODA todo

Tool Implementation Checklist
├─ [ ] Tool defined in server/src/agent/tools/
├─ [ ] Tool exported in all-tools.ts (via readTools or writeTools export)
├─ [ ] Tool has correct trustTier (T1 for read, T2/T3 for write)
├─ [ ] Tool validates tenantId (security)
├─ [ ] Write tools have executor registered
└─ [ ] Executor added to REQUIRED_EXECUTOR_TOOLS
```

### 2. Read Tools (T1 - Auto-Confirm)

**Pattern for read tools:**

```typescript
// File: server/src/agent/tools/read-tools.ts

export const getAvailabilityRulesTool: AgentTool = {
  trustTier: 'T1', // Read-only, no user confirmation needed
  name: 'get_availability_rules',
  description:
    'Get all availability rules for the tenant, optionally filtered by service or day of week',
  inputSchema: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string',
        description: 'Optional service ID to filter rules by specific service',
      },
      dayOfWeek: {
        type: 'integer',
        description: 'Optional day (0=Sunday, 6=Saturday) to filter rules for specific day',
      },
    },
    required: [],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma, input } = context;

    try {
      const rules = await prisma.availabilityRule.findMany({
        where: {
          tenantId,
          ...(input.serviceId && { serviceId: input.serviceId }),
          ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
        },
        include: {
          service: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      return {
        success: true,
        data: {
          rules: rules.map((r) => ({
            id: r.id,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
            isAvailable: r.isAvailable,
            service: r.service?.name || 'Default (all services)',
          })),
          count: rules.length,
        },
      };
    } catch (error) {
      logger.error({ error: sanitizeError(error), tenantId }, 'Error fetching availability rules');
      return {
        success: false,
        error: 'Failed to fetch availability rules',
      };
    }
  },
};
```

**Export pattern:**

```typescript
// At end of read-tools.ts

export const readTools = [
  getTenantTool,
  getPackagesTool,
  getBlackoutDatesTool,
  getAvailabilityRulesTool, // ← Add new read tool
  // ... other tools
] as const;
```

### 3. Write Tools (T2 - Soft Confirm)

**Pattern for write tools:**

```typescript
// File: server/src/agent/tools/write-tools.ts

export const deletePackagePhotoTool: AgentTool = {
  trustTier: 'T2', // Soft confirm (reversible via re-upload)
  name: 'delete_package_photo',
  description: 'Delete a photo from a package. User confirms before execution.',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'The package ID (required)',
      },
      filename: {
        type: 'string',
        description: 'The photo filename to delete',
      },
    },
    required: ['packageId', 'filename'],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, input } = context;

    try {
      // Verify package ownership
      const pkg = await context.prisma.package.findFirst({
        where: {
          id: input.packageId,
          tenantId,
        },
      });

      if (!pkg) {
        return { success: false, error: 'Package not found' };
      }

      // Return proposal for soft confirmation
      return {
        success: true,
        requiresApproval: true,
        proposal: {
          action: 'delete_package_photo',
          packageId: input.packageId,
          filename: input.filename,
          description: `Delete photo "${input.filename}" from package "${pkg.name}"`,
        },
      };
    } catch (error) {
      logger.error({ error: sanitizeError(error), tenantId }, 'Error deleting photo');
      return {
        success: false,
        error: 'Failed to delete photo',
      };
    }
  },
};
```

**Executor pattern:**

```typescript
// File: server/src/agent/executors/package-executors.ts

import { registerProposalExecutor } from '../proposals/executor-registry';

export async function deletePackagePhotoExecutor(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { packageId, filename } = payload;

  if (typeof packageId !== 'string' || typeof filename !== 'string') {
    throw new Error('Invalid payload: packageId and filename required');
  }

  // Verify ownership again (defense-in-depth)
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, tenantId },
  });

  if (!pkg) {
    throw new Error('Package not found');
  }

  // Delete from storage
  await uploadService.deleteFile(tenantId, `packages/${packageId}/${filename}`);

  // Update package.photos JSON array
  const photos = (pkg.photos || []).filter((p: string) => p !== filename);
  await prisma.package.update({
    where: { id: packageId },
    data: { photos },
  });

  // Invalidate cache
  await cacheService.invalidate(`tenant:${tenantId}:packages:${packageId}`);

  return {
    success: true,
    message: `Photo deleted: ${filename}`,
  };
}

// Register executor
registerProposalExecutor('delete_package_photo', deletePackagePhotoExecutor);
```

**Register in executor registry:**

```typescript
// File: server/src/agent/proposals/executor-registry.ts

const REQUIRED_EXECUTOR_TOOLS = [
  // ... existing tools ...
  'delete_package_photo', // ← Add here
  // ... other tools ...
] as const;
```

### 4. Audit All UI Endpoints

**Systematic check for missing tools:**

```bash
#!/bin/bash
# scripts/check-agent-tool-coverage.sh

# Extract all API endpoints from routes
echo "=== API Endpoints ==="
grep -r "method: 'GET'" server/src/routes --include="*.ts" | \
  sed "s/.*'GET',.*'\([^']*\)'.*/\1/" | sort -u > /tmp/api-endpoints.txt

# Extract all agent tools
echo "=== Agent Tools ==="
grep -r "name: '" server/src/agent/tools --include="*.ts" | \
  sed "s/.*name: '\([^']*\)'.*/\1/" | sort -u > /tmp/agent-tools.txt

# Find missing tools
echo "=== Checking Coverage ==="
while read endpoint; do
  tool_needed=$(echo $endpoint | sed 's|.*\([a-z_]*\).*|get_\1|')
  if ! grep -q "$tool_needed" /tmp/agent-tools.txt; then
    echo "WARNING: Endpoint $endpoint may need tool $tool_needed"
  fi
done < /tmp/api-endpoints.txt
```

### 5. Tool Naming Conventions

**Consistent naming for discoverability:**

| Pattern     | Examples                                  | Use Case                 |
| ----------- | ----------------------------------------- | ------------------------ |
| `get_*`     | `get_tenant`, `get_availability_rules`    | Read operations (T1)     |
| `create_*`  | `create_booking`, `create_segment`        | Insert operations (T2)   |
| `upsert_*`  | `upsert_package`, `upsert_addon`          | Insert or update (T2)    |
| `update_*`  | `update_branding`, `update_landing_page`  | Update operations (T2)   |
| `delete_*`  | `delete_package`, `delete_package_photo`  | Delete operations (T2)   |
| `manage_*`  | `manage_blackout`, `manage_working_hours` | Complex multi-step (T2)  |
| `*_request` | `request_file_upload`                     | Request user action (T2) |

### 6. Code Review Checklist

**When reviewing agent features:**

```markdown
New Agent Tool Review

Tool Definition
├─ [ ] Tool defined in correct file (read-tools, write-tools, etc.)
├─ [ ] Tool name follows convention (get*, create*, delete\_, etc.)
├─ [ ] Description is clear and user-facing
├─ [ ] Input schema is complete and documented
├─ [ ] trustTier appropriate (T1 for read, T2+ for write)
└─ [ ] tenantId validated (security)

Tool Registration
├─ [ ] Tool exported from tools file
├─ [ ] Tool listed in readTools or writeTools array
├─ [ ] Tool registered in all-tools.ts or tools/index.ts
└─ [ ] Build succeeds after adding tool

Write Tool Only
├─ [ ] Executor function created
├─ [ ] Executor registered in executor-registry.ts
├─ [ ] Tool name added to REQUIRED_EXECUTOR_TOOLS
├─ [ ] Server startup validates executor exists
└─ [ ] Cache invalidation called after execution

Action Parity Check
├─ [ ] Corresponding UI endpoint exists?
├─ [ ] UI and tool use same business logic?
├─ [ ] Tool supports all UI filtering options?
├─ [ ] Tool response includes needed data?
└─ [ ] UI and agent can both do same action?
```

### 7. Testing Tool Coverage

**E2E test for tool availability:**

```typescript
test('agent tools support all tenant admin actions', async () => {
  // Get all tools
  const tools = await getAllTools();
  const toolNames = tools.map((t) => t.name);

  // Check required tools exist
  const requiredTools = [
    'get_availability_rules', // Read
    'delete_package_photo', // Write
    'manage_working_hours', // Complex
  ];

  requiredTools.forEach((tool) => {
    expect(toolNames).toContain(tool);
  });

  // Get all UI endpoints
  const endpoints = [
    '/api/tenant-admin/availability-rules',
    '/api/tenant-admin/packages/:id/photos/:filename',
  ];

  // For each endpoint, verify corresponding tool
  const endpointToTool = {
    '/api/tenant-admin/availability-rules': 'get_availability_rules',
    'DELETE /api/tenant-admin/packages/:id/photos/:filename': 'delete_package_photo',
  };

  Object.entries(endpointToTool).forEach(([endpoint, tool]) => {
    expect(toolNames).toContain(tool);
  });
});
```

## Related Files

**Source implementations:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/read-tools.ts` - Read tool examples (get_tenant, get_blackout_dates)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts` - Write tool examples (upsert_package, delete_package)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/proposals/executor-registry.ts` - Executor registration and validation

**Documentation:**

- `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md` - Master index for agent patterns
- `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md` - Circular dependency fix
- `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md` - Zod schemas, draft system

## Key Takeaways

1. **Action parity is non-negotiable** - If UI can do it, agent must too
2. **Read tools are T1** - Automatic approval, no user confirmation
3. **Write tools are T2 minimum** - User sees proposal before execution
4. **Executors required for T2+** - Must register in executor-registry.ts
5. **Naming matters** - get*\*, create*\_, delete\_\_ for discoverability

## FAQ

**Q: Can I add a read tool without executor?**
A: Yes. Read tools (T1) don't need executors - they just return data.

**Q: Do I need executor for every write tool?**
A: Yes. All write tools (T2/T3) need executors in executor-registry.ts.

**Q: What if tool is complex (multi-step)?**
A: Use manage\_\* pattern (e.g., manage_booking_link) with detailed inputSchema.

**Q: Should tool match UI endpoint exactly?**
A: Not exactly - tools can combine multiple endpoints or provide higher-level abstractions. But overall capability must match.

**Q: How to handle tool with many parameters?**
A: Keep inputSchema focused. Complex operations → manage\_\* pattern with clear descriptions.
