---
status: ready
priority: p2
issue_id: '5197'
tags: [code-review, testing, coverage, technical-debt]
dependencies: []
---

# Coverage Thresholds Lowered 3 Times (43% → 28%)

## Problem Statement

Coverage thresholds lowered from 43% to 28% over 2 months to "fix flakiness" - masking real gaps.

## Findings

| Date       | Threshold | Reason                 |
| ---------- | --------- | ---------------------- |
| 2025-12-26 | 43%       | Baseline               |
| 2025-12-26 | 30%       | "Low threshold for CI" |
| 2026-02-01 | 28%       | "Fix flakiness"        |

**Location:** `server/vitest.config.ts` lines 76-80

## Proposed Solutions

### Option A: Freeze + Gradual Improvement (Recommended)

1. Don't lower further
2. Target +5% per quarter
3. Add trend tracking to PR comments

**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Threshold not lowered further
- [ ] Path to 40%+ documented
