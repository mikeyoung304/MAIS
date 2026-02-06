---
status: ready
priority: p2
issue_id: 5223
tags: [code-review, agent, data-integrity, dashboard-rebuild]
dependencies: []
---

# mark_section_complete Hardcoded totalSections = 7

## Problem Statement

`server/src/agent-v2/deploy/tenant/src/tools/refinement.ts:503` has `const totalSections = 7; // TODO: Get actual count from page structure`. SECTION_BLUEPRINT defines 8 sections. The `allComplete` check at line 504 fires at 7 completed sections even if there are 8 actual sections — potentially skipping the last section during guided review.

This is the **server-side** counterpart of the client-side default mismatch in refinement-store (#5210).

## Findings

- Line 503: `const totalSections = 7;` with a TODO comment
- SECTION_BLUEPRINT has 8 entries
- `get_next_incomplete_section` (line 629) already queries actual section count: `total: allSections.length`
- The agent would declare "all complete" one section too early

## Proposed Solutions

### Option A: Query actual section count like get_next_incomplete_section (Recommended)

- Use the same `/storefront/structure` API call pattern
- **Effort:** Small | **Risk:** Low

### Option B: Import SECTION_BLUEPRINT.length

- `const totalSections = SECTION_BLUEPRINT.length`
- **Effort:** Small | **Risk:** None (but doesn't account for tenant-specific section sets)

## Acceptance Criteria

- [ ] totalSections reflects actual section count, not hardcoded 7
- [ ] allComplete only triggers when ALL sections are marked complete

## Work Log

| Date       | Action  | Notes                                                  |
| ---------- | ------- | ------------------------------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review (agent-native-reviewer) |
