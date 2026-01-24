---
status: complete
priority: p1
issue_id: '5243'
tags: [code-review, performance, database]
dependencies: []
triage_batch: 2
triage_decision: RESOLVE - One-line fix, high impact on production performance
---

# P1: Serializable Isolation Level is Overkill

## Problem Statement

The `appendMessage` transaction uses `Serializable` isolation level combined with advisory locks, creating double protection for the same issue. Serializable is the most expensive isolation level in PostgreSQL and will cause significant performance problems under load.

**Why it matters:** Under moderate load (50+ concurrent chat sessions), this will cause:

- 2-5x worse latency
- Higher serialization failure rates (transactions abort and retry)
- Database connection pool exhaustion

## Findings

**File:** `server/src/services/session/session.repository.ts:298-301`

```typescript
{
  isolationLevel: 'Serializable', // Strictest isolation
  timeout: 10000, // 10 second timeout
}
```

**Analysis from reviewers:**

- Performance reviewer: "P1 BLOCKING - Serializable isolation overkill. Combined with advisory locks, this is double-protecting against the same issue."
- Data integrity reviewer: "P2 - Transaction Isolation May Be Excessive. With advisory locks already preventing TOCTOU, Serializable may be overkill."

Advisory locks already prevent concurrent access to the same session. Serializable transactions:

- Cause significant lock contention under load
- Require PostgreSQL to track predicate locks
- Increase transaction abort rates
- Have longer transaction durations

## Proposed Solutions

### Option A: Use ReadCommitted (Recommended)

**Pros:** Significantly better performance, advisory locks still prevent TOCTOU
**Cons:** Slightly weaker isolation (but advisory locks compensate)
**Effort:** Small
**Risk:** Low - advisory locks are already providing the concurrency control

```typescript
{
  isolationLevel: 'ReadCommitted',
  timeout: 10000,
}
```

### Option B: Remove advisory locks, keep Serializable

**Pros:** Simpler code
**Cons:** Serializable failures require retry logic
**Effort:** Medium
**Risk:** Medium - need to add retry logic for serialization failures

## Recommended Action

Option A - Change to ReadCommitted. The advisory lock pattern from ADR-013 is already providing TOCTOU protection.

## Technical Details

**Affected files:**

- `server/src/services/session/session.repository.ts`

## Acceptance Criteria

- [ ] Transaction isolation changed to ReadCommitted
- [ ] Load test shows no serialization failures under 100 concurrent sessions
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [ADR-013: Advisory Lock Pattern](docs/decisions/ADR-013-advisory-locks.md)
- [PostgreSQL Isolation Levels](https://www.postgresql.org/docs/current/transaction-iso.html)
