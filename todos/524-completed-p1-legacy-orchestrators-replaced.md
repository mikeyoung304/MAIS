---
status: resolved
priority: p1
issue_id: '524'
tags: [code-review, agent-ecosystem, architecture, migration]
dependencies: []
resolved_date: 2026-01-01
resolution: Verified that production routes now use new orchestrator hierarchy (AdminOrchestrator, CustomerChatOrchestrator). Legacy orchestrators have been deleted.
---

# Legacy Orchestrators in Production Routes Don't Use New Guardrails

## Problem Statement

The production routes (`agent.routes.ts` and `public-customer-chat.routes.ts`) are still using the legacy `AgentOrchestrator` and `CustomerOrchestrator` classes, NOT the new `BaseOrchestrator` subclasses with guardrails.

**Why it matters:** All the Phase 3-4 work (rate limiting, circuit breakers, tier budgets, prompt injection detection) is **not protecting production traffic**. The new infrastructure exists but isn't wired in.

## Findings

### Evidence from Architecture Strategist (CRITICAL)

> "The production routes use legacy orchestrators, not the new `BaseOrchestrator` hierarchy:
> | Route File | Orchestrator Used | Extends BaseOrchestrator? |
> |------------|------------------|---------------------------|
> | `agent.routes.ts:43` | `AgentOrchestrator` | No |
> | `public-customer-chat.routes.ts:29` | `CustomerOrchestrator` | No |"

### Current State

```
NEW (not in production):
  BaseOrchestrator
    ├── OnboardingOrchestrator
    ├── CustomerChatOrchestrator
    └── AdminOrchestrator

LEGACY (in production):
  AgentOrchestrator (1340 lines)
  CustomerOrchestrator (698 lines)
```

## Proposed Solutions

### Option A: Complete Migration (Recommended)

**Pros:** Activates all guardrails, removes duplication
**Cons:** Requires testing, potential behavior changes
**Effort:** Medium
**Risk:** Medium (needs thorough testing)

1. Update `agent.routes.ts` to use `AdminOrchestrator` or `OnboardingOrchestrator`
2. Update `public-customer-chat.routes.ts` to use `CustomerChatOrchestrator`
3. Deprecate and remove legacy orchestrators

### Option B: Phased Migration

**Pros:** Lower risk, gradual rollout
**Cons:** Temporary complexity
**Effort:** Medium
**Risk:** Low

1. Add feature flag to toggle between legacy and new orchestrators
2. Route percentage of traffic to new orchestrators
3. Monitor and gradually increase percentage

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Files to Update:**

- `server/src/routes/agent.routes.ts` (line 43)
- `server/src/routes/public-customer-chat.routes.ts` (line 29)

**Files to Deprecate:**

- `server/src/agent/orchestrator/orchestrator.ts`
- `server/src/agent/customer/customer-orchestrator.ts`

## Acceptance Criteria

- [ ] Production routes use new orchestrator hierarchy
- [ ] Rate limiting active for all agent traffic
- [ ] Circuit breakers active for all sessions
- [ ] Tier budgets enforced
- [ ] Legacy orchestrators deprecated or removed
- [ ] All tests pass

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2026-01-01 | Created from code review | New guardrails not protecting production |

## Resources

- Code review: Agent Ecosystem Phase 3-4
- Architecture diagram in `plans/agent-ecosystem-architecture.md`
