---
title: 'feat: Rebuild Tenant Agent Onboarding Ecosystem'
type: feat
date: 2026-02-05
priority: P0/P1 mixed (6 production bugs + 3 structural gaps)
source: docs/plans/2026-02-05-onboarding-ecosystem-review-handoff.md
---

# Rebuild Tenant Agent Onboarding Ecosystem

## Overview

A ground-up rebuild of the tenant agent onboarding experience, driven by three design principles:

1. **Understand before acting** — One question at a time. Internal reasoning about what each answer reveals. Personality adapts to who's sitting across.
2. **Build with narrative** — Don't just build, explain your reasoning in one sentence. "I did X because Y."
3. **Refine through conversation** — Not "pick A, B, or C." Instead: "Here's what I did. What feels off?"

The tone reference is the [Coding Tutor plugin](~/.claude/plugins/every-marketplace/plugins/coding-tutor/skills/coding-tutor/SKILL.md) — behavioral patterns, not vocabulary lists.

This plan addresses 6 P0 production bugs, 3 P1 structural gaps, and a full system prompt rewrite, in priority order.

**North Star:** "Feel like you brought on a business partner who's a guru in everything you're not."

---

## Problem Statement

### Production Bugs (P0)

1. **Storefront crash chain** — Agent writes content → `sectionsToLandingConfig()` spreads raw SectionContent JSON with field names that don't match Section types (`items` vs `features`, `title` vs `headline`) → components crash on `.map()` of `undefined`
2. **SectionRenderer exhaustive switch crash** — Unknown block types (`SERVICES`, `CUSTOM`) hit `const _exhaustive: never` → React renders a plain object → crash
3. **Preview iframe "Connection Failed"** — Cascading failure from bugs 1 & 2. Storefront crash kills React tree before `BuildModeWrapper` sends `BUILD_MODE_READY` PostMessage.
4. **Onboarding stepper stuck at 1/4** — No phase advancement mechanism exists. Phase stays at `NOT_STARTED` until `COMPLETED` or `SKIPPED`. The 4 intermediate phases (`DISCOVERY` → `MARKET_RESEARCH` → `SERVICES` → `MARKETING`) never fire.
5. **Agent re-asks known questions within session** — `forbiddenSlots` only works cross-session. No prompt instruction to parse messages for already-provided facts before asking.
6. **Agent ignores technical complaints** — Zero coverage in system prompt for when users report something broken.

### Structural Gaps (P1)

7. **Slot machine state module** — The LLM decides non-deterministically when to store facts, build sections, trigger research, and advance phases. A deterministic state machine in `store_discovery_fact`'s return value would tell the agent exactly what to do next.
8. **System prompt rewrite** — Current prompt is 520 lines, feature-organized, one-dimensional personality ("Terse. Cheeky. Confident."). Needs journey-organized structure, emotional range, and the Coding Tutor's behavioral patterns.
9. **`build_first_draft` tool** — Single tool to generate all buildable sections in parallel from current known facts. Replaces fragile 4-7 sequential LLM-coordinated tool calls.

---

## Research Findings

### Local Codebase Analysis

**Crash chain confirmed:**

- `tenant.client.ts:476` — `sectionsToLandingConfig()` uses `...content` spread with `as Section` cast. No field name transformation.
- `FeaturesSection.tsx:100` — `features.map()` with no default. SectionContent stores as `items`, not `features`.
- `PricingSection.tsx:51,84` — `tiers.map()` and `tier.features.map()` with no defaults.
- `TenantLandingPage.tsx:135` — `socialProofBar.items.map()` with no null guard.
- `SectionRenderer.tsx:103` — `const _exhaustive: never = section` crashes on unmapped block types.

**Phase system confirmed broken:**

- `OnboardingPhase` enum has 7 values: `NOT_STARTED`, `DISCOVERY`, `MARKET_RESEARCH`, `SERVICES`, `MARKETING`, `COMPLETED`, `SKIPPED`
- Only `COMPLETED` (via `/complete-onboarding`) and `SKIPPED` (via `/skip-onboarding`) are ever written
- `useComputedPhase.ts` exists with smart placeholder-counting logic — **never called from any UI component**
- `OnboardingProgress.tsx` reads `currentPhase` from API only (always `NOT_STARTED`)

**Slot-policy is robust:**

- `context-builder.service.ts:359-365` computes `forbiddenSlots` from actual stored fact keys
- Injected into ADK session state at session creation
- Cross-session memory works correctly

**Documented solutions exist for:**

- `AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md` — First draft generation pattern
- `FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md` — Store + apply in same turn
- `SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md` — Key-based slot checking
- `DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md` — Migration tracking
- `IFRAME_REFRESH_PREVENTION_INDEX.md` — Preview refresh coordination

### Research Decision

**Skip external research.** The codebase has extensive documented solutions, clear patterns, and all bugs have confirmed root causes with specific file:line references. External research would add no value here.

---

## Verified Implementation Details (Deepened 2026-02-05)

Findings from reading every referenced file. Corrections, additional crash vectors, and implementation specifics organized by phase.

### Schema Field Name Cross-Reference (Root Cause of Bug 1)

The mismatch is MORE complex than initially documented. Two separate type systems use different names:

| Block Type   | SectionContent Schema Fields                          | Landing Page Section Fields                                          | Transformation Needed                                                                                                                        |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| HERO         | `headline`, `subheadline`                             | `headline`, `subheadline`                                            | None                                                                                                                                         |
| ABOUT        | `title`, `body`                                       | `headline`, `content`                                                | `title → headline`, `body → content`                                                                                                         |
| SERVICES     | `title`, `subtitle`                                   | — (no component yet)                                                 | N/A                                                                                                                                          |
| PRICING      | `title`, `subtitle`                                   | `headline`, `subheadline`                                            | `title → headline`, `subtitle → subheadline`                                                                                                 |
| TESTIMONIALS | `title`, `items[]{name, role, image, quote}`          | `headline`, `items[]{authorName, authorRole, authorPhotoUrl, quote}` | `title → headline`, item fields: `name → authorName`, `role → authorRole`, `image → authorPhotoUrl`                                          |
| FAQ          | `title`, `items[]`                                    | `headline`, `items[]`                                                | `title → headline` (items same!)                                                                                                             |
| CONTACT      | `title`, `email`, `phone`, `showForm`, `formFields`   | `headline`, `email`, `phone`, `address`, `hours`                     | `title → headline` (NOTE: `showForm`/`formFields` vs `address`/`hours` diverge — no transform needed, components use whichever fields exist) |
| CTA          | `headline`, `subheadline`, `buttonText`, `buttonLink` | `headline`, `subheadline`, `ctaText`, `ctaLink`                      | `buttonText → ctaText`, `buttonLink → ctaLink`                                                                                               |
| GALLERY      | `title`, `items[]`                                    | `headline`, `images[]`                                               | `title → headline`, `items → images`                                                                                                         |
| FEATURES     | `title`, `subtitle`, `items[]`                        | `headline`, `subheadline`, `features[]`                              | `title → headline`, `subtitle → subheadline`, `items → features`                                                                             |
| CUSTOM       | Pass-through                                          | — (no component)                                                     | N/A                                                                                                                                          |

