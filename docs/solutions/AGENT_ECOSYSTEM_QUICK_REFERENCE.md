# Agent Ecosystem - Quick Reference

**Print this. Pin it. Refer to it daily.**

---

## 22 Critical Ambiguities (One Per Line)

| #   | Issue                                           | Impact     | Fix                                                 |
| --- | ----------------------------------------------- | ---------- | --------------------------------------------------- |
| 1   | Session ID mismatch in proposals                | CRITICAL   | Add session filter to softConfirmPendingT2()        |
| 2   | Soft-confirm window not configurable            | HIGH       | 2 min (chatbot) vs 5-10 min (onboarding)            |
| 3   | Single recursion depth for all tiers            | HIGH       | Separate: T1=10, T2=3, T3=1                         |
| 4   | Three orchestrators, no shared base             | MEDIUM     | Decide: unified or document exact diffs             |
| 5   | T1 includes state mutations                     | MEDIUM     | Classify: which updates are "safe T1"?              |
| 6   | Circuit breaker not defined                     | MEDIUM     | Define triggers: consecutive failures? depth limit? |
| 7   | Session resumption loses message history        | LOW-MEDIUM | Increase maxHistoryMessages or summarize            |
| 8   | No proposal dependency ordering                 | LOW        | Document if needed for multi-step workflows         |
| 9   | ToolContext can be mutated                      | LOW        | Freeze with Object.freeze()                         |
| 10  | System prompt injection vulnerability           | MEDIUM     | Sanitize user-provided data                         |
| 11  | Executor timeout continues background execution | MEDIUM     | Ensure idempotency + test                           |
| 12  | Tool error classification missing               | MEDIUM     | Distinguish validation/rate-limit/auth errors       |
| 13  | Proposal TTL races with execution               | MEDIUM     | Lock proposal during execution                      |
| 14  | Write tool cache invalidation incomplete        | MEDIUM     | Declarative marking or comprehensive set            |
| 15  | No unique constraint on active sessions         | MEDIUM     | Prevent concurrent session creation                 |
| 16  | Context cache reused across sessions            | MEDIUM     | Clear cache on session switch or reduce TTL         |
| 17  | Onboarding phase transitions not guarded        | MEDIUM     | Add guards: discovery→market_research only          |
| 18  | Tool input validation only at SDK level         | LOW        | Consider re-validation in executor                  |
| 19  | Proposal preview not validated at execution     | LOW        | Check preview matches actual state                  |
| 20  | Audit trail doesn't capture actual trust tier   | MEDIUM     | Log which tier was used, not hard-coded             |
| 21  | No session type switching support               | LOW        | Design if admin impersonation needed                |
| 22  | Performance SLAs not specified                  | MEDIUM     | Define: <3s p95, market search <5s                  |

---

## Priority Matrix

```
CRITICAL (P0)        HIGH (P1)           MEDIUM (P2)         LOW (P3)
─────────────        ──────────          ───────────         ────────
1. Session ID        2. Soft-confirm     5. T1 classification 8. Proposal deps
mismatch             window config       6. Circuit breaker   13. Tool validation
                     3. Recursion        10. Prompt injection 17. Session switching
                     budget              12. Error class      19. Preview validation
                     4. Orchestrator     14. Cache invalidation
                        unification      15. Session constraint
                                         16. Context cache
                                         18. Phase guards
                                         20. Audit logging
                                         22. Performance SLAs
```

---

## Must-Fix Before Production

### Session Isolation (P0)

```typescript
// BEFORE: Missing session filter
const proposals = await prisma.agentProposal.findMany({
  where: { tenantId, status: 'PENDING' },
});

// AFTER: Add session filter
const proposals = await prisma.agentProposal.findMany({
  where: { tenantId, sessionId, status: 'PENDING' },
});
```

### Soft-Confirm Window (P0)

```typescript
// BEFORE: Hard-coded 2 minutes
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

// AFTER: Per-agent config
interface OrchestratorConfig {
  softConfirmWindowMs: number; // 30s for chatbot, 5-10min for onboarding
}
```

### Recursion Budget (P1)

