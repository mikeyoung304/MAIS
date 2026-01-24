# fix: T2 Onboarding Proposals Never Execute

**Status:** Ready for Implementation
**Priority:** P1 (Critical)
**Type:** Bug Fix
**Estimated Complexity:** Medium
**Date:** 2025-12-31

---

## Overview

T2 proposals created by `upsert_services` during onboarding are never executed. The AI claims packages were created, but only the default 3 packages ($0 each) remain. This is a critical flow issue affecting the core onboarding experience.

---

## Problem Statement

### Observed Symptoms

1. **T2 Proposals Never Execute** - AI claims packages were created, but database shows only default packages
2. **Phase Advances Prematurely** - Onboarding shows "Market Research (2/4)" even though packages weren't created
3. **Excessive `update_onboarding_state` Calls** - AI calls T1 tool 4 times in one turn, consuming recursion depth
4. **Empty Message Content** - When Claude executes tools without text response, empty string stored in history causes API errors

### Evidence from Testing

```
Database: 2 PENDING upsert_services proposals exist but never execute
UI: Onboarding progress shows phase 2, but no packages created
Logs: No "Package created via agent" log messages
```

---

## Root Cause Analysis

### Issue 1: Session ID Mismatch or 2-Minute Window Expiry

The `softConfirmPendingT2()` method filters by:

- `tenantId` (correct)
- `sessionId` (potential mismatch)
- `createdAt >= (now - 2 minutes)` ← **Window may expire**

**Hypothesis A:** Session ID changes between proposal creation and next message

- If client sends invalid sessionId → new session created → proposals orphaned

**Hypothesis B:** 2-minute window too short for onboarding

- User reads AI's response, thinks, types slowly → window expires
- Proposals remain PENDING forever

### Issue 2: Phase Advances Before Execution

```
Current Flow:
update_onboarding_state (T1) → Auto-confirms → Executes → Phase advances
upsert_services (T2) → Creates PENDING proposal → Never soft-confirmed → Never executes

Result: Phase shows progress, but no actual packages created
```

### Issue 3: Recursion Depth Consumed by T1 Tool

```
Recursion Depth: MAX = 5
Claude Turn 1: update_onboarding_state (T1) → Depth 1
Claude Turn 2: update_onboarding_state (T1) → Depth 2
Claude Turn 3: update_onboarding_state (T1) → Depth 3
Claude Turn 4: update_onboarding_state (T1) → Depth 4
Claude Turn 5: (limit reached) → No room for upsert_services

Result: AI calls T1 metadata tool excessively, leaving no room for T2 write tools
```

### Issue 4: Empty Message Content (Already Fixed)

```typescript
// Fixed at orchestrator.ts:777-778
const messageContent =
  finalMessage || (toolResults && toolResults.length > 0 ? '[Tools executed]' : 'Done.');
```

---

## Proposed Solution

### Phase 1: Debug and Validate Root Cause

**Goal:** Confirm whether the issue is session ID mismatch or 2-minute window expiry

#### Task 1.1: Add Diagnostic Logging to Soft-Confirm

**File:** `server/src/agent/proposals/proposal.service.ts`

