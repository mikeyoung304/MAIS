---
title: 'Phase 1: Guided Refinement Implementation'
type: feat
date: 2026-02-04
status: reviewed-with-required-changes
estimated_effort: 24-38 hours
priority: P0
reviewed: 2026-02-04
reviewers:
  [agent-native-reviewer, kieran-typescript-reviewer, architecture-strategist, security-sentinel]
---

# Phase 1: Guided Refinement Implementation

## Overview

Build the complete section-by-section editing experience for HANDLED's AI agent ecosystem. This transforms the onboarding flow from "autonomous first draft → all-or-nothing publish" into a guided refinement journey where users can polish each section with 3 pre-generated tone variants.

**North Star:** "Feel like you brought on a business partner who's a guru in everything you're not."

**Strategic Impact:**

- **Primary wedge:** Speed to live site (<10 min) — beat Wix on time-to-value
- **Secondary wedge:** Post-booking moat (Project Hub) — enabled by this foundation

---

## 🔍 Plan Review Results (2026-02-04)

**Verdict: APPROVED WITH REQUIRED CHANGES**

### Blocking Issues (Must Fix Before Implementation)

| ID  | Issue                                                                                                                              | Fix Required                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| B1  | **State persistence API mismatch** — Plan uses `context.state.set()` but no existing tool uses this. Need spike to verify ADK API. | Run spike (2-4h) OR pivot to backend API persistence via `callMaisApi()` |
| B2  | **Missing Zod safeParse** — All 4 tools lack parameter validation per Pitfall #62/#70                                              | Add `schema.safeParse(params)` as first line of every execute function   |
| B3  | **BootstrapData incomplete** — `guidedRefinementState` not added to interface or implementation                                    | Extend `ContextBuilderService.getBootstrapData()`                        |
| B4  | **XSS in variant storage** — LLM-generated variants bypass sanitization                                                            | Sanitize with DOMPurify before storing in session state                  |

### High Priority Issues

| ID  | Issue                                                                                                        | Fix Required                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| H1  | **DashboardAction type missing** — New action types not in discriminated union                               | Extend type in `packages/contracts/`            |
| H2  | **Trust tier mismatch** — `generate_section_variants` should be T1 (read+generate), not T2                   | Reclassify as T1                                |
| H3  | **Frontend sync undefined** — No hydration strategy for Zustand ↔ ADK state                                 | Add sync on mount + localStorage backup         |
| H4  | **State machine gaps** — Missing `guided_refine → interview` and `publish_ready → guided_refine` transitions | Add "start over" and "edit section" transitions |
| H5  | **"just finish it" lacks guard** — No minimal viable content check                                           | Add guard requiring hero section exists         |
| H6  | **Rate limiting** — No limit on expensive variant generation LLM calls                                       | Add 10/min per tenant limit                     |

### Compliance Checks

| Check                   | Status       | Notes                                                         |
| ----------------------- | ------------ | ------------------------------------------------------------- |
| Active Memory Pattern   | ⚠️ 3/4 PASS  | `generate_section_variants` needs `hasDraft`, `totalSections` |
| Multi-tenant isolation  | ✅ PASS      | Repository layer enforces tenantId filtering                  |
| Trust tier assignments  | ⚠️ NEEDS FIX | See H2 above                                                  |
| State machine deadlocks | ✅ PASS      | No deadlocks detected                                         |

### Required Pre-Implementation Spike

**CRITICAL:** Before writing any implementation code, run a 2-4 hour spike to verify:

1. Does `context.state.set()` work in ADK FunctionTool execute functions?
2. Does session state persist across 7+ days?
3. Log into **Google Cloud Console** via Playwright to check ADK session API docs

If spike reveals ADK limitations, pivot to database persistence pattern.

---

## Problem Statement

The current agent has a working autonomous first draft (fixed 2026-02-03), but:

- No section-by-section refinement workflow
- No user control over individual sections
- All-or-nothing publish (no progressive option)
- Agent doesn't adapt tone to user sentiment
- No preference memory across sessions

**Evidence from external AI evaluations:**

> "The agent is very good — but it doesn't lead enough yet. If a decision affects conversion, clarity, trust, or first impression — the agent leads." — ChatGPT synthesis

> "Without a state machine, the agent can thrash: rewrite the same sections, forget what's approved, or push forward too fast." — Gemini red-team

## Proposed Solution

### Architecture Overview

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

### Component Breakdown

