---
status: pending
priority: p3
issue_id: 9010
tags: [code-review, plan, testing]
dependencies: []
---

# E2E Test Rewrite Instruction Misplaced in Phase 9

## Problem Statement

Phase 9 (line 877) says: "IMPORTANT: Rewrite E2E tests BEFORE migration (not after). Update `e2e/tests/booking.spec.ts` and `booking-mock.spec.ts` to use Tier-based booking flow during Phase 6."

This instruction is in Phase 9 but should be executed in Phase 6. By the time someone reaches Phase 9, the migration has already happened.

## Proposed Solutions

Move the E2E test rewrite to Phase 6 acceptance criteria and files-to-modify.

**Effort:** Tiny — plan text change

## Acceptance Criteria

- [ ] E2E test rewrite listed in Phase 6 (not Phase 9)
- [ ] Phase 6 acceptance criteria includes "E2E booking tests pass with tierId"

## Work Log

| Date       | Action                        | Learnings                                          |
| ---------- | ----------------------------- | -------------------------------------------------- |
| 2026-02-12 | Cross-phase consistency check | Instructions should live in the phase they execute |
