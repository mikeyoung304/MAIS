---
status: closed
priority: p2
issue_id: '593'
tags: [code-review, code-quality, logging, testing]
dependencies: []
created_at: 2026-01-02
triage_notes: 'FIXED: Console.log statements removed from calibration tests. Test output now silent in CI.'
closed_at: '2026-01-26'
---

# P2: Console.log Used in Integration Tests

> **Code Quality Review:** Per CLAUDE.md guidelines, console.log should not be used. The project uses a logger utility.

## Problem Statement

The calibration tests use `console.log` for output instead of the project's logger utility.

**File:** `/server/test/agent-eval/calibration.test.ts` (lines 310-318, 379-397)

**Evidence:**

```typescript
console.log('\n📊 PERFECT_BOOKING Evaluation:');
console.log(`  Effectiveness: ${result.dimensions...}`);
// ... many more console.log statements
```

## Findings

| Reviewer            | Finding                              |
| ------------------- | ------------------------------------ |
| Code Quality Review | P1: Console.log in integration tests |

## Proposed Solution

**Option A: Use logger utility:**

```typescript
import { logger } from '../../src/lib/core/logger';

// In test
logger.info(
  {
    scenario: 'PERFECT_BOOKING',
    dimensions: result.dimensions,
    overallScore: result.overallScore,
  },
  'Evaluation result'
);
```

**Option B: Use Vitest's built-in output:**

```typescript
// Structure test output using custom matchers
expect(result).toMatchObject({
  dimensions: expect.arrayContaining([...]),
  overallScore: expect.any(Number),
});
```

**Option C: Remove debug output for CI:**
Tests should not produce visible output in CI. Debug info should only appear on failure.

## Acceptance Criteria

- [ ] Remove console.log statements
- [ ] Use logger if output needed
- [ ] Tests pass silently in CI

## Work Log

| Date       | Action                         | Learnings                                          |
| ---------- | ------------------------------ | -------------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Code Quality reviewer identified logging violation |
