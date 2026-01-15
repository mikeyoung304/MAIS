---
status: completed
priority: p2
issue_id: '530'
tags: [code-review, agent-ecosystem, performance, database]
dependencies: []
---

# Missing Composite Index on AgentSession

## Problem Statement

The `getOrCreateSession` method queries with `tenantId`, `sessionType`, and `updatedAt`, but there's no composite index covering this pattern.

## Findings

**Performance Oracle:**

> "When querying with all three fields (`tenantId`, `sessionType`, `updatedAt`), PostgreSQL may not use the optimal index."

## Proposed Solutions

Add to `schema.prisma`:

```prisma
model AgentSession {
  // existing fields...

  @@index([tenantId, sessionType, updatedAt])
}
```

## Acceptance Criteria

- [ ] Composite index added
- [ ] Migration applied
- [ ] Query performance improved
- [ ] Tests pass
