/**
 * Unit tests for DraftUpdateService
 *
 * Verifies that the service:
 * - Writes to landingPageConfigDraft (NOT landingPageConfig)
 * - Uses advisory locks for TOCTOU prevention
 * - Returns correct hasDraft flag for cache invalidation
 * - Preserves existing hero section fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftUpdateService } from '../../../src/agent/services/draft-update.service';

// Mock the logger
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock advisory locks
vi.mock('../../../src/lib/advisory-locks', () => ({
  hashTenantStorefront: vi.fn().mockReturnValue(123456789),
}));

// Mock getDraftConfigWithSlug
vi.mock('../../../src/agent/tools/utils', () => ({
  getDraftConfigWithSlug: vi.fn(),
}));

import { getDraftConfigWithSlug } from '../../../src/agent/tools/utils';

// Type-safe mock function type
type MockFn = ReturnType<typeof vi.fn>;

// Mock Prisma client type
interface MockPrismaClient {
  tenant: {
    findUnique: MockFn;
    update: MockFn;
  };
  $transaction: MockFn;
  $executeRaw: MockFn;
}

describe('DraftUpdateService', () => {
  let service: DraftUpdateService;
  let mockPrisma: MockPrismaClient;
  let mockTx: MockPrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock transaction context
    mockTx = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(null),
    };

    // Setup mock Prisma client
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      // Transaction callback receives mockTx
      $transaction: vi.fn(
        async <T>(
          callback: (tx: MockPrismaClient) => Promise<T>,
          _options?: unknown
        ): Promise<T> => {
          return callback(mockTx);
        }
      ),
      $executeRaw: vi.fn().mockResolvedValue(null),
    };

    // Type assertion for service construction
    service = new DraftUpdateService(
      mockPrisma as unknown as Parameters<
        typeof DraftUpdateService.prototype.updateHeroSection
      >[0] extends infer T
        ? T extends string
          ? never
          : Parameters<
                (typeof DraftUpdateService)['prototype']['updateHeroSection']
              >[0] extends infer U
            ? { tenant: MockPrismaClient['tenant']; $transaction: MockPrismaClient['$transaction'] }
            : never
        : never
    );
  });

  describe('updateHeroSection', () => {
    it('should write to landingPageConfigDraft, NOT landingPageConfig', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      // Create service with proper typing
      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      await typedService.updateHeroSection('tenant-1', { headline: 'New Headline' });

      // Assert - CRITICAL: Verify we're writing to DRAFT, not LIVE
      expect(mockTx.tenant.update).toHaveBeenCalledTimes(1);
      const updateCall = mockTx.tenant.update.mock.calls[0][0];

      expect(updateCall.data).toHaveProperty('landingPageConfigDraft');
      expect(updateCall.data).not.toHaveProperty('landingPageConfig');
    });

    it('should acquire advisory lock before reading draft', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      await typedService.updateHeroSection('tenant-1', { headline: 'Test' });

      // Assert - Verify advisory lock was acquired
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('should return hasDraft: true for frontend cache invalidation', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateHeroSection('tenant-1', { headline: 'Test' });

      // Assert
      expect(result.hasDraft).toBe(true);
    });

    it('should include preview URL with ?preview=draft suffix', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateHeroSection('tenant-1', { headline: 'Test' });

      // Assert
      expect(result.previewUrl).toBe('/t/test-tenant?preview=draft');
    });

    it('should update existing hero section fields', async () => {
      // Arrange
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

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      await typedService.updateHeroSection('tenant-1', { headline: 'New Headline' });

      // Assert - Verify hero section preserves other fields
      const updateCall = mockTx.tenant.update.mock.calls[0][0];
      const draft = updateCall.data.landingPageConfigDraft as {
        pages: {
          home: {
            sections: Array<{
              headline?: string;
              subheadline?: string;
              ctaText?: string;
              backgroundImageUrl?: string;
            }>;
          };
        };
      };
      const heroSection = draft.pages.home.sections[0];

      expect(heroSection.headline).toBe('New Headline');
      expect(heroSection.subheadline).toBe('Old Tagline'); // Preserved
      expect(heroSection.ctaText).toBe('Book Now'); // Preserved
      expect(heroSection.backgroundImageUrl).toBe('existing-image.jpg'); // Preserved
    });

    it('should create hero section if it does not exist', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateHeroSection('tenant-1', {
        headline: 'New Headline',
        tagline: 'New Tagline',
      });

      // Assert
      expect(result.action).toBe('created');
      const updateCall = mockTx.tenant.update.mock.calls[0][0];
      const draft = updateCall.data.landingPageConfigDraft as {
        pages: {
          home: {
            sections: Array<{
              id?: string;
              type?: string;
              headline?: string;
              subheadline?: string;
            }>;
          };
        };
      };
      const heroSection = draft.pages.home.sections[0];

      expect(heroSection.id).toBe('home-hero-main');
      expect(heroSection.type).toBe('hero');
      expect(heroSection.headline).toBe('New Headline');
      expect(heroSection.subheadline).toBe('New Tagline');
    });

    it('should track updated fields correctly', async () => {
      // Arrange
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
      mockTx.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateHeroSection('tenant-1', {
        headline: 'Headline',
        tagline: 'Tagline',
        heroImageUrl: 'https://example.com/image.jpg',
      });

      // Assert
      expect(result.updatedFields).toContain('headline');
      expect(result.updatedFields).toContain('tagline');
      expect(result.updatedFields).toContain('heroImageUrl');
      expect(result.updatedFields).toHaveLength(3);
    });
  });

  describe('updateBranding', () => {
    it('should update primaryColor on tenant directly', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        branding: {},
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateBranding('tenant-1', {
        primaryColor: '#1a365d',
      });

      // Assert
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: expect.objectContaining({
          primaryColor: '#1a365d',
        }),
      });
      expect(result.updatedFields).toContain('primaryColor');
    });

    it('should update brandVoice in branding JSON field', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue({
        branding: { fonts: { heading: 'Playfair' } },
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act
      const result = await typedService.updateBranding('tenant-1', {
        brandVoice: 'luxurious',
      });

      // Assert
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: expect.objectContaining({
          branding: expect.objectContaining({
            fonts: { heading: 'Playfair' }, // Existing branding preserved
            voice: 'luxurious',
          }),
        }),
      });
      expect(result.updatedFields).toContain('brandVoice');
    });

    it('should throw ResourceNotFoundError if tenant not found', async () => {
      // Arrange
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const typedService = new DraftUpdateService(
        mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
      );

      // Act & Assert
      await expect(
        typedService.updateBranding('nonexistent-tenant', { primaryColor: '#fff' })
      ).rejects.toThrow('tenant');
    });
  });
});
