---
status: complete
priority: p2
issue_id: '544'
tags: [code-review, performance, memory-management, circuit-breaker]
dependencies: []
---

# Circuit Breaker Cleanup Heuristic Ineffective

## Problem Statement

Circuit breaker cleanup checks `turnCount === 0` to identify dead sessions, but all sessions have `turnCount > 0` after their first message. The cleanup only removes sessions that were created but never used (edge case).

## Findings

**Security Sentinel + Code Simplicity Reviewer:**

> "Cleanup logic is ineffective. All circuits record turns immediately via recordTurn(). Sessions with turnCount > 0 from initial messages won't be cleaned until hard cap (1000) is hit."

**Evidence:**

```typescript
// Cleanup removes circuits with turns === 0
if (state.state === 'CLOSED' && state.turnCount === 0) {
  this.circuitBreakers.delete(sessionId);
}

// But circuits record turns immediately:
recordTurn(tokensUsed: number): void {
  this.turns++;  // All circuits will have turns > 0 after first message
}
```

**Impact:**

- Memory grows until hard cap (1000 entries, ~130KB)
- Cleanup is unpredictable (only every 100 calls)
- Stale sessions (24+ hours old) not cleaned until cap hit

## Solution Implemented

**Option A: Time-based cleanup** was implemented.

The CircuitBreaker class already stores `startTime` which is exposed via `getState()`. The cleanup logic now uses this timestamp to remove circuit breakers older than 65 minutes (session TTL is 60 minutes, with 5-minute buffer for race conditions).

```typescript
private cleanupOldCircuitBreakers(): void {
  let removed = 0;
  const now = Date.now();

  // Session TTL is 60 minutes; add buffer to avoid race conditions
  const CIRCUIT_BREAKER_TTL_MS = 65 * 60 * 1000; // 65 minutes

  for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
    const state = circuitBreaker.getState();
    const ageMs = now - state.startTime;

    // Remove circuit breakers older than TTL (orphaned after session expiry)
    if (ageMs > CIRCUIT_BREAKER_TTL_MS) {
      this.circuitBreakers.delete(sessionId);
      removed++;
    }
  }

  // Hard cap fallback still in place (1000 entries, ~130KB)
  // ...
}
```

**Benefits:**

- Reliably removes stale circuit breakers based on age
- No changes needed to CircuitBreaker class (already had `startTime`)
- Keeps hard cap as fallback for edge cases
- Documentation explains the cleanup strategy

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts:1009-1062`

## Acceptance Criteria

- [x] Time-based cleanup implemented (Option A)
- [x] Documentation explains cleanup strategy in code comments
- [x] Hard cap retained as fallback
- [x] TypeScript type check passes

## Work Log

| Date       | Action                         | Learnings                                  |
| ---------- | ------------------------------ | ------------------------------------------ |
| 2026-01-01 | Created from code review       | turnCount heuristic doesn't work           |
| 2026-01-01 | Implemented time-based cleanup | CircuitBreaker already had startTime field |

## Resources

- [Circuit breaker pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
