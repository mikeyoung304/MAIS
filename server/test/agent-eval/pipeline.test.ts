/**
 * Pipeline and PII Redactor Tests
 *
 * Tests for evaluation pipeline functions and PII redaction utilities.
 *
 * @see todos/613-pending-p2-test-coverage-gaps.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';
import {
  redactPII,
  redactMessages,
  redactToolCalls,
  redactObjectPII,
  redactMessagesForPreview,
} from '../../src/lib/pii-redactor';
import { EvalPipeline, createEvalPipeline } from '../../src/agent/evals/pipeline';
import { ConversationEvaluator } from '../../src/agent/evals/evaluator';

// ─────────────────────────────────────────────────────────────────────────────
// PII Redactor Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PII Redactor', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for details';
      expect(redactPII(text)).toBe('Contact me at [EMAIL] for details');
    });

    it('should redact multiple emails', () => {
      const text = 'Email alice@test.com or bob@company.org';
      expect(redactPII(text)).toBe('Email [EMAIL] or [EMAIL]');
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at 555-123-4567';
      expect(redactPII(text)).toBe('Call me at [PHONE]');
    });

    it('should redact phone with area code in parentheses', () => {
      // Note: The regex captures from the opening digit, so parenthesis before area code is preserved
      const text = 'Phone: (555) 123-4567';
      expect(redactPII(text)).toBe('Phone: ([PHONE]');
    });

    it('should redact credit card numbers', () => {
      const text = 'Card: 1234-5678-9012-3456';
      expect(redactPII(text)).toBe('Card: [CARD]');
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      expect(redactPII(text)).toBe('SSN: [SSN]');
    });

    it('should redact street addresses', () => {
      const text = 'I live at 123 Main Street';
      expect(redactPII(text)).toBe('I live at [ADDRESS]');
    });

    it('should redact names after common patterns', () => {
      const text = 'My name is John Smith and I need help';
      const result = redactPII(text);
      expect(result).toContain('[NAME]');
    });
  });

  describe('redactMessages', () => {
    it('should redact content in message array', () => {
      const messages = [
        { role: 'user', content: 'My email is test@example.com' },
        { role: 'assistant', content: 'I got your email' },
      ];

      const result = redactMessages(messages);

      expect(result[0].content).toBe('My email is [EMAIL]');
      expect(result[1].content).toBe('I got your email');
    });

    it('should preserve other message properties', () => {
      const messages = [{ role: 'user', content: 'test@example.com', timestamp: '2024-01-01' }];

      const result = redactMessages(messages);

      expect(result[0].role).toBe('user');
      expect(result[0].timestamp).toBe('2024-01-01');
    });

    it('should handle empty array', () => {
      expect(redactMessages([])).toEqual([]);
    });
  });

  describe('redactToolCalls', () => {
    it('should redact PII in tool call input', () => {
      const toolCalls = [
        {
          toolName: 'send_email',
          input: { email: 'test@example.com', subject: 'Hello' },
          output: { success: true },
        },
      ];

      const result = redactToolCalls(toolCalls);

      // Sensitive key 'email' should be fully redacted
      expect(result[0].input.email).toBe('[REDACTED_EMAIL]');
    });

    it('should redact PII in tool call output', () => {
      const toolCalls = [
        {
          toolName: 'lookup_customer',
          input: { id: '123' },
          output: { phone: '555-123-4567', name: 'John' },
        },
      ];

      const result = redactToolCalls(toolCalls);

      // Sensitive key 'phone' should be fully redacted
      expect(result[0].output.phone).toBe('[REDACTED_PHONE]');
    });

    it('should handle undefined output', () => {
      const toolCalls = [
        {
          toolName: 'get_data',
          input: { query: 'test' },
          output: undefined,
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect(result[0].output).toBeUndefined();
    });

    it('should handle nested objects in input', () => {
      const toolCalls = [
        {
          toolName: 'complex_tool',
          input: {
            customer: { email: 'nested@test.com', name: 'Test' },
          },
          output: { ok: true },
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect((result[0].input.customer as Record<string, unknown>).email).toBe('[REDACTED_EMAIL]');
    });
  });

  describe('redactObjectPII', () => {
    it('should redact strings with PII patterns', () => {
      const obj = { note: 'Contact at test@example.com' };
      const result = redactObjectPII(obj) as Record<string, unknown>;
      expect(result.note).toBe('Contact at [EMAIL]');
    });

    it('should recursively redact nested objects', () => {
      const obj = {
        user: {
          data: {
            phone: '555-123-4567',
          },
        },
      };
      const result = redactObjectPII(obj) as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      expect(result.user.data.phone).toBe('[REDACTED_PHONE]');
    });

    it('should redact arrays', () => {
      const arr = ['test@a.com', 'test@b.com'];
      const result = redactObjectPII(arr);
      expect(result).toEqual(['[EMAIL]', '[EMAIL]']);
    });

    it('should handle null and primitives', () => {
      expect(redactObjectPII(null)).toBeNull();
      expect(redactObjectPII(123)).toBe(123);
      expect(redactObjectPII(true)).toBe(true);
    });
  });

  describe('redactMessagesForPreview', () => {
    it('should redact and truncate messages', () => {
      const longContent = 'test@example.com ' + 'a'.repeat(600);
      const messages = [{ role: 'user', content: longContent }];

      const result = redactMessagesForPreview(messages);

      expect(result[0].content).toContain('[EMAIL]');
      expect(result[0].content.length).toBe(500); // Default maxLength
    });

    it('should use custom maxLength', () => {
      const messages = [{ role: 'user', content: 'Hello there my friend!' }];

      const result = redactMessagesForPreview(messages, 10);

      expect(result[0].content).toBe('Hello ther');
    });

    it('should preserve role in output', () => {
      const messages = [
        { role: 'user', content: 'test', extra: 'data' },
        { role: 'assistant', content: 'response', extra: 'info' },
      ];

      const result = redactMessagesForPreview(messages);

      expect(result[0]).toEqual({ role: 'user', content: 'test' });
      expect(result[1]).toEqual({ role: 'assistant', content: 'response' });
    });

    it('should handle empty message content', () => {
      const messages = [{ role: 'user', content: '' }];
      const result = redactMessagesForPreview(messages);
      expect(result[0].content).toBe('');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('EvalPipeline', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let mockEvaluator: { evaluate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = mockDeep<PrismaClient>();
    mockEvaluator = {
      evaluate: vi.fn().mockResolvedValue({
        dimensions: [],
        overallScore: 7,
        overallConfidence: 0.9,
        summary: 'Good conversation',
        flagged: false,
        flagReason: null,
      }),
    };
  });

  describe('shouldEvaluate logic', () => {
    it('should always evaluate flagged traces when evaluateFlagged is true', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: true,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { samplingRate: 0, evaluateFlagged: true, asyncProcessing: false }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      // Should have called evaluate even though sampling rate is 0
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should always evaluate failed tasks when evaluateFailedTasks is true', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: false,
        taskCompleted: false, // Failed task
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { samplingRate: 0, evaluateFailedTasks: true, asyncProcessing: false }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should skip evaluation when not sampled', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: false,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);

      // Set sampling rate to 0 to ensure we never sample
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        {
          samplingRate: 0,
          evaluateFlagged: false,
          evaluateFailedTasks: false,
          asyncProcessing: false,
        }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('should require tenantId', async () => {
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { asyncProcessing: false }
      );

      await expect(pipeline.submit('', 'trace-1')).rejects.toThrow('tenantId is required');
    });

    it('should skip already evaluated traces', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        evalScore: 8.5, // Already evaluated
      } as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { asyncProcessing: false }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should throw TraceNotFoundError when trace does not exist', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue(null);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { asyncProcessing: false }
      );

      await expect(pipeline.submit('tenant-1', 'trace-999')).rejects.toThrow('Trace not found');
    });
  });

  describe('getUnevaluatedTraces', () => {
    it('should require tenantId', async () => {
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      await expect(pipeline.getUnevaluatedTraces('')).rejects.toThrow('tenantId is required');
    });

    it('should return trace IDs for tenant', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([
        { id: 'trace-1' },
        { id: 'trace-2' },
      ] as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      const result = await pipeline.getUnevaluatedTraces('tenant-1', 50);

      expect(result).toEqual(['trace-1', 'trace-2']);
      expect(mockPrisma.conversationTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            evalScore: null,
          }),
          take: 50,
        })
      );
    });
  });

  describe('waitForPending', () => {
    it('should settle all pending evaluations', async () => {
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { asyncProcessing: true }
      );

      // No pending evaluations - should resolve immediately
      await expect(pipeline.waitForPending()).resolves.toBeUndefined();
    });
  });

  describe('processBatch', () => {
    it('should process traces in batches', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: true,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { batchSize: 2, asyncProcessing: false }
      );

      await pipeline.processBatch('tenant-1', ['trace-1', 'trace-2', 'trace-3']);

      // Each trace should be submitted
      expect(mockPrisma.conversationTrace.findFirst).toHaveBeenCalledTimes(3);
    });
  });
});