```typescript
// In softConfirmPendingT2(), after the query
async softConfirmPendingT2(
  tenantId: string,
  sessionId: string,
  userMessage: string
): Promise<string[]> {
  const now = new Date();
  const softConfirmCutoff = new Date(now.getTime() - T2_SOFT_CONFIRM_WINDOW_MS);

  // DEBUG: Log what we're querying for
  logger.debug({
    tenantId,
    sessionId,
    softConfirmCutoff: softConfirmCutoff.toISOString(),
    now: now.toISOString(),
  }, 'T2 soft-confirm query params');

  const proposals = await this.prisma.agentProposal.findMany({
    where: {
      tenantId,
      sessionId,
      status: 'PENDING',
      trustTier: 'T2',
      expiresAt: { gt: now },
      createdAt: { gte: softConfirmCutoff },
    },
  });

  // DEBUG: Log results
  logger.debug({
    tenantId,
    sessionId,
    foundCount: proposals.length,
    proposals: proposals.map(p => ({
      id: p.id,
      toolName: p.toolName,
      createdAt: p.createdAt.toISOString(),
      sessionId: p.sessionId,
    })),
  }, 'T2 soft-confirm query results');

  // Also query without createdAt filter to see all pending T2
  const allPendingT2 = await this.prisma.agentProposal.findMany({
    where: {
      tenantId,
      sessionId,
      status: 'PENDING',
      trustTier: 'T2',
      expiresAt: { gt: now },
    },
  });

  if (allPendingT2.length > proposals.length) {
    logger.warn({
      tenantId,
      sessionId,
      outsideWindowCount: allPendingT2.length - proposals.length,
      outsideWindowProposals: allPendingT2
        .filter(p => !proposals.some(q => q.id === p.id))
        .map(p => ({
          id: p.id,
          toolName: p.toolName,
          createdAt: p.createdAt.toISOString(),
          ageSeconds: (now.getTime() - p.createdAt.getTime()) / 1000,
        })),
    }, 'T2 proposals exist but are OUTSIDE the 2-minute window');
  }

  // ... rest of method
}
```

#### Task 1.2: Add Session ID to API Response

**File:** `server/src/routes/agent.routes.ts`

```typescript
// In the proposals endpoint (lines 780-784), add sessionId to response
const proposalsDto = proposals.map((p) => ({
  id: p.id,
  toolName: p.toolName,
  operation: p.operation,
  status: p.status,
  createdAt: p.createdAt.toISOString(),
  sessionId: p.sessionId, // ADD THIS
}));
```

### Phase 2: Extend Soft-Confirm Window for Onboarding

**Rationale:** 2 minutes is appropriate for quick customer chatbot interactions, but onboarding requires more thought time.

#### Task 2.1: Add Onboarding-Specific Window

**File:** `server/src/agent/proposals/proposal.service.ts`

```typescript
/**
 * T2 soft-confirm window for customer chatbot (2 minutes)
 * Short window for quick interactions
 */
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

/**
 * T2 soft-confirm window for onboarding (10 minutes)
 * Longer window because users need time to read and respond to AI suggestions
 */
const T2_ONBOARDING_SOFT_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

/**
 * Auto-confirm T2 proposals for a session
 * @param isOnboarding - If true, uses extended 10-minute window
 */
async softConfirmPendingT2(
  tenantId: string,
  sessionId: string,
  userMessage: string,
  isOnboarding: boolean = false  // NEW PARAMETER
): Promise<string[]> {
  // ... rejection keyword check ...

  const windowMs = isOnboarding
    ? T2_ONBOARDING_SOFT_CONFIRM_WINDOW_MS
    : T2_SOFT_CONFIRM_WINDOW_MS;

  const softConfirmCutoff = new Date(Date.now() - windowMs);

  // ... rest of method
}
```

#### Task 2.2: Pass Onboarding Flag from Orchestrator

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
// In chat() method, around line 519
const isOnboarding = this.mode === 'onboarding';

const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId,
  userMessage,
  isOnboarding // Pass the flag
);
```

### Phase 3: Reduce Excessive update_onboarding_state Calls

**Goal:** Prevent T1 metadata tool from consuming all recursion depth

#### Task 3.1: Add Rate Limiting Guidance to System Prompt

**File:** `server/src/agent/prompts/onboarding-system-prompt.ts`

```typescript
// Add to the system prompt (around line 290)
const PHASE_TRANSITION_GUIDANCE = `
**Phase Transitions:**
When you have the data needed for a phase, save it and move on.

**CRITICAL: Call \`update_onboarding_state\` ONLY ONCE per phase transition.**
Do NOT call it multiple times in a single conversation turn.
If you need to both update phase AND create services, prioritize \`upsert_services\` first,
then call \`update_onboarding_state\` once at the end.

**Tool Priority Order:**
1. First: \`upsert_services\` or \`update_storefront\` (T2 - creates real data)
2. Then: \`update_onboarding_state\` (T1 - updates metadata) - ONCE only

**If They Want to Skip:**
Use \`update_onboarding_state\` with phase: "SKIPPED". Respect their choice.
`;
```

#### Task 3.2: Track T1 Calls Per Turn (Optional Enhancement)

**File:** `server/src/agent/orchestrator/orchestrator.ts`

```typescript
// Add tool call counter to prevent excessive T1 calls
interface ToolCallTracker {
  [toolName: string]: number;
}

