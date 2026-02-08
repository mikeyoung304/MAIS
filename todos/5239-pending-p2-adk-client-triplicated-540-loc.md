---
status: pending
priority: p2
issue_id: '5239'
tags: [code-review, architecture, agent-v2, enterprise-review]
dependencies: []
---

# ADK Client Code Triplicated Across 3 Agent Services (~540 LOC)

## Problem Statement

The ADK Zod schemas (`AdkSessionResponseSchema`, `AdkPartSchema`, `AdkContentSchema`, `AdkEventSchema`, `AdkRunResponseSchema`), `fetchWithTimeout()`, `extractAgentResponse()`, and `extractToolCalls()` are copy-pasted identically across 3 files. A bug fix in ADK response handling must be applied in all 3 places or the system silently diverges.

**Why it matters:** ~540 lines of duplicated code. Any ADK protocol change requires 3 synchronized updates. Silent divergence is the most dangerous failure mode.

## Findings

**Source:** Architecture Strategist + Code Simplicity reviews (PR #42, 2026-02-08)

**Locations:**

- `server/src/services/vertex-agent.service.ts` (~150 lines schemas + ~120 lines parsing)
- `server/src/services/customer-agent.service.ts` (~150 lines schemas + ~120 lines parsing)
- `server/src/services/project-hub-agent.service.ts` (~150 lines schemas + ~120 lines parsing)
- `server/src/routes/tenant-admin-tenant-agent.routes.ts:884` (4th copy of `extractToolCalls`)

## Proposed Solutions

### Option A: Extract shared `adk-client.ts` module (Recommended)

- Create `server/src/lib/adk-client.ts` with shared schemas + parsing utilities
- All 3 services import from shared module
- **Pros:** Single source of truth, unit-testable, ~540 lines removed
- **Cons:** Need to verify all 3 services use identical logic (minor differences may exist)
- **Effort:** Medium (extract + verify + test)
- **Risk:** Low

### Option B: Register in DI container as `AdkClient` service

- Full DI-managed service with constructor injection
- **Pros:** Testable, mockable, follows hexagonal pattern
- **Cons:** More ceremony than needed for stateless utilities
- **Effort:** Medium-Large
- **Risk:** Low

## Acceptance Criteria

- [ ] ADK schemas defined in exactly ONE file
- [ ] `extractAgentResponse()` and `extractToolCalls()` have ONE implementation
- [ ] All 3 agent services import from shared module
- [ ] Unit tests for the shared module

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
