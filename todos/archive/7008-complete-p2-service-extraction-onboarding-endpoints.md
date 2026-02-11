---
status: pending
priority: p2
issue_id: '7008'
tags: [code-review, architecture, pr-45]
dependencies: []
---

# 7008: Extract complete-onboarding + mark-reveal-completed into DiscoveryService

## Problem Statement

The service extraction in Wave 2 was incomplete. `storeFact`, `getDiscoveryFacts`, `getBootstrap`, and `markSessionGreeted` were all extracted to `DiscoveryService`, but `completeOnboarding` and `markRevealCompleted` still have inline business logic in the route handler at `internal-agent-discovery.routes.ts`.

This means:

- Business logic is split between service and route layer
- Future validation/audit logging added to the service would be bypassed by these endpoints
- Cache invalidation logic is duplicated in routes instead of centralized in the service

## Findings

### Agent: Architecture Strategist + Data Integrity Guardian

- **File:** `server/src/routes/internal-agent-discovery.routes.ts`, lines 135-208 (complete-onboarding), lines 214-241 (mark-reveal-completed)
- `complete-onboarding` has: idempotency check, prerequisite validation, phase update, cache invalidation — all inline
- `mark-reveal-completed` has: tenant lookup, reveal flag update, cache invalidation — all inline
- Both directly call `tenantRepo.findById` and `tenantRepo.update` instead of going through the service

## Recommended Action

Extract two new methods to `DiscoveryService`:

1. `completeOnboarding(tenantId: string): Promise<CompleteOnboardingResult>` — move idempotency check, prerequisite validation, phase update, cache invalidation
2. `markRevealCompleted(tenantId: string): Promise<void>` — move tenant lookup, reveal flag update, cache invalidation

Route handlers become thin HTTP wrappers (consistent with `storeFact`, `getDiscoveryFacts`, etc.).

## Technical Details

- **Affected files:** `server/src/services/discovery.service.ts`, `server/src/routes/internal-agent-discovery.routes.ts`
- **Components:** DiscoveryService, discovery routes
- **Database:** No changes (same operations, just moved)

## Acceptance Criteria

- [ ] `completeOnboarding` logic moved to DiscoveryService
- [ ] `markRevealCompleted` logic moved to DiscoveryService
- [ ] Route handlers are thin HTTP wrappers (~5-10 lines each)
- [ ] Cache invalidation centralized in service (not duplicated in routes)
- [ ] No behavior change — same HTTP responses, same side effects
- [ ] Typecheck passes

## Work Log

| Date       | Action                     | Learnings                                                         |
| ---------- | -------------------------- | ----------------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Architecture Strategist + Data Integrity Guardian agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/routes/internal-agent-discovery.routes.ts:135-241`
- File: `server/src/services/discovery.service.ts`
