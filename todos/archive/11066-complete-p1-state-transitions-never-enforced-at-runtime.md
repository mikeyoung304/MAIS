---
status: pending
priority: p1
issue_id: '11066'
tags: [code-review, architecture, state-machine]
pr: 68
---

# State Machine Transitions Defined but Never Enforced (F-002)

## Problem Statement

`VALID_ONBOARDING_TRANSITIONS` map exists in contracts but is never imported or checked by any service. All 5+ status mutation call sites do bare updates. `onboardingVersion` field for optimistic locking is never read or incremented.

## Findings

- **Agents:** architecture-strategist, data-integrity-guardian (2 agents)
- **Location:** `packages/contracts/src/schemas/onboarding.schema.ts:63-69`, all services with status updates
- **Impact:** Invalid transitions possible (e.g., `skipOnboarding` from PENDING_PAYMENT to COMPLETE, bypassing payment)

## Proposed Solution

Create shared `transitionOnboardingStatus(tenantId, from, to)` helper that validates against transition map and uses `onboardingVersion` for optimistic locking. Route all status mutations through it.

## Effort

Medium (1-3 hours)

## Acceptance Criteria

- [ ] `transitionOnboardingStatus()` helper validates against VALID_ONBOARDING_TRANSITIONS
- [ ] All status mutation sites use the helper
- [ ] Invalid transitions throw with descriptive error
- [ ] `onboardingVersion` incremented on each transition
- [ ] Test: invalid transition rejected
