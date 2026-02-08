---
status: pending
priority: p2
issue_id: '5226'
tags: [code-review, architecture, dry]
dependencies: []
---

# P2: SEED_PACKAGE_NAMES duplicated across 3 files

## Problem Statement

The seed package names (`Basic Package`, `Standard Package`, `Premium Package`) are defined as magic strings in three independent locations:

1. `server/src/lib/tenant-defaults.ts:28-50` — `DEFAULT_PACKAGE_TIERS` (canonical source)
2. `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:176` — `SEED_PACKAGE_NAMES`
3. `apps/web/src/components/tenant/SegmentPackagesSection.tsx:301` — `SEED_PACKAGE_NAMES`

Neither `first-draft.ts` nor `SegmentPackagesSection.tsx` imports from the canonical source. If someone renames a seed package in `tenant-defaults.ts`, the other two locations silently stop matching.

**Flagged by all 6 review agents** — highest-consensus finding.

## Findings

- **All 6 agents** flagged this as P2
- Cloud Run agent (`first-draft.ts`) has a documented constraint at line 135: cannot import from contracts
- Frontend CAN import from `@macon/contracts` — no excuse for duplication there

## Proposed Solutions

### Option A: Export from contracts + cross-ref comment (Recommended)

Export `SEED_PACKAGE_NAMES` from `@macon/contracts`. Frontend imports from there. Cloud Run agent keeps hardcoded copy with cross-reference comment pointing to contracts.

- **Pros:** Eliminates 1 of 2 duplications; follows existing MVP_REVEAL_SECTION_TYPES pattern
- **Cons:** Cloud Run copy still manual
- **Effort:** Small
- **Risk:** Low

### Option B: Pass seed names via API response

Backend includes seed package names in the agent API response, eliminating the need for any hardcoded list.

- **Pros:** Eliminates all duplication
- **Cons:** API contract change, more complex
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

- **Affected files:** `server/src/lib/tenant-defaults.ts`, `apps/web/src/components/tenant/SegmentPackagesSection.tsx`, `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`
- **Pattern precedent:** `MVP_REVEAL_SECTION_TYPES` in `section-blueprint.schema.ts:169`

## Acceptance Criteria

- [ ] `SEED_PACKAGE_NAMES` exported from `@macon/contracts`
- [ ] Frontend imports from contracts, not hardcoded
- [ ] Cloud Run agent has cross-ref comment pointing to canonical source
- [ ] Typecheck passes

## Work Log

| Date       | Action                                      | Learnings                                                 |
| ---------- | ------------------------------------------- | --------------------------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | All 6 agents converged — strongest signal of a real issue |

## Resources

- Commit: 8c091544
