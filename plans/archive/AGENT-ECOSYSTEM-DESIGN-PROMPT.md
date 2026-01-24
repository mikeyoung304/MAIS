# Enterprise AI Agent Ecosystem Design Prompt

**Copy this entire file and paste it into a new Claude Code session.**

---

## Context: MAIS Platform

MAIS (gethandled.ai) is a multi-tenant membership platform for service professionals (photographers, coaches, therapists). We're building an enterprise-grade AI agent ecosystem with multiple agent types.

### Current Stack

- Backend: Express 4, TypeScript 5.9.3, Prisma 6, PostgreSQL
- Frontend: React 18 (admin), Next.js 14 (storefronts)
- AI: Claude API via Anthropic SDK
- Architecture: Multi-tenant modular monolith

### Key Files to Read First

```
# Core agent architecture
server/src/agent/orchestrator/orchestrator.ts    # Main orchestrator
server/src/agent/proposals/proposal.service.ts   # Trust tier proposal system
server/src/agent/proposals/executor-registry.ts  # Tool executors
server/prisma/schema.prisma                      # AgentProposal, AgentSession models

# Onboarding agent
server/src/agent/prompts/onboarding-system-prompt.ts
server/src/agent/tools/onboarding-tools.ts
server/src/agent/executors/onboarding-executors.ts

# Customer chatbot
server/src/agent/customer/customer-orchestrator.ts
server/src/agent/customer/customer-tools.ts

# Documentation
docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md
docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md
CLAUDE.md  # Project conventions
```

---

## Current Trust Tier Architecture

We have a three-tier trust system for AI actions:

| Tier   | Behavior                                                        | Use Cases                           |
| ------ | --------------------------------------------------------------- | ----------------------------------- |
| **T1** | Auto-confirm, executes immediately                              | Read data, update progress metadata |
| **T2** | Soft-confirm (user continues = approve, "wait"/"stop" = reject) | Create packages, update storefront  |
| **T3** | Hard-confirm (explicit UI button click required)                | Book appointments, charge money     |

### Proposal State Machine

```
Tool creates proposal → PENDING → (soft/hard confirm) → CONFIRMED → Executor → EXECUTED
                                         ↓                            ↓
                                     REJECTED                      FAILED
```

---

## Known Bugs (Must Fix)

### Bug 1: Session ID Mismatch (Critical)

**Location:** `server/src/agent/orchestrator/orchestrator.ts` (line 521)

```typescript
// Current (BUG):
let session = await this.getSession(tenantId, sessionId);
if (!session) {
  session = await this.getOrCreateSession(tenantId);  // Creates NEW session
}
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId,   // ← Uses ORIGINAL sessionId, not session.sessionId
  userMessage
);

// Fix:
  session.sessionId,  // Use actual session ID
```

**Impact:** If session expires, proposals created with new session ID but soft-confirm queries old session ID. Proposals never found, never executed.

### Bug 2: 2-Minute Window Too Short

**Location:** `server/src/agent/proposals/proposal.service.ts` (line 53)

```typescript
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000; // Too short for thoughtful onboarding
```

**Impact:** Users reading AI suggestions for 3+ minutes miss the soft-confirm window. Proposals stay PENDING forever.

### Bug 3: T1 Tools Starve T2 Tools

**Issue:** `update_onboarding_state` (T1) called 4 times in one turn, consuming 4 of 5 recursion depth slots. No room for `upsert_services` (T2).

**Root Cause:** No per-tool rate limiting. Claude doesn't reliably follow prompt instructions to "only call once."

---

## Agent Ecosystem Requirements

### Agent Types Needed

| Agent                  | Purpose                            | Session Duration         | Stakes                             |
| ---------------------- | ---------------------------------- | ------------------------ | ---------------------------------- |
| **Onboarding Advisor** | Guide new tenants through setup    | 10-30 min, may span days | High (creates business config)     |
| **Customer Chatbot**   | Help end-customers browse & book   | 2-10 min                 | High (creates bookings, handles $) |
| **Admin Assistant**    | Help tenants manage their business | Variable                 | Medium (modifies existing data)    |
| **Future Agents**      | TBD (marketing, support, etc.)     | TBD                      | TBD                                |

