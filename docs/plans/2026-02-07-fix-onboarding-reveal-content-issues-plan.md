---
title: 'fix: Onboarding Reveal Content Issues — Duplicate Packages, Section Scope, Flash Animation'
type: fix
date: 2026-02-07
priority: P0
branch: fix/onboarding-reveal-flow
blocked-by: none
status: FINAL (reviewed by 4 agents)
inputs:
  - docs/plans/2026-02-07-playwright-test-findings-report.md
  - docs/plans/2026-02-07-onboarding-flow-fix-investigation.md
---

# FINAL: fix: Onboarding Reveal Content Issues

## Review Audit Trail

| Reviewer                | Verdict                      | Key Feedback                                                            |
| ----------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Kieran (TypeScript)** | APPROVE_WITH_NOTES           | Use `Set` for MVP filter; ensure store types are complete               |
| **Simplicity**          | PROCEED_WITH_SIMPLIFICATIONS | Replace Zustand counter with module-scoped `let`; drop Phase 1.3        |
| **Architecture**        | APPROVE_WITH_NOTES           | Move MVP concept to blueprint; add programmatic package cleanup         |
| **Agent-Native**        | KEEP BUT MODIFY              | Drop section names from instruction; keep reveal hint (already correct) |

### Changes Incorporated from Review

1. **Blueprint single source of truth** — Added `isRevealMVP` to `SectionBlueprintEntry` (Architecture)
2. **Module-scoped `let` replaces Zustand** — Dropped `agent-ui-store.ts` from changeset (Simplicity)
3. **Programmatic $0 cleanup fallback** — Added to `first-draft.ts` alongside prompt instructions (Architecture)
4. **Phase 1.3 DROPPED** — Instruction string already correct as-is (Agent-Native)
5. **Phase 2.2 merged into 2.1** — Single prompt block instead of two (Simplicity)
6. **Derive reveal threshold from blueprint** — `AgentPanel.tsx` uses `SECTION_BLUEPRINT.filter(s => s.isRevealMVP).length` (Architecture + TypeScript)
7. **Deploy ordering documented** — Frontend → Backend → Agent (Architecture)
8. **System prompt line 249 corrected** — "first update_section" → "all MVP sections are updated" (discovered during review)

---

## Overview

Five critical bugs prevent a viable onboarding reveal experience. Users see duplicate $0 packages alongside real ones, placeholder sections that should be hidden (CONTACT, PRICING), a jarring flash instead of smooth animation, and returning users get stuck on "Coming Soon" forever. All stem from a missing "reveal scope" concept — the system has no notion of which sections should show during the first reveal vs. later refinement.

## Problem Statement

After the agent builds a first draft and triggers the reveal animation, users see:

1. **6 packages instead of 3** — 3 default $0 packages (Basic, Standard, Premium) seeded during provisioning + 3 real packages created by the agent
2. **CONTACT section with "Coming soon" placeholder** — `visible: true` in defaults, but agent never gathered contact info
3. **PRICING section with default text** — `visible: true`, separate from SERVICES packages
4. **Flash/reload during reveal** — auto-reveal fires after FIRST `update_section`, iframe loads partial content, then reloads as agent writes more sections
5. **Returning users stuck** — auto-reveal timing + package duplication make the revealed content broken

**Root cause:** No "reveal scope" filtering. `first-draft.ts` returns ALL placeholder sections. `tenant-defaults.ts` seeds CONTACT and PRICING as `visible: true`. Agent creates packages without removing defaults. Auto-reveal fires on first write, not after all MVP sections complete.

## Proposed Solution

Three focused phases, all shippable independently:

| Phase | What                                                            | Impact                                  | Files Changed |
| ----- | --------------------------------------------------------------- | --------------------------------------- | ------------- |
| **1** | Blueprint MVP flag + hide non-MVP defaults + filter first-draft | Reveal shows only HERO, ABOUT, SERVICES | 3 files       |
| **2** | Package deduplication — prompt + programmatic fallback          | No more $0 duplicates                   | 2 files       |
| **3** | Auto-reveal waits for MVP section count                         | Smooth animation, no flash              | 1 file        |

---

## Technical Approach

