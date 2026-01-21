---
status: pending
priority: p2
issue_id: '5222'
tags: [agent-native, agent-v2, project-hub, code-review, ux]
dependencies: []
---

# Project Hub: Tools Don't Return Updated State

## Problem Statement

Per pitfall #52, tools that modify state must return updated state so the agent knows what changed. Several Project Hub tools return minimal acknowledgments without state indicators, causing the agent to lose context and potentially ask redundant questions.

**Impact:** Agent may ask "What's your project status?" after the customer just submitted a request, because it doesn't know the status changed to "awaiting response."

## Findings

### Agent-Native Reviewer

`submitRequest` return (lines 397-407):

```typescript
return {
  success: true,
  requestId: request.id,
  message: `Your ${requestType} request has been submitted...`,
  expiresAt: request.expiresAt,
  // Missing: hasPendingRequest, projectStatus, etc.
};
```

### Architecture Strategist

- Tools should return state flags for agent context
- Missing: `hasPendingRequest`, `pendingRequestCount`, `projectStatus`

## Proposed Solutions

### Option A: Enrich Tool Returns (Recommended)

Add state indicators to all mutating tools:

```typescript
// submitRequest
return {
  success: true,
  requestId: request.id,
  message: '...',
  expiresAt: request.expiresAt,
  // State indicators
  hasPendingRequest: true,
  requestStatus: 'PENDING',
  projectStatus: 'awaiting_tenant_response',
  pendingRequestCount: existingCount + 1,
};

// approveRequest
return {
  success: true,
  request: result.request,
  // State indicators
  requestStatus: 'APPROVED',
  projectStatus: 'active',
  hasPendingRequests: remainingCount > 0,
};

// sendMessageToCustomer
return {
  success: true,
  message: 'Message sent',
  // State indicators
  lastMessageAt: new Date().toISOString(),
  unreadByCustomer: 1,
};
```

**Pros:** Agent maintains context, fewer redundant questions
**Cons:** Larger responses, need to track state
**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

**Option A** - Enrich returns for all mutating tools.

## Technical Details

**Affected Tools:**

- `submitRequest` - add `hasPendingRequest`, `projectStatus`
- `approveRequest` - add `requestStatus`, `remainingPendingCount`
- `denyRequest` - add `requestStatus`, `remainingPendingCount`
- `sendMessageToCustomer` - add `lastMessageAt`, `unreadCount`
- `updateProjectStatus` - add new `projectStatus`

## Acceptance Criteria

- [ ] All mutating tools return state indicators
- [ ] State indicators match actual backend state
- [ ] Agent uses state indicators in responses (verify via testing)

## Work Log

| Date       | Action                               | Result                    |
| ---------- | ------------------------------------ | ------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by 2 reviewers |

## Resources

- [CLAUDE.md Pitfall #52](CLAUDE.md) - Tool confirmation-only response
