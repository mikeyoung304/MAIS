---
status: pending
priority: p1
issue_id: '11067'
tags: [code-review, architecture, data-integrity]
pr: 68
---

# Dual PENDING_INTAKE->BUILDING Advance Path (Build May Never Start) (F-003)

## Problem Statement

Two independent code paths advance from PENDING_INTAKE to BUILDING: (1) `DiscoveryService.storeFact()` auto-advances on first fact, (2) `OnboardingIntakeService.completeIntake()` advances after validation. If storeFact already advanced, completeIntake sees wrong status, returns already_completed, and skips triggering buildService.triggerBuild(). Build never starts.

## Findings

- **Agents:** data-integrity-guardian
- **Location:** `server/src/services/discovery.service.ts:244-250`, `server/src/services/onboarding-intake.service.ts:297-299`
- **Impact:** Tenant stuck in BUILDING with no build pipeline running

## Proposed Solution

Remove auto-advance from `DiscoveryService.storeFact()` (legacy holdover). Only `completeIntake()` should advance and trigger build.

## Effort

Small (< 30 min)

## Acceptance Criteria

- [ ] `storeFact()` no longer changes onboardingStatus
- [ ] Only `completeIntake()` triggers status transition and build
- [ ] Test: storeFact + completeIntake sequence works correctly
