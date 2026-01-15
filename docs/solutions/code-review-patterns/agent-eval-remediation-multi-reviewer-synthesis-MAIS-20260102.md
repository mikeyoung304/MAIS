# Agent Evaluation Remediation: Multi-Agent Review Synthesis

**Date:** 2026-01-02
**Status:** COMPLETE (Phases 1-4)
**Campaign:** Agent Evaluation System v1
**Reviewers:** DHH-Rails, Kieran-TypeScript, Security-Sentinel, Performance-Oracle, Data-Integrity-Guardian, Architecture-Strategist, Code-Simplicity-Reviewer

---

## Executive Summary

The Agent Evaluation System underwent comprehensive review by 7 parallel agents via `/workflows:review`. This produced 21 findings mapped to todos 580-600. Sessions 1-2 resolved all P1 critical issues through phased remediation.

### Key Metrics

| Metric         | Value         |
| -------------- | ------------- |
| Total Findings | 21            |
| P1 Critical    | 7 (all fixed) |
| P2 Important   | 9 (pending)   |
| P3 Minor       | 5 (pending)   |
| Files Modified | 30+           |
| Tests Passing  | 99.7%         |

---

## The Multi-Agent Review Workflow

### How It Works

```bash
/workflows:review plans/agent-eval-remediation-plan.md \
  --context "Review with highest standards"
```

This invokes 7 specialized reviewers in parallel:

1. **DHH-Rails** - Pragmatism, scope, "memory is cheap, clarity is expensive"
2. **Kieran-TypeScript** - DI patterns, type safety, constructor ordering
3. **Security-Sentinel** - Tenant isolation, PII handling, validation guards
4. **Performance-Oracle** - Query patterns, N+1, resource exhaustion
5. **Data-Integrity-Guardian** - Schema design, orphan records, indexes
6. **Architecture-Strategist** - Layer violations, coupling, system design
7. **Code-Simplicity-Reviewer** - Cognitive load, over-engineering

### Review Output Format

Each reviewer produces findings with:

- **Severity:** P1/P2/P3
- **Finding:** Problem statement + code reference
- **Recommendation:** Specific fix + file location
- **Mapping:** Creates todo file (todo-NNN)

---

## Critical Patterns Discovered

### Pattern 1: DI Constructor Ordering (Kieran)

**Problem:** Evaluator required `ANTHROPIC_API_KEY` environment variable, blocking tests.

**Solution:** Dependencies before config in constructor.

```typescript
// ✅ Kieran's pattern: Dependencies first, config second
constructor(
  anthropic?: Anthropic,        // ← Dependency (injectable)
  config: Partial<Config> = {}  // ← Config (with defaults)
) {
  if (!anthropic && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required when no client provided');
  }
  this.anthropic = anthropic ?? new Anthropic({ ... });
}
```

**Key Insight:** Make dependencies required in class, optional in factory.

---

### Pattern 2: Settle-and-Clear for Promises (DHH)

**Problem:** Tried to filter completed promises synchronously—doesn't work because Promise objects have no completion flag.

**Solution:** DHH's pattern: "Memory is cheap, clarity is expensive."

```typescript
// ❌ BROKEN - Promises can't be filtered by status
this.pending = this.pending.filter(p => p.status !== 'fulfilled');

// ✅ DHH's settle-and-clear pattern
async drainCompleted(): Promise<void> {
  await Promise.allSettled(this.pendingEvaluations);
  this.pendingEvaluations = [];  // Clear completely
}
```

**Key Insight:** Don't try to be clever. Settle everything, then clear.

---

### Pattern 3: Tenant Scoping Enforcement (Security-Sentinel)

**Problem:** `EvalPipeline.getUnevaluatedTraces()` returned traces across ALL tenants.

**Solution:** Every public method requires `tenantId` as first parameter.

```typescript
// ✅ Tenant-scoped query pattern
async getUnevaluatedTraces(tenantId: string, limit = 100): Promise<string[]> {
  if (!tenantId) throw new Error('tenantId required');

  return this.prisma.conversationTrace.findMany({
    where: {
      tenantId,  // ✅ CRITICAL: Always scope by tenant
      evalScore: null,
    },
  });
}
```

**Key Insight:** Multi-tenant isolation is P0 security. No exceptions.

---

### Pattern 4: Prisma 7 JSON Type Casting

**Problem:** Prisma 7 made JSON field types stricter. Direct casting fails.

**Solution:** Cast through `unknown` for reads.

