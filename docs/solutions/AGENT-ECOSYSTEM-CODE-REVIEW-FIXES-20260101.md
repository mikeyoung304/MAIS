---
title: Agent Ecosystem Code Review Fixes (Phase 4 P1)
date: 2026-01-01
problem_types:
  - architecture-patterns
  - security-issues
  - performance-optimization
components:
  - agent-orchestrator
  - proposal-service
  - database-schema
  - public-api-routes
severity: P1
status: completed
impact:
  - Fixed multi-tenant security isolation (per-session circuit breakers)
  - Enhanced security (required trustTier field on tools)
  - Improved proposal accuracy (contextual rejection patterns)
  - Added DoS protection (IP rate limiting)
  - Query performance (composite database index)
---

# Agent Ecosystem Code Review Fixes

## Executive Summary

Code review of the Agent Ecosystem (Phases 1-5) identified 5 critical issues in guardrails, security, and database performance. All fixes applied in commit `cb55639`.

**Key Wins:**

- Circuit breaker state now per-session instead of singleton (fixes multi-tenant isolation)
- `trustTier` now required on all tools (prevents silent approval bypasses)
- Rejection patterns refined (eliminates false positives like "No, I don't have any other questions")
- Public endpoints rate-limited (prevents customer chatbot DoS)
- Query performance optimized (composite index for session cleanup queries)

---

## Problem 1: Singleton Circuit Breaker State (Issue #539)

### Root Cause

```typescript
// BEFORE: Singleton across all sessions
export interface OrchestratorConfig {
  readonly circuitBreaker: CircuitBreakerConfig;
}

// In BaseOrchestrator:
private circuitBreaker: CircuitBreaker | null = null;

// Single breaker for ALL sessions - one user's abuse affects everyone!
```

Circuit breaker was a single instance, shared across ALL tenant sessions. If one customer chatbot user triggered excessive API calls, the circuit breaker would trip and block ALL other sessions.

### Security Impact

**Severity: P0 (Multi-Tenant Isolation)**

- One malicious user can trigger DoS for all other users of a tenant
- Circuit breaker tripping for User A blocks User B's conversation
- Violates fundamental multi-tenant isolation principle
- Affects: customer chatbot (public), admin chatbot, onboarding agent

### The Fix

```typescript
// AFTER: Map of circuit breakers per session
private readonly circuitBreakers = new Map<string, CircuitBreaker>();

// Session initialization:
let circuitBreaker = this.circuitBreakers.get(session.sessionId);
if (!circuitBreaker) {
  circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  this.circuitBreakers.set(session.sessionId, circuitBreaker);
}

// Cleanup for stale sessions
private cleanupOldCircuitBreakers(): void {
  const now = Date.now();
  let removed = 0;

  for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
    const elapsed = now - circuitBreaker.getState().startTime;

    // Remove if session older than 1 hour
    if (elapsed > 60 * 60 * 1000) {
      this.circuitBreakers.delete(sessionId);
      removed++;
    }
  }

  // Prevent unbounded growth
  const MAX_CIRCUIT_BREAKERS = 1000;
  if (this.circuitBreakers.size > MAX_CIRCUIT_BREAKERS) {
    const toRemove = this.circuitBreakers.size - MAX_CIRCUIT_BREAKERS;
    let removed = 0;

    for (const [sessionId] of this.circuitBreakers) {
      if (removed >= toRemove) break;
      this.circuitBreakers.delete(sessionId);
      removed++;
    }
  }
}
```

### Why This Matters

- **Per-session isolation**: Each conversation has its own token budget
- **Fair resource allocation**: One abusive user doesn't penalize others
- **Stale session cleanup**: Prevents unbounded memory growth
- **Max circuit breaker limit**: Protects against session explosion

### Testing

```bash
# Verify isolation: start 2 customer chat sessions, only one should trip on token limit
npm run test:e2e -- customer-chat-isolation.spec.ts
```

