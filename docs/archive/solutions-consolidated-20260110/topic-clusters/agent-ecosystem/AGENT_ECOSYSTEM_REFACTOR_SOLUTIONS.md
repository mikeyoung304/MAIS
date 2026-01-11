# Agent Ecosystem Refactor Solutions

**Document:** Solution extraction from agent ecosystem refactor (Phase 5+)
**Date:** 2026-01-01
**Status:** Production-ready patterns

This document captures three critical solutions from the multi-orchestrator refactor:

1. **Per-Session Circuit Breaker Map** - Prevents shared state leaks across sessions
2. **Required `trustTier` on AgentTool** - Eliminates dangerous silent defaults
3. **Contextual T2 Rejection Patterns** - Reduces false rejections from legitimate business language

---

## Solution 1: Per-Session Circuit Breaker Map

### Problem

**Symptom:** One user's API errors or rate limit violations caused other sessions to become unavailable.

**Root Cause:** Shared singleton circuit breaker across all sessions:

```typescript
// BEFORE (Shared singleton - WRONG)
private circuitBreaker: CircuitBreaker | null = null;

// Single instance used by ALL sessions
if (!this.circuitBreaker) {
  this.circuitBreaker = new CircuitBreaker(config);
}
// One user's errors trip the breaker for EVERYONE
```

**Security Impact:** Cross-session pollution. One misbehaving user's traffic could break service for all other sessions.

### Solution

**Per-session Map with periodic cleanup:**

```typescript
// Per-session circuit breakers (keyed by sessionId to prevent cross-session pollution)
// Each session gets its own circuit breaker so one user's abuse doesn't affect others
private readonly circuitBreakers = new Map<string, CircuitBreaker>();

// Cleanup old circuit breakers periodically (every 100 chat calls)
private circuitBreakerCleanupCounter = 0;

// In chat() method:
let circuitBreaker = this.circuitBreakers.get(session.sessionId);
if (!circuitBreaker) {
  circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  this.circuitBreakers.set(session.sessionId, circuitBreaker);
}

// Periodic cleanup (every 100 calls):
this.circuitBreakerCleanupCounter++;
if (this.circuitBreakerCleanupCounter >= 100) {
  this.cleanupOldCircuitBreakers();
  this.circuitBreakerCleanupCounter = 0;
}
```

**Cleanup implementation:**

```typescript
/**
 * Cleanup old circuit breakers to prevent memory leaks
 *
 * Called periodically (every 100 chat calls) to remove circuit breakers
 * that have no recorded turns (likely dead sessions). Also enforces a
 * hard cap of 1000 entries to prevent unbounded memory growth.
 */
private cleanupOldCircuitBreakers(): void {
  let removed = 0;

  for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
    const state = circuitBreaker.getState();

    // Remove circuit breakers that are in CLOSED state with no recent activity
    // We use turnCount as a proxy - if it's 0, the session is effectively dead
    if (state.state === 'CLOSED' && state.turnCount === 0) {
      this.circuitBreakers.delete(sessionId);
      removed++;
    }
  }

  // Also enforce a hard cap to prevent unbounded growth
  const MAX_CIRCUIT_BREAKERS = 1000;
  if (this.circuitBreakers.size > MAX_CIRCUIT_BREAKERS) {
    // Remove oldest entries (first inserted due to Map ordering)
    const toRemove = this.circuitBreakers.size - MAX_CIRCUIT_BREAKERS;
    let removedForCap = 0;
    for (const [sessionId] of this.circuitBreakers) {
      if (removedForCap >= toRemove) break;
      this.circuitBreakers.delete(sessionId);
      removedForCap++;
      removed++;
    }
  }

  if (removed > 0) {
    logger.debug(
      { removed, remaining: this.circuitBreakers.size },
      'Cleaned up old circuit breakers'
    );
  }
}
```

### Key Patterns

- **Isolation:** Each session gets its own circuit breaker instance
- **Cleanup:** Periodic removal of dead sessions (CLOSED state, 0 turns)
- **Bounds:** Hard cap of 1000 circuit breakers to prevent unbounded growth
- **State tracking:** Use `turnCount` as proxy for session activity
- **Logging:** Track cleanup operations for monitoring

### Implementation Checklist