| Component                   | Location                                                  | Effort | Description                                                  |
| --------------------------- | --------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| 1. Tenant Prompt vNext      | `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` | 4-6h   | Lead Partner Rule, Guided Refinement Mode, Preference Memory |
| 2. Section State Machine    | `server/src/services/`, `context-builder.service.ts`      | 4-6h   | Mode tracking, session persistence, state transitions        |
| 3. Floating Widget UI       | `apps/web/src/components/build-mode/SectionWidget.tsx`    | 8-12h  | 3-variant pills, checkmark, refresh, publish CTA             |
| 4. Widget ↔ Agent Contract | `server/src/agent-v2/deploy/tenant/src/tools/`            | 4-6h   | 4 new tools with structured variant responses                |

---

## Technical Approach

### Phase 1a: Section State Machine (4-6 hours)

#### State Interface

```typescript
// server/src/types/guided-refinement.ts

export type RefinementMode =
  | 'interview' // Collecting discovery facts
  | 'draft_build' // Autonomously creating first draft
  | 'guided_refine' // Section-by-section editing with variants
  | 'publish_ready'; // All sections approved, awaiting publish

export interface SectionVariantSet {
  professional: SectionContent;
  premium: SectionContent;
  friendly: SectionContent;
  selectedVariant: 'professional' | 'premium' | 'friendly' | null;
  isComplete: boolean;
  generatedAt: string; // ISO timestamp
}

export interface GuidedRefinementState {
  mode: RefinementMode;
  currentSectionId: string | null;
  completedSections: string[];
  sectionVariants: Record<string, SectionVariantSet>;
  preferenceMemory: {
    preferredTone?: 'professional' | 'premium' | 'friendly';
    decisionStyle?: 'decisive' | 'cautious';
    copyStyle?: 'plainspoken' | 'premium';
  };
  startedAt: string;
  lastActivityAt: string;
}
```

#### State Transitions

| From            | To              | Trigger               | Guard                                        |
| --------------- | --------------- | --------------------- | -------------------------------------------- |
| `interview`     | `draft_build`   | 3+ facts collected    | Has businessType AND uniqueValue             |
| `draft_build`   | `guided_refine` | Draft complete        | All placeholder sections have content        |
| `guided_refine` | `guided_refine` | Section navigation    | Always allowed                               |
| `guided_refine` | `publish_ready` | All sections complete | `completedSections.length === totalSections` |
| `guided_refine` | `interview`     | "start over"          | ⚠️ Warn: will discard draft                  |
| `publish_ready` | `guided_refine` | "edit [section]"      | Unlock specified section                     |
| Any             | `publish_ready` | "just finish it"      | **Guard: Hero section must exist**           |
| `publish_ready` | (published)     | T3 confirmation       | User says "publish" / "ship it"              |

#### Context Builder Extension

```typescript
// server/src/services/context-builder.service.ts (extend BootstrapData)

export interface BootstrapData {
  // ... existing fields

  // NEW: Guided Refinement State
  guidedRefinementState: GuidedRefinementState | null;
  canEnterGuidedRefine: boolean; // true if draft exists
}
```

#### Persistence Strategy

Store `GuidedRefinementState` in ADK session state (not database table):

- ADK already persists session state via `context.state.set()`
- Variants stored as JSON in session (acceptable size: ~10KB for 7 sections)
- On session resume, state loads automatically
- Cleanup: Archived when session expires (7 days)

**Files to modify:**

- `server/src/services/context-builder.service.ts:153-299` — Add guidedRefinementState to bootstrap
- `server/src/types/guided-refinement.ts` — New file for type definitions
- `server/src/agent-v2/deploy/tenant/src/agent.ts:110-200` — Load/save state on each turn

---

### Phase 1b: Tenant Prompt vNext (4-6 hours)

Add the following sections to `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`:

#### Lead Partner Rule

```markdown
## Lead Partner Rule (CRITICAL)

You are not a passive assistant. You're a business partner who happens to be a guru in marketing, copy, and conversion.

When a decision materially affects:

- Conversion (will this make people book?)
- Clarity (will visitors understand immediately?)
- Trust (does this feel professional?)
- First impression (is this memorable?)

You MUST lead with a confident recommendation before offering alternatives.

### Pattern

1. State your recommendation directly
2. Give ONE sentence of rationale
3. Offer at most ONE alternative (not three)
4. Move forward unless user objects

### Example

"I'd go with option 2—it's clearer and converts better for your kind of client. Want to ship that, or tweak the wording?"

### Anti-Pattern (NEVER DO THIS)

"Here are three options:

1. Option A...
2. Option B...
3. Option C...
   Which would you prefer?"

This is delegation, not partnership. Lead.
```

#### Guided Refinement Mode