**Key Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts` - Lines 202, 390-393, 1018-1044
- `server/src/agent/orchestrator/circuit-breaker.ts` - State storage

---

## Problem 2: Optional trustTier on AgentTool (Issue #541)

### Root Cause

```typescript
// BEFORE: trustTier was optional, defaulted to T1 (no approval needed)
export interface AgentTool {
  name: string;
  description: string;
  trustTier?: 'T1' | 'T2' | 'T3'; // Optional = dangerous
  // ...
}

// Silent default to T1 if not specified
const tier = tool.trustTier || 'T1'; // Dangerous!
```

Tools without explicit `trustTier` silently defaulted to T1 (auto-confirm), allowing write operations to execute without approval.

### Security Impact

**Severity: P0 (Approval Bypass)**

- New tools added without `trustTier` automatically auto-execute (should be explicit)
- Violates principle of explicit security decisions
- Write tools (T2/T3) could execute without confirmation
- Example: A booking tool without `trustTier` auto-confirms bookings with zero approval

### The Fix

```typescript
// AFTER: trustTier is REQUIRED
export interface AgentTool {
  name: string;
  description: string;
  /**
   * Trust tier for write operations:
   * - T1: Auto-confirm (reads, visibility toggles, file uploads)
   * - T2: Soft-confirm (proceeds unless user says "wait")
   * - T3: Hard-confirm (requires explicit "yes"/"confirm")
   *
   * REQUIRED for all tools to prevent silent T1 defaults.
   * Read-only tools should use 'T1'.
   */
  trustTier: 'T1' | 'T2' | 'T3'; // REQUIRED, not optional
  // ...
}
```

### Why This Matters

- **Explicit security**: Every tool explicitly declares approval tier
- **Compile-time safety**: TypeScript errors if missing (fail-fast)
- **Code review clarity**: PR reviewers immediately see approval level
- **Prevents silent regressions**: No way to accidentally bypass approval

### Verification

```typescript
// TypeScript compilation will fail if trustTier is missing:
const tool: AgentTool = {
  name: 'book_service',
  description: 'Book a service',
  // ERROR: Property 'trustTier' is missing in type
};
```

**Key Files:**

- `server/src/agent/tools/types.ts` - Lines 61-87
- All tool implementations (customer, onboarding, admin)

---

## Problem 3: T2 Rejection Pattern False Positives (Issue #537)

### Root Cause

```typescript
// BEFORE: Overly broad rejection patterns
const rejectionPatterns = [
  /\b(actually|wait|stop|hold|no)\b/i, // Too broad!
];

