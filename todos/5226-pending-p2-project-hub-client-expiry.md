---
status: pending
priority: p2
issue_id: '5226'
tags: [data-integrity, agent-v2, project-hub, code-review]
dependencies: []
---

# Project Hub: 72-Hour Expiry is Client-Calculated

## Problem Statement

The `expiresAt` timestamp for escalation requests is calculated in the agent code and sent to the backend. This is a security concern - the backend must trust the client-provided value. A malicious agent modification could set arbitrarily long or short expiry times.

**Impact:** Requests could be created with infinite expiry or immediate expiry, bypassing business rules.

## Findings

### Data Integrity Guardian

```typescript
// Lines 375-386 in submitRequest
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + ESCALATION_EXPIRY_HOURS); // 72 hours

const request = await callBackendAPI<ProjectRequest>(
  `/project-hub/projects/${projectId}/requests`,
  'POST',
  {
    type: requestType,
    requestData: { details, urgency },
    expiresAt: expiresAt.toISOString(), // Trusting client-provided expiry
  }
);
```

## Proposed Solutions

### Option A: Server-Side Expiry Calculation (Recommended)

Remove `expiresAt` from request body - let backend calculate it:

```typescript
// Agent code - don't send expiresAt
const request = await callBackendAPI<ProjectRequest>(
  `/project-hub/projects/${projectId}/requests`,
  'POST',
  {
    type: requestType,
    requestData: { details, urgency },
    // Backend calculates: expiresAt = NOW() + INTERVAL '72 hours'
  }
);
```

Backend should:

1. Calculate `expiresAt` server-side
2. Validate against business rules
3. Return the calculated value

**Pros:** Server controls expiry, can't be manipulated
**Cons:** Requires backend change
**Effort:** Small (agent) + Medium (backend)
**Risk:** Low

### Option B: Validate Server-Side

Keep client calculation but have backend validate/override:

```typescript
// Backend validates
if (request.expiresAt > maxAllowedExpiry) {
  request.expiresAt = NOW() + INTERVAL '72 hours';
}
```

**Pros:** Less agent change needed
**Cons:** Still accepts client input
**Effort:** Medium (backend only)
**Risk:** Low

## Recommended Action

**Option A** - Remove client-side calculation entirely.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (lines 375-386)
- Backend: `server/src/routes/internal-agent.routes.ts` (create request endpoint)

## Acceptance Criteria

- [ ] Agent doesn't send `expiresAt` in request body
- [ ] Backend calculates expiry (72 hours from creation)
- [ ] Backend returns calculated expiry in response
- [ ] Expired requests cannot be approved (backend check)

## Work Log

| Date       | Action                               | Result                                |
| ---------- | ------------------------------------ | ------------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Data Integrity Guardian |

## Resources

- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
