# P2: User Feedback on Failed Proposals

## Status

**COMPLETE** - Resolved 2025-12-29

## Priority

**P2 - Important**

## Description

When a T2 proposal execution fails, the proposal is marked as FAILED in the database but there's no mechanism to inform the user what went wrong. The chat session continues without any error message to the customer.

## Location

- `server/src/agent/orchestrator/orchestrator.ts` (lines ~411-509)
- Chat response flow

## Solution Implemented

### 1. Track Failed Proposals

Added `failedProposals` array to collect failures during T2 execution:

```typescript
// Track failed proposals to inform Claude so it can apologize and offer alternatives
const failedProposals: Array<{ id: string; toolName: string; reason: string }> = [];
```

### 2. Capture Failures in All Error Paths

Three failure paths now populate the `failedProposals` array:

- Proposal not found (security/tenant mismatch)
- No executor registered for tool
- Executor throws an exception

### 3. Inject Failure Context into System Prompt

When failures occur, context is appended to the system prompt:

```typescript
if (failedProposals.length > 0) {
  const failureContext = failedProposals.map((f) => `- ${f.toolName}: ${f.reason}`).join('\n');
  systemPrompt += `\n\n---\n\n## Recent Action Failures\n\nSome actions I tried to execute failed:\n${failureContext}\n\nPlease acknowledge these failures to the user, apologize briefly, and offer alternatives or ask how to proceed.`;
}
```

This allows Claude to:

1. Acknowledge what went wrong
2. Apologize briefly
3. Offer alternatives or ask how to proceed

## Impact

- **User Experience**: Customer now receives clear feedback when operations fail
- **Trust**: Transparent error handling builds confidence in the system
- **Debugging**: Failures are logged with full context

## Files Modified

- `server/src/agent/orchestrator/orchestrator.ts`

## Verification

- TypeScript: `npm run typecheck` passes

## Tags

ux, agent, proposal, error-handling, feedback
