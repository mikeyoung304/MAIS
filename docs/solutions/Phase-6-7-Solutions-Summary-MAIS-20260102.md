---
module: MAIS
type: solutions_summary
date: 2026-01-02
tags: [agent-eval, phase-6-7, solutions, summary, quick-reference]
---

# Phase 6-7 Agent Evaluation Solutions - Quick Summary

**15 Key Solutions** from comprehensive Phase 6-7 remediation

---

## Phase 1-4: P1 Critical Issues (7 Solutions)

| #   | Solution                  | Problem                                                | Fix                                             | Impact                                              |
| --- | ------------------------- | ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------- |
| 1   | DI & Constructor Ordering | Config before dependencies prevents mocking            | Dependencies first (Kieran's rule)              | Testability: inject mocks without env vars          |
| 2   | Tenant Scoping            | Missing tenantId in queries allows cross-tenant access | Add tenantId as first param + all WHERE clauses | Security: P0 isolation guarantee                    |
| 3   | Promise Cleanup           | Memory leak from filter() on Promises                  | Use Promise.allSettled() then clear array       | Stability: no memory bloat in long-running services |
| 4   | Type Safety               | `!` assertions bypass null checks                      | Use `as unknown as Type` for Prisma 7 JSON      | Reliability: compile-time null safety               |
| 5   | Domain Errors             | Generic Error class, no HTTP status mapping            | Create typed AppError subclasses                | Clarity: 404 vs 403 vs 500 distinction              |
| 6   | Database Indexes          | N+1 queries, full table scans                          | Composite indexes: (tenantId, field)            | Performance: 100ms+ → 5ms queries                   |
| 7   | Prisma 7 JSON             | Direct JSON casting causes type errors                 | Two-step cast: `as unknown as Type`             | Compatibility: works with Prisma 7 strict mode      |

---

## Phase 6: Code Quality (3 Solutions)

| #   | Solution                | Problem                              | Fix                                   | Impact                                  |
| --- | ----------------------- | ------------------------------------ | ------------------------------------- | --------------------------------------- |
| 8   | PII Redactor Extraction | Same patterns duplicated in 2+ files | Centralize in `/lib/pii-redactor.ts`  | Maintainability: single source of truth |
| 9   | N+1 Query Fix           | find() then loop UPDATE              | Use updateMany() in transaction       | Performance: 100 queries → 1 query      |
| 10  | Orphaned Cleanup        | Feedback records accumulate forever  | Add cleanupOrphanedFeedback() to jobs | Data integrity: no dangling references  |

---

## Phase 7: P2 Security & Quality (5 Solutions)

| #   | Solution              | Problem                                   | Fix                                      | Impact                                   |
| --- | --------------------- | ----------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| 11  | tenantId in Queries   | Defense-in-depth missing                  | Always include tenantId in WHERE         | Security: multi-layer isolation          |
| 12  | CLI Validation        | No argument validation                    | Zod schema + parseArgs()                 | Reliability: fail-fast with clear errors |
| 13  | Duplicated DI         | Same 15-line setup in mock and real modes | Extract buildEvaluationServices() helper | Maintainability: DRY principle           |
| 14  | Silent Test Skips     | Early return() hides skipped tests        | Use it.skipIf() instead                  | Visibility: true test status in CI       |
| 15  | Sequential Processing | One tenant at a time                      | Concurrent worker pool with rate limit   | Performance: 3-5x faster                 |

---

## 2-Minute Code Review Checklist

**DI & Dependencies:**

```
□ Dependencies before config params
□ Optional dependencies typed with ?
□ No API key validation in constructor
```

**Tenant Isolation:**

```
□ tenantId as first parameter
□ if (!tenantId) throw Error() validation
□ WHERE { tenantId, ... } in all queries
```

**Type Safety:**

```
□ No ! assertions in type-narrowing code
□ JSON reads: as unknown as Type
□ Type predicates for filters (is T)
```

**Performance:**

```
□ No N+1 queries (use updateMany, joins)
□ Composite indexes: (tenantId, field)
□ No sequential loops over batch operations
```

**Tests:**

```
□ No early return() in tests
□ Use it.skipIf() for conditional skips
□ Tenant isolation verified in integration tests
```

---

## Before/After Examples

### Solution 1: DI Constructor Ordering

```typescript
// ❌ BEFORE
constructor(config: Config = {}, anthropic?: Anthropic) { }

// ✅ AFTER
constructor(anthropic?: Anthropic, config: Config = {}) { }
```

### Solution 2: Tenant Scoping

```typescript
// ❌ BEFORE
async getTraces(): Promise<ConversationTrace[]> {
  return prisma.conversationTrace.findMany({ where: { evalScore: null } });
}

// ✅ AFTER
async getTraces(tenantId: string): Promise<ConversationTrace[]> {
  return prisma.conversationTrace.findMany({
    where: { tenantId, evalScore: null }
  });
}
```

### Solution 3: Promise Cleanup

```typescript
// ❌ BEFORE
this.promises = this.promises.filter((p) => !p.settled); // doesn't work

// ✅ AFTER
await Promise.allSettled(this.promises);
this.promises = [];
```

### Solution 4: Type Safety

```typescript
// ❌ BEFORE
const messages = (trace.messages as TracedMessage[])!;

// ✅ AFTER
const messages = (trace.messages as unknown as TracedMessage[]) || [];
```

### Solution 8: PII Redactor

```typescript
// ❌ BEFORE
// Duplicated in pipeline.ts and review-queue.ts

// ✅ AFTER
import { redactMessages, redactToolCalls } from '../../lib/pii-redactor';
```

### Solution 9: N+1 Query

```typescript
// ❌ BEFORE
for (const item of items) {
  await prisma.item.update({ where: { id: item.id }, data: {...} });
}

// ✅ AFTER
await prisma.item.updateMany({
  where: { id: { in: items.map(i => i.id) } },
  data: {...}
});
```

### Solution 12: CLI Validation

```typescript
// ❌ BEFORE
options.tenantId = arg.split('=')[1]?.trim();

// ✅ AFTER
const schema = z.object({ tenantId: z.string().uuid() });
const result = schema.safeParse(value);
if (!result.success) { console.error(...); process.exit(1); }
```

### Solution 14: Test Skips

```typescript
// ❌ BEFORE
it('should not leak', () => {
  if (!tableExists) return;
  // test body
});

// ✅ AFTER
it.skipIf(!tableExists)('should not leak', () => {
  // test body
});
```

---

## File Locations

**Core Implementations:**

- `server/src/agent/evals/pipeline.ts` - Solutions 1, 2, 3, 4, 7
- `server/src/agent/evals/evaluator.ts` - Solution 1
- `server/src/agent/feedback/review-queue.ts` - Solutions 2, 4, 9
- `server/src/lib/pii-redactor.ts` - Solution 8
- `server/src/lib/errors/agent-eval-errors.ts` - Solution 5
- `server/prisma/schema.prisma` - Solution 6
- `server/scripts/run-eval-batch.ts` - Solutions 11, 12, 15
- `server/src/jobs/cleanup.ts` - Solution 10
- `server/src/di.ts` - Solution 13
- `server/test/agent-eval/tenant-isolation.test.ts` - Solution 14

---

## Learning Path

**5 minutes:** Read this summary (you are here)
**15 minutes:** Read full solution document
**30 minutes:** Implement in your code
**1 hour:** Complete code review checklist

Start: [Full Solutions Extract](./Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md)

---

## Key Stats

| Metric                          | Value                                      |
| ------------------------------- | ------------------------------------------ |
| **Total Solutions**             | 15                                         |
| **Security Issues**             | 2 (multi-tenant, defense-in-depth)         |
| **Performance Issues**          | 3 (indexes, N+1, parallelization)          |
| **Code Quality Issues**         | 5 (DI, types, duplication, testing)        |
| **Commits**                     | 4 (fcf6004c, 39d9695f, 458702e7, face8697) |
| **Lines of Code Added**         | ~500 (including tests)                     |
| **Lines Removed (duplication)** | ~200                                       |
| **Test Coverage**               | 99.7% (1196/1200 tests pass)               |

---

## Related Documentation

- Full Solutions: [Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md](./Phase-6-7-Agent-Evaluation-Solutions-Extract-MAIS-20260102.md)
- Phase 1-4 Details: [agent-evaluation-system-remediation-MAIS-20260102.md](./agent-evaluation-system-remediation-MAIS-20260102.md)
- Phase 7 Prevention: [patterns/P2_AGENT_EVAL_SUMMARY-MAIS-20260102.md](./patterns/P2_AGENT_EVAL_SUMMARY-MAIS-20260102.md)

---

**Last Updated:** 2026-01-02
**Quick Reference Version:** 1.0