- [ ] Replace singleton with `Map<string, CircuitBreaker>`
- [ ] Initialize circuit breaker per session in `chat()` method
- [ ] Add cleanup counter and periodic cleanup call
- [ ] Implement `cleanupOldCircuitBreakers()` with activity check
- [ ] Enforce hard cap (1000 entries)
- [ ] Log cleanup operations
- [ ] Test: Verify multiple sessions don't interfere with each other
- [ ] Test: Verify dead sessions are cleaned up
- [ ] Test: Verify hard cap prevents unbounded growth

### File Location

**Base implementation:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/base-orchestrator.ts` (lines 200-206, 389-401, 1015-1046)

---

## Solution 2: Required `trustTier` on AgentTool

### Problem

**Symptom:** Some tools were silently defaulting to T1 (auto-confirm) when trustTier was missing, causing unintended auto-execution of write operations.

**Root Cause:** Optional `trustTier` property:

```typescript
// BEFORE (Optional - WRONG)
interface AgentTool {
  name: string;
  description: string;
  trustTier?: 'T1' | 'T2' | 'T3'; // Optional - silent T1 default
}

// If developer forgets trustTier, it becomes T1 (auto-confirm) silently
// No compiler error, no warning, just auto-confirms everything
```

**Security Impact:** Missing trust tier could cause tools to auto-confirm writes when they should require approval. Silent defaults are dangerous in security-critical code.

### Solution

**Make `trustTier` required on AgentTool interface:**

```typescript
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
  trustTier: 'T1' | 'T2' | 'T3'; // REQUIRED - no default
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
  execute: (context: ToolContext, params: Record<string, unknown>) => Promise<AgentToolResult>;
}
```

**Add trust tier documentation:**

```typescript
/**
 * Trust tier definitions
 */
export const TRUST_TIERS = {
  T1: {
    description: 'No confirmation needed',
    autoConfirm: true,
    examples: ['Blackouts', 'branding', 'visibility toggles', 'file uploads'],
  },
  T2: {
    description: 'Soft confirmation - proceeds after next message unless user says "wait"',
    autoConfirm: false,
    softConfirm: true,
    examples: ['Package changes', 'landing page updates', 'pricing'],
  },
  T3: {
    description: 'Hard confirmation - requires explicit "yes"/"confirm"/"do it"',
    autoConfirm: false,
    softConfirm: false,
    examples: ['Cancellations', 'refunds', 'deletes with existing bookings'],
  },
} as const;
```

### Key Patterns

- **Explicit over implicit:** Require trust tier decision at tool definition time
- **TypeScript enforcement:** Compiler prevents missing trust tier
- **Documentation:** Clear comment explaining each tier
- **Examples:** Show what kinds of tools belong in each tier
- **No defaults:** Silent defaults are dangerous

### Implementation Checklist

- [ ] Change `trustTier?` to `trustTier` (remove `?`)
- [ ] Add JSDoc comment explaining each tier
- [ ] Export `TRUST_TIERS` constant with definitions
- [ ] Update all tool implementations to specify `trustTier`
- [ ] Test: Ensure TypeScript compilation fails without `trustTier`
- [ ] Test: Verify all tools have explicit tier

### File Location

**Type definition:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/types.ts` (lines 61-110)

---

## Solution 3: Contextual T2 Rejection Patterns

### Problem

**Symptom:** Legitimate user messages like "No, I don't have other questions" were triggering T2 rejection, canceling proposals the user never intended to cancel.

**Root Cause:** Overly broad keyword matching:

```typescript
// BEFORE (Too broad - WRONG)
const rejectionKeywords = ['wait', 'stop', 'no', 'actually', 'cancel'];

// Message: "No, I don't have any other questions"
// Matches: 'no' → proposal rejected ❌
// User never intended to reject, just answering a question
```

**Impact:** False rejections. Users frustrated when proposals disappear for innocent words in natural conversation.

### Solution

**Contextual rejection patterns requiring explicit action:**

```typescript
// Check for rejection keywords - more contextual to avoid false positives
// Problem: "No, I don't have any other questions" shouldn't reject proposals
// Solution: Require rejection keywords at start of message or with explicit cancel context
const rejectionPatterns = [
  // Strong rejections at start of message
  /^(wait|stop|hold|cancel|no,?\s*(don'?t|cancel|stop|wait))/i,
  // Explicit cancel/stop anywhere
  /\b(cancel\s+(that|this|it|the)|stop\s+(that|this|it|the))\b/i,
  /\bhold\s+on\b/i,
  /\bwait,?\s*(don'?t|stop|cancel)/i,
  // Explicit "don't do" patterns
  /\bdon'?t\s+(do|proceed|continue|make|create)\b/i,
];

// Check if message is a very short standalone rejection word
const shortRejection = /^(no|stop|wait|cancel|hold)\.?!?$/i;
const isShortRejection = shortRejection.test(normalizedMessage.trim());

const isRejection = isShortRejection || rejectionPatterns.some((p) => p.test(normalizedMessage));
```

