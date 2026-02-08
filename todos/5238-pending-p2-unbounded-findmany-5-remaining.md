---
status: pending
priority: p2
issue_id: '5238'
tags: [code-review, performance, database, enterprise-review]
dependencies: []
---

# 5 Remaining Unbounded findMany Calls (Pitfall #60)

## Problem Statement

PR #42 added `take` limits to 14 `findMany` calls, but 5 remain unbounded. As data grows, these become increasingly expensive and can cause OOM or slow responses.

**Why it matters:** Violates project's own Pitfall #60 rule. A tenant with 100+ packages or a project with 500+ timeline events will degrade performance.

## Findings

**Source:** Performance Oracle review (PR #42, 2026-02-08)

| File                          | Method                            | Risk                                    |
| ----------------------------- | --------------------------------- | --------------------------------------- |
| `catalog.repository.ts:23`    | `getAllPackages()`                | Public route + agent context (hot path) |
| `catalog.repository.ts:32`    | `getAllPackagesWithAddOns()`      | Public route (hot path)                 |
| `catalog.repository.ts:163`   | `getAllAddOns()`                  | Agent context                           |
| `service.repository.ts:14,26` | `getAll()`, `getActiveServices()` | Public storefront + agent context       |
| `project-hub.service.ts:483`  | `getTimeline()`                   | Timeline endpoint (grows over months)   |

**Note:** `tenant.repository.ts` `list()` and `listWithStats()` are also unbounded but admin-only (lower priority).

## Proposed Solutions

### Option A: Add take limits with business justification (Recommended)

- Catalog: `take: 100` (most tenants have <20 packages — business constraint)
- Services: `take: 50`
- Timeline: `take: 100` with cursor pagination
- Return `hasMore` indicator on all
- **Pros:** Simple, follows pattern from PR #42
- **Cons:** May need frontend pagination for timeline
- **Effort:** Small (add `take` to 5 methods)
- **Risk:** Low

### Option B: Document cardinality bounds

- If business rules guarantee low cardinality (e.g., max 20 packages per tenant), document it and skip `take`
- **Pros:** No code change
- **Cons:** Assumption may break as platform grows
- **Effort:** Minimal
- **Risk:** Medium (assumptions can be wrong)

## Acceptance Criteria

- [ ] All 5 methods have `take` parameter
- [ ] `hasMore` returned where applicable
- [ ] `grep -rn 'findMany' server/src/adapters/prisma/ | grep -v 'take'` returns zero results (excluding count queries)

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
