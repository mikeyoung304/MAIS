---
status: pending
priority: p2
issue_id: '719'
tags: [test-failure, race-condition, advisory-lock, toctou]
dependencies: []
---

# Section ID Race Condition Tests Failing

## Problem Statement

9 tests in `test/integration/section-id-race-conditions.spec.ts` are failing. These tests verify that concurrent requests to create sections with duplicate IDs are properly rejected (TOCTOU prevention).

**Expected behavior:** When multiple concurrent requests try to create sections with the same ID, only one should succeed and others should fail with "already exists" error.

**Actual behavior:** All concurrent requests succeed, creating duplicate sections.

## Failing Tests

1. `should prevent duplicate section IDs when concurrent requests arrive` - 2 succeed instead of 1
2. `should handle high-concurrency section creation (5 simultaneous)` - 5 succeed instead of 1
3. `should allow concurrent updates with different section IDs` - Only 1 section created instead of 3
4. Plus 6 more similar concurrency tests

## Root Cause Analysis

The advisory lock mechanism (`pg_advisory_xact_lock`) is either:

1. Not being acquired before the duplicate check
2. Using different lock keys for concurrent requests
3. Not wrapped in a transaction properly

The `update_page_section` executor should:

1. Acquire advisory lock for the tenant + section ID combination
2. Check if section ID already exists
3. If not, create the section
4. Release lock on transaction commit

## Files to Investigate

- `server/src/agent/executors/index.ts` - `update_page_section` executor
- `server/src/lib/advisory-locks.ts` - Lock key generation
- `server/src/agent/tools/utils.ts` - Draft config operations

## Acceptance Criteria

- [ ] All 9 race condition tests pass
- [ ] Concurrent duplicate ID requests: exactly 1 succeeds, others fail
- [ ] Different ID requests: all succeed (no false positives)
- [ ] Advisory lock properly prevents TOCTOU race

## Work Log

| Date       | Action                | Learnings                                           |
| ---------- | --------------------- | --------------------------------------------------- |
| 2026-01-10 | Created from test run | Discovered during full test suite run; pre-existing |

## Resources

- Prevention pattern: `docs/solutions/patterns/STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md`
- Advisory locks: `docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md`
