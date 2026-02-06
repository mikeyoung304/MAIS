---
status: ready
priority: p3
issue_id: 5221
tags: [code-review, cache, consistency, dashboard-rebuild]
dependencies: []
---

# Missing invalidateBootstrapCache After revealCompletedAt Write

## Problem Statement

The `/mark-reveal-completed` endpoint writes `revealCompletedAt` to the database but does NOT call `invalidateBootstrapCache(tenantId)` afterward. All other mutating endpoints in the same file (`/complete-onboarding`, `/store-discovery-fact`) invalidate the cache after writes.

Actual impact is nil — `revealCompleted` is served by `ContextBuilderService.getBootstrapData()` which queries the DB directly, bypassing the internal-agent route cache. But the inconsistency creates a false pattern for copy-paste.

## Findings

- Line 608-611: `tenantRepo.update()` without cache invalidation
- Contrast: `/complete-onboarding` (line 568) and `/store-discovery-fact` (line 692) both invalidate
- Data integrity guardian confirmed low actual risk

## Proposed Solutions

### Option A: Add invalidateBootstrapCache call (Recommended)

- One line addition for pattern consistency
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] `invalidateBootstrapCache(tenantId)` called after write
- [ ] Consistent with sibling endpoints

## Work Log

| Date       | Action  | Notes                                                    |
| ---------- | ------- | -------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (data-integrity-guardian) |
