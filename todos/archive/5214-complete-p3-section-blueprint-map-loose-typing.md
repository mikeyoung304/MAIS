---
status: ready
priority: p3
issue_id: 5214
tags: [code-review, type-safety, dashboard-rebuild]
dependencies: []
---

# SECTION_BLUEPRINT_MAP Typed as Record<string, ...> Loses Key Narrowing

## Problem Statement

`SECTION_BLUEPRINT_MAP` in `packages/contracts/src/schemas/section-blueprint.schema.ts` is typed as `Record<string, SectionBlueprint>` which loses the specific section type keys. Consumers can't get autocomplete or compile-time checks for valid section IDs.

## Proposed Solutions

### Option A: Use satisfies for narrowing

- `const SECTION_BLUEPRINT_MAP = { ... } satisfies Record<string, SectionBlueprint>`
- Keeps literal key types while ensuring value conformance
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] SECTION_BLUEPRINT_MAP keys are narrowly typed
- [ ] Autocomplete works for section IDs

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
