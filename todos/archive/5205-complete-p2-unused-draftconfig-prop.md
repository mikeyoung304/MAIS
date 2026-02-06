---
status: ready
priority: p2
issue_id: 5205
tags: [code-review, dead-code, dashboard-rebuild]
dependencies: []
---

# Unused draftConfig Prop in RevealTransition

## Problem Statement

`RevealTransition` in `apps/web/src/components/preview/RevealTransition.tsx` declares `draftConfig` as a required prop in its interface but never destructures or uses it. Callers must pass this prop for no reason, adding confusion.

## Findings

- Line 33: `draftConfig` in props interface
- Not destructured in component function
- Not referenced anywhere in the component body

## Proposed Solutions

### Option A: Remove the prop (Recommended)

- Delete from interface, update callers
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] `draftConfig` removed from RevealTransition props
- [ ] All callers updated
- [ ] TypeScript compiles clean

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
