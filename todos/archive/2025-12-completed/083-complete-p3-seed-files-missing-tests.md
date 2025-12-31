---
status: complete
priority: p3
issue_id: '083'
tags: [testing, code-review, quality]
dependencies: ['082']
resolution: 'Added unit tests for all seed functions (seed-orchestrator.test.ts, e2e-seed.test.ts, platform-seed.test.ts, demo-seed.test.ts)'
completed_date: '2025-11-30'
---

# P3: No Tests for Seed Functions

## Problem Statement

The codebase has 771 passing server tests but **zero tests for seed functions**. Seed breakage is only discovered in production.

**Why it matters:**

- No automated verification of seed correctness
- No testing of error paths (invalid env vars, database failures)
- No validation of idempotency (can seeds run multiple times safely?)

## Findings

```bash
$ ls server/test/**/*seed*.test.ts
# No files found
```

## Proposed Solutions

### Solution A: Add comprehensive seed tests

**Pros:** Catch seed bugs early
**Cons:** Requires test database setup
**Effort:** Large (4 hours)
**Risk:** None

Create tests for:

- Platform seed: admin creation, idempotency, password hashing
- E2E seed: fixed keys, tenant creation
- Demo seed: random key generation, package creation
- Mode selection: environment detection logic

## Recommended Action

<!-- To be filled during triage -->

## Acceptance Criteria

- [ ] Test files exist for each seed function
- [ ] Idempotency tested (run twice, verify no duplicates)
- [ ] Error paths tested (missing env vars)
- [ ] Tests run in CI pipeline

## Work Log

| Date       | Action                   | Learnings                            |
| ---------- | ------------------------ | ------------------------------------ |
| 2025-11-29 | Created from code review | Seeds are critical path - need tests |

## Resources

- **Code Review:** Seed system refactoring review
- **Test Pattern:** `server/test/` existing test structure