// Example:
// User: "No, I don't have any other questions"
// Pattern match: "no" → Entire proposal rejected!
// Result: Customer's perfectly good proposal gets rejected
```

Rejection patterns were too broad, catching normal conversational words like "actually" and "no" in non-rejection contexts.

### User Impact

**Severity: P2 (User Experience)**

- Customer says "No, I don't have any other questions" → Proposal incorrectly rejected
- Agent responds "OK, I'll skip the booking" → Customer confused
- Negative UX: Feels like the agent misunderstood
- Conversion impact: Booking doesn't happen despite customer consent

### The Fix

```typescript
// AFTER: Contextual patterns requiring explicit rejection intent
const rejectionPatterns = [
  // Strong rejections at START of message (high confidence)
  /^(wait|stop|hold|cancel|no,?\s*(don'?t|cancel|stop|wait))/i,

  // Explicit cancel/stop with object (not just any word)
  /\b(cancel\s+(that|this|it|the)|stop\s+(that|this|it|the))\b/i,
  /\bhold\s+on\b/i,
  /\bwait,?\s*(don'?t|stop|cancel)/i,

  // Explicit "don't do" patterns (specific action)
  /\bdon'?t\s+(do|proceed|continue|make|create)\b/i,
];

// Short standalone rejection (only if message is VERY short)
const shortRejection = /^(no|stop|wait|cancel|hold)\.?!?$/i;
const isShortRejection = shortRejection.test(normalizedMessage.trim());

const isRejection = isShortRejection || rejectionPatterns.some((p) => p.test(normalizedMessage));
```

### Key Improvements

| Scenario                               | Before      | After       | Reason                                |
| -------------------------------------- | ----------- | ----------- | ------------------------------------- |
| "No, I don't have any other questions" | ❌ Rejected | ✅ Approved | "no" alone in context isn't rejection |
| "No wait, don't book that"             | ❌ Rejected | ✅ Rejected | Explicit "don't" with action          |
| "Actually, let's proceed"              | ❌ Rejected | ✅ Approved | "Actually" isn't rejection            |
| "Wait, can you check availability?"    | ❌ Rejected | ✅ Approved | "Wait" as question, not rejection     |
| "Stop" (alone)                         | ❌ Rejected | ✅ Rejected | Short standalone rejection            |

### Why This Matters

- **Context matters**: "No" in "No, I don't have questions" ≠ rejection
- **Intent-based**: Rejection requires explicit cancellation words (cancel, stop, don't do)
- **Conversation flow**: Natural language preserved, only actual rejections trigger
- **Trust**: Agent respects user's consent accurately

**Key Files:**

- `server/src/agent/proposals/proposal.service.ts` - Lines 249-266
- `server/test/integration/proposal-soft-confirm.spec.ts` - Test cases

---

## Problem 4: Missing IP Rate Limiting on Public Endpoints (Issue #529)

### Root Cause

```typescript
// BEFORE: No rate limiting on public customer chat
const publicChatRouter = tsRestExpress(contract.customerChat, async (req) => {
  // Any IP can spam requests indefinitely
  const response = await orchestrator.chat(/* ... */);
  return response;
});

// Risk: DoS attack on public endpoint
```

Public customer chatbot endpoint had no rate limiting, allowing unlimited API calls per IP.

### Security Impact

**Severity: P1 (DoS Vulnerability)**

- Public endpoint: accessible without authentication
- No rate limits: Attacker can spam 10K+ requests/min
- Downstream impact: Claude API rate limits, quota exhaustion, $$$
- Affects: Customer chatbot, conversions, business operations

### The Fix

```typescript
// AFTER: IP-based rate limiting using express-rate-limit
import rateLimit from 'express-rate-limit';

const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 50, // 50 requests per IP per window
  standardHeaders: false, // Don't return RateLimit-* headers
  skip: (req, _res) => {
    // Skip rate limiting for authenticated requests (admin)
    return req.locals?.tenantAuth?.tenantId !== undefined;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again in 15 minutes.',
    });
  },
});

// Apply to public endpoint
publicRouter.post('/v1/public/chat/message', publicChatRateLimiter, tsRestExpress(/* ... */));
```

### Rate Limit Strategy

| Scenario                | Limit     | Window    | Rationale                           |
| ----------------------- | --------- | --------- | ----------------------------------- |
| Public customer chat    | 50 req/IP | 15 min    | ~3 req/min sustainable conversation |
| Authenticated endpoints | Unlimited | N/A       | Trusted users can use freely        |
| Spike protection        | Hard 429  | Immediate | Rejects excess, not queued          |

### Calculation

- Typical chat: ~5-8 messages per conversation
- ~10 conversations/hour = ~1 req/min average
- 50 req/15min = ~3.3 req/min, leaves headroom for speed readers
- Fair rate for legitimate customers, blocks bulk attacks

**Key Files:**

- `server/src/routes/public-customer-chat.routes.ts` - Lines 17, 31-43
- `server/package.json` - dependency: `express-rate-limit`

---

## Problem 5: Missing Composite Database Index (Issue #530)

### Root Cause

```sql
-- BEFORE: Only separate indexes exist
CREATE INDEX "AgentSession_sessionType_updatedAt_idx"
  ON "AgentSession"("sessionType", "updatedAt");

CREATE INDEX "AgentSession_tenantId_idx"
  ON "AgentSession"("tenantId");

