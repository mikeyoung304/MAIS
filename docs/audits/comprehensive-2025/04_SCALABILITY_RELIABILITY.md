# MAIS Scalability & Reliability Assessment

**Date:** 2025-12-28
**Scope:** Backend services, database, caching, external integrations

---

## 1. Load Capacity Analysis

### Current Architecture Limits

| Component            | Current Capacity               | Bottleneck      | Scaling Strategy                |
| -------------------- | ------------------------------ | --------------- | ------------------------------- |
| **Express API**      | ~500 req/sec (single instance) | CPU-bound       | Horizontal (multiple instances) |
| **PostgreSQL**       | ~1000 TPS                      | Connection pool | Vertical + read replicas        |
| **Redis Cache**      | ~50,000 ops/sec                | Memory          | Cluster mode                    |
| **Supabase Storage** | ~100 concurrent uploads        | API limits      | CDN + edge caching              |
| **BullMQ Queue**     | ~1000 jobs/sec                 | Redis           | Additional workers              |

### Connection Pool Configuration

```
DATABASE_POOL_SIZE: 5 (default, serverless-optimized)
DATABASE_POOL_TIMEOUT: 10 seconds
DATABASE_CONNECTION_LIMIT: 1 per instance
```

**Assessment:** Conservative settings appropriate for Vercel serverless. For dedicated servers, increase to:

- Pool size: 20-50
- Connection limit: 10-20

---

## 2. Database Performance

### Index Coverage: EXCELLENT

```sql
-- Critical multi-tenant indexes (verified in schema)
Booking:
  @@index([tenantId, status])
  @@index([tenantId, date])
  @@index([tenantId, date, bookingType])
  @@index([tenantId, startTime])
  @@index([tenantId, status, date])
  @@index([tenantId, startTime, endTime, bookingType])
  @@index([tenantId, serviceId, startTime])
  @@index([tenantId, createdAt, status])  -- Revenue queries
  @@index([tenantId, reminderDueDate, reminderSentAt, status])

Package:
  @@index([tenantId, active])
  @@index([segmentId, grouping])
  @@unique([tenantId, slug])

Customer:
  @@unique([tenantId, email])
  @@index([tenantId, createdAt])
```

**Coverage:** 30+ indexes, all tenant-scoped. No missing indexes identified for common query patterns.

### N+1 Prevention: EXCELLENT

**Pattern Used:** Explicit `include` statements + `Promise.all()` batching

```typescript
// Example from booking.repository.ts:337-351
const booking = await prisma.booking.findFirst({
  where: { tenantId, id: bookingId },
  include: {
    customer: true,
    addOns: true,
    package: true,
  },
});

// Example from context-builder.ts:70-96
const [tenant, bookings, packages, stats, reminders] = await Promise.all([
  getTenant(),
  getBookings(),
  getPackages(),
  getStats(),
  getReminders(),
]);
```

### Pagination: ENFORCED

| Endpoint Type   | Default Limit | Max Limit | Date Range Limit |
| --------------- | ------------- | --------- | ---------------- |
| Booking queries | 100           | 500       | 90 days          |
| Agent tools     | 50            | 50        | N/A              |
| Blackout dates  | 100           | 100       | N/A              |
| Admin lists     | 100           | 500       | N/A              |

```typescript
// Example enforcement (booking.repository.ts:373)
take: options?.limit ?? 100;

// Date range validation (booking.repository.ts:695-709)
if (daysDiff > MAX_DATE_RANGE_DAYS) {
  throw new Error(`Date range too large...`);
}
```

---

## 3. Caching Strategy

### Redis Cache Implementation

**File:** `server/src/adapters/redis/cache.adapter.ts`

| Feature              | Implementation                     | Status      |
| -------------------- | ---------------------------------- | ----------- |
| Graceful degradation | Returns null on failure            | EXCELLENT   |
| TTL management       | 900s default (15 min)              | Good        |
| Pattern matching     | SCAN with batch size 100           | Safe        |
| Connection health    | Auto-reconnect exponential backoff | Good        |
| Hit/miss tracking    | getStats() method                  | Implemented |

### Cached Operations