private toolCallsThisTurn: ToolCallTracker = {};

// In the tool execution loop
private async executeToolCall(toolName: string, ...): Promise<ToolResult> {
  // Track calls per tool
  this.toolCallsThisTurn[toolName] = (this.toolCallsThisTurn[toolName] || 0) + 1;

  // Warn if update_onboarding_state called more than once
  if (toolName === 'update_onboarding_state' && this.toolCallsThisTurn[toolName] > 1) {
    logger.warn(
      { tenantId, callCount: this.toolCallsThisTurn[toolName] },
      'update_onboarding_state called multiple times in single turn'
    );
  }

  // Execute tool...
}

// Reset at start of each chat() call
async chat(...): Promise<...> {
  this.toolCallsThisTurn = {};
  // ...
}
```

### Phase 4: Ensure Execution After Soft-Confirm

**Goal:** Verify the execution loop is working correctly after soft-confirm

#### Task 4.1: Add Execution Logging

**File:** `server/src/agent/orchestrator/orchestrator.ts`

The execution loop already exists (lines 528-676), but add visibility:

```typescript
// After soft-confirm, before execution loop
if (softConfirmedIds.length > 0) {
  logger.info(
    {
      tenantId,
      sessionId,
      count: softConfirmedIds.length,
      proposalIds: softConfirmedIds,
    },
    'Starting T2 proposal execution after soft-confirm'
  );
}

// After execution completes
logger.info(
  {
    tenantId,
    sessionId,
    successCount: successfulExecutions,
    failCount: failedExecutions,
  },
  'T2 proposal execution complete'
);
```

#### Task 4.2: Verify Executor Registration

**File:** `server/src/agent/executors/onboarding-executors.ts`

Ensure `upsert_services` is registered at startup:

```typescript
// Should be called from server initialization
export function registerOnboardingExecutors(): void {
  registerProposalExecutor('upsert_services', async (tenantId, payload) => {
    // ... implementation
  });

  logger.info('Onboarding executors registered: upsert_services');
}
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] T2 proposals created during onboarding are executed within 10 minutes
- [ ] Packages are actually created in database after `upsert_services` execution
- [ ] Phase transitions only happen AFTER corresponding data is created
- [ ] `update_onboarding_state` is not called more than once per phase transition

### Non-Functional Requirements

- [ ] Debug logging can be enabled/disabled via log level
- [ ] Existing customer chatbot flow (2-minute window) is unchanged
- [ ] No new security vulnerabilities introduced

### Quality Gates

- [ ] All existing agent tests pass
- [ ] New tests added for extended soft-confirm window
- [ ] Manual E2E test: Create new tenant → Complete onboarding → Verify packages created

---

## Testing Plan

### Unit Tests

**File:** `server/test/agent/proposals/proposal.service.test.ts`

```typescript
describe('softConfirmPendingT2 with onboarding flag', () => {
  it('uses 2-minute window when isOnboarding=false', async () => {
    // Create proposal 3 minutes ago
    const proposal = await createProposal({ createdAt: threeMinutesAgo });

    const result = await service.softConfirmPendingT2(
      tenantId,
      sessionId,
      'ok',
      false // Not onboarding
    );

    expect(result).toHaveLength(0); // Outside 2-minute window
  });

  it('uses 10-minute window when isOnboarding=true', async () => {
    // Create proposal 5 minutes ago
    const proposal = await createProposal({ createdAt: fiveMinutesAgo });

    const result = await service.softConfirmPendingT2(
      tenantId,
      sessionId,
      'ok',
      true // Is onboarding
    );

    expect(result).toHaveLength(1); // Inside 10-minute window
  });
});
```

