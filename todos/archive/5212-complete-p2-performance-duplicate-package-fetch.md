---
status: complete
priority: p2
issue_id: '5212'
tags: [code-review, performance, booking, database]
dependencies: []
---

# Duplicate Package Fetches in Booking Validation

## Problem Statement

The booking flow fetches the same package data multiple times:

1. In route handler for validation
2. In service for business logic
3. In checkout factory for price info

This adds unnecessary database round-trips and latency.

**Why it matters:** Each booking attempt makes 3x more DB queries than needed, impacting performance under load.

## Findings

**Location:** `server/src/services/booking.service.ts`, route handlers

**Evidence:**

```typescript
// Route handler
const pkg = await packageRepo.findById(packageId); // Query 1
validatePackageBookable(pkg);

// Booking service
const pkg = await packageRepo.findById(packageId); // Query 2 (duplicate!)
await createBooking(pkg, ...);

// Checkout factory
const pkg = await packageRepo.findById(packageId); // Query 3 (duplicate!)
calculateFees(pkg);
```

**Reviewer:** Performance Oracle (PO-001)

## Proposed Solutions

### Option A: Pass Package Through Call Chain (Recommended)

**Pros:** Zero additional queries, explicit data flow
**Cons:** Slightly more parameters
**Effort:** Small
**Risk:** Low

```typescript
// Route handler fetches once, passes through
const pkg = await packageRepo.findById(packageId);
if (!pkg) return notFound();

await bookingService.createDateBooking({
  package: pkg, // Pass pre-fetched package
  customerInfo,
  selectedDate,
});
```

### Option B: Request-Scoped Cache

**Pros:** Transparent caching
**Cons:** Cache invalidation complexity
**Effort:** Medium
**Risk:** Medium

```typescript
const requestCache = new Map();
const pkg = await cacheOr(requestCache, `pkg:${id}`, () => packageRepo.findById(id));
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/public-date-booking.routes.ts`
- `server/src/services/booking.service.ts`
- `server/src/services/checkout-session.factory.ts`

**Estimated Impact:**

- Current: 3 queries per booking
- After fix: 1 query per booking
- 66% reduction in DB round-trips

## Acceptance Criteria

- [ ] Package fetched exactly once per booking request
- [ ] Package data passed through service chain
- [ ] No change to booking behavior
- [ ] Query count verified with query logging

## Work Log

| Date       | Action                         | Learnings                              |
| ---------- | ------------------------------ | -------------------------------------- |
| 2026-01-24 | Created from /workflows:review | Performance reviewer found N+1 pattern |

## Resources

- Review: Performance Oracle
- Related: ADR on query optimization (if exists)
