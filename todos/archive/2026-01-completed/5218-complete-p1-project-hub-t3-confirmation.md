---
status: complete
priority: p1
issue_id: '5218'
tags: [security, agent-v2, project-hub, code-review, trust-tiers]
dependencies: []
---

# Project Hub: Missing T3 Confirmation for High-Risk Actions

## Problem Statement

Project Hub has T3 actions (refunds, cancellations) mentioned in the system prompt but the tools that handle these (`submitRequest`, `approveRequest`, `denyRequest`) lack programmatic confirmation enforcement via `confirmationReceived` parameter. This means the LLM can execute irreversible actions without explicit user confirmation.

**Impact:** A confused LLM or prompt injection could trigger refunds or cancellations without the user explicitly confirming. Per pitfall #49, trust tier enforcement must be programmatic, not prompt-only.

## Findings

### Agent-Native Reviewer

`submitRequest` tool (lines 345-409):

```typescript
parameters: z.object({
  requestType: z.enum([
    'RESCHEDULE',
    'ADD_ON',
    'QUESTION',
    'CHANGE_REQUEST',
    'CANCELLATION',
    'REFUND',
    'OTHER',
  ]),
  // NO confirmationReceived for CANCELLATION or REFUND types!
});
```

### Security Sentinel

- `approveRequest` and `denyRequest` also lack confirmation enforcement
- Prompt says T3 requires confirmation, but code doesn't enforce it

### Reference (Concierge `publishChangesTool`):

```typescript
parameters: z.object({
  confirmationReceived: z.boolean()
    .describe('Set to true ONLY if user explicitly confirmed'),
}),
execute: async (params, context) => {
  if (!params.confirmationReceived) {
    return {
      error: 'T3 action requires explicit confirmation',
      message: 'Ask the user to confirm...',
    };
  }
}
```

## Proposed Solutions

### Option A: Add confirmationReceived to High-Risk Tools (Recommended)

Modify `submitRequest`, `approveRequest`, `denyRequest` to require confirmation for T3 actions.

```typescript
const submitRequest = new FunctionTool({
  parameters: z.object({
    // ... existing params
    confirmationReceived: z
      .boolean()
      .describe('Required TRUE for CANCELLATION or REFUND. User must explicitly confirm.'),
  }),
  execute: async ({ requestType, confirmationReceived, ...rest }, ctx) => {
    if (['CANCELLATION', 'REFUND'].includes(requestType) && !confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        message: `Please confirm you want to submit a ${requestType.toLowerCase()} request.`,
        requiresConfirmation: true,
      };
    }
    // ... rest
  },
});
```

**Pros:** Programmatic enforcement, follows established pattern
**Cons:** LLM must be trained to request confirmation first
**Effort:** Medium (2-3 hours for all 3 tools)
**Risk:** Low

### Option B: Separate T3 Tools

Create dedicated tools for T3 actions with built-in confirmation:

- `submit_refund_request` (with confirmation)
- `submit_cancellation_request` (with confirmation)

**Pros:** Clearer separation, easier to audit
**Cons:** More tools, more code
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Option A** - Add conditional confirmation to existing tools.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Tools to Update:**

- `submitRequest` (for CANCELLATION, REFUND types)
- `approveRequest` (for refund/cancellation approvals)
- `denyRequest` (less critical but for consistency)

## Acceptance Criteria

- [ ] `submitRequest` requires `confirmationReceived: true` for CANCELLATION and REFUND
- [ ] `approveRequest` requires confirmation for refund-type requests
- [ ] Returns clear error message when confirmation missing
- [ ] System prompt updated to instruct LLM to request confirmation first
- [ ] Tests verify T3 enforcement

## Work Log

| Date       | Action                                                        | Result                                       |
| ---------- | ------------------------------------------------------------- | -------------------------------------------- |
| 2026-01-20 | Created from multi-agent code review                          | Identified by 2 reviewers                    |
| 2026-01-20 | Implemented Option A - confirmationReceived for submitRequest | T3_REQUEST_TYPES constant, conditional check |

## Resources

- [CLAUDE.md Pitfall #49](CLAUDE.md) - T3 without confirmation param
- [Concierge publishChangesTool](server/src/agent-v2/deploy/concierge/src/agent.ts:1143-1180)
