---
status: complete
priority: p1
issue_id: '5219'
tags: [security, agent-v2, project-hub, code-review, idor, data-integrity]
dependencies: ['5217']
---

# Project Hub: Tools Don't Verify Ownership (IDOR Vulnerability)

## Problem Statement

All Project Hub tools accept user-provided IDs (`projectId`, `requestId`, `tenantId`) without verifying ownership. This creates Insecure Direct Object Reference (IDOR) vulnerabilities where:

- A customer could access another customer's project data
- A tenant could approve/deny requests belonging to other tenants

**Impact:** Critical data breach potential. Customer A could see Customer B's booking details, prep instructions, and communication history.

## Findings

### Security Sentinel

`getProjectStatus` (lines 250-277):

```typescript
parameters: z.object({
  projectId: z.string().describe('The project ID to check status for'),
}),
execute: async ({ projectId }, _ctx) => {  // ctx is UNUSED!
  const project = await callBackendAPI<Project>(
    `/project-hub/projects/${projectId}`,  // User-controlled ID
    'GET'
  );
}
```

### Data Integrity Guardian

- `approveRequest` and `denyRequest` only accept `requestId` - no tenant verification
- Backend is trusted to enforce ownership, but agent doesn't pass tenant context

### Pattern Across All Tools

- Customer tools: `getProjectStatus`, `getPrepChecklist`, `answerPrepQuestion`, `submitRequest`, `getTimeline`
- Tenant tools: `getPendingRequests`, `getCustomerActivity`, `approveRequest`, `denyRequest`, `sendMessageToCustomer`, `updateProjectStatus`

## Proposed Solutions

### Option A: Session-Based IDs (Recommended for Customer Tools)

Don't accept `projectId` as a parameter. Get it from session state instead.

```typescript
const getProjectStatus = new FunctionTool({
  parameters: z.object({}), // Remove projectId from params
  execute: async (_args, ctx) => {
    const { customerId, projectId, tenantId } = getContextFromSession(ctx!);
    if (!projectId) {
      return { error: 'No project context in session' };
    }

    // Backend verifies ownership
    const project = await callBackendAPI<Project>(
      `/project-hub/tenants/${tenantId}/customers/${customerId}/projects/${projectId}`,
      'GET'
    );
  },
});
```

**Pros:** Strongest security - user can't manipulate IDs
**Cons:** Requires session to have correct context
**Effort:** Medium (update 5 customer tools)
**Risk:** Low

### Option B: Pass Context for Backend Verification

Keep parameters but also pass session context for backend verification.

```typescript
const project = await callBackendAPI(`/project-hub/projects/${projectId}`, 'GET', {
  tenantId,
  customerId,
  verifyOwnership: true,
});
// Backend returns 403 if project doesn't belong to customer
```

**Pros:** Backward compatible, defense in depth
**Cons:** Still trusts backend, agent doesn't enforce
**Effort:** Small (add context to API calls)
**Risk:** Medium (backend must be correctly implemented)

### Option C: Agent-Side Ownership Check

Fetch ownership data first, then verify before proceeding.

**Pros:** Agent-enforced security
**Cons:** Extra API call, complexity
**Effort:** Large
**Risk:** Medium

## Recommended Action

**Option A** for customer tools, **Option B** for tenant tools.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Customer Tools (use Option A):**

- `getProjectStatus`, `getPrepChecklist`, `answerPrepQuestion`, `submitRequest`, `getTimeline`

**Tenant Tools (use Option B):**

- `getPendingRequests`, `getCustomerActivity`, `approveRequest`, `denyRequest`, `sendMessageToCustomer`, `updateProjectStatus`

## Acceptance Criteria

- [ ] Customer tools get projectId from session, not parameters
- [ ] Tenant tools pass tenantId to backend for verification
- [ ] Backend returns 403 for ownership violations
- [ ] Tests verify cross-tenant/cross-customer access is blocked
- [ ] Security test: attempt IDOR attack scenarios

## Work Log

| Date       | Action                               | Result                                                                         |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| 2026-01-20 | Created from multi-agent code review | Identified by 2 reviewers (HIGH confidence)                                    |
| 2026-01-20 | Implemented hybrid approach          | Customer tools verify session.projectId; Tenant tools pass tenantId to backend |

## Resources

- [OWASP IDOR](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [MAIS Multi-Tenant Patterns](CLAUDE.md)
