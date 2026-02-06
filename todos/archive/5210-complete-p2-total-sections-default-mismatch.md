---
status: ready
priority: p2
issue_id: 5210
tags: [code-review, data-integrity, dashboard-rebuild]
dependencies: []
---

# totalSections Default 7 vs SECTION_BLUEPRINT 8

## Problem Statement

`refinement-store.ts:167` defaults `totalSections` to 7, but `SECTION_BLUEPRINT` in `packages/contracts/src/schemas/section-blueprint.schema.ts` defines 8 section types. If `hydrate()` is not called (or doesn't include `totalSections`), the store thinks there are only 7 sections. The `markComplete` auto-advance to `publish_ready` would trigger one section too early.

## Findings

- `initialState.totalSections = 7` in refinement-store.ts:167
- SECTION_BLUEPRINT has 8 entries
- `markComplete` auto-advances when `completedSections.length >= totalSections`
- If hydrate doesn't set totalSections, 7th section triggers publish_ready early

## Proposed Solutions

### Option A: Import SECTION_BLUEPRINT length as default (Recommended)

- `totalSections: Object.keys(SECTION_BLUEPRINT).length` or `SECTION_BLUEPRINT.length`
- **Effort:** Small | **Risk:** None

### Option B: Hardcode 8

- Simple but fragile — changes when blueprint changes
- **Effort:** Small | **Risk:** Medium (drift)

## Acceptance Criteria

- [ ] Default totalSections matches SECTION_BLUEPRINT count
- [ ] publish_ready only triggers after ALL sections are complete

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
