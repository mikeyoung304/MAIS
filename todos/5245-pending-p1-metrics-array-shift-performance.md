---
status: pending
priority: p1
issue_id: '5245'
tags: [code-review, performance]
dependencies: []
---

# P1: Array.shift() in Metrics Collector is O(n) Operation

## Problem Statement

The metrics collector uses `Array.shift()` to maintain a rolling window of latency samples. `Array.shift()` is O(n) because it must reindex all remaining elements. With `maxSamples = 1000`, every latency recording after the first 1000 samples triggers a 1000-element array shift.

**Why it matters:** At high request rates (100+ req/s), this burns significant CPU cycles. The metrics collector is called on every get/append operation.

## Findings

**File:** `server/src/services/session/session.metrics.ts:122-123, 129-130`

```typescript
recordGetLatency(ms: number): void {
  this.getLatencies.push(ms);
  if (this.getLatencies.length > this.maxSamples) {
    this.getLatencies.shift(); // O(n) - shifts ALL elements
  }
  // ...
}
```

**Impact:** After 1000 samples, every new sample triggers an O(1000) operation.

## Proposed Solutions

### Option A: Ring Buffer (Recommended)

**Pros:** O(1) operations, no reindexing
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

```typescript
private getLatencies: number[] = new Array(1000).fill(0);
private getLatencyIndex = 0;
private getLatencyCount = 0;

recordGetLatency(ms: number): void {
  this.getLatencies[this.getLatencyIndex] = ms;
  this.getLatencyIndex = (this.getLatencyIndex + 1) % this.maxSamples;
  this.getLatencyCount = Math.min(this.getLatencyCount + 1, this.maxSamples);
  // Calculate average considering only valid samples
}
```

### Option B: Delete the metrics module entirely

**Pros:** Removes ~293 lines of code, follows simplicity review recommendation
**Cons:** Lose metrics capability (though it's barely used)
**Effort:** Small
**Risk:** Low - metrics are not critical to functionality

### Option C: Use a proper metrics library

**Pros:** Battle-tested, integrates with observability tools
**Cons:** New dependency
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option B is preferred by simplicity review, but if metrics are retained, Option A fixes the performance issue.

## Technical Details

**Affected files:**

- `server/src/services/session/session.metrics.ts`

## Acceptance Criteria

- [ ] If metrics retained: latency recording is O(1)
- [ ] Existing functionality unchanged
- [ ] Performance verified under load

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [Ring Buffer Pattern](https://en.wikipedia.org/wiki/Circular_buffer)
