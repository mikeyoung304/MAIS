---
status: open
priority: p2
issue_id: '591'
tags: [code-review, typescript, zod, validation]
dependencies: []
created_at: 2026-01-02
---

# P2: Missing Type Inference from Zod Schemas in Rubrics

> **TypeScript Review:** Interfaces are manually defined alongside Zod schemas, creating duplication and drift risk.

## Problem Statement

The interfaces `EvalResult` and `DimensionScore` are manually defined alongside their Zod schemas, creating potential for drift.

**File:** `/server/src/agent/evals/rubrics/index.ts`

**Evidence:**

```typescript
// Manual interface
export interface DimensionScore {
  dimension: string;
  score: number;
  reasoning: string;
  confidence: number;
}

// Zod schema (duplicates the same structure)
export const DimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(10),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});
```

The manual interface doesn't enforce the min/max constraints that the schema does.

## Findings

| Reviewer          | Finding                                                         |
| ----------------- | --------------------------------------------------------------- |
| TypeScript Review | P2: Missing type inference from Zod schemas in rubrics/index.ts |

## Proposed Solution

Use `z.infer<>` to derive types from schemas:

```typescript
export const DimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(10),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

// Derive type from schema - always in sync
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const EvalResultSchema = z.object({
  dimensions: z.array(DimensionScoreSchema),
  overallScore: z.number().min(0).max(10),
  summary: z.string(),
  flagged: z.boolean(),
  flagReason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
```

## Acceptance Criteria

- [ ] DimensionScore derived from DimensionScoreSchema
- [ ] EvalResult derived from EvalResultSchema
- [ ] Remove duplicate manual interfaces
- [ ] Typecheck passes

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-02 | Created from /workflows:review | TypeScript reviewer identified schema/type drift |
