---
status: pending
priority: p1
issue_id: '450'
tags: [architecture, agent, code-review, layered-architecture]
dependencies: []
---

# Agent Tools Bypass Service Layer (Architecture Violation)

## Problem Statement

All agent read tools, write tools, and executors directly access Prisma instead of going through the established service layer (routes -> services -> adapters -> ports). This violates the layered architecture documented in CLAUDE.md and creates several problems:

1. Business logic duplicated between tools and services
2. Changes to business rules require updates in multiple places
3. No code reuse from existing services (CatalogService, BookingService, etc.)
4. Advisory lock patterns duplicated in executors instead of reusing BookingService

## Severity: P1 - CRITICAL

This is an architectural violation that creates maintenance burden and risks business logic drift.

## Findings

- **Location**: `server/src/agent/tools/read-tools.ts`, `server/src/agent/tools/write-tools.ts`, `server/src/agent/executors/index.ts`
- All 17 read tools directly query `prisma` from `ToolContext`
- All 19 write tools directly query `prisma` for validation before creating proposals
- All executors perform database mutations via Prisma instead of calling services
- Partial mitigation: `create_booking` executor implements its own advisory lock (duplicates BookingService logic)

## Problem Scenario

1. Business rule changes (e.g., booking validation)
2. Developer updates BookingService with new logic
3. Agent's `create_booking` executor still has old logic
4. Inconsistent behavior between API and agent paths

## Proposed Solutions

### Option 1: Inject Services into ToolContext (Recommended)

- **Pros**: Full reuse, single source of truth, testable with mocks
- **Cons**: Larger refactor, requires updating DI container
- **Effort**: Large (8+ hours)
- **Risk**: Medium

```typescript
export interface ToolContext {
  tenantId: string;
  sessionId: string;
  catalogService: CatalogService;
  bookingService: BookingService;
  // ... other services
}
```

### Option 2: Create Thin Agent-Specific Services

- **Pros**: Isolate agent logic, lower risk
- **Cons**: Still some duplication, another abstraction layer
- **Effort**: Medium (4-6 hours)
- **Risk**: Low

### Option 3: Keep as-is with Documentation

- **Pros**: No code changes, document the pattern
- **Cons**: Doesn't solve the problem, tech debt accumulates
- **Effort**: Small
- **Risk**: High (long-term)

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/types.ts` - Add services to ToolContext
  - `server/src/agent/tools/read-tools.ts` - Refactor to use services
  - `server/src/agent/tools/write-tools.ts` - Refactor to use services
  - `server/src/agent/executors/index.ts` - Refactor to use services
  - `server/src/di.ts` - Wire services to orchestrator
- **Related Components**: CatalogService, BookingService, DashboardService (new?)
- **Database Changes**: No

## Acceptance Criteria

- [ ] Tools call services instead of Prisma directly
- [ ] No duplicate business logic between tools and services
- [ ] Tests pass with mocked services
- [ ] Advisory lock logic removed from executor (reuses BookingService)

## Resources

- Source: Code Review - Architecture Review Agent (2025-12-28)
- Related: CLAUDE.md layered architecture documentation
- Pattern: `server/src/di.ts` for DI patterns

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Large (8+ hours for full refactor)
