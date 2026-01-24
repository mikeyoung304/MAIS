---
status: complete
priority: p1
issue_id: '5235'
tags: [code-review, security, agent, type-safety, adk]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Missing Zod safeParse Validation in Project Hub Agent Tool Execute Functions

> **Agent-Native Review:** Per MAIS Pitfall #62, all tool execute functions must validate params with Zod safeParse as the FIRST LINE.

## Problem Statement

Multiple tools in the Project Hub agent use destructured parameters without Zod safeParse validation. While parameters are typed by the ADK FunctionTool's Zod schema, runtime data from LLMs can still be malformed or contain injection attempts.

**File:** `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Affected Tools (11 total):**

- `getProjectStatus` (line 617)
- `getPrepChecklist` (line 659)
- `answerPrepQuestion` (line 696)
- `submitRequest` (line 848)
- `getTimeline` (line 951)
- `getPendingRequests` (line 1002)
- `getCustomerActivity` (line 1048)
- `approveRequest` (line 1089)
- `denyRequest` (line 1139)
- `sendMessageToCustomer` (line 1189)
- `updateProjectStatus` (line 1256)

**Current Pattern (Wrong):**

```typescript
execute: async ({ projectId }: { projectId: string }, ctx: ToolContext | undefined) => {
    // Context guard (good, but should be AFTER validation)
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // Direct use of projectId without validation!
    const result = await callBackendAPI(...);
```

**Required Pattern (per ZOD_PARAMETER_VALIDATION_PREVENTION.md):**

```typescript
execute: async (params, ctx: ToolContext | undefined) => {
    // FIRST: Zod validation
    const parseResult = GetProjectStatusSchema.safeParse(params);
    if (!parseResult.success) {
        return { success: false, error: parseResult.error.errors[0]?.message };
    }
    const { projectId } = parseResult.data;

    // SECOND: Context guard
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // Now safe to use validated params
    const result = await callBackendAPI(...);
```

**Risk:** LLM-generated parameters could contain malformed data that bypasses type checking, potentially leading to injection or unexpected behavior.

## Findings

| Reviewer          | Finding                                                |
| ----------------- | ------------------------------------------------------ |
| Agent-Native      | P1: Missing Zod safeParse in 11 tool execute functions |
| Security Sentinel | P2: Type assertion without runtime validation          |

## Proposed Solution

Add Zod schemas and safeParse validation to each tool's execute function:

```typescript
// Define schemas for each tool
const GetProjectStatusSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
});

const SubmitRequestSchema = z.object({
  projectId: z.string().min(1),
  requestType: z.enum(['RESCHEDULE', 'CANCELLATION', 'ADDON', 'QUESTION', 'REFUND', 'OTHER']),
  details: z.string().min(1),
  urgency: z.enum(['low', 'normal', 'high']).optional(),
  confirmationReceived: z.boolean(),
});

// Apply to each tool
const getProjectStatusTool = new FunctionTool({
  name: 'getProjectStatus',
  parameters: GetProjectStatusSchema, // Schema already defined for ADK
  execute: async (params, ctx) => {
    // FIRST: Validate
    const parsed = GetProjectStatusSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid parameters' };
    }

    // SECOND: Context guard
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // Now safe to use
    const { projectId } = parsed.data;
    // ...
  },
});
```

**Effort:** Medium (1-2 hours to update all 11 tools)
**Risk:** Low

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Acceptance Criteria:**

- [ ] All 11 tools have Zod safeParse as FIRST operation in execute
- [ ] Error responses include helpful validation messages
- [ ] Context guard (requireContext) runs AFTER validation
- [ ] Tests verify validation rejects malformed inputs

## Work Log

| Date       | Action                          | Learnings                                                         |
| ---------- | ------------------------------- | ----------------------------------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | Pitfall #62: Type assertion without validation is a security risk |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- Prevention guide: `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
- MAIS Pitfall #62: Type assertion without validation
