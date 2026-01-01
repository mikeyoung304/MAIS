---
status: completed
priority: p2
issue_id: '532'
tags: [code-review, agent-ecosystem, typescript]
dependencies: []
completed_date: '2026-01-01'
---

# OnboardingPhase Type Assertion Without Validation

## Problem Statement

Direct type assertion from database field without validation. If the database contains an invalid phase value, it silently accepts it.

## Findings

**TypeScript Reviewer:**

> "Direct type assertion from database field without validation... Invalid phase values could propagate through the system."

**Locations:** `onboarding-orchestrator.ts` (lines 109, 136, 170, 187), `admin-orchestrator.ts` (lines 190, 222)

```typescript
const currentPhase = (tenant?.onboardingPhase as OnboardingPhase) || 'NOT_STARTED';
```

## Proposed Solutions

Use Zod validation:

```typescript
import { OnboardingPhaseSchema } from '@macon/contracts';

const result = OnboardingPhaseSchema.safeParse(tenant?.onboardingPhase);
const currentPhase = result.success ? result.data : 'NOT_STARTED';
```

## Acceptance Criteria

- [x] Database values validated before use
- [x] Invalid values handled gracefully
- [x] Tests pass

## Resolution

Already implemented via `parseOnboardingPhase()` function in `@macon/contracts`:

```typescript
export function parseOnboardingPhase(value: unknown): OnboardingPhase {
  const result = OnboardingPhaseSchema.safeParse(value);
  return result.success ? result.data : 'NOT_STARTED';
}
```

All orchestrators use this function instead of direct type assertion.