**Key insight:** `title → headline` is needed for 7 of 11 block types. `items → features` is ONLY needed for FEATURES. `items → images` is ONLY needed for GALLERY. ABOUT needs `body → content` (not in original plan).

### Duplicate BLOCK_TO_SECTION_MAP (Bug Risk)

**Two copies exist** with different ABOUT mappings:

- `apps/web/src/lib/tenant.client.ts:417-429` — maps `ABOUT: 'text'` (legacy!)
- `server/src/lib/block-type-mapper.ts:87-99` — maps `ABOUT: 'about'` (canonical)

The frontend map preserves backward compatibility via `'text'`, but `SectionRenderer.tsx` expects `'text'` type to route to `TextSection` component. **This is intentional** — the frontend uses `'text'` as the display name for ABOUT blocks. The `transformContentForSection()` function must handle BOTH `sectionType === 'text'` AND `sectionType === 'about'` for ABOUT blocks.

### Additional Crash Vectors Not in Original Plan

**A. PricingSection mid-render corruption (CRITICAL)**
`PricingSection.tsx:84` — `tier.features.map()` crashes AFTER the outer `tiers.map()` has started rendering. This means React has partially committed DOM nodes for outer tiers before the inner crash. React error boundary catches it, but the pricing section shows partial render then disappears — worse UX than a clean crash.

**B. PreviewPanel infinite loading (no error recovery)**
`PreviewPanel.tsx:283-286` — Timeout fires but only calls `setIsLoading(false)`. No error state is set. User sees blank panel forever with no retry mechanism. The `error` state and error UI exist (line 513-526) but are never triggered by the timeout path.

**C. TenantLandingPage guard is incomplete**
Line 132 checks `landingConfig?.socialProofBar` exists but does NOT check `landingConfig.socialProofBar.items` exists. If database returns `{ socialProofBar: {} }` with missing `items` field, line 135 crashes.

### Discovery Fact Keys (Complete List — 15 keys)

```
businessType, businessName, location, targetMarket, priceRange,
yearsInBusiness, teamSize, uniqueValue, servicesOffered, specialization,
approach, dreamClient, testimonial, faq, contactInfo
```

These are validated by Zod enum in `discovery.ts:26-42`. The slot machine maps these 15 keys to section readiness thresholds.

### Placeholder Detection (Current Implementation)

`SectionContentService.isPlaceholderContent()` (line 742-755) only checks headline/title for 4 keywords:

- `'welcome'`, `'your headline'`, `'placeholder'`, `'lorem ipsum'`

`getPageStructure()` returns `isPlaceholder: boolean` per section. The `build_first_draft` tool can use this to identify which sections need content, but the detection is naive. **Recommendation:** Also check for empty `body`/`content` fields and sections where ALL text fields match defaults from seed data.

### `useComputedPhase` Complexity (Phase 2 Design Decision)

The existing hook takes `{ apiPhase, draftConfig?, liveConfig? }` and uses placeholder-counting heuristics. AgentPanel would need access to both draft and live config to use it fully.

**However:** If Phase 2 computes phase from fact inventory in the backend (which is deterministic and correct), `useComputedPhase`'s placeholder-counting becomes redundant. **Recommendation:** Use backend-computed phase as primary source. Keep `useComputedPhase` as progressive enhancement only — show local progress while waiting for API response, but always prefer API phase when available.

### Trust Tier System (Comment-Only)

Tool trust tiers (T1/T2/T3) are expressed only via comments in `agent.ts`, not via programmatic metadata. Adding `build_first_draft` at T2 means adding it to the T2 section with a comment. No middleware enforcement exists.

### Current `store_discovery_fact` Return Value

```typescript
{
  stored: true,
  key: string,
  value: any,
  totalFactsKnown: number,
  knownFactKeys: string[],
  message: `Stored ${key} successfully. Now know: ${knownFactKeys.join(', ')}`
}
```

Phase 3 extends this with `SlotMachineResult` fields. The `knownFactKeys` array is already available as input to the slot machine — no additional database query needed.

### System Prompt Verified Section Locations

| Section                      | Actual Lines | Preserve?                                   |
| ---------------------------- | ------------ | ------------------------------------------- |
| Identity + Personality       | 1-27         | REWRITE                                     |
| Session State / Slot-Policy  | 28-37        | PRESERVE (works well)                       |
| Onboarding Conversation      | 39-164       | REWRITE (slot-based)                        |
| First Draft Workflow         | 137-148      | INTEGRATE into slot machine protocol        |
| Fact-to-Storefront Bridge    | 157-162      | INTEGRATE into extract-then-ask             |
| Features Reference           | 182-244      | CONDENSE                                    |
| Preview vs Live              | 247-284      | PRESERVE (critical, correct)                |
| Judgment Criteria (T1/T2/T3) | 286-315      | PRESERVE                                    |
| Grounding                    | 317-324      | PRESERVE                                    |
| Edge Cases                   | 326-363      | EXTEND (add technical complaints)           |
| Quick Reference (34 tools)   | 373-420      | UPDATE (add build_first_draft)              |
| Lead Partner Rule            | 421-449      | PRESERVE (excellent)                        |
| Guided Refinement Mode       | 451-481      | REWRITE (conversational, not variant-based) |
| Preference Memory            | 482-503      | PRESERVE                                    |
| Financial Safety             | 505-520      | PRESERVE                                    |

**Personality at line 21 (exact):** `"Personality: Terse. Cheeky. Confident. You lead, they follow."`

### `update_section` Tool Returns (Phase 5 Reference)

```typescript
{
  success: true,
  verified: true,           // Post-write verification (#812 fix)
  visibility: 'draft',      // ALWAYS draft
  hasDraft: true,
  updatedSection: {...},
  message: 'Section updated in draft...',
  visibilityNote: 'Changes are in DRAFT...',
  dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId }
}
```

The `build_first_draft` tool orchestrates multiple `update_section` calls. Each returns `verified: true/false` — if any returns `verified: false`, the tool should report partial success.

---

## Proposed Solution

### Architecture: The Slot Machine

The central innovation is a **deterministic state machine** that lives in the backend and tells the agent what to do next. Instead of the LLM deciding "should I ask another question or start building?", the slot machine computes it from fact inventory.

```
User answers question
    ↓
Agent calls store_discovery_fact
    ↓
Backend stores fact + runs slot machine
    ↓
Slot machine returns: {
  nextAction: 'ASK' | 'BUILD_SECTION' | 'TRIGGER_RESEARCH' | 'ADVANCE_PHASE',
  readySections: ['hero', 'about'],
  missingForNext: ['servicesOffered'],
  currentPhase: 'DISCOVERY',
  suggestedQuestion: 'Walk me through your packages...'
}
    ↓
Agent follows the instruction deterministically
```

