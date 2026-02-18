---
title: 'Static-Dynamic Section Heading Collision: Hardcoded Component vs Agent-Authored Content'
category: patterns
tags:
  - static-components
  - agent-authoring
  - heading-deduplication
  - frontend-boundary
  - content-collision
date: 2026-02-18
severity: P2
status: documented
---

# Static-Dynamic Section Heading Collision

## Problem Symptom

On the littlebit-farm tenant storefront, the landing page displays **two consecutive sections both titled "How It Works"**:

1. **About section** (dynamic, from DB) — agent authored during onboarding with headline "How It Works", containing pricing and logistics info
2. **HowItWorksSection** (static component) — hardcoded `<h2>How It Works</h2>` with 3 numbered booking steps

Result: confusing UX, broken heading hierarchy, no console errors — the collision is **silent at the rendering layer**.

## Root Cause

The collision crosses **two independent boundaries**:

**1. Agent authoring (backend):** The tenant-agent chose "How It Works" as the About section headline during onboarding. No constraint prevents this — the `headline` field is a free-text string.

**2. Frontend rendering (frontend):** `TenantLandingPage.tsx` composes sections in this order:

```
[1] SectionRenderer(preSections)  ← Dynamic: renders About with headline "How It Works"
[2] HowItWorksSection             ← Static: renders <h2>How It Works</h2>
[3] SegmentTiersSection
[4] SectionRenderer(postSections)
```

Neither system is aware of the other's headings. The `SectionRenderer` validates section types (discriminated union switch) but does NOT validate heading uniqueness across the static/dynamic boundary.

## Potential Solutions

### Option A: Rename the static component heading (quick fix)

Change "How It Works" → "Book in Three Steps" or "Your Booking Process". Resolves the littlebit-farm collision immediately.

### Option B: Agent constraint (source prevention)

Update tenant-agent system prompt to list reserved headings that collide with static components. Add to `buildContextPrefix()` under restricted fields.

### Option C: Render-time collision detection (safety net)

Add a development-only `useEffect` in `TenantLandingPage` that warns on duplicate `<h2>` text:

```typescript
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const headings = document.querySelectorAll('h2');
    const titles = Array.from(headings).map((h) => h.textContent);
    const dupes = titles.filter((v, i) => titles.indexOf(v) !== i);
    if (dupes.length > 0) {
      logger.warn('Duplicate section headings detected', { dupes });
    }
  }
}, []);
```

### Recommended: Hybrid (A + B + C)

- Apply **A** to fix the immediate UX issue
- Apply **B** to prevent future collisions at the agent level
- Apply **C** as a development-only safety net

## Prevention: Static Component Checklist

When adding a new static (non-SectionRenderer) component to the storefront:

- [ ] Declare heading in a `RESERVED_SECTION_HEADINGS` constant
- [ ] Update agent system prompt to list reserved headings
- [ ] Verify heading does NOT collide with existing section types or common agent-authored titles
- [ ] Add anchor ID to `SECTION_TYPE_TO_ANCHOR_ID` mapping if navigable
- [ ] Document in CLAUDE.md architecture section

## Connection to Existing Patterns

This is the **runtime expression** of the same root cause documented in [CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md](../patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md):

> "Each time a new section type was added, not all locations were updated."

The section types trap is a **build-time** boundary issue (7 independent lists). The heading collision is a **runtime** boundary issue (static component vs dynamic content). Same pattern: **independent systems with no shared contract for uniqueness**.

## Related Files

| File                                                                  | Role                                                |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`                | Composition boundary where static + dynamic collide |
| `apps/web/src/components/tenant/sections/HowItWorksSection.tsx`       | Static component with hardcoded heading             |
| `apps/web/src/components/tenant/SectionRenderer.tsx`                  | Dynamic section rendering (switch on type)          |
| `packages/contracts/src/landing-page.ts`                              | Section type definitions                            |
| `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` | Related duplication-at-boundaries pattern           |
