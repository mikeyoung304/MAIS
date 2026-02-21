---
status: pending
priority: p2
issue_id: '11087'
tags: [code-review, frontend]
pr: 68
---

# F-023: scheduleRedirect setTimeout Never Cancelled on Unmount

## Problem Statement

The `scheduleRedirect` function in the build page sets a `setTimeout` for navigation but never stores the timer ID or clears it on component unmount. If the component unmounts before the timeout fires (e.g., user navigates away), the callback executes on an unmounted component, potentially causing React state-update-on-unmounted-component warnings or unexpected navigation.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `apps/web/src/app/onboarding/build/page.tsx:87-91`
- **Impact:** Memory leak and potential React warnings. In rare cases, the stale timeout could trigger navigation to an unexpected page after the user has already moved elsewhere.

## Proposed Solution

Store the timeout ID in a `useRef`. Clear the timeout in the `useEffect` cleanup function (or a dedicated cleanup) so it is cancelled when the component unmounts.

## Effort

Small

## Acceptance Criteria

- [ ] `setTimeout` ID stored in a `useRef`
- [ ] Timeout cleared on component unmount via `useEffect` cleanup
- [ ] No React warnings about state updates on unmounted components
- [ ] Navigation still works correctly when the component remains mounted