This converts the onboarding from "LLM improvisation" to "LLM personality + deterministic state."

---

## Implementation Phases

### Phase 1: Stop the Bleeding (P0 Bugs 1-3) — Storefront Crash Chain

**Goal:** Zero crashes on any storefront render, regardless of what the agent writes.

#### Task 1.1: Add defensive defaults to vulnerable components

**Files (verified line numbers):**

- `apps/web/src/components/tenant/sections/FeaturesSection.tsx:70,100` — signature + crash
- `apps/web/src/components/tenant/sections/PricingSection.tsx:23,51,84` — signature + two crashes
- `apps/web/src/components/tenant/TenantLandingPage.tsx:132,135` — incomplete guard + crash

**Changes:**

```typescript
// FeaturesSection.tsx:70 — add default to destructuring
export function FeaturesSection({
  headline,
  subheadline,
  features = [],  // ← default (line 70, currently no default)
  columns = 3,
  backgroundColor = 'white',
  tenant: _tenant,
}: FeaturesSectionProps) {
  if (features.length === 0) return null;  // ← add early return
  // ... rest unchanged (crash was at line 100: features.map())
```

```typescript
// PricingSection.tsx:23 — add default to destructuring
export function PricingSection({
  headline,
  subheadline,
  tiers = [],  // ← default (line 23, currently no default)
  backgroundColor = 'white',
  tenant: _tenant,
}: PricingSectionProps) {
  if (tiers.length === 0) return null;  // ← add early return
  // Line 51: tiers.map() — now safe via default
  // Line 84: CRITICAL — change tier.features.map() to (tier.features ?? []).map()
  //   This crashes MID-RENDER after partial tier display (worse UX than clean crash)
```

```typescript
// TenantLandingPage.tsx:132-135 — guard is INCOMPLETE, fix both layers
// Current: checks socialProofBar exists but NOT .items
{landingConfig?.sections?.socialProofBar && landingConfig?.socialProofBar && (
  // ...
  {(landingConfig.socialProofBar?.items ?? []).map((item, i) => (
  // ← Add ?. before .items AND ?? [] fallback
```

#### Task 1.2: Add `transformContentForSection()` field name mapper

**File:** `apps/web/src/lib/tenant.client.ts`

Add a transformation function that maps SectionContent schema fields to Landing Page Section type fields. The mapping is derived from the verified schema cross-reference (see "Verified Implementation Details" above).

**Important:** `sectionType` here will be the FRONTEND type (`'text'` for ABOUT blocks, not `'about'`), because this function is called AFTER `BLOCK_TO_SECTION_MAP` lookup. The frontend map at line 417 maps `ABOUT: 'text'`.

```typescript
function transformContentForSection(
  sectionType: string,
  content: Record<string, unknown>
): Record<string, unknown> {
  const transformed = { ...content };

  // --- Universal field renames (7 of 11 block types need title → headline) ---
  // HERO and CTA already use 'headline' in SectionContent schema, so this is safe
  if ('title' in transformed && !('headline' in transformed)) {
    transformed.headline = transformed.title;
    delete transformed.title;
  }
  if ('subtitle' in transformed && !('subheadline' in transformed)) {
    transformed.subheadline = transformed.subtitle;
    delete transformed.subtitle;
  }

  // --- ABOUT-specific: body → content (TextSection uses 'content' not 'body') ---
  if (sectionType === 'text' && 'body' in transformed && !('content' in transformed)) {
    transformed.content = transformed.body;
    delete transformed.body;
  }

  // --- FEATURES-specific: items → features ---
  if (sectionType === 'features' && 'items' in transformed && !('features' in transformed)) {
    transformed.features = transformed.items;
    delete transformed.items;
  }

  // --- GALLERY-specific: items → images ---
  if (sectionType === 'gallery' && 'items' in transformed && !('images' in transformed)) {
    transformed.images = transformed.items;
    delete transformed.items;
  }

  // --- CTA-specific: buttonText → ctaText, buttonLink → ctaLink ---
  if (sectionType === 'cta') {
    if ('buttonText' in transformed && !('ctaText' in transformed)) {
      transformed.ctaText = transformed.buttonText;
      delete transformed.buttonText;
    }
    if ('buttonLink' in transformed && !('ctaLink' in transformed)) {
      transformed.ctaLink = transformed.buttonLink;
      delete transformed.buttonLink;
    }
  }

  // --- TESTIMONIALS-specific: item-level field renames ---
  if (sectionType === 'testimonials' && Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => ({
      ...item,
      ...(item.name && !item.authorName ? { authorName: item.name } : {}),
      ...(item.role && !item.authorRole ? { authorRole: item.role } : {}),
      ...(item.image && !item.authorPhotoUrl ? { authorPhotoUrl: item.image } : {}),
    }));
    // Clean up old field names from each item
    (transformed.items as Record<string, unknown>[]).forEach((item) => {
      if (item.authorName && item.name) delete item.name;
      if (item.authorRole && item.role) delete item.role;
      if (item.authorPhotoUrl && item.image) delete item.image;
    });
  }

  // NOTE: FAQ uses 'items' in BOTH schemas — no transform needed

  return transformed;
}
```

Wire into `sectionsToLandingConfig()` at line ~476:

```typescript
const transformedContent = transformContentForSection(sectionType, content);
const legacySection = {
  id: section.id,
  type: sectionType as Section['type'],
  ...transformedContent, // ← use transformed, not raw
} as Section;
```

**Edge case:** If agent writes content using Landing Page field names (e.g., `headline` instead of `title`), the transform is a no-op because the `if ('title' in transformed && !('headline' in transformed))` guard prevents double-mapping. This makes the function idempotent.

#### Task 1.3: Fix SectionRenderer exhaustive switch

**File:** `apps/web/src/components/tenant/SectionRenderer.tsx:102-105`

Current code: `const _exhaustive: never = section; return _exhaustive;` — at runtime, this assigns the section object to `_exhaustive` and returns it. React then tries to render a plain object → crash: `"Objects are not valid as a React child"`.

Replace the `never` assertion with graceful null return:

```typescript
default: {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[SectionRenderer] Unknown section type: ${(section as { type: string }).type}`);
  }
  return null;
}
```

Also in `apps/web/src/lib/tenant.client.ts` — filter unknown types in `sectionsToLandingConfig()`:

```typescript
// After BLOCK_TO_SECTION_MAP lookup (line ~467)
const KNOWN_SECTION_TYPES = new Set([
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
]);

// Inside the for loop, after computing sectionType:
if (!KNOWN_SECTION_TYPES.has(sectionType)) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[sectionsToLandingConfig] Skipping unknown section type: ${sectionType} (blockType: ${section.blockType})`
    );
  }
  continue; // Skip SERVICES and CUSTOM — no components exist for them
}
```

