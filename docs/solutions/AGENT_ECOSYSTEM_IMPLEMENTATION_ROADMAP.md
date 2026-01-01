# Agent Ecosystem Implementation Roadmap

**Based on SpecFlow Analysis**
**Target**: Production-ready unified orchestrator by 2026-01-31

---

## Phase 0: Clarification & Decisions (5 days)

**Goal**: Resolve 4 architectural decisions, unblock Phase 1

### 0.1 Architecture Decisions Meeting (1 day)

**Participants**: Architect, 2 senior engineers
**Deliverable**: Decision document

**Decisions to make**:

1. **Unified vs. Separate Orchestrators**
   - [ ] Decision: UNIFIED / SEPARATE (choose one)
   - [ ] Reasoning documented
   - [ ] If unified: design base class
   - [ ] If separate: document exact differences

2. **Soft-Confirm Window Strategy**
   - [ ] Decision: GLOBAL / PER-AGENT / PER-PHASE (choose one)
   - [ ] Config structure designed
   - [ ] Examples: chatbot (30s), onboarding (5-10m), admin (2m)

3. **Recursion Budget Strategy**
   - [ ] Decision: GLOBAL / SEPARATE / WEIGHTED (choose one)
   - [ ] Depth calculation formula defined
   - [ ] Examples: T1=10, T2=3, T3=1 or weighted cost system

4. **Session Isolation Scope**
   - [ ] Decision: SESSION / AGENT-TYPE / TENANT (choose scope)
   - [ ] Proposal query pattern defined
   - [ ] Test strategy for cross-session contamination

**Success Criteria**:
- [ ] All 4 decisions documented
- [ ] Consensus from team (no veto)
- [ ] Proposed implementation sketched for each

### 0.2 Specification Clarification (2 days)

**Goal**: Write detailed spec for unified orchestrator

**Deliverables**:
- [ ] Orchestrator interface (base class or common pattern)
- [ ] Trust tier enforcement rules (decision tree)
- [ ] Soft-confirm window algorithm (with config)
- [ ] Recursion budget algorithm (with cost model)
- [ ] Error classification & retry logic
- [ ] Session lifecycle (create, resume, close)
- [ ] Proposal state machine (full diagram)

**Success Criteria**:
- [ ] 22 ambiguities reduced to 0 for Phase 1
- [ ] New developers can read spec and implement correctly
- [ ] No contradictions with existing code

### 0.3 Test Plan for Phase 1 (2 days)

**Goal**: Define integration tests that will verify fixes

**Deliverables**:
- [ ] Test fixtures (multi-tenant, multi-session setup)
- [ ] 8 critical integration tests outlined
- [ ] Mock utilities for agent/proposal/session
- [ ] Performance test harness
- [ ] Load test scenarios

**Success Criteria**:
- [ ] All P0/P1 tests designed
- [ ] Can be implemented in parallel with code

---

## Phase 1: Critical Fixes (P0/P1) (7 days)

**Goal**: Fix security & functionality issues blocking production

### 1.1 Session Isolation (1 day)

**Risk**: CRITICAL - Cross-session proposal execution

**Changes**:
```typescript
// File: server/src/agent/proposals/proposal.service.ts

// BEFORE: Missing sessionId filter
async softConfirmPendingT2(tenantId, sessionId, userMessage) {
  const proposals = await prisma.agentProposal.findMany({
    where: { tenantId, status: 'PENDING', trustTier: 'T2' },
  });
}

// AFTER: Add sessionId to query
async softConfirmPendingT2(tenantId, sessionId, userMessage) {
  const proposals = await prisma.agentProposal.findMany({
    where: {
      tenantId,
      sessionId,  // ← ADD THIS
      status: 'PENDING',
      trustTier: 'T2',
    },
  });
}
```

**Checklist**:
- [ ] Add sessionId filter to softConfirmPendingT2() query
- [ ] Add unique constraint on active sessions (tenantId, sessionType, active=true)
- [ ] Add test: concurrent session creation prevented
- [ ] Add test: proposal from session A not visible in session B
- [ ] Code review: all proposal queries check sessionId

