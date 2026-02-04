# Handoff: Fix Onboarding Section Updates (Phase 5.2 Migration Gap)

**Date:** 2026-02-03
**Priority:** P0 - Onboarding flow is broken
**Status:** Root cause identified, fix needed

---

## Executive Summary

The AI agent onboarding flow is broken. The agent collects business information and says "Take a look - I put together a first draft" but **nothing updates in the preview**. The storefront still shows placeholder content like `[Your Transformation Headline]`.

**Root Cause:** Phase 5.2 migrated storefront storage from `landingPageConfig` JSON to `SectionContent` table, but the frontend `useDraftConfig` hook still calls the **removed** `/v1/tenant-admin/landing-page/draft` endpoint (returns 404).

---

## Your Mission

Run `/workflows:review` to deep-research this issue end-to-end and implement a fix that:

1. **Gets section updates working** - When agent updates a section, preview shows the change
2. **Enables auto-scroll** - Preview scrolls to the section being updated
3. **Maintains Phase 5.2 architecture** - Use `SectionContent` table, not legacy JSON

---

## Architecture Context

### Phase 5.2 Storage Migration (Completed 2026-02-02)

**Before (Legacy):**

```
Tenant.landingPageConfig (JSON column)
└── pages.home.sections[] (array of section objects)
```

**After (Current):**

```
SectionContent table
├── tenantId, segmentId, blockType, pageName
├── content (JSON), order, isDraft, publishedAt
└── Queried via SectionContentService
```

### Key Services

| Service                     | Location                                             | Purpose                                     |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `SectionContentService`     | `server/src/services/section-content.service.ts`     | Single source of truth for sections         |
| `TenantProvisioningService` | `server/src/services/tenant-provisioning.service.ts` | Creates SectionContent rows for new tenants |

### Agent Architecture

The tenant-agent has tools that should update sections:

- `update_section` - Updates a specific section's content
- `store_discovery_fact` - Stores facts about the business
- Tools are in `server/src/agent-v2/deploy/tenant/src/tools/`

---

## The Bug: Complete Trace

### 1. Frontend Call Chain

```
ContentArea.tsx
└── useDraftConfig() hook (apps/web/src/hooks/useDraftConfig.ts:83)
    └── apiClient.getDraft({}) (line 97)
        └── Maps to GET /v1/tenant-admin/landing-page/draft
            └── Returns 404 (endpoint removed in Phase 5.2)
```

### 2. Contract Definition (Still Exists)

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts:154
getDraft: {
  method: 'GET',
  path: '/v1/tenant-admin/landing-page/draft',
  // ...
}
```

### 3. Backend Endpoint (REMOVED)

The route handler was deleted in Phase 5.2 migration. No replacement was added.

### 4. Console Errors (Observed)

```
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
        @ http://localhost:3000/api/tenant-admin/landing-page/draft
```

---

## Files to Investigate

### Must Read

1. `apps/web/src/hooks/useDraftConfig.ts` - The broken hook calling 404 endpoint
2. `server/src/services/section-content.service.ts` - New source of truth
3. `server/src/routes/tenant-admin.routes.ts` - Missing endpoint location
4. `packages/contracts/src/tenant-admin/landing-page.contract.ts` - Legacy contract

### Should Read

5. `apps/web/src/components/dashboard/ContentArea.tsx` - Uses useDraftConfig
6. `apps/web/src/components/preview/PreviewPanel.tsx` - Uses useDraftConfig
7. `server/src/agent-v2/deploy/tenant/src/tools/index.ts` - Agent tools
8. `apps/web/src/components/agent/AgentPanel.tsx` - Handles tool results

### Reference

9. `docs/plans/2026-02-02-refactor-section-content-migration-plan.md` - Migration plan
10. `server/src/lib/tenant-defaults.ts` - DEFAULT_SECTION_CONTENT structure

---

## Proposed Fix Strategy

### Option A: Add New Section-Based Draft Endpoint (Recommended)

1. **Add endpoint** in `tenant-admin.routes.ts`:

   ```typescript
   // GET /v1/tenant-admin/sections/draft
   // Returns draft sections in useDraftConfig-compatible format
   ```

2. **Update contract** in `landing-page.contract.ts` or create `sections.contract.ts`

3. **Update useDraftConfig.ts** to call new endpoint

4. **Add auto-scroll handler** in AgentPanel when section is updated

### Option B: Shim Legacy Endpoint

Re-implement `/v1/tenant-admin/landing-page/draft` to read from `SectionContent` table and transform to legacy format. Less clean but faster.

---

## Test Environment

### Dev Server

```bash
cd /Users/mikeyoung/CODING/MAIS
npm run dev:all  # Starts API (3001) + Web (3000)
```

### Test Tenant Created

- **Name:** Sunset Photography Studio
- **URL:** http://localhost:3000/tenant/dashboard
- **Email:** test-sunset-photo@example.com
- Agent chat is connected and responding

### Verification Steps

1. Login as test tenant
2. Chat with agent: "I'm a wedding photographer in Austin"
3. Agent should update HERO section
4. Preview should show updated headline (currently shows placeholder)

---

## Related Issues & Pitfalls

From CLAUDE.md:

- **Pitfall #88:** Fact-to-Storefront bridge missing - agent stores facts but doesn't apply them
- **Pitfall #90:** dashboardAction not extracted from tool results
- **Pitfall #91:** Agent asking known questions (context not injected)

---

## Commands for Next Agent

```bash
# Start fresh
cd /Users/mikeyoung/CODING/MAIS

# Read the key files
cat apps/web/src/hooks/useDraftConfig.ts
cat server/src/services/section-content.service.ts

# Search for section endpoints
grep -rn "sections" server/src/routes/

# Check what the agent tools return
grep -rn "update_section\|NAVIGATE\|SCROLL" server/src/agent-v2/

# Run typecheck after changes
npm run --workspace=server typecheck
npm run --workspace=apps/web typecheck

# Test in browser
open http://localhost:3000/tenant/dashboard
```

---

## Success Criteria

- [ ] Agent updates section → Preview shows updated content immediately
- [ ] Preview auto-scrolls to the section being updated
- [ ] No 404 errors in console
- [ ] Onboarding progress advances as sections are completed
- [ ] Works for new tenants (no legacy data)

---

## Notes from Testing Session

The agent conversation flow was good:

1. Agent asked focused questions (dream client, testimonials, FAQs, contact)
2. Agent said "Take a look - I put together a first draft"
3. But preview didn't update - still showed `[Your Transformation Headline]`

The agent tools may be working (storing data) but the frontend can't fetch it because the endpoint is gone.
