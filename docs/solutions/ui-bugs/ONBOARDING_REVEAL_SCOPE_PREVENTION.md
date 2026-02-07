---
title: Onboarding Reveal Scope — MVP Sections, Package Dedup, Count-Based Trigger
category: ui-bugs
severity: P0
date_solved: 2026-02-07
related_pitfalls: [54, 56, 86, 92]
related_commits: [279fda0a, 22ea4796, 37249ee2]
tags: [onboarding, reveal, staged-reveal, blueprint, defense-in-depth, LLM-mutation, feature-flags]
supersedes: null
extends: ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md
---

# Onboarding Reveal Scope Prevention

## Symptoms (5 bugs, 3 root causes)

| #   | Symptom                                                | Root Cause                                                            |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| 1   | 6 packages instead of 3 (3 real + 3 $0 defaults)       | No programmatic cleanup of seeded defaults                            |
| 2   | CONTACT section with "Coming soon" placeholder visible | No MVP scope concept; default `visible: true`                         |
| 3   | PRICING section with default text visible              | Same — no MVP scope; default `visible: true`                          |
| 4   | Flash/reload during reveal animation                   | Auto-reveal fires on 1st `update_section`, not after all MVP sections |
| 5   | Returning users stuck on "Coming Soon"                 | Combination of #4 timing + #1 package duplication                     |

## Root Causes and Fixes

### Root Cause 1: No "reveal MVP" concept

The system had 8 section types but no way to distinguish "show these 3 during the wow moment" from "build these 5 later." Default visibility flags (`visible: true`) on CONTACT and PRICING meant they appeared during reveal with placeholder content.

**Fix:** Added `isRevealMVP: boolean` to `SectionBlueprintEntry` in `packages/contracts/src/schemas/section-blueprint.schema.ts`. Three sections marked MVP (HERO, ABOUT, SERVICES). Derived constants:

```typescript
// packages/contracts/src/schemas/section-blueprint.schema.ts
export const MVP_REVEAL_SECTION_COUNT = SECTION_BLUEPRINT.filter((s) => s.isRevealMVP).length;
export const MVP_REVEAL_SECTION_TYPES = new Set(
  SECTION_BLUEPRINT.filter((s) => s.isRevealMVP).map((s) => s.sectionType.toUpperCase())
);
```

Downstream consumers derive from blueprint:

- `first-draft.ts` — filters returned sections to MVP only
- `tenant-defaults.ts` — non-MVP sections default to `visible: false`
- `AgentPanel.tsx` — uses `MVP_REVEAL_SECTION_COUNT` for reveal threshold

### Root Cause 2: Default $0 packages not cleaned up

Tenant provisioning seeds 3 packages at $0 (Basic/Standard/Premium). Agent creates 3 real packages but never deletes defaults. Result: 6 packages visible.

**Fix:** Belt-and-suspenders approach:

