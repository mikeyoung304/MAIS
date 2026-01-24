---
status: complete
priority: p2
issue_id: '560'
tags: [code-review, duplication, agent-ecosystem]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Created isOnboardingActive() in types.ts. Updated AdminOrchestrator to use shared utility. Added 11 unit tests.'
---

# P2: Onboarding Mode Check Duplicated in Two Orchestrators

## Problem Statement

Both `AdminOrchestrator` and `OnboardingOrchestrator` check `tenant.onboardingPhase` with identical logic:

```typescript
// admin-orchestrator.ts:190-191
const phase = parseOnboardingPhase(tenant?.onboardingPhase);
this.isOnboardingMode = phase !== 'COMPLETED' && phase !== 'SKIPPED';

// onboarding-orchestrator.ts:187-188
const phase = parseOnboardingPhase(tenant.onboardingPhase);
return phase !== 'COMPLETED' && phase !== 'SKIPPED';
```

**Why it matters:** If the logic for "active onboarding" changes (e.g., adding a new terminal state like `PAUSED`), it must be updated in two places.

## Findings

| Reviewer                     | Finding                              |
| ---------------------------- | ------------------------------------ |
| Pattern Duplication Reviewer | P2: Onboarding mode check duplicated |

## Proposed Solutions

### Option 1: Extract to Shared Utility (Recommended)

**Effort:** Small (30 minutes)

Create a shared function:

```typescript
// In types.ts or shared module
export function isOnboardingActive(phase: OnboardingPhase | null): boolean {
  return phase !== null && phase !== 'COMPLETED' && phase !== 'SKIPPED';
}
```

**Pros:**

- Single source of truth
- Easy to test
- Clear naming

**Cons:**

- Minor refactor

## Recommended Action

Implement **Option 1** immediately.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/types.ts` - Add utility function
- `server/src/agent/orchestrator/onboarding-orchestrator.ts` - Use utility
- `server/src/agent/orchestrator/admin-orchestrator.ts` - Use utility

## Acceptance Criteria

- [ ] Create `isOnboardingActive()` utility function
- [ ] Replace duplicated logic in both orchestrators
- [ ] Add unit test for utility function
- [ ] Verify behavior unchanged

## Work Log

| Date       | Action                   | Learnings                            |
| ---------- | ------------------------ | ------------------------------------ |
| 2026-01-01 | Created from code review | Pattern Duplication Reviewer flagged |

## Resources

- Current locations: admin-orchestrator.ts:190-191, onboarding-orchestrator.ts:187-188