**Files Changed**:
- `server/src/agent/proposals/proposal.service.ts` (5 lines)
- `server/prisma/schema.prisma` (1 constraint added)
- `server/test/agent/proposals/proposal-isolation.test.ts` (NEW - 3 tests)

**Estimated Time**: 1 day
**Blocker**: None
**Dependencies**: None

---

### 1.2 Soft-Confirm Window Configurability (2 days)

**Risk**: HIGH - Onboarding users lose confirmation

**Changes**:
```typescript
// File: server/src/agent/orchestrator/orchestrator.ts

// BEFORE: Hard-coded
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

// AFTER: Configurable
interface OrchestratorConfig {
  softConfirmWindowMs: number;  // Default 2 min, override per agent
}

// File: server/src/agent/proposals/proposal.service.ts

// BEFORE: Hard-coded in constructor
const T2_SOFT_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

// AFTER: Accept as parameter
constructor(
  private readonly prisma: PrismaClient,
  private readonly softConfirmWindowMs: number = 2 * 60 * 1000
) {}
```

**Checklist**:
- [ ] Make ProposalService accept window as parameter
- [ ] Make OrchestratorConfig include softConfirmWindowMs
- [ ] Update AgentOrchestrator to pass config
- [ ] Update CustomerOrchestrator to pass config
- [ ] Set defaults: onboarding (5-10m), chatbot (30s), admin (2m)
- [ ] Add test: onboarding respects 5-minute window
- [ ] Add test: chatbot respects 30-second window

**Files Changed**:
- `server/src/agent/orchestrator/orchestrator.ts` (5 lines)
- `server/src/agent/proposals/proposal.service.ts` (3 lines)
- `server/src/agent/customer/customer-orchestrator.ts` (2 lines)
- `server/test/agent/proposals/soft-confirm-window.test.ts` (NEW - 4 tests)

**Estimated Time**: 2 days
**Blocker**: Decision on window strategy
**Dependencies**: Phase 0.1 (decision)

---

### 1.3 Recursion Budget Separation (3 days)

**Risk**: HIGH - T1 tools block T2 execution

**Changes**:
```typescript
// File: server/src/agent/orchestrator/orchestrator.ts

// BEFORE: Single limit
const MAX_RECURSION_DEPTH = 5;

// AFTER: Separate budgets (Option B from spec)
interface RecursionBudget {
  T1: number;  // 10 - read tools cheap
  T2: number;  // 3 - write tools expensive
  T3: number;  // 1 - hard confirm very expensive
}

const DEFAULT_RECURSION_BUDGET: RecursionBudget = {
  T1: 10,
  T2: 3,
  T3: 1,
};

// Track per tier
async processResponse(
  ...
  budget: RecursionBudget = DEFAULT_RECURSION_BUDGET,
  tierCounts = { T1: 0, T2: 0, T3: 0 }
) {
  for (const toolUse of toolUseBlocks) {
    const trustTier = tool.trustTier;  // Get actual tier
    tierCounts[trustTier]++;

    if (tierCounts[trustTier] > budget[trustTier]) {
      return {
        finalMessage: `I've exhausted my capability for ${trustTier} operations.`
      };
    }
  }
}
```

**Checklist**:
- [ ] Add RecursionBudget interface
- [ ] Add tier tracking in processResponse()
- [ ] Update depth checks to use per-tier budgets
- [ ] Add tests: T1 + T2 + T3 in sequence (all succeed)
- [ ] Add test: T1x10 doesn't block T2
- [ ] Add test: T2x3 doesn't block T3
- [ ] Update customer orchestrator with correct budget
- [ ] Performance test: average tier usage

**Files Changed**:
- `server/src/agent/orchestrator/orchestrator.ts` (20 lines)
- `server/src/agent/customer/customer-orchestrator.ts` (5 lines)
- `server/test/agent/orchestrator/recursion-budget.test.ts` (NEW - 6 tests)

**Estimated Time**: 3 days
**Blocker**: Decision on budget strategy
**Dependencies**: Phase 0.1 (decision)

---

### 1.4 Tool Context Immutability (1 day)

**Risk**: MEDIUM - Tool side effects

**Changes**:
```typescript
// File: server/src/agent/orchestrator/orchestrator.ts

