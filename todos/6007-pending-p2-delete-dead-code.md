# Delete Dead Code: Endpoints, Exports, Phantom Capabilities

**Priority:** P2
**Files:** Route files, `types/guided-refinement.ts`, `context-builder.ts`
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

~250 lines of dead code across routes, exports, and context injection that no agent tool calls.

## Dead Endpoints to Remove

### 1. `/faq` in booking routes (~62 lines)

**File:** `server/src/routes/internal-agent-booking.routes.ts` (lines ~310-372)
**Evidence:** Always matches against `faqs = []`. No SectionContent FAQ integration exists. The TODO on line ~327 was never implemented. No agent tool calls this endpoint.
**Action:** Delete the entire route handler.

### 2. `/generate-headline` in content-generation routes

**File:** `server/src/routes/internal-agent-content-generation.routes.ts`
**Evidence:** No agent tool calls `/content-generation/generate-headline`. Only referenced in old test HTTP specs.
**Action:** Delete the route handler.

### 3. `/generate-tagline` in content-generation routes

**Evidence:** Same — no agent tool caller.
**Action:** Delete.

### 4. `/generate-service-description` in content-generation routes

**Evidence:** Same — no agent tool caller.
**Action:** Delete.

### 5. `/refine-copy` in content-generation routes

**Evidence:** Same — no agent tool caller.
**Action:** Delete.

**Total dead endpoint lines: ~200**

## Dead Exports to Remove

### 6. `createEmptyVariantSet` in `types/guided-refinement.ts`

**File:** `server/src/agent-v2/deploy/tenant/src/types/guided-refinement.ts` (~line 165)
**Evidence:** Never called anywhere in the codebase. Grep for `createEmptyVariantSet` returns only the definition.
**Action:** Delete the function.

### 7. `createInitialState` duplicate — ONE of the two copies

**Files:** `types/guided-refinement.ts` (~line 147) AND `tools/refinement.ts` (~line 54)
**Evidence:** Both define identical `createInitialState()`. Only the one in `refinement.ts` is called.
**Action:** Delete from `types/guided-refinement.ts` (it's the unused one). OR move the one from `refinement.ts` into `types/guided-refinement.ts` and import it. Either way, only one copy should exist.
**NOTE:** Todo 6002 also addresses this — coordinate.

## Phantom Capabilities to Fix

### 8. `dashboardCapabilities` in context-builder.ts

**File:** `server/src/agent-v2/deploy/tenant/src/context-builder.ts` (lines ~250-276)
**Evidence:** Lists tools that don't exist: `add_segment`, `update_segment`, `update_tier`, `preview_website`, `publish_website`. The actual tools are `add_section`, `update_section`, `manage_packages`, `show_preview`, `publish_draft`.
**Action:** Update the capabilities list to match actual tool names from `agent.ts`.
**NOTE:** Todo 6001 also addresses this — coordinate.

## Misleading Comments to Fix

### 9. `/mark-greeted` comment

**File:** `server/src/routes/internal-agent-discovery.routes.ts` (~line 233)
**Comment says:** "Called by Concierge agent AFTER sending greeting"
**Reality:** Called from the dashboard route (`tenant-admin-tenant-agent.routes.ts`), not from the agent.
**Action:** Fix comment.

## Verification

```bash
npm run --workspace=server typecheck
npm run --workspace=server test
# Verify no remaining references to deleted endpoints:
grep -r "generate-headline\|generate-tagline\|generate-service-description\|refine-copy" server/src/agent-v2/
```
