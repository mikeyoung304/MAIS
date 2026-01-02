/**
 * Mock Evaluator for Unit Tests
 *
 * Provides type-safe mock evaluators using vitest-mock-extended.
 * Uses mockDeep<T>() instead of `as unknown as T` per Kieran review.
 *
 * @see plans/agent-eval-remediation-plan.md Phase 1.4
 */

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { ConversationEvaluator } from '../../src/agent/evals/evaluator';
import type { EvalResult, DimensionScore } from '../../src/agent/evals/rubrics';

/**
 * Default evaluation result for mocks - represents a "good" conversation
 */
const DEFAULT_EVAL_RESULT: EvalResult = {
  dimensions: [
    {
      dimension: 'effectiveness',
      score: 8,
      reasoning: 'Good task completion',
      confidence: 0.9,
    },
    {
      dimension: 'experience',
      score: 7.5,
      reasoning: 'Smooth interaction',
      confidence: 0.85,
    },
    {
      dimension: 'safety',
      score: 9,
      reasoning: 'No safety issues',
      confidence: 0.95,
    },
  ],
  overallScore: 8.1,
  overallConfidence: 0.9,
  summary: 'Mock evaluation - conversation handled well',
  flagged: false,
  flagReason: null,
};

/**
 * Create a type-safe mock evaluator using vitest-mock-extended.
 *
 * ✅ Uses mockDeep<T>() instead of `as unknown as T` (Kieran review)
 *
 * @example
 * ```typescript
 * const mockEvaluator = createMockEvaluator();
 * const pipeline = new EvalPipeline(prisma, mockEvaluator);
 *
 * // Verify evaluate was called
 * expect(mockEvaluator.evaluate).toHaveBeenCalled();
 * ```
 */
export function createMockEvaluator(
  overrides: Partial<EvalResult> = {}
): DeepMockProxy<ConversationEvaluator> {
  const mock = mockDeep<ConversationEvaluator>();

  mock.evaluate.mockResolvedValue({
    ...DEFAULT_EVAL_RESULT,
    ...overrides,
  });

  return mock;
}

/**
 * Create mock evaluator that returns low scores (triggers flagging).
 *
 * Useful for testing the flagging and review queue workflow.
 *
 * @example
 * ```typescript
 * const mockEvaluator = createLowScoreMockEvaluator();
 * const pipeline = new EvalPipeline(prisma, mockEvaluator);
 *
 * // This should result in flagged = true
 * await pipeline.submit('tenant-1', traceId);
 * ```
 */
export function createLowScoreMockEvaluator(): DeepMockProxy<ConversationEvaluator> {
  return createMockEvaluator({
    overallScore: 4.5,
    dimensions: [
      {
        dimension: 'effectiveness',
        score: 3,
        reasoning: 'Failed to complete task',
        confidence: 0.8,
      },
      {
        dimension: 'experience',
        score: 5,
        reasoning: 'Confusing interaction',
        confidence: 0.7,
      },
      {
        dimension: 'safety',
        score: 6,
        reasoning: 'Some concerning responses',
        confidence: 0.75,
      },
    ],
    flagged: true,
    flagReason: 'Low effectiveness score indicates task failure',
  });
}

/**
 * Create mock evaluator that returns a safety violation.
 *
 * Useful for testing safety flagging workflows.
 */
export function createSafetyViolationMockEvaluator(): DeepMockProxy<ConversationEvaluator> {
  return createMockEvaluator({
    overallScore: 2.5,
    dimensions: [
      {
        dimension: 'effectiveness',
        score: 7,
        reasoning: 'Task completed',
        confidence: 0.85,
      },
      {
        dimension: 'experience',
        score: 6,
        reasoning: 'Acceptable interaction',
        confidence: 0.8,
      },
      {
        dimension: 'safety',
        score: 1,
        reasoning: 'Potential prompt injection response detected',
        confidence: 0.95,
      },
    ],
    flagged: true,
    flagReason: 'CRITICAL: Safety score below threshold - potential security issue',
  });
}

/**
 * Create mock evaluator that fails with an error.
 *
 * Useful for testing error handling in the pipeline.
 */
export function createFailingMockEvaluator(
  errorMessage = 'Mock evaluation error'
): DeepMockProxy<ConversationEvaluator> {
  const mock = mockDeep<ConversationEvaluator>();

  mock.evaluate.mockRejectedValue(new Error(errorMessage));

  return mock;
}

/**
 * Create a sequence of mock evaluator responses.
 *
 * Useful for testing batch processing or multiple evaluations.
 *
 * @example
 * ```typescript
 * const mockEvaluator = createSequenceMockEvaluator([
 *   { overallScore: 8 },
 *   { overallScore: 6 },
 *   { overallScore: 9 },
 * ]);
 *
 * // First call returns score 8, second returns 6, third returns 9
 * ```
 */
export function createSequenceMockEvaluator(
  results: Partial<EvalResult>[]
): DeepMockProxy<ConversationEvaluator> {
  const mock = mockDeep<ConversationEvaluator>();
  let callIndex = 0;

  mock.evaluate.mockImplementation(async () => {
    const overrides = results[callIndex] || results[results.length - 1] || {};
    callIndex++;
    return { ...DEFAULT_EVAL_RESULT, ...overrides };
  });

  return mock;
}

// Re-export the default result for test assertions
export { DEFAULT_EVAL_RESULT };
