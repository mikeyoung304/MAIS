---
status: deferred
priority: p2
issue_id: '5193'
tags: [code-review, agent-v2, architecture, resilience]
dependencies: []
---

# No Circuit Breaker for Specialist Agent Failures

## Problem Statement

When a specialist agent is down or failing, Concierge keeps trying to call it with only basic retry logic. No circuit breaker prevents repeated calls to a failing service.

**Why it matters:** If Marketing agent is down, every marketing request will timeout (30s+ wait) and retry, creating poor UX and wasted resources.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 350-441)

Current behavior:

- Retry up to MAX_RETRIES=2 times
- No tracking of specialist health
- No "fail fast" when specialist is known to be down

## Proposed Solutions

### Option A: Simple Circuit Breaker Pattern (Recommended)

**Pros:** Fast failure, automatic recovery
**Cons:** Adds complexity
**Effort:** Medium (2 hours)

```typescript
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 30000; // 30 seconds

const circuitBreakers = new Map<string, CircuitState>();

function canCallSpecialist(name: string): boolean {
  const circuit = circuitBreakers.get(name);
  if (!circuit || circuit.state === 'closed') return true;
  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure > CIRCUIT_RESET_MS) {
      circuit.state = 'half-open';
      return true;
    }
    return false;
  }
  return true; // half-open allows one attempt
}
```

### Option B: Fallback Behavior

**Pros:** Graceful degradation
**Cons:** Concierge may not have specialist expertise
**Effort:** Medium (2 hours)

When specialist unavailable, Concierge attempts task directly with its general capabilities.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [ ] Circuit breaker tracks failures per specialist
- [ ] After 3 consecutive failures, circuit opens for 30s
- [ ] User gets fast "specialist temporarily unavailable" message
- [ ] Circuit auto-recovers after cooldown period

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2026-01-19 | Created | From architecture review |
