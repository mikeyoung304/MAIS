---
status: pending
priority: p2
issue_id: '11079'
tags: [code-review, performance, architecture]
pr: 68
---

# F-015: Advisory Lock + Connection Pooling Interaction — Non-Deterministic Lock Behavior

## Problem Statement

The background build service uses PostgreSQL advisory locks (`pg_advisory_lock`) to prevent concurrent builds for the same tenant. However, session-level advisory locks are tied to the database connection, not the transaction. With connection pooling (PgBouncer/Prisma pool), the lock may be acquired on one connection and released on a different one, causing non-deterministic behavior.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/background-build.service.ts:492-521`
- **Impact:** Under connection pooling, advisory locks can silently fail to provide mutual exclusion. Two concurrent build requests for the same tenant could both proceed, causing duplicate section generation, wasted LLM credits, and potential data corruption.

## Proposed Solution

Replace session-level `pg_advisory_lock` with transaction-scoped `pg_advisory_xact_lock`. Transaction-scoped locks are automatically released when the transaction ends, making them safe with connection pooling. Wrap the lock acquisition and the critical section in a single Prisma `$transaction` block.

## Effort

Medium

## Acceptance Criteria

- [ ] Advisory locks use `pg_advisory_xact_lock` instead of `pg_advisory_lock`
- [ ] Lock acquisition and critical section are within a single `$transaction`
- [ ] Lock is automatically released when the transaction completes (no manual unlock needed)
- [ ] Existing concurrency tests pass; add a test verifying mutual exclusion under pooled connections
