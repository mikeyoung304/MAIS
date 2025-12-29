---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: database, prisma
severity: P2
related_commit: e2d6545
tags: [database-performance, indexes, prisma, postgresql, query-optimization]
---

# Quick Reference: Composite Database Indexes

## The Problem

```typescript
// ❌ SLOW: Multiple WHERE conditions, no index
const session = await prisma.agentSession.findFirst({
  where: {
    tenantId, // Column 1
    sessionType, // Column 2
    updatedAt, // Column 3
  },
});

// PostgreSQL must:
// 1. Find all rows with tenantId (slow)
// 2. Filter by sessionType (slower)
// 3. Filter by updatedAt (slower)
// Total: Full table scan = 350ms

// After adding composite index: 2ms
```

## The Solution (Copy & Paste)

### Step 1: Add Migration

```sql
-- server/prisma/migrations/NN_add_session_index.sql
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
```

### Step 2: Run Migration

```bash
cd server
psql $DATABASE_URL < prisma/migrations/NN_add_session_index.sql
npm exec prisma generate
```

### Step 3: Verify (Optional)

```sql
EXPLAIN ANALYZE
SELECT * FROM "AgentSession"
WHERE "tenantId" = $1 AND "sessionType" = $2;

-- Should show: "Index Scan using ..." (not "Seq Scan")
```

## Index Column Order Rules

**Rule:** Index columns in WHERE clause order, then ORDER BY order.

```typescript
// Query
WHERE a = ? AND b = ? AND c < ? ORDER BY d DESC

// Index should be:
(a, b, c, d DESC)
//  ↓  ↓  ↓  ↓
//  1  2  3  4 (execution order)
```

## Pattern: Multi-Tenant Queries

For MAIS multi-tenant architecture:

```typescript
// Pattern 1: Single lookup
WHERE tenantId = ? AND resourceId = ?
INDEX: (tenantId, resourceId)

// Pattern 2: List with filter
WHERE tenantId = ? AND status = ? AND createdAt > ?
INDEX: (tenantId, status, createdAt DESC)

// Pattern 3: Session lookup (from PR #23)
WHERE tenantId = ? AND sessionType = ? AND updatedAt > ?
INDEX: (tenantId, sessionType, updatedAt DESC)
```

**ALWAYS put tenantId first** (multi-tenant isolation pattern).

## Implementation: Prisma

### Option A: Schema-Based (Recommended for Simple Cases)

```prisma
// server/prisma/schema.prisma

model AgentSession {
  id        String   @id
  tenantId  String
  sessionId String
  updatedAt DateTime @updatedAt

  @@index([tenantId])  // Single: Always exists
  @@index([tenantId, sessionId, updatedAt(sort: Desc)])  // Composite
}
```

Then run:

```bash
cd server
npm exec prisma migrate dev --name add_composite_index
```

### Option B: Raw SQL (For Complex Cases)

```sql
-- server/prisma/migrations/17_add_session_type_index.sql
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
```

Use when:

- Creating enum-based index
- Complex WHERE clause
- Conditional index (WHERE clause)

## Detection Strategy

### Find Missing Indexes

```sql
-- List all queries without appropriate indexes
-- PostgreSQL 12+: Query pg_stat_statements

SELECT
  query,
  calls,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%WHERE%' AND query NOT LIKE '%CREATE INDEX%'
ORDER BY mean_time DESC
LIMIT 10;

-- Slow queries → Check if indexed
```

### Verify Index Is Used

```sql
-- Test if index is actually used
EXPLAIN ANALYZE
SELECT * FROM "AgentSession"
WHERE "tenantId" = 'some-id'
  AND "sessionType" = 'CUSTOMER'
  AND "updatedAt" > NOW() - INTERVAL '1 hour';

-- Good output:
--   Index Scan using "AgentSession_tenantId_sessionType_updatedAt_idx"
-- Bad output:
--   Seq Scan on "AgentSession"
```

## Code Review Checklist

When reviewing queries with multiple WHERE conditions:

