---
status: pending
priority: p2
issue_id: 9023
tags: [code-review, contracts, plan-gap]
dependencies: [9013]
---

# onboarding.schema.ts ~550 Lines of Phase Discriminated Unions Not Listed

## Problem Statement

`packages/contracts/src/schemas/onboarding.schema.ts` has ~550 lines of phase-aware code:

- `OnboardingPhaseSchema` (z.enum mirroring old phases)
- Discriminated unions for events: DISCOVERY_STARTED, DISCOVERY_COMPLETED, MARKET_RESEARCH_STARTED, etc.
- Command schemas referencing old phase names
- Event type schemas for phase transitions

This file is NOT listed in any phase's files-to-modify. After Phase 3 simplifies OnboardingPhase to 4 values, this entire file needs a major refactor.

## Findings

- Architecture Strategist P1-05: "packages/contracts/src/schemas/onboarding.schema.ts has ~550 lines of phase-aware discriminated unions that must be simplified"
- Pattern Recognition P2-5: "TierLevel enum removal creates gap between Phase 1 and contracts"

## Proposed Solutions

### Option A: Add to Phase 3 file list (Recommended)

- Simplify discriminated unions to match 4-value enum
- Remove DISCOVERY*\*, MARKET_RESEARCH*_, SERVICES\__, MARKETING\_\* event types
- Add BUILDING_STARTED, BUILDING_COMPLETED events
- **Effort:** Medium (~550 lines to refactor)

## Acceptance Criteria

- [ ] onboarding.schema.ts listed in Phase 3 files-to-modify
- [ ] All discriminated unions use new 4-value enum
- [ ] TypeScript compilation passes with new schema

## Work Log

| Date       | Action           | Learnings                                                  |
| ---------- | ---------------- | ---------------------------------------------------------- |
| 2026-02-12 | Contracts review | Schema changes must propagate to contract type definitions |
