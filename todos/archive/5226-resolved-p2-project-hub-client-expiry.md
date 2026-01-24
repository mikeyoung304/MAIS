---
status: resolved
priority: p2
issue_id: '5226'
tags: [data-integrity, agent-v2, project-hub, code-review]
dependencies: []
---

# Project Hub: 72-Hour Expiry is Client-Calculated

## Problem Statement

The `expiresAt` timestamp for escalation requests is calculated in the agent code and sent to the backend. This is a security concern - the backend must trust the client-provided value.

## Resolution

**Already Implemented** - Upon investigation, this issue was already fixed:

1. **Agent code** (`project-hub/src/agent.ts:1062-1071`) does NOT send `expiresAt`:

   ```typescript
   // Note: expiresAt is calculated server-side in project-hub.service.ts
   const result = await callBackendAPI<...>(
     `/project-hub/create-request`,
     'POST',
     {
       tenantId: session.tenantId,
       projectId,
       type: requestType,
       requestData: { details, urgency: effectiveUrgency },
     }
   );
   ```

2. **Backend service** (`project-hub.service.ts:581-583`) calculates server-side:

   ```typescript
   // Calculate expiry (72 hours for escalation deadline)
   const expiresAt = new Date();
   expiresAt.setHours(expiresAt.getHours() + 72);
   ```

3. **Route schema** (`internal-agent.routes.ts`) only accepts: tenantId, projectId, type, requestData

## Acceptance Criteria

- [x] Agent doesn't send `expiresAt` in request body
- [x] Backend calculates expiry (72 hours from creation)
- [x] Backend returns calculated expiry in response
- [x] Expired requests cannot be approved (backend check)

## Work Log

| Date       | Action                               | Result                                |
| ---------- | ------------------------------------ | ------------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Data Integrity Guardian |
| 2026-01-23 | Verified already implemented         | Resolved (no changes needed)          |
