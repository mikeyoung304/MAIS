# Phase 2b Handoff - Migrate Storefront Editing to Tenant Agent

**Date:** 2026-01-30
**Previous Context:** Phase 2a Complete (Tenant Agent Foundation)
**Branch:** `feat/semantic-storefront`

---

## Quick Context

We're building a **Semantic Storefront Architecture** that consolidates 6 agents into 3. Phase 2a deployed the `tenant-agent` foundation - now we need to migrate the storefront editing tools.

### Current Architecture (After Phase 2a)

```
Cloud Run Services (7 total):
├── concierge-agent     (hub - routes to specialists)
├── booking-agent       (specialist - appointments)
├── storefront-agent    (specialist - TO BE MIGRATED)
├── marketing-agent     (specialist - TO BE MIGRATED in 2c)
├── research-agent      (specialist - unchanged)
├── project-hub-agent   (specialist - TO BE MIGRATED in 2d)
└── tenant-agent        (NEW - deployed in Phase 2a) ✅
```

### What Phase 2a Delivered

1. **tenant-agent deployed:** `https://tenant-agent-506923455711.us-central1.run.app`
2. **Chat endpoint:** `POST /v1/tenant-admin/agent/tenant/chat`
3. **Navigation tools:** `navigate_to_section`, `scroll_to_website_section`, `show_preview`
4. **Vocabulary tool:** `resolve_vocabulary` (calls backend for semantic phrase → blockType)
5. **E2E verified:** Agent calls vocabulary tool → backend returns blockType mapping

---

## Phase 2b Objective

**Migrate all storefront editing tools from `storefront-agent` to `tenant-agent`**

After Phase 2b, users will be able to:

- Edit their storefront via the tenant-agent (no more delegation to storefront-agent)
- "Update my about section headline" → works directly
- "Add a testimonials section" → works directly
- "Publish my changes" → works with T3 confirmation

---

## Tools to Migrate

From `server/src/agent-v2/deploy/storefront/src/agent.ts`:

| Tool                  | Tier | Purpose                                       |
| --------------------- | ---- | --------------------------------------------- |
| `get_page_structure`  | T1   | Read sections/pages layout                    |
| `get_section_content` | T1   | Read full content of a section                |
| `update_section`      | T2   | Update headline/content/CTA                   |
| `add_section`         | T2   | Add new section to page                       |
| `remove_section`      | T2   | Remove section from page                      |
| `reorder_sections`    | T2   | Move section to new position                  |
| `toggle_page`         | T1   | Enable/disable entire page                    |
| `update_branding`     | T2   | Change colors/fonts/logo                      |
| `preview_draft`       | T1   | Get preview URL                               |
| `publish_draft`       | T3   | Publish to live (needs confirmation)          |
| `discard_draft`       | T3   | Revert all draft changes (needs confirmation) |

---

## Target File Structure

```
server/src/agent-v2/deploy/tenant/src/tools/
├── index.ts              (existing - export all tools)
├── navigate.ts           (existing - T1 navigation)
├── vocabulary.ts         (existing - T1 vocabulary resolution)
├── storefront-read.ts    (NEW - get_page_structure, get_section_content)
├── storefront-write.ts   (NEW - update_section, add/remove/reorder sections)
├── branding.ts           (NEW - update_branding)
├── draft.ts              (NEW - preview_draft, publish_draft, discard_draft)
└── toggle-page.ts        (NEW - toggle_page)
```

---

## Key Files to Reference

1. **Existing storefront-agent:** `server/src/agent-v2/deploy/storefront/src/agent.ts` (806 lines)
   - Contains all tool implementations and Zod schemas

2. **Tenant-agent foundation:** `server/src/agent-v2/deploy/tenant/src/`
   - `agent.ts` - Main agent definition
   - `tools/navigate.ts` - Example of how we structure tools
   - `utils.ts` - Shared utilities (logger, fetchWithTimeout, callMaisApi, getTenantId)
   - `prompts/system.ts` - System prompt (needs to include storefront context)

3. **Backend endpoints:** `server/src/routes/internal-agent.routes.ts`
   - `/storefront/structure` - get_page_structure
   - `/storefront/section` - get_section_content
   - `/storefront/update-section` - update_section
   - `/storefront/add-section` - add_section
   - `/storefront/remove-section` - remove_section
   - `/storefront/reorder-sections` - reorder_sections
   - `/storefront/toggle-page` - toggle_page
   - `/storefront/update-branding` - update_branding
   - `/storefront/preview` - preview_draft
   - `/storefront/publish` - publish_draft
   - `/storefront/discard` - discard_draft

4. **Plan document:** `docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md`

---

## Implementation Checklist

- [x] Create `storefront-read.ts` with get_page_structure and get_section_content
- [x] Create `storefront-write.ts` with update_section, add_section, remove_section, reorder_sections
- [x] Create `branding.ts` with update_branding
- [x] Create `draft.ts` with preview_draft, publish_draft, discard_draft (T3 confirmation pattern)
- [x] Create `toggle-page.ts` with toggle_page
- [x] Update `tools/index.ts` to export all new tools
- [x] Update `agent.ts` to register all new tools
- [x] Update `prompts/system.ts` to include storefront editing instructions
- [x] Redeploy tenant-agent to Cloud Run
- [x] E2E test: Agent calls get_page_structure (verified via Cloud Run direct call)
- [ ] Update plan document with Phase 2b progress
- [ ] Commit with: `feat(tenant-agent): migrate storefront editing tools (Phase 2b)`

---

## Pitfalls to Avoid

- **Pitfall #51:** ADK uses `parameters`/`execute` not `inputSchema`/`func`
- **Pitfall #47:** Tools must return results, not instructions for LLM
- **Pitfall #49:** T3 tools MUST have `confirmationReceived: z.boolean()` parameter
- **Pitfall #52:** Tools that modify state must return updated state, not just `{success: true}`
- **Pitfall #62:** Use Zod `safeParse()` for all runtime data validation

---

## Example Tool Pattern (from existing navigate.ts)

```typescript
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import type { DashboardAction } from './types';

const NavigateToSectionParams = z.object({
  blockType: z
    .enum(['HERO', 'ABOUT', 'SERVICES' /* ... */])
    .describe('The semantic section type to navigate to'),
});

export const navigateToSectionTool = new FunctionTool({
  name: 'navigate_to_section',
  description: 'Navigate the dashboard to focus on a specific section.',
  parameters: NavigateToSectionParams,
  execute: async (params, context) => {
    // 1. Validate params with safeParse
    const parseResult = NavigateToSectionParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.message };
    }

    // 2. Execute logic
    const dashboardAction: DashboardAction = {
      type: 'NAVIGATE_TO_SECTION',
      payload: { blockType: parseResult.data.blockType },
    };

    // 3. Return result with state for agent context
    return {
      success: true,
      dashboardAction,
      message: `Navigated to ${parseResult.data.blockType} section`,
    };
  },
});
```

---

## Environment Variables (Already Set on Cloud Run)

```
MAIS_API_URL=https://mais-5bwx.onrender.com
INTERNAL_API_SECRET=agent-internal-c5651b6aa4ff962edf621c3142e038f9
AGENT_API_PATH=/v1/internal/agent
```

---

## Deployment Command

```bash
cd server/src/agent-v2/deploy/tenant
npm run deploy
```

After deploy, verify with:

```bash
curl -s -X GET "https://tenant-agent-506923455711.us-central1.run.app/list-apps" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"
# Should return: ["agent"]
```
