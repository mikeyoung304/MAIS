---
status: completed
priority: p1
issue_id: '549'
tags: [code-review, testing, agent-ecosystem, observability]
dependencies: []
---

# P1: Metrics Module (237 lines) has 0% Test Coverage

## Problem Statement

The `metrics.ts` module (237 lines) has **zero test coverage**. This module provides all Prometheus metrics for the agent ecosystem:

- `recordToolCall()` - Counter for tool invocations
- `recordRateLimitHit()` - Rate limit hit tracking
- `recordCircuitBreakerTrip()` - Circuit breaker trip events
- `recordTurnDuration()` - Histogram for turn timing
- `recordProposal()` - Proposal creation tracking
- `recordTierBudgetExhausted()` - Budget exhaustion events
- `recordApiError()` - API error tracking
- `setActiveSessions()` - Gauge for active sessions
- `getAgentMetrics()` - Prometheus text format output

**Why it matters:** Metrics could silently break without detection, destroying production observability.

## Findings

| Reviewer               | Finding                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Test Coverage Reviewer | metrics.ts has 0 unit tests                                      |
| Security Reviewer      | Metrics endpoint exposed without authentication (separate issue) |

## Proposed Solutions

### Option 1: Unit Tests for Each Record Function (Recommended)

**Effort:** Small (2-3 hours)

Test that each record function increments counters correctly.

```typescript
describe('recordToolCall', () => {
  it('should increment counter with correct labels', () => {
    const mockCounter = { inc: vi.fn() };
    // Inject mock, call function, verify inc() called
  });
});
```

**Pros:**

- Direct, fast tests
- Easy to verify label correctness

**Cons:**

- Need to mock prom-client

### Option 2: Integration Test with Real prom-client

**Effort:** Medium (3-4 hours)

Use real prom-client and verify `getAgentMetrics()` output.

**Pros:**

- Tests actual Prometheus output format
- No mocking needed

**Cons:**

- Slower, more complex assertions

## Recommended Action

Start with **Option 1** for unit tests, add one **Option 2** snapshot test for output format.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/metrics.ts`
- `server/test/agent/orchestrator/metrics.test.ts` (new)

**Functions to Test:**

1. `recordToolCall(toolName, trustTier, status, agentType)` - 4 labels
2. `recordRateLimitHit(toolName, limitType, agentType)` - 3 labels
3. `recordCircuitBreakerTrip(reason, agentType)` - 2 labels
4. `recordTurnDuration(durationMs, agentType)` - histogram observe
5. `getAgentMetrics()` - Prometheus text format

## Acceptance Criteria

- [x] Unit test for each `record*()` function
- [x] Verify correct labels are applied
- [x] Snapshot test for `getAgentMetrics()` output format
- [x] Test that metrics singleton is properly shared

## Work Log

| Date       | Action                   | Learnings                                                                                          |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-01-01 | Created from code review | Test Coverage Reviewer identified 0% coverage                                                      |
| 2026-01-01 | Implemented 43 tests     | Used real prom-client with registry reset for test isolation. 100% coverage achieved in <1 second. |

## Resources

- prom-client testing: https://github.com/siimon/prom-client#testing
