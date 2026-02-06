---
status: ready
priority: p2
issue_id: 5212
tags: [code-review, type-safety, dashboard-rebuild]
dependencies: []
---

# Missing Exhaustive Switch in handleDashboardActions

## Problem Statement

`handleDashboardActions` in `AgentPanel.tsx` uses a switch/case on `action.type` but has no exhaustive `never` check (unlike `ContentArea.tsx` which correctly uses the exhaustive switch pattern). New action types added to the contracts won't cause a compile error if the handler forgets to add a case.

## Findings

- ContentArea.tsx uses `const _exhaustive: never = view` pattern — excellent
- handleDashboardActions uses `default: break` — silently drops unknown actions
- Pattern inconsistency within the same PR

## Proposed Solutions

### Option A: Add exhaustive never check (Recommended)

- Add `default: { const _exhaustive: never = action.type; }` with proper DashboardAction type
- Requires DashboardActionSchema fix (#5202) first
- **Effort:** Small | **Risk:** None
- **Depends on:** #5202

## Acceptance Criteria

- [ ] handleDashboardActions has exhaustive switch
- [ ] New action types cause compile errors if unhandled

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
