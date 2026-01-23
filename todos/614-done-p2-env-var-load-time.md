---
status: complete
priority: p2
issue_id: 614
tags: [code-review, architecture, agent-eval]
dependencies: []
created: 2026-01-02
---

# EVAL_MODEL Environment Variable Read at Module Load Time

## Problem Statement

`DEFAULT_CONFIG` reads `process.env.EVAL_MODEL` at module load time, before the config system initializes. This could cause issues in tests or when using dotenv.

## Findings

**Source:** architecture-strategist review

**Location:** `server/src/agent/evals/evaluator.ts` lines 64-69

**Evidence:**

```typescript
const DEFAULT_CONFIG: EvaluatorConfig = {
  model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // Evaluated at import time!
  maxTokens: 2048,
  temperature: 0.1,
  timeoutMs: 30000,
};
```

**Risk:** If this module is imported before environment variables are loaded, the value may be incorrect.

**MAIS Pattern:** The config system in `server/src/lib/core/config.ts` uses lazy evaluation through factory functions to avoid this problem.

## Proposed Solutions

### Option 1: Use getter function (Recommended)

**Pros:** Lazy evaluation, consistent with MAIS patterns
**Cons:** Slight API change
**Effort:** Small
**Risk:** Very low

```typescript
function getDefaultConfig(): EvaluatorConfig {
  return {
    model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL,
    maxTokens: 2048,
    temperature: 0.1,
    timeoutMs: 30000,
  };
}

// In constructor:
this.config = { ...getDefaultConfig(), ...config };
```

### Option 2: Accept with documentation comment

**Pros:** No code change
**Cons:** Potential edge cases in tests
**Effort:** Small
**Risk:** Low

```typescript
// NOTE: EVAL_MODEL must be set before this module is imported.
// See CLAUDE.md for environment loading requirements.
const DEFAULT_CONFIG: EvaluatorConfig = { ... };
```

### Option 3: Add validation for allowed models

**Pros:** Catches misconfiguration early
**Cons:** Maintenance of allowed list
**Effort:** Small
**Risk:** Very low

```typescript
const ALLOWED_EVAL_MODELS = ['claude-haiku-35-20241022', 'claude-3-haiku-20240307'];
const modelFromEnv = process.env.EVAL_MODEL;
const model =
  modelFromEnv && ALLOWED_EVAL_MODELS.includes(modelFromEnv) ? modelFromEnv : DEFAULT_EVAL_MODEL;
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent/evals/evaluator.ts`

## Acceptance Criteria

- [ ] EVAL_MODEL is read at usage time, not import time
- [ ] Tests can override EVAL_MODEL without import order issues
- [ ] Invalid model values are handled gracefully

## Work Log

| Date       | Action                           | Learnings                                   |
| ---------- | -------------------------------- | ------------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by architecture-strategist agent |

## Resources

- [MAIS config patterns](server/src/lib/core/config.ts)
