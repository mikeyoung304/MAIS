---
status: resolved
priority: p2
issue_id: '5177'
tags: [code-review, security, race-condition, agent-system, concurrency]
dependencies: []
resolved_date: '2026-01-12'
resolved_by: master-architect-triage
resolution: Code already fixed - uses atomic updateMany with status check in WHERE clause at line 496
---

# Proposal Confirmation TOCTOU Race Condition

## Problem Statement

The `confirm_proposal` tool has a Time-of-Check-Time-of-Use (TOCTOU) vulnerability where two concurrent confirmation requests can both pass the status check and execute the same proposal twice, potentially creating duplicate bookings.

**Why it matters:** Race conditions in booking systems lead to:

- Duplicate bookings for the same date/package
- Payment processing errors (charging customer twice)
- Customer confusion and support burden
- Data integrity issues

## Findings

**Source:** Security Sentinel agent review (agent ID: a9f11fa)

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/customer/customer-tools.ts:492-543`

**Vulnerable Code:**

```typescript
// Step 1: Fetch proposal
const proposal = await prisma.agentProposal.findFirst({
  where: { id: proposalId, tenantId, sessionId },
});

// Step 2: Check status (TOCTOU window starts here)
if (proposal.status !== 'PENDING') {
  return { success: false, error: 'Already processed' };
}

// Step 3: Confirm proposal (TOCTOU window ends here)
await prisma.agentProposal.update({
  where: { id: proposalId },
  data: { status: 'CONFIRMED', confirmedAt: new Date() },
});
```

**Race Condition Timeline:**

```
Request A                    Request B
-----------                  -----------
Fetch proposal (PENDING)
                            Fetch proposal (PENDING)
Check status (passes) ✓
                            Check status (passes) ✓
Confirm proposal
                            Confirm proposal (DUPLICATE!)
Execute booking
                            Execute booking (DUPLICATE!)
```

**Exploit Scenario:**

1. Customer receives booking proposal (`proposalId: prop_123`)
2. Customer clicks "Confirm" button twice rapidly (double-click or network retry)
3. Both requests fetch proposal with `status: PENDING`
4. Both requests pass the status check
5. Both requests execute the booking executor
6. **Result:** Duplicate booking for the same date/package

**Likelihood:** MEDIUM - Requires rapid double-click or network retry, but common in web apps

**Impact:** HIGH - Duplicate bookings, payment errors, customer confusion

## Proposed Solutions

### Solution 1: Atomic Status Update with WHERE Clause (Recommended)

**Approach:** Use `updateMany` with status check in WHERE clause for atomic compare-and-swap

```typescript
// Atomic update - only succeeds if status is PENDING
const result = await prisma.agentProposal.updateMany({
  where: {
    id: proposalId,
    tenantId,
    sessionId,
    status: 'PENDING', // ✅ Only update if still pending
  },
  data: {
    status: 'CONFIRMED',
    confirmedAt: new Date(),
  },
});

if (result.count === 0) {
  // Proposal already processed, expired, or doesn't exist
  const proposal = await prisma.agentProposal.findFirst({
    where: { id: proposalId, tenantId, sessionId },
  });

  if (!proposal) {
    return { success: false, error: 'Proposal not found or expired' };
  }

  if (proposal.status !== 'PENDING') {
    return { success: false, error: 'Proposal already processed' };
  }

  // Shouldn't reach here, but handle gracefully
  return { success: false, error: 'Unable to confirm proposal. Please try again.' };
}

// Success - proposal was atomically updated
// Continue with executor...
```

**Pros:**

- Prevents race condition at database level
- No additional locks needed
- Atomic operation (no TOCTOU window)
- Works with existing advisory lock pattern

**Cons:**

- Requires extra query if update fails (for helpful error message)

**Effort:** 15 minutes
**Risk:** LOW - Only changes confirmation flow, adds safety

### Solution 2: Advisory Lock on Proposal ID

**Approach:** Use PostgreSQL advisory lock similar to booking creation

```typescript
return await prisma.$transaction(
  async (tx) => {
    // Lock this specific proposal
    const lockId = hashProposalId(proposalId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Now safe to check and update
    const proposal = await tx.agentProposal.findFirst({
      where: { id: proposalId, tenantId, sessionId },
    });

    if (proposal.status !== 'PENDING') {
      return { success: false, error: 'Already processed' };
    }

    await tx.agentProposal.update({
      where: { id: proposalId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    // Execute booking...
  },
  { isolationLevel: 'ReadCommitted' }
);
```

**Pros:**

- Explicit locking (easier to reason about)
- Consistent with existing advisory lock pattern (ADR-013)

**Cons:**

- More complex than Solution 1
- Requires hash function for proposal ID
- Advisory lock overhead

**Effort:** 30 minutes
**Risk:** LOW

### Solution 3: Optimistic Locking with Version Field

**Approach:** Add `version` field to `agentProposal` table

**Pros:**

- Industry standard pattern
- Works across distributed systems

**Cons:**

- Requires schema migration
- More complex implementation

**Effort:** 1-2 hours (schema + code)
**Risk:** MEDIUM - Schema change

## Recommended Action

**Implement Solution 1** (Atomic status update with WHERE clause)

**Rationale:**

- Simplest solution (no schema changes)
- Proven pattern (used in proposal soft-confirm already)
- Consistent with Prisma best practices
- No performance impact

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/customer/customer-tools.ts:492-543` (confirm_proposal tool)
- Potentially `/Users/mikeyoung/CODING/MAIS/server/src/agent/proposals/proposal.service.ts` if soft-confirm has same issue

**Database Schema:** No changes required for Solution 1

**Related Patterns:**

- Advisory locks in `booking.repository.ts:154` (double-booking prevention)
- Soft-confirm uses `updateMany` with status check (lines 331-340)

**Testing:**

- Add integration test with concurrent confirmation attempts
- Verify only one succeeds, other gets "already processed" error

## Acceptance Criteria

- [ ] Concurrent confirmation requests only execute proposal once
- [ ] Second request receives "already processed" error
- [ ] No duplicate bookings created
- [ ] Test: Send 2 concurrent POST requests to confirm same proposal
- [ ] Test: Verify `updateMany` result.count is checked before execution
- [ ] Add integration test for race condition scenario

## Work Log

| Date       | Action                                         | Learnings                                  |
| ---------- | ---------------------------------------------- | ------------------------------------------ |
| 2026-01-11 | Security audit identified TOCTOU vulnerability | Check-then-act pattern vulnerable to races |

## Resources

- **Security Review:** Security Sentinel agent (ID: a9f11fa)
- **Related ADR:** ADR-013 Double-Booking Prevention (advisory locks)
- **Similar Pattern:** `proposal.service.ts:331-340` (soft-confirm uses updateMany)
- **Prisma Docs:** [Optimistic Concurrency Control](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide)
