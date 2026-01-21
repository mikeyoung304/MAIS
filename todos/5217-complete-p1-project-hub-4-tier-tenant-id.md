---
status: complete
priority: p1
issue_id: '5217'
tags: [security, agent-v2, project-hub, code-review, tenant-isolation]
dependencies: []
---

# Project Hub: Missing 4-Tier Tenant ID Extraction Pattern

## Problem Statement

Project Hub uses a simplified 2-tier tenant extraction via `getContextFromSession()` which only checks state as a plain object. It completely misses the robust 4-tier pattern that Concierge implements. This will cause tenant ID extraction to fail in many ADK scenarios (direct calls, A2A, userId formats).

**Impact:** Agent tools may fail to identify the tenant, causing "No tenant context available" errors or worse - operating without proper tenant isolation.

## Findings

### Agent-Native Reviewer

Current implementation (lines 225-239):

```typescript
const state = ctx.state as unknown as Record<string, unknown>;
return {
  tenantId: (state.tenantId as string) || '',
};
```

Missing:

- Tier 1: `state.get<T>()` Map-like API
- Tier 3: userId with colon format (`tenantId:userId`)
- Tier 4: userId direct fallback

### TypeScript Reviewer

- Unsafe type assertion through `unknown`
- Empty string fallback masks errors instead of failing fast

## Proposed Solutions

### Option A: Implement 4-Tier Pattern (Recommended)

Copy the proven pattern from Concierge:

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Tier 1: Map-like API (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) return fromState;
  } catch {
    /* fall through */
  }

  // Tier 2: Plain object (A2A protocol)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj?.tenantId) return stateObj.tenantId as string;
  } catch {
    /* fall through */
  }

  // Tier 3 & 4: Extract from userId
  const userId = context.invocationContext?.session?.userId;
  if (userId?.includes(':')) {
    return userId.split(':')[0];
  }
  if (userId) return userId;

  return null;
}
```

**Pros:** Proven pattern, handles all scenarios
**Cons:** Needs copy from Concierge (intentional duplication per docs)
**Effort:** Small (1 hour)
**Risk:** Low

### Option B: Use Shared Module

Import from `server/src/agent-v2/shared/tenant-context.ts`.

**Pros:** Single source of truth
**Cons:** Need to verify build/deploy handles shared modules correctly
**Effort:** Small
**Risk:** Medium (deployment configuration)

## Recommended Action

**Option A** - Copy pattern to maintain agent independence, add comment linking to shared module.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (lines 225-239)

**Reference Implementation:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 327-385)
- `server/src/agent-v2/shared/tenant-context.ts`

## Acceptance Criteria

- [ ] `getTenantId()` implements all 4 tiers
- [ ] Returns `null` instead of empty string on failure
- [ ] Adds structured logging for each tier (debugging)
- [ ] Tests verify extraction from all 4 sources

## Work Log

| Date       | Action                                        | Result                                         |
| ---------- | --------------------------------------------- | ---------------------------------------------- |
| 2026-01-20 | Created from multi-agent code review          | Identified by 2 reviewers                      |
| 2026-01-20 | Implemented Option B - imported shared module | Using `getTenantId()` from `tenant-context.ts` |

## Resources

- [A2A Session State Prevention](docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)
- [ADK Agent Development Quick Reference](docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)
