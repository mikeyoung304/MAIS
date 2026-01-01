/**
 * Unit tests for ProposalService
 *
 * Tests the agent proposal mechanism for write operations.
 * Covers trust tier enforcement:
 * - T1: Auto-confirmed, executes immediately
 * - T2: Soft confirm, auto-confirms after next message (unless rejection keywords)
 * - T3: Hard confirm, requires explicit confirm_proposal() call
 *
 * Security focus: tenant isolation and prompt injection prevention.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProposalService,
  type CreateProposalInput,
  type ProposalResult,
} from '../../../src/agent/proposals/proposal.service';
import type {
  PrismaClient,
  AgentProposal,
  AgentTrustTier,
  AgentProposalStatus,
} from '../../../src/generated/prisma';

// Mock the logger
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProposalService', () => {
  let service: ProposalService;
  let mockPrisma: MockPrismaClient;

  // Type-safe mock builder for Prisma
  type MockPrismaClient = {
    agentProposal: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  // Helper to create mock proposal
  function createMockProposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
    const now = new Date();
    return {
      id: 'prop_test123',
      tenantId: 'tenant_abc',
      sessionId: 'session_xyz',
      customerId: null,
      toolName: 'test_tool',
      operation: 'Test Operation',
      trustTier: 'T2' as AgentTrustTier,
      payload: { key: 'value' },
      preview: { description: 'Test preview' },
      status: 'PENDING' as AgentProposalStatus,
      requiresApproval: true,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      confirmedAt: null,
      executedAt: null,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      agentProposal: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    service = new ProposalService(mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createProposal()', () => {
    const baseInput: CreateProposalInput = {
      tenantId: 'tenant_abc',
      sessionId: 'session_xyz',
      toolName: 'test_tool',
      operation: 'Test Operation',
      trustTier: 'T2',
      payload: { key: 'value' },
      preview: { description: 'Test preview' },
    };

    it('should auto-confirm T1 proposals', async () => {
      const input: CreateProposalInput = { ...baseInput, trustTier: 'T1' };
      const mockProposal = createMockProposal({
        id: 'prop_t1',
        trustTier: 'T1',
        status: 'CONFIRMED',
        requiresApproval: false,
        confirmedAt: new Date(),
      });

      mockPrisma.agentProposal.create.mockResolvedValue(mockProposal);

      const result = await service.createProposal(input);

      expect(result.status).toBe('CONFIRMED');
      expect(result.requiresApproval).toBe(false);
      expect(result.trustTier).toBe('T1');

      // Verify the create call received correct status
      const createCall = mockPrisma.agentProposal.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('CONFIRMED');
      expect(createCall.data.requiresApproval).toBe(false);
      expect(createCall.data.confirmedAt).toBeDefined();
    });

    it('should create T2 proposals as PENDING', async () => {
      const input: CreateProposalInput = { ...baseInput, trustTier: 'T2' };
      const mockProposal = createMockProposal({
        id: 'prop_t2',
        trustTier: 'T2',
        status: 'PENDING',
        requiresApproval: true,
      });

      mockPrisma.agentProposal.create.mockResolvedValue(mockProposal);

      const result = await service.createProposal(input);

      expect(result.status).toBe('PENDING');
      expect(result.requiresApproval).toBe(true);
      expect(result.trustTier).toBe('T2');

      const createCall = mockPrisma.agentProposal.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PENDING');
      expect(createCall.data.requiresApproval).toBe(true);
      expect(createCall.data.confirmedAt).toBeNull();
    });

    it('should create T3 proposals as PENDING', async () => {
      const input: CreateProposalInput = { ...baseInput, trustTier: 'T3' };
      const mockProposal = createMockProposal({
        id: 'prop_t3',
        trustTier: 'T3',
        status: 'PENDING',
        requiresApproval: true,
      });

      mockPrisma.agentProposal.create.mockResolvedValue(mockProposal);

      const result = await service.createProposal(input);

      expect(result.status).toBe('PENDING');
      expect(result.requiresApproval).toBe(true);
      expect(result.trustTier).toBe('T3');
    });

    it('should set correct expiration time (30 minutes)', async () => {
      const beforeCreate = Date.now();
      const mockProposal = createMockProposal();
      mockPrisma.agentProposal.create.mockResolvedValue(mockProposal);

      const result = await service.createProposal(baseInput);
      const afterCreate = Date.now();

      const expiresAt = new Date(result.expiresAt).getTime();
      const thirtyMinutesMs = 30 * 60 * 1000;

      // Expiration should be ~30 minutes from now
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCreate + thirtyMinutesMs - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterCreate + thirtyMinutesMs + 1000);
    });

    it('should return correct ProposalResult structure', async () => {
      const mockProposal = createMockProposal();
      mockPrisma.agentProposal.create.mockResolvedValue(mockProposal);

      const result = await service.createProposal(baseInput);

      expect(result).toHaveProperty('proposalId');
      expect(result).toHaveProperty('operation');
      expect(result).toHaveProperty('preview');
      expect(result).toHaveProperty('trustTier');
      expect(result).toHaveProperty('requiresApproval');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('expiresAt');
    });
  });

  describe('getProposal()', () => {
    it('should return proposal for matching tenantId', async () => {
      const tenantId = 'tenant_abc';
      const proposalId = 'prop_123';
      const mockProposal = createMockProposal({ id: proposalId, tenantId });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(mockProposal);

      const result = await service.getProposal(tenantId, proposalId);

      expect(result).toEqual(mockProposal);
      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });
    });

    it('should return null for mismatched tenantId (tenant isolation)', async () => {
      const correctTenantId = 'tenant_abc';
      const wrongTenantId = 'tenant_evil';
      const proposalId = 'prop_123';

      // Proposal belongs to tenant_abc
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await service.getProposal(wrongTenantId, proposalId);

      expect(result).toBeNull();
      // Verify the query included the wrong tenant ID (which should find nothing)
      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          tenantId: wrongTenantId,
        },
      });
    });

    it('should return null for non-existent proposal', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await service.getProposal('tenant_abc', 'non_existent');

      expect(result).toBeNull();
    });
  });

  describe('confirmProposal()', () => {
    const tenantId = 'tenant_abc';
    const proposalId = 'prop_123';

    it('should confirm PENDING proposals', async () => {
      const pendingProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'PENDING',
      });

      const confirmedProposal = createMockProposal({
        ...pendingProposal,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(pendingProposal);
      mockPrisma.agentProposal.update.mockResolvedValue(confirmedProposal);

      const result = await service.confirmProposal(tenantId, proposalId);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('CONFIRMED');
      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        },
      });
    });

    it('should return null for expired proposals', async () => {
      const expiredProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(expiredProposal);
      mockPrisma.agentProposal.update.mockResolvedValue({
        ...expiredProposal,
        status: 'EXPIRED',
      });

      const result = await service.confirmProposal(tenantId, proposalId);

      expect(result).toBeNull();
      // Should have marked as EXPIRED
      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return null for non-PENDING proposals', async () => {
      // Already confirmed proposal
      const confirmedProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'CONFIRMED',
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(confirmedProposal);

      const result = await service.confirmProposal(tenantId, proposalId);

      expect(result).toBeNull();
      // Should NOT have called update
      expect(mockPrisma.agentProposal.update).not.toHaveBeenCalled();
    });

    it('should return null for EXECUTED proposals', async () => {
      const executedProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'EXECUTED',
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(executedProposal);

      const result = await service.confirmProposal(tenantId, proposalId);

      expect(result).toBeNull();
    });

    it('should return null for non-existent proposal (tenant isolation)', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await service.confirmProposal(tenantId, proposalId);

      expect(result).toBeNull();
    });
  });

  describe('rejectProposal()', () => {
    const tenantId = 'tenant_abc';
    const proposalId = 'prop_123';

    it('should reject PENDING proposals', async () => {
      const pendingProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'PENDING',
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(pendingProposal);
      mockPrisma.agentProposal.update.mockResolvedValue({
        ...pendingProposal,
        status: 'REJECTED',
      });

      const result = await service.rejectProposal(tenantId, proposalId);

      expect(result).toBe(true);
      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: { status: 'REJECTED' },
      });
    });

    it('should return false for non-PENDING proposals', async () => {
      const confirmedProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'CONFIRMED',
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(confirmedProposal);

      const result = await service.rejectProposal(tenantId, proposalId);

      expect(result).toBe(false);
      expect(mockPrisma.agentProposal.update).not.toHaveBeenCalled();
    });

    it('should return false for non-existent proposal', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await service.rejectProposal(tenantId, proposalId);

      expect(result).toBe(false);
    });

    it('should return false for EXECUTED proposals', async () => {
      const executedProposal = createMockProposal({
        id: proposalId,
        tenantId,
        status: 'EXECUTED',
      });

      mockPrisma.agentProposal.findFirst.mockResolvedValue(executedProposal);

      const result = await service.rejectProposal(tenantId, proposalId);

      expect(result).toBe(false);
    });
  });

  describe('softConfirmPendingT2()', () => {
    const tenantId = 'tenant_abc';
    const sessionId = 'session_xyz';

    it('should auto-confirm T2 proposals when message has no rejection keywords', async () => {
      const now = new Date();
      const recentProposal = createMockProposal({
        id: 'prop_recent',
        tenantId,
        sessionId,
        trustTier: 'T2',
        status: 'PENDING',
        createdAt: new Date(now.getTime() - 60 * 1000), // 1 minute ago (within 2-min window)
        expiresAt: new Date(now.getTime() + 29 * 60 * 1000),
      });

      mockPrisma.agentProposal.findMany.mockResolvedValue([recentProposal]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'Sounds good!');

      expect(result).toEqual(['prop_recent']);
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['prop_recent'] },
          tenantId,
        },
        data: {
          status: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        },
      });
    });

    it('should reject T2 proposals when message contains "wait" with rejection context', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // "Wait, don't" has clear rejection intent (not "Wait, let me think" which is just pausing)
      const result = await service.softConfirmPendingT2(tenantId, sessionId, "Wait, don't do that");

      expect(result).toEqual([]);
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          sessionId,
          status: 'PENDING',
          trustTier: 'T2',
        },
        data: { status: 'REJECTED' },
      });
    });

    it('should NOT reject when "wait" lacks rejection context', async () => {
      // "Wait, let me think" is just pausing, not rejecting - should confirm
      mockPrisma.agentProposal.findMany.mockResolvedValue([createMockProposal({ trustTier: 'T2' })]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'Wait, let me think');

      // Should return proposals for confirmation, not reject them
      expect(result.length).toBeGreaterThan(0);
    });

    it('should reject T2 proposals when message contains "stop"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Stop! I changed my mind.'
      );

      expect(result).toEqual([]);
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REJECTED' },
        })
      );
    });

    it('should reject T2 proposals when message contains "no"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'No, actually cancel that'
      );

      expect(result).toEqual([]);
    });

    it('should reject T2 proposals when message contains "cancel"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Please cancel the booking'
      );

      expect(result).toEqual([]);
    });

    it('should reject T2 proposals when message contains "hold"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'Hold on a second');

      expect(result).toEqual([]);
    });

    // Updated: "actually" without explicit cancel context should NOT reject
    // This prevents false positives like "Actually, that looks great!"
    it('should NOT reject when "actually" is not a cancellation', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([createMockProposal({ trustTier: 'T2' })]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Actually, that looks great!'
      );

      // Should return proposals for confirmation, not reject them
      expect(result.length).toBeGreaterThan(0);
    });

    it('should reject T2 proposals when message contains "don\'t do"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        "Don't do that"
      );

      expect(result).toEqual([]);
    });

    it('should reject T2 proposals when message contains "dont proceed"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Dont proceed with that'
      );

      expect(result).toEqual([]);
    });

    it('should reject T2 proposals when message is short standalone "no"', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'no'
      );

      expect(result).toEqual([]);
    });

    it('should NOT reject when "no" is in a non-rejection context', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([createMockProposal({ trustTier: 'T2' })]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'No, I dont have any other questions'
      );

      // Should return proposals for confirmation, not reject them
      expect(result.length).toBeGreaterThan(0);
    });

    // TODO-537: Additional edge case tests for contextual rejection patterns
    it('should NOT reject when "stop" is in non-rejection context', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([createMockProposal({ trustTier: 'T2' })]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // "Stop by anytime" uses "stop" but is not a rejection
      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'Stop by anytime');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should NOT reject when "hold" is in non-rejection context', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([createMockProposal({ trustTier: 'T2' })]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // "Hold that thought" is not the same as "hold on"
      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Hold that thought, I have a question'
      );

      expect(result.length).toBeGreaterThan(0);
    });

    it('should reject on repeated "no" as emphatic rejection', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'No no no');

      expect(result).toEqual([]);
    });

    it('should reject on common rejection phrases', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // Test "never mind"
      let result = await service.softConfirmPendingT2(tenantId, sessionId, 'Never mind');
      expect(result).toEqual([]);

      vi.clearAllMocks();
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // Test "scratch that"
      result = await service.softConfirmPendingT2(tenantId, sessionId, 'Scratch that');
      expect(result).toEqual([]);

      vi.clearAllMocks();
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // Test "on second thought"
      result = await service.softConfirmPendingT2(tenantId, sessionId, 'On second thought, no');
      expect(result).toEqual([]);
    });

    it('should only confirm proposals within the 2-minute soft-confirm window', async () => {
      const now = new Date();
      // Proposal created 3 minutes ago (outside 2-minute window)
      const oldProposal = createMockProposal({
        id: 'prop_old',
        tenantId,
        sessionId,
        trustTier: 'T2',
        status: 'PENDING',
        createdAt: new Date(now.getTime() - 3 * 60 * 1000), // 3 minutes ago
        expiresAt: new Date(now.getTime() + 27 * 60 * 1000),
      });

      // findMany returns empty (no proposals within window)
      mockPrisma.agentProposal.findMany.mockResolvedValue([]);

      const result = await service.softConfirmPendingT2(tenantId, sessionId, 'Sounds good!');

      expect(result).toEqual([]);
      // updateMany should NOT have been called for confirming
      expect(mockPrisma.agentProposal.updateMany).not.toHaveBeenCalled();
    });

    it('should handle unicode normalization to prevent bypass attacks', async () => {
      // Using unicode lookalike characters for "no" (e.g., Cyrillic 'n' and 'o')
      // NFKC normalization should convert these to ASCII equivalents
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // Using fullwidth characters (should normalize to ASCII)
      const fullwidthNo = '\uff4e\uff4f'; // fullwidth 'no'
      const result = await service.softConfirmPendingT2(tenantId, sessionId, fullwidthNo);

      // Should still be rejected because NFKC normalization converts to 'no'
      expect(result).toEqual([]);
    });

    it('should confirm multiple T2 proposals in same session', async () => {
      const now = new Date();
      const proposals = [
        createMockProposal({
          id: 'prop_1',
          tenantId,
          sessionId,
          trustTier: 'T2',
          createdAt: new Date(now.getTime() - 30 * 1000),
          expiresAt: new Date(now.getTime() + 29 * 60 * 1000),
        }),
        createMockProposal({
          id: 'prop_2',
          tenantId,
          sessionId,
          trustTier: 'T2',
          createdAt: new Date(now.getTime() - 60 * 1000),
          expiresAt: new Date(now.getTime() + 29 * 60 * 1000),
        }),
      ];

      mockPrisma.agentProposal.findMany.mockResolvedValue(proposals);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        'Yes, proceed with all'
      );

      expect(result).toEqual(['prop_1', 'prop_2']);
    });

    it('should be case-insensitive for rejection keywords', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // Upper case with rejection context
      const result1 = await service.softConfirmPendingT2(tenantId, sessionId, "WAIT, DON'T DO THAT");
      expect(result1).toEqual([]);

      // Mixed case with explicit stop object
      vi.clearAllMocks();
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });
      const result2 = await service.softConfirmPendingT2(tenantId, sessionId, 'StOp that');
      expect(result2).toEqual([]);
    });

    it('should require word boundaries for rejection keywords', async () => {
      // "wait" appears in "await" but should NOT trigger rejection
      const now = new Date();
      const proposal = createMockProposal({
        id: 'prop_1',
        tenantId,
        sessionId,
        trustTier: 'T2',
        createdAt: new Date(now.getTime() - 30 * 1000),
        expiresAt: new Date(now.getTime() + 29 * 60 * 1000),
      });

      mockPrisma.agentProposal.findMany.mockResolvedValue([proposal]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      // "await" contains "wait" but is not the word "wait"
      const result = await service.softConfirmPendingT2(
        tenantId,
        sessionId,
        "I'll await your confirmation"
      );

      expect(result).toEqual(['prop_1']); // Should confirm, not reject
    });
  });

  describe('markExecuted()', () => {
    it('should update proposal status to EXECUTED with result', async () => {
      const proposalId = 'prop_123';
      const result = { bookingId: 'booking_456', success: true };

      mockPrisma.agentProposal.update.mockResolvedValue(
        createMockProposal({
          id: proposalId,
          status: 'EXECUTED',
          executedAt: new Date(),
          result,
        })
      );

      await service.markExecuted(proposalId, result);

      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          executedAt: expect.any(Date),
          result,
        },
      });
    });

    it('should handle complex result objects', async () => {
      const proposalId = 'prop_123';
      const complexResult = {
        booking: {
          id: 'booking_456',
          date: '2025-06-15',
          customer: { name: 'John Doe', email: 'john@example.com' },
        },
        notifications: ['email_sent', 'calendar_updated'],
        metadata: { processingTime: 1234 },
      };

      mockPrisma.agentProposal.update.mockResolvedValue(
        createMockProposal({ id: proposalId, result: complexResult })
      );

      await service.markExecuted(proposalId, complexResult);

      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: complexResult,
          }),
        })
      );
    });
  });

  describe('markFailed()', () => {
    it('should update proposal status to FAILED with error message', async () => {
      const proposalId = 'prop_123';
      const errorMessage = 'Booking conflict: date already taken';

      mockPrisma.agentProposal.update.mockResolvedValue(
        createMockProposal({
          id: proposalId,
          status: 'FAILED',
          error: errorMessage,
        })
      );

      await service.markFailed(proposalId, errorMessage);

      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      });
    });

    it('should handle long error messages', async () => {
      const proposalId = 'prop_123';
      const longError = 'Error: '.padEnd(1000, 'x'); // Very long error

      mockPrisma.agentProposal.update.mockResolvedValue(
        createMockProposal({ id: proposalId, status: 'FAILED', error: longError })
      );

      await service.markFailed(proposalId, longError);

      expect(mockPrisma.agentProposal.update).toHaveBeenCalled();
    });
  });

  describe('cleanupExpired()', () => {
    it('should mark expired PENDING proposals as EXPIRED', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return 0 when no proposals expired', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should not affect non-PENDING proposals', async () => {
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 3 });

      await service.cleanupExpired();

      const whereClause = mockPrisma.agentProposal.updateMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe('PENDING');
      // Only PENDING should be cleaned up (not CONFIRMED, EXECUTED, etc.)
    });
  });

  describe('getPendingProposals()', () => {
    const tenantId = 'tenant_abc';
    const sessionId = 'session_xyz';

    it('should return pending proposals for a session', async () => {
      const now = new Date();
      const proposals = [
        createMockProposal({
          id: 'prop_1',
          tenantId,
          sessionId,
          status: 'PENDING',
          expiresAt: new Date(now.getTime() + 29 * 60 * 1000),
        }),
        createMockProposal({
          id: 'prop_2',
          tenantId,
          sessionId,
          status: 'PENDING',
          expiresAt: new Date(now.getTime() + 25 * 60 * 1000),
        }),
      ];

      mockPrisma.agentProposal.findMany.mockResolvedValue(proposals);

      const result = await service.getPendingProposals(tenantId, sessionId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.agentProposal.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          sessionId,
          status: 'PENDING',
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter out expired proposals', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([]);

      await service.getPendingProposals(tenantId, sessionId);

      const whereClause = mockPrisma.agentProposal.findMany.mock.calls[0][0].where;
      expect(whereClause.expiresAt.gt).toBeInstanceOf(Date);
    });

    it('should order by createdAt descending', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([]);

      await service.getPendingProposals(tenantId, sessionId);

      const orderBy = mockPrisma.agentProposal.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.createdAt).toBe('desc');
    });
  });

  describe('Tenant Isolation Security', () => {
    it('getProposal should always filter by tenantId', async () => {
      await service.getProposal('tenant_a', 'prop_123');

      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant_a',
        }),
      });
    });

    it('confirmProposal should use tenant-scoped getProposal', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await service.confirmProposal('tenant_a', 'prop_123');

      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant_a',
        }),
      });
    });

    it('rejectProposal should use tenant-scoped getProposal', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await service.rejectProposal('tenant_a', 'prop_123');

      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant_a',
        }),
      });
    });

    it('getPendingProposals should filter by tenantId', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([]);

      await service.getPendingProposals('tenant_a', 'session_123');

      expect(mockPrisma.agentProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_a',
          }),
        })
      );
    });

    it('softConfirmPendingT2 should filter by tenantId', async () => {
      mockPrisma.agentProposal.findMany.mockResolvedValue([]);

      await service.softConfirmPendingT2('tenant_a', 'session_123', 'ok');

      expect(mockPrisma.agentProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_a',
          }),
        })
      );
    });

    it('softConfirmPendingT2 should include tenantId in updateMany for defense-in-depth', async () => {
      const proposal = createMockProposal({
        id: 'prop_1',
        tenantId: 'tenant_a',
        sessionId: 'session_123',
        trustTier: 'T2',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 29 * 60 * 1000),
      });

      mockPrisma.agentProposal.findMany.mockResolvedValue([proposal]);
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });

      await service.softConfirmPendingT2('tenant_a', 'session_123', 'proceed');

      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_a',
          }),
        })
      );
    });
  });
});
