---
status: pending
priority: p3
issue_id: '5230'
tags: [data-integrity, agent-v2, project-hub, code-review, audit]
dependencies: []
---

# Project Hub: Event Logging Lacks Actor Identification

## Problem Statement

When logging events, the code does not include who performed the action. The `actor` field shown in the `ProjectEvent` interface is not being populated. This makes audit trails incomplete.

**Impact:** Cannot determine who took what action in event history.

## Findings

### Data Integrity Guardian

```typescript
// Lines 603-608 - sendMessageToCustomer
await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
  type: 'MESSAGE_FROM_TENANT',
  payload: { message },
  visibleToCustomer: true,
  visibleToTenant: true,
  // Missing: actor: tenantId or userId
});
```

The `ProjectEvent` interface (line 148) includes `actor: string` but it's never populated.

## Proposed Solutions

### Option A: Add Actor to All Event Logs (Recommended)

```typescript
// In all event logging calls
await callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
  type: 'MESSAGE_FROM_TENANT',
  actor: tenantId,
  actorType: contextType, // 'customer' or 'tenant'
  payload: { message },
  visibleToCustomer: true,
  visibleToTenant: true,
});
```

**Pros:** Complete audit trail
**Cons:** Need to pass context to all logging calls
**Effort:** Small (1 hour)
**Risk:** Very low

## Recommended Action

**Option A** - Add actor to all event logging.

## Technical Details

**Affected Calls:**

- `answerPrepQuestion` - actor: 'agent' or customerId
- `submitRequest` - actor: customerId
- `approveRequest` - actor: tenantId
- `denyRequest` - actor: tenantId
- `sendMessageToCustomer` - actor: tenantId
- `updateProjectStatus` - actor: tenantId

## Acceptance Criteria

- [ ] All event logging includes `actor` field
- [ ] Actor matches session context (customerId or tenantId)
- [ ] Include `actorType` for clarity
- [ ] Backend stores and returns actor in events

## Work Log

| Date       | Action                               | Result                                |
| ---------- | ------------------------------------ | ------------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Data Integrity Guardian |

## Resources

- [Audit Logging Best Practices](https://owasp.org/www-project-cheat-sheets/cheatsheets/Logging_Cheat_Sheet.html)
