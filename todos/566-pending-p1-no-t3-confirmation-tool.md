---
status: pending
priority: p1
issue_id: '566'
tags: [code-review, agent-native, agent-ecosystem, quality-first-triage]
dependencies: []
---

# P1: No T3 Confirmation Tool in Conversation

> **Quality-First Triage:** New finding. "Cannot complete T3 flows without UI. Fundamentally breaks conversational agent model."

## Problem Statement

When `book_service` (T3) creates a proposal, it returns:

```typescript
return {
  success: true,
  proposalId: proposal.proposalId,
  requiresApproval: true,
  message: `Ready to book... Click "Confirm Booking" to proceed.`,
};
```

The message says "Click" - this assumes a UI button. There is **no `confirm_proposal` tool** that the agent can invoke when the user says "yes, confirm that."

The `confirmProposal()` method exists in `proposal.service.ts:144`, but it's only callable from routes, not exposed as an agent tool.

**Why it matters:** Forces hybrid UI/chat interactions. Breaks the conversational model. Agent cannot complete booking flow purely through conversation.

## Findings

| Reviewer            | Finding                                           |
| ------------------- | ------------------------------------------------- |
| Agent-Native Triage | P1: Cannot complete T3 flows through conversation |

## Proposed Solutions

### Option 1: Add confirm_proposal Tool (Recommended)

**Effort:** Small (1-2 hours)

Add a T1 `confirm_proposal` tool:

```typescript
{
  name: 'confirm_proposal',
  trustTier: 'T1', // The confirmation step itself is safe
  description: 'Confirm a pending T3 proposal after user explicitly approves',
  inputSchema: {
    proposalId: { type: 'string' },
    userConfirmation: { type: 'string' } // The user's confirmation text
  },
  execute: async (input, context) => {
    // Verify user confirmation contains affirmative
    // Call proposalService.confirmProposal()
    // Return execution result
  }
}
```

## Technical Details

**Affected Files:**

- `server/src/agent/customer/customer-tools.ts` - Add tool
- `server/src/agent/tools/write-tools.ts` - Add tool for admin

## Acceptance Criteria

- [ ] Add `confirm_proposal` T1 tool
- [ ] Tool validates user confirmation text contains affirmative
- [ ] Tool calls existing `proposalService.confirmProposal()`
- [ ] Test for conversational booking completion

## Work Log

| Date       | Action                            | Learnings                                    |
| ---------- | --------------------------------- | -------------------------------------------- |
| 2026-01-01 | Created from quality-first triage | Agent-Native agent identified capability gap |