```typescript
// CatalogService caching (900s TTL)
getAllPackages(tenantId)           → 15 min
getPackageBySlug(tenantId, slug)   → 15 min
getAllAddOns(tenantId)             → 15 min
getPackagesBySegment(...)          → 15 min
getAddOnsForSegment(...)           → 15 min
```

### Cache Key Isolation

```typescript
// Multi-tenant safe keys
`catalog:${tenantId}:packages``catalog:${tenantId}:segment:${segmentId}:packages``tenant:${tenantId}:config`;
```

### Cache Invalidation Pattern

```typescript
// Targeted invalidation on updates
await this.invalidateCatalogCache(tenantId);
await this.invalidatePackageCache(tenantId, existing.slug);
```

**Gap:** No cache warming strategy for popular tenants.

---

## 4. Failure Mode Analysis

### External Service Failures

| Service             | Failure Mode              | Degradation Strategy                | Recovery                    |
| ------------------- | ------------------------- | ----------------------------------- | --------------------------- |
| **Redis**           | Connection lost           | Return null, continue without cache | Auto-reconnect              |
| **Postmark**        | API timeout               | Retry 3x with exponential backoff   | Manual (file sink fallback) |
| **Google Calendar** | API unavailable           | Assume available, skip sync         | Automatic on next request   |
| **Stripe**          | API error                 | Return 5xx to client                | Stripe SDK retries          |
| **PostgreSQL**      | Connection pool exhausted | 500 error                           | Pool timeout recovery       |

### Timeout Configuration

| Component           | Timeout  | Location                     |
| ------------------- | -------- | ---------------------------- |
| Server keepAlive    | 65s      | `index.ts:100`               |
| Server headers      | 66s      | `index.ts:101`               |
| Database pool       | 10s      | `config.ts:37`               |
| Redis connection    | 5s       | `cache.adapter.ts:45`        |
| Redis commands      | 5s       | `cache.adapter.ts:46`        |
| Webhook queue       | 5s       | `webhook-queue.ts:61`        |
| Health checks       | 5s       | `health-check.service.ts:28` |
| **Google Calendar** | **NONE** | `gcal.adapter.ts:156-167`    |
| **Next.js API**     | **NONE** | `api.ts:90-95`               |

### Gap: Missing Timeouts

```typescript
// CURRENT (gcal.adapter.ts:156-167) - NO TIMEOUT
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(requestBody),
});

// REQUIRED FIX
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(requestBody),
  signal: AbortSignal.timeout(5000), // Add 5s timeout
});
```

---

## 5. Async Processing

### BullMQ Webhook Queue

**Configuration:**

```typescript
Queue: 'webhook-processing'
Concurrency: 5 workers
Max retries: 3
Retry delay: 5000ms (exponential)
Completed retention: 24 hours OR 1000 jobs
Failed retention: 7 days
Stalled check: 30s interval
```

**Fallback Mode:**

```typescript
// When Redis unavailable (webhook-queue.ts)
if (!this.isAsyncAvailable()) {
  // Process synchronously - BLOCKING
  await processWebhook(event);
}
```

**Risk:** Synchronous fallback blocks request handling. If webhook processing takes >5s, Stripe times out and retries.

### Recommendation: Add Circuit Breaker

```typescript
// Proposed pattern
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > 30000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }
    // ... implementation
  }
}
```

---

## 6. Graceful Shutdown

### Implementation: EXCELLENT

**File:** `server/src/lib/shutdown.ts`

```typescript
Shutdown sequence:
1. Stop accepting new connections
2. Wait for in-flight requests (configurable timeout)
3. Run DI container cleanup
4. Disconnect Prisma
5. Run custom shutdown tasks (Redis, BullMQ)
6. Force exit after timeout
```

**Configuration:**

- Default timeout: 60s
- Configurable via: `GRACEFUL_SHUTDOWN_TIMEOUT_MS`
- Signal handlers: SIGTERM, SIGINT

---

## 7. Health Checks

### Endpoints

| Endpoint        | Type      | Checks                 | Caching |
| --------------- | --------- | ---------------------- | ------- |
| `/health`       | Liveness  | None (immediate 200)   | None    |
| `/health/ready` | Readiness | Stripe, Postmark, GCal | 60s     |

### Health Check Service

