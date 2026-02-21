---
status: pending
priority: p2
issue_id: '11077'
tags: [code-review, architecture, agent-ai]
pr: 68
---

# F-013: deriveSectionStatus Reports All-Failed on Partial Build Failure

## Problem Statement

When a storefront build partially fails (e.g., 5 of 7 sections succeed), `deriveSectionStatus` reports the entire build as failed. Users lose visibility into which sections succeeded, making it impossible to know what needs retrying versus what is already done.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/background-build.service.ts:462-481`
- **Impact:** Users see a blanket failure message even when most sections built successfully. This leads to unnecessary full retries (wasting LLM credits), user frustration, and loss of trust in the build process.

## Proposed Solution

Store per-section build status as a JSON field on the onboarding or build record. Each section gets its own status (`pending`, `building`, `complete`, `failed`). The overall build status is derived from the aggregate:

- All complete = `COMPLETE`
- Any failed + rest complete = `PARTIAL_FAILURE`
- All failed = `FAILED`
- Any building = `BUILDING`

Update the frontend to show per-section status so users can retry only failed sections.

## Effort

Medium

## Acceptance Criteria

- [ ] Per-section build status stored (e.g., JSON field mapping section type to status)
- [ ] `deriveSectionStatus` returns per-section granularity
- [ ] Overall status correctly reflects partial success/failure
- [ ] Frontend displays per-section status indicators
- [ ] Retry targets only failed sections, not all sections
