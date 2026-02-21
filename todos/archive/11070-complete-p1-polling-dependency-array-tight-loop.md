---
status: pending
priority: p1
issue_id: '11070'
tags: [code-review, frontend, performance, react]
pr: 68
---

# Polling Effect Dependency Array Causes Tight Fetch Loop (F-006)

## Problem Statement

Build page polling useEffect has `buildStatus` in dependency array. Every setBuildStatus(data) causes effect re-run, clearing interval and setting new one immediately. 2s POLL_INTERVAL_MS never respected — polling becomes tight loop.

## Findings

- **Agents:** julik-frontend-races
- **Location:** `apps/web/src/app/onboarding/build/page.tsx:175-201`
- **Impact:** Hundreds of API requests per minute, performance degradation

## Proposed Solution

Use a ref for buildStatus inside the polling effect and remove it from the dependency array. Read via buildStatusRef.current.

## Effort

Small (< 30 min)

## Acceptance Criteria

- [ ] buildStatus removed from useEffect dependency array
- [ ] Ref used for reading current status inside effect
- [ ] Polling fires exactly every 2s
- [ ] Polling stops on terminal state (COMPLETE/FAILED)
