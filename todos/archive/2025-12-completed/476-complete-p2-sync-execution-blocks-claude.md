# P2: Synchronous Proposal Execution Blocks Claude Response

## Status

**COMPLETE** - Implemented timeout-based solution (2024-12-29)

## Priority

**P2 - Important (Performance)**

## Description

T2 proposal execution happens synchronously within the chat message flow. If an executor takes a long time (e.g., slow Stripe API call), the entire Claude response is delayed. This creates poor UX for the customer waiting in the chatbot.

## Solution Implemented

### Timeout-Based Approach (Simpler Alternative)

Added a 5-second timeout wrapper around all executor calls to prevent slow executors from blocking the Claude response indefinitely:

```typescript
/**
 * Default timeout for proposal executors in milliseconds.
 * Prevents slow executors (e.g., Stripe API calls) from blocking Claude response.
 */
const EXECUTOR_TIMEOUT_MS = 5000;

/**
 * Execute a promise with a timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Executor timeout: ${operationName} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// Usage in executor call:
const result = await withTimeout(
  executor(tenantId, payload),
  EXECUTOR_TIMEOUT_MS,
  proposal.toolName
);
```

### Error Handling

When a timeout or execution failure occurs:

1. Proposal is marked as FAILED in database
2. Error is logged with proposal context
3. Failed proposals are tracked in `failedProposals` array
4. System prompt is updated to inform Claude about failures
5. Claude can apologize and offer alternatives to the user

## Files Changed

- `server/src/agent/orchestrator/orchestrator.ts`
  - Added `EXECUTOR_TIMEOUT_MS` constant (5000ms)
  - Added `withTimeout<T>()` utility function
  - Updated executor call to use timeout wrapper
  - Added logging of timeout in execution context

## Future Enhancement: Async Job Queue

For fully async execution without blocking, see the plan document:

- `plans/async-proposal-execution-job-queue.md`

This would involve:

1. BullMQ job queue backed by Redis
2. Separate worker process for execution
3. Status polling or WebSocket updates
4. ~17 hours of implementation effort

The async approach should be implemented when:

- Executors regularly exceed 5 seconds
- Guaranteed execution after server restarts is needed
- Executor workers need to scale independently

## Current Flow (After Fix)

```
User Message → softConfirmPendingT2 → Execute with 5s timeout → Claude API call → Response
                                            |
                                            v
                                    [If timeout: mark FAILED, inform Claude]
```

## Testing

- TypeScript typecheck passes
- Timeout behavior can be tested by adding artificial delay to an executor

## Tags

performance, agent, async, timeout, executor