// BEFORE: Mutable
const toolContext: ToolContext = { tenantId, sessionId, prisma };

// AFTER: Frozen
const toolContext: ToolContext = Object.freeze({
  tenantId,
  sessionId,
  prisma,
});
```

**Checklist**:
- [ ] Freeze toolContext in orchestrator
- [ ] Freeze toolContext in customer-orchestrator
- [ ] Add TypeScript readonly types to ToolContext interface
- [ ] Test: attempt to mutate throws error
- [ ] Review all tool implementations for mutations (should fail)

**Files Changed**:
- `server/src/agent/orchestrator/orchestrator.ts` (2 lines)
- `server/src/agent/customer/customer-orchestrator.ts` (2 lines)
- `server/src/agent/tools/types.ts` (1 line - add readonly)
- `server/test/agent/tools/context-immutability.test.ts` (NEW - 2 tests)

**Estimated Time**: 1 day
**Blocker**: None
**Dependencies**: None

---

### 1.5 System Prompt Injection Fix (1 day)

**Risk**: MEDIUM - Security vulnerability

**Changes**:
```typescript
// File: server/src/agent/orchestrator/orchestrator.ts

// BEFORE: No sanitization
const systemPrompt = buildOnboardingSystemPrompt({
  businessName: tenant?.name || 'Your Business',
});

// AFTER: Sanitize user input
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\n\n/g, ' ')  // Prevent prompt section breaks
    .replace(/\\n/g, ' ')
    .substring(0, 100);     // Limit length
}

const systemPrompt = buildOnboardingSystemPrompt({
  businessName: sanitizeForPrompt(tenant?.name),
});
```

**Checklist**:
- [ ] Create sanitization utility
- [ ] Apply to all user-provided data in prompts
- [ ] Add fuzz test for injection attempts
- [ ] Code review: all user fields in prompts sanitized

**Files Changed**:
- `server/src/lib/prompt-utils.ts` (NEW - sanitize function)
- `server/src/agent/orchestrator/orchestrator.ts` (3 lines)
- `server/test/agent/security/prompt-injection.test.ts` (NEW - 5 tests)

**Estimated Time**: 1 day
**Blocker**: None
**Dependencies**: None

---

## Phase 2: Integration & Hardening (P2) (10 days)

**Goal**: Complete integration test suite, error handling, monitoring

### 2.1 Integration Test Suite (4 days)

**Tests to implement**:
1. Multi-tenant isolation (3 tests)
2. Proposal lifecycle (3 tests)
3. Session concurrency (2 tests)
4. Soft-confirm window (2 tests)
5. Recursion budgets (2 tests)
6. Tool execution timeout (2 tests)
7. Context cache (2 tests)
8. Error recovery (2 tests)

**Total**: 20 integration tests

**Checklist**:
- [ ] Create test fixtures (tenant + session + proposal + tools)
- [ ] Implement all 20 tests
- [ ] All tests pass
- [ ] Coverage report: 80%+ for critical paths

**Files Changed**:
- `server/test/integration/orchestrator/multi-tenant-isolation.test.ts` (NEW)
- `server/test/integration/orchestrator/proposal-lifecycle.test.ts` (NEW)
- `server/test/integration/orchestrator/session-concurrency.test.ts` (NEW)
- `server/test/integration/orchestrator/soft-confirm-window.test.ts` (NEW)
- `server/test/integration/orchestrator/recursion-budget.test.ts` (NEW)
- `server/test/integration/orchestrator/error-recovery.test.ts` (NEW)
- `server/test/fixtures/orchestrator-fixtures.ts` (NEW)

**Estimated Time**: 4 days
**Blocker**: Phase 1 complete
**Dependencies**: Phase 1.1-1.4

---

### 2.2 Error Classification & Retry Logic (3 days)

**Changes**:
```typescript
// File: server/src/agent/orchestrator/error-classifier.ts (NEW)

