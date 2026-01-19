---
status: ready
priority: p1
issue_id: '5185'
tags: [code-review, agent-v2, architecture, a2a-protocol]
dependencies: []
---

# getTenantId Implementation Inconsistency Across Agents

## Problem Statement

The `getTenantId()` helper function implementations vary significantly across agent-v2 agents. The Research and Booking agents only use `state.get()` which fails with A2A protocol (where state is passed as a plain object, not a Map). The Storefront agent has a defensive 4-tier fallback pattern, while others have 2-tier or 1-tier implementations.

**Why it matters:** This is the root cause of A2A session failures. When the Concierge delegates to a specialist, the specialist cannot extract the tenantId, causing "No tenant context available" errors and broken multi-tenant isolation.

## Findings

**Source:** Agent-v2 code review

**Locations:**

1. **Booking Agent** (1-tier, broken for A2A):
   `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/booking/src/agent.ts:172-176`

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  const tenantId = context.state?.get<string>('tenantId');
  return tenantId ?? null;
}
```

2. **Research Agent** (1-tier, broken for A2A):
   `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/research/src/agent.ts:246-250`

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  const tenantId = context.state?.get<string>('tenantId');
  return tenantId ?? null;
}
```

3. **Marketing Agent** (2-tier, partially working):
   `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/marketing/src/agent.ts:149-169`

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Get from session state (preferred)
  const fromState = context.state?.get<string>('tenantId');
  if (fromState) return fromState;

  // Try 2: Extract from userId (format: "tenantId:userId" or just "tenantId")
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    const tenantId = userId.includes(':') ? userId.split(':')[0] : userId;
    if (tenantId) return tenantId;
  }

  return null;
}
```

4. **Storefront Agent** (4-tier, defensive, CORRECT):
   `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/storefront/src/agent.ts:190-237`

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Get from session state using Map-like interface
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) return fromState;
  } catch (e) {
    // state.get() might not be available or might throw
  }

  // Try 2: Access state as plain object (A2A passes state as plain object)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) return tenantId;
    }
  } catch (e) {}

  // Try 3: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) return tenantId;
    } else {
      return userId;
    }
  }

  return null;
}
```

**Impact:** When Concierge delegates to Research or Booking specialists, they fail to extract tenantId from the A2A protocol state object, returning "No tenant context available" errors.

## Proposed Solutions

### Solution 1: Extract to Shared Utility (Recommended)

**Approach:** Create a shared `getTenantId` utility that all agents import

```typescript
// server/src/agent-v2/deploy/shared/tenant-context.ts
export function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Map-like state.get() (direct agent calls)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) return fromState;
  } catch {}

  // Try 2: Plain object state (A2A protocol)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && 'tenantId' in stateObj && typeof stateObj.tenantId === 'string') {
      return stateObj.tenantId;
    }
  } catch {}

  // Try 3: Extract from userId (format: "tenantId:userId" or "tenantId")
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    return userId.includes(':') ? userId.split(':')[0] : userId;
  }

  // Try 4: userId IS the tenantId (Concierge pattern)
  if (userId) return userId;

  return null;
}
```

**Pros:**

- Single source of truth
- All agents get the fix automatically
- Easier to maintain and test

**Cons:**

- Requires shared package setup for standalone agents
- ADK deploy may need bundling configuration

**Effort:** 2 hours

### Solution 2: Copy-Paste Standardized Function to Each Agent

**Approach:** Update each agent file with the Storefront's 4-tier pattern

**Pros:**

- No shared package dependencies
- Works with current ADK deploy setup
- Standalone agents remain truly standalone

**Cons:**

- Code duplication (violates DRY)
- Easy to diverge over time
- Must update all agents for any fix

**Effort:** 30 minutes

### Solution 3: Add Type Guard + Fallback Chain

**Approach:** Keep per-agent functions but standardize on a minimum 4-tier chain with type guards

```typescript
function isMapLike(obj: unknown): obj is { get: <T>(key: string) => T | undefined } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'get' in obj &&
    typeof (obj as any).get === 'function'
  );
}

function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try Map-like interface
  if (isMapLike(context.state)) {
    const tenantId = context.state.get<string>('tenantId');
    if (tenantId) return tenantId;
  }

  // Try plain object
  // ... rest of fallback chain
}
```

**Pros:**

- Type-safe
- Clear intent
- Defensive programming

**Cons:**

- Still code duplication
- More verbose

**Effort:** 1 hour

## Recommended Action

**Implement Solution 2** immediately (copy Storefront pattern to all agents), then migrate to Solution 1 when setting up shared utilities for agent-v2.

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/booking/src/agent.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/research/src/agent.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/marketing/src/agent.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/concierge/src/agent.ts`

**Related Components:**

- A2A protocol state passing
- Concierge delegation tools
- All specialist agent tools

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] All agents use identical 4-tier getTenantId fallback pattern
- [ ] Test: A2A delegation from Concierge to Research extracts tenantId
- [ ] Test: A2A delegation from Concierge to Booking extracts tenantId
- [ ] Test: Direct agent calls (not via A2A) still work
- [ ] Test: userId-as-tenantId fallback works
- [ ] Add unit tests for getTenantId with all 4 input formats
- [ ] Document the canonical pattern in SERVICE_REGISTRY.md

## Work Log

| Date       | Action                          | Learnings                                 |
| ---------- | ------------------------------- | ----------------------------------------- |
| 2026-01-19 | Issue identified in code review | A2A passes state as plain object, not Map |

## Resources

- **Reference Implementation:** Storefront agent getTenantId (lines 190-237)
- **Related Issue:** A2A camelCase requirement (CLAUDE.md pitfall #32)
- **ADK Documentation:** State handling in A2A protocol
