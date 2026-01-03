---
status: open
priority: p1
issue_id: '581'
tags: [code-review, performance, agent-eval, memory-leak]
dependencies: []
created_at: 2026-01-02
---

# P1: Broken Promise Cleanup Logic Causes Memory Leak

> **Performance Review:** The promise cleanup logic in both tracer.ts and pipeline.ts has a fundamental bug that prevents cleanup from working.

## Problem Statement

The cleanup logic for pending promises has a race condition/logic bug that prevents it from ever filtering out resolved promises.

**Files:**

- `/server/src/agent/evals/pipeline.ts` (lines 366-378)
- `/server/src/agent/tracing/tracer.ts` (lines 340-351)

**Evidence in pipeline.ts:**

```typescript
private cleanupPendingEvaluations(): void {
  if (this.pendingEvaluations.length > 50) {
    this.pendingEvaluations = this.pendingEvaluations.filter((p) => {
      let resolved = false;
      p.then(
        () => (resolved = true),
        () => (resolved = true)
      );
      return !resolved;  // BUG: Always returns true - sync check of async!
    });
  }
}
```

**Why it fails:** The `.then()` callback is async, but `return !resolved` executes synchronously. The `resolved` variable will ALWAYS be `false` at the point of return.

**Impact:** Unbounded array growth leading to memory leak under high load.

## Findings

| Reviewer            | Finding                                                 |
| ------------------- | ------------------------------------------------------- |
| Performance Review  | P1: Broken promise cleanup (never works) in pipeline.ts |
| Performance Review  | P1: Promise cleanup race condition in tracer.ts         |
| Architecture Review | P2: Tracer state management could leak memory           |

## Proposed Solution

Replace with proper promise tracking:

```typescript
// Option 1: Track completed promises via Set
private resolvedPromises = new WeakSet<Promise<void>>();

private async submitAsync(traceId: string): Promise<void> {
  const promise = this.doEvaluation(traceId);
  this.pendingEvaluations.push(promise);
  promise.finally(() => {
    this.resolvedPromises.add(promise);
    this.cleanupPendingEvaluations();
  });
}

private cleanupPendingEvaluations(): void {
  if (this.pendingEvaluations.length > 50) {
    this.pendingEvaluations = this.pendingEvaluations.filter(
      p => !this.resolvedPromises.has(p)
    );
  }
}

// Option 2: Simple clear when flush
async flush(): Promise<void> {
  await Promise.allSettled(this.pendingEvaluations);
  this.pendingEvaluations = [];
}
```

## Acceptance Criteria

- [ ] Promise cleanup actually removes resolved promises
- [ ] No memory leak under sustained load
- [ ] Test verifies cleanup with 100+ pending promises

## Work Log

| Date       | Action                         | Learnings                                 |
| ---------- | ------------------------------ | ----------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Performance reviewer identified logic bug |
