---
status: completed
priority: p2
issue_id: "539"
tags: [code-review, agent-ecosystem, patterns, bugs]
dependencies: []
completed_date: "2026-01-01"
---

# Mutable Circuit Breaker State Shared Across Sessions

## Problem Statement

Circuit breaker is created once per orchestrator instance but orchestrators are reused. One user's session could trip the circuit breaker for all users of that tenant.

## Findings

**Pattern Recognition:**
> "The orchestrator is instantiated once but holds per-session state. If the same orchestrator instance is used for multiple concurrent sessions... the circuit breaker state will be shared across all sessions."

**Architecture Strategist:**
> "Mutable circuit breaker state in base class... could cause issues if the same orchestrator instance is used across multiple concurrent sessions."

**Location:** `base-orchestrator.ts` (lines 201-206, 389-401, 1015-1047)

## Solution Implemented

Circuit breakers are now keyed by sessionId in a Map:

1. **Per-session storage (lines 201-206):**
   ```typescript
   // Per-session circuit breakers (keyed by sessionId to prevent cross-session pollution)
   private readonly circuitBreakers = new Map<string, CircuitBreaker>();
   private circuitBreakerCleanupCounter = 0;
   ```

2. **Get or create per-session (lines 389-394):**
   ```typescript
   let circuitBreaker = this.circuitBreakers.get(session.sessionId);
   if (!circuitBreaker) {
     circuitBreaker = new CircuitBreaker(config.circuitBreaker);
     this.circuitBreakers.set(session.sessionId, circuitBreaker);
   }
   ```

3. **Periodic cleanup to prevent memory leaks (lines 1015-1047):**
   - Runs every 100 chat calls
   - Removes circuit breakers with no recorded turns (dead sessions)
   - Enforces hard cap of 1000 entries

4. **Fixed cleanup logic bug:**
   - Changed `state.state === 'CLOSED'` to `!state.isTripped` (correct property name)
   - Changed `state.turnCount` to `state.turns` (correct property name)

## Acceptance Criteria

- [x] Circuit breaker state per-session (Map keyed by sessionId)
- [x] No cross-session state pollution (each session gets own circuit breaker)
- [x] Tests pass (54/54 orchestrator tests pass)
- [x] Memory leak prevention (cleanup removes dead sessions, hard cap enforced)