### Architecture

The fix adds a single field to the **Section Blueprint** (single source of truth in `@macon/contracts`): `isRevealMVP: boolean`. This field drives:

- `first-draft.ts` — filters to MVP sections only (hardcoded `Set` mirrors blueprint since Cloud Run agent doesn't import from contracts)
- `tenant-defaults.ts` — non-MVP sections default to `visible: false`
- `AgentPanel.tsx` — derives reveal threshold from `SECTION_BLUEPRINT.filter(s => s.isRevealMVP).length`

No new tables, endpoints, or components needed. No migration required.

---

## Implementation Phases

### Phase 1: Blueprint MVP Flag + Section Scope (P0 — Fixes Issues #2, #3, #4)

**Goal:** Reveal shows ONLY HERO, ABOUT, SERVICES. CONTACT, PRICING, CTA hidden.

#### 1.1 Add `isRevealMVP` to Section Blueprint

**File:** `packages/contracts/src/schemas/section-blueprint.schema.ts`

Add `isRevealMVP` to `SectionBlueprintEntry` interface:

```typescript
export interface SectionBlueprintEntry {
  // ...existing fields...
  /** Whether this section is shown during the initial "wow moment" reveal */
  isRevealMVP: boolean;
}
```

Set values in `SECTION_BLUEPRINT`:

```typescript
{ sectionType: 'hero',         ..., isRevealMVP: true  },
{ sectionType: 'about',        ..., isRevealMVP: true  },
{ sectionType: 'services',     ..., isRevealMVP: true  },
{ sectionType: 'pricing',      ..., isRevealMVP: false },
{ sectionType: 'testimonials', ..., isRevealMVP: false },
{ sectionType: 'faq',          ..., isRevealMVP: false },
{ sectionType: 'contact',      ..., isRevealMVP: false },
{ sectionType: 'cta',          ..., isRevealMVP: false },
```

Export derived constants:

```typescript
/** Count of MVP sections for reveal threshold (used by AgentPanel.tsx) */
export const MVP_REVEAL_SECTION_COUNT = SECTION_BLUEPRINT.filter((s) => s.isRevealMVP).length;

/** Set of uppercase MVP section types (used for filtering) */
export const MVP_REVEAL_SECTION_TYPES = new Set(
  SECTION_BLUEPRINT.filter((s) => s.isRevealMVP).map((s) => s.sectionType.toUpperCase())
);
```

**Why:** Blueprint is the documented single source of truth for section metadata. Adding a 4th MVP section later requires ONE change in ONE file — both `first-draft.ts` and `AgentPanel.tsx` derive from it.

#### 1.2 Change default visibility in `tenant-defaults.ts`

**File:** `server/src/lib/tenant-defaults.ts`

Set CONTACT and PRICING to `visible: false`:

```typescript
// PRICING (line ~152)
PRICING: {
    order: 3,
    content: {
      visible: false,  // ← was: true. Hidden until services + tiers ready.
      // ...rest unchanged
    },
  },

// CONTACT (line ~179)
CONTACT: {
    order: 6,
    content: {
      visible: false,  // ← was: true. Hidden until agent gathers contact info.
      // ...rest unchanged
    },
  },
```

**Why:** HERO, ABOUT, SERVICES remain `visible: true`. All others already `false` except these two. Only affects NEW tenants — existing `SectionContent` rows are immutable to this change.

#### 1.3 Filter `first-draft.ts` to MVP sections only

**File:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:129-149`

Add MVP filtering AFTER the placeholder filter:

```typescript
// After line 131: const placeholderSections = allSections.filter((s) => s.hasPlaceholder);

// MVP reveal scope — only return the "wow moment" sections for first draft.
// Source of truth: SECTION_BLUEPRINT.isRevealMVP in @macon/contracts
// Hardcoded here because Cloud Run agent doesn't import from contracts.
const MVP_SECTIONS = new Set(['HERO', 'ABOUT', 'SERVICES']);
const mvpPlaceholders = placeholderSections.filter((s) => MVP_SECTIONS.has(s.type));
```

Update line 144 to use `mvpPlaceholders` instead of `placeholderSections`:

```typescript
const sectionsToUpdate = mvpPlaceholders.map((s) => ({
  sectionId: s.id,
  sectionType: s.type,
  pageName: s.page,
  currentHeadline: s.headline || '(no headline)',
}));
```

Update line 151 logging to use `mvpPlaceholders`:

```typescript
logger.info(
  {
    tenantId,
    mvpCount: sectionsToUpdate.length,
    totalPlaceholders: placeholderSections.length,
    totalSections: allSections.length,
    factCount: factsData.factCount,
  },
  '[TenantAgent] build_first_draft identified MVP sections'
);
```

**No instruction string change needed.** The current instruction (line 167-168) already says "Generate personalized content for each section below" — the filtered `sectionsToUpdate` array scopes it naturally. The reveal hint ("After ALL sections are updated, the preview will reveal automatically") is outcome context, not business logic, and earns its keep per agent-native review.

---

### Phase 2: Package Deduplication (P0 — Fixes Issue #1)

**Goal:** Services section shows ONLY agent-created packages, no $0 defaults.

#### 2.1 Update system prompt — list-then-delete workflow

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts:234-242`

Replace lines 234-242 with:

```
   **Step 3 — SERVICES section** — requires cleanup + creation:
   a) update_section with:
      - \`headline\`: "Services" or "What We Offer" (clear, not clever)
      - \`subheadline\`: Brief positioning statement
   b) manage_packages(action: "list") — get existing packages
   c) DELETE all default packages ($0 price):
      - For each package with basePrice 0: manage_packages(action: "delete", packageId: "...", confirmationReceived: true)
      - CRITICAL: Delete defaults BEFORE creating new packages to avoid duplicates
      - **Package Cleanup Rule:** $0 packages named Basic/Standard/Premium are setup defaults. Never leave them visible — it breaks trust.
   d) manage_packages — create THREE packages (good/better/best tiers):
      - **Good tier**: Entry-level package. Name, description, realistic price.
      - **Better tier**: Mid-range package. More coverage/features, higher price.
      - **Best tier**: Premium package. Full-service, highest price.
      Use servicesOffered + priceRange facts to set names, descriptions, and prices. If user hasn't given prices, use research agent data (competitor pricing) to set informed defaults — cite the research: "Based on what other [business type] in [city] charge, I started your packages at..." Prices are easy to adjust, so set smart defaults rather than asking.
```

Also fix line 249 — update the inaccurate reveal trigger description:

```
// BEFORE (line 249):
CRITICAL: After completing all update_section calls, the frontend will show the reveal animation automatically. You do NOT need to trigger the reveal — it happens when the first update_section call completes.

// AFTER:
CRITICAL: After completing all update_section calls, the frontend will show the reveal animation automatically. You do NOT need to trigger the reveal — it happens when all MVP sections are updated.
```

**Why:** Merged the cleanup rule (former Phase 2.2) into the Step 3 instructions as a single callout line. One cohesive block, no redundant paragraph.

#### 2.2 Programmatic $0 package cleanup fallback in `first-draft.ts`

**File:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` (before the return statement, around line 161)

Add programmatic cleanup of $0 default packages:

```typescript
// Programmatic fallback: delete $0 default packages before agent creates real ones.
// The system prompt also instructs the agent to list-then-delete, but this ensures
// cleanup even if the LLM skips the step. Defense-in-depth for financial-impact data.
// API: single POST /manage-packages with action param (see packages.ts:226, :391)
try {
  const listResult = await callMaisApi('/manage-packages', tenantId, { action: 'list' });
  if (listResult.ok) {
    const packages =
      (listResult.data as { packages?: Array<{ id: string; basePrice: number }> })?.packages ?? [];
    const defaultPackages = packages.filter((pkg) => pkg.basePrice === 0);
    for (const pkg of defaultPackages) {
      await callMaisApi('/manage-packages', tenantId, {
        action: 'delete',
        packageId: pkg.id,
      });
    }
    if (defaultPackages.length > 0) {
      logger.info(
        { tenantId, deletedCount: defaultPackages.length },
        '[TenantAgent] build_first_draft cleaned up default $0 packages'
      );
    }
  }
} catch (err) {
  // Non-fatal: agent prompt will also instruct cleanup
  logger.warn(
    { tenantId, err },
    '[TenantAgent] $0 package cleanup failed, agent will retry via prompt'
  );
}
```

**Why:** Prompt-only enforcement for data mutations that affect booking flows violates the project's defense-in-depth principle (Pitfalls #54, #56). The prompt instructions remain (better UX narrative when followed), but this code catches failures silently.

**API paths verified:** `callMaisApi('/manage-packages', tenantId, { action: 'list' | 'delete' })` — single endpoint, action-dispatched. See `packages.ts:226` (list) and `packages.ts:391` (delete) for existing usage pattern.

---

### Phase 3: Auto-Reveal Timing (P0 — Fixes Issue #4)

**Goal:** Reveal animation fires after ALL MVP sections are updated, not after the first.

#### 3.1 Replace single-write trigger with count-based trigger

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

Add module-scoped counter (before the component function, near imports):

```typescript
// Module-scoped counter for section writes during first draft.
// Persists across tool-complete batches (agent may send 1+1+1 or 2+1).
// Resets on page refresh — correct behavior (re-shows Coming Soon, count rebuilds).
import { MVP_REVEAL_SECTION_COUNT } from '@macon/contracts';

let firstDraftWriteCount = 0;
```

Replace lines 393-403 (auto-reveal block) with:

```typescript
// Auto-reveal: count cumulative section writes during Coming Soon.
// Reveal only after MVP section count is reached (currently 3: HERO, ABOUT, SERVICES).
// Derived from SECTION_BLUEPRINT.isRevealMVP — no magic number.
const contentWriteCount = toolCalls.filter(
  (call) => call.name === 'update_section' || call.name === 'add_section'
).length;
const currentView = useAgentUIStore.getState().view;
if (currentView.status === 'coming_soon' && contentWriteCount > 0) {
  firstDraftWriteCount += contentWriteCount;
  if (firstDraftWriteCount >= MVP_REVEAL_SECTION_COUNT) {
    agentUIActions.revealSite();
  }
}
```

**Why module-scoped `let` instead of Zustand:**

- Counter is read/written in exactly ONE place (`handleTenantAgentToolComplete`)
- Persists across tool-complete batches (same as Zustand ephemeral state)
- Resets on page refresh (same as Zustand — correct behavior)
- Eliminates: `ComingSoonState` interface change, `trackSectionWrite` action, `agentUIActions` export addition, `showComingSoon` reset logic
- **Saves ~20 LOC** and keeps `agent-ui-store.ts` untouched

**Edge case — multi-batch writes:** ADK may send tool results in batches. `handleTenantAgentToolComplete` fires per batch. A batch with 3 `update_section` calls triggers reveal immediately. A batch with 1, then another with 2, triggers on the second batch (total >= 3). Both correct.

**Edge case — page refresh during first draft:** Counter resets to 0. User sees Coming Soon. Agent continues writing, count rebuilds from new tool completions. Better than flashing partial content.

**Edge case — double reveal:** If agent writes 4+ sections, `revealSite()` may be called after count crosses threshold on two batches. Existing `revealSite` transitions from `coming_soon` → `revealing`. A second call from `revealing` → `revealing` is a no-op in practice (animation component guards). If this becomes an issue, add a one-line guard: `if (state.view.status === 'revealing') return;` inside `revealSite()`.

---

## Files Requiring Changes

| #   | File                                                         | Phase    | Change                                           |
| --- | ------------------------------------------------------------ | -------- | ------------------------------------------------ |
| 1   | `packages/contracts/src/schemas/section-blueprint.schema.ts` | 1.1      | Add `isRevealMVP` field + derived constants      |
| 2   | `server/src/lib/tenant-defaults.ts`                          | 1.2      | Set CONTACT + PRICING to `visible: false`        |
| 3   | `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` | 1.3, 2.2 | MVP filter + programmatic $0 cleanup             |
| 4   | `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`    | 2.1      | List-then-delete workflow + fix line 249         |
| 5   | `apps/web/src/components/agent/AgentPanel.tsx`               | 3.1      | Count-based auto-reveal with module-scoped `let` |

**Total: 5 files. 3 backend/agent + 1 contracts + 1 frontend.**

---

## Deployment Notes

**Recommended deploy order** (minimizes regression window):

1. **Frontend first (Vercel)** — Count-based reveal is backward-compatible with old agent. Worst case: old agent sends all sections, reveal fires after 3rd (earlier than all, but still better than after 1st).
2. **Backend second (Render)** — Default visibility is independent. Only affects new tenants.
3. **Agent last (Cloud Run)** — MVP filter + package cleanup. By this point, frontend already has the count-based guard.

**Why this order matters:** If agent deploys BEFORE frontend, you get a brief window where agent sends only 3 `update_section` calls but old frontend triggers reveal on the first one — a regression from current behavior. The window is small (Vercel deploys in ~60s) but avoidable.

**All three can deploy simultaneously in practice** — the regression window is sub-minute and the count-based trigger degrades gracefully. But if you want to be safe, follow the order above.

**Post-deploy verification:**

- Check GitHub Actions → "Deploy AI Agents to Cloud Run" succeeded (Pitfall #51)
- Manual test: fresh signup → agent discovers → first draft → verify 3 sections, no $0 packages

---

## Acceptance Criteria

### Functional Requirements

- [x] **Services section shows only agent-created packages** — no $0 defaults visible after first draft
- [x] **Reveal shows exactly 3 sections** — HERO, ABOUT, SERVICES only. No CONTACT, PRICING, CTA, FAQ, TESTIMONIALS
- [x] **Reveal animation is smooth** — no flash of partial content, no reload mid-animation
- [x] **Auto-reveal fires after 3rd section write** — not after 1st
- [x] **Newly provisioned tenants** default to CONTACT/PRICING hidden (`visible: false`)
- [x] **Agent deletes default $0 packages** — both programmatically and via prompt instructions
- [x] **Reveal threshold derived from blueprint** — no hardcoded `3` in frontend

### Non-Functional Requirements

- [x] **No new database migration** — all changes are to defaults, agent prompt, and frontend logic
- [x] **No new API endpoints** — uses existing `manage_packages(delete)` and section visibility
- [x] **Agent deployment required** — system prompt + tool changes require Cloud Run redeploy
- [x] **Backward compatible** — existing tenants with content are unaffected

### Quality Gates

- [x] `npm run --workspace=server typecheck` passes
- [x] `npm run --workspace=apps/web typecheck` passes
- [x] Clean build: `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [ ] Manual E2E: fresh signup → agent discovers → first draft → reveal shows 3 sections, real packages only

---

## Risk Analysis & Mitigation

| Risk                                                               | Severity | Mitigation                                                                                                                                                                                    |
| ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM doesn't follow delete-before-create prompt                     | Medium   | Programmatic fallback in `first-draft.ts` auto-deletes $0 packages. Prompt is belt, code is suspenders.                                                                                       |
| Count-based reveal triggers too early if non-MVP sections counted  | Low      | MVP filter in `first-draft.ts` ensures agent only receives 3 sections. Only `update_section`/`add_section` increment counter.                                                                 |
| Existing tenants with CONTACT visible: true still show placeholder | Low      | Only affects NEW provisioning. Existing tenants who completed onboarding have real content. Mid-onboarding tenants: auto-reveal timing fix prevents showing these.                            |
| Agent tool batching varies across ADK versions                     | Low      | Module-scoped counter is cumulative across batches. Works regardless of batch size.                                                                                                           |
| Cloud Run agent can't import from `@macon/contracts`               | Low      | `first-draft.ts` uses hardcoded `Set` with comment referencing blueprint. Frontend imports from contracts. Two sources, but blueprint is canonical and Cloud Run is a separate deploy target. |
| Module-scoped `let` reset on HMR during dev                        | Low      | Dev-only. HMR resets module state, counter goes to 0, user sees Coming Soon until agent writes again. Production unaffected.                                                                  |

---

## Alternative Approaches Considered

### A. Explicit `REVEAL_SITE` dashboardAction from agent tool

**Rejected.** No existing tool returns this action. Would require modifying a Cloud Run-deployed agent tool, adding LLM prompt instructions to emit it at the right time, and testing LLM compliance. Count-based approach is deterministic.

### B. Backend MVP readiness check

A backend endpoint (`/check-mvp-readiness`) that queries `SectionContent` for HERO, ABOUT, SERVICES with non-placeholder content. Frontend polls.

**Rejected.** Adds latency, requires heuristics for "non-placeholder", introduces new endpoint. Count-based is instant and local.

### C. Frontend package deduplication (filter $0 in `ServicesSection.tsx`)

**Rejected.** Treats symptom, not cause. $0 packages still pollute database, admin views, booking flows.

### D. Zustand `sectionWriteCount` state + `trackSectionWrite` action

**Rejected (during review).** Counter is used in one place. Module-scoped `let` has identical behavior with ~20 fewer LOC and no store surface area. Simplicity reviewer recommendation.

### E. Instruction string update (Phase 1.3 in original plan)

**Rejected (during review).** Agent-native reviewer ruled: the filtered `sectionsToUpdate` array IS the scope instruction. Adding `(HERO, ABOUT, SERVICES)` to the instruction string creates a second source of truth. The existing reveal hint sentence already earns its keep as outcome context.

---

## Test Plan

### Manual E2E (Required Before Merge)

1. **Fresh signup flow:**
   - Create new account → Coming Soon displays
   - Answer agent questions (business type, name, location, services, prices)
   - Agent calls `build_first_draft` → tool programmatically deletes $0 packages → returns only HERO, ABOUT, SERVICES
   - Agent calls `update_section` × 3 (HERO, ABOUT, SERVICES)
   - Agent calls `manage_packages(create)` × 3 (real packages)
   - After 3rd `update_section`: reveal animation plays smoothly
   - Preview shows: HERO + ABOUT + SERVICES (no CONTACT, PRICING, CTA)
   - Services section shows exactly 3 packages with real prices

2. **Returning user flow:**
   - Close browser → reopen dashboard
   - Should see preview immediately (not Coming Soon)
   - All 3 sections visible with real content

3. **Partial failure recovery:**
   - If agent updates 1 section then stops: user stays on Coming Soon (correct)
   - Agent can resume and continue updating remaining sections

---

## References

### Internal References

- Investigation report: `docs/plans/2026-02-07-onboarding-flow-fix-investigation.md`
- E2E test findings: `docs/plans/2026-02-07-playwright-test-findings-report.md`
- Dashboard rebuild plan: `docs/plans/2026-02-06-feat-dashboard-onboarding-rebuild-plan.md`
- Stale iframe solution: `docs/solutions/ui-bugs/ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md`

### Key Code Locations

- `packages/contracts/src/schemas/section-blueprint.schema.ts` — Blueprint (single source of truth)
- `server/src/lib/tenant-defaults.ts:119-222` — DEFAULT_SECTION_CONTENT (visibility flags)
- `server/src/lib/tenant-defaults.ts:28-50` — DEFAULT_PACKAGE_TIERS ($0 packages)
- `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:129-169` — placeholder filter + return
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts:218-249` — First Draft Workflow
- `server/src/agent-v2/deploy/tenant/src/tools/packages.ts:92-176` — manage_packages CRUD
- `apps/web/src/components/agent/AgentPanel.tsx:397-403` — auto-reveal trigger

### Related Commits

- `22ea4796` — Narrow auto-reveal trigger, await fetch before invalidation
- `37249ee2` — Fix reveal flow returning users, premature reveal
- `d9f26097` — Correct preview direction, add MVP build strategy
- `61826b3b` — Prevent premature preview switch and stale iframe content

### Pitfalls Referenced

- Pitfall #26 — Race condition on cache invalidation (add 100ms delay)
- Pitfall #50 — Dual deployment architecture (agent deploys separately)
- Pitfall #51 — Agent deployment verification after merge
- Pitfall #54 — Prompt-only security for tool access (defense-in-depth)
- Pitfall #56 — Type assertion without validation (Zod safeParse)
- Pitfall #86 — Agent says "first draft" but shows placeholders
- Pitfall #92 — Zustand actions bypassing coming_soon state
