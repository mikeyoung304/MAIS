# Over-Engineering Detection Quick Reference

**Print this. Pin it. Check before shipping "enterprise-grade" code.**

---

## Red Flag Signals

### Signal 1: Custom Implementation of Installed Library

```bash
# Detection
npm ls lru-cache && grep -r "class.*Cache" server/src/
npm ls retry && grep -r "class.*Retry" server/src/
npm ls p-queue && grep -r "class.*Queue" server/src/
```

**Ask:** Is there a 200+ line file doing what a 10-line library call could do?

---

### Signal 2: Module with <20% Usage

```bash
# Detection: Count exports vs actual imports
grep -c "export function" module.ts  # e.g., 7 functions
grep -rn "functionName" . --include="*.ts" | grep -v "module.ts" | wc -l  # e.g., 1 usage
```

**Ask:** Are 6 of 7 functions "just in case" for future auditing/logging/metrics?

---

### Signal 3: Multiple Concurrency Controls

```typescript
// Smell: Three protections for same thing
await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`; // Lock #1
    if (version !== expected) throw 'VERSION_MISMATCH'; // Lock #2
  },
  { isolationLevel: 'Serializable' }
); // Lock #3
```

**Ask:** Is advisory lock OR optimistic lock OR Serializable sufficient alone?

---

### Signal 4: In-Memory Metrics Without Export

```typescript
// Smell: Metrics stored in memory, never exported to observability
private metrics = { sessionCount: 0, errorRate: 0 };
recordSession() { this.metrics.sessionCount++; }
// getMetrics() never called, lost on restart
```

**Ask:** Will anyone ever look at these metrics? Are they integrated with Datadog/Prometheus?

---

### Signal 5: O(n) in Hot Path

```typescript
// Smell: Array.shift() in frequently-called code
recordLatency(ms: number) {
  this.latencies.push(ms);
  if (this.latencies.length > 1000) this.latencies.shift();  // O(1000) every call!
}
```

**Ask:** Is this called on every request? Is array size >100?

---

## Quick Decision Trees

### Need Concurrency Control?

```
Preventing double-execution?
├─ Same process → mutex/semaphore
└─ Distributed → Advisory lock (pg_advisory_xact_lock)
     └─ Use ReadCommitted, NOT Serializable

Detecting stale writes?
├─ YES → Optimistic locking (version field)
└─ NO → No version tracking needed
```

### Need Custom Cache?

```
Is lru-cache installed?
├─ YES → Use it (10 lines vs 200+)
└─ NO → npm install lru-cache, then use it
```

### Need Audit Trail?

```
Is it for compliance/legal?
├─ YES → Database table with proper retention
└─ NO → Is structured logging enough?
         ├─ YES → logger.info({ event, context })
         └─ NO → Integrate with observability (Datadog, etc.)
```

### Need Metrics?

```
Will anyone look at them?
├─ NO → Don't build them
└─ YES → Are they integrated with observability?
          ├─ YES → Good
          └─ NO → Either integrate or don't bother
```

---

## Line Count Heuristics

| Feature Type  | Reasonable            | Smell   | Over-Engineered |
| ------------- | --------------------- | ------- | --------------- |
| LRU Cache     | 10-30                 | 50-100  | >100            |
| Audit Logging | 0 (use logger)        | 20-50   | >50             |
| Metrics       | 0 (use observability) | 30-60   | >100            |
| Repository    | 50-150                | 200-300 | >300            |
| Service       | 100-200               | 300-400 | >500            |

---

## Before "Enterprise-Grade" Implementation

1. [ ] Check npm for existing library
2. [ ] Estimate final line count
3. [ ] Identify minimum viable protection level
4. [ ] Delete "just in case" modules before merge
5. [ ] Run simplicity agent review

---

## Related

- Full analysis: `docs/solutions/code-review-patterns/MULTI_AGENT_CODE_REVIEW_PATTERNS.md`
- Security patterns: `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md`
- CLAUDE.md Pitfalls: #71-74 (over-engineering signals)
