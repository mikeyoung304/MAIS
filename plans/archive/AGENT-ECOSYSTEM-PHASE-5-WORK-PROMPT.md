# Agent Ecosystem Phase 5 Continuation Work Prompt

**Copy this entire file and paste it into a new Claude Code session.**

---

## Context

You are continuing implementation of the Enterprise AI Agent Ecosystem for MAIS. Phases 1-4 are **complete**, code review is **complete**, and todos have been created for all findings.

### Session Progress Summary

| Phase   | Task                                  | Status  |
| ------- | ------------------------------------- | ------- |
| **3.1** | BaseOrchestrator abstract class       | ✅ Done |
| **3.2** | OnboardingOrchestrator                | ✅ Done |
| **3.3** | CustomerChatOrchestrator              | ✅ Done |
| **3.4** | AdminOrchestrator                     | ✅ Done |
| **4.1** | ToolRateLimiter unit tests (17 tests) | ✅ Done |
| **4.2** | CircuitBreaker unit tests (15 tests)  | ✅ Done |
| **4.3** | BudgetTracker unit tests (22 tests)   | ✅ Done |
| **4.4** | Code review with 8 parallel agents    | ✅ Done |
| **4.5** | Todo files created for all findings   | ✅ Done |
| **4.6** | Fix P1 (CRITICAL) findings            | ✅ Done |
| **4.7** | Fix P2 (IMPORTANT) findings           | ✅ Done |
| **5.x** | Prometheus metrics + logging          | ✅ Done |

### Code Review Summary (2026-01-01)

**8 parallel agents reviewed the implementation:**

- DHH Rails Reviewer (simplicity)
- Kieran TypeScript (type safety)
- Security Sentinel (vulnerabilities)
- Architecture Strategist (patterns)
- Code Simplicity (test quality)
- Performance Oracle (bottlenecks)
- Agent-Native Reviewer (AI patterns)
- Pattern Recognition (duplication)

**Findings Created:**

| Priority          | Count  | Todo IDs |
| ----------------- | ------ | -------- |
| 🔴 P1 (CRITICAL)  | 5      | 522-526  |
| 🟡 P2 (IMPORTANT) | 15     | 527-541  |
| **Total**         | **20** | 522-541  |

### Key P1 Findings (CRITICAL - Address First)

1. **#522** - Branded types `SessionId`/`TenantId` defined but never used
2. **#523** - Double type assertion `as unknown as AgentTool[]` bypasses type checking
3. **#524** - Legacy orchestrators in production routes (guardrails not protecting traffic!)
4. **#525** - Rate limiter session state not persisted (bypassable on restart)
5. **#526** - Massive code duplication between legacy and new orchestrators

### Verification

- TypeScript compiles cleanly: `npm run typecheck` ✅
- All 281 agent tests pass: `npm test -- test/agent` ✅
- All 54 guardrail tests pass ✅
- Pre-existing test failures (unrelated): rate limiter timeout, demo seed timeout

---

## Before Phase 5: Fix Critical Findings

### Option A: Triage and Fix (Recommended)

```bash
# 1. Triage the findings to prioritize
/triage

# 2. Fix all pending todos in parallel
/resolve_todo_parallel

# 3. Verify fixes
npm run typecheck
npm test -- test/agent
```

### Option B: Fix P1s Manually

The most critical issue is **#524** - production routes don't use new orchestrators:

```bash
# View the P1 todos
cat todos/522-pending-p1-*.md
cat todos/523-pending-p1-*.md
cat todos/524-pending-p1-*.md
cat todos/525-pending-p1-*.md
cat todos/526-pending-p1-*.md
```

**Priority order:**

1. #524 - Migrate routes to new orchestrators (activates guardrails)
2. #526 - Delete legacy orchestrators (depends on #524)
3. #522 - Use or remove branded types
4. #523 - Fix double type assertion
5. #525 - Persist rate limiter state (can be deferred)

---

## After Fixes: Phase 5 Work

### 5.1: Install prom-client and Create Agent Metrics

```bash
# Install prom-client
npm install --workspace=server prom-client
npm install --workspace=server -D @types/prom-client
```

**Create metrics module:**

```typescript
// server/src/agent/orchestrator/metrics.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// Create a dedicated registry for agent metrics
export const agentRegistry = new Registry();

export const agentMetrics = {
  toolCallsTotal: new Counter({
    name: 'agent_tool_calls_total',
    help: 'Total tool calls by tool name and status',
    labelNames: ['tool_name', 'trust_tier', 'status', 'agent_type'],
    registers: [agentRegistry],
  }),

  rateLimitHits: new Counter({
    name: 'agent_rate_limit_hits_total',
    help: 'Rate limit blocks by tool',
    labelNames: ['tool_name', 'agent_type'],
    registers: [agentRegistry],
  }),

  circuitBreakerTrips: new Counter({
    name: 'agent_circuit_breaker_trips_total',
    help: 'Circuit breaker trips by reason',
    labelNames: ['reason', 'agent_type'],
    registers: [agentRegistry],
  }),

  turnDuration: new Histogram({
    name: 'agent_turn_duration_seconds',
    help: 'Duration of agent turns',
    labelNames: ['agent_type'],
    buckets: [0.5, 1, 2, 5, 10, 30],
    registers: [agentRegistry],
  }),

  activeSessions: new Gauge({
    name: 'agent_active_sessions',
    help: 'Number of active agent sessions',
    labelNames: ['agent_type'],
    registers: [agentRegistry],
  }),

  proposalsTotal: new Counter({
    name: 'agent_proposals_total',
    help: 'Proposals created by status and tier',
    labelNames: ['status', 'trust_tier', 'agent_type'],
    registers: [agentRegistry],
  }),
};
```

