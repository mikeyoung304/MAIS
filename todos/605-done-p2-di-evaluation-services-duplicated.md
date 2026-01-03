# P2: DI Evaluation Services Duplicated

**Status:** open
**Priority:** P2 (Important)
**Category:** Code Simplicity
**File:** `server/src/di.ts`
**Lines:** 293-313 (mock), 724-749 (real)

## Problem

The evaluation services wiring is duplicated verbatim in both mock and real mode:

```typescript
// Mock mode (lines 304-310)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(mockPrisma, evaluator);
  const reviewQueue = createReviewQueue(mockPrisma);
  const reviewActions = createReviewActionService(mockPrisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}

// Real mode (lines 735-746) - SAME CODE
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  // ... identical pattern
}
```

## Fix

Extract a helper function:

```typescript
function buildEvaluationServices(
  prisma: PrismaClient,
  mode: 'mock' | 'real'
): EvaluationServices | undefined {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.info('Agent evaluation services skipped (ANTHROPIC_API_KEY not set)');
    return undefined;
  }

  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);

  logger.info(`${mode === 'mock' ? '🧪' : '🤖'} Agent evaluation services initialized`);
  return { evaluator, pipeline, reviewQueue, reviewActions };
}

// Usage
const evaluation = buildEvaluationServices(prisma, 'real');
```

**Lines saved:** ~15 lines

## Source

Code review of commit b2cab182 - Code Simplicity reviewer finding
