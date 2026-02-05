# Deletion Manifest: Agent-First Migration

> **Status:** MOSTLY COMPLETE (February 2026)
> **Date:** 2026-02-01 (original), 2026-02-05 (status update)
> **Purpose:** Define exactly what gets deleted in the Agent-First consolidation
>
> **Note:** Phase 1 schema migration was superseded by Phase 5 Section Content Migration (February 2, 2026). Instead of `storefrontDraft`/`storefrontPublished` columns, the `SectionContent` table became the canonical storage.

---

## Deletion Philosophy

> "Dead code is tech debt. Parallel systems cause bugs. If the agent is canonical, everything else is a view or it's deleted."

Archive branches exist. Git history exists. We delete aggressively.

---

## Phase 0: Immediate Deletions ✅ COMPLETE

These have been deleted. No migration required.

### 1. XState Onboarding System ✅ DELETED

**Why:** Agent handles flow natively. XState was a pre-agent control mechanism.

| Path                                                  | Description                | Status     |
| ----------------------------------------------------- | -------------------------- | ---------- |
| `server/src/agent/onboarding/`                        | Entire directory           | ✅ DELETED |
| `server/src/agent/onboarding/machines/`               | XState machine definitions | ✅ DELETED |
| `server/src/agent/onboarding/AdvisorMemoryService.ts` | Legacy memory service      | ✅ DELETED |
| `server/src/agent/onboarding/BusinessAdvisor.ts`      | Orchestrator class         | ✅ DELETED |
| `server/src/agent/onboarding/AdvisorContext.ts`       | Context types              | ✅ DELETED |

### 2. Archived Agents ✅ DELETED

**Why:** Already migrated to customer-agent and tenant-agent.

| Path                                             | Description                | Status     |
| ------------------------------------------------ | -------------------------- | ---------- |
| `server/src/agent-v2/archive/booking-agent/`     | migrated to customer-agent | ✅ DELETED |
| `server/src/agent-v2/archive/project-hub-agent/` | split to customer/tenant   | ✅ DELETED |
| `server/src/agent-v2/archive/storefront-agent/`  | migrated to tenant-agent   | ✅ DELETED |
| `server/src/agent-v2/archive/marketing-agent/`   | migrated to tenant-agent   | ✅ DELETED |
| `server/src/agent-v2/archive/concierge-agent/`   | migrated to tenant-agent   | ✅ DELETED |

**Verification:** customer-agent and tenant-agent are deployed and functional on Cloud Run.

### 3. Dead Utility Modules

**Why:** Code that exists but isn't imported anywhere.

```bash
# Find candidates
npx madge --orphans server/src/
```

| Path                  | Reason         |
| --------------------- | -------------- |
| TBD after orphan scan | Unused modules |

---

## Phase 1: Schema Consolidation ✅ SUPERSEDED

> **Note:** This phase was superseded by the Phase 5 Section Content Migration (February 2, 2026). Instead of the planned `storefrontDraft`/`storefrontPublished` columns, the `SectionContent` table became the canonical storage.

### 1. Draft System Unification ✅ SUPERSEDED

**Original plan (not implemented):**

- `tenant.storefrontDraft` - Single draft location (agent-authored)
- `tenant.storefrontPublished` - Single published location

**Actual implementation (Phase 5 Section Content Migration):**

- `SectionContent` table with `isDraft: boolean` field
- `SectionContentService` as single source of truth
- `landingPageConfig` kept as read-only legacy fallback

**What was deleted:**

- `tenant.landingPageConfigDraft` column - DELETED
- `tenant.landingPageConfig.draft` wrapper - DELETED (write path)
- `LandingPageService` - DELETED
- `landing-page-utils.ts` - DELETED
- `tenant-admin-landing-page.routes.ts` write endpoints - DELETED

### 2. OnboardingEvent Table

**Current state:** Event-sourced onboarding facts
**Target state:** State-based `discoveryFacts` in `tenant.branding`

**Migration steps:**

```sql
-- Step 1: Migrate events to discoveryFacts
-- (Custom script to replay events into final state)
-- See: server/scripts/migrate-onboarding-events.ts

-- Step 2: Verify migration
SELECT t.id, t.branding->>'discoveryFacts', COUNT(e.id) as event_count
FROM "Tenant" t
LEFT JOIN "OnboardingEvent" e ON e."tenantId" = t.id
GROUP BY t.id
HAVING COUNT(e.id) > 0;
-- Verify discoveryFacts contains expected data

-- Step 3: Drop table (AFTER verification)
DROP TABLE "OnboardingEvent";
```

### 3. SectionContent Model ✅ KEPT (Now Canonical)

**Status:** The `SectionContent` table became the canonical storage in Phase 5 Section Content Migration.

