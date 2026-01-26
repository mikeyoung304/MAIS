/**
 * Feedback Module Tests
 *
 * Tests for implicit feedback analysis, review queue, and review actions.
 *
 * @see plans/agent-evaluation-system.md Phase 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createMockPrisma } from '../helpers/mock-prisma';
import {
  ImplicitFeedbackAnalyzer,
  createImplicitFeedbackAnalyzer,
} from '../../src/agent/feedback/implicit';
import { ReviewQueue, createReviewQueue } from '../../src/agent/feedback/review-queue';
import {
  ReviewActionService,
  createReviewActionService,
} from '../../src/agent/feedback/review-actions';
import type { TracedMessage } from '../../src/agent/tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createMessage(role: 'user' | 'assistant', content: string): TracedMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    latencyMs: role === 'assistant' ? 100 : null,
    tokenCount: Math.ceil(content.length / 4),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Implicit Feedback Analyzer Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ImplicitFeedbackAnalyzer', () => {
  let analyzer: ImplicitFeedbackAnalyzer;

  beforeEach(() => {
    analyzer = createImplicitFeedbackAnalyzer();
  });

  describe('analyze', () => {
    it('should count positive acknowledgments', () => {
      const signals = analyzer.analyze({
        turnCount: 3,
        totalLatencyMs: 1000,
        taskCompleted: true,
        messages: [
          createMessage('user', 'Hello'),
          createMessage('assistant', 'Hi there!'),
          createMessage('user', 'Thanks, that was helpful!'),
          createMessage('assistant', 'You are welcome!'),
          createMessage('user', 'Perfect, thank you!'),
          createMessage('assistant', 'Glad I could help!'),
        ],
        errors: null,
      });

      expect(signals.positiveAcknowledgments).toBe(2); // "thanks...helpful" and "Perfect, thank you"
    });

    it('should count negative signals', () => {
      const signals = analyzer.analyze({
        turnCount: 3,
        totalLatencyMs: 1000,
        taskCompleted: false,
        messages: [
          createMessage('user', 'I need help booking'),
          createMessage('assistant', 'Here are options...'),
          createMessage('user', 'No, that is wrong!'),
          createMessage('assistant', 'Let me try again...'),
          createMessage('user', 'This is useless, nothing works'),
          createMessage('assistant', 'I apologize...'),
        ],
        errors: null,
      });

      expect(signals.negativeSignals).toBeGreaterThanOrEqual(2);
    });

    it('should detect retry patterns', () => {
      const signals = analyzer.analyze({
        turnCount: 4,
        totalLatencyMs: 2000,
        taskCompleted: false,
        messages: [
          createMessage('user', 'Book me a session for Saturday'),
          createMessage('assistant', 'Sure, which service?'),
          createMessage('user', 'Book me a session for Saturday'),
          createMessage('assistant', 'I need the service type...'),
          createMessage('user', 'A session for Saturday please'),
          createMessage('assistant', 'Let me help...'),
        ],
        errors: null,
      });

      expect(signals.retryCount).toBeGreaterThanOrEqual(1);
    });

    it('should track abandonment', () => {
      const signals = analyzer.analyze({
        turnCount: 5,
        totalLatencyMs: 5000,
        taskCompleted: false,
        messages: [createMessage('user', 'Hello'), createMessage('assistant', 'Hi!')],
        errors: null,
      });

      expect(signals.abandonmentRate).toBe(1);
    });

    it('should calculate error rate', () => {
      const signals = analyzer.analyze({
        turnCount: 4,
        totalLatencyMs: 2000,
        taskCompleted: null,
        messages: [],
        errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
      });

      expect(signals.errorRate).toBe(0.5);
    });

    it('should count follow-up questions', () => {
      const signals = analyzer.analyze({
        turnCount: 3,
        totalLatencyMs: 1500,
        taskCompleted: true,
        messages: [
          createMessage('user', 'What are your hours?'),
          createMessage('assistant', '9am-5pm'),
          createMessage('user', 'Also, what about weekends?'),
          createMessage('assistant', 'Closed on weekends'),
          createMessage('user', 'One more thing, do you accept walk-ins?'),
          createMessage('assistant', 'Yes, we do!'),
        ],
        errors: null,
      });

      expect(signals.followUpQuestions).toBe(2);
    });

    it('should track tool call count', () => {
      const signals = analyzer.analyze({
        turnCount: 2,
        totalLatencyMs: 1000,
        taskCompleted: true,
        messages: [],
        toolCalls: [
          {
            toolName: 'get_services',
            input: {},
            output: {},
            latencyMs: 50,
            timestamp: '',
            trustTier: 'T1' as const,
            success: true,
            error: null,
            executionState: 'complete' as const,
            proposalId: null,
            proposalStatus: null,
          },
          {
            toolName: 'check_availability',
            input: {},
            output: {},
            latencyMs: 50,
            timestamp: '',
            trustTier: 'T1' as const,
            success: true,
            error: null,
            executionState: 'complete' as const,
            proposalId: null,
            proposalStatus: null,
          },
        ],
        errors: null,
      });

      expect(signals.toolCallCount).toBe(2);
    });
  });

  describe('calculateSatisfactionScore', () => {
    it('should return high score for positive conversation', () => {
      const signals = analyzer.analyze({
        turnCount: 4,
        totalLatencyMs: 2000,
        taskCompleted: true,
        messages: [
          createMessage('user', 'Hello'),
          createMessage('assistant', 'Hi!'),
          createMessage('user', 'Thanks for the quick response!'),
          createMessage('assistant', 'Happy to help!'),
          createMessage('user', 'Perfect, this is great!'),
          createMessage('assistant', 'Thank you!'),
        ],
        errors: null,
      });

      const score = analyzer.calculateSatisfactionScore(signals);
      expect(score).toBeGreaterThanOrEqual(7);
    });

    it('should return low score for frustrated conversation', () => {
      const signals = analyzer.analyze({
        turnCount: 6,
        totalLatencyMs: 10000,
        taskCompleted: false,
        messages: [
          createMessage('user', 'Help me book'),
          createMessage('assistant', 'Sure!'),
          createMessage('user', 'This is wrong'),
          createMessage('assistant', 'Sorry...'),
          createMessage('user', 'Still wrong, this is useless'),
          createMessage('assistant', 'Let me try...'),
        ],
        errors: [{ message: 'Error 1' }],
      });

      const score = analyzer.calculateSatisfactionScore(signals);
      expect(score).toBeLessThan(6);
    });

    it('should clamp score to 0-10 range', () => {
      // Very negative signals
      const badSignals = analyzer.analyze({
        turnCount: 15,
        totalLatencyMs: 30000,
        taskCompleted: false,
        messages: [
          createMessage('user', 'Wrong!'),
          createMessage('user', 'Incorrect again!'),
          createMessage('user', 'Useless!'),
          createMessage('user', 'Terrible!'),
        ],
        errors: [{ message: 'e' }, { message: 'e' }, { message: 'e' }],
      });

      const score = analyzer.calculateSatisfactionScore(badSignals);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('shouldFlag', () => {
    it('should flag high retry count', () => {
      const signals = {
        turnCount: 5,
        retryCount: 3,
        abandonmentRate: 0,
        timeToCompletionMs: 2000,
        avgResponseLength: 100,
        toolCallCount: 2,
        errorRate: 0,
        followUpQuestions: 0,
        positiveAcknowledgments: 0,
        negativeSignals: 0,
      };

      const result = analyzer.shouldFlag(signals);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('retry');
    });

    it('should flag multiple negative signals', () => {
      const signals = {
        turnCount: 5,
        retryCount: 0,
        abandonmentRate: 0,
        timeToCompletionMs: 2000,
        avgResponseLength: 100,
        toolCallCount: 2,
        errorRate: 0,
        followUpQuestions: 0,
        positiveAcknowledgments: 0,
        negativeSignals: 3,
      };

      const result = analyzer.shouldFlag(signals);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('negative');
    });

    it('should flag abandonment after multiple turns', () => {
      const signals = {
        turnCount: 5,
        retryCount: 0,
        abandonmentRate: 1,
        timeToCompletionMs: 2000,
        avgResponseLength: 100,
        toolCallCount: 2,
        errorRate: 0,
        followUpQuestions: 0,
        positiveAcknowledgments: 0,
        negativeSignals: 0,
      };

      const result = analyzer.shouldFlag(signals);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('abandon');
    });

    it('should flag high error rate', () => {
      const signals = {
        turnCount: 5,
        retryCount: 0,
        abandonmentRate: 0,
        timeToCompletionMs: 2000,
        avgResponseLength: 100,
        toolCallCount: 2,
        errorRate: 0.5,
        followUpQuestions: 0,
        positiveAcknowledgments: 0,
        negativeSignals: 0,
      };

      const result = analyzer.shouldFlag(signals);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('error rate');
    });

    it('should not flag positive conversation', () => {
      const signals = {
        turnCount: 4,
        retryCount: 0,
        abandonmentRate: 0,
        timeToCompletionMs: 2000,
        avgResponseLength: 100,
        toolCallCount: 2,
        errorRate: 0,
        followUpQuestions: 1,
        positiveAcknowledgments: 2,
        negativeSignals: 0,
      };

      const result = analyzer.shouldFlag(signals);
      expect(result.flagged).toBe(false);
      expect(result.reason).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review Queue Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ReviewQueue', () => {
  // P3-615: Use shared mock helper for consistency
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let queue: ReviewQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    queue = createReviewQueue(mockPrisma);
  });

  describe('getFlaggedConversations', () => {
    it('should fetch flagged conversations for tenant', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([
        {
          id: 'trace-1',
          tenantId: 'tenant-1',
          agentType: 'customer',
          evalScore: 3.5,
          flagReason: 'Low safety score',
          turnCount: 5,
          startedAt: new Date(),
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
      ]);

      const items = await queue.getFlaggedConversations('tenant-1', { limit: 10 });

      expect(mockPrisma.conversationTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            flagged: true,
          }),
        })
      );
      expect(items).toHaveLength(1);
      expect(items[0].traceId).toBe('trace-1');
    });

    it('should filter by agent type', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([]);

      await queue.getFlaggedConversations('tenant-1', { agentType: 'onboarding' });

      expect(mockPrisma.conversationTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentType: 'onboarding',
          }),
        })
      );
    });

    it('should filter by max score', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([]);

      await queue.getFlaggedConversations('tenant-1', { maxScore: 5 });

      expect(mockPrisma.conversationTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            evalScore: { lte: 5 },
          }),
        })
      );
    });

    it('should redact PII from messages', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([
        {
          id: 'trace-1',
          tenantId: 'tenant-1',
          agentType: 'customer',
          evalScore: 4,
          flagReason: 'Low score',
          turnCount: 2,
          startedAt: new Date(),
          messages: [
            { role: 'user', content: 'My email is test@example.com and phone is 555-123-4567' },
            { role: 'assistant', content: 'Got it!' },
          ],
        },
      ]);

      const items = await queue.getFlaggedConversations('tenant-1');

      expect(items[0].messagesPreview[0].content).toContain('[EMAIL]');
      expect(items[0].messagesPreview[0].content).toContain('[PHONE]');
      expect(items[0].messagesPreview[0].content).not.toContain('test@example.com');
    });
  });

  describe('submitReview', () => {
    it('should update trace and create action', async () => {
      // New pattern: updateMany in transaction returns count=1 when successful
      mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reviewAction.create.mockResolvedValue({});

      await queue.submitReview('tenant-1', 'trace-1', {
        reviewedBy: 'user@example.com',
        notes: 'Approved - agent performed well',
        actionTaken: 'approve',
      });

      expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'trace-1',
            tenantId: 'tenant-1', // P0: Tenant scoping in the where clause
          }),
          data: expect.objectContaining({
            reviewStatus: 'reviewed',
            reviewedBy: 'user@example.com',
          }),
        })
      );

      expect(mockPrisma.reviewAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'approve',
          }),
        })
      );
    });

    it('should reject if trace not found', async () => {
      // updateMany returns count=0 when trace not found or wrong tenant
      mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        queue.submitReview('tenant-1', 'trace-999', {
          reviewedBy: 'user@example.com',
          notes: 'Test',
          actionTaken: 'none',
        })
      ).rejects.toThrow('Trace not found: trace-999');
    });

    it('should not create action if actionTaken is none', async () => {
      // updateMany returns count=1 when trace found
      mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });

      await queue.submitReview('tenant-1', 'trace-1', {
        reviewedBy: 'user@example.com',
        notes: 'Just noting',
        actionTaken: 'none',
      });

      expect(mockPrisma.reviewAction.create).not.toHaveBeenCalled();
    });

    it('should update eval score if corrected', async () => {
      mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reviewAction.create.mockResolvedValue({});

      await queue.submitReview('tenant-1', 'trace-1', {
        reviewedBy: 'user@example.com',
        notes: 'Score was too low',
        correctEvalScore: 7.5,
        actionTaken: 'reject',
      });

      expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'trace-1',
            tenantId: 'tenant-1',
          }),
          data: expect.objectContaining({
            evalScore: 7.5,
          }),
        })
      );
    });

    // P2-612: Validation tests
    it('should reject reviewedBy exceeding 100 characters', async () => {
      await expect(
        queue.submitReview('tenant-1', 'trace-1', {
          reviewedBy: 'a'.repeat(101),
          notes: 'Valid notes',
          actionTaken: 'approve',
        })
      ).rejects.toThrow('Reviewer identifier must be 100 characters or less');
    });

    it('should reject notes exceeding 2000 characters', async () => {
      await expect(
        queue.submitReview('tenant-1', 'trace-1', {
          reviewedBy: 'valid@example.com',
          notes: 'x'.repeat(2001),
          actionTaken: 'approve',
        })
      ).rejects.toThrow('Notes must be 2000 characters or less');
    });

    it('should reject correctEvalScore below 0', async () => {
      await expect(
        queue.submitReview('tenant-1', 'trace-1', {
          reviewedBy: 'valid@example.com',
          notes: 'Valid notes',
          correctEvalScore: -1,
          actionTaken: 'approve',
        })
      ).rejects.toThrow('Score must be at least 0');
    });

    it('should reject correctEvalScore above 10', async () => {
      await expect(
        queue.submitReview('tenant-1', 'trace-1', {
          reviewedBy: 'valid@example.com',
          notes: 'Valid notes',
          correctEvalScore: 11,
          actionTaken: 'approve',
        })
      ).rejects.toThrow('Score must be at most 10');
    });

    it('should reject empty reviewedBy', async () => {
      await expect(
        queue.submitReview('tenant-1', 'trace-1', {
          reviewedBy: '',
          notes: 'Valid notes',
          actionTaken: 'approve',
        })
      ).rejects.toThrow('Reviewer identifier is required');
    });

    it('should accept valid boundary values', async () => {
      mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reviewAction.create.mockResolvedValue({});

      // Max length reviewedBy (100 chars)
      await queue.submitReview('tenant-1', 'trace-1', {
        reviewedBy: 'a'.repeat(100),
        notes: 'b'.repeat(2000), // Max length notes
        correctEvalScore: 10, // Max score
        actionTaken: 'approve',
      });

      expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockPrisma.conversationTrace.count
        .mockResolvedValueOnce(15) // pending
        .mockResolvedValueOnce(5); // reviewed today
      mockPrisma.conversationTrace.aggregate.mockResolvedValue({
        _avg: { evalScore: 4.2 },
      });
      mockPrisma.conversationTrace.groupBy.mockResolvedValue([
        { flagReason: 'Low safety score', _count: 8 },
        { flagReason: 'User frustration detected', _count: 5 },
        { flagReason: 'Task failure', _count: 2 },
      ]);

      const stats = await queue.getQueueStats('tenant-1');

      expect(stats.pendingCount).toBe(15);
      expect(stats.reviewedTodayCount).toBe(5);
      expect(stats.avgEvalScore).toBe(4.2);
      expect(stats.flagReasonBreakdown).toHaveProperty('safety');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review Action Service Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ReviewActionService', () => {
  // P3-615: Use shared mock helper for consistency
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let service: ReviewActionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = createReviewActionService(mockPrisma);
  });

  describe('recordAction', () => {
    it('should record action and update trace', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
      });
      mockPrisma.$transaction.mockResolvedValue([{ id: 'action-1', action: 'approve' }, {}]);

      const result = await service.recordAction('tenant-1', {
        traceId: 'trace-1',
        action: 'approve',
        notes: 'Looks good',
        performedBy: 'user@example.com',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.action).toBe('approve');
    });

    it('should reject if trace not found', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue(null);

      await expect(
        service.recordAction('tenant-1', {
          traceId: 'trace-999',
          action: 'approve',
          performedBy: 'user@example.com',
        })
      ).rejects.toThrow('Trace not found: trace-999');
    });
  });

  describe('getActionsForTrace', () => {
    it('should return actions for a trace', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
      });
      mockPrisma.reviewAction.findMany.mockResolvedValue([
        { id: 'action-1', action: 'approve', traceId: 'trace-1' },
        { id: 'action-2', action: 'escalate', traceId: 'trace-1' },
      ]);

      const actions = await service.getActionsForTrace('tenant-1', 'trace-1');

      expect(actions).toHaveLength(2);
    });

    it('should reject if trace not found', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue(null);

      await expect(service.getActionsForTrace('tenant-1', 'trace-999')).rejects.toThrow(
        'Trace not found: trace-999'
      );
    });
  });

  describe('getActionStats', () => {
    it('should return action statistics', async () => {
      mockPrisma.reviewAction.groupBy.mockResolvedValue([
        { action: 'approve', _count: 10 },
        { action: 'reject', _count: 3 },
        { action: 'escalate', _count: 2 },
      ]);
      mockPrisma.reviewAction.aggregate.mockResolvedValue({
        _avg: { correctedScore: 6.5 },
        _count: 5,
      });

      const stats = await service.getActionStats('tenant-1');

      expect(stats.totalActions).toBe(15);
      expect(stats.actionBreakdown.approve).toBe(10);
      expect(stats.actionBreakdown.reject).toBe(3);
      expect(stats.mostCommonAction).toBe('approve');
    });
  });
});
