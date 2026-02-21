---
status: pending
priority: p1
issue_id: '11065'
tags: [code-review, security, architecture, state-machine]
pr: 68
---

# Webhook Replay Regresses Tenant Onboarding State (F-001)

## Problem Statement

`processMembershipCheckout()` in `server/src/jobs/webhook-processor.ts:552` unconditionally sets `onboardingStatus: 'PENDING_INTAKE'` without checking current status. A replayed Stripe webhook bypasses idempotency and regresses tenants mid-build or in SETUP back to intake.

## Findings

- **Agents:** security-sentinel, architecture-strategist, data-integrity-guardian (3 agents)
- **Location:** `server/src/jobs/webhook-processor.ts:552`
- **Impact:** Tenant progress lost, build pipeline may not restart
- **Known Pattern:** `docs/solutions/patterns/mais-critical-patterns.md` (state transition guards)

## Proposed Solution

Add status guard: only advance if current status is `PENDING_PAYMENT`. Log and skip otherwise.

## Effort

Small (< 30 min)

## Acceptance Criteria

- [ ] Webhook handler checks current `onboardingStatus` before updating
- [ ] Replayed webhook for already-advanced tenant logs warning and returns success
- [ ] Test: tenant in BUILDING state survives webhook replay
