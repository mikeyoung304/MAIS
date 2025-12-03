# PostgreSQL Advisory Locks Registry

**Last Updated:** 2025-12-03
**Maintainer:** Engineering Team
**Related ADR:** [ADR-013: PostgreSQL Advisory Locks](../adrs/ADR-013-postgresql-advisory-locks.md)

## Purpose

This document tracks all PostgreSQL advisory lock IDs used in the MAIS codebase to prevent collisions and provide a central registry for lock coordination across the application.

Advisory locks are lightweight application-level locks that use 32-bit or 64-bit integers as lock identifiers. Proper management of these IDs is critical to prevent:
- Lock ID collisions between different features
- Deadlocks from conflicting lock acquisition patterns
- Race conditions from incorrect lock scoping

## Lock ID Registry

### Hardcoded Lock IDs (Global)

These locks use fixed integer values and coordinate across all tenants/resources.

| Lock ID | Component | Purpose | Scope | Lock Type | File Reference |
|---------|-----------|---------|-------|-----------|----------------|
| `42424242` | IdempotencyService | Cleanup scheduler coordination | Global | Session (`pg_try_advisory_lock`) | `server/src/services/idempotency.service.ts:41` |

**Notes:**
- `42424242` is used with `pg_try_advisory_lock()` (non-blocking, session-scoped)
- Lock is acquired before cleanup, released with `pg_advisory_unlock()`
- Prevents concurrent cleanup execution across multiple server instances

### Dynamically Generated Lock IDs (FNV-1a Hash)

These locks use FNV-1a hashing to generate deterministic lock IDs from tenant and resource identifiers.

| Hash Input Pattern | Component | Purpose | Scope | Lock Type | File Reference |
|-------------------|-----------|---------|-------|-----------|----------------|
| `{tenantId}:{date}` | BookingRepository | Booking creation race prevention | Per tenant+date | Transaction (`pg_advisory_xact_lock`) | `server/src/adapters/prisma/booking.repository.ts:24-35` |
| `{tenantId}:balance:{bookingId}` | BookingRepository | Balance payment coordination | Per tenant+booking | Transaction (`pg_advisory_xact_lock`) | `server/src/adapters/prisma/booking.repository.ts:41-51` |

**Notes:**
- FNV-1a produces 32-bit signed integers compatible with PostgreSQL `bigint`
- Transaction-scoped locks automatically released on commit/rollback
- Hash collisions are theoretically possible but extremely unlikely in practice

## Lock Types

### Session Locks

**Functions:** `pg_advisory_lock()`, `pg_try_advisory_lock()`

- **Lifetime:** Held until explicitly released with `pg_advisory_unlock()`
- **Scope:** Database session (connection)
- **Blocking:** `pg_advisory_lock()` blocks, `pg_try_advisory_lock()` returns immediately
- **Use Case:** Long-running coordination (e.g., scheduler synchronization)

### Transaction Locks

**Function:** `pg_advisory_xact_lock()`

- **Lifetime:** Automatically released on transaction commit/rollback
- **Scope:** Current transaction
- **Blocking:** Always blocks until lock acquired
- **Use Case:** Short-lived atomic operations (e.g., booking creation)

## FNV-1a Hash Algorithm

The codebase uses FNV-1a (Fowler-Noll-Vo) hashing to generate deterministic 32-bit lock IDs:

```typescript
function hashString(input: string): number {
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash | 0; // Convert to 32-bit signed integer
}
```

**Properties:**
- Deterministic: Same input always produces same output
- Fast: O(n) where n is string length
- Good distribution: Low collision rate for similar inputs
- Range: -2,147,483,648 to 2,147,483,647 (32-bit signed integer)

## Guidelines for Adding New Locks

### When to Use Advisory Locks

Advisory locks are appropriate for:
- Preventing race conditions in critical sections
- Coordinating concurrent operations on shared resources
- Avoiding deadlocks from row-level locking conflicts
- Global coordination across multiple application instances

Avoid advisory locks when:
- Database constraints can enforce uniqueness (use `@@unique` instead)
- Simple row-level locking is sufficient
- Lock contention would be extremely high

### Choosing Lock ID Strategy

#### Use Hardcoded IDs When:
- Lock coordinates global operations (all tenants)
- Lock ID is feature-specific and unique
- No resource-specific scoping needed

**Process:**
1. Choose a unique 32-bit integer (avoid common values like 1, 100, etc.)
2. Add to "Hardcoded Lock IDs" table in this document
3. Document purpose and scope
4. Use descriptive constant name in code

