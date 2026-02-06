---
status: ready
priority: p2
issue_id: 5207
tags: [code-review, react, memory-leak, dashboard-rebuild]
dependencies: []
---

# Uncleaned setTimeout in PublishConfirmation

## Problem Statement

`PublishConfirmation` in `apps/web/src/components/preview/PublishConfirmation.tsx:160` calls `setTimeout(() => setCopied(false), 2000)` without storing the timer ID for cleanup. If the component unmounts before 2 seconds (user dismisses modal quickly), React warns about state updates on unmounted components.

## Findings

- Line 160: `setTimeout` without cleanup
- Component has no unmount cleanup for this timer
- Can cause React "Can't perform state update on unmounted component" warning

## Proposed Solutions

### Option A: Store timer ref and clear on unmount (Recommended)

- Use `useRef` to store timer ID, clear in useEffect cleanup
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] setTimeout timer cleared on component unmount
- [ ] No React state-update warnings when modal dismissed quickly

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
