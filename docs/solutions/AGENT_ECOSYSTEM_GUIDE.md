# Agent Ecosystem Guide

**Consolidated**: 2026-01-10
**Source files**: 7 files merged (see Archive section)

This guide consolidates all agent ecosystem documentation into a single, actionable reference for building and maintaining the MAIS multi-agent AI system.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Trust Tiers](#2-trust-tiers)
3. [Session Management](#3-session-management)
4. [Recursion Budgets](#4-recursion-budgets)
5. [Soft-Confirm Windows](#5-soft-confirm-windows)
6. [Guardrails & Safety](#6-guardrails--safety)
7. [Implementation Patterns](#7-implementation-patterns)
8. [Performance Considerations](#8-performance-considerations)
9. [Quick Reference](#9-quick-reference)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Architecture Overview

The MAIS agent ecosystem consists of three orchestrator types serving different use cases:

| Agent Type     | Purpose                  | Session TTL | Max History | Tools |
| -------------- | ------------------------ | ----------- | ----------- | ----- |
| **Onboarding** | Multi-day business setup | 24 hours    | 20 messages | 30+   |
| **Customer**   | Quick booking assistance | 1 hour      | 10 messages | 4     |
| **Admin**      | Internal operations      | 24 hours    | 20 messages | 30+   |

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    BaseOrchestrator                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Session Mgr │  │ Proposal Svc│  │ Circuit Breaker Map │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                  │                    │
    ┌────┴────┐       ┌────┴────┐         ┌────┴────┐
    │ Agent   │       │Customer │         │ Admin   │
    │Orch.    │       │Orch.    │         │Orch.    │
    └─────────┘       └─────────┘         └─────────┘
```

### Key Patterns

- **Event Sourcing**: Onboarding uses event sourcing for audit trails and session resumption
- **XState State Machines**: Phase transitions for provable correctness
- **Multi-Tenant Isolation**: ALL queries must filter by `tenantId`
- **Trust Tiers**: T1 (auto), T2 (soft-confirm), T3 (hard-confirm)

---

## 2. Trust Tiers

Every tool MUST have an explicit `trustTier`. This is REQUIRED, not optional.

```typescript
export interface AgentTool {
  name: string;
  description: string;
  /**
   * REQUIRED - T1: auto-confirm, T2: soft-confirm, T3: hard-confirm
   * Never use optional (?) for this field - silent defaults are dangerous
   */
  trustTier: 'T1' | 'T2' | 'T3';
  inputSchema: { ... };
  execute: (context: ToolContext, params: Record<string, unknown>) => Promise<AgentToolResult>;
}
```

### Tier Definitions

| Tier   | Behavior                                        | Examples                                               |
| ------ | ----------------------------------------------- | ------------------------------------------------------ |
| **T1** | Auto-confirm (no user interaction)              | Reads, visibility toggles, file uploads, blackouts     |
| **T2** | Soft-confirm (proceeds unless user says "wait") | Package changes, landing page updates, pricing         |
| **T3** | Hard-confirm (requires explicit "yes")          | Cancellations, refunds, deletes with existing bookings |

### Classification Guide

```
Is the operation reversible without data loss?
├── Yes → Is it a read-only operation?
│         ├── Yes → T1
│         └── No → Does it affect customer-facing content?
│                  ├── No → T1
│                  └── Yes → T2
└── No → Does it involve financial transactions or permanent deletion?
         ├── Yes → T3
         └── No → T2
```

---

## 3. Session Management

### Session Isolation (CRITICAL)

Proposals MUST be session-scoped to prevent cross-session execution:

```typescript
// CORRECT: Session-scoped query
const proposals = await prisma.agentProposal.findMany({
  where: {
    tenantId,
    sessionId, // REQUIRED - prevents cross-session leakage
    status: 'PENDING',
    trustTier: 'T2',
  },
});

// WRONG: Tenant-only query (security vulnerability)
const proposals = await prisma.agentProposal.findMany({
  where: { tenantId, status: 'PENDING', trustTier: 'T2' },
});
```

### Concurrent Session Prevention

Add unique constraint to prevent race conditions:

```prisma
@@unique([tenantId, sessionType, active], name: "unique_active_session")
```

### Session Resumption

For multi-day onboarding sessions:

- Events replayed to project current state
- `isReturning` flag triggers contextual resume message
- Memory summary injected into system prompt

---

## 4. Recursion Budgets

### Problem: T1 Starvation

With a single global limit, T1 tools can block T2 operations:

```
User: "Check availability, pricing, and book an appointment"
Agent: get_availability (T1) → depth 1
Agent: get_pricing (T1)     → depth 2
Agent: get_customers (T1)   → depth 3
Agent: check_conflicts (T1) → depth 4
Agent: create_booking (T2)  → depth 5 → LIMIT REACHED, booking fails!
```

### Solution: Per-Tier Budgets

```typescript
const DEFAULT_TIER_BUDGETS: TierBudgets = {
  T1: 10, // Read tools - cheap
  T2: 3, // Write tools - moderate (5 for onboarding)
  T3: 1, // Critical tools - expensive
};

// Derive maxRecursionDepth from tier budgets
// Convention: maxRecursionDepth = sum(tierBudgets) + buffer
// Onboarding: T1(10) + T2(5) + T3(1) + buffer(5) = 21
// Admin:      T1(10) + T2(3) + T3(1) + buffer(5) = 19
// Customer:   T1(5) + T2(2) + T3(1) + buffer(3) = 11
```

### Enterprise Budget System

```typescript
const BUDGET_PRESETS = {
  onboarding: { totalBudget: 15, tierCaps: { T2: 8, T3: 1 } },
  customer: { totalBudget: 8, tierCaps: { T2: 3, T3: 1 } },
  admin: { totalBudget: 12, tierCaps: { T2: 5, T3: 2 } },
};
```

---

## 5. Soft-Confirm Windows

### Per-Agent Configuration

Different agent types need different confirmation windows:

| Agent Type           | Window       | Rationale                          |
| -------------------- | ------------ | ---------------------------------- |
| **Customer Chatbot** | 30 seconds   | Quick booking flow                 |
| **Admin**            | 2 minutes    | Standard operations                |
| **Onboarding**       | 5-10 minutes | Users need time to read and ponder |

```typescript
interface OrchestratorConfig {
  softConfirmWindowMs: number;
}

// Configure per agent
const onboardingConfig = { softConfirmWindowMs: 5 * 60 * 1000 }; // 5 min
const chatbotConfig = { softConfirmWindowMs: 30 * 1000 }; // 30 sec
```

### Contextual Rejection Patterns

Avoid false positives from natural language:

```typescript
// WRONG: Too broad - matches "No, I don't have other questions"
const rejectionKeywords = ['wait', 'stop', 'no', 'cancel'];

// CORRECT: Context-aware patterns
const rejectionPatterns = [
  /^(wait|stop|hold|cancel|no,?\s*(don'?t|cancel|stop|wait))/i,
  /\b(cancel\s+(that|this|it)|stop\s+(that|this|it))\b/i,
  /\bhold\s+on\b/i,
  /\bdon'?t\s+(do|proceed|continue|make|create)\b/i,
];

// Short standalone rejections
const shortRejection = /^(no|stop|wait|cancel|hold)\.?!?$/i;
```

---

## 6. Guardrails & Safety

### Pattern 1: Per-Session Circuit Breakers

Prevent one user's abuse from affecting all users:

```typescript
// WRONG: Shared singleton
private circuitBreaker = new CircuitBreaker();

// CORRECT: Per-session map with cleanup
private readonly circuitBreakers = new Map<string, CircuitBreaker>();
private cleanupCounter = 0;

async chat(...) {
  let breaker = this.circuitBreakers.get(sessionId);
  if (!breaker) {
    breaker = new CircuitBreaker(config);
    this.circuitBreakers.set(sessionId, breaker);
  }

  // Periodic cleanup (every 100 calls)
  if (++this.cleanupCounter >= 100) {
    this.cleanupOldCircuitBreakers();
    this.cleanupCounter = 0;
  }
}
```

### Pattern 2: False Positive Prevention for NLP

Multi-word anchors prevent matching legitimate business data:

```typescript
// WRONG: Single-word patterns
/disregard/i  // Matches "Disregard for Details Photography"

// CORRECT: Multi-word anchors
/disregard\s+(all|previous)/i
/forget\s+(all|your|previous)/i
/ignore\s+(all|previous|above)/i
```

### Pattern 3: Public Endpoint Hardening

Three-layer defense for unauthenticated endpoints:

1. **IP Rate Limiting**: 50 requests per 15 minutes per IP
2. **Request Validation**: Size limits, schema validation
3. **Response Sanitization**: No sensitive fields, generic error messages

```typescript
app.post(
  '/v1/public/chat',
  publicRateLimiter, // Layer 1
  validateRequest, // Layer 2
  sanitizeResponse, // Layer 3
  chatHandler
);
```

### Pattern 4: Tool Context Immutability

Prevent tools from modifying shared context:

```typescript
const toolContext: Readonly<ToolContext> = Object.freeze({
  tenantId,
  sessionId,
  prisma,
});
```

### Pattern 5: Prompt Injection Prevention

Sanitize user data before prompt injection:

```typescript
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\n\n/g, ' ') // Prevent section breaks
    .replace(/\\n/g, ' ')
    .substring(0, 100); // Limit length
}

const systemPrompt = buildPrompt({
  businessName: sanitizeForPrompt(tenant?.name),
});
```

---

## 7. Implementation Patterns

### Proposal State Machine

```
PENDING → CONFIRMED → EXECUTED
    │         │
    ├→ FAILED ←┤
    └→ EXPIRED
```

Valid transitions:

- `PENDING → CONFIRMED` (soft-confirm or hard-confirm)
- `PENDING → FAILED` (error during creation)
- `PENDING → EXPIRED` (TTL exceeded)
- `CONFIRMED → EXECUTED` (executor completed)
- `CONFIRMED → FAILED` (executor error)

### Error Classification

```typescript
type ErrorType = 'VALIDATION' | 'RATE_LIMIT' | 'AUTH' | 'NETWORK' | 'UNKNOWN';

function classifyError(error: Error): ErrorType {
  if (error.message.includes('validation')) return 'VALIDATION';
  if (error.message.includes('rate limit')) return 'RATE_LIMIT';
  if (error.message.includes('401') || error.message.includes('403')) return 'AUTH';
  if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) return 'NETWORK';
  return 'UNKNOWN';
}

// Only retry transient errors
const retryableErrors = ['RATE_LIMIT', 'NETWORK'];
```

### Cache Invalidation

Use declarative marking for write tools:

```typescript
const WRITE_TOOLS = new Set([
  'upsert_services',
  'update_storefront',
  'update_onboarding_state',
  'create_booking',
  'update_package',
  'delete_booking', // Don't forget deletes!
]);

// Invalidate cache after write tool execution
if (WRITE_TOOLS.has(toolName)) {
  contextCache.delete(tenantId);
}
```

---

## 8. Performance Considerations

### SLAs (Proposed)

| Metric                 | P50   | P95   | P99   |
| ---------------------- | ----- | ----- | ----- |
| Chat response          | 1.5s  | 3s    | 5s    |
| Tool execution         | 1s    | 3s    | 5s    |
| Soft-confirm check     | 100ms | 500ms | 1s    |
| Market search          | 2s    | 5s    | 8s    |
| Market search fallback | 50ms  | 100ms | 200ms |

### Database Indexes

Use composite indexes for multi-column WHERE clauses:

```prisma
// WRONG: Separate single-column indexes
@@index([tenantId])
@@index([status])

// CORRECT: Composite index for query pattern
@@index([tenantId, status])
@@index([tenantId, sessionId, status])
```

### Context Cache

- TTL: 5 minutes
- Invalidation: After write tool execution
- Scope: Per-tenant (not per-session)

---

## 9. Quick Reference

### Critical Fixes Checklist (P0)

- [ ] Add `sessionId` filter to `softConfirmPendingT2()` query
- [ ] Make `trustTier` required on `AgentTool` interface
- [ ] Use per-session circuit breaker map, not singleton
- [ ] Use multi-word injection patterns, not single-word

### Code Review Checklist

1. **Session isolation**: All proposal queries include `sessionId`
2. **Trust tier**: Explicitly set, not defaulting to T1
3. **Recursion**: Separate tracking per tier
4. **Tool context**: Frozen or readonly
5. **Cache invalidation**: Write tools invalidate cache
6. **Multi-tenant**: All queries filtered by `tenantId`

### File Locations

| Component             | File                                                 |
| --------------------- | ---------------------------------------------------- |
| Base Orchestrator     | `server/src/agent/orchestrator/base-orchestrator.ts` |
| Customer Orchestrator | `server/src/agent/customer/customer-orchestrator.ts` |
| Proposal Service      | `server/src/agent/proposals/proposal.service.ts`     |
| Tool Types            | `server/src/agent/tools/types.ts`                    |
| Circuit Breaker       | `server/src/agent/orchestrator/circuit-breaker.ts`   |
| Budget System         | `server/src/agent/orchestrator/budget.ts`            |

---

## 10. Testing Checklist

### Session Isolation Tests

```typescript
test('softConfirmPendingT2 respects session boundaries', async () => {
  const proposalA = await createProposal({ sessionId: 'A' });
  const confirmed = await proposalService.softConfirmPendingT2(tenantId, 'B', 'looks good');
  expect(confirmed).not.toContain(proposalA.proposalId);
});
```

### Recursion Budget Tests

```typescript
test('T1 tools do not prevent T2 execution', async () => {
  // Execute 5 T1 tools
  // Then execute 1 T2 tool
  // Should succeed (not blocked)
});
```

### Circuit Breaker Tests

```typescript
test('per-session circuit breakers prevent cross-session interference', async () => {
  // Session 1 hits rate limits
  // Session 2 should work fine (different breaker)
});
```

### Rejection Pattern Tests

```typescript
test('rejects explicit cancellations', async () => {
  // "No, cancel that" → REJECTED
});

test('accepts innocent "no" responses', async () => {
  // "No, I don't have questions" → CONFIRMED
});
```

---

## Archive

The following files were consolidated into this guide:

| Original File                                     | Key Content                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| `AGENT_ECOSYSTEM_ANALYSIS_INDEX.md`               | Document navigation, issue index                |
| `AGENT_ECOSYSTEM_ANALYSIS_SUMMARY.md`             | Executive summary, findings overview            |
| `AGENT_ECOSYSTEM_GUARDRAILS_MANIFEST.md`          | 5 prevention patterns, anti-patterns            |
| `AGENT_ECOSYSTEM_IMPLEMENTATION_ROADMAP.md`       | Phase-by-phase implementation plan              |
| `AGENT_ECOSYSTEM_QUICK_REFERENCE.md`              | 22 critical ambiguities, code snippets          |
| `AGENT_ECOSYSTEM_REFACTOR_SOLUTIONS.md`           | Circuit breaker, trust tier, rejection patterns |
| `ENTERPRISE_AGENT_ECOSYSTEM_SPECFLOW_ANALYSIS.md` | Full technical analysis, edge cases             |

Files moved to: `docs/archive/solutions-consolidated-20260110/topic-clusters/agent-ecosystem/`

---

**Last Updated**: 2026-01-10
**Status**: Production-ready
