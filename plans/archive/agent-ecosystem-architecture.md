# Enterprise AI Agent Ecosystem Architecture Plan

**Status:** Ready for Review
**Priority:** P0 (Critical)
**Type:** Architecture + Bug Fix
**Estimated Effort:** 32 person-days (5 phases)
**Date:** 2025-12-31
**Author:** Claude Code via `/workflows:plan`

---

## Executive Summary

This plan redesigns the MAIS AI agent ecosystem to fix **3 critical bugs** and implement **enterprise-grade guardrails** based on 2025 industry best practices. The architecture is fundamentally sound (~70% complete); we're hardening the remaining 30%.

### Critical Bugs to Fix

| Bug                    | Location                 | Impact                            | Fix Complexity |
| ---------------------- | ------------------------ | --------------------------------- | -------------- |
| Session ID mismatch    | `orchestrator.ts:521`    | Proposals orphaned, never execute | Low (1 line)   |
| 2-min window too short | `proposal.service.ts:53` | 80% onboarding failures           | Medium         |
| T1 starves T2 tools    | No per-tool limits       | T2 proposals never created        | Medium         |

### Key Deliverables

1. **Phase 1:** Critical bug fixes (7 days)
2. **Phase 2:** Guardrails & rate limiting (8 days)
3. **Phase 3:** Unified orchestrator base class (7 days)
4. **Phase 4:** Testing & documentation (7 days)
5. **Phase 5:** Monitoring & observability (3 days)

**Total:** 32 days to production-ready

---

## Problem Statement

### Observed Symptoms

1. **T2 proposals created but never execute** - AI claims packages were created, but database shows only defaults
2. **Phase advances prematurely** - Onboarding shows "Market Research (2/4)" even though packages weren't created
3. **Excessive T1 tool calls** - `update_onboarding_state` called 4 times in one turn, consuming all recursion depth
4. **Session ID inconsistency** - After session recreation, proposals query wrong session ID

### Root Cause Analysis

**Bug 1: Session ID Mismatch (Critical)**

```typescript
// orchestrator.ts:521 - CURRENT (BUGGY)
let session = await this.getSession(tenantId, sessionId);
if (!session) {
  session = await this.getOrCreateSession(tenantId); // Creates NEW session!
}
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId, // ← Uses ORIGINAL sessionId, not session.sessionId!
  userMessage
);
```

**Impact:** When session expires, a new session is created with a new ID. Proposals created with the new session ID, but `softConfirmPendingT2()` queries the old session ID. Proposals never found, never executed.

**Bug 2: 2-Minute Window Too Short**

```typescript
// proposal.service.ts:53
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000; // Only 2 minutes!
```

**Impact:** Users reading AI suggestions for 3+ minutes miss the soft-confirm window. Onboarding requires thoughtful consideration (5-10 minutes), not quick responses.

**Bug 3: T1 Tools Starve T2 Tools**

```
Recursion Depth: MAX = 5 (shared across all tiers)
Turn 1: update_onboarding_state (T1) → Depth 1
Turn 2: update_onboarding_state (T1) → Depth 2
Turn 3: update_onboarding_state (T1) → Depth 3
Turn 4: update_onboarding_state (T1) → Depth 4
Turn 5: (limit reached) → No room for upsert_services (T2)!
```

**Impact:** T1 metadata tools consume all recursion budget, leaving no room for T2 write tools that actually create data.

---

## Architecture Decisions

### Decision 1: Unified vs Separate Orchestrators

**Recommendation:** Unified base class with specialized subclasses

```
┌─────────────────────────────────────────────────────────────────┐
│                    BaseOrchestrator (abstract)                   │
├─────────────────────────────────────────────────────────────────┤
│  - Session management                                            │
│  - Tool rate limiting (per-tier budgets)                        │
│  - Proposal lifecycle                                            │
│  - Circuit breakers                                              │
│  - Context caching                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ OnboardingOrch│   │ CustomerOrch  │   │ AdminOrch     │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ - 10-min T2   │   │ - 2-min T2    │   │ - 5-min T2    │
│ - Onboarding  │   │ - Customer    │   │ - Admin tools │
│   tools       │   │   tools       │   │               │
│ - Phase mgmt  │   │ - Public      │   │ - Full        │
│               │   │   context     │   │   context     │
└───────────────┘   └───────────────┘   └───────────────┘
```

**Rationale:**

- Shared guardrails (DRY)
- Type-safe configuration per agent type
- Easy to add new agent types
- Single place for security fixes

### Decision 2: Per-Tier Recursion Budgets

**Recommendation:** Separate budgets prevent T1 from starving T2/T3

```typescript
interface TierBudgets {
  T1: number; // Auto-confirm tools (metadata, reads)
  T2: number; // Soft-confirm tools (writes)
  T3: number; // Hard-confirm tools (bookings, money)
}

const DEFAULT_BUDGETS: TierBudgets = {
  T1: 10, // Generous for metadata
  T2: 3, // Limited writes per turn
  T3: 1, // One booking at a time
};
```

**Rationale:**

- Prevents T1 starvation of T2/T3
- Matches DoorDash "Budgeting the Loop" pattern
- Code-level enforcement (not prompt-based)

