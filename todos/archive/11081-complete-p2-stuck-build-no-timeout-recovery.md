---
status: pending
priority: p2
issue_id: '11081'
tags: [code-review, performance, architecture]
pr: 68
---

# F-017: setImmediate Build Pipeline Has No Timeout Recovery for Stuck Builds

## Problem Statement

The build pipeline is kicked off via `setImmediate` and runs asynchronously, but there is no timeout or watchdog mechanism. If a build hangs (e.g., LLM API timeout, network partition), the onboarding status remains stuck in `BUILD_IN_PROGRESS` indefinitely with no automatic recovery.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/background-build.service.ts:94-101`
- **Impact:** Stuck builds leave tenants permanently blocked in onboarding with no way to proceed. Support intervention is required to manually reset the status. This is especially problematic at scale or outside business hours.

## Proposed Solution

1. Record `buildStartedAt` timestamp when the build begins.
2. Implement a periodic check (e.g., cron or health check) that marks builds as `FAILED` if `buildStartedAt` exceeds a timeout threshold (e.g., 10 minutes).
3. Allow retry from non-terminal states so users can self-recover after a stuck build is timed out.

## Effort

Medium

## Acceptance Criteria

- [ ] `buildStartedAt` timestamp recorded when build starts
- [ ] Builds stuck longer than the timeout threshold are automatically marked `FAILED`
- [ ] Users can retry after a stuck build is auto-failed
- [ ] The timeout mechanism does not interfere with legitimately long-running builds
- [ ] Tests verify timeout detection and auto-failure behavior