```markdown
## Guided Refinement Mode (Post First Draft)

After first draft is built, transition to guided refinement:

### Entry

"Your first draft is ready. Want to refine section-by-section, or publish as-is?"

If user chooses refinement:

1. Set mode to 'guided_refine'
2. Start with first section (usually Hero)
3. Generate 3 tone variants: Professional / Premium / Friendly
4. Present your recommended variant with rationale
5. Wait for selection or approval

### Per-Section Flow

1. Call `generate_section_variants(sectionId)`
2. Say: "For your [section name], I'd go with the Professional version—it matches your serious clientele. [Show headline]. Thoughts?"
3. On selection: Call `apply_section_variant(sectionId, 'professional')`
4. On checkmark: Call `mark_section_complete(sectionId)`
5. On "next": Call `get_next_incomplete_section()` and repeat

### Escape Hatches

- "just finish it" → Apply current/default variant for all remaining, jump to publish_ready
- "skip this section" → Mark complete without change, advance
- "go back" → Navigate to previous section, unlock its complete status
- "publish now" → Jump to publish confirmation

### Confirmation Vocabulary (T3)

For publish: require "publish" / "ship it" / "make it live" / "go live"
NOT: "yes" / "sure" / "ok" (too ambiguous)
```

#### Preference Memory

```markdown
## Preference Memory

Store HOW the user makes decisions, not just WHAT their business is.

### Detection Triggers

| User signal                        | Store as                  |
| ---------------------------------- | ------------------------- |
| Selects Premium 2+ times           | preferredTone: 'premium'  |
| "I trust you" / "just do it"       | decisionStyle: 'decisive' |
| "Let me think" / asks clarifying Q | decisionStyle: 'cautious' |
| "No fluff" / "keep it simple"      | copyStyle: 'plainspoken'  |
| "Make it feel expensive"           | copyStyle: 'premium'      |

### Adaptation

- `decisive` → fewer options, faster pace, batch operations
- `cautious` → more explanation, confirm before acting
- `plainspoken` → shorter copy, no marketing speak
- `premium` → luxury tone, sophisticated vocabulary

### Example

After detecting `preferredTone: 'premium'` + `decisionStyle: 'decisive'`:
"Premium headline applied. Moving to About section." (no options, just progress)
```

#### Financial Safety Protocol

```markdown
## Financial Safety Protocol

If user mentions: dollars, price, cost, package pricing, rates, fees

1. PAUSE before acting
2. ASK ONE clarification: "Checkout price or just the display text?"
3. DEFAULT to safe: text-only changes unless explicitly confirmed

### Tool Mapping

- `manage_packages` = REAL MONEY (T3, requires explicit confirmation)
- `update_section(pricing)` = display text only (T2, draft visibility)

### Example

User: "Change my pricing to $500"
Agent: "Got it—want me to update the price shown on your site, or the actual checkout amount?"
```

**Files to modify:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts:1-277` — Add new sections
- `server/src/agent-v2/shared/voice.ts` — Ensure voice rules support new patterns

---

### Phase 1c: Widget ↔ Agent Contract (4-6 hours)

#### New Tools

Create 4 new tools in `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`:

##### 1. generate_section_variants (T1)

```typescript
// Trust Tier: T1 (read + generate in memory, no persistent state change)
// Note: Expensive operation (LLM call), but variants only stored in session

const GenerateSectionVariantsParams = z.object({
  sectionId: z.string().min(1).max(50).describe('Section ID to generate variants for'),
});

export const generateSectionVariantsTool = new FunctionTool({
  name: 'generate_section_variants',
  description: 'Generate 3 tone variants (Professional/Premium/Friendly) for a section',
  parameters: GenerateSectionVariantsParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #62/#70)
    const parseResult = GenerateSectionVariantsParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters', details: parseResult.error.format() };
    }
    const { sectionId } = parseResult.data;

    // Get tenantId via helper (Pitfall: don't use ctx?.tenantId directly)
    const tenantId = getTenantId(context);
    if (!tenantId || !context?.state) {
      return { success: false, error: 'No tenant context available' };
    }

    // 1. Get current section content
    const section = await sectionContentService.getSection(tenantId, sectionId);

    // 2. Generate 3 variants via backend API (not inline LLM call)
    const variants = await callMaisApi('/storefront/generate-variants', tenantId, {
      sectionId,
      tones: ['professional', 'premium', 'friendly'],
    });

    // 3. Sanitize before storing (Pitfall B4: XSS prevention)
    const sanitizedVariants = sanitizeVariantContent(variants);

    // 4. Store in session state (verify this works in spike!)
    context.state.set(`variants:${sectionId}`, sanitizedVariants);

    // 5. Return with Active Memory Pattern fields
    const state = context.state.get<GuidedRefinementState>('guidedRefinementState');
    return {
      success: true,
      sectionId,
      sectionType: section.type,
      variants: {
        professional: {
          headline: sanitizedVariants.professional.headline,
          body: sanitizedVariants.professional.body,
        },
        premium: {
          headline: sanitizedVariants.premium.headline,
          body: sanitizedVariants.premium.body,
        },
        friendly: {
          headline: sanitizedVariants.friendly.headline,
          body: sanitizedVariants.friendly.body,
        },
      },
      recommendation: 'professional',
      rationale: 'Matches your target clientele and builds trust.',
      // Active Memory Pattern additions (review finding)
      hasDraft: true,
      totalSections: 7,
      currentProgress: { completed: state?.completedSections?.length || 0, total: 7 },
      dashboardAction: {
        type: 'SHOW_VARIANT_WIDGET',
        sectionId,
        variants: ['professional', 'premium', 'friendly'],
      },
    };
  },
});
```

##### 2. apply_section_variant (T2)

```typescript
// Trust Tier: T2 (applies to draft, not live)

