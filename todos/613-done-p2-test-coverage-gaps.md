---
status: done
priority: p2
issue_id: 613
tags: [code-review, testing, agent-eval]
dependencies: []
created: 2026-01-02
---

# Test Coverage Gaps in Agent Evaluation

## Problem Statement

Several functions in the agent evaluation system lack direct test coverage, including critical async processing methods and public PII redaction APIs.

## Findings

**Source:** cora-test-reviewer

**Gaps identified:**

### 1. Pipeline Async Methods (High Priority)

- `cleanupPendingEvaluations()` - Not tested (lines 320-328)
- `drainCompleted()` - Only tested indirectly (lines 311-315)
- `shouldEvaluate()` - Only sampling path tested, flagged/failed paths missing

### 2. PII Redactor Functions (Medium Priority)

- `redactMessagesForPreview()` - No direct tests (lines 179-187)
- `redactToolCalls()` - Only indirectly tested

### 3. Tracer Truncation (Medium Priority)

- `truncateMessages()` - No direct tests
- `truncateToolCalls()` - No direct tests
- `truncateObject()` - No direct tests

### 4. Evaluator Fallback (Low Priority)

- `extractScoresWithFallback()` - Regex extraction not directly tested

## Proposed Solutions

### Option 1: Add targeted unit tests for each gap (Recommended)

**Pros:** Comprehensive coverage, catches regressions
**Cons:** Test maintenance overhead
**Effort:** Medium
**Risk:** Very low

### Option 2: Add integration tests that cover paths

**Pros:** Tests real usage patterns
**Cons:** Less precise coverage
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Tests to add:**

```typescript
// pipeline.test.ts
describe('cleanupPendingEvaluations', () => {
  it('should trigger drain when pending > 50', async () => {...});
  it('should not drain when pending <= 50', async () => {...});
});

describe('shouldEvaluate', () => {
  it('should always evaluate flagged traces', () => {...});
  it('should always evaluate failed tasks', () => {...});
  it('should use sampling rate for normal traces', () => {...});
});

// pii-redactor.test.ts
describe('redactMessagesForPreview', () => {
  it('should truncate content to maxLength after redaction', () => {...});
  it('should default maxLength to 500', () => {...});
});

describe('redactToolCalls', () => {
  it('should redact both input and output fields', () => {...});
});
```

## Acceptance Criteria

- [ ] `cleanupPendingEvaluations` has dedicated tests
- [ ] `drainCompleted` has direct tests
- [ ] All three `shouldEvaluate` paths are tested
- [ ] `redactMessagesForPreview` has tests
- [ ] `redactToolCalls` has direct tests
- [ ] Coverage report shows >80% for affected files

## Work Log

| Date       | Action                           | Learnings                              |
| ---------- | -------------------------------- | -------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by cora-test-reviewer agent |

## Resources

- [Vitest testing patterns](https://vitest.dev/guide/)