```typescript
// ❌ BROKEN - Prisma 7 type error
const messages = trace.messages as TracedMessage[];

// ✅ CORRECT - Cast through unknown
const messages = (trace.messages as unknown as TracedMessage[]) || [];
```

**Key Insight:** See [Prisma 7 JSON Breaking Changes](../database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md).

---

### Pattern 5: Type Guards Over Assertions

**Problem:** Used `!` non-null assertions to bypass type checks.

**Solution:** Type predicates for filter narrowing.

```typescript
// ❌ UNSAFE - Bypasses null check
const score = trace.evalScore!;

// ✅ SAFE - Type predicate
function hasScores(a: Action): a is Action & { correctedScore: number } {
  return a.correctedScore !== null;
}

const withScores = actions.filter(hasScores);
// TypeScript knows withScores[i].correctedScore is number
```

---

### Pattern 6: Domain Error Classes

**Problem:** Generic `Error` class prevents type-safe error handling.

**Solution:** Domain errors with HTTP status codes.

```typescript
export class TraceNotFoundError extends AppError {
  constructor(traceId: string) {
    super(`Trace not found: ${traceId}`, 'TRACE_NOT_FOUND', 404, true);
  }
}

// Usage with type guard
if (isTraceNotFoundError(error)) {
  return { status: 404, body: { error: error.message } };
}
```

---

## Reviewer Consensus vs. Divergence

### Where Reviewers Agreed (Unanimous)

| Finding                     | All Reviewers |
| --------------------------- | ------------- |
| Tenant scoping is P0        | ✅            |
| DI violations block testing | ✅            |
| Promise cleanup was broken  | ✅            |
| Missing database index      | ✅            |

### Where Reviewers Diverged

| Topic             | DHH                | Kieran           | Resolution                    |
| ----------------- | ------------------ | ---------------- | ----------------------------- |
| Promise cleanup   | "Settle and clear" | WeakSet tracking | Followed DHH (simpler)        |
| A/B testing       | Defer to V2        | Implement now    | Deferred (pragmatism)         |
| Error granularity | Generic is fine    | Domain errors    | Followed Kieran (type safety) |

---

## Prevention Checklist

Use this checklist before merging agent-related code:

### Security

- [ ] All queries include `tenantId` in WHERE clause
- [ ] Cross-tenant access explicitly throws error
- [ ] PII fields use encryption middleware
- [ ] Error messages don't leak sensitive data

### DI & Testing

- [ ] Dependencies are constructor parameters (optional in factory)
- [ ] No `process.env` access in class constructors
- [ ] Mock injection works without environment variables

### Type Safety

- [ ] No `!` non-null assertions (use type guards)
- [ ] JSON fields use `as unknown as Type` pattern
- [ ] Domain errors have type predicates

### Performance

- [ ] Queries have matching database indexes
- [ ] No N+1 patterns (use batch loading)
- [ ] Promise arrays use settle-and-clear

### Code Quality

- [ ] Magic numbers extracted to named constants
- [ ] No `console.log` (use logger)
- [ ] Test mocks use `mockDeep<T>()` not `as any`

---

## Related Documentation

| Document                                                                                           | Purpose                |
| -------------------------------------------------------------------------------------------------- | ---------------------- |
| [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)                                    | 10 essential patterns  |
| [Prisma 7 JSON Types](../database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md)     | JSON field casting     |
| [Phase 5 Testing Prevention](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)  | Test error patterns    |
| [Circular Dependency Registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md) | Breaking import cycles |

---

## Commits

| Hash    | Message                                                     | Date       |
| ------- | ----------------------------------------------------------- | ---------- |
| 458702e | feat(agent-eval): continue remediation with Prisma 7 fixes  | 2026-01-02 |
| 346ee79 | docs(plan): update remediation plan with session 1 progress | 2026-01-02 |
| face869 | feat(agent-eval): implement remediation plan phases 1-4     | 2026-01-02 |

---

## The Compound Philosophy

This documentation captures learnings that compound:

1. **First time:** Debug DI violation → 30 minutes research
2. **Document it:** This file → 5 minutes
3. **Next occurrence:** Quick lookup → 2 minutes
4. **Knowledge compounds:** Team gets smarter

The feedback loop:

```
Review → Find Issue → Research → Fix → Document → Prevent → Deploy
    ↑                                                          ↓
    └──────────────────────────────────────────────────────────┘
```

---

**Generated:** 2026-01-02 | **Method:** `/workflows:compound` | **Reviewers:** DHH, Kieran, 7 agents
