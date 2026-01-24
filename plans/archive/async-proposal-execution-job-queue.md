# Async Proposal Execution with Job Queue

## Problem Statement

T2 proposal execution currently happens synchronously within the chat message flow. If an executor takes a long time (e.g., slow Stripe API call), the entire Claude response is delayed. This creates poor UX for the customer waiting in the chatbot.

## Current State (After Timeout Fix)

We implemented a 5-second timeout per executor as an interim solution:

```typescript
const result = await withTimeout(
  executor(tenantId, payload),
  EXECUTOR_TIMEOUT_MS, // 5000ms
  proposal.toolName
);
```

This prevents infinite blocking but doesn't solve the fundamental issue: execution is still synchronous.

## Proposed Architecture

### Option A: BullMQ Job Queue (Recommended)

```
User Message -> softConfirmPendingT2 -> Queue Job -> Claude API call -> Response
                                              |
                                              v
                              [Worker Process] -> Execute proposals -> Update DB
                                              |
                                              v
                              [WebSocket/Polling] -> Update UI
```

**Components:**

1. **Job Queue (BullMQ)**
   - Redis-backed job queue for proposal execution
   - Retry with exponential backoff
   - Job status tracking

2. **Worker Process**
   - Separate process for executing proposals
   - Can be scaled horizontally
   - Isolated from main API server

3. **Status Updates**
   - WebSocket for real-time updates (preferred)
   - OR polling endpoint for proposal status

### Option B: Fire-and-Forget with Database Polling

Simpler but less robust:

```typescript
if (softConfirmedIds.length > 0) {
  // Fire-and-forget - don't await
  this.executeProposalsAsync(tenantId, softConfirmedIds).catch((err) =>
    logger.error('Async execution failed', err)
  );
}
```

**Risks:**

- Lost execution if server restarts
- No retry mechanism
- Harder to track status

## Implementation Plan

### Phase 1: Infrastructure Setup

1. Add BullMQ dependency: `npm install bullmq`
2. Add Redis connection (already have via Upstash for other features)
3. Create `server/src/jobs/` directory structure:
   ```
   server/src/jobs/
     queues/
       proposal-execution.queue.ts
     workers/
       proposal-execution.worker.ts
     index.ts
   ```

### Phase 2: Queue Implementation

```typescript
// server/src/jobs/queues/proposal-execution.queue.ts
import { Queue } from 'bullmq';

export interface ProposalExecutionJob {
  proposalId: string;
  tenantId: string;
  toolName: string;
  payload: Record<string, unknown>;
}

export const proposalExecutionQueue = new Queue<ProposalExecutionJob>('proposal-execution', {
  connection: { url: process.env.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
```

### Phase 3: Worker Implementation

```typescript
// server/src/jobs/workers/proposal-execution.worker.ts
import { Worker } from 'bullmq';

export const proposalWorker = new Worker<ProposalExecutionJob>(
  'proposal-execution',
  async (job) => {
    const { proposalId, tenantId, toolName, payload } = job.data;

    const executor = getProposalExecutor(toolName);
    if (!executor) {
      throw new Error(`No executor for ${toolName}`);
    }

    const result = await executor(tenantId, payload);
    await proposalService.markExecuted(proposalId, result);

    return result;
  },
  {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
  }
);

// Handle job failures
proposalWorker.on('failed', async (job, err) => {
  if (job) {
    await proposalService.markFailed(job.data.proposalId, err.message);
  }
});
```

### Phase 4: Orchestrator Update

```typescript
// In chat() method:
if (softConfirmedIds.length > 0) {
  // Queue for async execution (don't await)
  for (const proposalId of softConfirmedIds) {
    const proposal = await this.prisma.agentProposal.findFirst({
      where: { id: proposalId, tenantId },
    });

    if (proposal) {
      await proposalExecutionQueue.add('execute', {
        proposalId,
        tenantId,
        toolName: proposal.toolName,
        payload: proposal.payload as Record<string, unknown>,
      });
    }
  }

  // Update system prompt to acknowledge background processing
  systemPrompt += '\nNote: Some confirmed operations are being processed.';
}
```

### Phase 5: Status Polling Endpoint

```typescript
// GET /v1/agent/proposals/:proposalId/status
router.get('/proposals/:proposalId/status', async (req, res) => {
  const { proposalId } = req.params;
  const { tenantId } = req.tenantAuth;

  const proposal = await proposalService.getProposal(tenantId, proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  return res.json({
    proposalId: proposal.id,
    status: proposal.status,
    result: proposal.result,
    error: proposal.error,
    executedAt: proposal.executedAt,
  });
});
```

### Phase 6: Frontend Integration

```typescript
// CustomerChatWidget.tsx - Poll for proposal status
const pollProposalStatus = async (proposalId: string) => {
  const maxAttempts = 30;
  const pollInterval = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    const status = await fetchProposalStatus(proposalId);

    if (status.status === 'EXECUTED') {
      // Show success notification
      return status.result;
    }

    if (status.status === 'FAILED') {
      // Show error notification
      throw new Error(status.error);
    }

    await delay(pollInterval);
  }

  // Timeout - proposal still processing
  throw new Error('Operation is taking longer than expected');
};
```

## Effort Estimate

| Phase                   | Effort | Priority |
| ----------------------- | ------ | -------- |
| Infrastructure Setup    | 2h     | P1       |
| Queue Implementation    | 3h     | P1       |
| Worker Implementation   | 4h     | P1       |
| Orchestrator Update     | 2h     | P1       |
| Status Polling Endpoint | 2h     | P2       |
| Frontend Integration    | 4h     | P2       |

**Total: ~17h (2-3 days)**

## Dependencies

- Redis (Upstash - already configured)
- BullMQ npm package
- Worker process management (can run in same server initially)

## Risks and Mitigations

| Risk                        | Mitigation                                     |
| --------------------------- | ---------------------------------------------- |
| Redis connection failures   | Fallback to sync execution with timeout        |
| Worker crashes              | Supervisor process (PM2) for automatic restart |
| Lost jobs on server restart | Redis persistence + job recovery on startup    |
| Race conditions             | Use advisory locks (already have this pattern) |

## Decision

For now, we implemented the **simpler timeout approach** (5-second executor timeout) as it:

- Prevents blocking
- Requires no new infrastructure
- Is easy to test and verify

The full async job queue approach should be implemented when:

- We have executors that regularly exceed 5 seconds
- We need guaranteed execution even after server restarts
- We want to scale executor workers independently

## Related Files

- `server/src/agent/orchestrator/orchestrator.ts` - Timeout implementation
- `server/src/agent/proposals/proposal.service.ts` - Proposal state management
- `server/src/agent/proposals/executor-registry.ts` - Executor registration