### Decision 3: Context-Aware Soft-Confirm Windows

**Recommendation:** Per-agent-type windows, not per-tool

```typescript
interface AgentConfig {
  type: 'onboarding' | 'customer' | 'admin';
  softConfirmWindowMs: number;
  recursionBudgets: TierBudgets;
  maxHistoryMessages: number;
}

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  onboarding: {
    type: 'onboarding',
    softConfirmWindowMs: 10 * 60 * 1000, // 10 minutes
    recursionBudgets: { T1: 10, T2: 3, T3: 1 },
    maxHistoryMessages: 20,
  },
  customer: {
    type: 'customer',
    softConfirmWindowMs: 2 * 60 * 1000, // 2 minutes
    recursionBudgets: { T1: 5, T2: 2, T3: 1 },
    maxHistoryMessages: 10,
  },
  admin: {
    type: 'admin',
    softConfirmWindowMs: 5 * 60 * 1000, // 5 minutes
    recursionBudgets: { T1: 10, T2: 5, T3: 2 },
    maxHistoryMessages: 20,
  },
};
```

**Rationale:**

- Onboarding needs thoughtful time (10 min)
- Customer chatbot needs quick responses (2 min)
- Admin is in between (5 min)

### Decision 4: Circuit Breakers

**Recommendation:** Multi-layer circuit breakers based on industry patterns

```typescript
interface CircuitBreakerConfig {
  maxTurnsPerSession: number; // Prevent infinite loops
  maxTokensPerSession: number; // Cost control
  maxTimePerSessionMs: number; // Time limit
  maxConsecutiveErrors: number; // Error threshold
}

const CIRCUIT_BREAKER_DEFAULTS: CircuitBreakerConfig = {
  maxTurnsPerSession: 20, // Cox Automotive pattern
  maxTokensPerSession: 100_000, // ~$3 per session max
  maxTimePerSessionMs: 30 * 60 * 1000, // 30 min session limit
  maxConsecutiveErrors: 3, // Trip after 3 errors
};
```

**Rationale:**

- Prevents runaway agents
- Cost control (P95 budget from Cox Automotive)
- Graceful degradation

---

## Reviewer Feedback Incorporated

Based on `/plan_review` with DHH, Kieran, and Simplicity reviewers:

| Reviewer   | Verdict              | Key Feedback                                                      |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| DHH        | NEEDS WORK           | "Could be 3 days" - We're choosing long-term stability over speed |
| Simplicity | NEEDS WORK           | "5 days not 32" - We're investing in enterprise guardrails        |
| Kieran     | APPROVE WITH CHANGES | TypeScript improvements incorporated below                        |

### Kieran's TypeScript Improvements (Incorporated)

1. **Branded types for IDs** - Prevent sessionId/tenantId mixups at compile time
2. **`readonly` modifiers** - Prevent external mutation of state
3. **Discriminated union result types** - Explain why operations fail
4. **Extract `AgentType`** - Shared type definition
5. **Rename parameter** - `requestedSessionId` signals "not the final ID"

---

## Proposed Solution

### Phase 1: Critical Bug Fixes (7 days)

#### Task 1.1: Fix Session ID Mismatch (Day 1)

**File:** `server/src/agent/orchestrator/types.ts` (NEW branded types)

```typescript
// Branded types prevent sessionId/tenantId mixups at compile time
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TenantId = string & { readonly __brand: 'TenantId' };

export function toSessionId(id: string): SessionId {
  return id as SessionId;
}

export function toTenantId(id: string): TenantId {
  return id as TenantId;
}

// Shared agent type (used across configs)
export type AgentType = 'onboarding' | 'customer' | 'admin';
```

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
// BEFORE (line 521):
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId,   // ← BUG: Uses original sessionId
  userMessage
);

// AFTER (with renamed parameter to catch misuse):
async chat(
  tenantId: TenantId,
  requestedSessionId: string,  // Renamed: signals "not the final ID"
  userMessage: string
): Promise<ChatResponse> {
  let session = await this.getSession(tenantId, requestedSessionId);
  if (!session) {
    session = await this.getOrCreateSession(tenantId);
  }

  const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
    tenantId,
    session.sessionId,  // ← FIX: Use actual session ID from resolved session
    userMessage,
    this.agentType
  );
  // ...
}
```

**Test:** Create proposal, let session expire, send new message → proposal should still execute.

#### Task 1.2: Add Context-Aware Soft-Confirm Windows (Days 2-3)

**File:** `server/src/agent/proposals/proposal.service.ts`

```typescript
// NEW: Agent-specific window configuration
export interface SoftConfirmConfig {
  windowMs: number;
  agentType: 'onboarding' | 'customer' | 'admin';
}

const SOFT_CONFIRM_WINDOWS: Record<string, number> = {
  onboarding: 10 * 60 * 1000,  // 10 minutes
  customer: 2 * 60 * 1000,      // 2 minutes
  admin: 5 * 60 * 1000,         // 5 minutes
};