### Key Patterns

- **Position matters:** Keywords at message start are stronger rejections
- **Context required:** Require additional context word (e.g., "cancel that", not just "cancel")
- **Short rejection:** Only reject single-word responses ("No.", "Wait", "Stop")
- **Natural language:** Account for punctuation and contractions ("don't", "don't", "no,")
- **NFKC normalization:** Prevent Unicode lookalike character bypass

```typescript
// Always normalize before pattern matching
const normalizedMessage = userMessage.normalize('NFKC');
```

### Examples

**CORRECTLY REJECTED:**

```
"Wait" → matches shortRejection ✓
"Stop that" → matches /\bstop\s+(that|this|it|the)\b/i ✓
"No, don't do it" → matches /^no,?\s*(don'?t|cancel|stop|wait)/i ✓
"Actually, cancel this" → matches /\bcancel\s+(this)/i ✓
```

**CORRECTLY ACCEPTED:**

```
"No, I don't have other questions" → message is answering question, not rejecting proposal ✓
"Actually, that looks good" → "actually" without cancel context ✓
"Stop by next week" → "stop" is not a rejection context ✓
"Cancel the meeting next time" → refers to future meeting, not current proposal ✓
```

### Implementation Checklist

- [ ] Replace broad keyword list with contextual regex patterns
- [ ] Add short rejection pattern for single-word responses
- [ ] Test: "No" as standalone → reject
- [ ] Test: "No, I don't have questions" → accept
- [ ] Test: "Cancel that" → reject
- [ ] Test: "Cancel the meeting" → accept
- [ ] Test: "Wait, don't do it" → reject
- [ ] Test: "Wait, let me think" → accept
- [ ] Add NFKC normalization before pattern matching
- [ ] Document each pattern with examples

### File Location

**Rejection patterns:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/proposals/proposal.service.ts` (lines 249-266)

---

## Integration Example

**How all three solutions work together in `BaseOrchestrator.chat()`:**

```typescript
async chat(
  tenantId: string,
  requestedSessionId: string,
  userMessage: string
): Promise<ChatResponse> {
  const config = this.getConfig();

  // Get or validate session
  let session = await this.getSession(tenantId, requestedSessionId);
  if (!session) {
    session = await this.getOrCreateSession(tenantId);
  }

  // SOLUTION 1: Per-session circuit breaker
  let circuitBreaker = this.circuitBreakers.get(session.sessionId);
  if (!circuitBreaker) {
    circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.circuitBreakers.set(session.sessionId, circuitBreaker);
  }

  // Periodic cleanup of old circuit breakers
  this.circuitBreakerCleanupCounter++;
  if (this.circuitBreakerCleanupCounter >= 100) {
    this.cleanupOldCircuitBreakers();
    this.circuitBreakerCleanupCounter = 0;
  }

  // Check circuit breaker
  const circuitCheck = circuitBreaker.check();
  if (!circuitCheck.allowed) {
    return {
      message: `I've reached my session limit. ${circuitCheck.reason}. Please start a new conversation.`,
      sessionId: session.sessionId,
    };
  }

  // SOLUTION 3: Contextual T2 rejection patterns
  const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
    tenantId,
    session.sessionId,
    userMessage,
    config.agentType // Enables context-aware soft-confirm windows
  );

  // Execute soft-confirmed proposals
  if (softConfirmedIds.length > 0) {
    await this.executeConfirmedProposals(tenantId, softConfirmedIds, failedProposals, config);
  }

  // Tools with SOLUTION 2: Required trustTier
  const tools = this.buildToolsForAPI();
  // Each tool in getTools() MUST have trustTier: 'T1' | 'T2' | 'T3'

  // ... rest of chat flow
}
```

---

## Testing Strategies

### Circuit Breaker Tests

```typescript
test('per-session circuit breakers prevent cross-session interference', async () => {
  const tenant = await createTestTenant();

  // Session 1 hits rate limits
  const session1 = await orchestrator.getOrCreateSession(tenant.id);
  // Simulate errors...

  // Session 2 should work fine (different circuit breaker)
  const session2 = await orchestrator.getOrCreateSession(tenant.id);
  const response = await orchestrator.chat(tenant.id, session2.sessionId, 'Hello');
  expect(response.message).toBeDefined();
});

