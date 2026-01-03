# Agent Evaluation System - Comprehensive Code Review Analysis

**Date:** 2026-01-02
**Reviewers:** 7 specialized agents (Security, Architecture, Performance, Data Integrity, Code Quality, TypeScript, Simplicity)
**Status:** Implementation Complete, Integration Pending
**Todo Files Created:** 580-600 in `todos/` directory

---

## Executive Summary

The Agent Evaluation System implements Phases 1, 2, 3, and 5 of `plans/agent-evaluation-system.md`. The implementation demonstrates strong architectural patterns, comprehensive documentation, and thoughtful error handling. However, **critical findings prevent production readiness**:

1. **P1-581: Broken promise cleanup logic** - Memory leak due to synchronous check of async state
2. **P1-586: ~800 lines of dead code** - Modules are implemented but never integrated
3. **P1-580: Missing tenant isolation** - Security violation in `getUnevaluatedTraces()`
4. **P1-583: DI violations** - Evaluator hardcodes API key, breaking testability

**Recommendation:** Resolve P1 issues before proceeding to Phase 6/7. Consider whether to wire up the feedback module or defer it.

---

## Table of Contents

1. [What Was Built](#1-what-was-built)
2. [Architecture Overview](#2-architecture-overview)
3. [Positive Patterns Observed](#3-positive-patterns-observed)
4. [Critical Findings (P1)](#4-critical-findings-p1)
5. [Important Findings (P2)](#5-important-findings-p2)
6. [Minor Findings (P3)](#6-minor-findings-p3)
7. [Finding Dependencies & Remediation Order](#7-finding-dependencies--remediation-order)
8. [Implementation Guidance](#8-implementation-guidance)

---

## 1. What Was Built

### Phase 1: Observability Foundation (Complete)

**Location:** `server/src/agent/tracing/`

| File                       | Purpose                                           | Lines |
| -------------------------- | ------------------------------------------------- | ----- |
| `tracer.ts`                | ConversationTracer with fire-and-forget writes    | 568   |
| `types.ts`                 | TracedMessage, TracedToolCall, TraceMetrics types | 214   |
| `encryption-middleware.ts` | Prisma extension for AES-256-GCM encryption       | ~100  |
| `index.ts`                 | Barrel exports                                    | 37    |

**Key Features:**

- Lazy initialization (trace created on first message)
- Fire-and-forget database writes using `setImmediate()`
- Automatic flagging for anomalies (high turn count, high latency)
- Size limits with truncation (50KB messages, 100KB toolCalls)
- 90-day retention via `expiresAt` column
- Cost estimation using per-model token pricing

### Phase 2: LLM-as-Judge Evaluation (Complete)

**Location:** `server/src/agent/evals/`

| File               | Purpose                                      | Lines |
| ------------------ | -------------------------------------------- | ----- |
| `evaluator.ts`     | ConversationEvaluator using Claude Haiku     | 365   |
| `pipeline.ts`      | EvalPipeline with sampling, PII redaction    | 394   |
| `calibration.ts`   | 5 golden conversations for evaluator testing | 337   |
| `rubrics/index.ts` | Evaluation dimensions, scoring weights       | 408   |
| `index.ts`         | Barrel exports                               | 37    |

**Key Features:**

- LLM-as-Judge pattern using `claude-haiku-35-20241022`
- 3 evaluation dimensions: Effectiveness (40%), Experience (30%), Safety (30%)
- PII redaction before sending to evaluator (email, phone, SSN, address, name)
- Zod schema validation of LLM responses
- Fallback parsing for malformed responses
- 10% sampling rate for cost control

### Phase 3: Multi-turn Scenario Testing (Complete)

**Location:** `server/test/agent-eval/scenarios/`

| File                        | Purpose                                         | Lines |
| --------------------------- | ----------------------------------------------- | ----- |
| `types.ts`                  | ConversationScenario, ScenarioResult interfaces | 255   |
| `runner.ts`                 | ScenarioRunner with timeout, metrics            | 400   |
| `scenarios.test.ts`         | Test harness for all scenarios                  | 150   |
| `customer/*.scenario.ts`    | Customer agent scenarios                        | ~200  |
| `onboarding/*.scenario.ts`  | Onboarding agent scenarios                      | ~150  |
| `adversarial/*.scenario.ts` | Security/injection scenarios                    | ~100  |

**Key Features:**

- Turn-by-turn expectations with assertions
- Mock tool responses for deterministic testing
- Priority levels (critical, high, medium, low)
- Category tagging (happy-path, edge-case, adversarial)
- Timeout handling per turn

### Phase 5: Production Feedback Loop (Complete, NOT Integrated)

**Location:** `server/src/agent/feedback/`

| File                | Purpose                                               | Lines |
| ------------------- | ----------------------------------------------------- | ----- |
| `implicit.ts`       | ImplicitFeedbackAnalyzer (retry, sentiment detection) | 258   |
| `review-queue.ts`   | ReviewQueue for flagged conversations                 | 387   |
| `review-actions.ts` | ReviewActionService for tracking actions              | 335   |
| `index.ts`          | Barrel exports                                        | 37    |

**Key Features:**

- Implicit signal detection (Jaccard similarity for retries)
- Satisfaction scoring algorithm
- Tenant-scoped review queue
- PII redaction for reviewer privacy
- Action tracking (approve, reject, escalate, retrain, prompt_updated, bug_filed)

### Database Schema Additions

```prisma
// ConversationTrace - ~60 fields for full observability
model ConversationTrace {
  id                 String    @id @default(cuid())
  tenantId           String
  sessionId          String
  agentType          String    // 'customer' | 'onboarding' | 'admin'
  messages           Json      // ENCRYPTED via Prisma middleware
  toolCalls          Json      // ENCRYPTED
  evalScore          Float?    // 0-10 overall score
  evalDimensions     Json?     // { effectiveness, experience, safety }
  flagged            Boolean   @default(false)
  flagReason         String?
  expiresAt          DateTime? // 90-day retention
  // ... more fields
}

// AgentUsage - Token tracking per call
// UserFeedback - Explicit ratings
// ReviewAction - Human review outcomes
```

---

## 2. Architecture Overview

### Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROUTES LAYER                            │
│  (NOT IMPLEMENTED - platform-admin-traces.routes.ts not wired)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES LAYER                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ EvalPipeline │  │ ReviewQueue  │  │ ReviewActionService  │  │
│  │   (UNUSED)   │  │   (UNUSED)   │  │       (UNUSED)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│          │                │                    │                │
│          └────────────────┼────────────────────┘                │
│                           ▼                                     │
│              ┌───────────────────────┐                          │
│              │ ConversationEvaluator │                          │
│              │       (UNUSED)        │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TRACING LAYER                             │
│                                                                 │
│  ┌────────────────────┐     ┌─────────────────────────┐        │
│  │ ConversationTracer │────▶│ encryption-middleware   │        │
│  │     (IN USE)       │     │     (IN USE)            │        │
│  └────────────────────┘     └─────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PRISMA LAYER                             │
│  ConversationTrace │ AgentUsage │ UserFeedback │ ReviewAction   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow (Intended, Not Yet Wired)

```
1. Orchestrator calls tracer.initialize()
2. Each message → tracer.recordUserMessage() / recordAssistantResponse()
3. Tool calls → tracer.recordToolCall()
4. Conversation ends → tracer.finalize() → persist to DB
5. [NOT IMPLEMENTED] Cron job → EvalPipeline.processBatch()
6. [NOT IMPLEMENTED] EvalPipeline samples trace → Evaluator.evaluate()
7. [NOT IMPLEMENTED] Flagged traces → ReviewQueue
8. [NOT IMPLEMENTED] Human reviews → ReviewActionService
```

---

## 3. Positive Patterns Observed

### 3.1 Fire-and-Forget Async Writes (tracer.ts:313-351)

The tracer correctly implements non-blocking writes to avoid impacting response latency:

```typescript
// tracer.ts:322-335
const writePromise = new Promise<void>((resolve) => {
  setImmediate(async () => {
    try {
      await this.persistState(state);
    } catch (error) {
      logger.error({ error: sanitizeError(error) }, 'Failed to persist trace state');
    }
    resolve();
  });
});
```

**Why this is good:** User-facing response returns immediately. Database writes happen in the background. Errors are logged but don't crash the request.

### 3.2 Zod Schema Validation for LLM Output (evaluator.ts:234)

```typescript
// evaluator.ts:234
const validated = EvalResultSchema.parse(parsed);
```

**Why this is good:** LLM output is unpredictable. Runtime validation catches malformed responses before they corrupt database state.

### 3.3 Fallback Parsing for Malformed Responses (evaluator.ts:264-319)

```typescript
// When JSON parsing fails, extract scores via regex
private extractScoresWithFallback(responseText: string): EvalResult {
  const effectivenessMatch = responseText.match(
    /effectiveness[^}]*"score"\s*:\s*(\d+(?:\.\d+)?)/i
  );
  // ...
}
```

**Why this is good:** LLMs sometimes return slightly malformed JSON. Fallback parsing recovers partial data instead of failing completely.

### 3.4 Tenant Isolation in Feedback Services

```typescript
// review-actions.ts:96-103
async recordAction(tenantId: string, input: ReviewActionInput): Promise<ReviewAction> {
  // P0 Security: Validate trace belongs to tenant
  const trace = await this.prisma.conversationTrace.findFirst({
    where: { id: input.traceId, tenantId },  // ✅ Tenant scoped
  });

  if (!trace) {
    throw new Error('Trace not found or access denied');
  }
  // ...
}
```

**Why this is good:** All feedback services correctly enforce tenant boundaries, preventing cross-tenant data access.

### 3.5 Factory Functions for DI Compatibility

Every class has a corresponding factory function:

```typescript
export function createTracer(
  prisma: PrismaClient,
  config?: Partial<TracerConfig>
): ConversationTracer;
export function createEvaluator(config?: Partial<EvaluatorConfig>): ConversationEvaluator;
export function createEvalPipeline(
  prisma: PrismaClient,
  config?: Partial<PipelineConfig>
): EvalPipeline;
export function createReviewQueue(prisma: PrismaClient): ReviewQueue;
```

**Why this is good:** Enables dependency injection in tests and `di.ts` wiring.

### 3.6 Comprehensive Documentation

Every file has JSDoc headers explaining purpose, usage, and references:

```typescript
/**
 * Evaluation Pipeline
 *
 * Handles the evaluation workflow for conversation traces:
 * 1. Sampling (10% default to control costs)
 * 2. PII redaction before sending to evaluator
 * 3. Async evaluation with result persistence
 * 4. Flagging and review queue population
 *
 * @see plans/agent-evaluation-system.md Phase 2.3
 */
```

### 3.7 Size Limits and Truncation (tracer.ts:473-522)

```typescript
private truncateMessages(messages: TracedMessage[]): TracedMessage[] {
  const jsonSize = JSON.stringify(messages).length;
  if (jsonSize <= MAX_MESSAGES_SIZE) {
    return messages;
  }
  // Keep first 5 + last N messages
  // ...
}
```

**Why this is good:** Prevents storage blowout from verbose conversations. Keeps context (first 5) and recent history.

### 3.8 Error Sanitization Throughout

```typescript
logger.error({ error: sanitizeError(error) }, 'Operation failed');
```

**Why this is good:** `sanitizeError()` strips stack traces and sensitive data before logging, preventing accidental PII/credential exposure.

---

## 4. Critical Findings (P1)

### P1-580: Missing Tenant Scoping in EvalPipeline

**File:** `server/src/agent/evals/pipeline.ts`
**Lines:** 206-208, 260-275
**Todo:** `todos/580-open-p1-missing-tenant-scoping-evalpipeline.md`

**The Bug:**

```typescript
// pipeline.ts:206-208 - submit() uses findUnique without tenant
const trace = await this.prisma.conversationTrace.findUnique({
  where: { id: traceId },  // ❌ No tenantId check
});

// pipeline.ts:260-272 - getUnevaluatedTraces() returns ALL tenants
async getUnevaluatedTraces(limit: number = 100): Promise<string[]> {
  const traces = await this.prisma.conversationTrace.findMany({
    where: {
      evalScore: null,
      // ❌ No tenantId filter - scans entire table!
      startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    // ...
  });
}
```

**Why It's Critical:**

1. `submit()` allows evaluating traces from other tenants if traceId is guessable
2. `getUnevaluatedTraces()` returns traces across ALL tenants - violates MAIS multi-tenant isolation
3. A single tenant running evaluation could trigger LLM calls for other tenants' data

**Root Cause:** The pipeline was designed for platform-wide batch processing without considering multi-tenant implications.

**Fix:**

```typescript
async submit(tenantId: string, traceId: string): Promise<void> {
  const trace = await this.prisma.conversationTrace.findFirst({
    where: { id: traceId, tenantId },  // ✅ Tenant scoped
  });
  // ...
}

async getUnevaluatedTraces(tenantId: string, limit = 100): Promise<string[]> {
  const traces = await this.prisma.conversationTrace.findMany({
    where: {
      tenantId,  // ✅ Add tenant scoping
      evalScore: null,
      // ...
    },
  });
}
```

---

### P1-581: Broken Promise Cleanup Logic (Memory Leak)

**Files:**

- `server/src/agent/evals/pipeline.ts` (lines 366-378)
- `server/src/agent/tracing/tracer.ts` (lines 340-351)

**Todo:** `todos/581-open-p1-broken-promise-cleanup-logic.md`

**The Bug (pipeline.ts):**

```typescript
private cleanupPendingEvaluations(): void {
  if (this.pendingEvaluations.length > 50) {
    this.pendingEvaluations = this.pendingEvaluations.filter((p) => {
      let resolved = false;
      p.then(
        () => (resolved = true),   // ← Async callback
        () => (resolved = true)
      );
      return !resolved;  // ← Synchronous check - ALWAYS returns true!
    });
  }
}
```

**Why It's Broken:**

1. `.then()` schedules an async callback
2. JavaScript continues to `return !resolved` immediately
3. At this point, `resolved` is still `false` (callback hasn't run)
4. The filter keeps ALL promises, never cleaning any up
5. Array grows unbounded → memory leak

**The Bug (tracer.ts):**

```typescript
if (this.pendingWrites.length > 10) {
  this.pendingWrites = this.pendingWrites.filter(
    (p) =>
      new Promise<boolean>((resolve) => {
        p.then(() => resolve(false)).catch(() => resolve(false));
        setImmediate(() => resolve(true)); // ← Race condition
      })
  );
}
```

**Why It's Broken:**

1. Creates a Promise for each filter check
2. `setImmediate` races with `.then()` handler
3. Even for already-resolved promises, `setImmediate` may win the race
4. Non-deterministic behavior, incomplete cleanup

**Fix:**

```typescript
// Option 1: Track completion with a WeakSet
private resolvedPromises = new WeakSet<Promise<void>>();

private async submitAsync(traceId: string): Promise<void> {
  const promise = this.doEvaluation(traceId);
  this.pendingEvaluations.push(promise);
  promise.finally(() => {
    this.resolvedPromises.add(promise);
  });
}

private cleanupPendingEvaluations(): void {
  if (this.pendingEvaluations.length > 50) {
    this.pendingEvaluations = this.pendingEvaluations.filter(
      p => !this.resolvedPromises.has(p)
    );
  }
}

// Option 2: Just clear on flush (simpler)
async waitForPending(): Promise<void> {
  await Promise.allSettled(this.pendingEvaluations);
  this.pendingEvaluations = [];  // Clear after settling
}
```

---

### P1-582: Missing evalScore Database Index

**File:** `server/prisma/schema.prisma`
**Todo:** `todos/582-open-p1-missing-evalscore-database-index.md`

**Current Indexes:**

```prisma
@@index([tenantId, startedAt])
@@index([tenantId, agentType, startedAt])
@@index([tenantId, flagged, reviewStatus])
@@index([tenantId, evalScore])  // ← Only useful for tenant-scoped queries
@@index([sessionId])
@@index([expiresAt])
```

**The Problem:**

`getUnevaluatedTraces()` queries:

```sql
SELECT id FROM "ConversationTrace"
WHERE "evalScore" IS NULL
AND "startedAt" < $1
ORDER BY "startedAt" DESC
LIMIT 100;
```

There's no index on just `evalScore`, so this becomes a full table scan.

**Fix:**

```prisma
@@index([evalScore, startedAt])  // For batch unevaluated queries
```

---

### P1-583: Evaluator DI Violation (Hardcoded API Key)

**File:** `server/src/agent/evals/evaluator.ts` (lines 87-99)
**Todo:** `todos/583-open-p1-evaluator-di-violation.md`

**The Problem:**

```typescript
export class ConversationEvaluator {
  constructor(config: Partial<EvaluatorConfig> = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;  // ❌ Direct env access
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for evaluator');
    }
    this.anthropic = new Anthropic({ apiKey, ... });  // ❌ Creates own client
  }
}
```

**Why It's Critical:**

1. Unit tests require setting environment variable
2. Cannot inject mock Anthropic client for testing
3. Violates MAIS pattern where all dependencies flow through `di.ts`
4. Same issue in `EvalPipeline` which creates its own evaluator

**Fix:**

```typescript
// evaluator.ts
constructor(
  config: Partial<EvaluatorConfig> = {},
  anthropic?: Anthropic  // Accept injected client
) {
  this.anthropic = anthropic ?? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
}

// pipeline.ts
constructor(
  private readonly prisma: PrismaClient,
  evaluator?: ConversationEvaluator,  // Accept injected evaluator
  config: Partial<PipelineConfig> = {}
) {
  this.evaluator = evaluator ?? createEvaluator();
}
```

---

### P1-584: Missing Trace Cleanup Job

**File:** `server/src/jobs/cleanup.ts`
**Todo:** `todos/584-open-p1-missing-trace-cleanup-job.md`

**The Problem:**

The schema has `expiresAt` for 90-day retention:

```prisma
expiresAt DateTime? // Auto-cleanup after this date
@@index([expiresAt]) // For cleanup job
```

The tracer sets it:

```typescript
// tracer.ts:410-411
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + this.config.retentionDays);
```

But `cleanup.ts` only cleans sessions and proposals - **no trace cleanup function exists!**

```typescript
// cleanup.ts - What exists:
export async function cleanupExpiredSessions(prisma: PrismaClient): Promise<number>;
export async function cleanupExpiredProposals(prisma: PrismaClient): Promise<number>;
export async function recoverOrphanedProposals(prisma: PrismaClient): Promise<...>;
// ❌ Missing: cleanupExpiredTraces()
```

**Impact:** Database bloat. Traces accumulate forever, including encrypted PII.

**Fix:**

```typescript
export async function cleanupExpiredTraces(prisma: PrismaClient): Promise<number> {
  const result = await prisma.conversationTrace.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  logger.info({ deletedCount: result.count }, 'Cleaned up expired traces');
  return result.count;
}

// Also add to runAllCleanupJobs()
```

---

### P1-585: Unsafe Type Assertions in review-actions.ts

**File:** `server/src/agent/feedback/review-actions.ts`
**Todo:** `todos/585-open-p1-unsafe-type-assertions-review-actions.md`

**Problem 1 (line 234):**

```typescript
const actionType = item.action as ReviewActionType; // ❌ No validation
if (actionType in actionBreakdown) {
  actionBreakdown[actionType] = item._count;
}
```

Database returns `String`, but code casts to `ReviewActionType` without validation. If old data has invalid action types, this could cause issues.

**Problem 2 (lines 311-315):**

```typescript
.filter((a) => a.correctedScore !== null && a.trace?.evalScore !== null)
.map((a) => ({
  originalScore: a.trace!.evalScore!,  // ❌ Non-null assertion
  correctedScore: a.correctedScore!,
  delta: a.correctedScore! - a.trace!.evalScore!,
}))
```

TypeScript doesn't narrow types through `.filter()` → `.map()` chain. The `!` assertions are technically safe but fragile.

**Fix:**

```typescript
// Type guard for action validation
const VALID_ACTIONS = new Set<ReviewActionType>([...]);
if (VALID_ACTIONS.has(item.action as ReviewActionType)) {
  const actionType = item.action as ReviewActionType;
  // ...
}

// Type predicate for filter narrowing
.filter((a): a is typeof a & { correctedScore: number; trace: { evalScore: number } } =>
  a.correctedScore !== null && a.trace?.evalScore !== null
)
```

---

### P1-586: Dead Code - Feedback Module Never Used

**Files:** Entire `server/src/agent/feedback/` directory
**Todo:** `todos/586-open-p1-dead-code-feedback-module.md`

**Evidence:**

```bash
$ grep -r "import.*from.*feedback" server/src/
# No results

$ grep -r "EvalPipeline\|createEvalPipeline" server/src/
# Only hits in:
# - evals/pipeline.ts (definition)
# - evals/index.ts (re-export)
```

**Impact:**

- ~800 lines of well-written but unused code
- Increases maintenance burden
- No routes wire up the feedback module
- No cron job invokes EvalPipeline

**Decision Needed:**

1. **Wire up now:** Add routes, cron job, integrate with di.ts
2. **Defer:** Move to `_future/` directory until needed

---

## 5. Important Findings (P2)

### P2-587: Duplicate PII Redaction Patterns

**Files:**

- `server/src/agent/evals/pipeline.ts` (lines 56-144) - 6 patterns
- `server/src/agent/feedback/review-queue.ts` (lines 86-103) - 4 patterns

**Issue:** Same patterns defined twice with slight differences. Pipeline has address/name patterns that review-queue lacks.

**Fix:** Extract to `server/src/lib/pii-redactor.ts`

---

### P2-588: Missing Transaction in Platform Admin Routes

**File:** `server/src/routes/platform-admin-traces.routes.ts` (lines 284-337)

```typescript
const action = await prisma.reviewAction.create({ ... });
// ❌ No transaction - if this fails, action exists but trace not updated
await prisma.conversationTrace.update({ ... });
```

Compare to `ReviewActionService.recordAction()` which correctly uses `$transaction([...])`.

---

### P2-589: N+1 Queries in Review Queue

**File:** `server/src/agent/feedback/review-queue.ts` (lines 229-264)

```typescript
// Query 1: Verify tenant
const trace = await this.prisma.conversationTrace.findFirst({ ... });
// Query 2: Update trace
await this.prisma.conversationTrace.update({ ... });
// Query 3: Create action (conditional)
await this.prisma.reviewAction.create({ ... });
```

**Fix:** Use transaction with `updateMany` that includes tenant check in WHERE clause.

---

### P2-590: Platform Admin Routes Not Wired

**File:** `server/src/routes/platform-admin-traces.routes.ts`

The file exists but is never imported in `routes/index.ts`. Either mount it or delete it.

---

### P2-591: Missing Zod Type Inference

**File:** `server/src/agent/evals/rubrics/index.ts`

Manual interfaces duplicate Zod schemas:

```typescript
// Manual interface
export interface DimensionScore { dimension: string; score: number; ... }

// Zod schema (duplicates structure)
export const DimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(10),
  ...
});
```

**Fix:** Use `type DimensionScore = z.infer<typeof DimensionScoreSchema>`

---

### P2-592: UserFeedback Orphaned Records

**File:** `server/prisma/schema.prisma` (line 1021)

```prisma
trace ConversationTrace? @relation(fields: [traceId], references: [id], onDelete: SetNull)
```

When traces are deleted, feedback `traceId` becomes null, losing context.

**Fix:** Change to `onDelete: Cascade` or add cleanup job for orphaned feedback.

---

### P2-593: Console.log in Tests

**File:** `server/test/agent-eval/calibration.test.ts`

```typescript
console.log('\n📊 PERFECT_BOOKING Evaluation:');
```

Per CLAUDE.md, use `logger` utility, not `console.log`.

---

### P2-594: Error Message Leaks Sensitive Details

**File:** `server/src/agent/evals/pipeline.ts` (line 356)

```typescript
flagReason: `Evaluation failed: ${error.message}`,  // ❌ May contain API URLs, keys
```

**Fix:** Use generic message, log details separately.

---

### P2-595: Unsafe `as any` in Test Mocks

**File:** `server/test/agent-eval/feedback.test.ts`

```typescript
const mockPrisma = { ... } as any;  // ❌ Loses type safety
```

**Fix:** Use `mockDeep<PrismaClient>()` from vitest-mock-extended.

---

## 6. Minor Findings (P3)

| ID  | Issue                                                                    | File                               |
| --- | ------------------------------------------------------------------------ | ---------------------------------- |
| 596 | Magic numbers in satisfaction scoring (0.5, 0.75, 2, 3, 10)              | implicit.ts                        |
| 597 | Same error message for "not found" and "access denied"                   | review-queue.ts, review-actions.ts |
| 598 | Hardcoded evaluation model ID                                            | evaluator.ts:57                    |
| 599 | Missing adversarial test scenarios (indirect injection, encoding bypass) | scenarios/adversarial/             |
| 600 | Inconsistent `readonly` on constant arrays                               | Various                            |

---

## 7. Finding Dependencies & Remediation Order

### Dependency Graph

```
P1-586 (dead code) ──────────────────────────────────────────┐
    │                                                        │
    │ depends on whether we wire up or defer                 │
    ▼                                                        │
P1-583 (DI violation) ◄────────────────────┐                 │
    │                                      │                 │
    │ must fix before testing              │                 │
    ▼                                      │                 │
P1-580 (tenant scoping) ◄─────────────────┤                 │
    │                                      │                 │
    │ critical for security                │ if wiring up   │
    ▼                                      │                 │
P1-582 (index) ◄──────────────────────────┤                 │
    │                                      │                 │
    │ performance fix                      │                 │
    ▼                                      │                 │
P1-581 (promise cleanup) ◄────────────────┘                 │
    │                                                        │
    │ memory leak fix                                        │
    ▼                                                        │
P1-584 (trace cleanup) ◄─────────────────────────────────────┘
    │
    │ data hygiene
    ▼
P1-585 (type assertions)
    │
    │ type safety
    ▼
P2 findings (in any order)
```

### Recommended Remediation Order

1. **Decision Point:** Wire up feedback module now, or defer?
   - If wire up: Complete all P1 fixes
   - If defer: Move to `_future/`, fix only tracer.ts issues

2. **If wiring up, fix in this order:**
   1. P1-583: Fix DI violation (enables testing)
   2. P1-580: Add tenant scoping (security critical)
   3. P1-581: Fix promise cleanup (memory leak)
   4. P1-582: Add database index (performance)
   5. P1-584: Add trace cleanup job (data hygiene)
   6. P1-585: Fix type assertions (type safety)
   7. P2 findings (any order)

3. **If deferring:**
   1. P1-581 (tracer.ts part): Fix promise cleanup in tracer
   2. P1-584: Add trace cleanup job
   3. Move `evals/` and `feedback/` to `_future/`

---

## 8. Implementation Guidance

### Wiring Up the Feedback Module

To make the modules active, add:

**1. Platform admin routes (routes/index.ts):**

```typescript
import { createPlatformAdminTracesRouter } from './platform-admin-traces.routes';

// With platform admin auth
app.use(
  '/v1/platform/admin/traces',
  platformAdminAuthMiddleware,
  createPlatformAdminTracesRouter(prisma)
);
```

**2. Evaluation cron job (jobs/evaluation.ts):**

```typescript
import { createEvalPipeline } from '../agent/evals';

export async function runEvaluationBatch(prisma: PrismaClient): Promise<void> {
  // Process each tenant separately for proper isolation
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const pipeline = createEvalPipeline(prisma);
    const traces = await pipeline.getUnevaluatedTraces(tenant.id, 50);
    await pipeline.processBatch(traces);
  }
}
```

**3. DI wiring (di.ts):**

```typescript
import { createEvalPipeline, createEvaluator } from './agent/evals';
import { createReviewQueue, createReviewActionService } from './agent/feedback';

export function createEvaluationServices(prisma: PrismaClient) {
  const evaluator = createEvaluator(); // Or inject mock for testing
  const pipeline = createEvalPipeline(prisma, evaluator);
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);

  return { evaluator, pipeline, reviewQueue, reviewActions };
}
```

### Testing with Mocked Evaluator

```typescript
// test/helpers/mock-evaluator.ts
export function createMockEvaluator(): ConversationEvaluator {
  return {
    evaluate: vi.fn().mockResolvedValue({
      dimensions: [
        { dimension: 'effectiveness', score: 8, reasoning: 'Good', confidence: 0.9 },
        // ...
      ],
      overallScore: 8,
      overallConfidence: 0.9,
      summary: 'Mock evaluation',
      flagged: false,
      flagReason: null,
    }),
  } as unknown as ConversationEvaluator;
}

// Usage in test
const mockEvaluator = createMockEvaluator();
const pipeline = new EvalPipeline(prisma, mockEvaluator);
```

---

## Appendix: File Reference

| File                | Status    | Lines | Key Issues               |
| ------------------- | --------- | ----- | ------------------------ |
| `tracer.ts`         | IN USE    | 568   | P1-581 (promise cleanup) |
| `pipeline.ts`       | UNUSED    | 394   | P1-580, P1-581, P1-582   |
| `evaluator.ts`      | UNUSED    | 365   | P1-583                   |
| `review-queue.ts`   | UNUSED    | 387   | P2-589                   |
| `review-actions.ts` | UNUSED    | 335   | P1-585                   |
| `implicit.ts`       | UNUSED    | 258   | P3-596                   |
| `calibration.ts`    | TEST ONLY | 337   | -                        |
| `rubrics/index.ts`  | UNUSED    | 408   | P2-591                   |
| `cleanup.ts`        | IN USE    | 298   | P1-584 (missing traces)  |
| `schema.prisma`     | -         | ~1047 | P1-582, P2-592           |

---

_This document was generated by the `/workflows:review` command on 2026-01-02 using 7 specialized review agents running in parallel._