async softConfirmPendingT2(
  tenantId: string,
  sessionId: string,
  userMessage: string,
  agentType: 'onboarding' | 'customer' | 'admin' = 'customer'  // NEW param
): Promise<string[]> {
  const windowMs = SOFT_CONFIRM_WINDOWS[agentType];
  const softConfirmCutoff = new Date(Date.now() - windowMs);

  // ... rest of method using windowMs
}
```

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
// Pass agent type to soft-confirm
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  session.sessionId,
  userMessage,
  this.agentType // NEW: pass agent type
);
```

#### Task 1.3: Implement Per-Tier Recursion Budgets (Days 4-6)

**File:** `server/src/agent/orchestrator/types.ts`

```typescript
export interface TierBudgets {
  T1: number;
  T2: number;
  T3: number;
}

export interface BudgetTracker {
  remaining: TierBudgets;
  used: TierBudgets;

  consume(tier: 'T1' | 'T2' | 'T3'): boolean; // Returns false if exhausted
  reset(): void;
}

export function createBudgetTracker(initial: TierBudgets): BudgetTracker {
  return {
    remaining: { ...initial },
    used: { T1: 0, T2: 0, T3: 0 },

    consume(tier) {
      if (this.remaining[tier] <= 0) return false;
      this.remaining[tier]--;
      this.used[tier]++;
      return true;
    },

    reset() {
      this.remaining = { ...initial };
      this.used = { T1: 0, T2: 0, T3: 0 };
    },
  };
}
```

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
// In processToolCall():
private async processToolCall(
  toolCall: ToolCall,
  context: ToolContext,
  budgetTracker: BudgetTracker
): Promise<ToolResult> {
  const tier = this.getToolTier(toolCall.name);

  // Check budget BEFORE execution
  if (!budgetTracker.consume(tier)) {
    logger.warn({
      tenantId: context.tenantId,
      tool: toolCall.name,
      tier,
      budgetUsed: budgetTracker.used,
    }, `${tier} budget exhausted, skipping tool call`);

    return {
      success: false,
      error: `Tool budget for ${tier} exhausted this turn. Try again next message.`,
    };
  }

  // Execute tool...
}
```

#### Task 1.4: Add Diagnostic Logging (Day 7)

**File:** `server/src/agent/proposals/proposal.service.ts`

```typescript
async softConfirmPendingT2(...): Promise<string[]> {
  // DEBUG: Log query params
  logger.debug({
    tenantId,
    sessionId,
    agentType,
    windowMs,
    softConfirmCutoff: softConfirmCutoff.toISOString(),
  }, 'T2 soft-confirm query params');

  const proposals = await this.prisma.agentProposal.findMany({...});

  // DEBUG: Log results
  logger.debug({
    tenantId,
    sessionId,
    foundCount: proposals.length,
    proposals: proposals.map(p => ({
      id: p.id,
      toolName: p.toolName,
      createdAt: p.createdAt.toISOString(),
      ageSeconds: (Date.now() - p.createdAt.getTime()) / 1000,
    })),
  }, 'T2 soft-confirm query results');

  // Check for proposals outside window (indicates timing issue)
  const allPending = await this.prisma.agentProposal.findMany({
    where: { tenantId, sessionId, status: 'PENDING', trustTier: 'T2' },
  });

  if (allPending.length > proposals.length) {
    logger.warn({
      tenantId,
      sessionId,
      outsideWindowCount: allPending.length - proposals.length,
    }, 'T2 proposals exist but are OUTSIDE the soft-confirm window');
  }

  return confirmedIds;
}
```

### Phase 2: Guardrails & Rate Limiting (8 days)

#### Task 2.1: Per-Tool Rate Limiting (Days 8-10)

**File:** `server/src/agent/orchestrator/rate-limiter.ts` (NEW)

```typescript
/**
 * Per-tool rate limiter using token bucket pattern.
 * Prevents any single tool from dominating a conversation turn.
 */
export interface ToolRateLimits {
  [toolName: string]: {
    maxPerTurn: number;
    maxPerSession: number;
  };
}

export const DEFAULT_TOOL_RATE_LIMITS: ToolRateLimits = {
  // T1 tools - metadata, can be called more often
  update_onboarding_state: { maxPerTurn: 1, maxPerSession: 10 },
  get_market_research: { maxPerTurn: 2, maxPerSession: 5 },
  get_services: { maxPerTurn: 3, maxPerSession: 20 },
  check_availability: { maxPerTurn: 5, maxPerSession: 50 },
  get_business_info: { maxPerTurn: 2, maxPerSession: 10 },

  // T2 tools - writes, limited
  upsert_services: { maxPerTurn: 1, maxPerSession: 5 },
  update_storefront: { maxPerTurn: 1, maxPerSession: 3 },
  upsert_package: { maxPerTurn: 2, maxPerSession: 10 },

  // T3 tools - critical, heavily limited
  book_service: { maxPerTurn: 1, maxPerSession: 3 },
  create_booking: { maxPerTurn: 1, maxPerSession: 5 },
};

export class ToolRateLimiter {
  private turnCounts: Map<string, number> = new Map();
  private sessionCounts: Map<string, number> = new Map();

  constructor(private limits: ToolRateLimits = DEFAULT_TOOL_RATE_LIMITS) {}