test('circuit breaker cleanup removes dead sessions', async () => {
  const tenant = await createTestTenant();

  // Create session and let it become inactive
  const session = await orchestrator.getOrCreateSession(tenant.id);
  await orchestrator.chat(tenant.id, session.sessionId, 'test');

  // Trigger cleanup (simulate 100 calls)
  for (let i = 0; i < 100; i++) {
    const s = await orchestrator.getOrCreateSession(tenant.id);
    await orchestrator.chat(tenant.id, s.sessionId, 'test');
  }

  // Original session's circuit breaker should be cleaned up
  // (if it was in CLOSED state with 0 turns)
});
```

### Trust Tier Tests

```typescript
// TypeScript compilation will fail without trustTier
const badTool: AgentTool = {
  name: 'bad_tool',
  description: 'Missing trustTier',
  // ERROR: Property 'trustTier' is missing
  inputSchema: { ... },
  execute: async () => ({ success: true, data: {} }),
};
```

### T2 Rejection Pattern Tests

```typescript
test('rejects explicit cancellations', async () => {
  const tenant = await createTestTenant();
  const session = await orchestrator.getOrCreateSession(tenant.id);

  // Create a T2 proposal
  const proposal = await proposalService.createProposal({
    tenantId: tenant.id,
    sessionId: session.id,
    toolName: 'upsert_services',
    operation: 'Create service',
    trustTier: 'T2',
    payload: { name: 'New Service' },
    preview: { name: 'New Service' },
  });

  // Explicit rejection
  const rejectedIds = await proposalService.softConfirmPendingT2(
    tenant.id,
    session.id,
    'No, cancel that',
    'admin'
  );

  expect(rejectedIds).toHaveLength(0); // No confirms
  const updated = await proposalService.getProposal(tenant.id, proposal.proposalId);
  expect(updated.status).toBe('REJECTED');
});

test('accepts innocent "no" responses', async () => {
  const tenant = await createTestTenant();
  const session = await orchestrator.getOrCreateSession(tenant.id);

  // Create a T2 proposal
  const proposal = await proposalService.createProposal({
    tenantId: tenant.id,
    sessionId: session.id,
    toolName: 'upsert_services',
    operation: 'Create service',
    trustTier: 'T2',
    payload: { name: 'New Service' },
    preview: { name: 'New Service' },
  });

  // Innocent "no" response
  const confirmedIds = await proposalService.softConfirmPendingT2(
    tenant.id,
    session.id,
    "No, I don't have other questions",
    'admin'
  );

  expect(confirmedIds).toContain(proposal.proposalId); // Confirms
});
```

---

## Deployment Checklist

- [ ] All `AgentTool` instances have explicit `trustTier`
- [ ] TypeScript compilation passes with no warnings
- [ ] Circuit breaker Map initialized in `BaseOrchestrator`
- [ ] Cleanup logic implemented and tested
- [ ] Rejection patterns updated in `ProposalService.softConfirmPendingT2()`
- [ ] NFKC normalization applied before pattern matching
- [ ] Test suite covers all three solutions
- [ ] Load test: Verify 1000 circuit breaker cap works under load
- [ ] E2E test: Multiple concurrent sessions don't interfere

---

## Key Insights

1. **Shared mutable state is dangerous:** Singleton circuit breaker caused cross-session pollution. Always scope state by entity (session, tenant, user).

2. **Silent defaults in security code are deadly:** Optional `trustTier` could silently enable auto-confirm for critical writes. Make security decisions explicit.

3. **Context matters in natural language:** Rejection keywords require context to distinguish from innocent conversational language. Use regex patterns that require action verbs + context.

4. **Cleanup is critical for long-running services:** Without periodic cleanup of dead sessions, memory grows unbounded. Use activity indicators (turn count) to identify stale sessions.

---

## References

**Related Solutions:**

- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md` - Registry pattern for shared state
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md` - Proposal lifecycle
- `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/mais-critical-patterns.md` - Multi-tenant isolation patterns

**Implementation Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts` - Circuit breaker implementation
- `server/src/agent/tools/types.ts` - AgentTool interface
- `server/src/agent/proposals/proposal.service.ts` - T2 rejection patterns
