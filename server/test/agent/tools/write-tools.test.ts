/**
 * Unit tests for Agent Write Tools
 *
 * Tests focus on:
 * - Trust tier enforcement (T1/T2/T3 escalation)
 * - Tenant isolation (all queries use tenantId)
 * - Proposal creation flow
 * - Input validation and error handling
 * - Price change significance calculations
 *
 * High-risk tools tested first:
 * - upsert_package (price escalation to T3)
 * - delete_package (T3 hard confirm)
 * - cancel_booking (T3 hard confirm)
 * - process_refund (T3 hard confirm)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolContext } from '../../../src/agent/tools/types';

// Mock ProposalService before importing tools
const mockCreateProposal = vi.fn();
vi.mock('../../../src/agent/proposals/proposal.service', () => ({
  ProposalService: vi.fn().mockImplementation(() => ({
    createProposal: mockCreateProposal,
  })),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import tools after mocks are set up
import {
  upsertPackageTool,
  upsertAddOnTool,
  deleteAddOnTool,
  deletePackageTool,
  manageBlackoutTool,
  addBlackoutDateTool,
  removeBlackoutDateTool,
  updateBrandingTool,
  updateLandingPageTool,
  requestFileUploadTool,
  cancelBookingTool,
  createBookingTool,
  processRefundTool,
  upsertSegmentTool,
  deleteSegmentTool,
  updateBookingTool,
  updateDepositSettingsTool,
  startTrialTool,
  initiateStripeOnboardingTool,
  deletePackagePhotoTool,
} from '../../../src/agent/tools/write-tools';

describe('Write Tools', () => {
  let mockContext: ToolContext;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      package: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      addOn: {
        findFirst: vi.fn(),
      },
      booking: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'test-tenant-123',
          slug: 'test-studio',
          stripeAccountId: 'acct_test123',
        }),
      },
      segment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      blackoutDate: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockContext = {
      tenantId: 'test-tenant-123',
      sessionId: 'session-456',
      prisma: mockPrisma,
    };

    // Default mock for createProposal
    mockCreateProposal.mockResolvedValue({
      proposalId: 'prop_test123',
      operation: 'Test Operation',
      preview: {},
      trustTier: 'T2',
      requiresApproval: false,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Tool Structure Tests
  // ============================================================================

  describe('Tool Structure Validation', () => {
    // Trust tiers reflect the BASE tier - some tools dynamically escalate in execute()
    // T2 → T3 escalation happens for: delete_addon, delete_package, delete_segment (if has bookings/packages)
    // T2 → T3 escalation happens for: upsert_package (if significant price change)
    const allTools = [
      { tool: upsertPackageTool, expectedTier: 'T2', name: 'upsert_package' },
      { tool: upsertAddOnTool, expectedTier: 'T2', name: 'upsert_addon' },
      { tool: deleteAddOnTool, expectedTier: 'T2', name: 'delete_addon' }, // Escalates to T3 if has bookings
      { tool: deletePackageTool, expectedTier: 'T2', name: 'delete_package' }, // Escalates to T3 if has bookings
      { tool: manageBlackoutTool, expectedTier: 'T1', name: 'manage_blackout' },
      { tool: addBlackoutDateTool, expectedTier: 'T1', name: 'add_blackout_date' },
      { tool: removeBlackoutDateTool, expectedTier: 'T2', name: 'remove_blackout_date' },
      { tool: updateBrandingTool, expectedTier: 'T1', name: 'update_branding' },
      { tool: updateLandingPageTool, expectedTier: 'T2', name: 'update_landing_page' },
      { tool: requestFileUploadTool, expectedTier: 'T1', name: 'request_file_upload' },
      { tool: cancelBookingTool, expectedTier: 'T3', name: 'cancel_booking' },
      { tool: createBookingTool, expectedTier: 'T3', name: 'create_booking' }, // Always T3 - manual bookings
      { tool: processRefundTool, expectedTier: 'T3', name: 'process_refund' },
      { tool: upsertSegmentTool, expectedTier: 'T2', name: 'upsert_segment' },
      { tool: deleteSegmentTool, expectedTier: 'T2', name: 'delete_segment' }, // Escalates to T3 if has packages
      { tool: updateBookingTool, expectedTier: 'T2', name: 'update_booking' },
      { tool: updateDepositSettingsTool, expectedTier: 'T3', name: 'update_deposit_settings' }, // Financial config
      { tool: startTrialTool, expectedTier: 'T2', name: 'start_trial' },
      {
        tool: initiateStripeOnboardingTool,
        expectedTier: 'T2',
        name: 'initiate_stripe_onboarding',
      },
      { tool: deletePackagePhotoTool, expectedTier: 'T2', name: 'delete_package_photo' },
    ];

    it.each(allTools)('$name should have correct structure', ({ tool, expectedTier, name }) => {
      expect(tool.name).toBe(name);
      expect(tool.trustTier).toBe(expectedTier);
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    });

    it('all tools should have valid JSON Schema input definitions', () => {
      allTools.forEach(({ tool }) => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });
  });

  // ============================================================================
  // upsert_package Tests (High Risk - Trust Tier Escalation)
  // ============================================================================

  describe('upsert_package', () => {
    describe('Trust Tier Enforcement', () => {
      it('should use T2 for new package creation', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          title: 'Wedding Premium',
          priceCents: 299900,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'test-tenant-123',
            trustTier: 'T2',
          })
        );
      });

      it('should escalate to T3 for price increase >20%', async () => {
        mockPrisma.package.findFirst.mockResolvedValue({
          id: 'pkg_existing',
          tenantId: 'test-tenant-123',
          name: 'Wedding Basic',
          basePrice: 100000, // $1,000
        });

        await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_existing',
          title: 'Wedding Basic',
          priceCents: 125000, // $1,250 (25% increase)
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3',
          })
        );
      });

      it('should escalate to T3 for price decrease >20%', async () => {
        mockPrisma.package.findFirst.mockResolvedValue({
          id: 'pkg_existing',
          tenantId: 'test-tenant-123',
          name: 'Wedding Basic',
          basePrice: 100000, // $1,000
        });

        await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_existing',
          title: 'Wedding Basic',
          priceCents: 75000, // $750 (25% decrease)
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3',
          })
        );
      });

      it('should escalate to T3 for absolute change >$100', async () => {
        mockPrisma.package.findFirst.mockResolvedValue({
          id: 'pkg_existing',
          tenantId: 'test-tenant-123',
          name: 'Enterprise',
          basePrice: 1000000, // $10,000
        });

        await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_existing',
          title: 'Enterprise',
          priceCents: 1011000, // $10,110 (1.1% but >$100 change)
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3',
          })
        );
      });

      it('should stay at T2 for minor price changes (<20% and <$100)', async () => {
        mockPrisma.package.findFirst.mockResolvedValue({
          id: 'pkg_existing',
          tenantId: 'test-tenant-123',
          name: 'Mini Session',
          basePrice: 50000, // $500
        });

        await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_existing',
          title: 'Mini Session',
          priceCents: 55000, // $550 (10% increase, $50 change)
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T2',
          })
        );
      });
    });

    describe('Tenant Isolation', () => {
      it('should filter package lookup by tenantId', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_123',
          title: 'Test Package',
          priceCents: 10000,
        });

        expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
          where: { id: 'pkg_123', tenantId: 'test-tenant-123' },
        });
      });

      it('should include tenantId in proposal creation', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          title: 'Test Package',
          priceCents: 10000,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'test-tenant-123',
          })
        );
      });
    });

    describe('Payload Mapping', () => {
      it('should map title to name in payload', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          title: 'Wedding Premium',
          priceCents: 299900,
          description: 'Full day coverage',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              name: 'Wedding Premium',
              basePrice: 299900,
              description: 'Full day coverage',
            }),
          })
        );
      });

      it('should default bookingType to DATE', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          title: 'Test',
          priceCents: 10000,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              bookingType: 'DATE',
            }),
          })
        );
      });

      it('should default active to true', async () => {
        mockPrisma.package.findFirst.mockResolvedValue(null);

        await upsertPackageTool.execute(mockContext, {
          title: 'Test',
          priceCents: 10000,
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              active: true,
            }),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return error result on database failure', async () => {
        mockPrisma.package.findFirst.mockRejectedValue(new Error('Connection failed'));

        const result = await upsertPackageTool.execute(mockContext, {
          packageId: 'pkg_123',
          title: 'Test',
          priceCents: 10000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  // ============================================================================
  // delete_package Tests (T2 base, escalates to T3 if has bookings)
  // ============================================================================

  describe('delete_package', () => {
    it('should have T2 base trust tier (escalates to T3 if has bookings)', () => {
      expect(deletePackageTool.trustTier).toBe('T2');
    });

    it('should verify package exists before creating proposal', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg_123',
        tenantId: 'test-tenant-123',
        name: 'Wedding Basic',
        _count: { bookings: 0 },
      });

      await deletePackageTool.execute(mockContext, {
        packageId: 'pkg_123',
      });

      expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
        where: { id: 'pkg_123', tenantId: 'test-tenant-123' },
        include: { _count: { select: { bookings: true } } },
      });
    });

    it('should return error if package not found', async () => {
      mockPrisma.package.findFirst.mockResolvedValue(null);

      const result = await deletePackageTool.execute(mockContext, {
        packageId: 'pkg_nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to access package');
    });

    it('should include package name in operation preview', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg_123',
        tenantId: 'test-tenant-123',
        name: 'Wedding Premium',
        _count: { bookings: 0 },
      });

      await deletePackageTool.execute(mockContext, {
        packageId: 'pkg_123',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: expect.stringContaining('Wedding Premium'),
        })
      );
    });

    it('should use T2 trust tier when package has no bookings', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg_123',
        tenantId: 'test-tenant-123',
        name: 'New Package',
        _count: { bookings: 0 },
      });

      await deletePackageTool.execute(mockContext, {
        packageId: 'pkg_123',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          trustTier: 'T2',
        })
      );
    });

    it('should escalate to T3 trust tier when package has bookings', async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: 'pkg_123',
        tenantId: 'test-tenant-123',
        name: 'Popular Package',
        _count: { bookings: 5 },
      });

      await deletePackageTool.execute(mockContext, {
        packageId: 'pkg_123',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          trustTier: 'T3',
        })
      );
    });
  });

  // ============================================================================
  // cancel_booking Tests (T3 Hard Confirm)
  // ============================================================================

  describe('cancel_booking', () => {
    it('should have T3 trust tier for booking cancellation', () => {
      expect(cancelBookingTool.trustTier).toBe('T3');
    });

    it('should verify booking belongs to tenant', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book_123',
        tenantId: 'test-tenant-123',
        status: 'CONFIRMED',
        customer: { name: 'John Doe', email: 'john@example.com' },
        package: { name: 'Wedding Basic' },
      });

      await cancelBookingTool.execute(mockContext, {
        bookingId: 'book_123',
        reason: 'Customer request',
      });

      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'book_123', tenantId: 'test-tenant-123' },
        })
      );
    });

    it('should return error if booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      const result = await cancelBookingTool.execute(mockContext, {
        bookingId: 'book_nonexistent',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should include customer info in preview', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book_123',
        tenantId: 'test-tenant-123',
        status: 'CONFIRMED',
        date: new Date('2026-03-15'),
        totalPrice: 150000,
        customer: { name: 'John Doe', email: 'john@example.com' },
        package: { name: 'Wedding Basic' },
      });

      await cancelBookingTool.execute(mockContext, {
        bookingId: 'book_123',
        reason: 'Customer request',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          preview: expect.objectContaining({
            customerName: expect.stringContaining('John Doe'),
          }),
        })
      );
    });
  });

  // ============================================================================
  // process_refund Tests (T3 Hard Confirm)
  // ============================================================================

  describe('process_refund', () => {
    it('should have T3 trust tier for refund operations', () => {
      expect(processRefundTool.trustTier).toBe('T3');
    });

    it('should verify booking belongs to tenant before refund', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book_123',
        tenantId: 'test-tenant-123',
        date: new Date('2026-03-15'),
        depositPaidAmount: 50000,
        balancePaidAmount: 50000,
        refundStatus: null,
        refundAmount: 0,
        stripePaymentIntentId: 'pi_test123',
        customer: { name: 'Jane Doe' },
        package: { name: 'Portrait Session' },
      });

      await processRefundTool.execute(mockContext, {
        bookingId: 'book_123',
        amountCents: 50000,
        reason: 'Partial refund',
      });

      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'test-tenant-123',
          }),
        })
      );
    });

    it('should include refund amount in preview', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book_123',
        tenantId: 'test-tenant-123',
        date: new Date('2026-03-15'),
        depositPaidAmount: 50000,
        balancePaidAmount: 50000,
        refundStatus: null,
        refundAmount: 0,
        stripePaymentIntentId: 'pi_test123',
        customer: { name: 'Jane Doe' },
        package: { name: 'Portrait Session' },
      });

      await processRefundTool.execute(mockContext, {
        bookingId: 'book_123',
        amountCents: 50000,
        reason: 'Partial refund',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          preview: expect.objectContaining({
            refundAmount: '$500.00',
          }),
        })
      );
    });

    it('should return error when booking already fully refunded', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'book_123',
        tenantId: 'test-tenant-123',
        refundStatus: 'COMPLETED',
        customer: { name: 'Jane Doe' },
        package: { name: 'Portrait Session' },
      });

      const result = await processRefundTool.execute(mockContext, {
        bookingId: 'book_123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already been fully refunded');
    });
  });

  // ============================================================================
  // update_branding Tests (T1 Auto-Confirm)
  // ============================================================================

  describe('update_branding', () => {
    it('should have T1 trust tier for branding updates', () => {
      expect(updateBrandingTool.trustTier).toBe('T1');
    });

    it('should include tenantId in proposal', async () => {
      await updateBrandingTool.execute(mockContext, {
        headline: 'New Headline',
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant-123',
        })
      );
    });
  });

  // ============================================================================
  // Blackout Date Tools Tests
  // ============================================================================

  describe('Blackout Tools', () => {
    describe('add_blackout_date', () => {
      it('should have T1 trust tier for adding blackouts', () => {
        expect(addBlackoutDateTool.trustTier).toBe('T1');
      });
    });

    describe('remove_blackout_date', () => {
      it('should have T2 trust tier for removing blackouts', () => {
        expect(removeBlackoutDateTool.trustTier).toBe('T2');
      });

      it('should verify blackout exists and belongs to tenant', async () => {
        mockPrisma.blackoutDate.findFirst.mockResolvedValue({
          id: 'bd_123',
          tenantId: 'test-tenant-123',
          date: new Date('2026-02-15'),
          reason: 'Vacation',
        });

        await removeBlackoutDateTool.execute(mockContext, {
          blackoutId: 'bd_123',
        });

        expect(mockPrisma.blackoutDate.findFirst).toHaveBeenCalledWith({
          where: { id: 'bd_123', tenantId: 'test-tenant-123' },
        });
      });
    });
  });

  // ============================================================================
  // Segment Tools Tests
  // ============================================================================

  describe('Segment Tools', () => {
    describe('upsert_segment', () => {
      it('should have T2 trust tier', () => {
        expect(upsertSegmentTool.trustTier).toBe('T2');
      });

      it('should filter segment lookup by tenantId', async () => {
        mockPrisma.segment.findFirst.mockResolvedValue(null);

        await upsertSegmentTool.execute(mockContext, {
          segmentId: 'seg_123',
          name: 'Weddings',
        });

        expect(mockPrisma.segment.findFirst).toHaveBeenCalledWith({
          where: { id: 'seg_123', tenantId: 'test-tenant-123' },
        });
      });
    });

    describe('delete_segment', () => {
      it('should have T2 base trust tier (escalates to T3 if has packages)', () => {
        expect(deleteSegmentTool.trustTier).toBe('T2');
      });

      it('should return error if segment not found', async () => {
        mockPrisma.segment.findFirst.mockResolvedValue(null);

        const result = await deleteSegmentTool.execute(mockContext, {
          segmentId: 'seg_nonexistent',
        });

        expect(result.success).toBe(false);
      });

      it('should use T2 trust tier when segment has no packages', async () => {
        mockPrisma.segment.findFirst.mockResolvedValue({
          id: 'seg_123',
          tenantId: 'test-tenant-123',
          name: 'Empty Segment',
          _count: { packages: 0 },
        });

        await deleteSegmentTool.execute(mockContext, {
          segmentId: 'seg_123',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T2',
          })
        );
      });

      it('should escalate to T3 trust tier when segment has packages', async () => {
        mockPrisma.segment.findFirst.mockResolvedValue({
          id: 'seg_123',
          tenantId: 'test-tenant-123',
          name: 'Busy Segment',
          _count: { packages: 3 },
        });

        await deleteSegmentTool.execute(mockContext, {
          segmentId: 'seg_123',
        });

        expect(mockCreateProposal).toHaveBeenCalledWith(
          expect.objectContaining({
            trustTier: 'T3',
          })
        );
      });
    });
  });

  // ============================================================================
  // File Upload Tool Tests
  // ============================================================================

  describe('request_file_upload', () => {
    it('should have T1 trust tier', () => {
      expect(requestFileUploadTool.trustTier).toBe('T1');
    });

    it('should return upload instructions without creating proposal (read-like operation)', async () => {
      const result = await requestFileUploadTool.execute(mockContext, {
        fileType: 'logo',
        filename: 'my-logo.png',
      });

      // This tool returns directly without creating a proposal
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.endpoint).toContain('logo');
      expect(mockCreateProposal).not.toHaveBeenCalled();
    });

    it('should return correct upload endpoint for different file types', async () => {
      const logoResult = await requestFileUploadTool.execute(mockContext, {
        fileType: 'logo',
        filename: 'logo.png',
      });
      expect(logoResult.data.endpoint).toBe('/v1/tenant-admin/logo');

      const photoResult = await requestFileUploadTool.execute(mockContext, {
        fileType: 'package-photo',
        filename: 'photo.jpg',
      });
      expect(photoResult.data.endpoint).toContain('packages');
    });
  });

  // ============================================================================
  // Stripe Integration Tools Tests
  // ============================================================================

  describe('Stripe Tools', () => {
    describe('initiate_stripe_onboarding', () => {
      it('should have T2 trust tier (redirects user to Stripe)', () => {
        expect(initiateStripeOnboardingTool.trustTier).toBe('T2');
      });
    });

    describe('start_trial', () => {
      it('should have T2 trust tier (soft confirm for trial start)', () => {
        expect(startTrialTool.trustTier).toBe('T2');
      });
    });
  });

  // ============================================================================
  // Deposit Settings Tests
  // ============================================================================

  describe('update_deposit_settings', () => {
    it('should have T3 trust tier (financial configuration)', () => {
      expect(updateDepositSettingsTool.trustTier).toBe('T3');
    });

    it('should include tenantId in proposal', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'test-tenant-123',
        depositPercent: null,
        balanceDueDays: null,
      });

      await updateDepositSettingsTool.execute(mockContext, {
        depositPercent: 50,
      });

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant-123',
        })
      );
    });

    it('should validate deposit percent range', async () => {
      const result = await updateDepositSettingsTool.execute(mockContext, {
        depositPercent: 150, // Invalid - over 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 0 and 100');
    });

    it('should return error if no changes specified', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'test-tenant-123',
        depositPercent: null,
        balanceDueDays: null,
      });

      const result = await updateDepositSettingsTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No changes');
    });
  });
});
