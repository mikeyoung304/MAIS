---
status: open
priority: p1
issue_id: '583'
tags: [code-review, architecture, dependency-injection, testing]
dependencies: []
created_at: 2026-01-02
---

# P1: ConversationEvaluator Hardcodes Anthropic API Key - DI Violation

> **Architecture Review:** The evaluator directly accesses environment variables and creates its own Anthropic client, violating MAIS Dependency Inversion principles.

## Problem Statement

The `ConversationEvaluator` directly accesses `process.env.ANTHROPIC_API_KEY` in its constructor and creates its own `Anthropic` client. This violates DI patterns and makes testing difficult.

**File:** `/server/src/agent/evals/evaluator.ts` (lines 87-99)

**Evidence:**

```typescript
constructor(config: Partial<EvaluatorConfig> = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for evaluator');
  }
  this.anthropic = new Anthropic({ apiKey, ... });
}
```

**Impact:**

- Unit tests require setting environment variable
- No ability to inject mock Anthropic client for testing
- Violates existing MAIS DI patterns (see `server/src/di.ts`)

Similarly, `EvalPipeline` creates its own evaluator internally:

**File:** `/server/src/agent/evals/pipeline.ts` (line 196)

```typescript
constructor(
  private readonly prisma: PrismaClient,
  config: Partial<PipelineConfig> = {}
) {
  this.evaluator = createEvaluator();  // Hardcoded creation
}
```

## Findings

| Reviewer            | Finding                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| Architecture Review | P1: ConversationEvaluator hardcodes Anthropic API key from environment  |
| Architecture Review | P1: EvalPipeline creates internal evaluator instead of accepting via DI |

## Proposed Solution

Accept dependencies via constructor:

```typescript
// evaluator.ts
constructor(
  config: Partial<EvaluatorConfig> = {},
  anthropic?: Anthropic  // Optional injection
) {
  this.anthropic = anthropic ?? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// pipeline.ts
constructor(
  private readonly prisma: PrismaClient,
  evaluator?: ConversationEvaluator,  // Optional injection
  config: Partial<PipelineConfig> = {}
) {
  this.evaluator = evaluator ?? createEvaluator();
}
```

Define interface in `server/src/lib/ports.ts`:

```typescript
export interface EvaluatorPort {
  evaluate(input: EvalInput): Promise<EvalResult>;
}
```

## Acceptance Criteria

- [ ] Evaluator accepts Anthropic client via constructor
- [ ] Pipeline accepts evaluator via constructor
- [ ] EvaluatorPort interface defined in ports.ts
- [ ] Tests can inject mock evaluator

## Work Log

| Date       | Action                         | Learnings                                      |
| ---------- | ------------------------------ | ---------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Architecture reviewer identified DI violations |