**Note:** `SERVICES` and `CUSTOM` are in `BLOCK_TO_SECTION_MAP` at line 417 but have no corresponding React components. Don't remove them from the map (agents might write them) — just filter them out before rendering.

#### Task 1.4: Fix PreviewPanel timeout → infinite loading (no error recovery)

**File:** `apps/web/src/components/preview/PreviewPanel.tsx:278-289`

**Current bug:** `handleIframeLoad` sets a timeout (line 283) that fires if `BUILD_MODE_READY` PostMessage never arrives. But the timeout handler only calls `setIsLoading(false)` — it does NOT set any error state. Result: blank panel forever, no retry button.

The error state and error UI already exist at lines 513-526 but are never triggered by the timeout path.

```typescript
// In handleIframeLoad timeout handler (line 283-286):
iframeReadyTimeoutRef.current = setTimeout(() => {
  if (!isIframeReady) {
    setIsLoading(false);
    setError('Preview failed to connect. This usually means the storefront had a rendering error.');
    // ← ADD: set error state so existing error UI (lines 513-526) renders
  }
}, BUILD_MODE_CONFIG.timing.iframeReadyTimeout);
```

Also add retry mechanism:

```typescript
const retryConnection = useCallback(() => {
  setError(null);
  setIsLoading(true);
  setIsIframeReady(false);
  if (iframeRef.current) {
    iframeRef.current.src = iframeRef.current.src; // Force reload
  }
}, []);

// Wire into existing error UI at lines 513-526:
// Add <button onClick={retryConnection}>Retry</button> to error display
```

**Acceptance Criteria:**

- [x] `FeaturesSection` renders without crash when `features` is undefined
- [x] `PricingSection` renders without crash when `tiers` is undefined or `tier.features` is undefined
- [x] `PricingSection` does not partially render tiers before crashing on inner `tier.features`
- [x] `TenantLandingPage` renders without crash when `socialProofBar.items` is undefined
- [x] SectionContent with `items` field renders correctly as `features` in FeaturesSection
- [x] SectionContent with `title` field renders correctly as `headline`
- [x] SectionContent ABOUT block: `body` transforms to `content` for TextSection
- [x] Transform is idempotent — content already using Landing Page field names passes through unchanged
- [x] Unknown section types (SERVICES, CUSTOM) render as null, not crash
- [x] Unknown section types logged in development mode
- [x] Preview panel shows friendly error on connection timeout (uses existing error UI at lines 513-526)
- [x] Preview panel has working Retry button that reloads iframe

---

### Phase 2: Fix the Stepper (P0 Bug 4) — Phase Advancement

**Goal:** Onboarding stepper advances through 4 phases based on fact gathering progress.

#### Task 2.1: Add phase computation to `store_discovery_fact` endpoint

**File:** `server/src/routes/internal-agent.routes.ts` (lines 585-656, endpoint handler at ~613)

**Current return value (verified):**

```typescript
{ stored: true, key, value, totalFactsKnown: number, knownFactKeys: string[], message: string }
```

After storing the fact, compute and write the new phase:

```typescript
// After successful fact storage:
const newPhase = computeCurrentPhase(knownFactKeys);
const currentPhase = tenant.onboardingPhase;

if (phaseOrder(newPhase) > phaseOrder(currentPhase)) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { onboardingPhase: newPhase },
  });
}

// Return phase info to agent:
return {
  stored: true,
  key,
  value,
  totalFactsKnown: knownFactKeys.length,
  knownFactKeys,
  currentPhase: newPhase,
  phaseAdvanced: newPhase !== currentPhase,
};
```

Phase computation logic:

```typescript
function computeCurrentPhase(knownFactKeys: string[]): OnboardingPhase {
  const has = (key: string) => knownFactKeys.includes(key);

  // MARKETING requires: uniqueValue OR testimonial
  if (has('uniqueValue') || has('testimonial')) return 'MARKETING';

  // SERVICES requires: servicesOffered OR priceRange
  if (has('servicesOffered') || has('priceRange')) return 'SERVICES';

  // MARKET_RESEARCH requires: location (triggers research agent)
  if (has('location')) return 'MARKET_RESEARCH';

  // DISCOVERY requires: businessType
  if (has('businessType')) return 'DISCOVERY';

  return 'NOT_STARTED';
}

function phaseOrder(phase: OnboardingPhase): number {
  const order: Record<OnboardingPhase, number> = {
    NOT_STARTED: 0,
    DISCOVERY: 1,
    MARKET_RESEARCH: 2,
    SERVICES: 3,
    MARKETING: 4,
    COMPLETED: 5,
    SKIPPED: 5,
  };
  return order[phase] ?? 0;
}
```

#### Task 2.2: Wire backend-computed phase into the UI

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

**Current state (verified):** AgentPanel at line 119 destructures `currentPhase` directly from `useOnboardingState()` and passes it to `OnboardingProgress` at lines 51, 477, 616. `useComputedPhase` is never imported or called.

**Design decision:** The `useComputedPhase` hook exists and uses placeholder-counting heuristics, BUT it requires `draftConfig` and `liveConfig` props that AgentPanel doesn't currently have access to. Since Phase 2 Task 2.1 adds deterministic fact-based phase computation to the backend, **use backend phase as the primary source** — it's more reliable than placeholder counting.

The simplest wiring is: once Task 2.1 is done, the API phase returned by `useOnboardingState()` will already be correct (because `/store-discovery-fact` now advances it). No `useComputedPhase` integration needed — just ensure cache invalidation (Task 2.3) triggers a refetch.

```typescript
// AgentPanel.tsx — NO CHANGE to phase source needed
// The currentPhase from useOnboardingState() will now advance correctly
// because the backend updates tenant.onboardingPhase on every fact storage
const { currentPhase, isOnboarding, skipOnboarding, isSkipping, skipError } = useOnboardingState();
```

**OnboardingProgress.tsx (verified):** Uses `PHASES = ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING']` (hardcoded 4 phases). Phase index is computed via `PHASES.indexOf(currentPhase)`. Display: `{phaseName} ({index + 1}/4)`. This is correct and needs no changes.

**Optional progressive enhancement:** If we want the stepper to update BEFORE the API roundtrip completes (optimistic), we could wire `useComputedPhase` as a secondary source. But this adds complexity and the API roundtrip for `/store-discovery-fact` is already fast (~200ms). **Recommend: skip this for now.**

#### Task 2.3: Invalidate onboarding state cache on phase advancement

**File:** `apps/web/src/hooks/useOnboardingState.ts`

**Current state (verified):** Cache key is `queryKeys.onboarding.state`, `staleTime: 60_000` (1 minute). Fetches from `/api/tenant-admin/agent/tenant/onboarding-state`. Has `refetch()` method.

