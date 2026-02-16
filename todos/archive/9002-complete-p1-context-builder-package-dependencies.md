---
status: pending
priority: p1
issue_id: 9002
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# ContextBuilderService Has Unaddressed Package + Slot Machine Dependencies

## Problem Statement

`ContextBuilderService` has TWO hard dependencies that the plan removes but doesn't update:

1. **`computeSectionReadiness` from `slot-machine.ts`** (line 19, 399) — Phase 3 deletes slot-machine.ts but the plan's Phase 3 description says to "Remove `import { computeSectionReadiness } from '../lib/slot-machine'`" and "Replace section readiness computation." However, the bootstrap data's `sectionReadiness` field (line 399) is used by the agent prompt for deciding which sections to build. The replacement strategy is vague.

2. **`hasNonSeedPackages()` queries `prisma.package.count()`** (lines 529-533) — Phase 7 deletes the Package table. This function is called in `getBootstrapData()` (line 417), `getOnboardingState()` (line 461), and `resolveAndBackfillPhase()` (line 481) for the `revealCompleted` heuristic. After Package deletion, it will throw a runtime error.

**Why it matters:** The context builder is called on EVERY agent turn. A crash here means no agent conversations work at all.

## Findings

### Evidence

- `context-builder.service.ts:19` — `import { computeSectionReadiness } from '../lib/slot-machine';`
- `context-builder.service.ts:399` — `const sectionReadiness = computeSectionReadiness(knownFactKeys);`
- `context-builder.service.ts:529-533` — `hasNonSeedPackages()` queries Package table
- `context-builder.service.ts:417,461` — `revealCompleted` uses `hasNonSeedPackages()`
- Plan Phase 3: Lists `context-builder.service.ts` but only mentions removing slot-machine import
- Plan Phase 7: Does NOT list `context-builder.service.ts` in files to modify

## Proposed Solutions

### Option A: Replace both in Phase 3 + Phase 5 (Recommended)

- Phase 3: Replace `computeSectionReadiness` with simple SectionContentService check (as plan suggests)
- Phase 5: Replace `hasNonSeedPackages()` with `hasNonSeedTiers()` using Tier table (priceCents > 0)
- Phase 7: Verify context-builder has no remaining Package references
- **Effort:** Medium
- **Risk:** Low — clean sequential replacement

### Option B: Add Phase 5 as explicit context-builder overhaul

- Consolidate ALL context-builder changes into Phase 5
- Rewrite bootstrap data to include brain dump, segments, tiers
- Remove Package + slot-machine dependencies in one pass
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected files:**

- `server/src/services/context-builder.service.ts` — Both fixes needed
- `server/src/lib/slot-machine.ts` — Deleted in Phase 3

**Affected phases:** Phase 3 (slot-machine removal), Phase 5 (bootstrap update), Phase 7 (Package deletion)

## Acceptance Criteria

- [ ] `computeSectionReadiness` import removed and replaced BEFORE slot-machine.ts deletion
- [ ] `hasNonSeedPackages()` replaced with Tier-based equivalent BEFORE Package deletion
- [ ] `revealCompleted` heuristic works without Package table
- [ ] Bootstrap data includes brain dump, segments, tiers (Phase 5)
- [ ] Clean typecheck after each phase

## Work Log

| Date       | Action                        | Learnings                                                   |
| ---------- | ----------------------------- | ----------------------------------------------------------- |
| 2026-02-12 | Discovered during plan review | ContextBuilder is a high-coupling service — changes cascade |

## Resources

- `server/src/services/context-builder.service.ts:19,399,529-533`
- Plan Phase 3, Phase 5, Phase 7
