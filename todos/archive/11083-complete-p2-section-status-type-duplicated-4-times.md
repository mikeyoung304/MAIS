---
status: pending
priority: p2
issue_id: '11083'
tags: [code-review, typescript]
pr: 68
---

# F-019: SectionStatus Type Defined 4 Times, BuildStatusResponse Duplicated 2 Times

## Problem Statement

The `SectionStatus` type is defined independently in 4 locations and `BuildStatusResponse` is duplicated in 2 locations. This is the CONSTANTS_DUPLICATION_TRAP pattern (known pitfall) — multiple independent copies of the same type that will inevitably drift apart.

## Findings

- **Agents:** 1 agent flagged (known pattern: CONSTANTS_DUPLICATION_TRAP)
- **Locations:**
  - `server/src/services/background-build.service.ts:39` — SectionStatus
  - `server/src/services/background-build.service.ts:45` — BuildStatusResponse
  - `apps/web/src/components/onboarding/ProgressiveReveal.tsx:19` — SectionStatus
  - `apps/web/src/app/onboarding/build/page.tsx:32` — SectionStatus
  - `apps/web/src/app/onboarding/build/page.tsx:36` — BuildStatusResponse
- **Impact:** Any change to the shape of these types must be manually replicated across all locations. Missing one causes silent runtime failures. This has already bitten the project before (see pitfall index).

## Proposed Solution

Define `SectionStatus` and `BuildStatusResponse` once in `@macon/contracts`. Delete all local copies and import from the single source of truth.

## Effort

Small

## Acceptance Criteria

- [ ] `SectionStatus` and `BuildStatusResponse` defined once in `@macon/contracts`
- [ ] All 4+ local copies deleted and replaced with imports
- [ ] `npm run typecheck` passes for both workspaces
- [ ] No local type aliases that shadow the contract types