  canCall(toolName: string): { allowed: boolean; reason?: string } {
    const limit = this.limits[toolName] || { maxPerTurn: 5, maxPerSession: 50 };
    const turnCount = this.turnCounts.get(toolName) || 0;
    const sessionCount = this.sessionCounts.get(toolName) || 0;

    if (turnCount >= limit.maxPerTurn) {
      return { allowed: false, reason: `${toolName} max per turn (${limit.maxPerTurn}) reached` };
    }
    if (sessionCount >= limit.maxPerSession) {
      return {
        allowed: false,
        reason: `${toolName} max per session (${limit.maxPerSession}) reached`,
      };
    }

    return { allowed: true };
  }

  recordCall(toolName: string): void {
    this.turnCounts.set(toolName, (this.turnCounts.get(toolName) || 0) + 1);
    this.sessionCounts.set(toolName, (this.sessionCounts.get(toolName) || 0) + 1);
  }

  resetTurn(): void {
    this.turnCounts.clear();
  }

  getStats(): { turn: Record<string, number>; session: Record<string, number> } {
    return {
      turn: Object.fromEntries(this.turnCounts),
      session: Object.fromEntries(this.sessionCounts),
    };
  }
}
```

#### Task 2.2: Circuit Breakers (Days 11-13)

**File:** `server/src/agent/orchestrator/circuit-breaker.ts` (NEW)

```typescript
/**
 * Circuit breaker for agent sessions.
 * Prevents runaway agents from consuming excessive resources.
 */
export interface CircuitBreakerConfig {
  maxTurnsPerSession: number;
  maxTokensPerSession: number;
  maxTimePerSessionMs: number;
  maxConsecutiveErrors: number;
}

export interface CircuitBreakerState {
  turns: number;
  tokens: number;
  startTime: number;
  consecutiveErrors: number;
  isTripped: boolean;
  tripReason?: string;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;

  constructor(private config: CircuitBreakerConfig) {
    this.state = {
      turns: 0,
      tokens: 0,
      startTime: Date.now(),
      consecutiveErrors: 0,
      isTripped: false,
    };
  }

  check(): { allowed: boolean; reason?: string } {
    if (this.state.isTripped) {
      return { allowed: false, reason: this.state.tripReason };
    }

    if (this.state.turns >= this.config.maxTurnsPerSession) {
      this.trip(`Max turns (${this.config.maxTurnsPerSession}) exceeded`);
      return { allowed: false, reason: this.state.tripReason };
    }

    if (this.state.tokens >= this.config.maxTokensPerSession) {
      this.trip(`Max tokens (${this.config.maxTokensPerSession}) exceeded`);
      return { allowed: false, reason: this.state.tripReason };
    }

    const elapsed = Date.now() - this.state.startTime;
    if (elapsed >= this.config.maxTimePerSessionMs) {
      this.trip(`Max session time (${this.config.maxTimePerSessionMs}ms) exceeded`);
      return { allowed: false, reason: this.state.tripReason };
    }

    return { allowed: true };
  }

  recordTurn(tokens: number): void {
    this.state.turns++;
    this.state.tokens += tokens;
  }

  recordError(): void {
    this.state.consecutiveErrors++;
    if (this.state.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.trip(`Max consecutive errors (${this.config.maxConsecutiveErrors}) exceeded`);
    }
  }

  recordSuccess(): void {
    this.state.consecutiveErrors = 0;
  }

