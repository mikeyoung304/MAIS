---
status: pending
priority: p2
issue_id: '5230'
tags: [code-review, architecture, dry]
dependencies: []
---

# P2: MVP_SECTIONS hardcoded in Cloud Run agent

## Problem Statement

`first-draft.ts:134-136` hardcodes `MVP_SECTIONS = new Set(['HERO', 'ABOUT', 'SERVICES'])` with a comment pointing to `SECTION_BLUEPRINT.isRevealMVP` in `@macon/contracts`. Meanwhile, `@macon/contracts` exports `MVP_REVEAL_SECTION_TYPES` (a computed Set) at `section-blueprint.schema.ts:169`. If the Cloud Run build can bundle from contracts, the duplication can be eliminated.

## Findings

- **Code Simplicity (P2):** Verify if Cloud Run agent can import from contracts
- **Architecture Strategist (P2):** Confirmed pattern matches Pitfall #93 and ONBOARDING_REVEAL_SCOPE_PREVENTION.md

## Proposed Solutions

### Option A: Verify Cloud Run import capability

Check if `@macon/contracts` is in `server/src/agent-v2/deploy/tenant/package.json`. If yes, replace hardcoded set with import.

- **Pros:** Eliminates duplication entirely
- **Cons:** May not be possible due to build constraints
- **Effort:** Small (if possible)
- **Risk:** Low

### Option B: Pass via API response

Include MVP section list in the agent API response from the backend.

- **Pros:** No import needed
- **Cons:** API contract change
- **Effort:** Medium
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:134-136`
- **Source of truth:** `packages/contracts/src/schemas/section-blueprint.schema.ts:169`

## Acceptance Criteria

- [ ] MVP_SECTIONS derived from single source of truth
- [ ] OR cross-reference comment updated if hardcoding is unavoidable

## Work Log

| Date       | Action                                      | Learnings                                                            |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | Cloud Run build constraints force duplication — investigate bundling |

## Resources

- Commit: 8c091544
- CLAUDE.md Pitfall #93
