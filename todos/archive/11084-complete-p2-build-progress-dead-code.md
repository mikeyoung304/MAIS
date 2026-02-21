---
status: pending
priority: p2
issue_id: '11084'
tags: [code-review, quality]
pr: 68
---

# F-020: BuildProgress.tsx Is Dead Code Superseded by ProgressiveReveal.tsx

## Problem Statement

`BuildProgress.tsx` (269 lines) is dead code that has been fully superseded by `ProgressiveReveal.tsx`. It is not imported anywhere but remains in the codebase, adding maintenance burden and confusion.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `apps/web/src/components/onboarding/BuildProgress.tsx` (269 lines)
- **Impact:** Dead code increases cognitive load, appears in search results, and may mislead developers into modifying the wrong component. Violates the project principle of "no debt" — be ruthless with deleting code that is no longer relevant.

## Proposed Solution

Delete `BuildProgress.tsx`. Verify no imports reference it (should be none since it is dead code).

## Effort

Small

## Acceptance Criteria

- [ ] `BuildProgress.tsx` is deleted
- [ ] No remaining imports reference the deleted file
- [ ] `npm run typecheck` passes for both workspaces
- [ ] `npm run --workspace=apps/web build` succeeds