const ApplySectionVariantParams = z.object({
  sectionId: z.string().min(1).max(50),
  variant: z.enum(['professional', 'premium', 'friendly']),
});

export const applySectionVariantTool = new FunctionTool({
  name: 'apply_section_variant',
  description: 'Apply a selected variant to a section',
  parameters: ApplySectionVariantParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #62/#70)
    const parseResult = ApplySectionVariantParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters', details: parseResult.error.format() };
    }
    const { sectionId, variant } = parseResult.data;

    const tenantId = getTenantId(context);
    if (!tenantId || !context?.state) {
      return { success: false, error: 'No tenant context available' };
    }

    // 1. Get stored variants
    const variants = context.state.get<Record<string, VariantContent>>(`variants:${sectionId}`);
    if (!variants) {
      return {
        success: false,
        error: 'No variants generated. Call generate_section_variants first.',
      };
    }

    // 2. Apply selected variant to draft
    const result = await sectionContentService.updateSection({
      tenantId,
      sectionId,
      content: variants[variant],
      isDraft: true,
    });

    // 3. Update preference memory
    const currentPref = context.state.get<PreferenceMemory>('preferenceMemory') || {};
    const toneHistory = currentPref.toneHistory || [];
    toneHistory.push(variant);
    if (toneHistory.slice(-2).every((t) => t === variant)) {
      currentPref.preferredTone = variant;
    }
    context.state.set('preferenceMemory', currentPref);

    // 4. Return with Active Memory Pattern (Pitfall #52)
    return {
      success: true,
      verified: true,
      visibility: 'draft',
      sectionId,
      appliedVariant: variant,
      updatedContent: result.section,
      hasDraft: true,
      preferenceMemory: currentPref,
      message: `Applied ${variant} variant to ${result.sectionType}.`,
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId,
      },
    };
  },
});
```

##### 3. mark_section_complete (T1)

```typescript
// Trust Tier: T1 (state change only, no content modification)

const MarkSectionCompleteParams = z.object({
  sectionId: z.string().min(1).max(50),
});

export const markSectionCompleteTool = new FunctionTool({
  name: 'mark_section_complete',
  description: 'Mark a section as complete in guided refinement',
  parameters: MarkSectionCompleteParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #62/#70)
    const parseResult = MarkSectionCompleteParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters', details: parseResult.error.format() };
    }
    const { sectionId } = parseResult.data;

    if (!context?.state) {
      return { success: false, error: 'No context available' };
    }

    // 1. Get current state
    const state =
      context.state.get<GuidedRefinementState>('guidedRefinementState') || createInitialState();

    // 2. Mark complete
    if (!state.completedSections.includes(sectionId)) {
      state.completedSections.push(sectionId);
    }

    // 3. Check if all complete
    const totalSections = context.state.get<number>('totalSections') || 7;
    const allComplete = state.completedSections.length >= totalSections;

    if (allComplete) {
      state.mode = 'publish_ready';
    }

    // 4. Save state
    context.state.set('guidedRefinementState', state);

    return {
      success: true,
      sectionId,
      completedSections: state.completedSections,
      totalSections,
      allComplete,
      mode: state.mode,
      message: allComplete
        ? 'All sections complete. Ready to publish!'
        : `${state.completedSections.length}/${totalSections} sections complete.`,
      dashboardAction: allComplete
        ? { type: 'SHOW_PUBLISH_READY' }
        : { type: 'HIGHLIGHT_NEXT_SECTION' },
    };
  },
});
```

##### 4. get_next_incomplete_section (T1)

```typescript
// Trust Tier: T1 (read + state update for currentSectionId tracking)