type ErrorType = 'VALIDATION' | 'RATE_LIMIT' | 'AUTH' | 'NETWORK' | 'UNKNOWN';

function classifyError(error: Error): ErrorType {
  if (error.message.includes('validation')) return 'VALIDATION';
  if (error.message.includes('rate limit')) return 'RATE_LIMIT';
  if (error.message.includes('401') || error.message.includes('403')) return 'AUTH';
  if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) return 'NETWORK';
  return 'UNKNOWN';
}

async function executeWithRetry(
  executor: () => Promise<unknown>,
  maxRetries: number = 3
): Promise<unknown> {
  const errorType = classifyError(error);

  // Only retry for transient errors
  if (['RATE_LIMIT', 'NETWORK'].includes(errorType)) {
    // Retry with exponential backoff
  } else {
    // Don't retry for validation/auth errors
    throw error;
  }
}
```

**Checklist**:
- [ ] Create error classifier
- [ ] Implement retry logic with exponential backoff
- [ ] Add tests: validation error doesn't retry
- [ ] Add tests: rate limit error retries
- [ ] Update orchestrator to use retry logic

**Files Changed**:
- `server/src/agent/orchestrator/error-classifier.ts` (NEW)
- `server/src/agent/orchestrator/orchestrator.ts` (5 lines)
- `server/test/agent/orchestrator/error-classification.test.ts` (NEW - 5 tests)

**Estimated Time**: 3 days
**Blocker**: None
**Dependencies**: None (parallel with 2.1)

---

### 2.3 Proposal State Machine Hardening (2 days)

**Changes**:
```typescript
// File: server/src/agent/proposals/proposal-state-machine.ts (NEW)

// Define valid transitions
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'FAILED', 'EXPIRED'],
  CONFIRMED: ['EXECUTED', 'FAILED'],
  EXECUTED: [],  // Terminal
  FAILED: [],    // Terminal
  EXPIRED: [],   // Terminal
};

async function transitionProposal(
  proposalId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  if (!VALID_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    throw new Error(`Invalid transition: ${fromStatus} → ${toStatus}`);
  }
  // ... apply transition
}
```

**Checklist**:
- [ ] Define complete state machine
- [ ] Implement transition validation
- [ ] Update all proposal operations to use state machine
- [ ] Add tests: invalid transitions rejected
- [ ] Add tests: concurrent transitions handled

**Files Changed**:
- `server/src/agent/proposals/proposal-state-machine.ts` (NEW)
- `server/src/agent/proposals/proposal.service.ts` (10 lines)
- `server/test/agent/proposals/state-machine.test.ts` (NEW - 4 tests)

**Estimated Time**: 2 days
**Blocker**: None
**Dependencies**: None (parallel with 2.1)

---

### 2.4 Monitoring & Observability (1 day)

**Changes**:
```typescript
// File: server/src/agent/orchestrator/metrics.ts (NEW)

export const metrics = {
  orchestratorChatDuration: new Histogram({
    name: 'orchestrator_chat_duration_ms',
    buckets: [100, 500, 1000, 3000, 5000],
  }),
  toolExecutionDuration: new Histogram({
    name: 'tool_execution_duration_ms',
    buckets: [100, 500, 1000, 3000, 5000],
  }),
  recursionDepthUsed: new Histogram({
    name: 'recursion_depth_used',
    buckets: [1, 2, 3, 4, 5],
  }),
  softConfirmWindowHits: new Counter({
    name: 'soft_confirm_window_hits',
    labels: ['tier', 'result'],  // T1/T2/T3, success/expired
  }),
};
```

**Checklist**:
- [ ] Create metrics collector
- [ ] Add instrumentation to orchestrator
- [ ] Add instrumentation to proposal service
- [ ] Add instrumentation to tools
- [ ] Create Grafana dashboard

**Files Changed**:
- `server/src/agent/orchestrator/metrics.ts` (NEW)
- `server/src/agent/orchestrator/orchestrator.ts` (5 lines)
- `server/src/agent/proposals/proposal.service.ts` (3 lines)

**Estimated Time**: 1 day
**Blocker**: None
**Dependencies**: None (parallel with 2.1)

---

## Phase 3: Architecture Unification (5 days)

**Goal**: Merge 3 orchestrators into unified base class (if decided in Phase 0)

### 3.1 Base Orchestrator Class (3 days)

**Only proceed if Phase 0 decided: UNIFIED**

**Changes**:
```typescript
// File: server/src/agent/orchestrator/base-orchestrator.ts (NEW)

