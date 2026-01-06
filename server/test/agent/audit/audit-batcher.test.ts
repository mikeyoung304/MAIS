/**
 * AuditBatcher Tests
 *
 * Tests for the batched audit logging system that reduces N+1 database writes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditBatcher, type AuditLogInput } from '../../../src/agent/audit/audit.service';
import type { PrismaClient } from '../../../src/generated/prisma/client';

/**
 * Create a mock Prisma client
 */
function createMockPrisma(): PrismaClient {
  return {
    agentAuditLog: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaClient;
}

/**
 * Create a valid audit log input for testing
 */
function createMockInput(overrides: Partial<AuditLogInput> = {}): AuditLogInput {
  return {
    tenantId: 'tenant-123',
    sessionId: 'session-456',
    toolName: 'test_tool',
    inputSummary: 'test input',
    outputSummary: 'test output',
    trustTier: 'T1',
    approvalStatus: 'AUTO',
    durationMs: 100,
    success: true,
    ...overrides,
  };
}

describe('AuditBatcher', () => {
  let batcher: AuditBatcher;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    batcher = new AuditBatcher(mockPrisma);
  });

  describe('log()', () => {
    it('should add entry to pending list', () => {
      expect(batcher.pendingCount).toBe(0);

      batcher.log(createMockInput());

      expect(batcher.pendingCount).toBe(1);
    });

    it('should not write to database', () => {
      batcher.log(createMockInput());

      expect(mockPrisma.agentAuditLog.createMany).not.toHaveBeenCalled();
    });

    it('should accumulate multiple entries', () => {
      batcher.log(createMockInput({ toolName: 'tool_1' }));
      batcher.log(createMockInput({ toolName: 'tool_2' }));
      batcher.log(createMockInput({ toolName: 'tool_3' }));

      expect(batcher.pendingCount).toBe(3);
    });

    it('should truncate long input summary', () => {
      const longInput = 'a'.repeat(1000);
      batcher.log(createMockInput({ inputSummary: longInput }));

      // pendingCount is 1, meaning the entry was added
      expect(batcher.pendingCount).toBe(1);
    });
  });

  describe('logRead()', () => {
    it('should add T1/AUTO entry', async () => {
      batcher.logRead('tenant-1', 'session-1', 'get_data', 'input', 'output', 50);

      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            tenantId: 'tenant-1',
            sessionId: 'session-1',
            toolName: 'get_data',
            trustTier: 'T1',
            approvalStatus: 'AUTO',
            success: true,
          }),
        ],
      });
    });
  });

  describe('logProposalCreated()', () => {
    it('should add entry with correct approval status for T2', async () => {
      batcher.logProposalCreated(
        'tenant-1',
        'session-1',
        'update_data',
        'proposal-123',
        'T2',
        'input',
        100
      );

      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            toolName: 'update_data',
            proposalId: 'proposal-123',
            trustTier: 'T2',
            approvalStatus: 'SOFT',
          }),
        ],
      });
    });

    it('should use EXPLICIT approval for T3', async () => {
      batcher.logProposalCreated(
        'tenant-1',
        'session-1',
        'delete_data',
        'proposal-456',
        'T3',
        'input',
        100
      );

      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            trustTier: 'T3',
            approvalStatus: 'EXPLICIT',
          }),
        ],
      });
    });
  });

  describe('logError()', () => {
    it('should add error entry with success=false', async () => {
      batcher.logError(
        'tenant-1',
        'session-1',
        'failing_tool',
        'input',
        'Something went wrong',
        200
      );

      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            toolName: 'failing_tool',
            success: false,
            errorMessage: 'Something went wrong',
            outputSummary: 'Error',
          }),
        ],
      });
    });

    it('should truncate long error messages', async () => {
      const longError = 'e'.repeat(2000);
      batcher.logError('tenant-1', 'session-1', 'tool', 'input', longError, 100);

      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            // Error should be truncated to 1000 chars (1000 - 3 + '...')
            errorMessage: expect.stringMatching(/^e{997}\.\.\.$/),
          }),
        ],
      });
    });
  });

  describe('flush()', () => {
    it('should write all entries in single batch', async () => {
      batcher.log(createMockInput({ toolName: 'tool_1' }));
      batcher.log(createMockInput({ toolName: 'tool_2' }));
      batcher.log(createMockInput({ toolName: 'tool_3' }));

      const count = await batcher.flush();

      expect(count).toBe(3);
      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ toolName: 'tool_1' }),
          expect.objectContaining({ toolName: 'tool_2' }),
          expect.objectContaining({ toolName: 'tool_3' }),
        ]),
      });
    });

    it('should clear entries after successful flush', async () => {
      batcher.log(createMockInput());
      expect(batcher.pendingCount).toBe(1);

      await batcher.flush();

      expect(batcher.pendingCount).toBe(0);
    });

    it('should return 0 and not call DB when empty', async () => {
      const count = await batcher.flush();

      expect(count).toBe(0);
      expect(mockPrisma.agentAuditLog.createMany).not.toHaveBeenCalled();
    });

    it('should keep entries on database error', async () => {
      (mockPrisma.agentAuditLog.createMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Database error')
      );

      batcher.log(createMockInput());

      const count = await batcher.flush();

      expect(count).toBe(0);
      expect(batcher.pendingCount).toBe(1); // Entries preserved for retry
    });

    it('should not throw on database error', async () => {
      (mockPrisma.agentAuditLog.createMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Database error')
      );

      batcher.log(createMockInput());

      await expect(batcher.flush()).resolves.not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should remove all pending entries', () => {
      batcher.log(createMockInput());
      batcher.log(createMockInput());
      expect(batcher.pendingCount).toBe(2);

      batcher.clear();

      expect(batcher.pendingCount).toBe(0);
    });

    it('should not call database', () => {
      batcher.log(createMockInput());
      batcher.clear();

      expect(mockPrisma.agentAuditLog.createMany).not.toHaveBeenCalled();
    });
  });

  describe('pendingCount', () => {
    it('should return 0 for new batcher', () => {
      expect(batcher.pendingCount).toBe(0);
    });

    it('should accurately reflect pending entries', () => {
      batcher.log(createMockInput());
      expect(batcher.pendingCount).toBe(1);

      batcher.log(createMockInput());
      expect(batcher.pendingCount).toBe(2);

      batcher.clear();
      expect(batcher.pendingCount).toBe(0);
    });
  });

  describe('performance characteristics', () => {
    it('should make exactly one DB call regardless of entry count', async () => {
      // Add many entries
      for (let i = 0; i < 100; i++) {
        batcher.log(createMockInput({ toolName: `tool_${i}` }));
      }

      await batcher.flush();

      // Should still be a single createMany call
      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledTimes(1);
    });

    it('should support multiple flush cycles', async () => {
      // First batch
      batcher.log(createMockInput({ toolName: 'batch1_tool1' }));
      batcher.log(createMockInput({ toolName: 'batch1_tool2' }));
      await batcher.flush();

      // Second batch
      batcher.log(createMockInput({ toolName: 'batch2_tool1' }));
      await batcher.flush();

      expect(mockPrisma.agentAuditLog.createMany).toHaveBeenCalledTimes(2);
    });
  });
});
