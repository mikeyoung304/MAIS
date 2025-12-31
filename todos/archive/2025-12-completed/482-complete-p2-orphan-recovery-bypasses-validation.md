# P2: Orphaned Proposal Recovery Bypasses Schema Validation

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Security Issue**

## Description

In `cleanup.ts`, orphaned proposals are executed without calling `validateExecutorPayload()`. This bypasses the Zod schema validation that protects against malformed or malicious payloads.

## Location

- `server/src/jobs/cleanup.ts` (line ~136)

## Current Code

```typescript
const orphaned = await prisma.agentProposal.findMany({
  where: { status: 'CONFIRMED', updatedAt: { lt: orphanCutoff } },
});

for (const proposal of orphaned) {
  const executor = getProposalExecutor(proposal.toolName);
  if (executor) {
    await executor(proposal.tenantId, proposal.payload as Record<string, unknown>);
    // No validation before execution!
  }
}
```

## Expected Code

```typescript
import { validateExecutorPayload } from '../agent/proposals/executor-schemas';

for (const proposal of orphaned) {
  const executor = getProposalExecutor(proposal.toolName);
  if (executor) {
    try {
      const validatedPayload = validateExecutorPayload(
        proposal.toolName,
        proposal.payload as Record<string, unknown>
      );
      await executor(proposal.tenantId, validatedPayload);
    } catch (error) {
      logger.error({ proposalId: proposal.id, error }, 'Orphan recovery validation failed');
      await proposalService.markFailed(proposal.id, error.message);
    }
  }
}
```

## Impact

- **Security**: Malformed payloads could cause executor errors or exploits
- **Data Integrity**: Invalid data could be written to database
- **Consistency**: Different validation paths for fresh vs orphaned proposals

## Fix Steps

1. Import `validateExecutorPayload` in cleanup.ts
2. Wrap executor call with validation
3. Mark proposal as FAILED if validation fails
4. Log validation errors for debugging

## Related Files

- `server/src/agent/proposals/executor-schemas.ts` - Validation function
- `server/src/agent/orchestrator/orchestrator.ts` - Uses validation

## Testing

- Create orphaned proposal with invalid payload
- Verify it fails gracefully during recovery
- Check logs for validation error

## Tags

security, agent, proposal, validation, cleanup, code-review
