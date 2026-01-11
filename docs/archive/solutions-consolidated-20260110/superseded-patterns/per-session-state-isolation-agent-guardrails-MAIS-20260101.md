---
problem_type: architecture-patterns
component: agent-orchestrator
severity: P0
tags: [circuit-breaker, state-isolation, security, multi-tenant, guardrails]
root_cause: Shared singleton state in long-running service caused cross-session pollution
solution: Map-based per-session state with periodic cleanup
created: 2026-01-01
project: MAIS
related_issues: ['#539', '#536']
---

# Per-Session State Isolation for Agent Guardrails

## Problem Statement

Circuit breakers in `BaseOrchestrator` were implemented as a singleton instance shared across all sessions. When one user triggered errors (intentionally or accidentally), the circuit breaker would trip and block ALL users from accessing the service.

**Symptom:** One malicious or buggy client session could denial-of-service the entire agent system.

**Root Cause:** Classic singleton anti-pattern in a multi-user service.

```typescript
// BEFORE: Dangerous shared state
export class BaseOrchestrator {
  private circuitBreaker: CircuitBreaker | null = null;

  async chat(...) {
    // All sessions share THIS circuit breaker
    if (!this.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config);
    }
    this.circuitBreaker.recordError(); // One user's error affects everyone!
  }
}
```

## Working Solution

### 1. Per-Session Map Pattern

```typescript
// AFTER: Isolated per-session state
export class BaseOrchestrator {
  // Per-session circuit breakers (keyed by sessionId)
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private circuitBreakerCleanupCounter = 0;

  async chat(tenantId: string, sessionId: string, message: string) {
    // Get or create circuit breaker for THIS session only
    let circuitBreaker = this.circuitBreakers.get(sessionId);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config);
      this.circuitBreakers.set(sessionId, circuitBreaker);
    }

    // Now errors only affect THIS session
    circuitBreaker.recordError();

    // Periodic cleanup
    this.circuitBreakerCleanupCounter++;
    if (this.circuitBreakerCleanupCounter >= 100) {
      this.cleanupOldCircuitBreakers();
      this.circuitBreakerCleanupCounter = 0;
    }
  }
}
```

### 2. Memory Management with Cleanup

```typescript
private cleanupOldCircuitBreakers(): void {
  let removed = 0;

  for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
    const state = circuitBreaker.getState();
    // Remove inactive circuit breakers (turnCount === 0 means no activity)
    if (state.state === 'CLOSED' && state.turnCount === 0) {
      this.circuitBreakers.delete(sessionId);
      removed++;
    }
  }

  // Hard cap to prevent unbounded growth
  const MAX_CIRCUIT_BREAKERS = 1000;
  if (this.circuitBreakers.size > MAX_CIRCUIT_BREAKERS) {
    const toRemove = this.circuitBreakers.size - MAX_CIRCUIT_BREAKERS;
    let removedForCap = 0;
    for (const [sessionId] of this.circuitBreakers) {
      if (removedForCap >= toRemove) break;
      this.circuitBreakers.delete(sessionId);
      removedForCap++;
    }
  }

  if (removed > 0) {
    logger.debug({ removed, remaining: this.circuitBreakers.size },
      'Cleaned up old circuit breakers');
  }
}
```

## Key Design Decisions

1. **Map over WeakMap**: We use `Map` because sessionIds are strings, not objects. WeakMap only works with object keys.

2. **Cleanup Trigger**: Every 100 chat calls triggers cleanup. This amortizes cleanup cost across requests.

3. **Hard Cap**: 1000 entry limit prevents memory exhaustion from many unique sessions.

4. **Activity Detection**: `turnCount === 0` indicates a session that was created but never used (likely abandoned).

## Prevention Checklist

When adding stateful components to multi-user services:

- [ ] Is the state user/session-specific? → Use `Map<userId/sessionId, State>`
- [ ] Is the state tenant-specific? → Use `Map<tenantId, State>`
- [ ] Is the state truly global? → Singleton is OK (rare case)
- [ ] Does the Map need cleanup? → Add periodic cleanup with hard cap
- [ ] Can malicious users exploit shared state? → Always assume yes

## Red Flags in Code Review

```typescript
// RED FLAG: Mutable class property without session key
private cache = new Map<string, Data>();  // Shared across sessions!

// RED FLAG: Singleton rate limiter
private rateLimiter = new RateLimiter();  // One user can exhaust for all!

// RED FLAG: Shared counter
private requestCount = 0;  // Cross-session pollution!
```

## Test Cases

```typescript
describe('Per-Session Circuit Breaker Isolation', () => {
  it('should not affect other sessions when one trips', async () => {
    const orchestrator = new TestOrchestrator(prisma);

    // Session A trips circuit breaker
    for (let i = 0; i < 10; i++) {
      await orchestrator.chat('tenant1', 'session-A', 'error trigger');
    }

    // Session B should still work
    const result = await orchestrator.chat('tenant1', 'session-B', 'hello');
    expect(result.message).not.toContain('circuit breaker');
  });

  it('should cleanup inactive circuit breakers', async () => {
    const orchestrator = new TestOrchestrator(prisma);

    // Create many sessions
    for (let i = 0; i < 150; i++) {
      await orchestrator.chat('tenant1', `session-${i}`, 'hello');
    }

    // Force cleanup
    orchestrator.forceCleanup();

    // Should have removed inactive ones
    expect(orchestrator.getCircuitBreakerCount()).toBeLessThan(150);
  });
});
```

## Related Patterns

- **Rate Limiter Isolation**: Same pattern applies - use `Map<sessionId, RateLimiter>`
- **Budget Tracker**: Already correctly created per-turn, but verify no session leakage
- **Context Cache**: Uses `Map<tenantId, Context>` - correct pattern

## File References

- `server/src/agent/orchestrator/base-orchestrator.ts:200-206` - Circuit breaker Map declaration
- `server/src/agent/orchestrator/base-orchestrator.ts:391-402` - Per-session retrieval
- `server/src/agent/orchestrator/base-orchestrator.ts:1015-1046` - Cleanup implementation

## Cross-References

- [Circuit Breaker Session Bypass Todo](/todos/536-deferred-p2-circuit-breaker-session-bypass.md)
- [Phase 5 Testing and Caching Prevention](/docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [Agent Ecosystem Quick Reference](/docs/solutions/AGENT_ECOSYSTEM_QUICK_REFERENCE.md)
