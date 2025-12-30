# P2: Nested Transaction Boundary Issue in Proposal Confirmation

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Architecture Issue**

## Description

In `agent.routes.ts`, the executor is called INSIDE a transaction, but executors also create their own transactions (e.g., `create_booking` uses advisory locks). Nested transactions in PostgreSQL may cause unexpected behavior.

## Location

- `server/src/routes/agent.routes.ts` (line ~379)

## Current Code

```typescript
const result = await prisma.$transaction(async (tx) => {
  const executorResult = await executor(tenantId, validatedPayload); // executor may have own transaction
  await tx.agentProposal.update(...);
});
```

## Expected Code

```typescript
// Execute outside transaction, then update proposal status
const executorResult = await executor(tenantId, validatedPayload);
await prisma.agentProposal.update({
  where: { id: proposalId },
  data: { status: 'EXECUTED', result: executorResult },
});
```

## Impact

- **Data Integrity**: Nested transactions may not behave as expected in PostgreSQL
- **Deadlocks**: Advisory locks inside nested transactions can cause deadlocks
- **Debugging**: Subtle bugs that are hard to reproduce

## Fix Steps

1. Remove outer `$transaction` wrapper in agent.routes.ts
2. Ensure executors handle their own transaction boundaries
3. Update proposal status after executor completes
4. Add integration test for concurrent proposal execution

## Related Files

- `server/src/agent/executors/index.ts` - Check which executors use transactions
- `server/src/services/booking.service.ts` - Uses advisory locks

## Testing

- Test concurrent T3 proposal confirmations
- Verify no deadlocks under load
- Check advisory lock behavior

## Tags

architecture, agent, proposal, transaction, code-review
