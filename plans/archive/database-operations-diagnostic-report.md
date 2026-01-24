# Database Operations Diagnostic Report

**Date:** 2025-12-04
**Scope:** Prisma usage, database patterns, multi-tenant isolation, transaction handling
**Status:** Comprehensive Analysis

---

## Executive Summary

Your MAIS codebase demonstrates **mature, well-architected database patterns** that align with 2025 best practices. The multi-tenant architecture is sound, concurrency control is properly implemented, and most common anti-patterns have been avoided. However, there are a few areas for optimization and one potential concern worth addressing.

### Overall Grade: **B+** (Strong implementation with minor optimizations possible)

---

## 1. What You're Doing Well

### 1.1 Multi-Tenant Data Isolation ✅ Excellent

**Implementation:**

- Every repository method requires `tenantId` as first parameter
- All queries filter by `tenantId` (verified across 10 repositories)
- Composite unique constraints: `@@unique([tenantId, slug])`, `@@unique([tenantId, email])`, etc.
- Cross-tenant reference attacks prevented (catalog.repository.ts:97-107)

**Code Example (catalog.repository.ts:97-107):**

```typescript
// CRITICAL: Verify package belongs to tenant before querying add-ons
const pkg = await this.prisma.package.findFirst({
  where: { tenantId, id: packageId },
  select: { id: true },
});
if (!pkg) {
  throw new NotFoundError('Package not found or unauthorized');
}
```

**Best Practice Alignment:** Your pattern matches the recommended approach for shared-schema multi-tenancy. You're not using RLS (Row-Level Security), but your application-level enforcement is thorough and consistent.

---

### 1.2 Concurrency Control (Advisory Locks) ✅ Excellent

**Implementation (booking.repository.ts:24-51, 169-308):**

- FNV-1a hash function for deterministic lock IDs
- Transaction-scoped locks via `pg_advisory_xact_lock()`
- Automatic release on commit/abort
- Changed from SERIALIZABLE to ReadCommitted after ADR-013

**Why This Is Right:**

```typescript
// Your pattern (CORRECT)
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  // ... operations ...
}); // Auto-unlock

// Anti-pattern (WRONG - would fail with connection pooling)
await prisma.$queryRaw`SELECT pg_advisory_lock(1)`;
// ... operations on potentially different connection ...
await prisma.$queryRaw`SELECT pg_advisory_unlock(1)`; // May unlock wrong connection!
```

**Test Results:** 100% pass rate (752/752) after implementing advisory locks, vs 97.4% with SERIALIZABLE isolation.

---

### 1.3 Webhook Idempotency ✅ Excellent

**Implementation (webhook.repository.ts:36-68):**