The `staleTime: 60_000` means after the agent stores a fact and advances the phase, the UI won't see the new phase for up to 60 seconds. Two approaches:

**Option A (recommended):** In `useTenantAgentChat.ts`, after the agent completes a `store_discovery_fact` tool call, call `queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state })`. This triggers an immediate refetch.

**Option B:** Reduce `staleTime` to 0 for the onboarding state query. Simpler but increases API calls.

**Detection:** The agent chat hook already processes tool calls via `handleTenantAgentToolComplete` in `AgentPanel.tsx:~line 295`. Add phase invalidation there when `toolName === 'store_discovery_fact'`.

**Acceptance Criteria:**

- [x] Storing `businessType` advances phase from `NOT_STARTED` → `DISCOVERY`
- [x] Storing `location` advances to `MARKET_RESEARCH`
- [x] Storing `servicesOffered` advances to `SERVICES`
- [x] Storing `uniqueValue` or `testimonial` advances to `MARKETING`
- [x] Phase never moves backward
- [x] Stepper UI updates within 2 seconds of phase advancement

---

### Phase 3: Slot Machine (P1 Gap 7) — The Core State Engine

**Goal:** `store_discovery_fact` returns deterministic instructions telling the agent what to do next.

#### Task 3.1: Create `slot-machine.ts` module

**File:** `server/src/lib/slot-machine.ts` (NEW — backend lib, NOT inside agent deploy directory)

```typescript
interface SlotMachineResult {
  // What to do next
  nextAction:
    | 'ASK'
    | 'BUILD_SECTION'
    | 'BUILD_FIRST_DRAFT'
    | 'TRIGGER_RESEARCH'
    | 'OFFER_REFINEMENT';

  // Current phase
  currentPhase: OnboardingPhase;
  phaseAdvanced: boolean;

  // Which sections are ready to build
  readySections: SectionType[];

  // What's still needed for the next milestone
  missingForNext: { key: string; question: string }[];

  // NOTE: shouldTriggerResearch and shouldBuildFirstDraft are NOT separate booleans —
  // they're expressed via nextAction === 'TRIGGER_RESEARCH' or 'BUILD_FIRST_DRAFT'.
  // Single source of truth avoids contradictory states (e.g., nextAction='ASK' + shouldBuild=true).

  // Slot utilization
  slotMetrics: {
    filled: number;
    total: number;
    utilization: number; // 0-100
  };
}
```

**Section readiness thresholds:**

| Section      | Required Facts                                 | Priority |
| ------------ | ---------------------------------------------- | -------- |
| HERO         | `businessType`                                 | SHOULD   |
| ABOUT        | `businessType` + (`uniqueValue` OR `approach`) | SHOULD   |
| SERVICES     | `servicesOffered`                              | MUST     |
| PRICING      | `servicesOffered` + `priceRange`               | IDEAL    |
| FAQ          | `businessType` + `servicesOffered`             | IDEAL    |
| CONTACT/CTA  | `businessType`                                 | SHOULD   |
| TESTIMONIALS | `testimonial`                                  | IDEAL    |
| GALLERY      | (not auto-buildable — requires images)         | FUTURE   |

**First draft trigger:** When `businessType` + `location` + ONE of (`servicesOffered`, `uniqueValue`, `dreamClient`) are known → `nextAction: 'BUILD_FIRST_DRAFT'`.

**Research trigger:** When `businessType` + `location` are known but research hasn't been run → `nextAction: 'TRIGGER_RESEARCH'`.

#### Task 3.2: Integrate slot machine into backend endpoint

**File:** `server/src/routes/internal-agent.routes.ts` (lines 585-656)

The `/store-discovery-fact` endpoint should be extended (building on Task 2.1):

1. Store the fact (existing — line ~622)
2. Compute `knownFactKeys` (existing — line ~644)
3. Compute new phase via `computeCurrentPhase(knownFactKeys)` (Task 2.1)
4. Run `computeSlotMachine(knownFactKeys)` — imported from `slot-machine.ts`
5. Merge results into response

```typescript
// After existing fact storage (line ~644):
const knownFactKeys = Object.keys(discoveryFacts);
const newPhase = computeCurrentPhase(knownFactKeys);
const slotResult = computeSlotMachine(knownFactKeys, newPhase);

return {
  stored: true,
  key,
  value,
  totalFactsKnown: knownFactKeys.length,
  knownFactKeys,
  ...slotResult, // nextAction, readySections, missingForNext, etc.
};
```

**Design choice:** Slot machine runs in the BACKEND endpoint, not in the agent tool. This means:

- Slot machine is a pure function importable from `server/src/lib/slot-machine.ts` (not inside agent deploy directory)
- Can be unit tested without ADK
- Agent tool (`discovery.ts`) just passes through the backend response
- No duplicate logic between agent and backend

#### Task 3.3: Pass slot machine result through agent tool

**File:** `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts`

The `store_discovery_fact` tool (lines 113-146) calls `callMaisApi('/store-discovery-fact', ...)`. The backend now returns slot machine fields. The tool just passes them through:

```typescript
// Current return (line 136-146):
return {
  stored: true,
  key,
  value,
  totalFactsKnown: result.totalFactsKnown,
  knownFactKeys: result.knownFactKeys,
  // ADD: pass through slot machine fields
  nextAction: result.nextAction,
  readySections: result.readySections,
  missingForNext: result.missingForNext,
  currentPhase: result.currentPhase,
  phaseAdvanced: result.phaseAdvanced,
};
```

The agent's system prompt (Phase 4) will instruct it to follow `nextAction` deterministically.

**Acceptance Criteria:**

- [x] `store_discovery_fact` returns `nextAction` field telling agent what to do
- [x] After storing `businessType` + `location`, result includes `nextAction: 'TRIGGER_RESEARCH'`
- [x] After storing 3+ facts matching first draft threshold, result includes `nextAction: 'BUILD_FIRST_DRAFT'`
- [x] `readySections` array correctly lists sections whose fact requirements are met
- [x] `missingForNext` correctly identifies the next most valuable question to ask
- [x] Slot machine is a pure function with no database dependencies (only takes `knownFactKeys`)

---

### Phase 4: System Prompt Rewrite (P1 Gap 8 + P0 Bugs 5-6)

**Goal:** Replace the 520-line feature-organized prompt with a journey-organized prompt that uses the Coding Tutor's behavioral patterns.

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

This is the highest-impact change. The new prompt must:

#### Design Principles (from Coding Tutor)

1. **Know your user before acting** — "Before teaching anything, you need to understand who you're teaching." → Before building anything, understand their business, tone, and ambition.

2. **Meet them where they are** — "Use their vocabulary. Reference their past struggles." → If they say "elopements" don't translate to "weddings." Mirror their language.

3. **Calibrate over time** — "A learner with 3 tutorials is different from one with 30." → A tenant 2 minutes in needs warmth. A tenant 10 minutes in needs speed.

