/**
 * Evaluator DI Tests
 *
 * Tests for the ConversationEvaluator dependency injection fixes (P1-583).
 * Verifies that:
 * 1. Evaluator accepts injected Anthropic client
 * 2. Evaluator throws if no API key and no client provided
 * 3. Default config is applied correctly
 * 4. Config overrides work
 *
 * @see plans/agent-eval-remediation-plan.md Phase 1.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import Anthropic from '@anthropic-ai/sdk';
import { ConversationEvaluator, createEvaluator } from '../../src/agent/evals/evaluator';

describe('ConversationEvaluator DI', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    // Clear mocks between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env var
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe('constructor', () => {
    it('should accept injected Anthropic client', () => {
      const mockAnthropic = mockDeep<Anthropic>();
      const evaluator = new ConversationEvaluator(mockAnthropic);

      expect(evaluator).toBeDefined();
      // Verify the evaluator was created successfully with the mock client
      expect(evaluator['anthropic']).toBe(mockAnthropic);
    });

    it('should throw if no API key and no client provided', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ConversationEvaluator()).toThrow(
        'ANTHROPIC_API_KEY required when no Anthropic client provided'
      );
    });

    it('should create default client when API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';

      const evaluator = new ConversationEvaluator();

      expect(evaluator).toBeDefined();
      expect(evaluator['anthropic']).toBeInstanceOf(Anthropic);
    });

    it('should use default config when not provided', () => {
      const mockAnthropic = mockDeep<Anthropic>();
      const evaluator = new ConversationEvaluator(mockAnthropic);

      // Verify default config is applied
      expect(evaluator['config'].model).toBe('claude-haiku-4-5');
      expect(evaluator['config'].maxTokens).toBe(2048);
      expect(evaluator['config'].temperature).toBe(0.1);
      expect(evaluator['config'].timeoutMs).toBe(30000);
    });

    it('should allow config override', () => {
      const mockAnthropic = mockDeep<Anthropic>();
      const evaluator = new ConversationEvaluator(mockAnthropic, {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.2,
      });

      expect(evaluator['config'].model).toBe('claude-sonnet-4-20250514');
      expect(evaluator['config'].maxTokens).toBe(4096);
      expect(evaluator['config'].temperature).toBe(0.2);
      // Default for non-overridden values
      expect(evaluator['config'].timeoutMs).toBe(30000);
    });

    it('should prioritize injected client over env var', () => {
      process.env.ANTHROPIC_API_KEY = 'should-not-be-used';
      const mockAnthropic = mockDeep<Anthropic>();

      const evaluator = new ConversationEvaluator(mockAnthropic);

      // Should use the injected mock, not create a new client
      expect(evaluator['anthropic']).toBe(mockAnthropic);
    });
  });

  describe('createEvaluator factory', () => {
    it('should create evaluator with injected client', () => {
      const mockAnthropic = mockDeep<Anthropic>();
      const evaluator = createEvaluator(mockAnthropic);

      expect(evaluator).toBeInstanceOf(ConversationEvaluator);
      expect(evaluator['anthropic']).toBe(mockAnthropic);
    });

    it('should create evaluator with config only', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const evaluator = createEvaluator(undefined, { model: 'claude-sonnet-4-20250514' });

      expect(evaluator).toBeInstanceOf(ConversationEvaluator);
      expect(evaluator['config'].model).toBe('claude-sonnet-4-20250514');
    });

    it('should create evaluator with both client and config', () => {
      const mockAnthropic = mockDeep<Anthropic>();
      const evaluator = createEvaluator(mockAnthropic, { temperature: 0.5 });

      expect(evaluator['anthropic']).toBe(mockAnthropic);
      expect(evaluator['config'].temperature).toBe(0.5);
    });
  });

  describe('evaluate with mock client', () => {
    it('should call mock client correctly', async () => {
      const mockAnthropic = mockDeep<Anthropic>();

      // Set up mock response
      mockAnthropic.messages.create.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dimensions: [
                { dimension: 'effectiveness', score: 8, reasoning: 'Good', confidence: 0.9 },
                { dimension: 'experience', score: 7, reasoning: 'Smooth', confidence: 0.85 },
                { dimension: 'safety', score: 9, reasoning: 'Safe', confidence: 0.95 },
              ],
              overallScore: 8,
              overallConfidence: 0.9,
              summary: 'Good conversation',
              flagged: false,
              flagReason: null,
            }),
          },
        ],
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      } as any);

      const evaluator = new ConversationEvaluator(mockAnthropic);

      const result = await evaluator.evaluate({
        traceId: 'trace-123',
        tenantId: 'tenant-1',
        agentType: 'customer',
        messages: [{ role: 'user', content: 'Hello', timestamp: new Date().toISOString() }],
        toolCalls: [],
        taskCompleted: true,
      });

      // Verify the mock was called
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);

      // Verify result structure
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.dimensions).toHaveLength(3);
      expect(result.flagged).toBe(false);
    });

    it('should handle evaluation errors gracefully', async () => {
      const mockAnthropic = mockDeep<Anthropic>();

      // Note: Using neutral error message without retryable keywords
      // See: docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md
      mockAnthropic.messages.create.mockRejectedValue(new Error('Request failed'));

      const evaluator = new ConversationEvaluator(mockAnthropic);

      const result = await evaluator.evaluate({
        traceId: 'trace-123',
        tenantId: 'tenant-1',
        agentType: 'customer',
        messages: [],
        toolCalls: [],
        taskCompleted: null,
      });

      // Should return a failed result flagged for review
      expect(result.flagged).toBe(true);
      expect(result.overallConfidence).toBe(0);
      expect(result.summary).toContain('Evaluation failed');
    });
  });
});
