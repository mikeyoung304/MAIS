---
status: pending
priority: p2
issue_id: '555'
tags: [code-review, performance, architecture, agent-ecosystem]
dependencies: []
---

# P2: Dynamic Imports for Executor Registry Add Latency

## Problem Statement

The `executeConfirmedProposals()` method uses dynamic imports:

```typescript
// base-orchestrator.ts:596-597
const { getProposalExecutor } = await import('../proposals/executor-registry');
const { validateExecutorPayload } = await import('../proposals/executor-schemas');
```

This is called on every `chat()` that has soft-confirmed T2 proposals. While Node.js caches modules, the async import overhead adds **~1-5ms latency** per proposal execution batch.

**Why it matters:** This adds latency to the critical path for every chat turn with proposals. The dynamic import was added to avoid circular dependencies, but the executor-registry refactor should have resolved that.

## Findings

| Reviewer              | Finding                                                       |
| --------------------- | ------------------------------------------------------------- |
| Performance Reviewer  | P2: Dynamic imports add latency in hot path                   |
| Architecture Reviewer | P2: Circular dependency should be fixed at architecture level |
| Simplicity Reviewer   | Dynamic import workaround noted                               |

## Proposed Solutions

### Option 1: Test Static Imports (Recommended)

**Effort:** Small (30 minutes)

Try converting to static imports to verify the circular dependency is resolved:

```typescript
// base-orchestrator.ts - top of file
import { getProposalExecutor } from '../proposals/executor-registry';
import { validateExecutorPayload } from '../proposals/executor-schemas';
```

Then run `npx madge --circular server/src/agent/` to verify no cycles.

**Pros:**

- Eliminates async overhead
- Cleaner code

**Cons:**

- May re-introduce circular dependency (test first)

### Option 2: Lazy-Load Once Pattern

**Effort:** Small (1 hour)

Load dynamically once, then cache:

```typescript
private executorRegistry: typeof import('../proposals/executor-registry') | null = null;

private async getExecutorRegistry() {
  if (!this.executorRegistry) {
    this.executorRegistry = await import('../proposals/executor-registry');
  }
  return this.executorRegistry;
}
```

**Pros:**

- Only one dynamic import per process
- Maintains separation if needed

**Cons:**

- Still async on first call

## Recommended Action

Try **Option 1** first. If it causes cycles, fall back to **Option 2**.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts`

**Current Performance:**

- `await import()` called every `chat()` with proposals
- Node.js module cache hit, but async overhead remains

**Verification Command:**

```bash
npx madge --circular server/src/agent/
```

## Acceptance Criteria

- [ ] Convert to static imports if circular dependency resolved
- [ ] Verify no circular dependencies with madge
- [ ] If static fails, implement lazy-load-once pattern
- [ ] Verify no latency regression

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-01 | Created from code review | Performance/Architecture reviewers flagged |

## Resources

- Executor registry refactor: `server/src/agent/proposals/executor-registry.ts`
- Circular dep prevention doc: `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`