1. **Prompt instruction** in `system.ts` — tells agent to `manage_packages(list)` then delete $0 packages before creating new ones
2. **Programmatic fallback** in `first-draft.ts` — tool execution deletes $0 packages automatically before returning section data to the LLM

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts
// Programmatic fallback: delete $0 default packages before agent creates real ones.
try {
  const listResult = await callMaisApi('/manage-packages', tenantId, { action: 'list' });
  if (listResult.ok) {
    const packages =
      (listResult.data as { packages?: Array<{ id: string; basePrice: number }> })?.packages ?? [];
    const defaultPackages = packages.filter((pkg) => pkg.basePrice === 0);
    for (const pkg of defaultPackages) {
      await callMaisApi('/manage-packages', tenantId, { action: 'delete', packageId: pkg.id });
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

### Root Cause 3: Auto-reveal fired too early

Previous logic triggered `revealSite()` on the FIRST `update_section` tool completion. Agent writes 3 sections sequentially, so user saw partial content flash.

**Fix:** Module-scoped counter in `AgentPanel.tsx` that accumulates across tool-complete batches:

```typescript
// apps/web/src/components/agent/AgentPanel.tsx
let firstDraftWriteCount = 0; // Module scope, not Zustand

// Inside handleTenantAgentToolComplete:
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

---

## Prevention Strategies

### 1. Reveal Scope Pattern (for any staged-reveal UI)

Any UI that reveals content progressively (onboarding, wizards, guided tours, beta rollouts) needs an explicit **reveal scope** — a declarative definition of what is visible at each stage.

**Pattern:**

```typescript
// Define scope in ONE canonical location
interface StageableItem {
  id: string;
  // ... other fields
  stage: 'mvp' | 'refinement' | 'advanced'; // Explicit stage assignment
}

const ITEMS: StageableItem[] = [
  { id: 'hero', stage: 'mvp' },
  { id: 'about', stage: 'mvp' },
  { id: 'pricing', stage: 'refinement' }, // NOT shown at reveal
];

// Derive everything from the canonical list
const MVP_ITEMS = ITEMS.filter((i) => i.stage === 'mvp');
const MVP_COUNT = MVP_ITEMS.length;
const MVP_IDS = new Set(MVP_ITEMS.map((i) => i.id));
```

**Rules:**

1. **One flag, N consumers.** The scope definition lives in ONE file. Downstream code derives from it. Never hardcode which items are "MVP" in multiple places.
2. **Defaults must match scope.** If an item is NOT in the MVP scope, its default visibility MUST be `false`. Mismatched defaults create phantom content.
3. **Triggers must match scope count.** If the reveal fires after N writes, N must equal `scopeItems.length`, not a magic number.
4. **Cloud Run / remote agents**: When a service cannot import the canonical source, hardcode with a comment referencing the source: `// Source of truth: SECTION_BLUEPRINT.isRevealMVP in @macon/contracts`

**When adding a new stage item to MVP:**

1. Set `isRevealMVP: true` in blueprint (one file change)
2. Verify `visible: true` in defaults
3. Threshold auto-adjusts (derived from blueprint)

### 2. Defense-in-Depth for LLM Mutations

Never rely on prompt-only enforcement when an LLM mutation affects money, booking, or user-visible data integrity.

**The belt-and-suspenders rule:**

| Layer             | Mechanism                                                                     | Failure mode                                             |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| Belt (prompt)     | System prompt instructs the LLM to delete/clean/validate                      | LLM skips the step, hallucinates, or reorders operations |
| Suspenders (code) | Programmatic guard in tool `execute()` that runs BEFORE returning data to LLM | Tool crashes or API is unavailable                       |

**Implementation pattern:**

```typescript
// In tool execute():
// 1. Programmatic enforcement (suspenders)
try {
  await cleanupDefaults(tenantId); // Runs regardless of LLM behavior
} catch (err) {
  logger.warn({ err }, 'Programmatic cleanup failed, LLM will retry');
  // Non-fatal: the belt (prompt) is the fallback
}

// 2. Return data for LLM to act on (belt kicks in here)
return { sectionsToUpdate, instruction: 'Delete $0 packages before creating...' };
```

**When to apply:**

- Data that affects financial transactions (packages, pricing, invoices)
- Data that affects user trust (visible storefront content, testimonials)
- Data that creates duplicates visible to end users
- Any mutation where "LLM didn't follow instructions" causes a P0

**When prompt-only is acceptable:**

- Copy tone/style preferences (wrong tone is annoying, not broken)
- Ordering of operations that don't have side effects
- Explanatory text the LLM generates (user can edit)

### 3. Single Source of Truth for Feature Flags

When a boolean flag (like `isRevealMVP`) drives behavior in multiple subsystems, define it exactly once and derive everywhere else.

**Anti-pattern (what broke):**

```
tenant-defaults.ts: CONTACT.visible = true      // Implicit: "CONTACT is in MVP"
first-draft.ts:     returns ALL sections         // Implicit: "all sections are in MVP"
AgentPanel.tsx:     triggers on first write       // Implicit: "MVP = 1 section"
```

Three files, three implicit (and conflicting) definitions of "what's in the MVP."

**Correct pattern:**

```
section-blueprint.schema.ts:  isRevealMVP: true/false   // DEFINE once
tenant-defaults.ts:           derives visible from MVP   // CONSUME
first-draft.ts:               filters by MVP set         // CONSUME
AgentPanel.tsx:                threshold = MVP count      // CONSUME
```

One file defines; three files consume. Adding a section to MVP requires ONE change.

**Rules:**

1. The flag lives in the schema/contract layer, not in any consumer
2. Derived constants are exported alongside the flag (`MVP_COUNT`, `MVP_SET`)
3. Remote services that cannot import use hardcoded values with a comment citing the source
4. Never use a magic number when a derived constant exists

---

## Detection Heuristics

How to spot this class of bug before it ships:

### Heuristic 1: "What does the user see at each stage?"

For any staged-reveal feature, ask: **"If I list every visible element at stage N, is each one intentionally there?"**

Walk through each stage and enumerate visible items. If any item is visible only because "nobody set it to hidden," you have a reveal scope bug.

**Detection command:**

```bash
# Find all default visibility settings
grep -rn "visible:" server/src/lib/tenant-defaults.ts
# Cross-reference with what the reveal shows
grep -rn "isRevealMVP" packages/contracts/
```

### Heuristic 2: "What happens when the LLM skips a step?"

For every LLM-orchestrated workflow, identify each mutation step and ask: **"If the LLM skips this step entirely, what does the user see?"**

If skipping a step leaves bad data visible (duplicate packages, stale defaults, uninitialized fields), you need a programmatic fallback.

**Detection command:**

```bash
# Find all tool execute functions that mutate state
grep -rn "callMaisApi\|await fetch" server/src/agent-v2/deploy/*/src/tools/*.ts
# Check if each mutation has BOTH prompt instruction AND programmatic guard
```

### Heuristic 3: "Is the trigger count derived or hardcoded?"

For any threshold-based trigger (reveal after N writes, progress after N steps), check if the number is derived from a canonical list or hardcoded.

```bash
# Bad: magic numbers in trigger logic
grep -rn ">= 3\|=== 3\|< 3" apps/web/src/components/
# Good: derived from blueprint
grep -rn "MVP_REVEAL_SECTION_COUNT\|SECTION_BLUEPRINT.filter" apps/web/src/
```

### Heuristic 4: "How many files define the same concept?"

If a boolean concept (MVP/non-MVP, visible/hidden, active/inactive) is defined in more than one file without one being the explicit source, you have implicit conflicting definitions.

```bash
# Find all files that determine "which sections are MVP"
grep -rn "HERO.*ABOUT.*SERVICES\|MVP\|isRevealMVP" --include="*.ts" --include="*.tsx"
# Should converge to: 1 definer + N consumers with comments
```

### Heuristic 5: "Does the default match the scope?"

For every default value (seeded data, initial state, template content), check if its visibility/active state matches the scope it belongs to.

```bash
# Defaults that are visible
grep -B2 -A2 "visible: true" server/src/lib/tenant-defaults.ts
# Cross-check: are ALL of these in the MVP scope?
```

---

## Checklist (quick reference for future staged-reveal work)

### Before Implementation

- [ ] **Define the reveal scope** — Which items are shown at each stage? Document in ONE canonical location.
- [ ] **Audit defaults** — Do default visibility flags match the scope? Every non-MVP item must default to hidden.
- [ ] **Audit seeded data** — Will provisioning create placeholder data (packages, content) that should not be visible at reveal? Plan cleanup.
- [ ] **Identify LLM mutations** — Which steps require the LLM to act? For each: does skipping it break the UX?
- [ ] **Define the trigger** — What event fires the reveal? Is the threshold derived from the scope definition?

### During Implementation

- [ ] **Single source of truth** — Flag defined in schema/contracts, derived constants exported, consumers import (never redefine)
- [ ] **Defense-in-depth** — Every LLM mutation that affects money or trust has BOTH prompt instruction AND programmatic fallback
- [ ] **Module-scoped state** — If a counter/flag is read in exactly one function, use module-scoped `let` instead of a store
- [ ] **Remote service sync** — If a remote service cannot import the canonical source, hardcode with `// Source of truth: FILE_PATH`
- [ ] **Edge cases documented** — Multi-batch writes, page refresh mid-flow, double-trigger idempotency

### Before Merge

- [ ] **Walk the stages** — Manually enumerate what the user sees at each stage. No phantom content.
- [ ] **Skip-step test** — For each LLM step, mentally remove it. Does the programmatic fallback cover it?
- [ ] **Magic number audit** — `grep` for hardcoded thresholds. Each should reference a derived constant.
- [ ] **Default audit** — Every `visible: true` in defaults has a corresponding scope entry
- [ ] **Deploy order** — Frontend before agent? Document the regression window if order matters.

---

## Key Files

| File                                                         | Role                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `packages/contracts/src/schemas/section-blueprint.schema.ts` | Single source of truth — `isRevealMVP` flag, derived constants |
| `server/src/lib/tenant-defaults.ts`                          | Default visibility — non-MVP sections `visible: false`         |
| `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts` | MVP section filter + programmatic $0 package cleanup           |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`    | Prompt-level package cleanup instructions (belt)               |
| `apps/web/src/components/agent/AgentPanel.tsx`               | Count-based auto-reveal trigger with module-scoped counter     |

## Related

- [ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md](./ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md) — Predecessor fix: `coming_soon` state guards + `await` before invalidation
- Pitfall #54 — Prompt-only security for tool access (defense-in-depth principle)
- Pitfall #86 — Agent says "first draft" but shows placeholders
- Pitfall #92 — Zustand actions bypassing `coming_soon` state
- Plan: `docs/plans/2026-02-07-fix-onboarding-reveal-content-issues-plan.md`
