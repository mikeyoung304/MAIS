---
status: pending
priority: p2
issue_id: '11017'
tags: [code-review, frontend, html, accessibility, section-renderer, anchor-ids]
---

# P2-02 — Duplicate Section Types Produce Invalid Duplicate Anchor IDs in DOM

## Problem Statement

`SectionRenderer` assigns `id={anchorId}` to every section unconditionally. If a tenant has two sections of the same type on the home page (allowed by schema), two elements get the same `id` — an HTML validity violation. Currently latent; becomes active when any AI agent adds a second section of the same type.

## Findings

- **File:** `apps/web/src/components/tenant/SectionRenderer.tsx:151-180`
- **Agent:** architecture-strategist
- **Status:** Latent — no seed tenant currently has duplicate home-page section types
- **Risk activation:** AI agent adds a second `testimonials` section → two `<div id="testimonials">` → second is unreachable via `#testimonials` anchor nav

## Proposed Solution

Track assigned anchor IDs in a `Set<string>` and only assign `id` to the first occurrence:

```tsx
// In the component that renders sections in sequence:
const usedAnchorIds = new Set<string>();

sections.map((section, index) => {
  const anchorId = SECTION_TYPE_TO_ANCHOR_ID[section.type];
  const id =
    anchorId && !usedAnchorIds.has(anchorId) ? (usedAnchorIds.add(anchorId), anchorId) : undefined;

  return <SectionRenderer key={index} section={section} id={id} />;
});
```

## Acceptance Criteria

- [ ] `SectionRenderer` (or its parent) prevents duplicate `id` attributes
- [ ] First occurrence of each section type gets the anchor ID; subsequent ones get no ID
- [ ] Nav anchor links still correctly scroll to first section of each type
- [ ] HTML validator reports zero duplicate ID errors for any storefront page

## Work Log

- 2026-02-18: Created from architecture-strategist review