- Composite unique key: `(tenantId, eventId)`
- Status tracking: PENDING → PROCESSED/FAILED/DUPLICATE
- Graceful duplicate handling (returns false, doesn't throw)
- Multi-tenant isolation prevents cross-tenant event hijacking

**Schema (schema.prisma:515-535):**

```prisma
model WebhookEvent {
  id          String   @id @default(cuid())
  tenantId    String
  eventId     String   // Stripe event ID
  eventType   String
  payload     Json
  status      WebhookStatus @default(PENDING)
  attempts    Int      @default(0)
  lastError   String?
  processedAt DateTime?

  @@unique([tenantId, eventId], name: "tenantId_eventId")
}
```

**Best Practice Alignment:** This matches ADR-009 exactly and follows Stripe's recommended idempotency patterns.

---

### 1.4 Connection Pooling Configuration ✅ Good

**Implementation (di.ts:305-335):**

```typescript
// Add Prisma connection pool parameters
databaseUrl.searchParams.set('connection_limit', String(config.DATABASE_CONNECTION_LIMIT));
databaseUrl.searchParams.set('pool_timeout', String(config.DATABASE_POOL_TIMEOUT));

// For Supabase with Supavisor (pgbouncer), use transaction mode
if (databaseUrl.host.includes('supabase')) {
  databaseUrl.searchParams.set('pgbouncer', 'true');
}
```

**Best Practice Alignment:**

- ✅ Using `?pgbouncer=true` for Supabase
- ✅ Configurable connection_limit and pool_timeout
- ✅ Separate DIRECT_URL for migrations (schema.prisma:9-13)

---

### 1.5 Retry Logic with Exponential Backoff ✅ Good

**Implementation (booking.repository.ts:71-111):**

```typescript
BOOKING_TRANSACTION_TIMEOUT_MS = 5000;
MAX_TRANSACTION_RETRIES = 3;
RETRY_DELAY_MS = 100; // Exponential backoff: 100ms, 200ms, 400ms
```

Handles P2034 (transaction conflict) and deadlock errors gracefully.

---

### 1.6 Hybrid Migration System ✅ Well-Documented

**Decision Guide (from CLAUDE.md):**
| Change | Pattern |
|--------|---------|
| Add column | Prisma Migrations |
| Add table | Prisma Migrations |
| Create enum | Manual Raw SQL |
| Add index | Manual Raw SQL |
| RLS policy | Manual Raw SQL |

This is properly documented in `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`.

---

## 2. Areas for Improvement

### 2.1 ⚠️ Missing Prisma Client Singleton Pattern (Medium Priority)

**Current State:** Unknown - need to verify how Prisma Client is instantiated in development.

**Potential Issue:** In Next.js/development environments with hot reload, creating multiple PrismaClient instances can exhaust connections.

**Recommended Pattern:**

```typescript
// lib/prisma.ts
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Your Current Implementation (di.ts):** You create a single instance in the DI container, which is good for the server. Verify this pattern is also used in any client-side or development tooling.

---

### 2.2 ⚠️ N+1 Query Prevention (Low Priority - Partially Addressed)

**What You Have:**

- `findTimeslotBookingsInRange()` (booking.repository.ts:568-621) - batch query pattern ✅
- Pagination with DoS protection (max 500, max 90 days) ✅

**What's Missing:**

- No evidence of Prisma's `include` or `select` optimization across all repositories
- Consider adding query logging in development to catch N+1 patterns

**Recommendation:** Enable Prisma query logging in development and monitor for repetitive queries:

```typescript
const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.log(`Slow query (${e.duration}ms): ${e.query}`);
  }
});
```

You already have slow query monitoring (di.ts:339-344) for queries >1s. Consider lowering the threshold to catch N+1 patterns earlier.

---

### 2.3 ⚠️ Row-Level Security (RLS) Not Implemented (Design Decision - Not a Bug)

**Current State:** Application-level tenant isolation only.

**Trade-offs:**

| Approach                     | Pros                                                                     | Cons                                                                                |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Your Current (App-level)** | Simpler, no Postgres-specific features, easier testing                   | Single point of failure (app must enforce), can't protect direct DB access          |
| **RLS**                      | Database enforces isolation, defense-in-depth, protects against app bugs | PostgreSQL-specific, complex with Prisma + connection pooling, performance overhead |

**Recommendation:** Your current approach is fine for your scale. If you move to a larger team or need defense-in-depth, consider adding RLS as a second layer. The implementation requires:

```sql
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Booking"
  USING ("tenantId" = current_setting('app.current_tenant_id')::text);