```typescript
// BEFORE: Single limit
const MAX_RECURSION_DEPTH = 5;

// AFTER: Separate budgets
const RECURSION_BUDGET = {
  T1: 10, // Read tools cheap
  T2: 3, // Write tools expensive
  T3: 1, // Hard confirm very expensive
};
```

---

## Integration Test Checklist

- [ ] Session A proposals not visible in session B
- [ ] Soft-confirm window respected (onboarding 5+ min)
- [ ] T1 tools don't prevent T2 execution
- [ ] Proposal expires correctly
- [ ] Concurrent session creation prevented
- [ ] Tenant A can't see tenant B's data
- [ ] Context cache invalidated after writes
- [ ] Multi-step workflow completes (5+ tool calls)

---

## Code Review Checklist

When reviewing orchestrator changes, verify:

1. **Session isolation**: All proposal queries include `sessionId`
2. **Soft-confirm window**: Uses config, not hard-coded 2 min
3. **Recursion tracking**: Separate counters per tier, or weighted cost
4. **Tool context**: Frozen or readonly, not mutable
5. **Error handling**: Classifies errors (retry vs. fail)
6. **Audit logging**: Captures actual trust tier used
7. **Cache invalidation**: Declarative or comprehensive
8. **Multi-tenant**: Queries filtered by tenantId

---

## Architectural Decisions Needed

### Decision 1: Unified or Separate Orchestrators?

**Unified Base Class** (recommended)

- ✅ Bug fixes apply once
- ✅ Consistent behavior
- ❌ Complex conditional logic

**Separate Implementations**

- ✅ Simple, focused code
- ✅ Easy to test independently
- ❌ Changes needed in 3 places

**Status**: PENDING DECISION

### Decision 2: Soft-Confirm Window Strategy

**Option A**: Global config (current)

```typescript
T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000; // All agents same
```

**Option B**: Per-agent config

```typescript
softConfirmWindowMs: {
  onboarding: 5 * 60 * 1000,  // 5 minutes
  chatbot: 30 * 1000,         // 30 seconds
  admin: 2 * 60 * 1000,       // 2 minutes
}
```

**Status**: PENDING DECISION

### Decision 3: Recursion Budget Strategy

**Status**: ✅ IMPLEMENTED (2026-01-09)

**Option A**: Single global depth (deprecated)

```typescript
// OLD - caused "recursion limit reached" errors
maxRecursionDepth: 5;
```

**Option B**: Per-tier budgets ✅ ALREADY EXISTS in `types.ts`

```typescript
// This was already implemented!
const DEFAULT_TIER_BUDGETS: TierBudgets = {
  T1: 10, // Reads
  T2: 3, // Writes (5 for onboarding)
  T3: 1, // Critical
};
```

**Option C**: Enterprise weighted cost system ✅ NEW in `budget.ts`

```typescript
// Phase 2 enterprise implementation with branded types
const BUDGET_PRESETS = {
  onboarding: { totalBudget: 15, tierCaps: { T2: 8, T3: 1 } },
  customer: { totalBudget: 8, tierCaps: { T2: 3, T3: 1 } },
  admin: { totalBudget: 12, tierCaps: { T2: 5, T3: 2 } },
};
```

**The Fix**: Derive `maxRecursionDepth` from tier budgets (DHH pattern)

```typescript
// Convention: maxRecursionDepth = sum(tierBudgets) + buffer
// Onboarding: T1(10) + T2(5) + T3(1) + buffer(5) = 21
// Admin: T1(10) + T2(3) + T3(1) + buffer(5) = 19
// Customer: T1(5) + T2(2) + T3(1) + buffer(3) = 11
```

**Key Insight**: The tier budget system IS the recursion limit. `maxRecursionDepth`
was always a redundant safety net that became a tripwire. Now it's derived from
actual constraints and never becomes the bottleneck.

---

## Risk Scores

