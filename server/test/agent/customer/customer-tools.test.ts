/**
 * Unit tests for Customer Chatbot Tools
 *
 * Tests all 6 customer-facing tools:
 * - get_services: Browse available packages
 * - browse_service_categories: List service categories
 * - check_availability: Check available dates
 * - book_service: Create booking proposal (T3)
 * - confirm_proposal: Confirm pending proposals
 * - get_business_info: Hours, policies, FAQ
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CUSTOMER_TOOLS } from '../../../src/agent/customer/customer-tools';
import type { CustomerToolContext } from '../../../src/agent/customer/customer-tools';
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

// Get all tools
const getServicesTool = CUSTOMER_TOOLS.find((t) => t.name === 'get_services');
const browseCategoriesTool = CUSTOMER_TOOLS.find((t) => t.name === 'browse_service_categories');
const checkAvailabilityTool = CUSTOMER_TOOLS.find((t) => t.name === 'check_availability');
const bookServiceTool = CUSTOMER_TOOLS.find((t) => t.name === 'book_service');
const confirmProposalTool = CUSTOMER_TOOLS.find((t) => t.name === 'confirm_proposal');
const getBusinessInfoTool = CUSTOMER_TOOLS.find((t) => t.name === 'get_business_info');

describe('Customer Tools', () => {
  // ============================================================================
  // GET SERVICES TOOL
  // ============================================================================
  describe('get_services tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      package: {
        findMany: ReturnType<typeof vi.fn>;
      };
      segment: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        package: {
          findMany: vi.fn(),
        },
        segment: {
          findFirst: vi.fn(),
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
      expect(getServicesTool).toBeDefined();
      expect(getServicesTool!.name).toBe('get_services');
      expect(getServicesTool!.trustTier).toBe('T1');
      expect(getServicesTool!.description).toContain('packages');
    });

    it('should filter by tenantId', async () => {
      mockPrisma.package.findMany.mockResolvedValue([]);

      await getServicesTool!.execute(mockContext, {});

      expect(mockPrisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
            active: true,
          }),
        })
      );
    });

    it('should return formatted packages on success', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          slug: 'wedding',
          name: 'Wedding Package',
          description: 'Full wedding coverage',
          basePrice: 150000, // $1500.00
          bookingType: 'EVENT',
          segment: { name: 'Photography', slug: 'photography' },
        },
        {
          id: 'pkg-2',
          slug: 'portrait',
          name: 'Portrait Session',
          description: 'Studio portraits',
          basePrice: 20000, // $200.00
          bookingType: 'SESSION',
          segment: null,
        },
      ]);

      const result = await getServicesTool!.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'pkg-1',
        slug: 'wedding',
        name: 'Wedding Package',
        description: 'Full wedding coverage',
        price: '$1500.00',
        priceInCents: 150000,
        bookingType: 'EVENT',
        category: 'Photography',
      });
      expect(result.data[1].category).toBeNull();
    });

    it('should filter by category when provided', async () => {
      mockPrisma.segment.findFirst.mockResolvedValue({
        id: 'seg-1',
        slug: 'photography',
      });
      mockPrisma.package.findMany.mockResolvedValue([]);

      await getServicesTool!.execute(mockContext, { category: 'photography' });

      expect(mockPrisma.segment.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', slug: 'photography', active: true },
      });
      expect(mockPrisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            segmentId: 'seg-1',
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.package.findMany.mockRejectedValue(new Error('Database error'));

      const result = await getServicesTool!.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // BROWSE SERVICE CATEGORIES TOOL
  // ============================================================================
  describe('browse_service_categories tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      segment: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        segment: {
          findMany: vi.fn(),
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
      expect(browseCategoriesTool).toBeDefined();
      expect(browseCategoriesTool!.name).toBe('browse_service_categories');
      expect(browseCategoriesTool!.trustTier).toBe('T1');
    });

    it('should filter by tenantId', async () => {
      mockPrisma.segment.findMany.mockResolvedValue([]);

      await browseCategoriesTool!.execute(mockContext, {});

      expect(mockPrisma.segment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
            active: true,
          }),
        })
      );
    });

    it('should return formatted segments with package counts', async () => {
      mockPrisma.segment.findMany.mockResolvedValue([
        {
          id: 'seg-1',
          slug: 'photography',
          name: 'Photography',
          heroTitle: 'Capture Your Moments',
          heroSubtitle: 'Professional photography services',
          heroImage: 'https://example.com/photo.jpg',
          description: 'Full photography services',
          _count: { packages: 5 },
        },
        {
          id: 'seg-2',
          slug: 'video',
          name: 'Videography',
          heroTitle: null,
          heroSubtitle: null,
          heroImage: null,
          description: null,
          _count: { packages: 2 },
        },
      ]);

      const result = await browseCategoriesTool!.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'seg-1',
        slug: 'photography',
        name: 'Photography',
        title: 'Capture Your Moments',
        subtitle: 'Professional photography services',
        image: 'https://example.com/photo.jpg',
        description: 'Full photography services',
        packageCount: 5,
      });
      expect(result.data[1].packageCount).toBe(2);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.segment.findMany.mockRejectedValue(new Error('Database error'));

      const result = await browseCategoriesTool!.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // CHECK AVAILABILITY TOOL
  // ============================================================================
  describe('check_availability tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      package: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      booking: {
        findMany: ReturnType<typeof vi.fn>;
      };
      blackoutDate: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        package: {
          findFirst: vi.fn(),
        },
        booking: {
          findMany: vi.fn(),
        },
        blackoutDate: {
          findMany: vi.fn(),
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
      expect(checkAvailabilityTool).toBeDefined();
      expect(checkAvailabilityTool!.name).toBe('check_availability');
      expect(checkAvailabilityTool!.trustTier).toBe('T1');
      expect(checkAvailabilityTool!.inputSchema.required).toContain('packageId');
    });

    it('should filter package lookup by tenantId', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      await checkAvailabilityTool!.execute(mockContext, { packageId: 'pkg-123' });

      expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
        where: { id: 'pkg-123', tenantId: 'tenant-123', active: true },
      });
    });

    it('should return error when package not found', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      const result = await checkAvailabilityTool!.execute(mockContext, {
        packageId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return available dates excluding booked and blackout dates', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Wedding Package',
      });

      // Tomorrow is booked
      mockPrisma.booking.findMany.mockResolvedValue([{ date: tomorrow }]);
      // Day after is blacked out
      mockPrisma.blackoutDate.findMany.mockResolvedValue([{ date: dayAfter }]);

      const startDate = today.toISOString().split('T')[0];
      const endDate = dayAfter.toISOString().split('T')[0];

      const result = await checkAvailabilityTool!.execute(mockContext, {
        packageId: 'pkg-123',
        startDate,
        endDate,
      });

      expect(result.success).toBe(true);
      expect(result.data.packageId).toBe('pkg-123');
      expect(result.data.packageName).toBe('Wedding Package');
      // Only today should be available (tomorrow booked, day after blacked out)
      expect(result.data.availableDates).toContain(startDate);
      expect(result.data.availableDates).not.toContain(tomorrow.toISOString().split('T')[0]);
    });

    it('should filter bookings by tenantId', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Test Package',
      });
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.blackoutDate.findMany.mockResolvedValue([]);

      await checkAvailabilityTool!.execute(mockContext, { packageId: 'pkg-123' });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.package.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await checkAvailabilityTool!.execute(mockContext, {
        packageId: 'pkg-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // BOOK SERVICE TOOL
  // ============================================================================
  describe('book_service tool', () => {
    let mockContext: CustomerToolContext;
    let mockPrisma: {
      package: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      booking: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      blackoutDate: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      customer: {
        findFirst: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };
    let mockProposalService: {
      createProposal: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockPrisma = {
        package: {
          findFirst: vi.fn(),
        },
        booking: {
          findFirst: vi.fn(),
        },
        blackoutDate: {
          findFirst: vi.fn(),
        },
        customer: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      };

      mockProposalService = {
        createProposal: vi.fn(),
      };

      mockContext = {
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        prisma: mockPrisma as unknown as ToolContext['prisma'],
        customerId: null,
        proposalService: mockProposalService as unknown as CustomerToolContext['proposalService'],
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should have correct tool metadata', () => {
      expect(bookServiceTool).toBeDefined();
      expect(bookServiceTool!.name).toBe('book_service');
      expect(bookServiceTool!.trustTier).toBe('T3');
      expect(bookServiceTool!.inputSchema.required).toContain('packageId');
      expect(bookServiceTool!.inputSchema.required).toContain('date');
      expect(bookServiceTool!.inputSchema.required).toContain('customerName');
      expect(bookServiceTool!.inputSchema.required).toContain('customerEmail');
    });

    it('should filter package lookup by tenantId', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: '2025-03-15',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
        where: { id: 'pkg-123', tenantId: 'tenant-123', active: true },
      });
    });

    it('should return error for invalid email', async () => {
      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: '2025-03-15',
        customerName: 'John Doe',
        customerEmail: 'invalid-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('should return error when package not found', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'nonexistent',
        date: '2025-03-15',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when date is already booked', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Wedding Package',
        basePrice: 150000,
      });
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'existing-booking',
        status: 'CONFIRMED',
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: dateStr,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no longer available');
    });

    it('should return error when date is blacked out', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Wedding Package',
        basePrice: 150000,
      });
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue({
        id: 'blackout-1',
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: dateStr,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should create T3 proposal for valid booking', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Wedding Package',
        basePrice: 150000,
      });
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        email: 'john@example.com',
        name: 'John Doe',
      });

      mockProposalService.createProposal.mockResolvedValue({
        proposalId: 'prop-123',
        operation: 'create_customer_booking',
        trustTier: 'T3',
        preview: {
          service: 'Wedding Package',
          date: 'Saturday, March 15, 2025',
          price: '$1500.00',
        },
        expiresAt: new Date(Date.now() + 300000),
      });

      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: dateStr,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        notes: 'Outdoor ceremony preferred',
      });

      expect(result.success).toBe(true);
      expect(result.proposalId).toBe('prop-123');
      expect(result.requiresApproval).toBe(true);
      expect(result.trustTier).toBe('T3');

      // Verify proposal was created with correct params
      expect(mockProposalService.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          sessionId: 'session-456',
          toolName: 'book_service',
          operation: 'create_customer_booking',
          trustTier: 'T3',
          payload: expect.objectContaining({
            packageId: 'pkg-123',
            customerId: 'cust-1',
            date: dateStr,
            notes: 'Outdoor ceremony preferred',
          }),
        })
      );
    });

    it('should create new customer if not found', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-123',
        name: 'Wedding Package',
        basePrice: 150000,
      });
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-cust-1',
        email: 'new@example.com',
        name: 'New Customer',
      });

      mockProposalService.createProposal.mockResolvedValue({
        proposalId: 'prop-123',
        operation: 'create_customer_booking',
        trustTier: 'T3',
        expiresAt: new Date(Date.now() + 300000),
      });

      await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: dateStr,
        customerName: 'New Customer',
        customerEmail: 'new@example.com',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          email: 'new@example.com',
          name: 'New Customer',
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.package.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await bookServiceTool!.execute(mockContext, {
        packageId: 'pkg-123',
        date: '2025-03-15',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // GET BUSINESS INFO TOOL
  // ============================================================================
  describe('get_business_info tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      tenant: {
        findUnique: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        tenant: {
          findUnique: vi.fn(),
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
      expect(getBusinessInfoTool).toBeDefined();
      expect(getBusinessInfoTool!.name).toBe('get_business_info');
      expect(getBusinessInfoTool!.trustTier).toBe('T1');
    });

    it('should filter by tenantId', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await getBusinessInfoTool!.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        select: expect.any(Object),
      });
    });

    it('should return error when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await getBusinessInfoTool!.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return business info with deposit policy', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        name: 'Test Photography',
        email: 'contact@test.com',
        landingPageConfig: {
          pages: [
            {
              type: 'faq',
              sections: [{ title: 'What should I wear?', content: 'Comfortable clothing.' }],
            },
          ],
        },
        depositPercent: 25,
        balanceDueDays: 7,
      });

      const result = await getBusinessInfoTool!.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.businessName).toBe('Test Photography');
      expect(result.data.contact).toBe('contact@test.com');
      expect(result.data.depositRequired).toContain('25%');
      expect(result.data.balanceDue).toContain('7 days');
      expect(result.data.faq).toHaveLength(1);
      expect(result.data.faq[0].question).toBe('What should I wear?');
    });

    it('should return full payment policy when no deposit', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        name: 'Test Photography',
        email: 'contact@test.com',
        landingPageConfig: null,
        depositPercent: null,
        balanceDueDays: null,
      });

      const result = await getBusinessInfoTool!.execute(mockContext, { topic: 'payment' });

      expect(result.success).toBe(true);
      expect(result.data.paymentPolicy).toContain('Full payment');
    });

    it('should filter by topic', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        name: 'Test Photography',
        email: 'contact@test.com',
        landingPageConfig: {
          pages: [
            {
              type: 'faq',
              sections: [{ title: 'Question', content: 'Answer' }],
            },
          ],
        },
        depositPercent: 25,
        balanceDueDays: 7,
      });

      const result = await getBusinessInfoTool!.execute(mockContext, { topic: 'faq' });

      expect(result.success).toBe(true);
      expect(result.data.faq).toBeDefined();
      // Payment info should not be included when topic is faq
      expect(result.data.depositRequired).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await getBusinessInfoTool!.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // CONFIRM PROPOSAL TOOL
  // ============================================================================
  describe('confirm_proposal tool', () => {
    let mockContext: ToolContext;
    let mockPrisma: {
      agentProposal: {
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        agentProposal: {
          findFirst: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
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
      // Atomic update returns 0 (proposal doesn't exist or wrong status/tenant/expiry)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });
      // Then findFirst is called to provide helpful error
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'nonexistent-proposal',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      // Verify atomic update was attempted first
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 'nonexistent-proposal',
          tenantId: 'tenant-123',
          sessionId: 'session-456',
          status: 'PENDING',
        }),
        data: expect.objectContaining({
          status: 'CONFIRMED',
        }),
      });
    });

    it('should return error when proposal is already executed', async () => {
      // Atomic update returns 0 (status not PENDING)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });
      // Then findFirst fetches to check why
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
      // Atomic update returns 0 (expiresAt check failed)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });
      // Then findFirst fetches to check why
      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });
      mockPrisma.agentProposal.update.mockResolvedValue({});

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

      // Atomic update succeeds (proposal was PENDING and not expired)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });
      // But then we fetch the proposal to execute it
      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'CONFIRMED', // Now confirmed
        operation: 'create_customer_booking',
        customerId: null, // Missing!
        expiresAt: new Date(Date.now() + 300000),
        payload: {},
      });

      const result = await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('complete');
    });

    it('should successfully confirm and execute a valid proposal', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        action: 'booked',
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
      vi.mocked(getCustomerProposalExecutor).mockImplementation((operation) => {
        if (operation === 'create_customer_booking') {
          return mockExecutor;
        }
        return undefined;
      });

      // Atomic update succeeds (proposal was PENDING and not expired)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 1 });
      // Then we fetch the proposal to execute it
      mockPrisma.agentProposal.findFirst.mockResolvedValue({
        id: 'prop-123',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        status: 'CONFIRMED', // Now confirmed
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
      // Atomic update returns 0 (wrong tenant)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-from-other-tenant',
      });

      // Verify the atomic update query includes tenantId
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-123',
        }),
        data: expect.any(Object),
      });
    });

    it('should enforce session isolation', async () => {
      // Atomic update returns 0 (wrong session)
      mockPrisma.agentProposal.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.agentProposal.findFirst.mockResolvedValue(null);

      await confirmProposalTool!.execute(mockContext, {
        proposalId: 'prop-from-other-session',
      });

      // Verify the atomic update query includes sessionId
      expect(mockPrisma.agentProposal.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          sessionId: 'session-456',
        }),
        data: expect.any(Object),
      });
    });
  });

  describe('CUSTOMER_TOOLS list', () => {
    it('should include confirm_proposal tool', () => {
      const toolNames = CUSTOMER_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('confirm_proposal');
    });

    it('should have 6 tools total', () => {
      // browse_service_categories, get_services, check_availability, book_service, confirm_proposal, get_business_info
      expect(CUSTOMER_TOOLS).toHaveLength(6);
    });
  });
});