const GetNextIncompleteSectionParams = z.object({});

export const getNextIncompleteSectionTool = new FunctionTool({
  name: 'get_next_incomplete_section',
  description: 'Get the next section that needs refinement',
  parameters: GetNextIncompleteSectionParams,
  execute: async (params, context: ToolContext | undefined) => {
    // REQUIRED: Zod validation as first line (Pitfall #62/#70)
    const parseResult = GetNextIncompleteSectionParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters', details: parseResult.error.format() };
    }

    const tenantId = getTenantId(context);
    if (!tenantId || !context?.state) {
      return { success: false, error: 'No tenant context available' };
    }

    // 1. Get page structure
    const structure = await sectionContentService.getPageStructure(tenantId);

    // 2. Get completed sections
    const state =
      context.state.get<GuidedRefinementState>('guidedRefinementState') || createInitialState();

    // 3. Find first incomplete
    const allSections = structure.flatMap((page) => page.sections);
    const nextSection = allSections.find((s) => !state.completedSections.includes(s.sectionId));

    if (!nextSection) {
      return {
        success: true,
        allComplete: true,
        mode: 'publish_ready',
        message: 'All sections are complete!',
      };
    }

    // 4. Update current section (note: this modifies state, consider T1-with-state)
    state.currentSectionId = nextSection.sectionId;
    context.state.set('guidedRefinementState', state);

    return {
      success: true,
      allComplete: false,
      nextSection: {
        sectionId: nextSection.sectionId,
        type: nextSection.type,
        headline: nextSection.headline,
        hasVariants: !['contact', 'booking'].includes(nextSection.type),
      },
      progress: {
        completed: state.completedSections.length,
        total: allSections.length,
      },
      dashboardAction: {
        type: 'SCROLL_TO_SECTION',
        sectionId: nextSection.sectionId,
      },
    };
  },
});
```

#### Tool Registration

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/index.ts

// Add to exports
export {
  generateSectionVariantsTool,
  applySectionVariantTool,
  markSectionCompleteTool,
  getNextIncompleteSectionTool,
} from './refinement.js';

// Add to tool array
// T1 (Read)
getNextIncompleteSectionTool,
markSectionCompleteTool,

// T2 (Write to draft)
generateSectionVariantsTool,
applySectionVariantTool,
```

**Files to create/modify:**

- `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts` — New file with 4 tools
- `server/src/agent-v2/deploy/tenant/src/tools/index.ts:1-118` — Register new tools

---

### Phase 1d: Floating Widget UI (8-12 hours)

#### Component Structure

```typescript
// apps/web/src/components/build-mode/SectionWidget.tsx

interface SectionWidgetProps {
  sectionId: string;
  sectionType: string;
  variants: {
    professional: { headline: string; body: string };
    premium: { headline: string; body: string };
    friendly: { headline: string; body: string };
  } | null;
  selectedVariant: 'professional' | 'premium' | 'friendly' | null;
  isComplete: boolean;
  isLoading: boolean;
  onSelectVariant: (variant: 'professional' | 'premium' | 'friendly') => void;
  onMarkComplete: () => void;
  onRefresh: () => void;
}

export function SectionWidget({
  sectionId,
  sectionType,
  variants,
  selectedVariant,
  isComplete,
  isLoading,
  onSelectVariant,
  onMarkComplete,
  onRefresh,
}: SectionWidgetProps) {
  const variantLabels = ['Professional', 'Premium', 'Friendly'] as const;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600 capitalize">
          {sectionType} Section
        </span>
        {isComplete && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Complete
          </span>
        )}
      </div>

      {/* Variant Pills */}
      {variants && !isComplete && (
        <div className="flex gap-2 mb-4">
          {variantLabels.map((label, index) => {
            const variantKey = label.toLowerCase() as 'professional' | 'premium' | 'friendly';
            const isSelected = selectedVariant === variantKey;

            return (
              <button
                key={label}
                onClick={() => onSelectVariant(variantKey)}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all",
                  isSelected
                    ? "bg-teal-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          <span className="ml-2 text-sm text-gray-500">Generating options...</span>
        </div>
      )}

      {/* Action Buttons */}
      {variants && !isComplete && !isLoading && (
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Regenerate variants"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onMarkComplete}
            disabled={!selectedVariant}
            className={cn(
              "flex-1 py-2 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
              selectedVariant
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      )}

      {/* Complete State */}
      {isComplete && (
        <button
          onClick={() => {/* unlock and edit */}}
          className="w-full py-2 px-4 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm"
        >
          Edit this section
        </button>
      )}
    </div>
  );
}
```

#### State Management