```
Risk                           Likelihood  Impact  Score  Action
─────────────────────────────  ──────────  ──────  ─────  ──────────
Session ID mismatch            MEDIUM      CRIT    HIGH   Fix now
Soft-confirm too short         HIGH        HIGH    CRIT   Fix now
Recursion starvation           HIGH        HIGH    CRIT   Fix now
Prompt injection               MEDIUM      MED     MED    Test + fix
Timeout background execution   MEDIUM      HIGH    MED    Test + fix
Proposal race conditions       MEDIUM      MED     MED    Test + fix
Context cache stale data       MEDIUM      LOW     LOW    Monitor
Large history loss             MEDIUM      LOW     LOW    Monitor
Circular dependencies          LOW         MED     LOW    Document
Tool context mutation          MEDIUM      LOW     LOW    Freeze
```

---

## File Locations

| File                                                 | Lines       | Issue               |
| ---------------------------------------------------- | ----------- | ------------------- |
| `server/src/agent/orchestrator/orchestrator.ts`      | 512-516     | Session ID logic    |
| `server/src/agent/proposals/proposal.service.ts`     | 53, 247-257 | Soft-confirm window |
| `server/src/agent/orchestrator/orchestrator.ts`      | 278         | Recursion depth     |
| `server/src/agent/customer/customer-orchestrator.ts` | 49          | Different depth     |
| `server/src/agent/orchestrator/orchestrator.ts`      | 1047-1051   | Tool context        |
| `server/src/agent/orchestrator/orchestrator.ts`      | 292-298     | Write tools set     |

---

## Performance SLAs (Proposed)

| Metric                 | P50   | P95   | P99   |
| ---------------------- | ----- | ----- | ----- |
| Chat response time     | 1.5s  | 3s    | 5s    |
| Tool execution         | 1s    | 3s    | 5s    |
| Soft-confirm check     | 100ms | 500ms | 1s    |
| Market search          | 2s    | 5s    | 8s    |
| Market search fallback | 50ms  | 100ms | 200ms |
| Recursion depth avg    | 2     | 4     | 5     |

---

## Session Isolation Test

```typescript
// CRITICAL: Verify no proposal leakage
test('softConfirmPendingT2 respects session boundaries', async () => {
  // Create session A with proposal
  const proposalA = await proposalService.createProposal({
    tenantId,
    sessionId: 'A',
    toolName: 'update_package',
    trustTier: 'T2',
  });

  // Try to soft-confirm in session B
  const confirmed = await proposalService.softConfirmPendingT2(tenantId, 'B', 'looks good');

  // Session B should NOT see proposal from session A
  expect(confirmed).not.toContain(proposalA.proposalId);
});
```

---

## Soft-Confirm Window Test

```typescript
// CRITICAL: Verify window per agent type
test('onboarding uses 5-minute soft-confirm window', async () => {
  const orchestrator = new AgentOrchestrator(prisma, {
    softConfirmWindowMs: 5 * 60 * 1000, // 5 minutes
  });

  const proposalId = await createProposal(tenantId, sessionId);

  // Wait 4:59
  await wait(4 * 60 * 1000 + 59 * 1000);

  const confirmed = await orchestrator.softConfirmPendingT2(tenantId, sessionId, 'looks good');

  // Should still be in window
  expect(confirmed).toContain(proposalId);
});
```

---

## Recursion Budget Test

```typescript
// CRITICAL: Verify T1 doesn't starve T2
test('T1 tools do not prevent T2 execution', async () => {
  const messages = [
    { role: 'user', content: 'get availability, customers, and pricing' },
    // Claude calls: get_availability (T1), get_customers (T1), get_pricing (T1) = 3 calls
  ];

  const response = await orchestrator.chat(tenantId, sessionId, 'book appointment');
  // Claude now calls: create_booking (T2)
  // Should succeed (not blocked by 3 T1 calls)

  expect(response.proposals).toBeDefined(); // T2 proposal created
});
```

---

## Deployment Checklist

- [ ] All 22 ambiguities classified (P0-P3)
- [ ] P0 issues fixed and tested
- [ ] Integration test suite passes
- [ ] Multi-tenant isolation verified
- [ ] Performance SLAs met
- [ ] Load test with concurrent users
- [ ] Security review completed
- [ ] Monitoring/alerting in place

---

**Last Updated**: 2025-12-31
**Status**: DRAFT - Awaiting prioritization
**Next**: Hold clarification meeting on decisions 1-3
