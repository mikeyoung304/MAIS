---
status: pending
priority: p1
issue_id: 811
tags: [code-review, agent, architecture, feature-gap, e2e-testing]
dependencies: []
---

# Missing Package Management Tools in Tenant-Agent (CRITICAL)

## Problem Statement

The tenant-agent cannot create, update, or delete bookable service packages. When a user asks "Help me set up my photography packages," the agent can only edit cosmetic text sections (landingPageConfigDraft JSON), NOT the actual Package database records that drive the booking flow.

**Why it matters:**

- Photographers expect to set up packages conversationally
- Agent says "Done. Take a look" but Services section still shows generic "$0/session" packages
- This is a **core value proposition failure** for HANDLED ("The rest is Handled")
- E2E testing on 2026-02-01 confirmed the gap

## Findings

**From Architecture Agent:**

> The `CatalogRepository` interface in `/server/src/lib/ports.ts` (lines 16-58) already has full CRUD methods: `createPackage`, `updatePackage`, `deletePackage`. The backend infrastructure exists, but no agent tools expose it.

**From Agent Patterns Agent:**

> The tenant-agent currently has 10 tool files, but NONE handle Package table CRUD. All storefront tools modify `landingPageConfigDraft` JSON, not database records.

**From E2E Failure Report:**

```
User: "Update the services section with my three packages and their pricing"
Agent: "Done. Take a look." (with Storefront ✓ indicators)
Actual result: Preview still shows generic packages with $0 pricing.
```

**Root Cause:** Agent calls `update_section(type="pricing")` which updates a TEXT section in draft config. The Services section that shows "Basic Package $0" comes from the `Package` database table - a completely different data source.

## Proposed Solutions

### Option A: Single `manage_packages` Tool (Recommended)

**Pros:**

- Follows simplicity principle (pitfall #71 - don't over-engineer)
- One tool with `action` discriminator handles all CRUD
- Less cognitive load for LLM (fewer tools to choose from)
- Pattern exists: `callMaisApi()` + internal route

**Cons:**

- Slightly more complex Zod schema (discriminatedUnion)

**Effort:** Medium (2-4 hours)
**Risk:** Low

**Implementation:**

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/packages.ts
export const managePackagesTool = new FunctionTool({
  name: 'manage_packages',
  description: 'Create, update, delete, or list service packages for your business',
  parameters: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('create'),
      name: z.string(),
      price: z.number(),
      description: z.string(),
    }),
    z.object({
      action: z.literal('update'),
      packageId: z.string(),
      name: z.string().optional(),
      price: z.number().optional(),
    }),
    z.object({ action: z.literal('delete'), packageId: z.string() }),
    z.object({ action: z.literal('list') }),
  ]),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { success: false, error: 'No tenant context' };
    return await callMaisApi('/manage-packages', tenantId, params);
  },
});
```

### Option B: Four Separate Tools

**Pros:**

- Simpler individual tool schemas
- Explicit trust tier per operation (T1 list, T2 create/update, T3 delete)

**Cons:**

- Over-engineered per pitfall #71
- More tools for LLM to reason about
- 80% code duplication

**Effort:** Medium (3-5 hours)
**Risk:** Medium (hallucination surface area)

## Recommended Action

Implement Option A with these steps:

1. Create `server/src/agent-v2/deploy/tenant/src/tools/packages.ts` with single `managePackagesTool`
2. Add `POST /v1/internal/agent/manage-packages` route to `internal-agent.routes.ts`
3. Route handler calls existing `CatalogService` methods with tenant scoping
4. Export tool from `tools/index.ts`
5. Add T2/T3 trust tier handling for mutations
6. Deploy tenant-agent

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/tools/packages.ts` (NEW)
- `server/src/agent-v2/deploy/tenant/src/tools/index.ts` (ADD EXPORT)
- `server/src/routes/internal-agent.routes.ts` (ADD ROUTE)
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (CLARIFY capability)

**Existing infrastructure to reuse:**

- `CatalogService.createPackage()`, `updatePackage()`, `deletePackage()`, `getAllPackages()`
- `callMaisApi()` utility in utils.ts
- `getTenantId()` 4-tier defensive extraction
- Zod validation patterns from `storefront-write.ts`

**Database considerations:**

- Package table already has all needed fields (name, basePrice, description, duration)
- Tenant scoping: `WHERE tenantId = ?` mandatory on all operations
- Concurrent update handling: Check if optimistic locking is needed (pitfall #69)

## Acceptance Criteria

- [ ] `manage_packages` tool exists with create/update/delete/list actions
- [ ] Backend route `/v1/internal/agent/manage-packages` calls CatalogService
- [ ] All operations scoped by tenantId (security critical)
- [ ] Create/update return full package object (pitfall #52 - state return)
- [ ] Delete requires T3 confirmation (pitfall #49)
- [ ] E2E test passes: "Create Elopement Package at $2,500" → appears in Services section
- [ ] Agent system prompt clarifies: "packages" = bookable services, "pricing section" = content text

## Work Log

| Date       | Action                                 | Learnings                                           |
| ---------- | -------------------------------------- | --------------------------------------------------- |
| 2026-02-01 | E2E testing revealed gap               | Agent cannot fulfill core onboarding journey        |
| 2026-02-01 | Multi-agent review identified solution | Single unified tool preferred over 4 separate tools |

## Resources

- [Failure Report](docs/reports/2026-02-01-agent-testing-failure-report.md)
- [CatalogRepository Interface](server/src/lib/ports.ts) - lines 16-58
- [Existing Tool Patterns](server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts)
- [Internal Agent Routes](server/src/routes/internal-agent.routes.ts)
