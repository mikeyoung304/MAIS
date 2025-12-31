# P1: Sequential T2 Proposal Execution Causes Latency

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P1 - Critical Performance Issue**

## Description

The T2 soft-confirm execution loop in `orchestrator.ts` processes proposals sequentially with individual database fetches. For N proposals, this adds N \* 50-100ms latency to the chat response, blocking Claude's response until ALL proposals execute.

## Location

- `server/src/agent/orchestrator/orchestrator.ts` (lines 450-558)

## Current Code

```typescript
for (const proposalId of softConfirmedIds) {
  // Each iteration: 1 findFirst + 1 executor call + 1 markExecuted/markFailed
  const proposal = await this.prisma.agentProposal.findFirst({...});
  // ... execute ...
  const result = await withTimeout(executor(...), ...);
  await this.proposalService.markExecuted(proposalId, result);
}
```

## Expected Code

```typescript
// Batch-fetch all proposals in a single query before the loop
const proposals = await this.prisma.agentProposal.findMany({
  where: { id: { in: softConfirmedIds }, tenantId },
});

// For independent proposals, execute in parallel
const results = await Promise.allSettled(
  proposals.map((proposal) =>
    withTimeout(executor(tenantId, proposal.payload), EXECUTOR_TIMEOUT_MS, proposal.toolName)
  )
);
```

## Impact

- **Performance**: 50-100ms added to response time per pending T2 proposal
- **UX**: User waits for ALL proposals to execute before seeing Claude's response
- **Scalability**: Chat becomes slower as more tools are used

## Fix Steps

1. Batch-fetch all proposals with `findMany` and `IN` clause
2. Group proposals by dependency (if any)
3. Execute independent proposals in parallel with `Promise.allSettled()`
4. Handle individual failures gracefully
5. Reduce latency from N \* timeout to max(timeouts)

## Related Files

- `server/src/agent/customer/customer-orchestrator.ts` - Check for same pattern
- `server/src/agent/proposals/proposal.service.ts` - Review batch update methods

## Testing

- Load test with 5+ concurrent T2 proposals
- Measure response time before and after
- Verify error handling for partial failures

## Tags

performance, agent, proposal, t2-confirmation, latency, code-review