This was originally marked for potential deletion, but the direction changed - instead of consolidating into `storefrontDraft`/`storefrontPublished` columns, the `SectionContent` table was enhanced to become the canonical storage for all storefront content.

**Current usage:**

- `SectionContentService` in `server/src/services/section-content.service.ts`
- Agent tools write via `updateSection()`, `publishAll()`
- Public storefront reads via `/sections` API

---

## Phase 2: Code Deletions (Post-Schema Migration)

### 1. Visual Editor Draft Logic ✅ DONE (2026-02-01)

**Why:** Visual editor becomes a view, not an author.

**Completed deletions:**

| Path                                                    | What was deleted                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `server/src/routes/tenant-admin-landing-page.routes.ts` | `PUT /draft`, `PUT /`, `PATCH /sections` routes                                     |
| `server/src/services/landing-page.service.ts`           | `saveDraft()`, `updateConfig()`, `toggleSection()`                                  |
| `server/src/adapters/prisma/tenant.repository.ts`       | `saveLandingPageDraft()`, `updateLandingPageConfig()`, `toggleLandingPageSection()` |

**What was kept:** Read endpoints (`GET /`, `GET /draft`), publish (`POST /publish`), discard (`DELETE /draft`), image upload.

**Fixed:** `publishLandingPageDraft()` and `discardLandingPageDraft()` now read from Build Mode column first.

See: `docs/plans/2026-02-01-realtime-preview-handoff.md` for full details.

### 2. Dual-Path Utilities

| Path                                   | What to delete                               |
| -------------------------------------- | -------------------------------------------- |
| `server/src/lib/landing-page-utils.ts` | `createPublishedWrapper()`, draft extraction |
| Any `normalizeToPages()`               | If it handles multiple formats               |

### 3. Legacy Memory Services

| Path                                               | Reason                        |
| -------------------------------------------------- | ----------------------------- |
| `server/src/services/onboarding-memory.service.ts` | Replaced by ContextBuilder    |
| `server/src/services/advisor-memory.service.ts`    | Replaced by ContextBuilder    |
| Any `*MemoryService.ts`                            | Consolidate to ContextBuilder |

---

## Phase 3: Environment Variable Cleanup

| Variable                | Status                                    |
| ----------------------- | ----------------------------------------- |
| `BOOKING_AGENT_URL`     | DELETE - migrated to `CUSTOMER_AGENT_URL` |
| `PROJECT_HUB_AGENT_URL` | DELETE - migrated to split agents         |
| `STOREFRONT_AGENT_URL`  | DELETE - migrated to `TENANT_AGENT_URL`   |
| `MARKETING_AGENT_URL`   | DELETE - migrated to `TENANT_AGENT_URL`   |
| `CONCIERGE_AGENT_URL`   | DELETE - migrated to `TENANT_AGENT_URL`   |

---

## Verification Checklist

Before each deletion phase:

- [ ] Run full test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Check for orphan imports: `grep -rn "from.*<deleted-path>" server/src/`
- [ ] Verify no runtime errors in staging
- [ ] Create archive branch: `git checkout -b archive/pre-agent-first-$(date +%Y%m%d)`

---

## Rollback Plan

If something breaks:

1. Archive branches contain all deleted code
2. Database migrations are reversible (add back columns)
3. Environment variables can be restored from Render/Vercel history

---

## Timeline

| Phase   | Duration | Dependencies                           |
| ------- | -------- | -------------------------------------- |
| Phase 0 | 1 day    | None - immediate deletions             |
| Phase 1 | 3-5 days | Schema migration scripts, verification |
| Phase 2 | 2-3 days | Phase 1 complete, code updates         |
| Phase 3 | 1 day    | Phase 2 complete, env cleanup          |

**Total:** ~2 weeks with verification pauses.

---

## Files to Create

| File                                              | Purpose                         |
| ------------------------------------------------- | ------------------------------- |
| `server/src/services/context-builder.service.ts`  | Single context assembly point   |
| `server/src/services/storefront-state.service.ts` | Canonical storefront read/write |
| `server/scripts/migrate-onboarding-events.ts`     | Event → state migration         |
| `server/scripts/migrate-landing-page-config.ts`   | Draft consolidation migration   |

---

## Non-Deletions (Explicitly Kept)

| Item                             | Reason                                             |
| -------------------------------- | -------------------------------------------------- |
| `tenant.branding.discoveryFacts` | Canonical fact storage - KEEP                      |
| `customer-agent`                 | Active agent - KEEP                                |
| `tenant-agent`                   | Active agent - KEEP                                |
| `research-agent`                 | Active agent - KEEP                                |
| Trust tier system                | Core pattern - KEEP                                |
| Visual editor (as viewer)        | Becomes view into agent state - MODIFY, not delete |