export abstract class BaseOrchestrator {
  protected config: BaseOrchestratorConfig;
  protected proposalService: ProposalService;
  protected auditService: AuditService;

  constructor(protected readonly prisma: PrismaClient, config: Partial<BaseOrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.proposalService = new ProposalService(prisma, this.config.softConfirmWindowMs);
    this.auditService = new AuditService(prisma);
  }

  abstract buildToolsForAPI(includeOnboarding?: boolean): Tool[];
  abstract buildSystemPrompt(context: any): string;
  abstract getGreeting(tenantId: string): Promise<string>;

  async chat(tenantId: string, sessionId: string, userMessage: string): Promise<ChatResponse> {
    // Shared implementation with abstract methods for agent-specific behavior
  }
}

// Agent-specific subclasses
export class AgentOrchestrator extends BaseOrchestrator {
  buildToolsForAPI(includeOnboarding?: boolean): Tool[] {
    return includeOnboarding ? getAllToolsWithOnboarding() : getAllTools();
  }
  buildSystemPrompt(context: AgentSessionContext): string {
    return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', context.contextPrompt);
  }
}

export class CustomerOrchestrator extends BaseOrchestrator {
  buildToolsForAPI(): Tool[] {
    return CUSTOMER_TOOLS;
  }
  buildSystemPrompt(context: CustomerSessionContext): string {
    return buildCustomerSystemPrompt(context.businessName, context.businessContext);
  }
}
```

**Checklist**:
- [ ] Create BaseOrchestrator with shared logic
- [ ] Refactor AgentOrchestrator to extend base class
- [ ] Refactor CustomerOrchestrator to extend base class
- [ ] Update WeddingBookingOrchestrator (if exists)
- [ ] All tests pass
- [ ] Code coverage maintained

**Files Changed**:
- `server/src/agent/orchestrator/base-orchestrator.ts` (NEW - 200 lines)
- `server/src/agent/orchestrator/orchestrator.ts` (refactored - remove duplication)
- `server/src/agent/customer/customer-orchestrator.ts` (refactored - extend base)
- `server/test/agent/orchestrator/base-orchestrator.test.ts` (NEW - 4 tests)

**Estimated Time**: 3 days
**Blocker**: Phase 0.1 (decision)
**Dependencies**: Phase 1-2 complete

---

### 3.2 Config Centralization (1 day)

**Changes**:
```typescript
// File: server/src/agent/orchestrator/orchestrator-config.ts (NEW)

export interface OrchestratorConfig {
  model: string;
  maxTokens: number;
  maxHistoryMessages: number;
  temperature: number;
  softConfirmWindowMs: number;
  recursionBudget: {
    T1: number;
    T2: number;
    T3: number;
  };
  executorTimeoutMs: number;
  contextCacheTtlMs: number;
}