```typescript
// apps/web/src/stores/refinement-store.ts

import { create } from 'zustand';

interface RefinementStore {
  mode: 'interview' | 'draft_build' | 'guided_refine' | 'publish_ready' | null;
  currentSectionId: string | null;
  completedSections: string[];
  sectionVariants: Record<
    string,
    {
      professional: { headline: string; body: string };
      premium: { headline: string; body: string };
      friendly: { headline: string; body: string };
      selectedVariant: 'professional' | 'premium' | 'friendly' | null;
    }
  >;
  isLoading: boolean;

  // Actions
  setMode: (mode: RefinementStore['mode']) => void;
  setCurrentSection: (sectionId: string | null) => void;
  setVariants: (sectionId: string, variants: any) => void;
  selectVariant: (sectionId: string, variant: 'professional' | 'premium' | 'friendly') => void;
  markComplete: (sectionId: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useRefinementStore = create<RefinementStore>((set) => ({
  mode: null,
  currentSectionId: null,
  completedSections: [],
  sectionVariants: {},
  isLoading: false,

  setMode: (mode) => set({ mode }),
  setCurrentSection: (sectionId) => set({ currentSectionId: sectionId }),
  setVariants: (sectionId, variants) =>
    set((state) => ({
      sectionVariants: {
        ...state.sectionVariants,
        [sectionId]: { ...variants, selectedVariant: null },
      },
    })),
  selectVariant: (sectionId, variant) =>
    set((state) => ({
      sectionVariants: {
        ...state.sectionVariants,
        [sectionId]: {
          ...state.sectionVariants[sectionId],
          selectedVariant: variant,
        },
      },
    })),
  markComplete: (sectionId) =>
    set((state) => ({
      completedSections: [...state.completedSections, sectionId],
    })),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({
      mode: null,
      currentSectionId: null,
      completedSections: [],
      sectionVariants: {},
      isLoading: false,
    }),
}));
```

#### Agent Panel Integration

```typescript
// apps/web/src/components/agent/AgentPanel.tsx (extend handleDashboardActions)

const handleDashboardActions = useCallback(
  (action: DashboardAction) => {
    switch (action.type) {
      // ... existing cases

      case 'SHOW_VARIANT_WIDGET':
        refinementStore.setVariants(action.sectionId, action.variants);
        refinementStore.setCurrentSection(action.sectionId);
        refinementStore.setMode('guided_refine');
        break;

      case 'SHOW_PUBLISH_READY':
        refinementStore.setMode('publish_ready');
        break;

      case 'HIGHLIGHT_NEXT_SECTION':
        // Scroll to section in preview
        previewRef.current?.scrollToSection(action.sectionId);
        break;
    }
  },
  [refinementStore]
);
```

**Files to create/modify:**

- `apps/web/src/components/build-mode/SectionWidget.tsx` — New component
- `apps/web/src/stores/refinement-store.ts` — New Zustand store
- `apps/web/src/components/agent/AgentPanel.tsx:197-247` — Add dashboard action handlers

---

## Implementation Phases

### Phase 1a: Backend Foundation (Day 1-2) ✅ COMPLETE

- [x] Create `server/src/types/guided-refinement.ts` with state interfaces
- [x] Extend `ContextBuilderService.getBootstrapData()` with refinementState
- [x] Add state persistence to ADK session via `context.state.set/get`
- [ ] Write unit tests for state transitions

### Phase 1b: Agent Tools (Day 2-3) ✅ COMPLETE

- [x] Create `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`
- [x] Implement `generate_section_variants` tool
- [x] Implement `apply_section_variant` tool
- [x] Implement `mark_section_complete` tool
- [x] Implement `get_next_incomplete_section` tool
- [x] Register tools in `index.ts`
- [ ] Write unit tests for each tool

### Phase 1c: System Prompt (Day 3-4) ✅ COMPLETE

- [x] Add Lead Partner Rule section
- [x] Add Guided Refinement Mode section
- [x] Add Preference Memory section
- [x] Add Financial Safety Protocol section
- [ ] Test token count stays under limit
- [ ] Manual testing of agent behavior

### Phase 1d: Widget UI (Day 4-6) ✅ COMPLETE

- [x] Create `SectionWidget` component
- [x] Create `useRefinementStore` Zustand store
- [x] Integrate widget into AgentPanel (dashboard action handlers)
- [x] Add dashboard action handlers
- [x] Style according to brand guidelines
- [x] Add animations and loading states

### Phase 1e: Integration & Testing (Day 6-7)

- [ ] E2E test: full happy path in <10 minutes
- [ ] E2E test: escape hatch "just finish it"
- [ ] E2E test: browser close and resume
- [ ] E2E test: multi-tab conflict detection
- [ ] Add analytics events for completion funnel
- [ ] Performance testing (variant generation time)

