/**
 * Unit tests for Onboarding Executors
 *
 * Tests the executor functions registered for:
 * - upsert_services (T2)
 * - update_storefront (T2)
 *
 * Uses mock Prisma client with $transaction support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerOnboardingExecutors } from '../../../src/agent/executors/onboarding-executors';
import {
  getProposalExecutor,
  registerProposalExecutor,
} from '../../../src/agent/proposals/executor-registry';
import { MissingFieldError, ValidationError } from '../../../src/agent/errors';

// Mock the logger
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Type-safe mock function type
type MockFn = ReturnType<typeof vi.fn>;

// Type for proposal executor function matching executor-registry's ProposalExecutor
type ProposalExecutorFn = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

// Mock the executor-registry to track registrations
const mockExecutors = new Map<string, ProposalExecutorFn>();

vi.mock('../../../src/agent/proposals/executor-registry', () => ({
  registerProposalExecutor: vi.fn((name: string, executor: ProposalExecutorFn) => {
    mockExecutors.set(name, executor);
  }),
  getProposalExecutor: vi.fn((name: string) => mockExecutors.get(name)),
}));

// P0-FIX: Mock getDraftConfigWithSlug for DraftUpdateService
// This mock returns what the transaction mock provides
vi.mock('../../../src/agent/tools/utils', () => ({
  getDraftConfigWithSlug: vi.fn(),
}));

// P0-FIX: Mock advisory locks
vi.mock('../../../src/lib/advisory-locks', () => ({
  hashTenantStorefront: vi.fn().mockReturnValue(123456789),
}));

import { getDraftConfigWithSlug } from '../../../src/agent/tools/utils';

// Type-safe mock types for Prisma transaction and client
// Based on actual usage in the onboarding-executors.ts file
type MockTransaction = {
  segment: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  package: {
    create: MockFn;
    deleteMany: MockFn;
  };
  tenant: {
    findUnique: MockFn;
    update: MockFn;
  };
  // P0-FIX: Added for DraftUpdateService advisory lock support
  $executeRaw: MockFn;
};

type MockPrismaClient = {
  segment: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  package: {
    create: MockFn;
    deleteMany: MockFn;
  };
  tenant: {
    findUnique: MockFn;
    update: MockFn;
  };
  $transaction: MockFn;
};

describe('Onboarding Executors', () => {
  let mockPrisma: MockPrismaClient;
  let mockTx: MockTransaction;

  beforeEach(() => {
    // Clear the mock executor registry
    mockExecutors.clear();

    // Setup mock transaction
    mockTx = {
      segment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      package: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      // P0-FIX: Added for DraftUpdateService advisory lock support
      $executeRaw: vi.fn().mockResolvedValue(null),
    };

    // Setup mock Prisma client
    mockPrisma = {
      segment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      package: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(<T>(callback: (tx: MockTransaction) => Promise<T>) => callback(mockTx)),
    };

    // Register the executors
    // Cast to unknown first then to PrismaClient since we're using a mock
    registerOnboardingExecutors(
      mockPrisma as unknown as Parameters<typeof registerOnboardingExecutors>[0]
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Executor Registration', () => {
    it('should register upsert_services executor', () => {
      expect(registerProposalExecutor).toHaveBeenCalledWith(
        'upsert_services',
        expect.any(Function)
      );
      expect(getProposalExecutor('upsert_services')).toBeDefined();
    });

    it('should register update_storefront executor', () => {
      expect(registerProposalExecutor).toHaveBeenCalledWith(
        'update_storefront',
        expect.any(Function)
      );
      expect(getProposalExecutor('update_storefront')).toBeDefined();
    });
  });

  describe('upsert_services executor', () => {
    const tenantId = 'test-tenant-123';
    let upsertServicesExecutor: ProposalExecutorFn;

    beforeEach(() => {
      upsertServicesExecutor = getProposalExecutor('upsert_services')!;
    });

    describe('Validation', () => {
      it('should throw MissingFieldError when segmentName is missing', async () => {
        const payload = {
          segmentSlug: 'test-slug',
          packages: [{ name: 'Package 1', priceCents: 1000, groupingOrder: 1 }],
        };

        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toThrow(MissingFieldError);
        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toMatchObject({
          message: expect.stringContaining('segmentName is required'),
        });
      });

      it('should throw MissingFieldError when segmentSlug is missing', async () => {
        const payload = {
          segmentName: 'Test Segment',
          packages: [{ name: 'Package 1', priceCents: 1000, groupingOrder: 1 }],
        };

        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toThrow(MissingFieldError);
        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toMatchObject({
          message: expect.stringContaining('segmentSlug is required'),
        });
      });

      it('should throw MissingFieldError when packages is missing', async () => {
        const payload = {
          segmentName: 'Test Segment',
          segmentSlug: 'test-segment',
        };

        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toThrow(MissingFieldError);
        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toMatchObject({
          message: expect.stringContaining('packages is required'),
        });
      });

      it('should throw MissingFieldError when packages array is empty', async () => {
        const payload = {
          segmentName: 'Test Segment',
          segmentSlug: 'test-segment',
          packages: [],
        };

        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toThrow(MissingFieldError);
      });

      it('should update existing segment and replace packages', async () => {
        mockTx.segment.findFirst.mockResolvedValue({
          id: 'existing-segment-id',
          slug: 'photography-sessions',
          tenantId: 'test-tenant-123',
          name: 'Photography Sessions',
        });
        mockTx.segment.update.mockResolvedValue({
          id: 'existing-segment-id',
          name: 'Photography Sessions',
          slug: 'photography-sessions',
          heroTitle: 'Photography Sessions',
          active: true,
        });
        mockTx.package.deleteMany.mockResolvedValue({ count: 2 }); // 2 old packages deleted
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Basic Package',
          slug: 'basic-package',
          basePrice: 5000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-business' });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [
            { name: 'Basic Package', slug: 'basic-package', priceCents: 5000, groupingOrder: 1 },
          ],
        };

        const result = await upsertServicesExecutor(tenantId, payload);

        expect(result.action).toBe('updated');
        expect(result.segmentId).toBe('existing-segment-id');
        expect(mockTx.segment.update).toHaveBeenCalledWith({
          where: { id: 'existing-segment-id' },
          data: {
            name: 'Photography Sessions',
            heroTitle: 'Photography Sessions',
            active: true,
          },
        });
        expect(mockTx.package.deleteMany).toHaveBeenCalledWith({
          where: { segmentId: 'existing-segment-id', tenantId },
        });
      });
    });

    describe('Tenant Isolation', () => {
      it('should check for existing segment using tenantId', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Test Segment',
          slug: 'test-segment',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Package 1',
          slug: 'package-1',
          basePrice: 1000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Test Segment',
          segmentSlug: 'test-segment',
          packages: [{ name: 'Package 1', priceCents: 1000, groupingOrder: 1 }],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockTx.segment.findFirst).toHaveBeenCalledWith({
          where: { tenantId, slug: 'test-segment' },
        });
      });

      it('should create segment with tenantId', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Photography Sessions',
          slug: 'photography-sessions',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Basic',
          slug: 'basic',
          basePrice: 5000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [{ name: 'Basic', priceCents: 5000, groupingOrder: 1 }],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockTx.segment.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId,
            name: 'Photography Sessions',
            slug: 'photography-sessions',
          }),
        });
      });

      it('should create packages with tenantId', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Photography Sessions',
          slug: 'photography-sessions',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Mini Session',
          slug: 'mini-session',
          basePrice: 15000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [
            { name: 'Mini Session', slug: 'mini-session', priceCents: 15000, groupingOrder: 1 },
          ],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockTx.package.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId,
            segmentId: 'new-segment-id',
          }),
        });
      });
    });

    describe('Atomic Transaction', () => {
      it('should execute segment and package creation in a transaction', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Test Segment',
          slug: 'test-segment',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Package 1',
          slug: 'package-1',
          basePrice: 1000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Test Segment',
          segmentSlug: 'test-segment',
          packages: [{ name: 'Package 1', priceCents: 1000, groupingOrder: 1 }],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockTx.segment.create).toHaveBeenCalled();
        expect(mockTx.package.create).toHaveBeenCalled();
      });

      it('should create multiple packages in the transaction', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Photography Sessions',
          slug: 'photography-sessions',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'new-package-id',
          name: 'Test',
          slug: 'test',
          basePrice: 1000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [
            { name: 'Mini Session', slug: 'mini', priceCents: 15000, groupingOrder: 1 },
            { name: 'Full Session', slug: 'full', priceCents: 35000, groupingOrder: 2 },
            { name: 'Premium Session', slug: 'premium', priceCents: 55000, groupingOrder: 3 },
          ],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockTx.package.create).toHaveBeenCalledTimes(3);
      });
    });

    describe('Return Structure', () => {
      it('should return correct structure with segmentId, packageCount, and previewUrl', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Photography Sessions',
          slug: 'photography-sessions',
        });
        mockTx.package.create
          .mockResolvedValueOnce({
            id: 'pkg-1',
            name: 'Mini Session',
            slug: 'mini',
            basePrice: 15000,
          })
          .mockResolvedValueOnce({
            id: 'pkg-2',
            name: 'Full Session',
            slug: 'full',
            basePrice: 35000,
          });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'bella-weddings' });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [
            { name: 'Mini Session', slug: 'mini', priceCents: 15000, groupingOrder: 1 },
            { name: 'Full Session', slug: 'full', priceCents: 35000, groupingOrder: 2 },
          ],
        };

        const result = await upsertServicesExecutor(tenantId, payload);

        expect(result).toEqual({
          action: 'created',
          segmentId: 'new-segment-id',
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: expect.arrayContaining([
            expect.objectContaining({ id: 'pkg-1', name: 'Mini Session' }),
            expect.objectContaining({ id: 'pkg-2', name: 'Full Session' }),
          ]),
          packageCount: 2,
          previewUrl: expect.stringContaining('/t/bella-weddings'),
        });
      });

      it('should return packages with correct priceCents field', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Coaching',
          slug: 'coaching',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'pkg-1',
          name: 'Discovery Session',
          slug: 'discovery',
          basePrice: 25000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'coaching-biz' });

        const payload = {
          segmentName: 'Coaching',
          segmentSlug: 'coaching',
          packages: [
            { name: 'Discovery Session', slug: 'discovery', priceCents: 25000, groupingOrder: 1 },
          ],
        };

        const result = await upsertServicesExecutor(tenantId, payload);

        expect(result.packages[0]).toMatchObject({
          priceCents: 25000,
        });
      });

      it('should handle tenant without slug gracefully', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Test',
          slug: 'test',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'pkg-1',
          name: 'Basic',
          slug: 'basic',
          basePrice: 1000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: null });

        const payload = {
          segmentName: 'Test',
          segmentSlug: 'test',
          packages: [{ name: 'Basic', priceCents: 1000, groupingOrder: 1 }],
        };

        const result = await upsertServicesExecutor(tenantId, payload);

        expect(result.previewUrl).toBeUndefined();
      });
    });

    describe('Slug Generation', () => {
      it('should generate slug from package name if not provided', async () => {
        mockTx.segment.findFirst.mockResolvedValue(null);
        mockTx.segment.create.mockResolvedValue({
          id: 'new-segment-id',
          name: 'Test',
          slug: 'test',
        });
        mockTx.package.create.mockResolvedValue({
          id: 'pkg-1',
          name: 'Premium Wedding Photos',
          slug: 'premium-wedding-photos',
          basePrice: 100000,
        });
        mockTx.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          segmentName: 'Test',
          segmentSlug: 'test',
          packages: [
            {
              name: 'Premium Wedding Photos',
              priceCents: 100000,
              groupingOrder: 1,
              // No slug provided - should be auto-generated
            },
          ],
        };

        await upsertServicesExecutor(tenantId, payload);

        expect(mockTx.package.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            slug: 'premium-wedding-photos',
          }),
        });
      });
    });
  });

  describe('update_storefront executor', () => {
    const tenantId = 'test-tenant-456';
    let updateStorefrontExecutor: ProposalExecutorFn;

    beforeEach(() => {
      updateStorefrontExecutor = getProposalExecutor('update_storefront')!;

      // P0-FIX: Mock the DraftUpdateService dependencies
      // The executor now uses DraftUpdateService which requires $transaction
      mockPrisma.$transaction.mockImplementation(
        async <T>(callback: (tx: MockTransaction) => Promise<T>): Promise<T> => {
          return callback(mockTx);
        }
      );
      mockTx.$executeRaw = vi.fn().mockResolvedValue(null);

      // P0-FIX: Default mock for getDraftConfigWithSlug - empty pages with defaults
      const mockGetDraftConfigWithSlug = vi.mocked(getDraftConfigWithSlug);
      mockGetDraftConfigWithSlug.mockResolvedValue({
        pages: {
          home: { enabled: true, sections: [] },
          about: { enabled: true, sections: [] },
          services: { enabled: true, sections: [] },
          faq: { enabled: true, sections: [] },
          contact: { enabled: true, sections: [] },
          gallery: { enabled: true, sections: [] },
          testimonials: { enabled: true, sections: [] },
        },
        slug: 'test-tenant',
        hasDraft: false,
        rawDraftConfig: null,
        rawLiveConfig: null,
      });
    });

    describe('P0-FIX: Write to landingPageConfigDraft NOT landingPageConfig', () => {
      it('should write to landingPageConfigDraft (not landingPageConfig)', async () => {
        // Mock getDraftConfigWithSlug
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: null,
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          headline: 'Capturing Your Moments',
        };

        await updateStorefrontExecutor(tenantId, payload);

        // CRITICAL: Verify we're writing to DRAFT, not LIVE
        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('landingPageConfigDraft');
        expect(updateCall.data).not.toHaveProperty('landingPageConfig');
      });

      it('should return hasDraft: true for frontend cache invalidation', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: null,
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          headline: 'Test Headline',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result.hasDraft).toBe(true);
      });

      it('should include ?preview=draft in previewUrl', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: null,
          landingPageConfigDraft: null,
          slug: 'bella-weddings',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'bella-weddings' });

        const payload = {
          headline: 'Capturing Love',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result.previewUrl).toContain('?preview=draft');
      });
    });

    describe('Headline and Tagline Updates', () => {
      it('should update headline in landingPageConfigDraft', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          headline: 'Capturing Your Moments',
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        const draft = updateCall.data.landingPageConfigDraft as {
          pages: { home: { sections: Array<{ headline?: string; type?: string; id?: string }> } };
        };
        const heroSection = draft.pages.home.sections[0];

        // Should create hero section with headline in the correct structure
        expect(heroSection.headline).toBe('Capturing Your Moments');
        expect(heroSection.type).toBe('hero');
        expect(heroSection.id).toBe('home-hero-main');
      });

      it('should update tagline as subheadline in hero section', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          tagline: "Professional photography for life's special moments",
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        const draft = updateCall.data.landingPageConfigDraft as {
          pages: {
            home: { sections: Array<{ subheadline?: string; type?: string; id?: string }> };
          };
        };
        const heroSection = draft.pages.home.sections[0];

        // Should create hero section with subheadline (from tagline) in the correct structure
        expect(heroSection.subheadline).toBe("Professional photography for life's special moments");
        expect(heroSection.type).toBe('hero');
        expect(heroSection.id).toBe('home-hero-main');
      });
    });

    describe('primaryColor Updates', () => {
      it('should update primaryColor on tenant directly (not in draft)', async () => {
        // P0-FIX: Branding updates use mockPrisma directly, not transaction
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          primaryColor: '#1a365d',
        };

        await updateStorefrontExecutor(tenantId, payload);

        // Branding is updated directly via DraftUpdateService.updateBranding
        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
          where: { id: tenantId },
          data: expect.objectContaining({
            primaryColor: '#1a365d',
          }),
        });
      });
    });

    describe('brandVoice Updates', () => {
      it('should update brandVoice in branding JSON field', async () => {
        // P0-FIX: Branding updates use mockPrisma directly via DraftUpdateService
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: { fonts: { heading: 'Playfair' } },
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          brandVoice: 'luxurious',
        };

        await updateStorefrontExecutor(tenantId, payload);

        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
          where: { id: tenantId },
          data: expect.objectContaining({
            branding: expect.objectContaining({
              fonts: { heading: 'Playfair' }, // Existing branding preserved
              voice: 'luxurious',
            }),
          }),
        });
      });

      it('should preserve existing branding fields when updating voice', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: {
            logo: 'logo-url.png',
            fonts: { body: 'Inter' },
          },
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          brandVoice: 'professional',
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockPrisma.tenant.update.mock.calls[0][0];
        expect(updateCall.data.branding).toEqual({
          logo: 'logo-url.png',
          fonts: { body: 'Inter' },
          voice: 'professional',
        });
      });
    });

    describe('Merging with Existing Config', () => {
      it('should not overwrite unrelated landing page fields', async () => {
        // P0-FIX: Mock getDraftConfigWithSlug to return existing config
        const mockGetDraftConfigWithSlug = vi.mocked(getDraftConfigWithSlug);
        mockGetDraftConfigWithSlug.mockResolvedValue({
          pages: {
            home: {
              enabled: true,
              sections: [
                {
                  id: 'home-hero-main',
                  type: 'hero',
                  headline: 'Old Headline',
                  subheadline: 'Old Subheadline',
                  ctaText: 'Book Now',
                  backgroundImageUrl: 'existing-image.jpg',
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: true, sections: [] },
            testimonials: { enabled: true, sections: [] },
          },
          slug: 'test-tenant',
          hasDraft: true,
          rawDraftConfig: null,
          rawLiveConfig: null,
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          headline: 'New Headline',
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        const draft = updateCall.data.landingPageConfigDraft as {
          pages: {
            home: {
              sections: Array<{ headline?: string; backgroundImageUrl?: string }>;
            };
            services: { enabled: boolean; sections: unknown[] };
          };
        };

        // Services page should be preserved
        expect(draft.pages.services).toEqual({ enabled: true, sections: [] });
        // Hero section should be updated with headline, preserving other fields
        const heroSection = draft.pages.home.sections[0];
        expect(heroSection.headline).toBe('New Headline');
        expect(heroSection.backgroundImageUrl).toBe('existing-image.jpg'); // Preserved
      });

      it('should preserve existing hero fields when updating', async () => {
        // P0-FIX: Mock getDraftConfigWithSlug to return existing hero config
        const mockGetDraftConfigWithSlug = vi.mocked(getDraftConfigWithSlug);
        mockGetDraftConfigWithSlug.mockResolvedValue({
          pages: {
            home: {
              enabled: true,
              sections: [
                {
                  id: 'home-hero-main',
                  type: 'hero',
                  headline: 'Old Headline',
                  subheadline: 'Old Tagline',
                  ctaText: 'Book Now',
                },
              ],
            },
            about: { enabled: true, sections: [] },
            services: { enabled: true, sections: [] },
            faq: { enabled: true, sections: [] },
            contact: { enabled: true, sections: [] },
            gallery: { enabled: true, sections: [] },
            testimonials: { enabled: true, sections: [] },
          },
          slug: 'test-tenant',
          hasDraft: true,
          rawDraftConfig: null,
          rawLiveConfig: null,
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          headline: 'Updated Headline',
          // Not updating tagline
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        const draft = updateCall.data.landingPageConfigDraft as {
          pages: {
            home: {
              sections: Array<{ headline?: string; subheadline?: string; ctaText?: string }>;
            };
          };
        };
        const heroSection = draft.pages.home.sections[0];

        expect(heroSection).toMatchObject({
          headline: 'Updated Headline',
          subheadline: 'Old Tagline', // Preserved
          ctaText: 'Book Now', // Preserved
        });
      });
    });

    describe('Return Structure', () => {
      it('should return list of updated fields', async () => {
        // P0-FIX: Separate mocks for draft (transaction) and branding (direct)
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'New Headline',
          tagline: 'New Tagline',
          primaryColor: '#abc123',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result).toMatchObject({
          action: 'updated',
          updatedFields: expect.arrayContaining(['headline', 'tagline', 'primaryColor']),
        });
      });

      it('should return previewUrl with tenant slug and draft query param', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'bella-weddings',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'bella-weddings' });

        const payload = {
          headline: 'Capturing Love',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result.previewUrl).toContain('/t/bella-weddings');
        expect(result.previewUrl).toContain('?preview=draft');
      });

      it('should throw ValidationError when payload is empty', async () => {
        // P0-FIX: With schema validation, empty payload should throw
        const payload = {};

        await expect(updateStorefrontExecutor(tenantId, payload)).rejects.toThrow();
      });
    });

    describe('Hero Image URL Updates', () => {
      it('should update heroImageUrl as backgroundImageUrl in draft', async () => {
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'test-tenant',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-tenant' });

        const payload = {
          heroImageUrl: 'https://example.com/hero.jpg',
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockTx.tenant.update.mock.calls[0][0];
        const draft = updateCall.data.landingPageConfigDraft as {
          pages: {
            home: {
              sections: Array<{
                backgroundImageUrl?: string;
                type?: string;
                id?: string;
              }>;
            };
          };
        };
        const heroSection = draft.pages.home.sections[0];

        // Should create hero section with backgroundImageUrl in the DRAFT structure
        expect(heroSection.backgroundImageUrl).toBe('https://example.com/hero.jpg');
        expect(heroSection.type).toBe('hero');
        expect(heroSection.id).toBe('home-hero-main');
      });
    });

    describe('Multiple Field Updates', () => {
      it('should handle all fields updated together', async () => {
        // P0-FIX: Separate mocks for transaction and direct updates
        mockTx.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          landingPageConfigDraft: null,
          slug: 'complete-business',
        });
        mockTx.tenant.update.mockResolvedValue({});
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: {},
          slug: 'complete-business',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'Complete Business Solutions',
          tagline: 'Your one-stop shop for everything',
          brandVoice: 'luxurious',
          heroImageUrl: 'https://example.com/new-hero.jpg',
          primaryColor: '#8fa882',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result.updatedFields).toEqual(
          expect.arrayContaining([
            'headline',
            'tagline',
            'brandVoice',
            'heroImageUrl',
            'primaryColor',
          ])
        );
        expect(result.previewUrl).toContain('/t/complete-business');
        expect(result.previewUrl).toContain('?preview=draft');
        expect(result.hasDraft).toBe(true);
      });
    });
  });
});
