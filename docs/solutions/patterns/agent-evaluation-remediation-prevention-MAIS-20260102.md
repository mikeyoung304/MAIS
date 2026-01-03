# Agent Evaluation System Remediation Prevention Strategies

**Date:** 2026-01-02
**Source:** Phase 1-4 Remediation (commits: face869, 458702e, c072136)
**Scope:** 6 critical code review fixes (P1-580, P1-581, P1-582, P1-583, P1-584, P1-585)
**Related Plans:** `plans/agent-evaluation-framework.md`, `plans/agent-evaluation-system.md`

## Overview

The Agent Evaluation System remediation revealed **6 critical patterns** that caused security vulnerabilities, memory leaks, performance bottlenecks, and DI violations. This document provides prevention strategies to avoid these issues in future development.

**Impact Addressed:**

- Security: 2 issues (multi-tenant isolation, unsafe type assertions)
- Performance: 2 issues (memory leaks, missing indexes)
- Architecture: 2 issues (DI constructor ordering, missing infrastructure)

---

## Pattern 1: DI Constructor Ordering (P1-583)

### The Problem

**Violation:** Configuration parameters passed before dependencies

```typescript
// ❌ WRONG - Kieran's rule violated
constructor(config: Partial<EvaluatorConfig> = {}, anthropic?: Anthropic) {
  this.config = { ...DEFAULT_CONFIG, ...config };
  this.anthropic = anthropic ?? new Anthropic(...);
}
```

**Why It Matters:**

