# Enterprise AI Agent Ecosystem - Work Execution Prompt

**Copy this entire file and paste it into a new Claude Code session to begin implementation.**

---

## Context

You are implementing an enterprise-grade AI agent ecosystem for MAIS. The plan has been reviewed by 3 reviewers (DHH, Kieran, Simplicity) and the user chose to proceed with the full 32-day plan.

### Key Files

```
# The approved plan (READ THIS FIRST)
plans/agent-ecosystem-architecture.md

# Current implementation to modify
server/src/agent/orchestrator/orchestrator.ts       # Main bug location (line 521)
server/src/agent/proposals/proposal.service.ts      # 2-min window (line 53)
server/src/agent/proposals/executor-registry.ts     # Tool executors

# Related documentation
docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md
docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md
CLAUDE.md                                           # Project conventions
```

---

## Critical Bugs to Fix (Phase 1)

### Bug 1: Session ID Mismatch (Priority: P0)

**Location:** `server/src/agent/orchestrator/orchestrator.ts` line 521

```typescript
// CURRENT (BUG):
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId, // ← Uses ORIGINAL sessionId, not session.sessionId!
  userMessage
);

// FIX:
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  session.sessionId, // Use actual session ID
  userMessage,
  this.agentType // Pass agent type for window selection
);
```

### Bug 2: 2-Minute Soft-Confirm Window Too Short

**Location:** `server/src/agent/proposals/proposal.service.ts` line 53

```typescript
// CURRENT:
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

// FIX: Add agent-type aware windows
const SOFT_CONFIRM_WINDOWS = {
  onboarding: 10 * 60 * 1000, // 10 minutes
  customer: 2 * 60 * 1000, // 2 minutes
  admin: 5 * 60 * 1000, // 5 minutes
} as const;

// Update softConfirmPendingT2 to accept agentType parameter
```

### Bug 3: T1 Tools Starve T2 Tools

**Solution:** Implement per-tier recursion budgets

```typescript
interface TierBudgets {
  T1: number; // 10 - metadata tools
  T2: number; // 3 - write tools
  T3: number; // 1 - booking/money tools
}
```

---

## Implementation Phases

### Phase 1: Critical Bug Fixes (Days 1-7)

1. **Day 1:** Fix session ID mismatch + add branded types
2. **Days 2-3:** Context-aware soft-confirm windows
3. **Days 4-6:** Per-tier recursion budgets
4. **Day 7:** Diagnostic logging

### Phase 2: Guardrails & Rate Limiting (Days 8-15)

1. Per-tool rate limiting (ToolRateLimiter class)
2. Circuit breakers (CircuitBreaker class)
3. Integrate guardrails into orchestrator

### Phase 3: Unified Orchestrator (Days 16-22)

1. Extract BaseOrchestrator abstract class
2. Create OnboardingOrchestrator, CustomerOrchestrator, AdminOrchestrator

### Phase 4: Testing & Documentation (Days 23-29)

1. Unit tests for guardrails
2. Integration tests for proposal lifecycle
3. ADR-018 documentation

### Phase 5: Monitoring (Days 30-32)

1. Prometheus metrics
2. Structured logging enhancements

---

## Reviewer Feedback Incorporated

| Reviewer            | Verdict              | Action Taken                                                     |
| ------------------- | -------------------- | ---------------------------------------------------------------- |
| Kieran (TypeScript) | APPROVE WITH CHANGES | Added branded types, readonly modifiers, AgentType extraction    |
| DHH                 | NEEDS WORK           | Acknowledged - proceeding with full plan for long-term stability |
| Simplicity          | NEEDS WORK           | Acknowledged - enterprise guardrails are intentional             |

---

## Your Task

Execute `/workflows:work plans/agent-ecosystem-architecture.md`

This will:

1. Read the full architecture plan
2. Break it into trackable todos
3. Implement Phase 1 first (critical bug fixes)
4. Run tests after each phase
5. Create commits with proper messages

---

## Quality Standards

- TypeScript strict mode, no `any` without justification
- All queries scoped by `tenantId` (multi-tenant security)
- Structured logging via `logger` (never `console.log`)
- Tests before commit
- Follow existing patterns in codebase

---

## Quick Start

```bash
# In the new Claude Code window, run:
/workflows:work plans/agent-ecosystem-architecture.md

# Or if you prefer to start manually:
1. Read plans/agent-ecosystem-architecture.md
2. Create todos for Phase 1
3. Start with Task 1.1 (session ID fix)
```

---

**Start by running `/workflows:work plans/agent-ecosystem-architecture.md`**
