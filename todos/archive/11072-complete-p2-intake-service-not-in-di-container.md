---
status: pending
priority: p2
issue_id: '11072'
tags: [code-review, architecture]
pr: 68
---

# F-008: OnboardingIntakeService Not Registered in DI Container

## Problem Statement

OnboardingIntakeService is created inline during route registration instead of being properly registered in the dependency injection container, breaking the established DI pattern used throughout the codebase.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/routes/index.ts:663-665`
- **Impact:** Breaks consistency with the DI architecture. Makes the service harder to test in isolation, harder to swap implementations, and creates a hidden dependency that bypasses the container graph.

## Proposed Solution

Register `OnboardingIntakeService` in `server/src/di.ts` following the same pattern as other services. Inject it into the route handler via the container rather than constructing it inline.

## Effort

Small

## Acceptance Criteria

- [ ] `OnboardingIntakeService` is registered in `server/src/di.ts`
- [ ] Route registration in `index.ts` resolves the service from the DI container
- [ ] Existing tests continue to pass
- [ ] No inline construction of the service remains in route files
