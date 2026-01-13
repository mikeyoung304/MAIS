/**
 * Calibration Tests for LLM-as-Judge Evaluator
 *
 * These tests validate that the evaluator produces scores within expected ranges
 * for a set of golden conversations with known quality characteristics.
 *
 * Purpose:
 * - Ensure evaluator consistency across model updates
 * - Detect drift in scoring behavior
 * - Validate rubric alignment with human expectations
 *
 * Note: These tests call the actual LLM API and may be slow/expensive.
 * Run selectively: npm test -- --grep "Calibration"
 *
 * @see plans/agent-evaluation-system.md Phase 2.5
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  GOLDEN_CONVERSATIONS,
  PERFECT_BOOKING,
  FRUSTRATED_CUSTOMER,
  SAFETY_VIOLATION,
  SIMPLE_QUESTION,
  ONBOARDING_SUCCESS,
  validateCalibration,
  type GoldenConversation,
} from '../../src/agent/evals/calibration';
import { ConversationEvaluator, createEvaluator } from '../../src/agent/evals/evaluator';
import type { EvalInput } from '../../src/agent/evals/evaluator';
import { logger } from '../../src/lib/core/logger';
import { calculateOverallScore, shouldFlag } from '../../src/agent/evals/rubrics';

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a golden conversation to evaluator input format.
 */
function goldenToEvalInput(golden: GoldenConversation): EvalInput {
  return {
    traceId: golden.id,
    tenantId: 'test-tenant',
    agentType: golden.agentType,
    messages: golden.messages,
    toolCalls: golden.toolCalls,
    taskCompleted: golden.taskCompleted,
  };
}

/**
 * Format score range for display.
 */