### Interaction Patterns

- **Mixed timing:** Quick for bookings (seconds), thoughtful for onboarding (minutes)
- **Session resumption:** Users may return hours/days later
- **Multi-step workflows:** Onboarding spans multiple phases
- **High stakes:** Agents handle money, schedules, customer-facing content

### Error Tolerance

- **Balanced approach:** Automate where safe, checkpoint for important actions
- **Undo capability:** Users should be able to reverse agent actions
- **Graceful degradation:** Agents should fail safely, not silently

---

## 2025 Best Practices to Incorporate

### From Industry Research

1. **"Budgeting the Loop"** (DoorDash pattern) - Strict step/time limits per agent turn
2. **Circuit Breakers** (Cox Automotive) - Auto-stop at P95 cost or 20 turns
3. **Code-Level Guardrails** (Datadog) - Don't rely on prompts for rate limiting
4. **Multi-Tier Oversight** (Microsoft Agent Framework) - Strategic planning reviewed before execution
5. **Graduated Autonomy** (Ramp) - Auto-approve low-risk, require confirmation for high-risk

### Recommended Architecture Pattern (from LangGraph/AutoGen)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                            │
├─────────────────────────────────────────────────────────────────┤
│  1. FAST GUARDRAILS (code-level, microseconds)                   │
│     - Session validation                                         │
│     - Tool rate limits (per-tool, per-turn)                      │
│     - Recursion budget (separate T1/T2/T3 budgets?)              │
├─────────────────────────────────────────────────────────────────┤
│  2. TRUST TIER EVALUATION                                        │
│     - T1: Execute immediately                                    │
│     - T2: Soft-confirm with context-appropriate window           │
│     - T3: Hard-confirm with explicit UI                          │
├─────────────────────────────────────────────────────────────────┤
│  3. PROPOSAL LIFECYCLE                                           │
│     PENDING → CONFIRMED → EXECUTED (with rollback capability)    │
├─────────────────────────────────────────────────────────────────┤
│  4. CIRCUIT BREAKERS                                             │
│     - Time limit per session                                     │
│     - Cost limit per conversation                                │
│     - Turn limit per interaction                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Your Task

Design and implement an enterprise-grade AI agent ecosystem for MAIS. This is a quality-first, long-term stability approach. We don't care about time or work in the short term.

### Deliverables

1. **Architecture Design**
   - Unified orchestrator that handles all agent types
   - Proper session management (fix the bugs)
   - Context-aware soft-confirm windows (quick vs thoughtful)
   - Code-level guardrails (not prompt-based)

2. **Trust Tier Enhancements**
   - Per-tool rate limiting
   - Separate recursion budgets for T1/T2/T3
   - Circuit breakers for runaway agents

3. **Proposal System Improvements**
   - Fix session ID mismatch bug
   - Context-aware confirmation windows
   - Rollback/undo capability for executed proposals

4. **Testing Strategy**
   - Unit tests for all guardrails
   - Integration tests for proposal lifecycle
   - E2E tests for each agent type

5. **Documentation**
   - Architecture decision records (ADRs)
   - Runbook for common agent issues
   - Prevention strategies for future developers

### Approach

1. First, read the key files listed above to understand the current implementation
2. Create a detailed plan in `plans/agent-ecosystem-architecture.md`
3. Get my approval before implementing
4. Implement in phases with tests at each phase
5. Document decisions in `docs/adrs/`

### Quality Standards

- TypeScript strict mode, no `any` without justification
- All queries scoped by `tenantId` (multi-tenant security)
- Structured logging via `logger` (never `console.log`)
- Tests before commit
- Follow existing patterns in codebase

---

## Questions to Consider

1. Should we have one unified orchestrator or separate orchestrators per agent type?
2. Should soft-confirm windows be per-agent-type or per-tool?
3. How should we handle proposals that span session boundaries (user returns next day)?
4. Should T1 tools count against recursion depth at all?
5. What's the right balance between automation and confirmation for high-stakes actions?

---

**Start by reading the key files, then create your architecture plan. Don't implement anything until I approve the plan.**