export const ORCHESTRATOR_PRESETS = {
  onboarding: {
    maxHistoryMessages: 30,
    softConfirmWindowMs: 5 * 60 * 1000,  // 5 minutes
    executorTimeoutMs: 10000,             // More time for complex operations
  },
  chatbot: {
    maxHistoryMessages: 10,
    softConfirmWindowMs: 30 * 1000,       // 30 seconds
    executorTimeoutMs: 5000,              // Fast execution
  },
  admin: {
    maxHistoryMessages: 20,
    softConfirmWindowMs: 2 * 60 * 1000,   // 2 minutes
    executorTimeoutMs: 5000,
  },
};
```

**Checklist**:
- [ ] Create centralized config
- [ ] Move preset configs
- [ ] Remove hard-coded values from orchestrators
- [ ] Test: config passed correctly

**Files Changed**:
- `server/src/agent/orchestrator/orchestrator-config.ts` (NEW)
- `server/src/agent/orchestrator/base-orchestrator.ts` (5 lines)

**Estimated Time**: 1 day
**Blocker**: Phase 3.1 complete
**Dependencies**: Phase 3.1

---

### 3.3 Migration of Legacy Orchestrators (1 day)

**If WeddingBookingOrchestrator exists**:
- [ ] Audit differences vs. base class
- [ ] Migrate to extend BaseOrchestrator
- [ ] Update tests
- [ ] Remove duplicate code

**Estimated Time**: 1 day (if exists)
**Blocker**: Phase 3.1 complete
**Dependencies**: Phase 3.1

---

## Phase 4: Optional Enhancements (5 days)

**Goal**: Nice-to-have features for production readiness

### 4.1 Circuit Breaker Implementation (2 days)

**Trigger**: 3+ consecutive tool failures in same session

**Changes**:
```typescript
// File: server/src/agent/orchestrator/circuit-breaker.ts (NEW)

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold = 3;
  private readonly resetTimeoutMs = 60000;  // 1 minute

  recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = new Date();
    }
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime!.getTime();
      if (elapsed > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      }
    }
    return this.state === 'OPEN';
  }
}
```

**Checklist**:
- [ ] Implement circuit breaker
- [ ] Add to orchestrator
- [ ] Return clear error message when open
- [ ] Add tests: circuit opens after 3 failures
- [ ] Add tests: circuit resets after timeout

**Estimated Time**: 2 days
**Blocker**: None
**Dependencies**: Phase 2 complete

---

### 4.2 Proposal Dependency Tracking (2 days)

**Use case**: Service design phase needs market research to complete

**Changes**:
```typescript
// File: server/src/agent/proposals/proposal.service.ts

export interface CreateProposalInput {
  tenantId: string;
  sessionId: string;
  toolName: string;
  operation: string;
  trustTier: AgentTrustTier;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
  dependsOn?: string[];  // ← NEW: proposal IDs this depends on
}

async createProposal(input: CreateProposalInput): Promise<ProposalResult> {
  // ... validate dependencies exist and are in EXECUTED state
  const proposal = await prisma.agentProposal.create({
    data: {
      ...input,
      dependencyIds: input.dependsOn || [],  // Store as JSON
    },
  });
}
```

**Checklist**:
- [ ] Add dependency tracking to proposal model
- [ ] Validate dependencies on creation
- [ ] Verify dependencies on soft-confirm
- [ ] Test: dependent proposal waits for dependency
- [ ] Test: dependency failure blocks dependent

**Estimated Time**: 2 days
**Blocker**: None
**Dependencies**: Phase 2 complete

---

### 4.3 Message History Summarization (1 day)

**Use case**: Users can reference day 1 context on day 3

**Changes**:
```typescript
// File: server/src/agent/orchestrator/history-summarizer.ts (NEW)