### Integration Tests

**File:** `server/test/integration/onboarding-flow.spec.ts`

```typescript
describe('Onboarding T2 proposal execution', () => {
  it('executes upsert_services proposal on next message', async () => {
    // 1. Start onboarding session
    const session = await orchestrator.getOrCreateSession(tenantId);

    // 2. Send message that triggers upsert_services
    await orchestrator.chat(
      tenantId,
      session.sessionId,
      'Create photography packages: Basic $200, Standard $400, Premium $800'
    );

    // 3. Wait for proposal creation (check it's PENDING)
    const pendingProposals = await prisma.agentProposal.findMany({
      where: { tenantId, sessionId: session.sessionId, status: 'PENDING' },
    });
    expect(pendingProposals.length).toBeGreaterThan(0);

    // 4. Send follow-up message (triggers soft-confirm)
    await orchestrator.chat(tenantId, session.sessionId, 'That looks great!');

    // 5. Verify proposal was executed
    const executedProposals = await prisma.agentProposal.findMany({
      where: { tenantId, sessionId: session.sessionId, status: 'EXECUTED' },
    });
    expect(executedProposals.length).toBe(pendingProposals.length);

    // 6. Verify packages were created
    const packages = await prisma.package.findMany({
      where: { tenantId, name: { in: ['Basic', 'Standard', 'Premium'] } },
    });
    expect(packages.length).toBe(3);
  });
});
```

### Manual E2E Test

1. Create new tenant via `/signup`
2. Navigate to `/tenant/dashboard`
3. Click "Get Started" in Growth Assistant
4. Describe business: "I'm a wedding photographer in Austin"
5. AI suggests packages → Verify proposal created (check logs)
6. Send: "That looks perfect, let's do it"
7. Verify in Prisma Studio:
   - Proposal status = EXECUTED
   - New segment created
   - New packages created with correct prices

---

## Files to Modify

| File                                                   | Changes                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `server/src/agent/proposals/proposal.service.ts`       | Add `isOnboarding` param, extend window, add debug logging |
| `server/src/agent/orchestrator/orchestrator.ts`        | Pass `isOnboarding` flag, add execution logging            |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | Add rate limiting guidance for `update_onboarding_state`   |
| `server/src/routes/agent.routes.ts`                    | Add `sessionId` to proposals API response                  |
| `server/test/agent/proposals/proposal.service.test.ts` | Add tests for extended window                              |
| `server/test/integration/onboarding-flow.spec.ts`      | Add E2E test for full proposal lifecycle                   |

---

## Rollback Plan

If issues arise:

1. Remove `isOnboarding` parameter (default to original 2-minute window)
2. Remove rate limiting guidance from system prompt
3. Keep debug logging for future diagnosis

---

## Related Documentation

- [Chatbot Proposal Execution Flow](../docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
- [Phase 5 Testing and Caching Prevention](../docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [Circular Dependency Executor Registry](../docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md)
- [Agent Tool Architecture Prevention Strategies](../docs/solutions/agent-design/AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md)

---

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **Context-appropriate timeouts matter** - Customer chat (quick) vs onboarding (thoughtful) need different windows. The 2-minute window is correct for transactional interactions but too aggressive for onboarding flows where users need time to read and consider suggestions.

2. **T1 tools can starve T2 tools** - When T1 (auto-confirm) tools consume recursion depth, T2 (soft-confirm) tools never get a chance. This is a form of resource starvation that's easy to miss because T1 tools appear successful.

3. **State changes need their side effects** - The pattern of "update status" without "trigger executor" is a common failure mode. Every state machine transition should explicitly invoke its side effects.

4. **Observe before fixing** - The diagnostic logging in Phase 1 is critical. We hypothesize the 2-minute window is the issue, but it could also be session ID mismatch. Adding observability first prevents wasted effort.

`─────────────────────────────────────────────────`

---

**Author:** Claude Code
**Created:** 2025-12-31
**Last Updated:** 2025-12-31
