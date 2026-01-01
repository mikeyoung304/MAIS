/**
 * Unit tests for Customer Chatbot Tools
 *
 * Tests focus on the confirm_proposal tool which enables
 * T3 proposal confirmation through conversation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CUSTOMER_TOOLS } from '../../../src/agent/customer/customer-tools';
import type { ToolContext } from '../../../src/agent/tools/types';

// Mock the executor registry
vi.mock('../../../src/agent/customer/executor-registry', () => ({
  getCustomerProposalExecutor: vi.fn(),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Get the confirm_proposal tool
const confirmProposalTool = CUSTOMER_TOOLS.find((t) => t.name === 'confirm_proposal');

describe('Customer Tools', () => {
  describe('confirm_proposal tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      agentProposal: {
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        agentProposal: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };

      mockContext = {
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        prisma: mockPrisma as unknown as ToolContext['prisma'],
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should have correct tool metadata', () => {
      expect(confirmProposalTool).toBeDefined();
      expect(confirmProposalTool!.name).toBe('confirm_proposal');
      expect(confirmProposalTool!.trustTier).toBe('T1');
      expect(confirmProposalTool!.description).toContain('pending booking proposal');
      expect(confirmProposalTool!.inputSchema.required).toContain('proposalId');
    });

    it('should return error when proposal not found', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'nonexistent-proposal',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'nonexistent-proposal',
          tenantId: 'tenant-123',
          sessionId: 'session-456',
        },
      });
    });

    it('should return error when proposal is already executed', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'EXECUTED',
        expiresAt: new Date(Date.now() + 300000),
      });

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already been completed');
    });

    it('should return error when proposal is expired', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith({
        where: { id: 'prop-123' },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return error when customerId is missing', async () => {
      const { getCustomerProposalExecutor } = await import(
        '../../../src/agent/customer/executor-registry'
      );
      vi.mocked(getCustomerProposalExecutor).mockReturnValue(vi.fn());

      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'PENDING',
        operation: 'create_customer_booking',
        customerId: null, // Missing!
        expiresAt: new Date(Date.now() + 300000),
        payload: {},
      });

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to complete booking');
    });

    it('should successfully confirm and execute a valid proposal', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        bookingId: 'booking-789',
        confirmationCode: 'BK-ABC123',
        packageName: 'Test Package',
        formattedDate: 'Monday, January 15, 2025',
        formattedPrice: '$150.00',
        checkoutUrl: 'https://checkout.stripe.com/session123',
        message: 'Your booking has been confirmed!',
      });

      const { getCustomerProposalExecutor } = await import(
        '../../../src/agent/customer/executor-registry'
      );
      vi.mocked(getCustomerProposalExecutor).mockReturnValue(mockExecutor);

      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'PENDING',
        operation: 'create_customer_booking',
        customerId: 'customer-001',
        expiresAt: new Date(Date.now() + 300000),
        payload: { packageId: 'pkg-123', date: '2025-01-15' },
      });

      mockPrisma.agentProposal.update.mockResolvedValue({});

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.action).toBe('booking_confirmed');
      expect(result.data.bookingId).toBe('booking-789');
      expect(result.data.confirmationCode).toBe('BK-ABC123');
      expect(result.data.checkoutUrl).toBe('https://checkout.stripe.com/session123');

      // Verify executor was called with correct params
      expect(mockExecutor).toHaveBeenCalledWith('tenant-123', 'customer-001', {
        packageId: 'pkg-123',
        date: '2025-01-15',
      });

      // Verify proposal was updated to EXECUTED
      expect(mockPrisma.agentProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prop-123' },
          data: expect.objectContaining({
            status: 'EXECUTED',
          }),
        })
      );
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-from-other-tenant',
      });

      // Verify the query includes tenantId
      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-123',
        }),
      });
    });

    it('should enforce session isolation', async () => {
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-from-other-session',
      });

      // Verify the query includes sessionId
      expect(mockPrisma.agentProposal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          sessionId: 'session-456',
        }),
      });
    });
  });

  describe('CUSTOMER_TOOLS list', () => {
    it('should include confirm_proposal tool', () => {
      const toolNames = CUSTOMER_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('confirm_proposal');
    });

    it('should have 5 tools total', () => {
      // get_services, check_availability, book_service, confirm_proposal, get_business_info
      expect(CUSTOMER_TOOLS).toHaveLength(5);
    });
  });
});
