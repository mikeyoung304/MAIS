# ADR-008: Pessimistic Locking for Booking Race Conditions

**Date:** 2025-10-29
**Status:** Superseded by ADR-013
**Decision Makers:** Engineering Team
**Category:** Concurrency Control
**Related Issues:** Phase 2B - Double-Booking Prevention
**Superseded By:** ADR-013 (PostgreSQL Advisory Locks)

## Context

The wedding booking platform has a mission-critical requirement: **zero tolerance for double-booking**. If two customers attempt to book the same date simultaneously, a race condition can occur:

1. Both customers check availability (both see "available")
2. Both proceed to payment
3. Both Stripe webhooks attempt to create booking
4. Second webhook fails with database unique constraint violation

While we have a database-level unique constraint on `Booking.date` (our primary defense), we need application-level concurrency control to gracefully handle race conditions rather than fail with errors.

## Decision

We have chosen **pessimistic locking** using PostgreSQL's `SELECT FOR UPDATE` within database transactions.

**Implementation:**

```typescript
// Wrap availability check and booking creation in a transaction
await prisma.$transaction(async (tx) => {
  // SELECT FOR UPDATE locks the row (or absence of row)
  const booking = await tx.$queryRaw`
    SELECT id FROM bookings
    WHERE date = ${new Date(date)}
    FOR UPDATE
  `;

  if (booking.length > 0) {
    throw new BookingConflictError(date);
  }

  // Create booking within same transaction
  await tx.booking.create({ data: { date, ... } });
});
```

## Consequences

**Positive:**

- **Reliability:** First request acquires lock, second request waits, avoiding race conditions
- **Simplicity:** No version fields or retry logic needed at application level
- **Database-enforced:** Leverages PostgreSQL's proven locking mechanism
- **Graceful failures:** Second request gets clear "date unavailable" error instead of cryptic database error
- **No additional infrastructure:** No Redis or distributed lock manager required

**Negative:**

- **Performance:** Second request blocks until first transaction completes (acceptable for wedding bookings - low volume)
- **Transaction length:** Holds lock for duration of booking creation (mitigated by fast database operations)
- **Deadlock potential:** If transactions acquire locks in different orders (mitigated by always locking dates in consistent order)

**Risks:**

- Long-running transactions could cause lock timeouts (mitigated by keeping transactions fast)
- Database connection pool exhaustion under high load (mitigated by proper pool sizing)

## Alternatives Considered

### Alternative 1: Optimistic Locking (Version Field)

**Approach:** Add `version` field to Booking, increment on update, check version before commit.

**Why Rejected:**

- **Retry complexity:** Application must retry failed bookings, complicating webhook logic
- **Customer experience:** Failed bookings require re-payment or complex recovery
- **Race condition still possible:** Both requests could pass version check simultaneously
- **Better for updates:** Optimistic locking is better suited for concurrent updates, not insertions

### Alternative 2: Distributed Lock (Redis)

**Approach:** Acquire Redis lock on date before availability check, release after booking creation.

**Why Rejected:**

- **Additional infrastructure:** Requires Redis deployment and maintenance
- **Network dependency:** Redis unavailability blocks all bookings
- **Complexity:** More moving parts, more failure modes
- **Overkill for scale:** Wedding bookings are low-volume (50-100/year)
- **Cost:** Additional hosting costs for Redis instance

### Alternative 3: Unique Constraint Only (No Locking)

**Approach:** Rely solely on database unique constraint, handle P2002 error in webhook handler.

**Why Rejected:**

- **Poor customer experience:** Second customer pays, then gets error message
- **Refund complexity:** Must automatically refund second customer's payment
- **Trust issues:** Customers charged for failed booking damages reputation
- **Manual intervention:** Requires operations team to handle conflicts

### Alternative 4: Application-Level Mutex (In-Memory Lock)

**Approach:** Use in-memory mutex/semaphore to serialize booking requests by date.

**Why Rejected:**

- **Single-instance only:** Doesn't work with horizontal scaling (multiple API instances)
- **Lost locks on restart:** Lock state lost on server restart
- **No persistence:** Lock isn't durable across deployments
- **Inappropriate for distributed systems:** Only works for monolithic single-server deployment

## Implementation Details

**Files Modified:**

- `server/src/services/availability.service.ts` - Added transaction parameter to `isDateAvailable()`
- `server/src/services/booking.service.ts` - Wrapped booking creation in `prisma.$transaction()`
- `server/src/adapters/prisma/booking.repository.ts` - Added transaction support to `create()`

**Testing:**

- Added concurrent booking test simulating race condition
- Verified first request succeeds, second request waits then fails gracefully
- Confirmed unique constraint still acts as safety net

**Rollback Plan:**
If pessimistic locking causes performance issues, we can:

1. Revert to unique constraint only
2. Add optimistic locking with retry logic
3. Consider Redis distributed lock for high-traffic scenarios

## Why This Was Superseded

This approach encountered P2034 deadlock errors in production-like concurrency scenarios:

- Used `SERIALIZABLE` isolation level with `SELECT FOR UPDATE NOWAIT`
- Attempted to lock non-existent rows (new booking dates)
- Created predicate locks that conflicted even for different dates
- Failed with P2034 in 5 critical integration tests

See ADR-012 for the improved solution using PostgreSQL advisory locks.

## References

- PostgreSQL Documentation: [SELECT FOR UPDATE](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- Prisma Documentation: [Interactive Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#interactive-transactions)
- IMPROVEMENT-ROADMAP.md: P0-3 (Double-Booking Race Condition)

## Related ADRs

- ADR-012: PostgreSQL Advisory Locks (supersedes this ADR)
- ADR-009: Database-Based Webhook Dead Letter Queue