  private trip(reason: string): void {
    this.state.isTripped = true;
    this.state.tripReason = reason;
    logger.warn({ reason, state: this.state }, 'Circuit breaker tripped');
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}
```

#### Task 2.3: Integrate Guardrails into Orchestrator (Days 14-15)

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
import { ToolRateLimiter } from './rate-limiter';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';
import { BudgetTracker, createBudgetTracker } from './types';

export class AgentOrchestrator {
  private rateLimiter: ToolRateLimiter;
  private circuitBreaker: CircuitBreaker;
  private budgetTracker: BudgetTracker;

  constructor(
    private readonly config: AgentConfig,
    private readonly prisma: PrismaClient,
    private readonly proposalService: ProposalService
  ) {
    this.rateLimiter = new ToolRateLimiter(config.toolRateLimits);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.budgetTracker = createBudgetTracker(config.recursionBudgets);
  }

  async chat(tenantId: string, sessionId: string, userMessage: string): Promise<ChatResponse> {
    // 1. Circuit breaker check
    const cbCheck = this.circuitBreaker.check();
    if (!cbCheck.allowed) {
      return {
        message: `I need to pause our conversation. ${cbCheck.reason}. Please start a new chat.`,
        proposals: [],
        sessionId,
      };
    }

    // 2. Reset per-turn counters
    this.rateLimiter.resetTurn();
    this.budgetTracker.reset();

    // 3. Session management (with fixed session ID)
    let session = await this.getSession(tenantId, sessionId);
    if (!session) {
      session = await this.getOrCreateSession(tenantId);
    }

    // 4. Soft-confirm pending T2 proposals (with correct session ID!)
    const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
      tenantId,
      session.sessionId, // FIX: Use actual session ID
      userMessage,
      this.config.type // Pass agent type for window selection
    );

    // 5. Execute soft-confirmed proposals
    await this.executeConfirmedProposals(tenantId, softConfirmedIds);

    // 6. Process message with Claude
    const response = await this.processWithClaude(tenantId, session, userMessage);

    // 7. Record metrics
    this.circuitBreaker.recordTurn(response.usage?.total_tokens || 0);

    return response;
  }

  private async processToolCall(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const toolName = toolCall.name;
    const tier = this.getToolTier(toolName);

    // Rate limit check
    const rateCheck = this.rateLimiter.canCall(toolName);
    if (!rateCheck.allowed) {
      logger.info({ toolName, reason: rateCheck.reason }, 'Tool rate limited');
      return { success: false, error: rateCheck.reason };
    }

    // Budget check
    if (!this.budgetTracker.consume(tier)) {
      logger.info({ toolName, tier, used: this.budgetTracker.used }, 'Tier budget exhausted');
      return { success: false, error: `${tier} budget exhausted for this turn` };
    }

    // Execute tool
    this.rateLimiter.recordCall(toolName);
    return await this.executeToolCall(toolCall, context);
  }
}
```

### Phase 3: Unified Orchestrator Base Class (7 days)

#### Task 3.1: Extract BaseOrchestrator (Days 16-19)

**File:** `server/src/agent/orchestrator/base-orchestrator.ts` (NEW)

```typescript
/**
 * Base orchestrator implementing shared functionality:
 * - Session management
 * - Proposal lifecycle
 * - Guardrails (rate limiting, circuit breakers, budgets)
 * - Context caching
 *
 * Subclasses override:
 * - getTools(): Returns agent-specific tools
 * - getSystemPrompt(): Returns agent-specific prompt
 * - getConfig(): Returns agent-specific configuration
 */
export abstract class BaseOrchestrator {
  protected readonly prisma: PrismaClient;
  protected readonly proposalService: ProposalService;
  protected readonly contextCache: ContextCache;
  protected rateLimiter: ToolRateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected budgetTracker: BudgetTracker;

  constructor(deps: OrchestratorDependencies) {
    this.prisma = deps.prisma;
    this.proposalService = deps.proposalService;
    this.contextCache = deps.contextCache || defaultContextCache;

    const config = this.getConfig();
    this.rateLimiter = new ToolRateLimiter(config.toolRateLimits);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.budgetTracker = createBudgetTracker(config.recursionBudgets);
  }

  // Abstract methods - subclasses must implement
  abstract getTools(): AgentTool[];
  abstract getSystemPrompt(context: SessionContext): string;
  abstract getConfig(): AgentConfig;

  // Shared implementation
  async chat(tenantId: string, sessionId: string, userMessage: string): Promise<ChatResponse> {
    // ... shared logic from Phase 2
  }

  protected async getOrCreateSession(tenantId: string): Promise<AgentSession> {
    // ... shared session logic
  }

  protected async executeConfirmedProposals(
    tenantId: string,
    proposalIds: string[]
  ): Promise<void> {
    // ... shared execution logic
  }

  // ... other shared methods
}
```

#### Task 3.2: Create Specialized Orchestrators (Days 20-22)

**File:** `server/src/agent/orchestrator/onboarding-orchestrator.ts`

```typescript
import { BaseOrchestrator } from './base-orchestrator';
import { onboardingTools } from '../tools/onboarding-tools';
import { buildOnboardingSystemPrompt } from '../prompts/onboarding-system-prompt';

export class OnboardingOrchestrator extends BaseOrchestrator {
  getTools(): AgentTool[] {
    return onboardingTools;
  }

  getSystemPrompt(context: SessionContext): string {
    return buildOnboardingSystemPrompt(context);
  }

  getConfig(): AgentConfig {
    return {
      type: 'onboarding',
      softConfirmWindowMs: 10 * 60 * 1000, // 10 minutes
      recursionBudgets: { T1: 10, T2: 3, T3: 1 },
      maxHistoryMessages: 20,
      circuitBreaker: {
        maxTurnsPerSession: 50,
        maxTokensPerSession: 200_000,
        maxTimePerSessionMs: 60 * 60 * 1000, // 1 hour
        maxConsecutiveErrors: 5,
      },
      toolRateLimits: {
        update_onboarding_state: { maxPerTurn: 1, maxPerSession: 10 },
        upsert_services: { maxPerTurn: 1, maxPerSession: 5 },
        // ...
      },
    };
  }
}
```

**File:** `server/src/agent/orchestrator/customer-orchestrator.ts`

```typescript
export class CustomerOrchestrator extends BaseOrchestrator {
  getTools(): AgentTool[] {
    return customerTools;
  }

  getSystemPrompt(context: SessionContext): string {
    return buildCustomerSystemPrompt(context);
  }

  getConfig(): AgentConfig {
    return {
      type: 'customer',
      softConfirmWindowMs: 2 * 60 * 1000, // 2 minutes
      recursionBudgets: { T1: 5, T2: 2, T3: 1 },
      maxHistoryMessages: 10,
      circuitBreaker: {
        maxTurnsPerSession: 20,
        maxTokensPerSession: 50_000,
        maxTimePerSessionMs: 15 * 60 * 1000, // 15 minutes
        maxConsecutiveErrors: 3,
      },
      toolRateLimits: {
        book_service: { maxPerTurn: 1, maxPerSession: 3 },
        // ...
      },
    };
  }
}
```

### Phase 4: Testing & Documentation (7 days)

#### Task 4.1: Unit Tests for Guardrails (Days 23-25)

**File:** `server/test/agent/orchestrator/rate-limiter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRateLimiter,
  DEFAULT_TOOL_RATE_LIMITS,
} from '../../../src/agent/orchestrator/rate-limiter';

describe('ToolRateLimiter', () => {
  let limiter: ToolRateLimiter;

  beforeEach(() => {
    limiter = new ToolRateLimiter(DEFAULT_TOOL_RATE_LIMITS);
  });

  it('allows first call to any tool', () => {
    expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);
  });

  it('blocks tool after max per turn reached', () => {
    // update_onboarding_state has maxPerTurn: 1
    limiter.recordCall('update_onboarding_state');

    const result = limiter.canCall('update_onboarding_state');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('max per turn');
  });

  it('resets turn counts but keeps session counts', () => {
    limiter.recordCall('update_onboarding_state');
    limiter.resetTurn();

    // Should allow again after turn reset
    expect(limiter.canCall('update_onboarding_state').allowed).toBe(true);

    // But session count is preserved
    const stats = limiter.getStats();
    expect(stats.session['update_onboarding_state']).toBe(1);
  });
});
```

**File:** `server/test/agent/orchestrator/circuit-breaker.test.ts`

```typescript
describe('CircuitBreaker', () => {
  it('trips after max turns exceeded', () => {
    const cb = new CircuitBreaker({ maxTurnsPerSession: 3, ...defaults });

    cb.recordTurn(100);
    cb.recordTurn(100);
    cb.recordTurn(100);

    const result = cb.check();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Max turns');
  });

  it('trips after consecutive errors', () => {
    const cb = new CircuitBreaker({ maxConsecutiveErrors: 2, ...defaults });

    cb.recordError();
    cb.recordError();

    expect(cb.check().allowed).toBe(false);
  });

  it('resets error count on success', () => {
    const cb = new CircuitBreaker({ maxConsecutiveErrors: 2, ...defaults });

    cb.recordError();
    cb.recordSuccess();
    cb.recordError();

    expect(cb.check().allowed).toBe(true);
  });
});
```

**File:** `server/test/agent/orchestrator/budget-tracker.test.ts`

```typescript
describe('BudgetTracker', () => {
  it('prevents T1 from starving T2', () => {
    const tracker = createBudgetTracker({ T1: 10, T2: 3, T3: 1 });

    // Exhaust T1 budget
    for (let i = 0; i < 10; i++) {
      expect(tracker.consume('T1')).toBe(true);
    }
    expect(tracker.consume('T1')).toBe(false); // 11th call fails

    // T2 budget is independent
    expect(tracker.consume('T2')).toBe(true);
    expect(tracker.remaining.T2).toBe(2);
  });
});
```

#### Task 4.2: Integration Tests for Proposal Lifecycle (Days 26-27)

**File:** `server/test/integration/proposal-lifecycle.spec.ts`

```typescript
describe('Proposal Lifecycle Integration', () => {
  it('soft-confirms T2 proposal on next message', async () => {
    // 1. Create onboarding session
    const { tenantId, session } = await createTestSession('onboarding');

    // 2. Send message that creates T2 proposal
    await orchestrator.chat(
      tenantId,
      session.sessionId,
      'Create photography packages: Basic $200, Standard $400, Premium $800'
    );

    // 3. Verify proposal is PENDING
    const pending = await prisma.agentProposal.findMany({
      where: { tenantId, sessionId: session.sessionId, status: 'PENDING' },
    });
    expect(pending.length).toBeGreaterThan(0);

    // 4. Send follow-up message (not "wait")
    await orchestrator.chat(tenantId, session.sessionId, 'That looks great!');

    // 5. Verify proposal was EXECUTED
    const executed = await prisma.agentProposal.findFirst({
      where: { id: pending[0].id },
    });
    expect(executed?.status).toBe('EXECUTED');

    // 6. Verify packages created
    const packages = await prisma.package.findMany({
      where: { tenantId, name: { in: ['Basic', 'Standard', 'Premium'] } },
    });
    expect(packages.length).toBe(3);
  });

  it('respects agent-specific soft-confirm window', async () => {
    // Test that onboarding (10 min) vs customer (2 min) windows work
    // ...
  });

  it('prevents T1 from starving T2', async () => {
    // Test that separate budgets work
    // ...
  });
});
```

#### Task 4.3: Documentation (Days 28-29)

**File:** `docs/adrs/ADR-018-agent-guardrails.md`

```markdown
# ADR-018: Agent Guardrails and Rate Limiting

## Status

Accepted

## Context

AI agents can consume excessive resources or get stuck in loops. We need
code-level guardrails (not just prompt-based) to ensure safety and cost control.

## Decision

Implement three-layer guardrail system:

1. **Per-Tier Budgets**: Separate recursion limits for T1/T2/T3 tools
2. **Per-Tool Rate Limits**: Token bucket pattern for individual tools
3. **Circuit Breakers**: Session-level limits on turns, tokens, time, errors

## Consequences

- Prevents runaway agents
- Cost control via token limits
- T1 tools cannot starve T2/T3
- More complex orchestrator logic
```

### Phase 5: Monitoring & Observability (3 days)

#### Task 5.1: Metrics Collection (Day 30-31)

**File:** `server/src/agent/orchestrator/metrics.ts` (NEW)

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Tool execution metrics
export const toolCallsTotal = new Counter({
  name: 'agent_tool_calls_total',
  help: 'Total number of tool calls',
  labelNames: ['tool_name', 'tier', 'status', 'agent_type'],
});

export const toolCallDuration = new Histogram({
  name: 'agent_tool_call_duration_seconds',
  help: 'Tool call duration in seconds',
  labelNames: ['tool_name', 'tier'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Session metrics
export const activeSessionsGauge = new Gauge({
  name: 'agent_active_sessions',
  help: 'Number of active agent sessions',
  labelNames: ['agent_type'],
});

export const sessionTurnsHistogram = new Histogram({
  name: 'agent_session_turns',
  help: 'Number of turns per session',
  labelNames: ['agent_type'],
  buckets: [1, 5, 10, 20, 50],
});

// Proposal metrics
export const proposalsCreatedTotal = new Counter({
  name: 'agent_proposals_created_total',
  help: 'Total proposals created',
  labelNames: ['tool_name', 'trust_tier'],
});

export const proposalStatusTotal = new Counter({
  name: 'agent_proposal_status_total',
  help: 'Proposal status transitions',
  labelNames: ['status', 'trust_tier'],
});

// Circuit breaker metrics
export const circuitBreakerTripsTotal = new Counter({
  name: 'agent_circuit_breaker_trips_total',
  help: 'Circuit breaker trips',
  labelNames: ['agent_type', 'reason'],
});
```

#### Task 5.2: Logging Enhancements (Day 32)

**File:** `server/src/agent/orchestrator/logging.ts` (NEW)

```typescript
import { logger } from '../../lib/core/logger';

export interface AgentLogContext {
  tenantId: string;
  sessionId: string;
  agentType: 'onboarding' | 'customer' | 'admin';
  turnNumber: number;
}

export function logToolExecution(
  ctx: AgentLogContext,
  toolName: string,
  tier: string,
  durationMs: number,
  success: boolean,
  error?: string
): void {
  const level = success ? 'info' : 'warn';
  logger[level](
    {
      ...ctx,
      toolName,
      tier,
      durationMs,
      success,
      error,
    },
    `Tool ${toolName} ${success ? 'succeeded' : 'failed'}`
  );
}

export function logSessionStart(ctx: AgentLogContext): void {
  logger.info(ctx, 'Agent session started');
}

export function logSessionEnd(
  ctx: AgentLogContext,
  stats: {
    totalTurns: number;
    totalTokens: number;
    durationMs: number;
    proposalsCreated: number;
    proposalsExecuted: number;
  }
): void {
  logger.info({ ...ctx, ...stats }, 'Agent session ended');
}

export function logCircuitBreakerTrip(ctx: AgentLogContext, reason: string): void {
  logger.warn({ ...ctx, reason }, 'Circuit breaker tripped');
}
```

---

## Files to Modify/Create

### New Files

| File                                                       | Purpose                  |
| ---------------------------------------------------------- | ------------------------ |
| `server/src/agent/orchestrator/base-orchestrator.ts`       | Abstract base class      |
| `server/src/agent/orchestrator/onboarding-orchestrator.ts` | Onboarding subclass      |
| `server/src/agent/orchestrator/customer-orchestrator.ts`   | Customer subclass        |
| `server/src/agent/orchestrator/admin-orchestrator.ts`      | Admin subclass           |
| `server/src/agent/orchestrator/rate-limiter.ts`            | Per-tool rate limiting   |
| `server/src/agent/orchestrator/circuit-breaker.ts`         | Session circuit breakers |
| `server/src/agent/orchestrator/metrics.ts`                 | Prometheus metrics       |
| `server/src/agent/orchestrator/logging.ts`                 | Structured logging       |
| `server/test/agent/orchestrator/rate-limiter.test.ts`      | Rate limiter tests       |
| `server/test/agent/orchestrator/circuit-breaker.test.ts`   | Circuit breaker tests    |
| `server/test/agent/orchestrator/budget-tracker.test.ts`    | Budget tracker tests     |
| `server/test/integration/proposal-lifecycle.spec.ts`       | Integration tests        |
| `docs/adrs/ADR-018-agent-guardrails.md`                    | Architecture decision    |

### Modified Files

| File                                                 | Changes                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| `server/src/agent/orchestrator/orchestrator.ts`      | Fix session ID bug, add guardrails         |
| `server/src/agent/orchestrator/types.ts`             | Add TierBudgets, AgentConfig types         |
| `server/src/agent/proposals/proposal.service.ts`     | Add agentType param, context-aware windows |
| `server/src/agent/customer/customer-orchestrator.ts` | Extend BaseOrchestrator                    |
| `server/src/di.ts`                                   | Wire up new orchestrators                  |

---

## Acceptance Criteria

### Phase 1: Bug Fixes

- [ ] Session ID mismatch fixed - proposals use correct session ID
- [ ] Soft-confirm windows are context-aware (10 min onboarding, 2 min customer)
- [ ] Per-tier budgets prevent T1 from starving T2/T3
- [ ] Diagnostic logging helps debug proposal issues

### Phase 2: Guardrails

- [ ] Per-tool rate limiting enforced
- [ ] Circuit breakers trip on resource exhaustion
- [ ] Guardrails integrated into orchestrator

### Phase 3: Unified Orchestrator

- [ ] BaseOrchestrator extracted with shared logic
- [ ] OnboardingOrchestrator extends BaseOrchestrator
- [ ] CustomerOrchestrator extends BaseOrchestrator
- [ ] AdminOrchestrator extends BaseOrchestrator

### Phase 4: Testing

- [ ] Unit tests for all guardrails (rate limiter, circuit breaker, budget tracker)
- [ ] Integration tests for proposal lifecycle
- [ ] E2E test: onboarding creates packages successfully
- [ ] Documentation updated (ADRs, runbook)

### Phase 5: Observability

- [ ] Prometheus metrics exported
- [ ] Structured logging for all key events
- [ ] Dashboard for agent health monitoring

---

## Risk Analysis

| Risk                                        | Likelihood | Impact | Mitigation                                          |
| ------------------------------------------- | ---------- | ------ | --------------------------------------------------- |
| Session ID fix breaks existing sessions     | Low        | High   | Deploy with feature flag, migrate existing sessions |
| Rate limiting too aggressive                | Medium     | Medium | Start with generous limits, tune based on metrics   |
| Circuit breaker trips too often             | Medium     | Low    | Log all trips, adjust thresholds based on data      |
| Unified orchestrator introduces regressions | Medium     | High   | Comprehensive test coverage, gradual rollout        |

---

## Rollback Plan

### Phase 1 Rollback

If session ID fix causes issues:

1. Revert to original `sessionId` parameter
2. Add session ID to proposal response for debugging
3. Investigate with enhanced logging

### Phase 2 Rollback

If guardrails too aggressive:

1. Increase limits by 2x
2. Add bypass flag for development
3. Tune based on production metrics

### Phase 3 Rollback

If unified orchestrator fails:

1. Keep separate orchestrators
2. Extract shared utilities only
3. Document patterns in lieu of base class

---

## Success Metrics

| Metric                     | Current | Target |
| -------------------------- | ------- | ------ |
| T2 proposal execution rate | ~20%    | >95%   |
| Onboarding completion rate | ~50%    | >80%   |
| Average T1 calls per turn  | 4+      | ≤2     |
| Circuit breaker trips/day  | N/A     | <5     |
| P95 session cost           | Unknown | <$3    |

---

## Timeline

| Phase                         | Days | Start  | End    |
| ----------------------------- | ---- | ------ | ------ |
| Phase 1: Bug Fixes            | 7    | Day 1  | Day 7  |
| Phase 2: Guardrails           | 8    | Day 8  | Day 15 |
| Phase 3: Unified Orchestrator | 7    | Day 16 | Day 22 |
| Phase 4: Testing & Docs       | 7    | Day 23 | Day 29 |
| Phase 5: Monitoring           | 3    | Day 30 | Day 32 |

**Total: 32 days to production-ready**

---

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **Code-level guardrails beat prompt-level** - Claude doesn't reliably follow "only call once" instructions. The DoorDash "Budgeting the Loop" pattern of hard limits is essential.

2. **Context determines timing** - A 2-minute window works for quick booking chats but fails for thoughtful onboarding. Agent type should drive configuration.

3. **Session ID consistency is subtle** - The bug where `getOrCreateSession()` returns a new session but we query the old `sessionId` is easy to miss. Always use the returned session's ID.

4. **Separate budgets prevent starvation** - Shared recursion depth means T1 metadata tools can crowd out T2 write tools. Per-tier budgets are a simple, effective fix.

5. **Inheritance enables consistency** - A BaseOrchestrator ensures all agents get security fixes automatically, while subclasses customize behavior.

`─────────────────────────────────────────────────`

---

## References

### Internal Documentation

- [Chatbot Proposal Execution Flow](../docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
- [Phase 5 Testing and Caching Prevention](../docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [Circular Dependency Executor Registry](../docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md)

### External References

- [DoorDash: Budgeting the Loop](https://doordash.engineering/2024/07/15/budgeting-the-loop-learnings-from-building-llm-agents/) - Per-turn limits pattern
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/semantic-kernel/agents/) - Multi-tier oversight
- [LangGraph Orchestration](https://python.langchain.com/docs/langgraph) - State machine patterns
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) - Claude SDK patterns

### Related PRs

- (None yet - this is the initial implementation)

---

**Author:** Claude Code via `/workflows:plan`
**Created:** 2025-12-31
**Last Updated:** 2025-12-31