```

And a Prisma extension to set the runtime parameter per request.

---

### 2.4 ⚠️ Missing Index Analysis (Unknown Impact)

**What You Have:**

- 27+ indexes on Booking model alone
- Composite indexes for common query patterns
- Tenant isolation indexes on every model

**What's Missing:**

- No evidence of `EXPLAIN ANALYZE` results in documentation
- No query performance baseline

**Recommendation:** Run periodic index analysis:

```sql
-- Find unused indexes
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  idx_scan as index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique AND idx_scan < 50
ORDER BY pg_relation_size(i.indexrelid) DESC;
```

---

### 2.5 ⚠️ Transaction Timeout Configuration (Minor)

**Current State:** Only booking repository has explicit timeout (5000ms).

**Observation:** Other repositories using transactions (tenant.repository.ts landing page operations) don't have explicit timeouts.

**Recommendation:** Consider adding consistent timeout configuration across all transaction-heavy operations:

```typescript
await prisma.$transaction(
  async (tx) => {
    // ...
  },
  {
    timeout: 5000,
    isolationLevel: 'ReadCommitted',
  }
);
```

---

## 3. Potential Risks

### 3.1 🔴 CI Test Flakiness (Observed in Current PR)

**Symptom:** Integration tests failing with webhook race conditions and booking race conditions.

**Root Cause Analysis:**

1. **Webhook tests** (test/integration/webhook-race-conditions.spec.ts): Testing high concurrency with 10+ simultaneous webhooks
2. **Booking tests** (test/integration/booking-race-conditions.spec.ts): Testing concurrent booking attempts

**Possible Issues:**

- CI database connection limits may be too low for concurrent tests
- Test isolation may not be complete between test runs
- Advisory lock IDs may collide in test environment

**Recommendation:**

1. Increase CI database connection limit for test job
2. Add test cleanup between concurrent test suites
3. Consider using unique tenant IDs per test to prevent lock collisions

---

### 3.2 🟡 JSON Column for Landing Page Config (Design Trade-off)

**Current Implementation (tenant.repository.ts:359-672):**

```typescript
// Single JSON column with wrapper structure
interface LandingPageDraftWrapper {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}
```

**Trade-offs:**

| Approach                | Pros                                                       | Cons                                                                |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **Your Current (JSON)** | Flexible, no migrations for config changes, simple queries | No schema validation at DB level, harder to query individual fields |
| **Normalized Tables**   | Type-safe, queryable, relational integrity                 | More complex queries, migrations for every config change            |

**Recommendation:** Your approach is fine for configuration data that's always read/written as a whole. The image URL validation (lines 434-489) provides adequate defense-in-depth.

---

## 4. Comparison with 2025 Best Practices

| Practice               | Your Implementation                    | Best Practice                        | Status    |
| ---------------------- | -------------------------------------- | ------------------------------------ | --------- |
| Connection Pooling     | PgBouncer support, configurable limits | Use external pooler in serverless    | ✅        |
| Transaction Locks      | Advisory locks (pg_advisory_xact_lock) | Advisory locks > SELECT FOR UPDATE   | ✅        |
| Multi-Tenant Isolation | App-level with composite keys          | RLS or app-level with composite keys | ✅        |
| Webhook Idempotency    | Database-based with composite unique   | Database or Redis-based              | ✅        |
| Migration Strategy     | Hybrid Prisma + Raw SQL                | Schema-as-code with version control  | ✅        |
| N+1 Prevention         | Partial (batch queries exist)          | Include/select optimization          | ⚠️        |
| Query Monitoring       | >1s slow query logging                 | <100ms for N+1 detection             | ⚠️        |
| Retry Logic            | Exponential backoff on deadlocks       | Exponential backoff with jitter      | ✅        |
| Singleton Pattern      | DI container                           | Global singleton for hot reload      | ⚠️ Verify |

---

## 5. Recommendations Summary

### High Priority

1. **Fix CI test flakiness** - Increase connection limits, improve test isolation
2. **Verify Prisma singleton pattern** - Ensure no duplicate clients in development

### Medium Priority

3. **Lower slow query threshold** - From 1000ms to 100ms for N+1 detection
4. **Add transaction timeouts** - Consistent 5000ms timeout across all repositories

### Low Priority

5. **Document index analysis process** - Add EXPLAIN ANALYZE results to docs
6. **Consider RLS for defense-in-depth** - Only if team grows or security requirements increase

---

## 6. Files Referenced

**Core Database Files:**

- `server/prisma/schema.prisma` (1-596 lines)
- `server/src/di.ts` (305-335 connection config)
- `server/src/config/env.schema.ts` (19-28 DB config)

**Repositories:**

- `server/src/adapters/prisma/booking.repository.ts` (1176 lines)
- `server/src/adapters/prisma/tenant.repository.ts` (672 lines)
- `server/src/adapters/prisma/catalog.repository.ts` (704 lines)
- `server/src/adapters/prisma/webhook.repository.ts` (213 lines)

**Documentation:**

- `CLAUDE.md` (lines 59-286)
- `ARCHITECTURE.md` (lines 142-441)
- `docs/adrs/ADR-013-postgresql-advisory-locks.md`
- `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`

---

## 7. Conclusion

Your database architecture is **production-ready** and follows most best practices. The advisory lock implementation (ADR-013) is particularly well-done and solves a real problem that many teams struggle with. The multi-tenant isolation is thorough and consistent.

The main areas for improvement are:

1. CI test reliability (immediate)
2. N+1 query detection (optimization)
3. Consistent transaction configuration (polish)

None of these are blocking issues - they're optimizations for an already solid foundation.