- Breaks dependency injection testing (can't mock without side effects)
- Forces consumers to provide config before dependencies
- Makes optional dependencies look optional when they're required

**Real Impact:** Made `ConversationEvaluator` impossible to mock in tests without instantiating real Anthropic client.

### Prevention Strategy

**Checklist for Service Constructors:**

```typescript
// ✅ CORRECT - Dependencies first (Kieran's rule)
constructor(
  anthropic?: Anthropic,           // Dependencies first
  config: Partial<EvaluatorConfig> = {} // Config second
) {
  // Validate dependencies only when creating defaults
  if (!anthropic && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required when no Anthropic client provided');
  }

  // Then merge config
  this.config = { ...DEFAULT_CONFIG, ...config };

  // Then create/assign dependencies
  this.anthropic = anthropic ?? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeout: this.config.timeoutMs,
  });
}
```

**Validation Checklist:**

- [ ] All dependencies appear BEFORE config parameters
- [ ] Optional dependencies are typed `dependency?: Type`
- [ ] API key validation only happens when creating default client
- [ ] Config merging happens AFTER dependency validation
- [ ] Tests can inject mocks without side effects

**Pattern:**

```typescript
class MyService {
  constructor(
    // Tier 1: External dependencies (database, HTTP clients)
    private readonly httpClient?: HttpClient,

    // Tier 2: Adapters and repositories
    private readonly repo?: Repository,

    // Tier 3: Config and options (always last)
    config: Partial<Config> = {}
  ) {
    // Implementation
  }
}
```

---

## Pattern 2: Promise Cleanup with Settle-and-Clear (P1-581)

### The Problem

**Violation:** Synchronous filtering on Promise arrays causes memory accumulation

```typescript
// ❌ WRONG - Promises stay in array during cleanup
private feedbackPromises: Promise<void>[] = [];

async runAsyncFeedback(): Promise<void> {
  // Push new promises
  this.feedbackPromises.push(
    reviewQueue.getFlaggedConversations(...),
    reviewQueue.submitReview(...)
  );

  // Later: Filter to clean up - but what about pending promises?
  // Synchronous filter doesn't wait for promises
  this.feedbackPromises = this.feedbackPromises.filter(
    (p) => !p.settled // ❌ This doesn't actually exist, and sync filtering ignores pending
  );
}
```

**Why It Matters:**

- Promise references stay in memory even after completion
- Accumulates indefinitely in long-running services
- Causes memory leaks in orchestrators that run for hours/days
- Real impact: EvalPipeline could accumulate 1000s of promise references

### Prevention Strategy

**Use Settle-and-Clear Pattern:**

```typescript
// ✅ CORRECT - Async settle + clear
private feedbackPromises: Promise<void>[] = [];

async cleanupFeedbackPromises(): Promise<void> {
  // Wait for all promises to settle (resolve or reject)
  const results = await Promise.allSettled(this.feedbackPromises);

  // Log any rejections for debugging
  const rejected = results
    .map((r, i) => (r.status === 'rejected' ? [i, r.reason] : null))
    .filter(Boolean);

  if (rejected.length > 0) {
    logger.warn(
      { rejected: rejected.map(([i, err]) => ({ index: i, error: sanitizeError(err) })) },
      'Some feedback promises rejected'
    );
  }

  // Clear the entire array (not just filtering)
  this.feedbackPromises = [];
}
```

**Validation Checklist:**

- [ ] All promise accumulation points use `Promise.allSettled()`
- [ ] Array is completely cleared with `promises = []` not `filter()`
- [ ] Results are logged/handled (don't just discard)
- [ ] Cleanup runs on exit/shutdown (see `lib/shutdown.ts` pattern)
- [ ] Unit tests verify array is empty after cleanup

**Pattern for Services with Async Operations:**

```typescript
export class AsyncCollectorService {
  private asyncTasks: Promise<void>[] = [];

  async enqueueTask(task: () => Promise<void>): Promise<void> {
    this.asyncTasks.push(task());
  }

  async waitAndClearAll(): Promise<void> {
    // 1. Settle all
    const results = await Promise.allSettled(this.asyncTasks);

    // 2. Log failures
    const failures = results
      .map((r, i) => (r.status === 'rejected' ? { index: i, reason: r.reason } : null))
      .filter(Boolean);
    if (failures.length > 0) {
      logger.warn({ failures }, 'Failed tasks during cleanup');
    }

    // 3. Clear array
    this.asyncTasks = [];
  }
}
```

**Where This Applies:**

- Feedback processing services (EvalPipeline, ReviewQueue)
- Event-driven architectures with fire-and-forget operations
- Long-running services that process batches
- Orchestrators with deferred execution

---

## Pattern 3: Tenant Scoping Every Database Method (P1-580)

### The Problem

**Violation:** Missing tenantId parameter in repository/service methods

```typescript
// ❌ WRONG - No tenant filtering
async getUnevaluatedTraces(): Promise<ConversationTrace[]> {
  return this.prisma.conversationTrace.findMany({
    where: { evalScore: null }, // Missing tenantId!
  });
}

// ❌ WRONG - TenantId not required
async getActionsForTrace(traceId: string): Promise<ReviewAction[]> {
  return this.prisma.reviewAction.findMany({
    where: { traceId }, // What if another tenant has this traceId?
  });
}
```

**Why It Matters:**

- Data leakage between tenants (CRITICAL security vulnerability)
- Customers see each other's evaluation scores/feedback
- Impossible to verify isolation during code review
- P0 security issue that causes compliance failures

### Prevention Strategy

**Checklist for Every Database Method:**

```typescript
// ✅ CORRECT - tenantId as first parameter
async getUnevaluatedTraces(tenantId: string): Promise<ConversationTrace[]> {
  // 1. Validate parameter
  if (!tenantId) {
    throw new Error('tenantId required - tenant scoping is mandatory');
  }

  // 2. Filter by tenant
  return this.prisma.conversationTrace.findMany({
    where: {
      tenantId, // ALWAYS filter by tenant
      evalScore: null,
    },
  });
}

async getActionsForTrace(tenantId: string, traceId: string): Promise<ReviewAction[]> {
  // 1. Validate tenant access
  const trace = await this.prisma.conversationTrace.findFirst({
    where: { id: traceId, tenantId }, // Verify tenant owns trace
  });

  if (!trace) {
    throw new TraceNotFoundError(traceId);
  }

  // 2. Query with tenant scope
  return this.prisma.reviewAction.findMany({
    where: { traceId }, // Safe now because we verified ownership
  });
}
```

**Required Signature Pattern:**

```typescript
// Repository Interface - ALL methods require tenantId
interface ReviewQueueRepository {
  // ✅ Correct
  getFlaggedConversations(tenantId: string, options: ReviewQueueOptions): Promise<ReviewItem[]>;
  submitReview(tenantId: string, traceId: string, submission: ReviewSubmission): Promise<void>;

  // ❌ Wrong - missing tenantId
  getFlaggedConversations(options: ReviewQueueOptions): Promise<ReviewItem[]>;
}

// Service method
async getReviewItems(tenantId: string): Promise<ReviewItem[]> {
  // Validate at entry point
  if (!tenantId || !tenantId.startsWith('t_')) {
    throw new Error('Invalid tenantId format');
  }

  // Pass to repository
  return this.reviewQueue.getFlaggedConversations(tenantId, {});
}
```

**Code Review Checklist:**

When reviewing any database-accessing method:

```
□ Method signature has tenantId as first parameter (after `this`)
□ tenantId validation: if (!tenantId) throw Error()
□ All Prisma queries filter where { tenantId, ... }
□ Compound queries verify ownership: await prisma.model.findFirst({ where: { id, tenantId } })
□ Compound queries throw TraceNotFoundError if ownership fails
□ Tests verify data from different tenants is isolated
□ Git diff shows WHERE clause includes tenantId
```

**Error Pattern for Unauthorized Access:**

```typescript
// Define domain errors
export class TraceNotFoundError extends Error {
  constructor(traceId: string) {
    super(`Trace not found: ${traceId}`);
    this.name = 'TraceNotFoundError';
  }
}

export class TenantAccessDeniedError extends Error {
  constructor(tenantId: string, resourceId: string) {
    super(`Tenant ${tenantId} does not have access to ${resourceId}`);
    this.name = 'TenantAccessDeniedError';
  }
}

// Use consistently
if (!trace || trace.tenantId !== tenantId) {
  throw new TenantAccessDeniedError(tenantId, traceId);
}
```

---

## Pattern 4: Type Guards for Filter Narrowing (P1-585)

### The Problem

**Violation:** Using `!` assertions instead of type predicates

```typescript
// ❌ WRONG - Type assertion ignores undefined
const nonNullResults = results.filter((r) => r != null)!;
// ^ TypeScript still thinks r could be null, assertion suppresses error

// ❌ WRONG - Can't narrow array element type
const actions = reviewActions.filter((a) => a.status === 'approved');
// TypeScript doesn't know that a.status is narrowed
```

**Why It Matters:**

- `!` assertions bypass type safety completely
- Readers can't tell if value is actually narrowed
- Makes code fragile to refactoring
- Easy source of runtime errors with `undefined` access

**Real Impact:** `review-actions.ts` had multiple assertions that could cause null pointer exceptions.

### Prevention Strategy

**Use Type Guard Functions:**

```typescript
// ✅ CORRECT - Type predicate (type guard)
function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function isRejected<T>(result: PromiseSettledResult<T>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

// Usage
const results = await Promise.allSettled(promises);

// Type-safe filtering with narrowing
const rejected = results.filter(isRejected);
// rejected is now PromiseRejectedResult[], not PromiseSettledResult<T>[]

rejected.forEach((r) => {
  console.log(r.reason); // ✅ Type-safe, no assertion needed
});
```

**Pattern for Optional Properties:**

```typescript
// ✅ CORRECT - Narrow with type guard
interface ReviewAction {
  score: number;
  correctedScore?: number;
}

const actions: ReviewAction[] = [...];

// Filter with predicate
function hasCorrectedScore(action: ReviewAction): action is ReviewAction & { correctedScore: number } {
  return action.correctedScore !== undefined;
}

const corrected = actions.filter(hasCorrectedScore);
// corrected[0].correctedScore is now number, not number | undefined
```

**Common Type Predicates Library:**

```typescript
// lib/type-guards.ts
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray<T>(value: unknown, guard?: (v: unknown) => v is T): value is T[] {
  if (!Array.isArray(value)) return false;
  if (!guard) return true;
  return value.every(guard);
}
```

**Validation Checklist:**

- [ ] No `!` assertions in type-narrowing filters
- [ ] Type predicates used instead (`value is T` return type)
- [ ] Type narrowing verified in tests (hover shows narrowed type)
- [ ] Common predicates extracted to `lib/type-guards.ts`
- [ ] Code review catches new `!` assertions in type-related code

---

## Pattern 5: Database Indexes for Query Optimization (P1-582)

### The Problem

**Violation:** N+1 queries without database support

```typescript
// ❌ INEFFICIENT - Finds unevaluated traces without index
async getUnevaluatedTraces(tenantId: string): Promise<ConversationTrace[]> {
  return this.prisma.conversationTrace.findMany({
    where: {
      tenantId,
      evalScore: null, // No index on (tenantId, evalScore)
    },
  });
  // Single query could scan millions of rows
}
```

**Why It Matters:**

- Query scans entire table instead of using index
- Slow response times (100ms+ instead of 5ms)
- Database load spikes under production traffic
- Evaluation pipeline becomes a bottleneck

**Real Impact:** Unevaluated traces query could scan millions of rows during peak periods.

### Prevention Strategy

**Add Indexes in Schema:**

```prisma
// schema.prisma - Add composite indexes for common queries
model ConversationTrace {
  id              String   @id @default(cuid())
  tenantId        String   @db.Uuid
  evalScore       Int?
  reviewStatus    String   @default("pending")

  // Indexes for common queries
  @@index([tenantId, evalScore]) // For getUnevaluatedTraces
  @@index([tenantId, reviewStatus]) // For getFlaggedConversations
  @@index([tenantId, createdAt]) // For time-based queries
}

model ReviewAction {
  id        String   @id @default(cuid())
  tenantId  String   @db.Uuid
  traceId   String

  // Index for getActionsForTrace
  @@index([traceId, tenantId])
}
```

**Migration Steps:**

```bash
# 1. Edit schema.prisma
# Add @@index([tenantId, column]) for each query pattern

# 2. Generate migration
npm exec prisma migrate dev --name add_evaluation_indexes

# 3. Verify migration SQL
cat server/prisma/migrations/*/migration.sql

# 4. Test performance
npm run test:integration -- --grep "evaluation.*performance"
```

**Performance Verification Checklist:**

```typescript
// test/agent-eval/performance.test.ts
describe('Evaluation Pipeline Performance', () => {
  it('should get 1000 unevaluated traces in <100ms', async () => {
    const start = Date.now();
    const traces = await pipeline.getUnevaluatedTraces(tenantId);
    const duration = Date.now() - start;

    expect(traces).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Must use index
  });
});
```

**Index Design Pattern:**

```
Query Pattern                          Index
─────────────────────────────────────  ───────────────────────
findMany({ where: { tenantId } })     (tenantId)
findMany({ where: { tenantId, field } }) (tenantId, field)
findFirst({ where: { id, tenantId } }) (tenantId, id) [compound]
orderBy: tenantId, createdAt DESC     (tenantId, createdAt DESC)
```

**Code Review Checklist:**

- [ ] New database queries use indexed columns
- [ ] WHERE clause matches index prefix: `(tenantId, ...)`
- [ ] SELECT \* queries exist only for small result sets
- [ ] Performance tests verify <100ms for expected volume
- [ ] Migration file created alongside schema changes

---

## Pattern 6: Infrastructure Setup and Cleanup (P1-584)

### The Problem

**Violation:** Missing trace retention and event sourcing cleanup

```typescript
// ❌ WRONG - Traces accumulate forever
async persistEvaluation(trace: ConversationTrace): Promise<void> {
  // Save evaluation result
  await this.prisma.conversationTrace.update({
    where: { id: trace.id },
    data: { evalScore: result.score },
  });
  // But never clean up old traces -> 10 years of data piles up
}
```

**Why It Matters:**

- Database grows unbounded (10GB+ annually)
- Evaluation scores pollute old data unnecessarily
- Backup/restore times increase
- Compliance issues (data retention requirements)
- Query performance degrades

### Prevention Strategy

**Implement Cleanup Job:**

```typescript
// src/jobs/cleanup.ts
import { logger } from '../lib/core/logger';

export async function cleanupExpiredTraces(
  prisma: PrismaClient,
  retentionDays: number = 90
): Promise<{ deletedCount: number }> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // 1. Find traces older than retention period
  const oldTraces = await prisma.conversationTrace.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      // Only clean up evaluated traces (keep incomplete ones for debugging)
      evalScore: { not: null },
    },
    select: { id: true },
  });

  if (oldTraces.length === 0) {
    logger.info('No traces to clean up');
    return { deletedCount: 0 };
  }

  // 2. Delete in batches (avoid lock contention)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < oldTraces.length; i += BATCH_SIZE) {
    const batch = oldTraces.slice(i, i + BATCH_SIZE).map((t) => t.id);
    await prisma.conversationTrace.deleteMany({
      where: { id: { in: batch } },
    });
    logger.info({ batch: i / BATCH_SIZE + 1, size: batch.length }, 'Cleaned up batch');
  }

  logger.info({ deletedCount: oldTraces.length, retentionDays }, 'Trace cleanup completed');

  return { deletedCount: oldTraces.length };
}

// Wire up to scheduler
export async function runAllCleanupJobs(prisma: PrismaClient): Promise<void> {
  logger.info('Starting all cleanup jobs');

  try {
    const { deletedCount: traceCount } = await cleanupExpiredTraces(
      prisma,
      parseInt(process.env.TRACE_RETENTION_DAYS || '90', 10)
    );

    // Add other cleanup jobs
    const idempotency = await cleanupExpiredIdempotencyRecords(prisma);

    logger.info(
      { traces: traceCount, idempotency: idempotency.deletedCount },
      'All cleanup jobs completed'
    );
  } catch (error) {
    logger.error({ error }, 'Cleanup job failed');
    // Don't throw - cleanup failures shouldn't crash the server
  }
}
```

**Schedule in DI Container:**

```typescript
// src/di.ts
export function buildContainer(config: Config): Container {
  // ... existing setup ...

  // Schedule cleanup job (runs daily at 2am UTC)
  if (process.env.NODE_ENV !== 'test') {
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Daily
    const startCleanupScheduler = (prisma: PrismaClient) => {
      setInterval(async () => {
        await runAllCleanupJobs(prisma);
      }, CLEANUP_INTERVAL);

      logger.info('Cleanup scheduler started (runs daily)');
    };

    // Start after Prisma client is ready
    startCleanupScheduler(prismaClient);
  }

  return {
    // ... controllers, services, etc ...
    cleanup: async () => {
      // Cleanup runs on shutdown
      await runAllCleanupJobs(prisma);
      await prisma.$disconnect();
    },
  };
}
```

**Graceful Shutdown Pattern:**

```typescript
// src/lib/shutdown.ts
export function registerGracefulShutdown(manager: ShutdownManager): void {
  const { server, cleanup, timeoutMs = 60000 } = manager;

  async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received: graceful shutdown`);

    // 1. Stop accepting requests
    server.close();

    // 2. Run cleanup (which includes data cleanup jobs)
    if (cleanup) {
      await cleanup();
    }

    // 3. Exit
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

**Validation Checklist:**

- [ ] Cleanup function removes data older than retention period
- [ ] Cleanup is called on graceful shutdown (see Pattern 2)
- [ ] Cleanup is scheduled daily/weekly
- [ ] Cleanup uses batch processing (avoid locking)
- [ ] Cleanup logs are recorded for audit
- [ ] Tests verify cleanup doesn't delete fresh data
- [ ] Environment variable sets retention days

---

## Prevention Strategy Summary

### Quick Reference Table

| Pattern             | File Location           | Key Validation                | Test Type                 |
| ------------------- | ----------------------- | ----------------------------- | ------------------------- |
| **DI Ordering**     | Service constructors    | Dependencies before config    | Unit (mockDeep)           |
| **Promise Cleanup** | Services with async ops | settle + clear pattern        | Integration (memory leak) |
| **Tenant Scoping**  | All database methods    | tenantId first param + filter | Integration (isolation)   |
| **Type Guards**     | All filter operations   | `is T` type predicates        | Unit (type narrowing)     |
| **Indexes**         | schema.prisma           | @@index([tenant, field])      | Performance (<100ms)      |
| **Infrastructure**  | jobs/cleanup.ts         | Daily retention cleanup       | Integration (audit)       |

### Code Review Checklist

When reviewing service/repository changes:

```
DEPENDENCY INJECTION
□ Dependencies appear before config params (Kieran's rule)
□ Optional dependencies typed with ?
□ API key validation only in default client creation
□ Tests inject mocks without side effects

ASYNC OPERATIONS
□ Promise arrays cleaned with Promise.allSettled()
□ Array completely cleared with = [], not filter()
□ Results logged before clearing
□ Cleanup runs on service teardown

DATABASE SAFETY
□ Every method has tenantId as first parameter
□ if (!tenantId) throw Error() validation
□ All WHERE clauses include tenantId filter
□ Compound queries verify ownership first
□ TraceNotFoundError thrown on access violation

TYPE SAFETY
□ No ! assertions used for narrowing
□ Type predicates (is T) used instead
□ Filter results have narrowed types
□ Common predicates in lib/type-guards.ts

PERFORMANCE
□ Complex queries use indexed columns
□ Indexes follow pattern: (tenantId, field)
□ New queries have performance tests
□ Unevaluated trace query <100ms

INFRASTRUCTURE
□ Cleanup jobs for time-based retention
□ Graceful shutdown calls cleanup
□ Scheduled via DI container
□ Batch processing for large deletes
```

---

## Testing Patterns

### Unit Test Pattern (DI + Type Safety)

```typescript
import { mockDeep } from 'jest-mock-extended';
import type Anthropic from '@anthropic-ai/sdk';
import { ConversationEvaluator } from '../evaluator';

describe('ConversationEvaluator DI', () => {
  it('should accept injected anthropic client', () => {
    const mockClient = mockDeep<Anthropic>();

    const evaluator = new ConversationEvaluator(mockClient);
    expect(evaluator).toBeDefined();
  });

  it('should throw if no API key when creating default client', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => new ConversationEvaluator()).toThrow('ANTHROPIC_API_KEY required');
  });
});
```

### Integration Test Pattern (Tenant Isolation)

```typescript
describe('Tenant Isolation', () => {
  it('should not leak traces between tenants', async () => {
    const tenant1 = await createTestTenant();
    const tenant2 = await createTestTenant();

    // Create trace in tenant1
    await traceService.saveTrace(tenant1.id, { ... });

    // Tenant2 should NOT see it
    const traces = await traceService.getTraces(tenant2.id);
    expect(traces).toHaveLength(0);
  });
});
```

### Performance Test Pattern (Indexes)

```typescript
describe('Query Performance', () => {
  it('should fetch 1000 unevaluated traces in <100ms', async () => {
    // Pre-populate database
    for (let i = 0; i < 1000; i++) {
      await createTrace(tenantId, { evalScore: null });
    }

    const start = Date.now();
    const traces = await pipeline.getUnevaluatedTraces(tenantId);
    const duration = Date.now() - start;

    expect(traces).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Index must be used
  });
});
```

---

## References

- **Commits:** face869, 458702e, c072136 (remediation phase 1-4)
- **Plans:** plans/agent-evaluation-framework.md, plans/agent-evaluation-system.md
- **Code:** server/src/agent/evals/, server/src/agent/feedback/
- **Related Patterns:** docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md

## Version History

| Date       | Changes                                                              |
| ---------- | -------------------------------------------------------------------- |
| 2026-01-02 | Initial release - 6 prevention strategies from Phase 1-4 remediation |
