/**
 * Unit tests for Agent Read Tools
 *
 * Tests focus on:
 * - Tenant isolation (all queries use tenantId)
 * - Happy path (tool returns expected data shape)
 * - Primary error case (not found, database failure)
 *
 * All 16 read tools tested:
 * - get_tenant, get_dashboard, get_packages, get_bookings
 * - get_booking, check_availability, get_landing_page, get_stripe_status
 * - get_addons, get_customers, get_segments, get_trial_status
 * - get_booking_link, refresh_context, get_blackout_dates, get_availability_rules
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolContext } from '../../../src/agent/tools/types';

// Mock logger before importing tools
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import tools after mocks
import {
  getTenantTool,
  getDashboardTool,
  getPackagesTool,
  getBookingsTool,
  getBookingTool,
  checkAvailabilityTool,
  getLandingPageTool,
  getStripeStatusTool,
  getAddonsTool,
  getCustomersTool,
  getSegmentsTool,
  getTrialStatusTool,
  getBookingLinkTool,
  refreshContextTool,
  getBlackoutDatesTool,
  getAvailabilityRulesTool,
  readTools,
} from '../../../src/agent/tools/read-tools';

describe('Read Tools', () => {
  let mockContext: ToolContext;
  let mockPrisma: any;

  const TEST_TENANT_ID = 'tenant-test-123';
  const TEST_SESSION_ID = 'session-456';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Prisma with common methods
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      },
      package: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      addOn: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      booking: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      segment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      blackoutDate: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      availabilityRule: {
        findMany: vi.fn(),
      },
    };

    mockContext = {
      tenantId: TEST_TENANT_ID,
      sessionId: TEST_SESSION_ID,
      prisma: mockPrisma,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Tool Structure Validation
  // ============================================================================

  describe('Tool Structure Validation', () => {
    it('should export exactly 16 read tools', () => {
      expect(readTools).toHaveLength(16);
    });

    it.each([
      { tool: getTenantTool, name: 'get_tenant' },
      { tool: getDashboardTool, name: 'get_dashboard' },
      { tool: getPackagesTool, name: 'get_packages' },
      { tool: getBookingsTool, name: 'get_bookings' },
      { tool: getBookingTool, name: 'get_booking' },
      { tool: checkAvailabilityTool, name: 'check_availability' },
      { tool: getLandingPageTool, name: 'get_landing_page' },
      { tool: getStripeStatusTool, name: 'get_stripe_status' },
      { tool: getAddonsTool, name: 'get_addons' },
      { tool: getCustomersTool, name: 'get_customers' },
      { tool: getSegmentsTool, name: 'get_segments' },
      { tool: getTrialStatusTool, name: 'get_trial_status' },
      { tool: getBookingLinkTool, name: 'get_booking_link' },
      { tool: refreshContextTool, name: 'refresh_context' },
      { tool: getBlackoutDatesTool, name: 'get_blackout_dates' },
      { tool: getAvailabilityRulesTool, name: 'get_availability_rules' },
    ])('$name should have T1 trust tier and correct structure', ({ tool, name }) => {
      expect(tool.name).toBe(name);
      expect(tool.trustTier).toBe('T1');
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(typeof tool.execute).toBe('function');
    });
  });

  // ============================================================================
  // get_tenant Tests
  // ============================================================================

  describe('get_tenant', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TEST_TENANT_ID,
        slug: 'test-studio',
        name: 'Test Studio',
        email: 'test@example.com',
        emailVerified: true,
        branding: {},
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        accentColor: '#ff0000',
        backgroundColor: '#f0f0f0',
        stripeOnboarded: true,
        depositPercent: 50,
        balanceDueDays: 7,
        isActive: true,
        createdAt: new Date(),
      });

      await getTenantTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TENANT_ID },
        select: expect.any(Object),
      });
    });

    it('should return tenant profile on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TEST_TENANT_ID,
        slug: 'test-studio',
        name: 'Test Studio',
        email: 'test@example.com',
        emailVerified: true,
        branding: { logo: 'logo.png' },
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        accentColor: '#ff0000',
        backgroundColor: '#f0f0f0',
        stripeOnboarded: true,
        depositPercent: 50,
        balanceDueDays: 7,
        isActive: true,
        createdAt: new Date('2025-01-01'),
      });

      const result = await getTenantTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Studio');
      expect(result.data.slug).toBe('test-studio');
      expect(result.data.stripeConnected).toBe(true);
    });

    it('should return error when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await getTenantTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to access');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Connection failed'));

      const result = await getTenantTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch');
      expect(result.code).toBe('GET_TENANT_ERROR');
    });
  });

  // ============================================================================
  // get_dashboard Tests
  // ============================================================================

  describe('get_dashboard', () => {
    it('should filter all queries by tenantId', async () => {
      mockPrisma.package.count.mockResolvedValue(5);
      mockPrisma.addOn.count.mockResolvedValue(3);
      mockPrisma.booking.groupBy.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 0 } });

      await getDashboardTool.execute(mockContext, {});

      expect(mockPrisma.package.count).toHaveBeenCalledWith({
        where: { tenantId: TEST_TENANT_ID },
      });
      expect(mockPrisma.addOn.count).toHaveBeenCalledWith({
        where: { tenantId: TEST_TENANT_ID },
      });
    });

    it('should return dashboard stats on success', async () => {
      mockPrisma.package.count.mockResolvedValue(5);
      mockPrisma.addOn.count.mockResolvedValue(3);
      mockPrisma.booking.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: { _all: 10 }, _sum: { totalPrice: 50000 } },
        { status: 'PAID', _count: { _all: 5 }, _sum: { totalPrice: 25000 } },
      ]);
      mockPrisma.booking.count.mockResolvedValue(3);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 10000 } });

      const result = await getDashboardTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.packages).toBe(5);
      expect(result.data.addOns).toBe(3);
      expect(result.data.bookings.total).toBe(15);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.package.count.mockRejectedValue(new Error('Database error'));

      const result = await getDashboardTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.code).toBe('GET_DASHBOARD_ERROR');
    });
  });

  // ============================================================================
  // get_packages Tests
  // ============================================================================

  describe('get_packages', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.package.findMany.mockResolvedValue([]);

      await getPackagesTool.execute(mockContext, {});

      expect(mockPrisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return packages list on success', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          slug: 'wedding-basic',
          name: 'Wedding Basic',
          description: 'Basic package',
          basePrice: 150000,
          photos: ['photo1.jpg'],
          bookingType: 'DATE',
          active: true,
          segmentId: 'seg-1',
          grouping: null,
          addOns: [],
          createdAt: new Date(),
        },
      ]);

      const result = await getPackagesTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Wedding Basic');
      expect(result.data[0].priceFormatted).toBe('$1500.00');
    });

    it('should filter by packageId when provided', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg-1',
        slug: 'wedding-basic',
        name: 'Wedding Basic',
        description: 'Basic package',
        basePrice: 150000,
        photos: [],
        bookingType: 'DATE',
        active: true,
        segmentId: null,
        grouping: null,
        addOns: [],
        createdAt: new Date(),
      });

      await getPackagesTool.execute(mockContext, { packageId: 'pkg-1' });

      expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
        where: { id: 'pkg-1', tenantId: TEST_TENANT_ID },
        include: expect.any(Object),
      });
    });

    it('should return error when single package not found', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      const result = await getPackagesTool.execute(mockContext, { packageId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to access package');
    });
  });

  // ============================================================================
  // get_bookings Tests
  // ============================================================================

  describe('get_bookings', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await getBookingsTool.execute(mockContext, {});

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return bookings list with status filter', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'book-1',
          package: { name: 'Wedding Basic' },
          customer: { name: 'John Doe', email: 'john@example.com' },
          date: new Date('2025-03-15'),
          totalPrice: 150000,
          status: 'CONFIRMED',
          notes: null,
          createdAt: new Date(),
        },
      ]);

      const result = await getBookingsTool.execute(mockContext, { status: 'CONFIRMED' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('CONFIRMED');
    });

    it('should return error for invalid status', async () => {
      const result = await getBookingsTool.execute(mockContext, { status: 'INVALID_STATUS' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should handle date range filters', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await getBookingsTool.execute(mockContext, {
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
      });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  // ============================================================================
  // get_booking Tests
  // ============================================================================

  describe('get_booking', () => {
    it('should filter by tenantId and bookingId', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book-1',
        packageId: 'pkg-1',
        package: { name: 'Wedding Basic' },
        customerId: 'cust-1',
        customer: { name: 'John Doe', email: 'john@example.com', phone: null },
        date: new Date('2025-03-15'),
        totalPrice: 150000,
        status: 'CONFIRMED',
        notes: null,
        depositPaidAmount: 75000,
        balanceDueDate: null,
        balancePaidAmount: 0,
        cancelledBy: null,
        cancellationReason: null,
        refundStatus: null,
        refundAmount: null,
        createdAt: new Date(),
        confirmedAt: null,
        cancelledAt: null,
      });

      await getBookingTool.execute(mockContext, { bookingId: 'book-1' });

      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'book-1', tenantId: TEST_TENANT_ID },
        include: expect.any(Object),
      });
    });

    it('should return full booking details on success', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book-1',
        packageId: 'pkg-1',
        package: { name: 'Wedding Basic' },
        customerId: 'cust-1',
        customer: { name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
        date: new Date('2025-03-15'),
        totalPrice: 150000,
        status: 'CONFIRMED',
        notes: 'Special request',
        depositPaidAmount: 75000,
        balanceDueDate: new Date('2025-03-01'),
        balancePaidAmount: 0,
        cancelledBy: null,
        cancellationReason: null,
        refundStatus: null,
        refundAmount: null,
        createdAt: new Date(),
        confirmedAt: new Date(),
        cancelledAt: null,
      });

      const result = await getBookingTool.execute(mockContext, { bookingId: 'book-1' });

      expect(result.success).toBe(true);
      expect(result.data.customerName).toBe('John Doe');
      expect(result.data.depositPaidAmount).toBe(75000);
    });

    it('should return error when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      const result = await getBookingTool.execute(mockContext, { bookingId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to access booking');
    });
  });

  // ============================================================================
  // check_availability Tests
  // ============================================================================

  describe('check_availability', () => {
    it('should filter by tenantId for all queries', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue(null);

      await checkAvailabilityTool.execute(mockContext, { date: '2025-03-15' });

      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
      expect(mockPrisma.blackoutDate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return available: true when date is free', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue(null);

      const result = await checkAvailabilityTool.execute(mockContext, { date: '2025-03-15' });

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(true);
      expect(result.data.conflict).toBeNull();
    });

    it('should return available: false with booking conflict', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book-1',
        status: 'CONFIRMED',
      });
      mockPrisma.blackoutDate.findFirst.mockResolvedValue(null);

      const result = await checkAvailabilityTool.execute(mockContext, { date: '2025-03-15' });

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(false);
      expect(result.data.conflict.type).toBe('booking');
    });

    it('should return available: false with blackout conflict', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.blackoutDate.findFirst.mockResolvedValue({
        reason: 'Vacation',
      });

      const result = await checkAvailabilityTool.execute(mockContext, { date: '2025-03-15' });

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(false);
      expect(result.data.conflict.type).toBe('blackout');
    });
  });

  // ============================================================================
  // get_landing_page Tests
  // ============================================================================

  describe('get_landing_page', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        landingPageConfig: { sections: {} },
      });

      await getLandingPageTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TENANT_ID },
        select: { landingPageConfig: true },
      });
    });

    it('should return landing page config on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        landingPageConfig: { sections: { hero: { title: 'Welcome' } } },
      });

      const result = await getLandingPageTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.sections.hero.title).toBe('Welcome');
    });

    it('should return error when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await getLandingPageTool.execute(mockContext, {});

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // get_stripe_status Tests
  // ============================================================================

  describe('get_stripe_status', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        stripeOnboarded: true,
        stripeAccountId: 'acct_test123',
      });

      await getStripeStatusTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TENANT_ID },
        select: { stripeOnboarded: true, stripeAccountId: true },
      });
    });

    it('should return connected status correctly', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        stripeOnboarded: true,
        stripeAccountId: 'acct_test123',
      });

      const result = await getStripeStatusTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      expect(result.data.hasAccount).toBe(true);
      expect(result.data.needsOnboarding).toBe(false);
    });

    it('should not expose stripe account ID', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        stripeOnboarded: true,
        stripeAccountId: 'acct_test123',
      });

      const result = await getStripeStatusTool.execute(mockContext, {});

      expect(result.data.stripeAccountId).toBeUndefined();
    });
  });

  // ============================================================================
  // get_addons Tests
  // ============================================================================

  describe('get_addons', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.addOn.findMany.mockResolvedValue([]);

      await getAddonsTool.execute(mockContext, {});

      expect(mockPrisma.addOn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return addons list on success', async () => {
      mockPrisma.addOn.findMany.mockResolvedValue([
        {
          id: 'addon-1',
          slug: 'extra-hour',
          name: 'Extra Hour',
          description: 'One additional hour',
          price: 15000,
          active: true,
          segmentId: null,
          segment: null,
          createdAt: new Date(),
        },
      ]);

      const result = await getAddonsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].priceFormatted).toBe('$150.00');
    });

    it('should filter by addOnId when provided', async () => {
      mockPrisma.addOn.findFirst.mockResolvedValue({
        id: 'addon-1',
        slug: 'extra-hour',
        name: 'Extra Hour',
        description: 'One additional hour',
        price: 15000,
        active: true,
        segmentId: null,
        segment: null,
        createdAt: new Date(),
      });

      await getAddonsTool.execute(mockContext, { addOnId: 'addon-1' });

      expect(mockPrisma.addOn.findFirst).toHaveBeenCalledWith({
        where: { id: 'addon-1', tenantId: TEST_TENANT_ID },
        include: expect.any(Object),
      });
    });
  });

  // ============================================================================
  // get_customers Tests
  // ============================================================================

  describe('get_customers', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.booking.groupBy.mockResolvedValue([]);

      await getCustomersTool.execute(mockContext, {});

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return customers with booking stats', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust-1',
          email: 'john@example.com',
          phone: '555-1234',
          name: 'John Doe',
          createdAt: new Date(),
        },
      ]);
      mockPrisma.booking.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _count: { _all: 3 }, _sum: { totalPrice: 45000 } },
      ]);

      const result = await getCustomersTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].bookingCount).toBe(3);
      expect(result.data[0].totalSpentFormatted).toBe('$450.00');
    });

    it('should filter by customerId when provided', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        email: 'john@example.com',
        phone: null,
        name: 'John Doe',
        createdAt: new Date(),
      });
      mockPrisma.booking.aggregate.mockResolvedValue({
        _count: { _all: 2 },
        _sum: { totalPrice: 30000 },
      });

      await getCustomersTool.execute(mockContext, { customerId: 'cust-1' });

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', tenantId: TEST_TENANT_ID },
      });
    });
  });

  // ============================================================================
  // get_segments Tests
  // ============================================================================

  describe('get_segments', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.segment.findMany.mockResolvedValue([]);

      await getSegmentsTool.execute(mockContext, {});

      expect(mockPrisma.segment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return segments with package counts', async () => {
      mockPrisma.segment.findMany.mockResolvedValue([
        {
          id: 'seg-1',
          slug: 'weddings',
          name: 'Weddings',
          heroTitle: 'Wedding Photography',
          heroSubtitle: 'Capture your special day',
          description: 'Full wedding coverage',
          sortOrder: 1,
          active: true,
          _count: { packages: 5 },
        },
      ]);

      const result = await getSegmentsTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].packageCount).toBe(5);
    });

    it('should filter by segmentId when provided', async () => {
      mockPrisma.segment.findFirst.mockResolvedValue({
        id: 'seg-1',
        slug: 'weddings',
        name: 'Weddings',
        heroTitle: 'Wedding Photography',
        heroSubtitle: null,
        description: null,
        sortOrder: 1,
        active: true,
        _count: { packages: 5 },
      });

      await getSegmentsTool.execute(mockContext, { segmentId: 'seg-1' });

      expect(mockPrisma.segment.findFirst).toHaveBeenCalledWith({
        where: { id: 'seg-1', tenantId: TEST_TENANT_ID },
        include: expect.any(Object),
      });
    });
  });

  // ============================================================================
  // get_trial_status Tests
  // ============================================================================

  describe('get_trial_status', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subscriptionStatus: 'TRIALING',
      });

      await getTrialStatusTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TENANT_ID },
        select: { trialEndsAt: true, subscriptionStatus: true },
      });
    });

    it('should return active trial status correctly', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        trialEndsAt: futureDate,
        subscriptionStatus: 'TRIALING',
      });

      const result = await getTrialStatusTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.trialActive).toBe(true);
      expect(result.data.daysRemaining).toBeGreaterThan(0);
    });

    it('should return inactive trial when expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        trialEndsAt: pastDate,
        subscriptionStatus: 'TRIALING',
      });

      const result = await getTrialStatusTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.trialActive).toBe(false);
    });
  });

  // ============================================================================
  // get_booking_link Tests
  // ============================================================================

  describe('get_booking_link', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        slug: 'test-studio',
      });

      await getBookingLinkTool.execute(mockContext, {});

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TENANT_ID },
        select: { slug: true },
      });
    });

    it('should return storefront URL on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        slug: 'test-studio',
      });

      const result = await getBookingLinkTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.storefrontUrl).toContain('/t/test-studio');
    });

    it('should include package URL when packageSlug provided', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        slug: 'test-studio',
      });
      mockPrisma.package.findFirst.mockResolvedValue({
        slug: 'wedding-basic',
        name: 'Wedding Basic',
      });

      const result = await getBookingLinkTool.execute(mockContext, {
        packageSlug: 'wedding-basic',
      });

      expect(result.success).toBe(true);
      expect(result.data.packageUrl).toContain('/book/wedding-basic');
    });

    it('should return error when package not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        slug: 'test-studio',
      });
      mockPrisma.package.findFirst.mockResolvedValue(null);

      const result = await getBookingLinkTool.execute(mockContext, { packageSlug: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to access package');
    });
  });

  // ============================================================================
  // refresh_context Tests
  // ============================================================================

  describe('refresh_context', () => {
    it('should filter all queries by tenantId', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        name: 'Test Studio',
        slug: 'test-studio',
        stripeOnboarded: true,
      });
      mockPrisma.package.count.mockResolvedValue(5);
      mockPrisma.booking.count.mockResolvedValue(3);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 50000 } });

      await refreshContextTool.execute(mockContext, {});

      expect(mockPrisma.package.count).toHaveBeenCalledWith({
        where: { tenantId: TEST_TENANT_ID },
      });
    });

    it('should return refreshed context data on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        name: 'Test Studio',
        slug: 'test-studio',
        stripeOnboarded: true,
      });
      mockPrisma.package.count.mockResolvedValue(5);
      mockPrisma.booking.count.mockResolvedValue(3);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 50000 } });

      const result = await refreshContextTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.packageCount).toBe(5);
      expect(result.data.upcomingBookings).toBe(3);
      expect(result.data.stripeConnected).toBe(true);
    });
  });

  // ============================================================================
  // get_blackout_dates Tests
  // ============================================================================

  describe('get_blackout_dates', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.blackoutDate.findMany.mockResolvedValue([]);

      await getBlackoutDatesTool.execute(mockContext, {});

      expect(mockPrisma.blackoutDate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return blackout dates on success', async () => {
      mockPrisma.blackoutDate.findMany.mockResolvedValue([
        {
          id: 'bd-1',
          date: new Date('2025-03-15'),
          reason: 'Vacation',
        },
        {
          id: 'bd-2',
          date: new Date('2025-03-16'),
          reason: null,
        },
      ]);

      const result = await getBlackoutDatesTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.blackoutDates).toHaveLength(2);
      expect(result.data.count).toBe(2);
    });

    it('should apply date range filters', async () => {
      mockPrisma.blackoutDate.findMany.mockResolvedValue([]);

      await getBlackoutDatesTool.execute(mockContext, {
        fromDate: '2025-03-01',
        toDate: '2025-03-31',
      });

      expect(mockPrisma.blackoutDate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  // ============================================================================
  // get_availability_rules Tests
  // ============================================================================

  describe('get_availability_rules', () => {
    it('should filter by tenantId from context', async () => {
      mockPrisma.availabilityRule.findMany.mockResolvedValue([]);

      await getAvailabilityRulesTool.execute(mockContext, {});

      expect(mockPrisma.availabilityRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TEST_TENANT_ID }),
        })
      );
    });

    it('should return availability rules on success', async () => {
      mockPrisma.availabilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          serviceId: null,
          service: null,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: null,
        },
      ]);

      const result = await getAvailabilityRulesTool.execute(mockContext, {});

      expect(result.success).toBe(true);
      expect(result.data.rules).toHaveLength(1);
      expect(result.data.rules[0].dayName).toBe('Monday');
    });

    it('should filter by dayOfWeek when provided', async () => {
      mockPrisma.availabilityRule.findMany.mockResolvedValue([]);

      await getAvailabilityRulesTool.execute(mockContext, { dayOfWeek: 1 });

      expect(mockPrisma.availabilityRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            dayOfWeek: 1,
          }),
        })
      );
    });

    it('should filter by serviceId when provided', async () => {
      mockPrisma.availabilityRule.findMany.mockResolvedValue([]);

      await getAvailabilityRulesTool.execute(mockContext, { serviceId: 'svc-1' });

      expect(mockPrisma.availabilityRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            serviceId: 'svc-1',
          }),
        })
      );
    });
  });
});
