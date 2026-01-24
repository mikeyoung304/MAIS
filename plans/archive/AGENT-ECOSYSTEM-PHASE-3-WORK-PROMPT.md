# Agent Ecosystem Phase 3-5 Work Prompt

**Copy this entire file and paste it into a new Claude Code session.**

---

## Context

You are continuing implementation of the Enterprise AI Agent Ecosystem for MAIS. Phases 1-2 are **complete and committed** (`cb55639`).

### Completed (Phases 1-2)

| Phase | Task                                   | Status  |
| ----- | -------------------------------------- | ------- |
| 1.1   | Fix session ID mismatch bug            | ✅ Done |
| 1.2   | Context-aware soft-confirm windows     | ✅ Done |
| 1.3   | Per-tier recursion budgets             | ✅ Done |
| 1.4   | Diagnostic logging                     | ✅ Done |
| 2.1   | ToolRateLimiter class                  | ✅ Done |
| 2.2   | CircuitBreaker class                   | ✅ Done |
| 2.3   | Integrate guardrails into orchestrator | ✅ Done |

### Remaining (Phases 3-5)

| Phase | Task                        | Description                                                                         |
| ----- | --------------------------- | ----------------------------------------------------------------------------------- |
| **3** | BaseOrchestrator extraction | Create abstract base class and specialized subclasses (Onboarding, Customer, Admin) |
| **4** | Unit tests for guardrails   | Test ToolRateLimiter, CircuitBreaker, BudgetTracker                                 |
| **5** | Metrics and logging         | Add Prometheus metrics and structured logging enhancements                          |

---

## Key Files

```
# Completed guardrail implementations
server/src/agent/orchestrator/orchestrator.ts    # Main orchestrator (modified)
server/src/agent/orchestrator/types.ts           # Branded types, BudgetTracker
server/src/agent/orchestrator/rate-limiter.ts    # ToolRateLimiter class
server/src/agent/orchestrator/circuit-breaker.ts # CircuitBreaker class
server/src/agent/proposals/proposal.service.ts   # AgentType, context-aware windows

# Architecture plan
plans/agent-ecosystem-architecture.md            # Full 32-day plan

# Project conventions
CLAUDE.md
```

---

## Phase 3: BaseOrchestrator Extraction

### Goal

Extract common orchestrator logic into an abstract base class. Create specialized subclasses for each agent type with type-safe configurations.

### Implementation Steps

1. **Create `BaseOrchestrator` abstract class**
   - Move shared logic (session management, proposal handling, circuit breaker)
   - Define abstract methods: `buildSystemPrompt()`, `getTools()`
   - Accept `AgentType` in constructor

2. **Create `OnboardingOrchestrator` extends BaseOrchestrator**
   - Uses onboarding tools and system prompt
   - AgentType: 'onboarding'
   - Longer soft-confirm window (10 min)

3. **Create `CustomerOrchestrator` extends BaseOrchestrator**
   - Uses customer chatbot tools
   - AgentType: 'customer'
   - Shorter soft-confirm window (2 min)

4. **Create `AdminOrchestrator` extends BaseOrchestrator**
   - Uses business assistant tools
   - AgentType: 'admin'
   - Medium soft-confirm window (5 min)

5. **Update routes to use specialized orchestrators**

### Code Pattern

```typescript
// server/src/agent/orchestrator/base-orchestrator.ts
export abstract class BaseOrchestrator {
  protected readonly agentType: AgentType;
  protected readonly rateLimiter: ToolRateLimiter;
  protected readonly tierBudgets: TierBudgets;
  protected circuitBreaker: CircuitBreaker | null = null;

  constructor(
    protected readonly prisma: PrismaClient,
    config: BaseOrchestratorConfig
  ) {
    this.agentType = config.agentType;
    this.rateLimiter = new ToolRateLimiter(config.rateLimits);
    this.tierBudgets = config.tierBudgets || DEFAULT_TIER_BUDGETS;
  }

  // Abstract methods for subclasses
  protected abstract buildSystemPrompt(context: AgentSessionContext): string;
  protected abstract getTools(): AgentTool[];

  // Shared methods
  async chat(...) { /* existing logic */ }
  async getOrCreateSession(...) { /* existing logic */ }
}
```

---

## Phase 4: Unit Tests for Guardrails

### Files to Create

```
server/test/agent/orchestrator/rate-limiter.test.ts
server/test/agent/orchestrator/circuit-breaker.test.ts
server/test/agent/orchestrator/budget-tracker.test.ts
```

### Test Cases

**ToolRateLimiter:**

- Should allow calls within per-turn limit
- Should block calls exceeding per-turn limit
- Should allow calls within per-session limit
- Should block calls exceeding per-session limit
- Should reset turn counts correctly
- Should reset all counts on session reset

**CircuitBreaker:**

- Should allow operations when within limits
- Should trip when max turns exceeded
- Should trip when max tokens exceeded
- Should trip when max time exceeded
- Should trip after consecutive errors
- Should reset error count on success

**BudgetTracker:**

- Should consume from correct tier
- Should return false when tier exhausted
- Should track used and remaining correctly
- Should reset to initial values

---

## Phase 5: Metrics and Logging

### Prometheus Metrics

```typescript
// server/src/agent/metrics/agent-metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const agentMetrics = {
  toolCallsTotal: new Counter({
    name: 'agent_tool_calls_total',
    help: 'Total tool calls by tool name and status',
    labelNames: ['tool_name', 'trust_tier', 'status'],
  }),

  rateLimitHits: new Counter({
    name: 'agent_rate_limit_hits_total',
    help: 'Rate limit blocks by tool',
    labelNames: ['tool_name'],
  }),

  circuitBreakerTrips: new Counter({
    name: 'agent_circuit_breaker_trips_total',
    help: 'Circuit breaker trips by reason',
    labelNames: ['reason'],
  }),

  turnDuration: new Histogram({
    name: 'agent_turn_duration_seconds',
    help: 'Duration of agent turns',
    labelNames: ['agent_type'],
    buckets: [0.5, 1, 2, 5, 10, 30],
  }),
};
```

### Enhanced Logging

Add structured log fields for debugging:

- `tierBudgetRemaining` after each tool call
- `rateLimitStats` at turn end
- `circuitBreakerState` at turn end
- `proposalLifecycle` for T2/T3 operations

---

## Quality Standards

- TypeScript strict mode, no `any` without justification
- All queries scoped by `tenantId` (multi-tenant security)
- Structured logging via `logger` (never `console.log`)
- Tests before commit
- Follow existing patterns in codebase

---

## Your Task

```bash
/workflows:work plans/agent-ecosystem-architecture.md

# Or manually:
1. Read plans/agent-ecosystem-architecture.md (Phases 3-5)
2. Create todos for Phase 3
3. Implement BaseOrchestrator extraction
4. Run tests: npx vitest run test/agent
5. Commit after each phase
```

---

**Start with Phase 3: BaseOrchestrator extraction**