4. **Show the why** — "Start with the 'why': not 'here's how callbacks work' but 'here's the problem in your code that callbacks solve.'" → Not "I updated your hero." Say "Your hero is the first thing clients see — I gave it a headline that tells them what you do."

5. **Refine as conversation** — "A quiz isn't an exam — it's a conversation that reveals understanding." → Refinement isn't "pick A, B, or C." It's "Here's what I did. What feels off?"

6. **Predict confusion** — "Address the questions they're likely to ask before they ask them." → "I put packages lowest to highest — clients anchor on the first number, so starting lower gets more clicks."

#### Structural Changes

**FROM** (current — feature-organized):

```
Identity → Core Behavior → Features → Judgment → Grounding → Edge Cases → ...
```

**TO** (new — journey-organized):

```
Identity & Personality Range → The Onboarding Journey → Slot Machine Protocol →
Build With Narrative → Refine Through Conversation → Technical Issue Reports →
Features Reference → Safety
```

#### Key Sections to Write

**4.1: Identity & Personality Range**

Replace `"Personality: Terse. Cheeky. Confident. You lead, they follow."` with a personality that **adapts**:

```
You're a business partner who happens to be a guru in marketing, copy, and conversion.
Your personality is not one note. Read the room:

| They're giving you...     | You respond with...                           |
|--------------------------|-----------------------------------------------|
| Excitement, long answers | Match their energy. Celebrate specifics.       |
| Short answers, impatience| Speed up. Less banter, more progress.          |
| Uncertainty, "I don't know" | Gentle guidance. Give them a starting point.|
| Technical complaints     | Acknowledge first. Fix second. Explain third.  |
| Creative tangents        | Let them run. Extract the gold. Organize later.|

The constant: you always lead with a recommendation. You never present 3 options and ask them to pick.
```

**4.2: The Onboarding Journey (slot-based, not rigid phases)**

Replace the rigid Phase 1/2/3 question sequence with slot-based gathering:

```
Your job is to fill slots, not follow a script. The slot machine tells you what to do next.

When store_discovery_fact returns nextAction:
- 'ASK' → Ask the question from missingForNext[0]
- 'BUILD_SECTION' → Build the sections listed in readySections
- 'BUILD_FIRST_DRAFT' → Call build_first_draft for all ready sections
- 'TRIGGER_RESEARCH' → Call delegate_to_research with businessType + location
- 'OFFER_REFINEMENT' → Announce draft is ready and offer refinement

You do NOT decide when to build or when to research. The slot machine decides.
You DO decide HOW to ask, WHAT tone to use, and HOW to explain what you built.
```

**4.3: Extract-Then-Ask (fixes Bug 5 — re-asking known questions)**

```
Before asking ANY question, extract facts from what the user already said.

User says: "I'm Sarah, I'm a wedding photographer in Austin and I've been doing this for 8 years."
You extract: businessType=wedding photographer, location=Austin, yearsInBusiness=8
You store: 3 calls to store_discovery_fact
You respond: "8 years shooting weddings in Austin—that's a solid run. [follow up with next missing slot]"

You do NOT ask "What do you do?" after they just told you.
```

**4.4: Build With Narrative**

```
When you build or update content, explain WHY in one sentence.

WRONG: "Updated your hero section."
RIGHT: "Your hero is the first thing clients see. I gave it a headline that says exactly what you do and where — 'Austin Wedding Photography by Sarah.' Clean, searchable, true."

WRONG: "Added 3 packages."
RIGHT: "I set up three tiers — Mini, Standard, and Full Day. Starting at $1,800 gives browsers an anchor point, and the Full Day at $4,500 signals you're not the budget option. Most Austin photographers charge $3-6K, so you're right in the sweet spot."
```

**4.5: Refine Through Conversation (not "pick A, B, or C")**

```
After building, invite feedback conversationally:
"Here's what I wrote for your about section. Tell me what feels off — I'll rewrite the parts that don't sound like you."

NOT: "Here are 3 options: A) Professional B) Warm C) Bold. Which do you prefer?"

If they say "it's too formal":
"Got it — loosening it up. [rewrite]. Better?"

If they say "I love it":
"Done. Moving on to [next section]."
```

**4.6: Technical Issue Reports (fixes Bug 6)**

```
When a user reports something broken ("my site isn't showing up", "the preview is blank",
"I can't see my changes"):

1. Acknowledge: "That's not right. Let me check."
2. Diagnose: Call get_page_structure to verify content state.
   Check if changes are in draft vs. live. Check if sections have content.
3. Fix if possible: If it's a draft/live confusion, explain and offer to publish.
   If content is missing, offer to rebuild.
4. Escalate if not: "I can see the content is saved correctly on my end. This might be
   a display issue — want me to flag it for the team?"

You are NOT a help desk robot. You're their partner. If something broke, take ownership.
```

**4.7: Sections to Preserve As-Is**

These sections from the current prompt are well-written and should be kept with minimal changes:

- **Preview vs Live (lines 247-277)** — visibility rule, correct patterns, wrong patterns
- **Lead Partner Rule (lines 421-449)** — recommendation-first, anti-pattern list
- **Financial Safety Protocol (lines 505-520)** — checkout vs display text disambiguation
- **Package Management (lines 210-235)** — manage_packages vs update_section distinction
- **Confirmation vocabulary** — keep `got it | done | on it | heard | bet | take a look`
- **Forbidden words table** — keep the technical→natural mapping

**Acceptance Criteria:**

- [x] Prompt is journey-organized, not feature-organized
- [x] Personality section describes behavioral range, not fixed traits
- [x] Slot machine protocol section tells agent to follow `nextAction`
- [x] Extract-then-ask rule is explicit with examples
- [x] Build-with-narrative section has 3+ examples
- [x] Refine-as-conversation section replaces variant-picking pattern
- [x] Technical issue handling section exists with acknowledge→diagnose→fix→escalate flow
- [x] Preview vs Live, Lead Partner, Financial Safety preserved
- [x] Total prompt length stays under 400 lines (reduced from 520) — actual: 345
- [x] Zero occurrences of "Here are three options" pattern

---

### Phase 5: `build_first_draft` Tool (P1 Gap 9)

**Goal:** Single tool call that generates and applies all buildable sections in parallel.

#### Task 5.1: Design decision — Agent-orchestrated vs. backend-orchestrated

**Two approaches for `build_first_draft`:**

**Option A: Agent-orchestrated (RECOMMENDED)**
The LLM generates personalized copy for each section and calls existing `update_section` tool multiple times in the same turn. No new backend endpoint needed. The "tool" is really a system prompt instruction + the slot machine trigger.

**Why this is better:**

- Copy generation is the LLM's strength — it uses tone, facts, and market research to write
- Existing `update_section` tool already has verification, error handling, and `dashboardAction` returns
- No new backend endpoint to maintain
- Already partially documented in the system prompt at lines 137-148

