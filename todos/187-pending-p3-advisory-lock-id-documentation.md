---
status: pending
priority: p3
issue_id: "187"
tags: [code-review, documentation, database]
dependencies: []
---

# Advisory Lock ID Needs Documentation

## Problem Statement

The idempotency cleanup uses hardcoded advisory lock ID `42424242` without documentation. While collision is unlikely (32-bit integer space), there's no registry of advisory lock IDs used across the codebase.

## Findings

**Location:** `server/src/services/idempotency.service.ts:41`

**Current Code:**
```typescript
private readonly advisoryLockId = 42424242; // Unique lock ID for idempotency cleanup
```

**Other Advisory Lock Usage in Codebase:**
- `booking.repository.ts`: Uses FNV-1a hash for booking-specific locks
- `balance-payment.service.ts`: Uses FNV-1a hash for payment locks

**Risk Assessment:**
- Impact: Low (collision unlikely, no security impact)
- Likelihood: Very Low (requires another component using same ID)

## Proposed Solutions

### Solution 1: Document lock ID registry (Recommended)
- Create `docs/reference/ADVISORY_LOCKS.md`
- List all advisory lock IDs and their purpose
- **Pros:** Simple documentation fix
- **Cons:** Manual maintenance
- **Effort:** Small (15 minutes)
- **Risk:** None

### Solution 2: Use FNV-1a hash like other components
- Hash service name: `hashString('idempotency-cleanup')`
- Consistent with booking repository pattern
- **Pros:** Consistent pattern
- **Cons:** More code change
- **Effort:** Small (20 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** for minimal effort.

## Technical Details

**Proposed Documentation (`docs/reference/ADVISORY_LOCKS.md`):**
```markdown
# PostgreSQL Advisory Locks Registry

## Purpose
This document tracks all PostgreSQL advisory lock IDs used in the MAIS codebase to prevent collisions.

## Lock ID Registry

| Lock ID | Component | Purpose | Scope |
|---------|-----------|---------|-------|
| 42424242 | IdempotencyService | Cleanup scheduler coordination | Global |
| FNV-1a(`tenantId:date`) | BookingRepository | Booking creation race prevention | Per booking |
| FNV-1a(`tenantId:bookingId:balance`) | BalancePaymentService | Balance payment coordination | Per payment |

## Guidelines
- Use hardcoded IDs for global locks (documented here)
- Use FNV-1a hashing for tenant/resource-scoped locks
- All new lock IDs must be added to this registry
```

## Acceptance Criteria

- [ ] Advisory lock registry document created
- [ ] All existing lock IDs documented
- [ ] Guidelines for new locks added

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced idempotency advisory lock)
- PostgreSQL docs: Advisory Locks
