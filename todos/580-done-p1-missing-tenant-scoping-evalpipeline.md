---
status: open
priority: p1
issue_id: '580'
tags: [code-review, security, agent-eval, tenant-isolation]
dependencies: []
created_at: 2026-01-02
---

# P1: Missing Tenant Scoping in EvalPipeline Database Queries

> **Security Review:** Critical tenant isolation violation. Database queries in EvalPipeline bypass multi-tenant scoping.

## Problem Statement

The `EvalPipeline.submit()` and `getUnevaluatedTraces()` methods query `ConversationTrace` by ID without tenant scoping. This violates MAIS multi-tenant isolation principles.

**Files:**

- `/server/src/agent/evals/pipeline.ts` (lines 206-208, 261-275)

**Evidence:**

```typescript
// Line 206-208 - Missing tenantId in query
const trace = await this.prisma.conversationTrace.findUnique({
  where: { id: traceId }, // CRITICAL: No tenantId check
});

// Line 261-272 - No tenantId filter
const traces = await this.prisma.conversationTrace.findMany({
  where: {
    evalScore: null,
    // No tenantId filter - returns traces from ALL tenants!
  },
});
```

**Risk:** If `traceId` is guessable or leaked, any caller could trigger evaluation of traces from other tenants. The `getUnevaluatedTraces()` returns traces across ALL tenants.

## Findings

| Reviewer           | Finding                                                     |
| ------------------ | ----------------------------------------------------------- |
| Security Review    | P1: Missing tenant scoping in EvalPipeline database queries |
| Performance Review | P1: Unbounded cross-tenant query in getUnevaluatedTraces    |

## Proposed Solution

Add `tenantId` parameter and filter to all EvalPipeline methods:

```typescript
async submit(tenantId: string, traceId: string): Promise<void> {
  const trace = await this.prisma.conversationTrace.findFirst({
    where: { id: traceId, tenantId },
  });
  if (!trace) throw new Error('Trace not found or access denied');
}

async getUnevaluatedTraces(tenantId: string, limit = 100): Promise<string[]> {
  const traces = await this.prisma.conversationTrace.findMany({
    where: {
      tenantId,  // Add tenant scoping
      evalScore: null,
      startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
  return traces.map(t => t.id);
}
```

## Acceptance Criteria

- [ ] All EvalPipeline queries include tenantId filter
- [ ] Tests verify tenant isolation
- [ ] getUnevaluatedTraces requires tenantId parameter

## Work Log

| Date       | Action                         | Learnings                                |
| ---------- | ------------------------------ | ---------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Security + Performance reviewers flagged |
