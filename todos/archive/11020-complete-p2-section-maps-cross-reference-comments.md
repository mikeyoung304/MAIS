---
status: pending
priority: p2
issue_id: '11020'
tags: [code-review, frontend, architecture, section-types, documentation]
---

# P2-06 — `SECTION_TYPE_TO_ANCHOR_ID` and `SECTION_TYPE_TO_PAGE` Coupled Maps With No Cross-Reference

## Problem Statement

`SECTION_TYPE_TO_ANCHOR_ID` in `SectionRenderer` maps `features → "services"` DOM anchor. `SECTION_TYPE_TO_PAGE` in `navigation.ts` excludes `features` from nav. These maps are semantically coupled: adding `features` to `SECTION_TYPE_TO_PAGE` would create a broken nav item targeting `#services` — pointing to `SegmentTiersSection` instead of any features section. No compile-time warning exists. Maps live in separate files with zero cross-references.

## Findings

- **Files:**
  - `apps/web/src/components/tenant/SectionRenderer.tsx:24-37`
  - `apps/web/src/components/tenant/navigation.ts:65-75`
- **Agent:** architecture-strategist
- **Known Pattern:** `docs/solutions/patterns/SECTION_TYPES_CONSTANT_DRIFT_RESOLUTION.md`

## Proposed Solution

### Immediate (comment-only):

In `navigation.ts` exclusion JSDoc, add:

```typescript
// features: maps to DOM anchor 'services' in SectionRenderer.SECTION_TYPE_TO_ANCHOR_ID —
//   adding here would produce a conflicting 'Services' nav item. See SectionRenderer.tsx.
```

In `SectionRenderer.tsx` above `SECTION_TYPE_TO_ANCHOR_ID`:

```typescript
// NOTE: 'features' intentionally aliases to 'services' anchor (same scroll target as SegmentTiersSection).
// navigation.ts SECTION_TYPE_TO_PAGE excludes 'features' to prevent duplicate nav items.
```

### Longer-term:

Move `SECTION_TYPE_TO_ANCHOR_ID` from `SectionRenderer` into `navigation.ts` so both mappings are co-located and can enforce consistency.

## Acceptance Criteria

- [ ] Cross-reference comments added to both files
- [ ] OR: anchor ID map moved into `navigation.ts` (co-location approach)

## Work Log

- 2026-02-18: Created from architecture-strategist review
