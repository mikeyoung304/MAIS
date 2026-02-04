# Guided Refinement Implementation - Handoff Document

**Date:** 2026-02-04
**Phase:** 3 - Implementation Complete
**Last Updated:** Session 3

---

## Session 3 Completed Work (This Session)

### 1. Zustand Refinement Store ✅

- **File:** `apps/web/src/stores/refinement-store.ts`
- **Features:**
  - Mode tracking: interview | draft_build | guided_refine | publish_ready
  - Variant storage per section with selection state
  - Progress tracking (completed/total sections)
  - Loading and error states
  - Widget visibility control
  - Hydration from bootstrap data
- **Exports:** Store hook, external actions, selectors, types
- **Pattern:** Matches existing agent-ui-store pattern (devtools, immer, subscribeWithSelector)

### 2. SectionWidget Component ✅

- **File:** `apps/web/src/components/build-mode/SectionWidget.tsx`
- **Features:**
  - 3 variant pills (Professional/Premium/Friendly) with selection
  - Loading state with spinner
  - Error state with retry button
  - Progress bar showing completion
  - Recommendation banner with rationale
  - Approve & Continue button
  - Edit this section button (when complete)
  - Close button
- **Variants:** Main widget + PublishReadyWidget
- **Styling:** Follows brand guidelines (teal accent, rounded-2xl, shadow-xl)

### 3. AgentPanel Dashboard Action Handlers ✅

- **File:** `apps/web/src/components/agent/AgentPanel.tsx:198-289`
- **New handlers:**
  - `SHOW_VARIANT_WIDGET` - Updates refinement store with variants, shows widget
  - `SHOW_PUBLISH_READY` - Sets publish_ready mode
  - `HIGHLIGHT_NEXT_SECTION` - Scrolls to next section

### 4. DashboardAction Type Extended ✅

- **File:** `apps/web/src/hooks/useConciergeChat.ts:64-91`
- **Added types:** SHOW_VARIANT_WIDGET, SHOW_PUBLISH_READY, HIGHLIGHT_NEXT_SECTION
- **Added fields:** variants, recommendation, rationale, sectionType

### 5. System Prompt Updated ✅

- **File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- **Added sections:**
  - Lead Partner Rule (CRITICAL) - Be confident, lead with recommendations
  - Guided Refinement Mode - Section-by-section flow
  - Preference Memory - Track decision style and tone preferences
  - Financial Safety Protocol - Clarify price vs checkout changes
- **Tool count:** 27 → 33 (added 4 refinement tools + 2 discovery tools)

### 6. Store Exports ✅

- **File:** `apps/web/src/stores/index.ts`
- **Exports:** Full refinement store API with renamed selectors to avoid conflicts

### 7. TypeScript Verification ✅

- Both `apps/web` and `server` compile without errors
- All workspaces verified

---

## Session 2 Completed Work (Previous Session)

### 1. Backend Endpoint `/storefront/generate-variants` ✅

- **File:** `server/src/routes/internal-agent.routes.ts:1673-1871`
- **Features:**
  - Generates 3 tone variants (Professional/Premium/Friendly) via Vertex AI
  - Rate limiting: 10 requests/min per tenant (LRU cache)
  - XSS sanitization via `sanitizeObject()` from `lib/sanitization.ts`
  - Business context injection from tenant branding
- **Schema:** `GenerateSectionVariantsSchema` at line 213-224

### 2. BootstrapData Extended ✅

- **File:** `server/src/services/context-builder.service.ts:170-186`
- **Added:** `guidedRefinementHint` optional field with mode, completedSections, totalSections, currentSectionId

### 3. DashboardAction Schema Extended ✅

- **File:** `packages/contracts/src/schemas/section-content.schema.ts:383-398`
- **Added action types:** SHOW_VARIANT_WIDGET, SHOW_PUBLISH_READY, HIGHLIGHT_NEXT_SECTION
- **Added field:** `variants` array for SHOW_VARIANT_WIDGET

### 4. Bug Fix: Endpoint Path ✅

- **File:** `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts:587`
- **Fixed:** `get_next_incomplete_section` was calling `/storefront/page-structure` (wrong)
- **Changed to:** `/storefront/structure` (correct)

---

## Session 1 Completed Work

### 1. ADK Session State Spike ✅

- **Documentation:** `docs/spikes/2026-02-04-adk-session-state-spike.md`
- **Finding:** `context.state.set()` works; no database pivot needed

### 2. Type Definitions ✅

- **Files:**
  - `server/src/types/guided-refinement.ts` (main codebase)
  - `server/src/agent-v2/deploy/tenant/src/types/guided-refinement.ts` (standalone agent)
- **Contents:** `GuidedRefinementState`, `SectionVariantSet`, `PreferenceMemory`, factory functions

### 3. Refinement Tools (4 tools) ✅

- **File:** `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`
- **Tools:**
  1. `generate_section_variants` (T1) - Generate 3 tone variants
  2. `apply_section_variant` (T2) - Apply selected variant to draft
  3. `mark_section_complete` (T1) - Track completion in state machine
  4. `get_next_incomplete_section` (T1) - Navigate guided flow

