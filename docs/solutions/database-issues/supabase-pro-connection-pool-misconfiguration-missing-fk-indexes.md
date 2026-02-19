---
title: Supabase Pro Configuration Drift — Connection Pool Bottleneck & Missing FK Indexes
date: 2026-02-18
category: database-issues
severity: p2
component: Database | Configuration | Documentation
symptoms:
  - Connection pool defaulting to 1 despite persistent Node.js server on Render
  - Supabase Performance Advisor flagging missing FK indexes on segmentId
  - Documentation referencing deprecated free tier limits (500MB, 100 connections)
  - images storage bucket unprotected (zero RLS policies)
root_cause: >
  Project upgraded to Supabase Pro (Build2 org) but codebase retained free-tier
  serverless defaults. DATABASE_CONNECTION_LIMIT hard-coded to 1, FK indexes
  omitted (Prisma only auto-indexes @id/@unique), setup docs never updated.
status: complete
---

# Supabase Pro Configuration Drift

## Problem

After upgrading to Supabase Pro (Build2 org), three silent issues persisted:

1. **Connection pool bottleneck** — `DATABASE_CONNECTION_LIMIT=1` serialized all concurrent queries
2. **Missing FK indexes** — Sequential scans on Segment DELETE/UPDATE due to missing standalone `segmentId` indexes
3. **Stale documentation** — Docs said "Free Tier", "100 connections", "single-tenant app"

None of these caused visible errors — they silently degraded performance and created wrong mental models.

---

## Root Cause Analysis

### Issue 1: Connection Limit Bottleneck

`server/src/lib/core/config.ts:44` configured `DATABASE_CONNECTION_LIMIT=1`, intended for serverless edge functions where connections are ephemeral.

**Why this matters on Render:** Render runs persistent Node.js processes. With `limit=1`:

- `Promise.all([query1, query2])` serializes — query2 blocks waiting for query1's connection
- Only 1 of 200 available pooler connections used per instance
- 10 Render instances x 1 = 10 total connections (190 wasted)

**Key insight:** Prisma's `connection_limit` controls the pool size _per PrismaClient instance_. Default params only activate for `undefined`, not for the value `1` — so this was an active configuration choice, not an absent one.

### Issue 2: Missing FK Indexes

Supabase Performance Advisor flagged sequential scans on `AddOn.segmentId` and `SectionContent.segmentId`.

**Why composite indexes don't help:**

- Both tables had `@@index([tenantId, segmentId])` — leading column is `tenantId`
- PostgreSQL FK constraint checks scan by `segmentId` alone (not the leading column)
- B-tree indexes are left-to-right — can't skip the leading column
- Result: full sequential scan of entire child table on every `Segment` DELETE/UPDATE

### Issue 3: Documentation Drift

`docs/setup/SUPABASE.md` was written during initial free-tier setup (Oct 2025) and never updated:

- "Free Tier (500MB)" — actually Pro plan
- "100 concurrent connections" — actually 200 pooler + 60 direct
- "single-tenant app" — actually multi-tenant since Oct 2025
- No storage documentation despite `images` bucket being active

---

## Solution

### Fix 1: Connection Limit (1 -> 5)

```typescript
// server/src/lib/core/config.ts:44
// Before
DATABASE_CONNECTION_LIMIT: z.coerce.number().int().positive().default(1), // per instance

// After
DATABASE_CONNECTION_LIMIT: z.coerce.number().int().positive().default(5), // per instance (200 pooler max)
```

**Safety calculation:** 10 Render instances x 5 connections = 50, well within 200 pooler limit. Can increase to 10 for high-concurrency workloads.

### Fix 2: Standalone FK Indexes

```prisma
// server/prisma/schema.prisma — AddOn model
@@index([segmentId]) // Standalone FK index for Segment deletion/update constraint checks

// server/prisma/schema.prisma — SectionContent model
@@index([segmentId]) // Standalone FK index for Segment deletion/update constraint checks
```

Migration SQL:

```sql
CREATE INDEX "AddOn_segmentId_idx" ON "AddOn"("segmentId");
CREATE INDEX "SectionContent_segmentId_idx" ON "SectionContent"("segmentId");
```

### Fix 3: Documentation Rewrite

Full rewrite of `docs/setup/SUPABASE.md`: Free -> Pro plan, 200 pooler connections, storage + RLS policies, vector extension guidance, Micro compute details.

---

## Files Changed

| File                                                      | Change                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `server/src/lib/core/config.ts`                           | `DATABASE_CONNECTION_LIMIT` default 1 -> 5, updated comments |
| `server/.env.example`                                     | Added `DATABASE_CONNECTION_LIMIT=5` with docs                |
| `server/prisma/schema.prisma`                             | `@@index([segmentId])` on AddOn + SectionContent             |
| `server/prisma/migrations/20260218200000_*/migration.sql` | CREATE INDEX SQL                                             |
| `docs/setup/SUPABASE.md`                                  | Full rewrite for Pro plan                                    |
| `docs/setup/SUPABASE_INTEGRATION_COMPLETE.md`             | Updated plan refs, connection counts                         |

---

## Prevention Strategies

### 1. Infrastructure Change Triggers Doc Audit

When upgrading a service tier (Supabase, Render, Cloud Run), search the codebase for:

```bash
# Find all references to the old tier
grep -rn "Free Tier\|free tier\|100 connection\|single-tenant" docs/ server/.env.example CLAUDE.md
```

Update every hit. Infrastructure changes without doc updates create silent drift.

### 2. FK Index Rule of Thumb

**Every `@relation` field needs TWO index checks:**

1. Does the **referencing** model have `@@index([fkColumn])`?
2. Does the **child** table have a **standalone** index on the FK column (not just a composite)?

Composite indexes like `@@index([tenantId, segmentId])` do NOT satisfy FK constraint lookups on `segmentId` alone. Always add `@@index([segmentId])` separately.

**Quick detection:**

```bash
# Find @relation fields and check for matching @@index
grep -A 5 "@relation" server/prisma/schema.prisma | grep "fields:"
```

### 3. Config Defaults Must Match Deployment Model

| Deployment Model                     | `DATABASE_CONNECTION_LIMIT` |
| ------------------------------------ | --------------------------- |
| Serverless (Lambda, Edge)            | 1                           |
| Persistent process (Render, Railway) | 5-10                        |
| Cluster (k8s, multiple replicas)     | 3-5 per pod                 |

When changing deployment platforms, audit all connection-related defaults.

---

## Related Documentation

- `docs/solutions/database-issues/CONNECTION_POOL_PREVENTION_SUMMARY.md` — Complete connection pooling strategy
- `docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md` — Pool exhaustion patterns
- `docs/solutions/database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md` — IPv6 connection issues
- `docs/solutions/deployment-issues/production-seed-pipeline-ipv6-cache-cascade.md` — Production IPv6 cascade
- `docs/solutions/code-review-patterns/DATABASE-COMPOSITE-INDEXES.md` — Composite index patterns

---

## Key Lessons

1. **Silent defaults trap:** Serverless-optimized defaults persist after infrastructure migration. Audit all environment-dependent constants after tier changes.
2. **Composite != standalone:** `@@index([a, b])` does NOT cover lookups on `b` alone. FK constraint checks need standalone indexes on each referenced column.
3. **Documentation drift is silent until it creates wrong decisions.** A developer reading "100 connections" will configure conservatively; reading "200 connections" they'll configure correctly.
4. **Supabase Performance Advisor is underutilized.** Check it after every schema migration, not quarterly.