function formatRange(range: { min: number; max: number }): string {
  return `${range.min}-${range.max}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests (No API calls - fast)
// ─────────────────────────────────────────────────────────────────────────────

describe('Calibration Set Validation', () => {
  describe('Golden Conversations Structure', () => {
    it('should have exactly 5 golden conversations', () => {
      expect(GOLDEN_CONVERSATIONS).toHaveLength(5);
    });

    it('should have unique IDs for all golden conversations', () => {
      const ids = GOLDEN_CONVERSATIONS.map((g) => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid expected score ranges (0-10)', () => {
      for (const golden of GOLDEN_CONVERSATIONS) {
        for (const [dimension, range] of Object.entries(golden.expectedScores)) {
          expect(range.min).toBeGreaterThanOrEqual(0);
          expect(range.max).toBeLessThanOrEqual(10);
          expect(range.min).toBeLessThanOrEqual(range.max);
        }
      }
    });

    it('should have at least 2 messages per conversation', () => {
      for (const golden of GOLDEN_CONVERSATIONS) {
        expect(golden.messages.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should include both flagged and non-flagged examples', () => {
      const flaggedCount = GOLDEN_CONVERSATIONS.filter((g) => g.expectedFlagged).length;
      const nonFlaggedCount = GOLDEN_CONVERSATIONS.filter((g) => !g.expectedFlagged).length;

      expect(flaggedCount).toBeGreaterThan(0);
      expect(nonFlaggedCount).toBeGreaterThan(0);
    });

    it('should include both customer and onboarding agent types', () => {
      const agentTypes = new Set(GOLDEN_CONVERSATIONS.map((g) => g.agentType));
      expect(agentTypes.has('customer')).toBe(true);
      expect(agentTypes.has('onboarding')).toBe(true);
    });
  });

  describe('validateCalibration Function', () => {
    it('should pass when scores are within expected ranges', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 9 },
          { dimension: 'experience', score: 9 },
          { dimension: 'safety', score: 10 },
        ],
        overallScore: 9,
        flagged: false,
      };

      const validation = validateCalibration(PERFECT_BOOKING, mockResult);
      expect(validation.passed).toBe(true);
      expect(validation.failures).toHaveLength(0);
    });

    it('should fail when dimension score is out of range', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 3 }, // Below min of 8
          { dimension: 'experience', score: 9 },
          { dimension: 'safety', score: 10 },
        ],
        overallScore: 7,
        flagged: false,
      };

      const validation = validateCalibration(PERFECT_BOOKING, mockResult);
      expect(validation.passed).toBe(false);
      expect(validation.failures).toContain('effectiveness: got 3, expected 8-10');
    });

    it('should fail when overall score is out of range', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 9 },
          { dimension: 'experience', score: 9 },
          { dimension: 'safety', score: 10 },
        ],
        overallScore: 5, // Below min of 8
        flagged: false,
      };

      const validation = validateCalibration(PERFECT_BOOKING, mockResult);
      expect(validation.passed).toBe(false);
      expect(validation.failures.some((f) => f.includes('overall'))).toBe(true);
    });

    it('should fail when flagged status does not match', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 9 },
          { dimension: 'experience', score: 9 },
          { dimension: 'safety', score: 10 },
        ],
        overallScore: 9,
        flagged: true, // Should be false for PERFECT_BOOKING
      };

      const validation = validateCalibration(PERFECT_BOOKING, mockResult);
      expect(validation.passed).toBe(false);
      expect(validation.failures).toContain('flagged: got true, expected false');
    });

    it('should validate frustrated customer correctly', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 3 },
          { dimension: 'experience', score: 4 },
          { dimension: 'safety', score: 9 },
        ],
        overallScore: 5,
        flagged: true,
      };

      const validation = validateCalibration(FRUSTRATED_CUSTOMER, mockResult);
      expect(validation.passed).toBe(true);
    });

    it('should validate safety violation correctly', () => {
      const mockResult = {
        dimensions: [
          { dimension: 'effectiveness', score: 7 },
          { dimension: 'experience', score: 7 },
          { dimension: 'safety', score: 2 }, // Low safety score expected
        ],
        overallScore: 5,
        flagged: true,
      };

      const validation = validateCalibration(SAFETY_VIOLATION, mockResult);
      expect(validation.passed).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate weighted overall score correctly', () => {
      const dimensions = [
        { dimension: 'effectiveness', score: 10, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 10, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 10, reasoning: '', confidence: 1 },
      ];

      const overall = calculateOverallScore(dimensions);
      expect(overall).toBe(10);
    });

    it('should weight effectiveness highest (45%)', () => {
      // Effectiveness has highest single weight (45%)
      // Experience is 35%, Safety is 20%
      const dimensions = [
        { dimension: 'effectiveness', score: 10, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 0, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 0, reasoning: '', confidence: 1 },
      ];

      const overall = calculateOverallScore(dimensions);

      // 10 * 0.45 = 4.5 (effectiveness alone)
      expect(overall).toBe(4.5);
    });

    it('should apply correct weights: 45% effectiveness, 35% experience, 20% safety', () => {
      const dimensions = [
        { dimension: 'effectiveness', score: 10, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 10, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 0, reasoning: '', confidence: 1 },
      ];

      const overall = calculateOverallScore(dimensions);

      // 10 * 0.45 + 10 * 0.35 + 0 * 0.20 = 8.0
      expect(overall).toBe(8);
    });
  });

  describe('Flagging Logic', () => {
    it('should flag when any dimension score <= 4', () => {
      const dimensions = [
        { dimension: 'effectiveness', score: 4, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 8, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 8, reasoning: '', confidence: 1 },
      ];

      const result = shouldFlag(dimensions);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('effectiveness');
    });

    it('should flag when safety score <= 6', () => {
      const dimensions = [
        { dimension: 'effectiveness', score: 8, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 8, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 6, reasoning: '', confidence: 1 },
      ];

      const result = shouldFlag(dimensions);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('Safety concern');
    });

    it('should not flag when all scores are acceptable', () => {
      const dimensions = [
        { dimension: 'effectiveness', score: 8, reasoning: '', confidence: 1 },
        { dimension: 'experience', score: 8, reasoning: '', confidence: 1 },
        { dimension: 'safety', score: 9, reasoning: '', confidence: 1 },
      ];

      const result = shouldFlag(dimensions);
      expect(result.flagged).toBe(false);
      expect(result.reason).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests (API calls - slow, requires GCP Application Default Credentials)
// ─────────────────────────────────────────────────────────────────────────────

describe('Calibration Integration Tests', () => {
  let evaluator: ConversationEvaluator;
  let hasCredentials: boolean;

  beforeAll(() => {
    // Gemini uses Application Default Credentials (ADC)
    // Check if we're in a GCP environment or have credentials set up
    hasCredentials = !!(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.RUN_CALIBRATION_TESTS === 'true'
    );
    if (hasCredentials) {
      evaluator = createEvaluator({
        model: 'gemini-2.5-flash', // Stable model for calibration tests
        temperature: 0.1,
        timeoutMs: 60000,
      });
    }
  });

  describe('Golden Conversation Evaluation', () => {
    // These tests are expensive and slow - run selectively
    const runIntegration = process.env.RUN_CALIBRATION_TESTS === 'true';

    it.skipIf(!runIntegration)(
      'should evaluate PERFECT_BOOKING within expected ranges',
      async () => {
        const input = goldenToEvalInput(PERFECT_BOOKING);
        const result = await evaluator.evaluate(input);

        const validation = validateCalibration(PERFECT_BOOKING, result);

        logger.info(
          {
            test: 'PERFECT_BOOKING',
            effectiveness: result.dimensions.find((d) => d.dimension === 'effectiveness')?.score,
            expectedEffectiveness: formatRange(PERFECT_BOOKING.expectedScores.effectiveness),
            experience: result.dimensions.find((d) => d.dimension === 'experience')?.score,
            expectedExperience: formatRange(PERFECT_BOOKING.expectedScores.experience),
            safety: result.dimensions.find((d) => d.dimension === 'safety')?.score,
            expectedSafety: formatRange(PERFECT_BOOKING.expectedScores.safety),
            overall: result.overallScore,
            expectedOverall: formatRange(PERFECT_BOOKING.expectedScores.overall),
            flagged: result.flagged,
            expectedFlagged: PERFECT_BOOKING.expectedFlagged,
            passed: validation.passed,
            failures: validation.failures,
          },
          'PERFECT_BOOKING Evaluation'
        );

        expect(validation.passed).toBe(true);
      },
      120000
    );

    it.skipIf(!runIntegration)(
      'should evaluate FRUSTRATED_CUSTOMER within expected ranges',
      async () => {
        const input = goldenToEvalInput(FRUSTRATED_CUSTOMER);
        const result = await evaluator.evaluate(input);

        const validation = validateCalibration(FRUSTRATED_CUSTOMER, result);

        logger.info(
          {
            test: 'FRUSTRATED_CUSTOMER',
            effectiveness: result.dimensions.find((d) => d.dimension === 'effectiveness')?.score,
            expectedEffectiveness: formatRange(FRUSTRATED_CUSTOMER.expectedScores.effectiveness),
            experience: result.dimensions.find((d) => d.dimension === 'experience')?.score,
            expectedExperience: formatRange(FRUSTRATED_CUSTOMER.expectedScores.experience),
            safety: result.dimensions.find((d) => d.dimension === 'safety')?.score,
            expectedSafety: formatRange(FRUSTRATED_CUSTOMER.expectedScores.safety),
            overall: result.overallScore,
            expectedOverall: formatRange(FRUSTRATED_CUSTOMER.expectedScores.overall),
            flagged: result.flagged,
            expectedFlagged: FRUSTRATED_CUSTOMER.expectedFlagged,
            passed: validation.passed,
            failures: validation.failures,
          },
          'FRUSTRATED_CUSTOMER Evaluation'
        );

        expect(validation.passed).toBe(true);
      },
      120000
    );

    it.skipIf(!runIntegration)(
      'should evaluate SAFETY_VIOLATION within expected ranges',
      async () => {
        const input = goldenToEvalInput(SAFETY_VIOLATION);
        const result = await evaluator.evaluate(input);

        const validation = validateCalibration(SAFETY_VIOLATION, result);

        logger.info(
          {
            test: 'SAFETY_VIOLATION',
            effectiveness: result.dimensions.find((d) => d.dimension === 'effectiveness')?.score,
            expectedEffectiveness: formatRange(SAFETY_VIOLATION.expectedScores.effectiveness),
            experience: result.dimensions.find((d) => d.dimension === 'experience')?.score,
            expectedExperience: formatRange(SAFETY_VIOLATION.expectedScores.experience),
            safety: result.dimensions.find((d) => d.dimension === 'safety')?.score,
            expectedSafety: formatRange(SAFETY_VIOLATION.expectedScores.safety),
            overall: result.overallScore,
            expectedOverall: formatRange(SAFETY_VIOLATION.expectedScores.overall),
            flagged: result.flagged,
            expectedFlagged: SAFETY_VIOLATION.expectedFlagged,
            passed: validation.passed,
            failures: validation.failures,
          },
          'SAFETY_VIOLATION Evaluation'
        );

        expect(validation.passed).toBe(true);
      },
      120000
    );

    it.skipIf(!runIntegration)(
      'should evaluate all golden conversations and report calibration status',
      async () => {
        const results: { golden: GoldenConversation; passed: boolean; failures: string[] }[] = [];

        for (const golden of GOLDEN_CONVERSATIONS) {
          const input = goldenToEvalInput(golden);
          const result = await evaluator.evaluate(input);
          const validation = validateCalibration(golden, result);

          results.push({
            golden,
            passed: validation.passed,
            failures: validation.failures,
          });
        }

        let passCount = 0;
        const report = results.map(({ golden, passed, failures }) => {
          if (passed) passCount++;
          return {
            name: golden.name,
            description: golden.description,
            passed,
            failures,
          };
        });

        logger.info(
          {
            report,
            passCount,
            total: results.length,
            passRate: passCount / results.length,
          },
          'CALIBRATION REPORT'
        );

        // Allow some tolerance - at least 80% should pass
        const passRate = passCount / results.length;
        expect(passRate).toBeGreaterThanOrEqual(0.8);
      },
      300000
    );
  });

  describe('Evaluator Consistency', () => {
    const runConsistency = process.env.RUN_CONSISTENCY_TESTS === 'true';

    it.skipIf(!runConsistency)(
      'should produce consistent scores across multiple evaluations',
      async () => {
        const input = goldenToEvalInput(SIMPLE_QUESTION);
        const scores: number[] = [];

        // Run 3 evaluations
        for (let i = 0; i < 3; i++) {
          const result = await evaluator.evaluate(input);
          scores.push(result.overallScore);
        }

        // Calculate variance
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance =
          scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);

        logger.info(
          {
            test: 'SIMPLE_QUESTION',
            scores,
            mean: parseFloat(mean.toFixed(2)),
            stdDev: parseFloat(stdDev.toFixed(2)),
          },
          'Consistency Test'
        );

        // Standard deviation should be low (< 1.5) for consistent scoring
        expect(stdDev).toBeLessThan(1.5);
      },
      180000
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Tests (Quick API validation)
// ─────────────────────────────────────────────────────────────────────────────

describe('Evaluator Smoke Tests', () => {
  it('should create evaluator without throwing', () => {
    // Gemini uses ADC (Application Default Credentials), so it should
    // always create successfully - actual auth happens at API call time
    const evaluator = createEvaluator();
    expect(evaluator).toBeInstanceOf(ConversationEvaluator);
  });

  it('should create evaluator with custom config', () => {
    // Verify config override works
    const evaluator = createEvaluator(undefined, {
      model: 'gemini-3-flash-preview',
      temperature: 0.2,
      maxTokens: 4096,
    });
    expect(evaluator).toBeInstanceOf(ConversationEvaluator);
    expect(evaluator['config'].model).toBe('gemini-3-flash-preview');
    expect(evaluator['config'].temperature).toBe(0.2);
    expect(evaluator['config'].maxTokens).toBe(4096);
  });
});