async function summarizeOldMessages(
  messages: ChatMessage[],
  keepRecent: number = 10
): Promise<string> {
  if (messages.length <= keepRecent) return '';

  const oldMessages = messages.slice(0, -keepRecent);

  // Use Claude to summarize
  const summary = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    system: 'Summarize this conversation in 2-3 sentences.',
    messages: oldMessages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  return summary.content[0].type === 'text' ? summary.content[0].text : '';
}
```

**Checklist**:
- [ ] Create summarizer utility
- [ ] Add to orchestrator before buildHistoryMessages()
- [ ] Include summary in system prompt
- [ ] Test: old context preserved
- [ ] Monitor: summary quality

**Estimated Time**: 1 day
**Blocker**: None
**Dependencies**: Phase 1-2 complete

---

## Timeline Summary

| Phase | Duration | Start | End | Blocker |
|-------|----------|-------|-----|---------|
| Phase 0: Decisions | 5 days | 2026-01-01 | 2026-01-05 | None |
| Phase 1: Critical Fixes | 7 days | 2026-01-06 | 2026-01-12 | Phase 0 |
| Phase 2: Integration | 10 days | 2026-01-13 | 2026-01-22 | Phase 1 |
| Phase 3: Unification | 5 days | 2026-01-23 | 2026-01-27 | Phase 0, Phase 2 |
| Phase 4: Optional | 5 days | 2026-01-28 | 2026-02-01 | Phase 2 |
| **TOTAL** | **32 days** | 2026-01-01 | 2026-02-01 | - |

---

## Success Criteria by Phase

### Phase 0
- [ ] All 4 decisions documented
- [ ] Team consensus on spec
- [ ] Test plan approved
- [ ] No ambiguities remain for Phase 1

### Phase 1
- [ ] All P0/P1 bugs fixed
- [ ] Session isolation verified
- [ ] Soft-confirm window working per agent
- [ ] Recursion budget separated
- [ ] Security review passed
- [ ] All unit tests pass

### Phase 2
- [ ] 20 integration tests pass
- [ ] Error classification working
- [ ] Proposal state machine enforced
- [ ] Monitoring in place
- [ ] Load tested with 100 concurrent users

### Phase 3
- [ ] BaseOrchestrator in place
- [ ] All orchestrators extend base
- [ ] Zero code duplication
- [ ] All tests still pass
- [ ] No performance regression

### Phase 4
- [ ] Circuit breaker working
- [ ] Proposal dependencies tracked
- [ ] Message history summarization working
- [ ] Documentation complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Phase 0 decisions blocked | LOW | HIGH | Escalate to architect |
| Phase 1 breaks existing code | MEDIUM | MEDIUM | Comprehensive testing |
| Phase 2 test suite incomplete | MEDIUM | LOW | Allocate extra buffer |
| Phase 3 refactoring takes longer | MEDIUM | MEDIUM | Implement 80% of base class |
| Performance regression | LOW | MEDIUM | Benchmark before/after |

---

## Testing Strategy

**Unit Tests** (Phase 1-2):
- 50+ new unit tests
- Focus on: session isolation, soft-confirm window, recursion budget
- 90%+ coverage for critical paths

**Integration Tests** (Phase 2):
- 20+ integration tests
- Focus on: multi-tenant, proposal lifecycle, concurrency
- Using test database

**Load Tests** (Phase 2):
- 100 concurrent users
- 1000 messages/second throughput
- Monitor latency p95 < 3s

**E2E Tests** (Phase 3):
- Full user journeys per agent type
- Onboarding: 4-step complete flow
- Chatbot: book appointment with T3 confirm
- Admin: create/update/delete operations

---

## Deployment Plan

### Pre-deployment
- [ ] Code review: architecture decisions
- [ ] Code review: all Phase 1 changes
- [ ] Security audit: session isolation, prompt injection
- [ ] Performance test: load test passes
- [ ] Staging test: full flow works

### Deployment
- [ ] Feature flag: new orchestrator logic
- [ ] Canary: 10% of traffic to Phase 1 changes
- [ ] Monitoring: metrics dashboard live
- [ ] Rollback plan: revert feature flag

### Post-deployment
- [ ] Monitor error rates (target: <0.1%)
- [ ] Monitor latency (target: p95 < 3s)
- [ ] Gather user feedback
- [ ] Weekly retrospective

---

## Resource Requirements

| Role | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|------|---------|---------|---------|---------|---------|-------|
| Architect | 3d | - | - | 2d | - | 5d |
| Sr. Engineer | 2d | 3d | 5d | 3d | - | 13d |
| Engineer | - | 5d | 7d | 2d | 3d | 17d |
| QA/Test | 1d | 2d | 3d | 1d | 1d | 8d |
| **Total** | **6d** | **10d** | **15d** | **8d** | **4d** | **43d** |

---

## Acceptance Sign-Off

Phase completion requires:
1. All acceptance criteria met
2. Code review approved
3. Tests passing
4. Architecture review (for Phase 0, 3)
5. Product sign-off (for Phase 4)

---

**Document Status**: READY FOR EXECUTION
**Last Updated**: 2025-12-31
**Next Step**: Kickoff meeting for Phase 0
