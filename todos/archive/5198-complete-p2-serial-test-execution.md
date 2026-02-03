---
status: ready
priority: p2
issue_id: '5198'
tags: [code-review, testing, performance, database]
dependencies: []
---

# Serial Test Execution Due to Connection Pool Exhaustion

## Problem Statement

All tests run serially (`singleThread: true`, `fileParallelism: false`) because of Supabase connection pool limits. This significantly slows CI.

## Findings

**Location:** `server/vitest.config.ts` lines 30-34

```typescript
poolOptions: {
  threads: { singleThread: true },
},
fileParallelism: false,
```

**Root cause:** Supabase Session mode has strict pool limits. Rather than fixing connection management, tests were serialized.

## Proposed Solutions

### Option A: Split Vitest Configs (Recommended)

- `vitest.config.unit.ts` - Parallel, no database (uses fakes)
- `vitest.config.integration.ts` - Sequential, real database

**Effort:** Medium (2-3 hours) | **Risk:** Low

### Option B: Connection Pooling

Add pgBouncer or test-specific connection pool configuration.

**Effort:** Large | **Risk:** Medium

## Acceptance Criteria

- [ ] Unit tests run in parallel
- [ ] Integration tests remain isolated
- [ ] CI time reduced by 30%+