### 4. Tool Registration ✅

- 33 tools total registered in tenant-agent

---

## Implementation Complete ✅

All core implementation is done:

| Component            | Status      | File                                                        |
| -------------------- | ----------- | ----------------------------------------------------------- |
| ADK Spike            | ✅ Complete | `docs/spikes/2026-02-04-adk-session-state-spike.md`         |
| Type Definitions     | ✅ Complete | `server/src/types/guided-refinement.ts`                     |
| Refinement Tools (4) | ✅ Complete | `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts` |
| Backend Endpoint     | ✅ Complete | `server/src/routes/internal-agent.routes.ts`                |
| BootstrapData        | ✅ Complete | `server/src/services/context-builder.service.ts`            |
| Contract Types       | ✅ Complete | `packages/contracts/src/schemas/section-content.schema.ts`  |
| Zustand Store        | ✅ Complete | `apps/web/src/stores/refinement-store.ts`                   |
| SectionWidget        | ✅ Complete | `apps/web/src/components/build-mode/SectionWidget.tsx`      |
| AgentPanel Handlers  | ✅ Complete | `apps/web/src/components/agent/AgentPanel.tsx`              |
| System Prompt        | ✅ Complete | `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`   |
| Store Exports        | ✅ Complete | `apps/web/src/stores/index.ts`                              |
| TypeScript           | ✅ Compiles | All workspaces                                              |

---

## Remaining Work (Integration & Testing)

### 1. Widget Integration into Dashboard Layout

- Add `<SectionWidget />` to the dashboard layout component
- Position it to appear in build mode when refinement is active
- Estimated: 30min

### 2. Wire Widget Callbacks to Agent Chat

- Connect `onRefresh` → send message to trigger `generate_section_variants`
- Connect `onSelectVariant` → send message to trigger `apply_section_variant`
- Connect `onMarkComplete` → send message to trigger `mark_section_complete`
- Connect `onNext` → send message to trigger `get_next_incomplete_section`
- Estimated: 1-2h

### 3. E2E Testing

- Test full happy path in <10 minutes
- Test escape hatch "just finish it"
- Test browser close and resume
- Estimated: 2-3h

### 4. Deploy Agent to Cloud Run

- Redeploy tenant-agent with new tools and prompt
- Command: `cd server/src/agent-v2/deploy/tenant && npm run deploy`
- Estimated: 30min

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Journey                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Interview → First Draft → Guided Refine → Publish Ready → Live    │
│                                                                      │
│   ┌─────────┐    ┌─────────┐    ┌─────────────────┐   ┌─────────┐  │
│   │ Collect │    │ Auto-   │    │ Section Widget  │   │ All-or- │  │
│   │ 2-3     │ →  │ generate│ →  │ ● ○ ○ [✓] [↻]  │ → │ Nothing │  │
│   │ Facts   │    │ Draft   │    │ Pro/Prem/Friend │   │ Publish │  │
│   └─────────┘    └─────────┘    └─────────────────┘   └─────────┘  │
│                                                                      │
│   Escape: "just finish it" → Apply defaults → Jump to publish       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Tenant Agent │────▶│ Backend API      │────▶│ Frontend Widget │
│ (ADK)        │     │ (generate-       │     │ (SectionWidget) │
│              │     │  variants)       │     │                 │
│ Tools:       │     │                  │     │ Zustand Store:  │
│ - generate   │◀────│ Returns:         │◀────│ - mode          │
│ - apply      │     │ - 3 variants     │     │ - variants      │
│ - mark done  │     │ - recommendation │     │ - selection     │
│ - get next   │     │ - rationale      │     │ - completed[]   │
└──────────────┘     └──────────────────┘     └─────────────────┘
        │                                              │
        │         ┌─────────────────────┐              │
        └────────▶│ ADK Session State   │◀─────────────┘
                  │ (7+ day persistence)│
                  │ - guidedRefineState │
                  │ - sectionVariants   │
                  │ - preferenceMemory  │
                  └─────────────────────┘
```

---

## Files Modified (Session 3)

| File                                                      | Change                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web/src/stores/refinement-store.ts`                 | Created - Zustand store for refinement UI state                                               |
| `apps/web/src/components/build-mode/SectionWidget.tsx`    | Created - Floating widget component                                                           |
| `apps/web/src/components/agent/AgentPanel.tsx`            | Added import + 3 new dashboard action handlers                                                |
| `apps/web/src/hooks/useConciergeChat.ts`                  | Extended DashboardAction type with new actions                                                |
| `apps/web/src/stores/index.ts`                            | Added refinement store exports                                                                |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` | Added Lead Partner Rule, Guided Refinement Mode, Preference Memory, Financial Safety Protocol |

---

_Handoff updated: 2026-02-04 (Session 3)_
_Status: Implementation complete, integration & testing remaining_
_TypeScript: Compiling_