---

## Acceptance Criteria

### Functional Requirements

- [ ] After first draft, agent offers "refine or publish" fork
- [ ] Widget displays 3 variant pills with correct labels
- [ ] Clicking variant instantly updates preview (no page reload)
- [ ] Checkmark marks section complete and advances to next
- [ ] Refresh button regenerates all 3 variants
- [ ] "just finish it" applies defaults and jumps to publish
- [ ] "go back" returns to previous section
- [ ] All sections complete → widget shows "Ready to publish"
- [ ] Publish requires T3 confirmation words

### Non-Functional Requirements

- [ ] Time to publish: <10 minutes (measured via analytics)
- [ ] Variant generation: <3 seconds per section
- [ ] Widget renders without CLS (Cumulative Layout Shift)
- [ ] State persists across browser refresh
- [ ] No data leakage between tenants (multi-tenant isolation)

### Quality Gates

- [ ] All new tools have unit tests (>80% coverage)
- [ ] E2E tests pass for happy path and escape hatches
- [ ] System prompt token count <4000 tokens
- [ ] No console errors in browser during flow
- [ ] Lighthouse performance score >90 for build mode page

---

## Success Metrics

| Metric                  | Current | Target  | Measurement                                      |
| ----------------------- | ------- | ------- | ------------------------------------------------ |
| Time to publish         | ~20 min | <10 min | Session logs: first message → publish confirm    |
| Onboarding completion   | Unknown | >80%    | Analytics: start guided_refine → publish         |
| Variant generation time | N/A     | <3s     | Tool latency logs                                |
| Session drop-off        | Unknown | <20%    | Analytics: guided_refine entries without publish |

---

## Dependencies & Prerequisites

### External Dependencies

- ADK session state API (`context.state.set/get`) — already available
- LLM for variant generation — existing Vertex AI setup

### Internal Dependencies

- `SectionContentService` — must support partial updates ✅ already supported
- `ContextBuilderService` — must load/save state ✅ already loads session
- Brand voice rules — must be applied to variants ✅ in `voice.ts`

### Prerequisites

- [ ] Autonomous first draft working (fixed 2026-02-03) ✅
- [ ] `SectionContent` table migrated (Phase 5 complete) ✅
- [ ] Agent Panel dashboard action handler exists ✅

---

## Risk Analysis & Mitigation

| Risk                    | Likelihood | Impact | Mitigation                                                     |
| ----------------------- | ---------- | ------ | -------------------------------------------------------------- |
| Variant generation slow | Medium     | High   | Cache variants in session, generate next section in background |
| Token limit exceeded    | Low        | High   | Keep prompt sections concise, test regularly                   |
| Multi-tab conflicts     | Medium     | Medium | Use optimistic locking, show ConflictDialog                    |
| User confusion          | Medium     | Medium | Clear widget labels, escape hatches always visible             |
| Agent thrashing         | Low        | High   | State machine guards prevent invalid transitions               |

---

## Future Considerations

### Phase 2 Prep

- Preference memory can inform Project Hub interactions
- Variant generation patterns reusable for marketing content
- State machine extensible for other guided flows

### Not In Scope (Explicitly Deferred)

- Progressive per-section publish (all-or-nothing for now)
- User-created custom variants (only Professional/Premium/Friendly)
- A/B testing of variants (future optimization)
- Variant analytics (which variants get selected most)

---

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-04-ai-agent-ecosystem-roadmap-brainstorm.md`
- System Prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts:1-277`
- Tool Pattern: `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts:101-195`
- Agent Panel: `apps/web/src/components/agent/AgentPanel.tsx:197-247`
- Context Builder: `server/src/services/context-builder.service.ts:153-299`
- Active Memory Pattern: `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md`
- Build Mode Vision: `docs/architecture/BUILD_MODE_VISION.md`

### Key Learnings Applied

- **Pitfall #52**: Tools return `verified: boolean` + full state
- **Pitfall #88**: Fact-to-Storefront bridge — call both tools in same turn
- **Pitfall #90**: Extract `dashboardAction` from tool results
- **Pitfall #95**: Autonomous execution without approval loops

### External References

- ADK Session State: Google Vertex AI Agent Development Kit documentation
- Zustand: https://github.com/pmndrs/zustand

---

## Appendix: State Machine Diagram (Updated with Review Findings)