### 5.2: Extend /metrics Endpoint

Update `server/src/routes/metrics.routes.ts` to serve Prometheus format:

```typescript
import { register } from 'prom-client';
import { agentRegistry } from '../agent/orchestrator/metrics';

// GET /metrics - Prometheus text format
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  const defaultMetrics = await register.metrics();
  const agentMetrics = await agentRegistry.metrics();
  res.send(defaultMetrics + '\n' + agentMetrics);
});

// GET /metrics/json - JSON format (backwards compatible)
app.get('/metrics/json', (_req, res) => {
  // ... existing JSON implementation
});
```

### 5.3: Enhance Structured Logging

Add agent-specific log context to BaseOrchestrator:

```typescript
// In processResponse():
logger.info(
  {
    tenantId,
    sessionId,
    agentType: config.agentType,
    turnNumber: currentTurn,
    tierBudgetRemaining: budgetTracker.remaining,
    rateLimitStats: this.rateLimiter.getStats(),
    toolsExecuted: toolResults.length,
    proposalsCreated: proposals.length,
  },
  'Turn completed'
);
```

### 5.4: Commit Changes

```bash
git add .
git commit -m "feat(agent): add BaseOrchestrator + specialized orchestrators + guardrail tests

Phase 3-5 of Agent Ecosystem implementation:
- BaseOrchestrator abstract class with Template Method pattern
- OnboardingOrchestrator, CustomerChatOrchestrator, AdminOrchestrator
- 54 new unit tests for guardrails (rate limiter, circuit breaker, budget tracker)
- Prometheus metrics for agent observability (prom-client)
- Enhanced structured logging for debugging
- Fixed 5 P1 and 15 P2 code review findings

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Key Files Reference

```
# New orchestrator implementations
server/src/agent/orchestrator/base-orchestrator.ts
server/src/agent/orchestrator/onboarding-orchestrator.ts
server/src/agent/orchestrator/customer-chat-orchestrator.ts
server/src/agent/orchestrator/admin-orchestrator.ts
server/src/agent/orchestrator/index.ts

# Guardrail implementations (from Phases 1-2)
server/src/agent/orchestrator/types.ts
server/src/agent/orchestrator/rate-limiter.ts
server/src/agent/orchestrator/circuit-breaker.ts

# New tests
server/test/agent/orchestrator/rate-limiter.test.ts
server/test/agent/orchestrator/circuit-breaker.test.ts
server/test/agent/orchestrator/budget-tracker.test.ts

# Code review todos
todos/522-pending-p1-branded-types-unused.md
todos/523-pending-p1-double-type-assertion.md
todos/524-pending-p1-legacy-orchestrators-in-production.md
todos/525-pending-p1-rate-limiter-state-not-persisted.md
todos/526-pending-p1-massive-code-duplication.md
todos/527-541-pending-p2-*.md  # 15 P2 findings

# Architecture plan
plans/agent-ecosystem-architecture.md
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BaseOrchestrator (abstract)                   │
├─────────────────────────────────────────────────────────────────┤
│  - Session management                                            │
│  - Tool rate limiting (per-tier budgets)                        │
│  - Proposal lifecycle                                            │
│  - Circuit breakers                                              │
│  - Audit logging                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ OnboardingOrch│   │CustomerChatOrc│   │ AdminOrch     │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ - 10-min T2   │   │ - 2-min T2    │   │ - 5-min T2    │
│ - Onboarding  │   │ - Customer    │   │ - Admin tools │
│   tools       │   │   tools       │   │ - Onboarding  │
│ - Phase mgmt  │   │ - Prompt      │   │   awareness   │
│ - Memory svc  │   │   injection   │   │               │
│               │   │   detection   │   │               │
└───────────────┘   └───────────────┘   └───────────────┘

✅  Routes now use new orchestrators with guardrails!
    #524 and #526 resolved (2026-01-01).
```

---

## Your Task

```bash
# 1. Fix P1 findings first
/triage                      # Prioritize todos
/resolve_todo_parallel       # Fix in parallel

# 2. Verify fixes
npm run typecheck
npm test -- test/agent

# 3. Then continue with Phase 5
npm install --workspace=server prom-client

# 4. Create agent metrics module
# server/src/agent/orchestrator/metrics.ts

# 5. Update /metrics endpoint for Prometheus format

# 6. Add structured logging to BaseOrchestrator

# 7. Final verification
npm run typecheck
npm test -- test/agent

# 8. Commit
```

---

**Start with: `/triage` to prioritize and then `/resolve_todo_parallel` to fix findings**
