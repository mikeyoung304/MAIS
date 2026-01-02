---
status: open
priority: p3
issue_id: '598'
tags: [code-review, code-quality, configuration, flexibility]
dependencies: []
created_at: 2026-01-02
---

# P3: Hardcoded Evaluation Model - Not Configurable

> **Code Quality Review:** The model ID is hardcoded, requiring code changes when Anthropic releases newer versions.

## Problem Statement

The evaluation model is hardcoded in the evaluator configuration.

**File:** `/server/src/agent/evals/evaluator.ts` (line 57)

**Evidence:**

```typescript
model: 'claude-haiku-35-20241022',
```

**Impact:** When Anthropic releases newer Haiku versions, this requires code changes rather than configuration updates.

## Findings

| Reviewer            | Finding                        |
| ------------------- | ------------------------------ |
| Code Quality Review | P2: Hardcoded evaluation model |

## Proposed Solution

Use environment variable with fallback:

```typescript
const DEFAULT_EVAL_MODEL = 'claude-haiku-35-20241022';

const DEFAULT_CONFIG: EvaluatorConfig = {
  model: process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL,
  maxTokens: 2048,
  temperature: 0.1,
  timeoutMs: 30000,
};
```

Or make it part of the config parameter:

```typescript
export interface EvaluatorConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: EvaluatorConfig = {
  model: process.env.EVAL_MODEL ?? 'claude-haiku-35-20241022',
  // ...
};

// Caller can override
const evaluator = createEvaluator({
  model: 'claude-3-5-haiku-20250101', // Override if needed
});
```

## Acceptance Criteria

- [ ] Model configurable via environment variable
- [ ] Fallback to sensible default
- [ ] Document in .env.example

## Work Log

| Date       | Action                         | Learnings                                     |
| ---------- | ------------------------------ | --------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Code Quality reviewer identified config issue |
