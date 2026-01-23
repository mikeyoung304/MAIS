---
status: complete
priority: p3
issue_id: '5227'
tags: [quality, agent-v2, project-hub, code-review, dead-code]
dependencies: []
resolved_at: '2026-01-21'
resolution: 'Already fixed - unused interfaces and timeout constants were removed during initial implementation'
---

# Project Hub: Unused Interfaces and Constants

## Problem Statement

Several TypeScript interfaces and constants are defined but never used:

- `TenantContext` interface (lines 123-127)
- `CustomerContext` interface (lines 129-134)
- `TIMEOUTS.SPECIALIST_DEFAULT` (line 167)
- `TIMEOUTS.SPECIALIST_RESEARCH` (line 168)
- `TIMEOUTS.METADATA_SERVICE` (line 169)

**Impact:** Code bloat, confusing for maintainers.

## Findings

### TypeScript Reviewer

```typescript
interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tier: string;
}

interface CustomerContext {
  customerId: string;
  customerName: string;
  projectId: string;
  bookingId: string;
}
// ^ Neither interface is used anywhere
```

### Simplicity Reviewer

- `TIMEOUTS` object has values for specialist agents that Project Hub doesn't delegate to
- Only `TIMEOUTS.BACKEND_API` is actually used

## Proposed Solutions

### Option A: Remove Unused Code (Recommended)

Delete unused interfaces and timeout constants:

```typescript
// Keep only what's used
const TIMEOUTS = {
  BACKEND_API: 15_000,
} as const;

// Remove TenantContext and CustomerContext interfaces
// OR use them to properly type getContextFromSession
```

**Pros:** Cleaner code, easier to maintain
**Cons:** May need to add back if functionality is implemented
**Effort:** Small (15 minutes)
**Risk:** Very low

### Option B: Use the Interfaces

Type the return of `getContextFromSession` properly:

```typescript
type SessionContext =
  | ({ contextType: 'customer' } & CustomerContext & { tenantId: string })
  | ({ contextType: 'tenant' } & TenantContext);
```

**Pros:** Better type safety
**Cons:** More work
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Option A** - Remove unused code. Add back if needed later.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Lines to Remove:**

- 123-134 (interfaces)
- 167-169 (unused timeout values)

## Acceptance Criteria

- [ ] Remove `TenantContext` and `CustomerContext` interfaces
- [ ] Remove unused TIMEOUTS constants
- [ ] Verify no references broken
- [ ] TypeScript compiles successfully

## Work Log

| Date       | Action                               | Result                    |
| ---------- | ------------------------------------ | ------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by 2 reviewers |

## Resources

- [Clean Code - Dead Code](https://refactoring.guru/smells/dead-code)
