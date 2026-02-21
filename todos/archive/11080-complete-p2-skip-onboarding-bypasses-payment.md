---
status: pending
priority: p2
issue_id: '11080'
tags: [code-review, architecture, security]
pr: 68
---

# F-016: skipOnboarding Bypasses State Machine — Can Skip from PENDING_PAYMENT to COMPLETE

## Problem Statement

The `skipOnboarding` method sets the onboarding status directly to `COMPLETE` without checking the current state. This allows bypassing required steps like payment, effectively letting a tenant skip from `PENDING_PAYMENT` to `COMPLETE` without paying.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/tenant-onboarding.service.ts:177-204`
- **Impact:** Tenants can bypass the payment step entirely by calling the skip endpoint at the right time. This breaks the onboarding state machine invariants and could result in revenue loss.

## Proposed Solution

Add a minimum status guard to `skipOnboarding`. Only allow skipping from states that have already passed the payment gate (e.g., `PENDING_BUILD`, `BUILD_IN_PROGRESS`, `BUILD_COMPLETE`). Reject skip requests from `PENDING_PAYMENT` or earlier states with an appropriate error.

## Effort

Small

## Acceptance Criteria

- [ ] `skipOnboarding` checks current onboarding status before allowing skip
- [ ] Skip from `PENDING_PAYMENT` or earlier states is rejected with a 400/403 error
- [ ] Skip from post-payment states (`PENDING_BUILD` and later) continues to work
- [ ] Tests verify the guard rejects premature skips
