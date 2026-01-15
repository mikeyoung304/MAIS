---
status: completed
priority: p2
issue_id: '518'
tags:
  - code-review
  - architecture
  - caching
  - phase-5
dependencies: []
---

# Missing Cache Invalidation After Write Tool Execution

## Problem Statement

The orchestrator exposes `invalidateContextCache(tenantId)` but it's not being called after successful write tool executions. This means if a tool modifies tenant data (packages, bookings, etc.), the cached context becomes stale.

**Why it matters:** Users could see outdated stats in the context (wrong package count, stale revenue) until the 5-minute TTL expires. This creates inconsistency between what the agent "knows" and reality.

## Findings

**Source:** Architecture Review Agent, Security Review Agent

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts`

**Evidence:** The method exists but is never called internally:

```typescript
// Line 870-872
invalidateContextCache(tenantId: string): void {
  contextCache.invalidate(tenantId);
}
```

Write tools like `upsert_services`, `update_storefront` modify tenant data but don't trigger invalidation.

## Proposed Solutions

### Solution 1: Invalidate After Write Tool Success (Recommended)

**Description:** In `processResponse()`, invalidate cache after successful write tool execution

```typescript
// After tool execution in processResponse()
if (result.success && tool.isWriteTool) {
  this.invalidateContextCache(tenantId);
  logger.debug({ tenantId, toolName: tool.name }, 'Cache invalidated after write');
}
```

**Pros:**

- Automatic invalidation for all write tools
- Consistent fresh data after modifications

**Cons:**

- Need to tag tools as write vs read
- May cause more cache misses (more DB queries)

**Effort:** Small (1 hour)
**Risk:** Low

### Solution 2: Tool-Specific Invalidation

**Description:** Have write tools return a flag indicating cache invalidation is needed

```typescript
interface AgentToolResult {
  success: boolean;
  invalidateCache?: boolean;
  // ...
}
```

**Pros:**

- Fine-grained control
- Only invalidates when truly needed

**Cons:**

- Each tool must remember to set the flag
- Easy to forget

**Effort:** Medium (2 hours)
**Risk:** Medium (easy to forget flag)

### Solution 3: Accept 5-Minute Staleness

**Description:** Document that context may be up to 5 minutes stale and rely on `refresh_context` tool

**Pros:**

- No code changes
- Tools already provide fresh data when asked

**Cons:**

- Inconsistent UX
- Agent may give wrong advice based on stale stats

**Effort:** None
**Risk:** Medium (UX issue)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent/orchestrator/orchestrator.ts`
- `server/src/agent/tools/types.ts` (if adding write tool flag)

**Write tools that modify tenant data:**

- `upsert_services`
- `update_storefront`
- `update_package`
- `create_booking`

## Acceptance Criteria

- [x] Cache is invalidated after successful write tool execution
- [x] Subsequent messages reflect fresh data
- [x] Write tools are properly identified
- [x] No performance regression from invalidation

## Work Log

| Date       | Action                                                           | Learnings                                   |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------- |
| 2025-12-31 | Created from Phase 5 code review                                 | Cache staleness after writes                |
| 2025-12-31 | Fixed: Added WRITE_TOOLS constant and invalidation after success | Solution 1 (minimal code, centralized list) |

## Resources

- [Phase 5 Architecture Review](internal)
- [Cache invalidation patterns](https://martinfowler.com/bliki/TwoHardThings.html)