```typescript
// Count WHERE conditions
const query = prisma.agentSession.findFirst({
  where: {
    a: ?,     // 1
    b: ?,     // 2
    c: ?      // 3
  }
});

// If 2+ conditions → Must have composite index
// ✅ Check: CREATE INDEX (a, b, c) exists?
```

## Performance Before/After

```
Query: SELECT * FROM AgentSession
       WHERE tenantId = ? AND sessionType = ? AND updatedAt > ?

Without index:   350ms (full table scan)
Single index:    45ms  (index on tenantId only)
Composite index: 2ms   (index on all columns)

175x improvement!
```

## Common Mistakes

| Mistake                  | Problem               | Fix                  |
| ------------------------ | --------------------- | -------------------- |
| Index on wrong columns   | Still slow            | Index in WHERE order |
| Ascending on last column | Doesn't help range    | Use DESC on last     |
| Forget tenantId in index | Scans all tenants     | Put tenantId first   |
| Index too many columns   | Memory waste          | 2-3 columns optimal  |
| No DESC on sort column   | Doesn't help ORDER BY | Add DESC to last col |

## When to Index

| Condition          | Index?      | Example                   |
| ------------------ | ----------- | ------------------------- |
| 1 WHERE column     | Maybe       | `tenantId` - might exist  |
| 2+ WHERE columns   | YES         | `tenantId, sessionType`   |
| Range query (>, <) | YES         | `createdAt > ?`           |
| ORDER BY           | YES if slow | `ORDER BY updatedAt DESC` |
| Foreign key        | YES         | Usually auto-created      |

## Index Performance Cost

```
Benefits:
- Read queries: 100-500x faster
- Join queries: 50-100x faster

Costs:
- Storage: ~5-10% per index
- Write speed: 2-5% slower (maintain index)
- Memory: ~100MB per index (large tables)

Rule: Benefits >> Costs for multi-column WHERE queries
```

## Migration Pattern

```typescript
// Step 1: Write query
const sessions = await prisma.agentSession.findMany({
  where: {
    tenantId,
    sessionType: 'CUSTOMER',
    updatedAt: { gt: new Date(Date.now() - 1000 * 60 * 60) }
  }
});

// Step 2: Create index immediately (before merge)
// server/prisma/migrations/NN_add_session_index.sql
CREATE INDEX "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);

// Step 3: Test before merge
EXPLAIN ANALYZE SELECT ... WHERE tenantId = ... AND sessionType = ...

// Step 4: Commit query + migration together
```

## Monitoring Index Health

```sql
-- Check if indexes are actually used
SELECT
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_scan DESC;

-- Low idx_scan = Index not used, consider removing
```

## File Locations in MAIS

- `server/prisma/migrations/` - Migration files
- `server/prisma/schema.prisma` - Schema with @@index
- `server/src/routes/public-customer-chat.routes.ts` - Session lookup queries
- `server/src/agent/customer/customer-orchestrator.ts` - Session queries

## Pre-Commit Checklist

Before submitting PR with new queries:

```bash
# 1. Check for multi-column WHERE
grep -n "findFirst\|findMany" server/src/**/*.ts | grep -c "where:"

# 2. For each multi-column query, verify index exists
# psql $DATABASE_URL -c "\d table_name" | grep -i "index"

# 3. Test with EXPLAIN
# EXPLAIN ANALYZE SELECT... WHERE tenantId = ... AND col2 = ...
```

## Troubleshooting

**Q: Query still slow after adding index**

A: Check index usage:

```sql
EXPLAIN ANALYZE SELECT ... WHERE ...
-- If still Seq Scan, index not matching
-- Verify column order matches query order
```

**Q: Index not being used**

A: Common causes:

- Column type mismatch
- Index order doesn't match query
- Statistics outdated: `ANALYZE table_name;`

**Q: Which indexes do I need?**

A: For every query with 2+ WHERE conditions, add index in that order.

---

**Use This Document:** Before adding any query with 2+ WHERE conditions
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #4
**Rule:** No multi-column WHERE without composite index. Period.
