# Add Slot Machine Unit Tests

**Priority:** P1
**Files:** New: `server/src/lib/slot-machine.test.ts`
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

`slot-machine.ts` is a pure deterministic function that drives the entire onboarding flow — when to ask questions, when to trigger research, when to build the first draft. It has ZERO tests. Every branch of `computeSlotMachine()` should be covered.

## What to Test

### `computeCurrentPhase(knownFactKeys)`

- Empty array → `NOT_STARTED`
- `['businessType']` → `DISCOVERY`
- `['businessType', 'location']` → `MARKET_RESEARCH`
- `['businessType', 'location', 'servicesOffered']` → `SERVICES`
- `['businessType', 'location', 'uniqueValue']` → `MARKETING`
- Phase is based on highest-priority fact, not count

### `computeSlotMachine(knownFactKeys, previousPhase, researchTriggered)`

#### nextAction: ASK (default)

- No facts → ASK, missingForNext starts with location
- Only `businessType` → ASK, missingForNext starts with location
- Only `location` → ASK, missingForNext starts with businessType

#### nextAction: TRIGGER_RESEARCH

- `['businessType', 'location']` with researchTriggered=false → TRIGGER_RESEARCH
- `['businessType', 'location']` with researchTriggered=true → ASK (not re-triggered)

#### nextAction: BUILD_FIRST_DRAFT

- Requires: businessType + location (FIRST_DRAFT_REQUIRED) + at least one of servicesOffered/uniqueValue/dreamClient (FIRST_DRAFT_OPTIONAL) + readySections.length >= 3
- `['businessType', 'location', 'uniqueValue']` with researchTriggered=true → BUILD_FIRST_DRAFT (3 sections ready: HERO needs businessType, ABOUT needs businessType+uniqueValue, CTA needs businessType)
- Without optional fact → stays ASK even with required facts

#### nextAction: OFFER_REFINEMENT

- utilization >= 60% (9+ facts) AND readySections >= 5 → OFFER_REFINEMENT
- High utilization but few ready sections → stays ASK

#### phaseAdvanced

- previousPhase='NOT_STARTED', currentPhase='DISCOVERY' → phaseAdvanced=true
- previousPhase='DISCOVERY', currentPhase='DISCOVERY' → phaseAdvanced=false
- Phase never goes backward

#### readySections

- With businessType only → HERO ready (requires [['businessType']])
- With businessType + uniqueValue → HERO + ABOUT ready
- With servicesOffered → SERVICES ready
- Verify against SECTION_BLUEPRINT from contracts

#### missingForNext

- Returns top 3 most valuable missing facts
- Priority order matches QUESTION_PRIORITY constant
- Facts already known are excluded

#### slotMetrics

- 0 facts → { filled: 0, total: 15, utilization: 0 }
- 15 facts → { filled: 15, total: 15, utilization: 100 }
- 7 facts → utilization rounds to nearest integer

### `computeSectionReadiness(knownFactKeys)`

- Each section's isReady matches its requiredFacts (AND of OR-groups)
- Quality levels: minimal (<50%), good (50-79%), excellent (80%+)
- Empty facts → all sections minimal, most not ready

## Test File Pattern

Follow existing test patterns in the repo (Vitest). Example:

```typescript
import { describe, it, expect } from 'vitest';
import { computeSlotMachine, computeCurrentPhase, computeSectionReadiness } from './slot-machine';
```

## Verification

```bash
npx vitest run server/src/lib/slot-machine.test.ts --reporter=verbose
```

Target: 25-35 test cases, 100% branch coverage on `computeSlotMachine`.