```typescript
// health-check.service.ts
Checks performed:
- Stripe: balance.retrieve() (validates API key)
- Postmark: /server endpoint
- Google Calendar: Config validation only
- Timeout: 5s per check
- Cache: 60s result caching
```

**Gap:** Database health check not explicit in readiness probe.

---

## 8. Load Testing Recommendations

### Booking Creation (Critical Path)

```
Test scenario: Concurrent booking attempts for same date
Expected behavior:
  - 1 succeeds with advisory lock
  - Others fail with 409 Conflict
  - No database deadlocks
  - Transaction timeout <5s

Load test command:
  artillery quick --count 50 --num 10 \
    -p '{"packageId":"pkg","date":"2025-01-15"}' \
    https://api.maconaisolutions.com/v1/bookings
```

### Webhook Processing

```
Test scenario: Burst of 100 webhooks in 1 minute
Expected behavior:
  - Queue accepts all within 5s
  - Workers process at 5 concurrent
  - No duplicates processed
  - Failed jobs retry 3x

Simulate with:
  stripe trigger checkout.session.completed --times 100
```

### Checkout Session Creation

```
Test scenario: 50 concurrent checkout attempts
Expected behavior:
  - Idempotency prevents duplicates
  - Rate limit triggers at threshold
  - Response time <2s

Load test:
  k6 run checkout-load-test.js
```

---

## 9. Scalability Bottlenecks

### Identified Bottlenecks

| Bottleneck               | Current Limit         | Scaling Path                |
| ------------------------ | --------------------- | --------------------------- |
| **Advisory locks**       | 1 booking/date/tenant | Expected behavior           |
| **File uploads**         | 3 concurrent/tenant   | Increase or queue           |
| **Agent chat**           | 30 msg/5min/tenant    | Increase if usage grows     |
| **Database connections** | 5 per instance        | Increase pool for dedicated |
| **Redis memory**         | In-memory state       | Monitor, add eviction       |

### Horizontal Scaling Readiness

| Component     | Ready?  | Notes                                   |
| ------------- | ------- | --------------------------------------- |
| Express API   | Yes     | Stateless, load balancer ready          |
| Session state | Yes     | JWT (no server state)                   |
| File uploads  | Yes     | Supabase Storage (external)             |
| Cache         | Partial | Redis single instance (needs cluster)   |
| BullMQ        | Partial | Single queue (needs sharding for scale) |
| Database      | Partial | Single writer (needs read replicas)     |

---

## 10. Recommendations

### P0: Critical Reliability Fixes

1. **Add timeout to Google Calendar adapter**

   ```typescript
   signal: AbortSignal.timeout(5000);
   ```

2. **Add timeout to Next.js API client**

   ```typescript
   signal: AbortSignal.timeout(10000);
   ```

3. **Enforce advisory lock timeout**
   ```typescript
   prisma.$transaction({
     timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
   });
   ```

### P1: High Priority

4. **Add circuit breaker for external services**
5. **Add retry logic to webhook delivery**
6. **Add database health check to readiness probe**

### P2: Medium Priority

7. **Implement cache warming for popular tenants**
8. **Add Redis cluster configuration for production**
9. **Document load testing procedures**

---

## 11. Capacity Planning

### Per-Tenant Resource Estimates

| Resource       | Per Tenant/Year | 1000 Tenants   |
| -------------- | --------------- | -------------- |
| Bookings       | 500-2000 rows   | 500K-2M rows   |
| Payments       | 500-2000 rows   | 500K-2M rows   |
| Customers      | 100-500 rows    | 100K-500K rows |
| File storage   | 100MB-2.5GB     | 100GB-2.5TB    |
| Cache memory   | 1-5MB           | 1-5GB          |
| Webhook events | 100-500 rows    | 100K-500K rows |

### Database Growth Projection

```
Year 1: 50 tenants × 2000 bookings = 100K rows
Year 2: 200 tenants × 2000 bookings = 400K rows
Year 3: 500 tenants × 2000 bookings = 1M rows

Storage estimate (Year 3):
- Booking data: ~500MB
- Payment data: ~200MB
- Audit logs: ~2GB
- File storage: ~500GB (Supabase)
```

---

_Scalability assessment completed. Review quarterly with growth metrics._
