# Agent Package Management Tool Implementation

> **Solved:** 2026-02-01 | **Severity:** P1 | **Time to Fix:** ~4 hours

## Problem

The tenant-agent couldn't create actual bookable packages. When a user said "Help me set up my photography packages," the agent edited cosmetic text sections (`landingPageConfigDraft` JSON) but the Services section still showed generic "$0/session" packages from the `Package` database table.

**Symptoms:**

- Agent says "Done. Take a look."
- Services section shows wrong pricing
- E2E test: "Create Elopement Package at $2,500" → Preview shows $0

## Root Cause

**Missing capability gap:** The agent had tools to edit landing page text but no tools for Package table CRUD.

```
USER: "Update services with my three packages and pricing"
           ↓
AGENT: calls update_section(type="pricing")
           ↓
RESULT: Updates TEXT content only, not actual Package records
           ↓
Services section: Still shows Package table data = $0
```

The `CatalogRepository` in `server/src/lib/ports.ts` had all the CRUD methods (`createPackage`, `updatePackage`, `deletePackage`), but no agent tool exposed them.

## Solution

### 1. Created `manage_packages` Tool

**File:** `server/src/agent-v2/deploy/tenant/src/tools/packages.ts`

Single unified tool with `action` discriminator for all CRUD:

```typescript
const ManagePackagesParams = z.object({
  action: z.enum(['list', 'create', 'update', 'delete']),
  // For create/update
  name: z.string().optional(),
  description: z.string().optional(),
  priceInDollars: z.number().optional(),
  duration: z.string().optional(),
  // For update/delete
  packageId: z.string().optional(),
  // T3 confirmation for delete
  confirmationReceived: z.boolean().optional(),
});
```

**Key Design Decisions:**

1. **Flat schema instead of discriminatedUnion** - ADK doesn't support `z.discriminatedUnion()` (pitfall #34), so we use flat object with runtime validation per action.

2. **Price in dollars, convert to cents** - LLM works better with human-readable prices ("$2,500") than cents (250000).

3. **Trust tiers enforced programmatically:**
   - T1 (read): `list` action
   - T2 (preview): `create`, `update`
   - T3 (confirmation): `delete` requires `confirmationReceived: true`

4. **Full state return** - Every mutation returns the updated package + totalCount (pitfall #52 - tools must return state, not just success).

### 2. Added Backend Route

**File:** `server/src/routes/internal-agent.routes.ts`

```typescript
router.post('/manage-packages', async (req, res) => {
  const { tenantId, action, ...params } = ManagePackagesSchema.parse(req.body);

  // Verify tenant exists (tenant-scoped as always)
  const tenant = await tenantRepo.findById(tenantId);

  switch (action) {
    case 'list':
      return catalogRepo.getPackages({ tenantId });
    case 'create':
      return catalogRepo.createPackage({ tenantId, ...params });
    case 'update':
      return catalogRepo.updatePackage({ tenantId, ...params });
    case 'delete':
      return catalogRepo.deletePackage({ tenantId, ...params });
  }
});
```

### 3. Registered Tool in Agent

**File:** `server/src/agent-v2/deploy/tenant/src/agent.ts`

Added `managePackagesTool` to the tenant-agent's tool registry.

## Key ADK Workarounds Applied

| Pitfall | Issue                                     | Workaround                                       |
| ------- | ----------------------------------------- | ------------------------------------------------ |
| #34     | `z.discriminatedUnion()` not supported    | Flat object + runtime validation                 |
| #51     | FunctionTool API (`parameters`/`execute`) | Correct ADK interface used                       |
| #52     | Tools returning just `{success: true}`    | Returns full package state                       |
| #70     | Missing safeParse                         | `ManagePackagesParams.safeParse()` as first line |

## Verification

```bash
# E2E test (now passes)
npm run e2e -- --grep "package management"

# Manual test
curl -X POST localhost:3001/v1/internal/agent/manage-packages \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "...", "action": "list"}'
```

## Files Changed

| File                                                      | Change                         |
| --------------------------------------------------------- | ------------------------------ |
| `server/src/agent-v2/deploy/tenant/src/tools/packages.ts` | NEW - `managePackagesTool`     |
| `server/src/agent-v2/deploy/tenant/src/tools/index.ts`    | Added export                   |
| `server/src/agent-v2/deploy/tenant/src/agent.ts`          | Registered tool                |
| `server/src/routes/internal-agent.routes.ts`              | Added `/manage-packages` route |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` | Clarified capability           |

## Prevention Checklist

For future agent capability gaps:

- [ ] When E2E shows "agent said done but UI didn't change" → check if tool modifies correct data source
- [ ] Audit: does the UI section read from JSON config or database table?
- [ ] If database table, is there a tool that does CRUD on that table?
- [ ] All mutations must return updated state, not just success boolean

## Related

- **Todo:** `#811` (archived)
- **E2E Report:** `docs/reports/2026-02-01-agent-testing-failure-report.md`
- **Pitfall Reference:** `CLAUDE.md` pitfalls #34, #51, #52, #70
- **ADK Patterns:** `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md`
