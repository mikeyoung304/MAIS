---
status: pending
priority: p3
issue_id: '596'
tags: [code-review, code-quality, maintainability, constants]
dependencies: []
created_at: 2026-01-02
---

# P3: Magic Numbers in Implicit Signals Scoring

> **Code Quality Review:** Multiple magic numbers in the scoring algorithm without documentation or named constants.

## Problem Statement

The `calculateSatisfactionScore` method uses multiple undocumented magic numbers.

**File:** `/server/src/agent/feedback/implicit.ts` (lines 121-145)

**Evidence:**

```typescript
let score = 7; // Start with neutral-positive baseline
score -= signals.retryCount * 0.5;
score -= signals.negativeSignals * 0.75;
score -= signals.abandonmentRate * 2;
score -= signals.errorRate * 3;
if (signals.turnCount > 10) {
  score -= (signals.turnCount - 10) * 0.2;
}
score += signals.positiveAcknowledgments * 0.5;
score += Math.min(signals.followUpQuestions * 0.2, 1);
```

Also retry similarity threshold (line 190):

```typescript
if (similarity > 0.6) retries++; // Magic threshold
```

## Findings

| Reviewer            | Finding                                                  |
| ------------------- | -------------------------------------------------------- |
| Code Quality Review | P1: Magic numbers without named constants                |
| TypeScript Review   | P3: Magic numbers without named constants in implicit.ts |

## Proposed Solution

Extract to named constants with documentation:

```typescript
/**
 * Weights for implicit satisfaction scoring.
 * Values calibrated on sample conversations during Phase 5.1 development.
 */
const SATISFACTION_WEIGHTS = {
  /** Starting score - neutral positive */
  BASELINE_SCORE: 7,
  /** Penalty per retry (user repeating themselves) */
  RETRY_PENALTY: 0.5,
  /** Penalty per negative signal (frustrated language) */
  NEGATIVE_SIGNAL_PENALTY: 0.75,
  /** Penalty for task abandonment */
  ABANDONMENT_PENALTY: 2,
  /** Multiplier for error rate penalty */
  ERROR_RATE_MULTIPLIER: 3,
  /** Threshold for "excessive" turn count */
  EXCESSIVE_TURNS_THRESHOLD: 10,
  /** Penalty per turn beyond threshold */
  EXCESS_TURN_PENALTY: 0.2,
  /** Bonus per positive acknowledgment */
  POSITIVE_BONUS: 0.5,
  /** Bonus per follow-up question */
  FOLLOW_UP_BONUS: 0.2,
  /** Maximum follow-up bonus */
  MAX_FOLLOW_UP_BONUS: 1,
} as const;

/**
 * Jaccard similarity threshold for retry detection.
 * 0.6 = ~60% word overlap between consecutive messages.
 * Lower = more false positives, Higher = misses paraphrased retries.
 */
const RETRY_SIMILARITY_THRESHOLD = 0.6;
```

## Acceptance Criteria

- [ ] All magic numbers extracted to named constants
- [ ] Constants have JSDoc explaining the values
- [ ] Tests still pass
- [ ] Consider making weights configurable via config

## Work Log

| Date       | Action                         | Learnings                                |
| ---------- | ------------------------------ | ---------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Multiple reviewers flagged magic numbers |
