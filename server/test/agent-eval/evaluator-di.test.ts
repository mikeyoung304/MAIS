/**
 * Evaluator DI Tests
 *
 * Tests for the ConversationEvaluator dependency injection.
 * Verifies that:
 * 1. Evaluator accepts injected Gemini client
 * 2. Default config is applied correctly
 * 3. Config overrides work
 *
 * @see plans/agent-eval-remediation-plan.md Phase 1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { ConversationEvaluator, createEvaluator } from '../../src/agent/evals/evaluator';
import { createMockGeminiClient, createTextResponse } from '../helpers/mock-gemini';
import { GEMINI_MODELS } from '../../src/llm';

// Mock the LLM module to prevent ADC initialization during tests
vi.mock('../../src/llm', async () => {
  const actual = await vi.importActual('../../src/llm');
  return {
    ...actual,
    getVertexClient: vi.fn(() => createMockGeminiClient([createTextResponse('{}')])),
  };
});

describe('ConversationEvaluator DI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should accept injected Gemini client', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI);

      expect(evaluator).toBeDefined();
      // Verify the evaluator was created successfully with the mock client
      expect(evaluator['gemini']).toBe(mockGemini);
    });

    it('should use default config when not provided', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI);

      // Verify default config is applied (using Gemini 2.5 Flash stable for evals)
      expect(evaluator['config'].model).toBe(GEMINI_MODELS.FLASH_STABLE);
      expect(evaluator['config'].maxTokens).toBe(2048);
      expect(evaluator['config'].temperature).toBe(0.1);
      expect(evaluator['config'].timeoutMs).toBe(30000);
    });

    it('should allow config override', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI, {
        model: GEMINI_MODELS.PRO,
        maxTokens: 4096,
        temperature: 0.2,
      });

      expect(evaluator['config'].model).toBe(GEMINI_MODELS.PRO);
      expect(evaluator['config'].maxTokens).toBe(4096);
      expect(evaluator['config'].temperature).toBe(0.2);
      // Default for non-overridden values
      expect(evaluator['config'].timeoutMs).toBe(30000);
    });

    it('should prioritize injected client over default', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI);

      // Should use the injected mock, not create a new client
      expect(evaluator['gemini']).toBe(mockGemini);
    });
  });

  describe('createEvaluator factory', () => {
    it('should create evaluator with injected client', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = createEvaluator(mockGemini as unknown as GoogleGenAI);

      expect(evaluator).toBeInstanceOf(ConversationEvaluator);
      expect(evaluator['gemini']).toBe(mockGemini);
    });

    it('should create evaluator with config only', () => {
      const evaluator = createEvaluator(undefined, { model: GEMINI_MODELS.PRO });

      expect(evaluator).toBeInstanceOf(ConversationEvaluator);
      expect(evaluator['config'].model).toBe(GEMINI_MODELS.PRO);
    });

    it('should create evaluator with both client and config', () => {
      const mockGemini = createMockGeminiClient([createTextResponse('{}')]);
      const evaluator = createEvaluator(mockGemini as unknown as GoogleGenAI, { temperature: 0.5 });

      expect(evaluator['gemini']).toBe(mockGemini);
      expect(evaluator['config'].temperature).toBe(0.5);
    });
  });

  describe('evaluate with mock client', () => {
    it('should call mock client correctly', async () => {
      const mockResponse = JSON.stringify({
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
      });

      const mockGemini = createMockGeminiClient([createTextResponse(mockResponse)]);
      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI);

      const result = await evaluator.evaluate({
        traceId: 'trace-123',
        tenantId: 'tenant-1',
        agentType: 'customer',
        messages: [{ role: 'user', content: 'Hello', timestamp: new Date().toISOString() }],
        toolCalls: [],
        taskCompleted: true,
      });

      // Verify the mock was called
      expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(1);

      // Verify result structure
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.dimensions).toHaveLength(3);
      expect(result.flagged).toBe(false);
    });

    it('should handle evaluation errors gracefully', async () => {
      const mockGemini = createMockGeminiClient([createTextResponse('invalid json')]);
      // Make the mock reject
      mockGemini.models.generateContent.mockRejectedValueOnce(new Error('Request failed'));

      const evaluator = new ConversationEvaluator(mockGemini as unknown as GoogleGenAI);

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
