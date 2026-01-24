---
status: complete
priority: p1
issue_id: '5234'
tags: [code-review, performance, project-hub, database]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Sequential Database Queries in bootstrapTenant - 4x Latency

> **Performance Review:** Dashboard bootstrap makes 4 sequential DB calls instead of parallel.

## Problem Statement

The `bootstrapTenant` method executes 4 database queries sequentially, causing 4x the necessary latency. This impacts every tenant dashboard page load.

**File:** `server/src/services/project-hub.service.ts`
**Lines:** 231-268

**Evidence:**

```typescript
async bootstrapTenant(tenantId: string): Promise<TenantBootstrapResult> {
  // Query 1: Get tenant
  const tenant = await this.prisma.tenant.findUnique({...});

  // Query 2: Count active projects
  const activeProjectCount = await this.prisma.project.count({...});

  // Query 3: Count pending requests
  const pendingRequestCount = await this.prisma.projectRequest.count({...});

  // Query 4: Count recent activity
  const recentActivityCount = await this.prisma.projectEvent.count({...});
}
```

**Impact:** If each query takes 10ms, total time is 40ms instead of ~10ms with parallel execution. This compounds under load.

## Findings

| Reviewer           | Finding                                                        |
| ------------------ | -------------------------------------------------------------- |
| Performance Oracle | P1: 4 sequential queries should run in parallel                |
| Architecture       | Observation: All queries are independent, no data dependencies |

## Proposed Solution

Use `Promise.all` to parallelize all independent queries:

```typescript
async bootstrapTenant(tenantId: string): Promise<TenantBootstrapResult> {
  const [tenant, activeProjectCount, pendingRequestCount, recentActivityCount] = await Promise.all([
    this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessName: true },
    }),
    this.prisma.project.count({
      where: { tenantId, status: 'ACTIVE' },
    }),
    this.prisma.projectRequest.count({
      where: { tenantId, status: 'PENDING' },
    }),
    this.prisma.projectEvent.count({
      where: {
        project: { tenantId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  if (!tenant) {
    throw new NotFoundError(`Tenant ${tenantId} not found`);
  }

  return {
    activeProjectCount,
    pendingRequestCount,
    recentActivityCount,
    greeting: `Welcome back, ${tenant.businessName || 'there'}!`,
  };
}
```

**Pros:** ~75% latency reduction, simple change
**Cons:** None
**Effort:** Small (15 minutes)
**Risk:** Low

## Technical Details

**Affected Files:**

- `server/src/services/project-hub.service.ts` (bootstrapTenant method)

**Acceptance Criteria:**

- [ ] All 4 queries execute in parallel via Promise.all
- [ ] Error handling preserved (NotFoundError if tenant missing)
- [ ] Response time reduced by >50% in benchmarks
- [ ] No change to API response shape

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | Always parallelize independent queries |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