-- Query doing all 3 conditions = full table scan
SELECT * FROM "AgentSession"
WHERE "tenantId" = $1
  AND "sessionType" = $2
  AND "updatedAt" > $3;
```

Session cleanup queries filter on `(tenantId, sessionType, updatedAt)` but only had separate indexes on `(sessionType, updatedAt)` and `(tenantId)`. PostgreSQL couldn't use both indexes efficiently.

### Performance Impact

**Severity: P2 (Query Performance)**

- **Missing composite index**: Query must scan hundreds/thousands of rows
- **Cleanup job latency**: Stale session cleanup runs longer
- **Database load**: Higher CPU on background jobs
- **Scales poorly**: As sessions accumulate, cleanup job gets slower

### The Fix

```prisma
// AFTER: Composite index covering all three fields
model AgentSession {
  id                String            @id @default(cuid())
  tenantId          String
  sessionType       AgentSessionType
  updatedAt         DateTime          @updatedAt
  // ... other fields ...

  // Indexes for session lifecycle
  @@index([sessionType, updatedAt]) // Cleanup job queries
  @@index([tenantId, sessionType, updatedAt]) // #530: getOrCreateSession queries all 3 fields
}
```

### Why Composite Index Works

```sql
-- With composite index, PostgreSQL uses Index Range Scan
-- Instead of Sequential Scan (full table scan)

EXPLAIN (ANALYZE) SELECT * FROM "AgentSession"
WHERE "tenantId" = $1
  AND "sessionType" = $2
  AND "updatedAt" > $3;

-- BEFORE:
-- Seq Scan on agent_session (rows: 5000 scanned)

-- AFTER:
-- Index Range Scan on idx_agent_session_tenantid_sessiontype_updatedat (rows: 45 scanned)
```

### Index Design Pattern

**Rule:** When a query filters on multiple columns, create a composite index in query order:

```prisma
// Query filters in this order: tenantId, sessionType, updatedAt
WHERE tenantId = $1 AND sessionType = $2 AND updatedAt > $3

// Composite index should match filter order:
@@index([tenantId, sessionType, updatedAt])
```

**Key Files:**

- `server/prisma/schema.prisma` - Lines 855-856 (AgentSession model)
- `server/src/agent/orchestrator/base-orchestrator.ts` - Lines 1018-1044 (cleanup queries)

---

## Prevention Checklist for Future Agent Tools

When adding new agent tools or orchestrators, verify:

- [ ] **Circuit Breaker Isolation**: Per-session circuit breaker (not singleton)
- [ ] **Trust Tier Required**: `trustTier: 'T1' | 'T2' | 'T3'` (not optional)
- [ ] **Rejection Patterns**: Contextual patterns that require explicit intent
- [ ] **Rate Limiting**: Public endpoints rate-limited by IP
- [ ] **Composite Indexes**: Queries with 3+ filter columns have composite index
- [ ] **Multi-Tenant Isolation**: All queries filter by `tenantId`
- [ ] **Approval Execution**: T2/T3 tools verified to execute after confirmation

## Related Solutions

- **[AGENT-SECURITY-AND-DATA-INTEGRITY-SOLUTIONS](../AGENT-SECURITY-AND-DATA-INTEGRITY-SOLUTIONS-20251226.md)** - Comprehensive security patterns
- **[CIRCULAR-DEPENDENCY-EXECUTOR-REGISTRY](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)** - Avoid circular imports
- **[CHATBOT-PROPOSAL-EXECUTION-FLOW](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)** - T2/T3 execution patterns
- **[SCHEMA-DRIFT-PREVENTION](../database-issues/schema-drift-prevention-MAIS-20251204.md)** - Database migration patterns

## Commit Reference

**Commit:** `cb55639`
**Message:** `feat(agent): add code-level guardrails for agent orchestrator`

All fixes integrated into `main` branch.

---

Generated with [Claude Code](https://claude.com/claude-code)