**Option B: Backend-orchestrated (REJECTED)**
A new `POST /build-first-draft` endpoint that calls `SectionContentService.updateSection()` for each section. But this means the BACKEND generates copy, which requires a separate LLM call from the backend — duplicating the agent's capabilities.

#### Task 5.1: Create `build_first_draft` agent tool (agent-orchestrated)

**File:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` (NEW)

This is an ORCHESTRATOR tool — it doesn't generate copy, it:

1. Calls backend `get_page_structure` to get all section IDs and identify placeholders
2. Uses `SectionContentService.getPageStructure()` which returns `isPlaceholder: boolean` per section (verified — uses `isPlaceholderContent()` at line 742-755 which checks headline for 'welcome', 'your headline', 'placeholder', 'lorem ipsum')
3. Returns the list of placeholder sections + known facts as structured data
4. The LLM then generates copy for each section and calls `update_section` for each

```typescript
// first-draft.ts — FunctionTool definition
const buildFirstDraftTool = new FunctionTool({
  name: 'build_first_draft',
  description:
    'Identifies all placeholder sections that need content and returns them with known facts. After calling this, generate personalized copy for each section and call update_section for each one.',
  parameters: z.object({
    tenantId: z.string().min(1),
  }),
  async execute(params, context) {
    const parsed = schema.safeParse(params); // Pitfall #56
    if (!parsed.success) return { success: false, error: parsed.error.message };

    // 1. Get page structure with placeholder flags
    const structure = await callMaisApi('/storefront/page-structure', tenantId, {});

    // 2. Get known facts + slot machine result from backend
    // NOTE: computeSlotMachine() lives in server/src/lib/ which agent deploy CANNOT import.
    // Instead, call the backend API which already runs the slot machine and returns readySections.
    const facts = await callMaisApi('/get-known-facts', tenantId, {});
    const readySections: string[] = facts.readySections ?? [];

    // 3. Filter to placeholder sections that are ready
    const placeholderSections = structure.pages
      .flatMap((p) => p.sections)
      .filter((s) => s.isPlaceholder && readySections.includes(s.type));

    return {
      success: true,
      sectionsToUpdate: placeholderSections.map((s) => ({
        sectionId: s.id,
        sectionType: s.type,
        currentContent: s.content, // So agent can see what to replace
      })),
      knownFacts: facts.discoveryFacts,
      instruction: `Generate personalized content for each section below, then call update_section for each. Explain WHY you wrote what you wrote.`,
      dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId: placeholderSections[0]?.id },
    };
  },
});
```

**Important caveat on placeholder detection:** The current `isPlaceholderContent()` only checks 4 headline keywords (`welcome`, `your headline`, `placeholder`, `lorem ipsum`) via substring match. Two gaps: (1) bracket-format placeholders like `[Your Transformation Headline]` won't be caught, and (2) agent-reverted sections won't be detected. **Acceptable for v1** — the slot machine's `readySections` provides the primary filter (only sections whose fact requirements are met), and `isPlaceholder` is a secondary defense.

#### Task 5.2: Register tool in agent definition

**File:** `server/src/agent-v2/deploy/tenant/src/agent.ts`

Add `build_first_draft` to the tool registry at T2 trust tier.

**Acceptance Criteria:**

- [x] Single tool call builds all ready sections
- [x] Placeholder sections are identified and replaced
- [x] Non-placeholder sections are not overwritten
- [x] Tool returns list of sections built
- [x] Tool triggers scroll_to_website_section for the first built section
- [x] Agent announces what it built with narrative ("I built your hero because...")

---

## Alternative Approaches Considered

### 1. Frontend-only phase computation (rejected)

Could wire `useComputedPhase` as the sole phase source and skip backend phase advancement entirely. **Rejected** because: (a) the agent needs phase info at session creation time, which is backend-only, and (b) placeholder counting is a heuristic — fact-based phase computation is deterministic and correct.

### 2. Full ADK state machine (rejected)

Could implement the slot machine as ADK session state transitions. **Rejected** because: (a) ADK state is session-scoped, but phase should persist across sessions, (b) adding state machine logic to the prompt makes it fragile, (c) backend computation is testable and deterministic.

### 3. Separate phase advancement API (rejected)

Could create a dedicated `POST /advance-phase` endpoint that the agent calls explicitly. **Rejected** because: (a) adds a tool the LLM must remember to call, (b) the slot machine can compute phase automatically from fact inventory, (c) fewer tools = fewer failure modes.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Zero storefront rendering crashes regardless of SectionContent field names
- [ ] Onboarding stepper advances through 4 phases as facts are gathered
- [ ] Agent never re-asks a question whose answer is already stored
- [ ] Agent acknowledges and triages technical complaints
- [ ] Slot machine returns deterministic next-action after every fact storage
- [ ] Single `build_first_draft` call generates all ready sections
- [ ] Agent explains WHY it built each section (narrative)
- [ ] Refinement is conversational ("what feels off?"), not multiple-choice

### Non-Functional Requirements

- [ ] System prompt is under 400 lines (down from 520)
- [ ] Phase advancement latency < 500ms (pure function, no external calls)
- [ ] First draft generation < 15 seconds for 3-4 sections
- [ ] Slot machine is a pure function with 100% unit test coverage

### Quality Gates

- [ ] All existing Vitest tests pass
- [ ] New unit tests for: `transformContentForSection()`, `computeCurrentPhase()`, slot machine
- [ ] Clean typecheck: `rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [ ] Manual E2E: start fresh onboarding → answer 3-4 questions → verify stepper advances → verify first draft builds → verify refinement flow

---

## Known Edge Cases (Discovered During Deepening)

### Phase 1 Edge Cases

1. **Agent writes content using Landing Page field names directly** — If the agent calls `update_section` with `headline` (Landing Page name) instead of `title` (SectionContent name), the content is stored with `headline` in the JSON. When `transformContentForSection()` runs, the guard `!('headline' in transformed)` prevents double-mapping. **Safe — no action needed.**

2. **ABOUT block renders as 'text' type** — The frontend BLOCK_TO_SECTION_MAP maps `ABOUT → 'text'`. The `transformContentForSection()` must check for `sectionType === 'text'` (not `'about'`) when handling the ABOUT-specific `body → content` transform.

3. **SectionContent with BOTH `title` AND `headline`** — If an agent writes both fields, the transform's `!('headline' in transformed)` guard means `title` is NOT mapped. The `headline` value is used. **Safe — most specific field wins.**

4. **Concurrent fact storage during rapid typing** — User sends two messages quickly, agent stores two facts in rapid succession. Both read the same `onboardingPhase`, both compute a new phase. Second write wins. **Safe — phase only advances forward, never backward.** The `phaseOrder()` guard ensures monotonic advancement.

### Phase 3 Edge Cases