**Example:**
```typescript
private readonly IDEMPOTENCY_CLEANUP_LOCK = 42424242;
```

#### Use FNV-1a Hashing When:
- Lock is scoped to specific tenant/resource
- Lock ID must be deterministic from runtime values
- Many lock IDs needed (thousands of combinations)

**Process:**
1. Define hash input pattern: `{tenantId}:{resourceType}:{resourceId}`
2. Add to "Dynamically Generated Lock IDs" table in this document
3. Document hash pattern and purpose
4. Implement FNV-1a hash function

**Example:**
```typescript
function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261;

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash | 0;
}
```

### Lock Acquisition Patterns

#### Transaction-Scoped Lock (Recommended)
```typescript
await this.prisma.$transaction(async (tx) => {
  // Acquire lock (automatically released on commit/rollback)
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Critical section
  const existing = await tx.booking.findFirst({ where: { tenantId, date } });
  if (existing) throw new BookingConflictError(date);

  await tx.booking.create({ data: { tenantId, date, ... } });
}, {
  isolationLevel: 'ReadCommitted',
  timeout: 5000
});
```

#### Session-Scoped Lock (Schedulers)
```typescript
// Try to acquire lock (non-blocking)
const lockResult = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
  SELECT pg_try_advisory_lock(${this.advisoryLockId})
`;

if (!lockResult[0]?.pg_try_advisory_lock) {
  return; // Another instance is running, skip
}

try {
  // Critical section
  await this.performCleanup();
} finally {
  // Always release lock
  await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${this.advisoryLockId})`;
}
```

## Collision Risk Analysis

### Hardcoded IDs
- **Space:** 4.2 billion possible values (32-bit signed integer)
- **Current Usage:** 1 lock ID
- **Risk:** LOW - Manual coordination required

### FNV-1a Hashed IDs
- **Space:** 4.2 billion possible values
- **Current Patterns:** 2 hash patterns
- **Collision Probability:** ~0.00000012% for 1000 unique inputs
- **Risk:** EXTREMELY LOW - Birthday paradox threshold at ~77,000 inputs

**Mitigation:**
- Use tenant-scoped patterns (naturally partitions space)
- Include resource type in hash input (e.g., `:balance:` prefix)
- Monitor for lock timeouts in production (indicator of contention)

## Testing Advisory Locks

### Unit Tests
Mock Prisma `$queryRaw` and `$executeRaw` to test lock acquisition logic:

```typescript
prismaMock.$queryRaw
  .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]); // Lock acquired
```

### Integration Tests
Use actual database to test lock behavior:

```typescript
it('should prevent race condition with advisory lock', async () => {
  // Simulate concurrent requests
  const promises = [
    bookingRepo.create(tenantId, { date: '2025-01-15' }),
    bookingRepo.create(tenantId, { date: '2025-01-15' })
  ];

  // One succeeds, one fails with BookingConflictError
  await expect(Promise.all(promises)).rejects.toThrow(BookingConflictError);
});
```

## Monitoring and Debugging

### Check Active Advisory Locks
```sql
-- View all active advisory locks
SELECT
  locktype,
  classid,
  objid,
  pid,
  mode,
  granted
FROM pg_locks
WHERE locktype = 'advisory';
```

### Check Lock Wait Times
```sql
-- Monitor lock contention
SELECT
  relation::regclass,
  mode,
  granted,
  pg_blocking_pids(pid) AS blocking_pids
FROM pg_locks
WHERE NOT granted AND locktype = 'advisory';
```

### Common Issues

**Lock Never Released:**
- Symptom: Transactions hang indefinitely
- Cause: Session lock not released in error path
- Solution: Always use try-finally or transaction-scoped locks

**Deadlocks:**
- Symptom: P2034 Prisma error
- Cause: Multiple locks acquired in different orders
- Solution: Always acquire locks in consistent order (e.g., sort by lock ID)

**Lock Contention:**
- Symptom: High transaction latency
- Cause: Too many operations on same lock ID
- Solution: Increase lock granularity or use optimistic locking

## References

- [PostgreSQL Advisory Locks Documentation](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [ADR-013: PostgreSQL Advisory Locks](../adrs/ADR-013-postgresql-advisory-locks.md)
- [FNV Hash Algorithm](http://www.isthe.com/chongo/tech/comp/fnv/)
- [Booking Repository Implementation](../../server/src/adapters/prisma/booking.repository.ts)
- [Idempotency Service Implementation](../../server/src/services/idempotency.service.ts)

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-03 | Initial registry created | Engineering Team |

---

**Important:** All new advisory lock IDs MUST be documented in this file before production deployment.
