---
status: complete
priority: p1
issue_id: '5236'
tags: [code-review, data-integrity, agent, concierge, optimistic-locking]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Hardcoded expectedVersion=1 in Concierge Direct API Fallback Breaks Optimistic Locking

> **Agent-Native Review:** Direct API fallback hardcodes version, causing silent failures for concurrent modifications.

## Problem Statement

The `handleProjectHubDirect` function in Concierge hardcodes `expectedVersion: 1` for approve/deny operations. This breaks optimistic locking for any request that has been viewed or updated previously.

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`
**Lines:** 1171, 1189

**Evidence:**

```typescript
case 'approve_request': {
  if (!params.requestId) {
    return { success: false, error: 'Request ID is required for approval' };
  }
  const result = await callMaisApi('/project-hub/approve-request', tenantId, {
    requestId: params.requestId,
    expectedVersion: 1, // <-- HARDCODED - will fail on version > 1
  });
  // ...
}

case 'deny_request': {
  // Same issue at line 1189
  expectedVersion: 1, // <-- HARDCODED
}
```

**Impact:** When Project Hub agent is unavailable and Concierge falls back to direct API:

1. If request version is > 1, API returns 409 Conflict
2. Concierge returns error to user
3. User cannot approve/deny requests through chat
4. Degrades to requiring dashboard UI

## Findings

| Reviewer       | Finding                                                 |
| -------------- | ------------------------------------------------------- |
| Agent-Native   | P1: Hardcoded expectedVersion breaks optimistic locking |
| Data Integrity | P2: Fallback path bypasses version check entirely       |

## Proposed Solutions

### Option A: Accept expectedVersion from Params (Recommended)

Update the `DelegateToProjectHubParams` schema to include `expectedVersion` and pass it through:

```typescript
const DelegateToProjectHubParams = z.object({
  task: z.string(),
  projectId: z.string().optional(),
  requestId: z.string().optional(),
  reason: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(), // Add this
});

// In handleProjectHubDirect:
case 'approve_request': {
  if (!params.requestId) {
    return { success: false, error: 'Request ID is required' };
  }
  if (!params.expectedVersion) {
    return { success: false, error: 'Expected version is required for approval' };
  }
  const result = await callMaisApi('/project-hub/approve-request', tenantId, {
    requestId: params.requestId,
    expectedVersion: params.expectedVersion,
  });
}
```

**Pros:** Maintains optimistic locking, matches intended behavior
**Cons:** Requires LLM to extract version from context
**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: Fetch Current Version Before Operation

```typescript
case 'approve_request': {
  // Fetch current request to get version
  const request = await callMaisApi(`/project-hub/requests/${params.requestId}`, tenantId);
  if (!request.success) {
    return { success: false, error: 'Request not found' };
  }
  const result = await callMaisApi('/project-hub/approve-request', tenantId, {
    requestId: params.requestId,
    expectedVersion: request.data.version,
  });
}
```

**Pros:** Always uses correct version
**Cons:** Extra API call, slight race condition window
**Effort:** Small (45 minutes)
**Risk:** Medium (TOCTOU between fetch and update)

### Option C: Remove Direct API Fallback for State-Changing Operations

Only allow read operations in direct fallback; require full agent for approve/deny.

**Pros:** Simplest fix, maintains integrity
**Cons:** Reduces fallback capability
**Effort:** Small (15 minutes)
**Risk:** Low

## Recommended Action

**Option A** - Accept expectedVersion from params. The Project Hub agent should already have the version from bootstrap or getPendingRequests, and can pass it through delegation.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts` (DelegateToProjectHubParams, handleProjectHubDirect)

**Acceptance Criteria:**

- [ ] expectedVersion included in DelegateToProjectHubParams schema
- [ ] Fallback requires expectedVersion for approve/deny operations
- [ ] Error message guides user if version missing
- [ ] Tests verify version is passed through

## Work Log

| Date       | Action                          | Learnings                                                      |
| ---------- | ------------------------------- | -------------------------------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | Fallback paths must maintain same constraints as primary paths |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- Optimistic locking pattern: ADR-018