5. **Slot machine returns `BUILD_FIRST_DRAFT` but sections already have content** — Agent built content manually before the slot machine triggered. The `build_first_draft` tool uses `isPlaceholder` check, so non-placeholder sections are skipped. **Safe.**

6. **Research agent is slow (90s timeout)** — Slot machine returns `TRIGGER_RESEARCH` but research takes 90s. During that time, user keeps chatting and storing facts. Slot machine keeps returning `TRIGGER_RESEARCH` because research hasn't completed yet. **Mitigation:** Add a `researchTriggered` flag to session state. Check it before returning `TRIGGER_RESEARCH` again.

### Phase 4 Edge Cases

7. **User provides ALL facts in one message** — "I'm Sarah, wedding photographer in Austin, 8 years, packages from $1800-$4500, my thing is documentary style." Agent must call `store_discovery_fact` 5+ times, then the last call's slot machine result says `BUILD_FIRST_DRAFT`. The system prompt must instruct the agent to process ALL extractions before following `nextAction`.

8. **User changes a previously stored fact** — "Actually, I'm in Dallas, not Austin." Agent should call `store_discovery_fact` with `key: 'location', value: 'Dallas'` which overwrites. Slot machine re-runs on updated facts. **Research may need re-triggering** if location changed. Add a `locationChanged` flag to slot machine result.

---

## Risk Analysis & Mitigation

| Risk                                                      | Likelihood | Impact | Mitigation                                                                                                       |
| --------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Slot machine thresholds are wrong (builds too early/late) | Medium     | Medium | Thresholds are configurable constants. Ship conservative, tune from production data.                             |
| System prompt rewrite breaks existing features            | Medium     | High   | Keep proven sections (Preview vs Live, Lead Partner, Financial Safety). Test with production-like conversations. |
| Field name transformation misses an edge case             | Low        | High   | Add exhaustive mapping + catch-all that logs unmapped fields in dev mode.                                        |
| Agent ignores slot machine instructions                   | Medium     | Medium | System prompt uses `nextAction` as a MUST-follow instruction, not a suggestion.                                  |
| Phase advancement creates race condition with cache       | Low        | Medium | Invalidate bootstrap cache after phase write (existing pattern in `/store-discovery-fact`).                      |

---

## Dependencies & Prerequisites

- No database migrations required (OnboardingPhase enum already has all 7 values: NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING, COMPLETED, SKIPPED)
- No new npm packages required
- **Cloud Run agent redeployment IS required for Phase 4+5** — new tool (`build_first_draft`) and modified tool (`store_discovery_fact` return shape change) are in the agent deploy directory. Deploy via: `cd server/src/agent-v2/deploy/tenant && npm run deploy` (see Pitfall #50-51)
- `useComputedPhase` hook NOT needed for Phase 2 (backend-computed phase is sufficient)
- Existing `invalidateBootstrapCache(tenantId)` call in `/store-discovery-fact` already exists (line ~649) — ensures cross-session consistency after phase advancement

---

## Implementation Order

```
Phase 1 (P0, ~2 hours) → Stop crashes
    ↓
Phase 2 (P0, ~1 hour) → Fix stepper
    ↓
Phase 3 (P1, ~2 hours) → Slot machine
    ↓
Phase 4 (P1, ~3 hours) → System prompt rewrite
    ↓
Phase 5 (P1, ~1.5 hours) → build_first_draft tool
```

**Total estimated scope:** ~9.5 hours of focused implementation across 5 phases.

Phases 1-2 should ship first (P0 bug fixes). Phases 3-5 can ship together as a feature.

---

## Files Modified (Complete List — Verified)

| File                                                          | Phase | Change                                                            | Lines Affected                       |
| ------------------------------------------------------------- | ----- | ----------------------------------------------------------------- | ------------------------------------ |
| `apps/web/src/components/tenant/sections/FeaturesSection.tsx` | 1     | Add `features = []` default + early return                        | 70, 100                              |
| `apps/web/src/components/tenant/sections/PricingSection.tsx`  | 1     | Add `tiers = []` default, guard `tier.features ?? []`             | 23, 51, 84                           |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`        | 1     | Fix incomplete guard: add `?.items ?? []`                         | 132, 135                             |
| `apps/web/src/lib/tenant.client.ts`                           | 1     | Add `transformContentForSection()` + `KNOWN_SECTION_TYPES` filter | ~467-481                             |
| `apps/web/src/components/tenant/SectionRenderer.tsx`          | 1     | Replace `never` crash with `return null` + dev warning            | 102-105                              |
| `apps/web/src/components/preview/PreviewPanel.tsx`            | 1     | Set error state on timeout + add retry button                     | 278-289, 513-526                     |
| `server/src/routes/internal-agent.routes.ts`                  | 2,3   | Phase advancement + slot machine integration                      | 585-656                              |
| `server/src/lib/slot-machine.ts`                              | 3     | NEW — pure slot machine function                                  | —                                    |
| `apps/web/src/components/agent/AgentPanel.tsx`                | 2     | Add cache invalidation after `store_discovery_fact` tool calls    | ~295 (handleTenantAgentToolComplete) |
| `apps/web/src/hooks/useOnboardingState.ts`                    | 2     | (May not need changes — depends on Task 2.3 approach)             | —                                    |
| `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts`    | 3     | Pass through slot machine result from backend                     | 136-146                              |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`     | 4     | Journey-organized rewrite (~400 lines)                            | Full file                            |
| `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`  | 5     | NEW — build_first_draft orchestrator tool                         | —                                    |
| `server/src/agent-v2/deploy/tenant/src/agent.ts`              | 5     | Register build_first_draft at T2                                  | ~137-255 tools array                 |

**Note:** Slot machine lives in `server/src/lib/slot-machine.ts` (shared backend lib), NOT inside the agent deploy directory. This is intentional — the slot machine is called from the backend endpoint, not from the agent tool directly. The agent receives the result via the API response.

---

## References

### Internal

- Handoff doc: `docs/plans/2026-02-05-onboarding-ecosystem-review-handoff.md`
- Roadmap brainstorm: `docs/brainstorms/2026-02-04-ai-agent-ecosystem-roadmap-brainstorm.md`
- Tone reference: `~/.claude/plugins/every-marketplace/plugins/coding-tutor/skills/coding-tutor/SKILL.md`
- Current system prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

### Documented Solutions

- `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md`
- `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md`
- `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- `docs/solutions/patterns/DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md`
- `docs/solutions/patterns/IFRAME_REFRESH_PREVENTION_INDEX.md`
- `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`

### CLAUDE.md Pitfalls Referenced

- #1 (tenant scoping), #22 (CUID not UUID), #56 (Zod safeParse), #79 (orphan imports after deletion), #80 (fact-to-storefront bridge), #82 (dashboardAction extraction), #83 (agent re-asking known questions), #86 (autonomous first draft), #90 (dual-system migration drift)
