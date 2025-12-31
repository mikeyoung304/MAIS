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

// Mock the executor-registry to track registrations
const mockExecutors = new Map<string, any>();

vi.mock('../../../src/agent/proposals/executor-registry', () => ({
  registerProposalExecutor: vi.fn((name: string, executor: any) => {
    mockExecutors.set(name, executor);
  }),
  getProposalExecutor: vi.fn((name: string) => mockExecutors.get(name)),
}));

describe('Onboarding Executors', () => {
  let mockPrisma: any;
  let mockTx: any;

  beforeEach(() => {
    // Clear the mock executor registry
    mockExecutors.clear();

    // Setup mock transaction
    mockTx = {
      segment: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      package: {
        create: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    // Setup mock Prisma client
    mockPrisma = {
      segment: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      package: {
        create: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback: (tx: any) => Promise<any>) => callback(mockTx)),
    };

    // Register the executors
    registerOnboardingExecutors(mockPrisma);
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
    let upsertServicesExecutor: (tenantId: string, payload: any) => Promise<any>;

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

      it('should throw ValidationError when segment slug already exists', async () => {
        mockTx.segment.findFirst.mockResolvedValue({
          id: 'existing-segment-id',
          slug: 'photography-sessions',
        });

        const payload = {
          segmentName: 'Photography Sessions',
          segmentSlug: 'photography-sessions',
          packages: [{ name: 'Basic Package', priceCents: 5000, groupingOrder: 1 }],
        };

        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toThrow(ValidationError);
        await expect(upsertServicesExecutor(tenantId, payload)).rejects.toMatchObject({
          message: expect.stringContaining('already exists'),
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
    let updateStorefrontExecutor: (tenantId: string, payload: any) => Promise<any>;

    beforeEach(() => {
      updateStorefrontExecutor = getProposalExecutor('update_storefront')!;
    });

    describe('Headline and Tagline Updates', () => {
      it('should update headline in landingPageConfig', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'Capturing Your Moments',
        };

        await updateStorefrontExecutor(tenantId, payload);

        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
          where: { id: tenantId },
          data: expect.objectContaining({
            landingPageConfig: expect.objectContaining({
              hero: expect.objectContaining({
                headline: 'Capturing Your Moments',
              }),
            }),
          }),
        });
      });

      it('should update tagline as subheadline in hero section', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          tagline: "Professional photography for life's special moments",
        };

        await updateStorefrontExecutor(tenantId, payload);

        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
          where: { id: tenantId },
          data: expect.objectContaining({
            landingPageConfig: expect.objectContaining({
              hero: expect.objectContaining({
                subheadline: "Professional photography for life's special moments",
              }),
            }),
          }),
        });
      });
    });

    describe('primaryColor Updates', () => {
      it('should update primaryColor on tenant directly', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          primaryColor: '#1a365d',
        };

        await updateStorefrontExecutor(tenantId, payload);

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
        mockPrisma.tenant.findUnique.mockResolvedValue({
          branding: { fonts: { heading: 'Playfair' } },
          landingPageConfig: {},
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
          landingPageConfig: {},
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
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {
            services: { enabled: true },
            testimonials: [{ text: 'Great!' }],
            hero: {
              backgroundImageUrl: 'existing-image.jpg',
            },
          },
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'New Headline',
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockPrisma.tenant.update.mock.calls[0][0];
        const landingPageConfig = updateCall.data.landingPageConfig;

        expect(landingPageConfig).toMatchObject({
          services: { enabled: true },
          testimonials: [{ text: 'Great!' }],
          hero: expect.objectContaining({
            headline: 'New Headline',
            backgroundImageUrl: 'existing-image.jpg', // Preserved
          }),
        });
      });

      it('should preserve existing hero fields when updating', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {
            hero: {
              headline: 'Old Headline',
              subheadline: 'Old Tagline',
              buttonText: 'Book Now',
            },
          },
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'Updated Headline',
          // Not updating tagline
        };

        await updateStorefrontExecutor(tenantId, payload);

        const updateCall = mockPrisma.tenant.update.mock.calls[0][0];
        const hero = updateCall.data.landingPageConfig.hero;

        expect(hero).toEqual({
          headline: 'Updated Headline',
          subheadline: 'Old Tagline', // Preserved
          buttonText: 'Book Now', // Preserved
        });
      });
    });

    describe('Return Structure', () => {
      it('should return list of updated fields', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
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

      it('should return previewUrl with tenant slug', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          branding: {},
          slug: 'bella-weddings',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          headline: 'Capturing Love',
        };

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(result.previewUrl).toContain('/t/bella-weddings');
      });

      it('should not make update call when no fields to update', async () => {
        // If payload is empty, no updates should be made
        mockPrisma.tenant.findUnique.mockResolvedValue({
          slug: 'test-tenant',
        });

        const payload = {};

        const result = await updateStorefrontExecutor(tenantId, payload);

        expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
        expect(result.updatedFields).toHaveLength(0);
      });
    });

    describe('Hero Image URL Updates', () => {
      it('should update heroImageUrl as backgroundImageUrl', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
          branding: {},
          slug: 'test-tenant',
        });
        mockPrisma.tenant.update.mockResolvedValue({});

        const payload = {
          heroImageUrl: 'https://example.com/hero.jpg',
        };

        await updateStorefrontExecutor(tenantId, payload);

        expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
          where: { id: tenantId },
          data: expect.objectContaining({
            landingPageConfig: expect.objectContaining({
              hero: expect.objectContaining({
                backgroundImageUrl: 'https://example.com/hero.jpg',
              }),
            }),
          }),
        });
      });
    });

    describe('Multiple Field Updates', () => {
      it('should handle all fields updated together', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
          landingPageConfig: {},
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
      });
    });
  });
});
