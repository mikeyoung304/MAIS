---
status: pending
priority: p1
issue_id: 9011
tags: [code-review, architecture, plan-gap]
dependencies: []
---

# Phases 3-4-5 Must Be Atomic — Broken Intermediate State

## Problem Statement

Phase 3 deletes `slot-machine.ts` and removes `computeSlotMachine()` from `discovery.service.ts`. Phase 4 creates the NEW agent tools (`manage_segments`, `manage_tiers`, `manage_addons`). Phase 5 rewrites the system prompt. Between Phase 3 and Phase 5, the agent is in a broken state:

- No slot machine (deleted in Phase 3)
- No segment/tier/addon tools (not yet created until Phase 4)
- System prompt still references slot machine protocol (not rewritten until Phase 5)
- `store_discovery_fact` returns no nextAction (slot machine removed)

**Why it matters:** If phases deploy independently, the tenant-agent cannot onboard ANY tenants between Phase 3 and Phase 5 completion.

## Findings

- Architecture Strategist P1-06: "Phase 3 deletes slot machine before Phase 4 creates replacement tools — broken intermediate state"
- Pattern Recognition agrees: "Phases 3, 4, and 5 must be merged into a single atomic phase"
- Agent-Native Reviewer P1-3: "store_discovery_fact response contract undefined after slot machine removal"

## Proposed Solutions

### Option A: Merge Phases 3, 4, 5 into a single phase (Recommended)

- One deployment that atomically: removes slot machine, adds new tools, rewrites prompt
- **Effort:** Medium (larger single phase, but no broken intermediate states)
- **Risk:** Larger blast radius per deployment

### Option B: Keep phases separate but deploy together

- Keep phases as separate implementation units for code review
- Deploy all three as a single release
- **Effort:** Small (plan documentation change)
- **Risk:** Someone might deploy Phase 3 alone by accident

## Acceptance Criteria

- [ ] No deployment boundary between slot machine deletion and new tool creation
- [ ] Agent is never in a state where old system is deleted and new system doesn't exist

## Work Log

| Date       | Action                 | Learnings                                                |
| ---------- | ---------------------- | -------------------------------------------------------- |
| 2026-02-12 | Agent review synthesis | Delete-before-replace creates broken intermediate states |
