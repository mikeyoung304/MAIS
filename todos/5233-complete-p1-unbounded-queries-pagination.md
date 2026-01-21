---
status: resolved
priority: p1
issue_id: '5233'
tags: [code-review, performance, project-hub, database]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Unbounded Database Queries - Missing Pagination in listProjects and getPendingRequests

> **Performance Review:** Large tenants will experience timeouts and memory exhaustion.

## Problem Statement

The `listProjects` and `getPendingRequests` methods have no pagination or limit, returning ALL matching records. For large tenants (500+ projects, 100+ pending requests), this will cause:

- Memory exhaustion on server
- Slow API response (5-10+ seconds)
- Large payload size (100KB+)

**File:** `server/src/services/project-hub.service.ts`

### listProjects (Lines 714-758)

```typescript
async listProjects(tenantId: string, status?: ProjectStatus): Promise<Array<ProjectWithBooking>> {
  const projects = await this.prisma.project.findMany({
    where: whereClause,
    include: {...}, // Full booking/customer/package includes
    orderBy: { createdAt: 'desc' },
    // NO LIMIT - returns ALL projects!
  });
}
```

### getPendingRequests (Lines 396-440)

```typescript
async getPendingRequests(tenantId: string): Promise<ProjectRequestWithContext[]> {
  const requests = await this.prisma.projectRequest.findMany({
    where: { tenantId, status: 'PENDING' },
    include: {...}, // Full project with booking, customer, package
    orderBy: { createdAt: 'asc' },
    // NO LIMIT - returns ALL pending requests!
  });
}
```

**Risk:** API timeouts, poor UX, potential OOM crashes for large tenants.

## Findings

| Reviewer           | Finding                                                |
| ------------------ | ------------------------------------------------------ |
| Performance Oracle | P1: Unbounded query in listProjects - no pagination    |
| Performance Oracle | P1: Unbounded query in getPendingRequests              |
| Data Integrity     | P2: Large result sets could cause transaction timeouts |

## Proposed Solutions

### Option A: Cursor-Based Pagination (Recommended)

```typescript
async listProjects(
  tenantId: string,
  status?: ProjectStatus,
  cursor?: string,
  limit: number = 50
): Promise<{ projects: ProjectWithBooking[]; nextCursor?: string }> {
  const projects = await this.prisma.project.findMany({
    where: whereClause,
    include: {...},
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one extra to check if more exist
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  const hasMore = projects.length > limit;
  const items = hasMore ? projects.slice(0, -1) : projects;

  return {
    projects: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}
```

**Pros:** Efficient for large datasets, consistent performance
**Cons:** Requires frontend pagination UI
**Effort:** Medium (2-3 hours backend + frontend)
**Risk:** Low

### Option B: Simple Limit with "Load More"

```typescript
async listProjects(
  tenantId: string,
  status?: ProjectStatus,
  limit: number = 100
): Promise<{ projects: ProjectWithBooking[]; hasMore: boolean }> {
  const projects = await this.prisma.project.findMany({
    where: whereClause,
    take: limit + 1,
    // ...
  });
  return {
    projects: projects.slice(0, limit),
    hasMore: projects.length > limit,
  };
}
```

**Pros:** Simple implementation, minimal frontend changes
**Cons:** Still loads first N records in full
**Effort:** Small (1 hour)
**Risk:** Low

## Recommended Action

**Option A** for listProjects (cursor-based pagination) - projects list will grow continuously.

**Option B** for getPendingRequests (simple limit of 25-50) - pending requests should be kept low through timely processing.

## Technical Details

**Affected Files:**

- `server/src/services/project-hub.service.ts` (service methods)
- `server/src/routes/tenant-admin-projects.routes.ts` (route handlers)
- `apps/web/src/app/(protected)/tenant/projects/page.tsx` (frontend pagination UI)

**Acceptance Criteria:**

- [ ] listProjects returns max 50 records per page with cursor
- [ ] getPendingRequests returns max 25 records with hasMore flag
- [ ] Frontend shows pagination controls or "Load More" button
- [ ] API response time < 500ms for paginated queries
- [ ] Tests verify pagination behavior

## Work Log

| Date       | Action                          | Learnings                                     |
| ---------- | ------------------------------- | --------------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | All list queries need pagination from day one |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- Prisma cursor-based pagination: https://www.prisma.io/docs/concepts/components/prisma-client/pagination
