---
status: complete
priority: p2
issue_id: '5248'
tags: [code-review, simplicity, dead-code]
dependencies: ['5245']
triage_batch: 1
triage_decision: RESOLVE - Delete module, also fixes P1 5245 (293 lines removed)
---

# P2: Metrics Module is Mostly Unused

## Problem Statement

A 293-line custom metrics collector that:

1. Stores metrics in memory (lost on restart)
2. Has no integration with actual observability tools
3. Has many unused functions

**Why it matters:** Premature optimization that adds complexity without value.

## Findings

**File:** `server/src/services/session/session.metrics.ts` (293 lines)

**What's actually used:**

```
sessionMetrics.recordSessionCreated() → 1 usage
sessionMetrics.recordSessionRestored() → 1 usage
sessionMetrics.recordConcurrentModification() → 1 usage
sessionMetrics.recordMessageAppended() → 2 usages
sessionMetrics.recordError() → 1 usage
sessionMetrics.recordSessionDeleted() → 1 usage
```

**What's never called:**

- `recordCacheHit()` / `recordCacheMiss()` - defined but never called
- `timeGetOperation()` / `timeAppendOperation()` - helper functions never called
- `recordGetLatency()` / `recordAppendLatency()` - never called
- `getCacheHitRate()` / `getErrorRate()` - never called

**Additional issues:**

- In-memory counters are useless for multi-node deployment
- setInterval for logging is a memory leak pattern (no cleanup on hot reload)
- If metrics needed, should integrate with Datadog/Prometheus/CloudWatch

## Proposed Solutions

### Option A: Delete metrics module entirely (Recommended)

**Pros:** Removes 293 lines, follows simplicity principle
**Cons:** Lose metrics capability (though barely used)
**Effort:** Small
**Risk:** Low

### Option B: Keep only used functions

**Pros:** Reduces dead code
**Cons:** Still maintains unnecessary abstraction
**Effort:** Small
**Risk:** Low

### Option C: Integrate with real observability

**Pros:** Production-grade metrics
**Cons:** More work, new dependencies
**Effort:** Large
**Risk:** Medium

## Recommended Action

Option A - Delete the metrics module. If metrics are needed later, integrate with proper observability tooling.

## Technical Details

**Affected files:**

- Delete: `server/src/services/session/session.metrics.ts`
- Update: `server/src/services/vertex-agent.service.ts` (remove metrics calls or keep as no-ops)
- Update: `server/src/services/session/index.ts` (remove export)

**Lines saved:** ~293

## Acceptance Criteria

- [ ] Metrics module deleted or significantly simplified
- [ ] No runtime errors
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