```
                                "start over"
                     ┌────────────────────────────────────────────┐
                     │                                            │
                     ▼                                            │
┌──────────────┐  facts>=3   ┌─────────────┐  draft_done   ┌──────────────┐
│  interview   │ ─────────► │ draft_build │ ────────────► │guided_refine │
└──────────────┘             └─────────────┘                └──────────────┘
       │                                                          │ │
       │ "skip"                                    section_done   │ │
       └────────────────────────────────┐        ┌────────────────┘ │
                                        │        │                   │
                                        ▼        ▼                   │
                                   ┌──────────────┐  "edit section"  │
                        all_done   │              │ ◄────────────────┘
                     ┌─────────────│publish_ready │   "just finish"
                     │             │              │   (guard: hero exists)
                     │             └──────────────┘
                     │                    │
                     │                    │ "publish" (T3)
                     ▼                    ▼
               ┌──────────────────────────────┐
               │         PUBLISHED            │
               └──────────────────────────────┘
```

**New transitions added (review findings):**

- `guided_refine → interview` via "start over" (warns about draft discard)
- `publish_ready → guided_refine` via "edit [section]" (unlocks section)
- Guard on "just finish it": hero section must exist

---

## Fresh Context Prompt for Implementation

Copy this to a new Claude Code window to continue implementation:

````
# Guided Refinement Implementation - Phase 1

## Your Task

Implement the Guided Refinement feature for HANDLED's tenant agent. The plan has been
reviewed and approved with required changes already incorporated.

## CRITICAL FIRST STEP: ADK Session State Spike

Before writing any implementation code, you MUST verify ADK's `context.state.set()` API:

1. **Log into Google Cloud Console** via your Playwright browser window
2. Navigate to Vertex AI > Agent Builder documentation
3. Search for "FunctionTool execute context state" or "session state persistence"
4. Verify whether `context.state.set()` is available in FunctionTool execute functions
5. Document findings in `docs/spikes/2026-02-04-adk-session-state-spike.md`

If `context.state.set()` is NOT available:
- Pivot to backend API persistence pattern: `callMaisApi('/storefront/guided-refinement-state', ...)`
- Update tools to use backend persistence instead of session state

## Context Files to Read

1. **Implementation Plan (with review fixes):**
   `docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md`
   - See "Plan Review Results" section for blocking issues and fixes

2. **Current Tenant Agent:**
   - Prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
   - Tools: `server/src/agent-v2/deploy/tenant/src/tools/`
   - Utils: `server/src/agent-v2/deploy/tenant/src/utils.ts` (see getTenantId pattern)

3. **Existing Tool Patterns:**
   - `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` (Zod safeParse example)
   - `server/src/agent-v2/deploy/tenant/src/tools/draft.ts` (context handling)

4. **Prevention Docs:**
   - `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md`
   - `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`

## Implementation Order

1. [ ] **Spike:** ADK session state API verification (2-4h)
2. [ ] **Types:** Create `server/src/types/guided-refinement.ts`
3. [ ] **Tools:** Create `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`
4. [ ] **Backend:** Create `/storefront/generate-variants` endpoint (for LLM calls)
5. [ ] **Context:** Extend BootstrapData with guidedRefinementState
6. [ ] **Contracts:** Extend DashboardAction type with new action types
7. [ ] **Frontend:** Create Zustand store and SectionWidget component
8. [ ] **Prompt:** Update system.ts with Guided Refinement Mode section
9. [ ] **Tests:** Unit tests for tools, E2E for full flow

## Key Patterns to Follow

### Zod Validation (REQUIRED - Pitfall #62/#70)
```typescript
execute: async (params, context: ToolContext | undefined) => {
  const parseResult = Schema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid parameters', details: parseResult.error.format() };
  }
  const { field } = parseResult.data;
  // ...
}
````

### getTenantId Helper (Don't use ctx?.tenantId)

```typescript
const tenantId = getTenantId(context);
if (!tenantId || !context?.state) {
  return { success: false, error: 'No tenant context available' };
}
```

### Active Memory Pattern (Pitfall #52)

Return full state, not just `{success: true}`:

```typescript
return {
  success: true,
  verified: true,
  visibility: 'draft',
  updatedContent: result,
  hasDraft: true,
  // ... all relevant state for agent context
};
```

## Success Criteria

- [ ] Time to publish: <10 minutes
- [ ] All 4 tools have Zod validation
- [ ] Multi-tenant isolation verified (tenantId in all queries)
- [ ] XSS sanitization on variant content
- [ ] State persists across browser refresh
- [ ] E2E test passes for happy path

## Effort Estimate

24-38 hours total (adjusted from original 20-30 after review)

```

---

*Plan created: 2026-02-04*
*Reviewed: 2026-02-04 (4 parallel agents)*
*Status: Approved with required changes incorporated*
```
