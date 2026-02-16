/**
 * Unit tests for Internal Agent Storefront & Booking Endpoints
 *
 * Tests the storefront management and booking endpoints used by
 * the Concierge and Storefront agents.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createInternalAgentRoutes } from '../../src/routes/internal-agent.routes';
import type { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import type { CatalogService } from '../../src/services/catalog.service';
import type { BookingService } from '../../src/services/booking.service';
import type { SectionContentService } from '../../src/services/section-content.service';

// Mock logger to prevent console output
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Internal Agent Storefront & Booking Endpoints', () => {
  const INTERNAL_SECRET = 'test-secret-123';

  // Mock tenant (Phase 5.2: landingPageConfig columns removed)
  // All storefront content now stored in SectionContent table via SectionContentService
  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Business',
    slug: 'test-business',
    tier: 'FREE' as const,
    onboardingPhase: 'NOT_STARTED' as const,
    branding: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Phase 5.2: mockTenantWithDraft removed - use SectionContentService mocks instead
  // Storefront state (hasDraft, hasPublished) now comes from SectionContentService

  // Mock dependencies
  let mockTenantRepo: Partial<PrismaTenantRepository>;
  let mockCatalogService: Partial<CatalogService>;
  let mockBookingService: Partial<BookingService>;
  let mockSectionContentService: Partial<SectionContentService>;
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTenantRepo = {
      findById: vi.fn().mockResolvedValue(mockTenant),
      update: vi.fn().mockResolvedValue(mockTenant),
      // Phase 5.2: publishLandingPageDraft and discardLandingPageDraft removed
      // These operations now go through SectionContentService
    };

    mockCatalogService = {
      getAllTiers: vi
        .fn()
        .mockResolvedValue([
          { id: 'pkg-1', title: 'Wedding Package', priceCents: 250000, active: true },
        ]),
      getTierById: vi.fn().mockResolvedValue({
        id: 'pkg-1',
        slug: 'wedding-package',
        title: 'Wedding Package',
        priceCents: 250000,
      }),
      getTierBySlug: vi.fn().mockResolvedValue({
        id: 'pkg-1',
        slug: 'wedding-package',
        title: 'Wedding Package',
        priceCents: 250000,
        addOns: [],
      }),
    };

    mockBookingService = {
      createDateBooking: vi.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay_123',
      }),
    };

    // Mock SectionContentService (Phase 5.2: Single source of truth for storefront)
    mockSectionContentService = {
      // Structure and content methods
      getPageStructure: vi.fn().mockResolvedValue({
        pages: [
          {
            name: 'home',
            sections: [
              {
                sectionId: 'home-hero-1',
                blockType: 'HERO',
                type: 'hero',
                page: 'home',
                index: 0,
                headline: 'Welcome',
                isPlaceholder: false,
                isDraft: true,
                isPublished: false,
                hasUnpublishedChanges: true,
              },
              {
                sectionId: 'home-text-2',
                blockType: 'TEXT',
                type: 'text',
                page: 'home',
                index: 1,
                headline: '[Add your story]',
                isPlaceholder: true,
                isDraft: true,
                isPublished: false,
                hasUnpublishedChanges: true,
              },
            ],
          },
        ],
        hasDraft: true,
      }),
      addSection: vi.fn().mockResolvedValue({
        success: true,
        sectionId: 'new-section-123',
        blockType: 'TEXT',
        type: 'text',
        page: 'home',
        index: 2,
        section: { headline: 'New Section' },
        isDraft: true,
        isPublished: false,
        hasDraft: true, // Phase 5.2: Route returns hasDraft from service result
      }),
      updateSection: vi.fn().mockResolvedValue({
        success: true,
        sectionId: 'section-123',
        blockType: 'HERO',
        type: 'hero',
        page: 'home',
        section: { headline: 'Updated headline' },
        index: 0,
        isDraft: true,
        isPublished: false,
        hasUnpublishedChanges: true,
        visibility: 'draft' as const,
        hasDraft: true,
      }),
      reorderSection: vi.fn().mockResolvedValue({
        success: true,
        hasDraft: true,
        visibility: 'draft' as const,
        message: 'Section reordered.',
        sectionId: 'home-text-2',
        newIndex: 0,
      }),
      publishSection: vi
        .fn()
        .mockImplementation(
          (_tenantId: string, sectionId: string, confirmationReceived: boolean) => {
            // Return T3 confirmation prompt if not confirmed
            if (!confirmationReceived) {
              return Promise.resolve({
                success: false,
                hasDraft: true,
                visibility: 'draft' as const,
                message: 'Publish this section? This will make changes visible to customers.',
                requiresConfirmation: true,
                sectionId,
              });
            }
            // Return success if confirmed
            return Promise.resolve({
              success: true,
              hasDraft: false,
              visibility: 'live' as const,
              message: 'Section published! Changes are now live.',
              sectionId,
              blockType: 'HERO',
              publishedAt: new Date().toISOString(),
              dashboardAction: { type: 'SHOW_PREVIEW', sectionId },
            });
          }
        ),
      getSectionContent: vi.fn().mockResolvedValue({
        success: true,
        sectionId: 'section-123',
        blockType: 'HERO',
        type: 'hero', // Phase 5.2: renamed from sectionType
        page: 'home', // Phase 5.2: renamed from pageName
        section: { headline: 'Test' }, // Phase 5.2: renamed from content
        index: 0, // Phase 5.2: renamed from order
        isDraft: true,
        isPublished: false,
        hasUnpublishedChanges: true,
        canUndo: false,
        undoSteps: 0,
        publishedAt: null,
        lastModified: new Date().toISOString(),
      }),
      removeSection: vi.fn().mockResolvedValue({
        success: true,
        hasDraft: false,
        visibility: 'draft' as const,
        message: 'Section removed.',
        removedSectionId: 'section-123',
      }),
      hasDraft: vi.fn().mockResolvedValue(false),
      // Phase 5: publishAll/discardAll for bulk operations
      publishAll: vi.fn().mockImplementation((_tenantId: string, confirmationReceived: boolean) => {
        if (!confirmationReceived) {
          return Promise.resolve({
            success: false,
            hasDraft: true,
            visibility: 'draft' as const,
            message: 'Publish all changes? This will make all drafts visible to customers.',
            requiresConfirmation: true,
          });
        }
        return Promise.resolve({
          success: true,
          hasDraft: false,
          visibility: 'live' as const,
          message: 'Published 2 section(s)! All changes are now live.',
          publishedCount: 2,
          publishedAt: new Date().toISOString(),
          dashboardAction: { type: 'REFRESH' },
        });
      }),
      discardAll: vi.fn().mockImplementation((_tenantId: string, confirmationReceived: boolean) => {
        if (!confirmationReceived) {
          return Promise.resolve({
            success: false,
            hasDraft: true,
            visibility: 'draft' as const,
            message: 'Discard all changes? This will revert to the last published version.',
            requiresConfirmation: true,
          });
        }
        return Promise.resolve({
          success: true,
          hasDraft: false,
          visibility: 'live' as const,
          message: 'Discarded 2 draft(s). Reverted to published version.',
          discardedCount: 2,
          dashboardAction: { type: 'REFRESH' },
        });
      }),
    };

    app = express();
    app.use(express.json());
    app.use(
      '/v1/internal/agent',
      createInternalAgentRoutes({
        internalApiSecret: INTERNAL_SECRET,
        catalogService: mockCatalogService as CatalogService,
        bookingService: mockBookingService as BookingService,
        tenantRepo: mockTenantRepo as PrismaTenantRepository,
        sectionContentService: mockSectionContentService as SectionContentService,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // STOREFRONT ENDPOINTS
  // ==========================================================================

  describe('POST /storefront/structure', () => {
    it('should return page structure with sections', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/structure')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.sections).toBeDefined();
      expect(response.body.hasDraft).toBe(true);
      expect(response.body.sections.length).toBeGreaterThan(0);
    });

    it('should filter sections by page name', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/structure')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', pageName: 'home' });

      expect(response.status).toBe(200);
      expect(response.body.sections.every((s: { page: string }) => s.page === 'home')).toBe(true);
    });

    it('should filter to only placeholders when requested', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/structure')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', includeOnlyPlaceholders: true });

      expect(response.status).toBe(200);
      expect(
        response.body.sections.every((s: { hasPlaceholder: boolean }) => s.hasPlaceholder)
      ).toBe(true);
    });

    it('should use default config for new tenants', async () => {
      // No existing config
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });

      const response = await request(app)
        .post('/v1/internal/agent/storefront/structure')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.sections).toBeDefined();
      // Should have sections from default config
      expect(response.body.sections.length).toBeGreaterThan(0);
    });
  });

  describe('POST /storefront/section', () => {
    it('should return section content by ID', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', sectionId: 'home-hero-1' });

      expect(response.status).toBe(200);
      expect(response.body.section).toBeDefined();
      // Phase 5.2: section is the content object, type is returned via the mock's section field
      expect(response.body.section.headline).toBe('Test');
      expect(response.body.page).toBe('home');
    });

    it('should return 404 for missing section', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);
      // Mock service to return null for nonexistent section
      mockSectionContentService.getSectionContent = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', sectionId: 'nonexistent-section' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /storefront/update-section', () => {
    it('should update section and save to draft', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/update-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'home-hero-1',
          headline: 'New Headline',
          subheadline: 'New Subheadline',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasDraft).toBe(true);
      // Phase 5.2: Route delegates to SectionContentService, not tenant repo
      expect(mockSectionContentService.updateSection).toHaveBeenCalled();
    });

    it('should return 404 for missing section', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);
      // Mock service to return failure for nonexistent section
      mockSectionContentService.updateSection = vi.fn().mockResolvedValue({
        success: false,
        error: 'Section not found',
      });

      const response = await request(app)
        .post('/v1/internal/agent/storefront/update-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'nonexistent',
          headline: 'Test',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /storefront/add-section', () => {
    it('should add a new section to draft', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/add-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          pageName: 'home',
          sectionType: 'testimonials',
          headline: 'What Clients Say',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sectionId).toBeDefined();
      expect(response.body.hasDraft).toBe(true);
    });
  });

  describe('POST /storefront/remove-section', () => {
    it('should remove a section from draft', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/remove-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', sectionId: 'home-text-2' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sectionId).toBe('home-text-2');
      expect(response.body.hasDraft).toBe(false); // Phase 5.2: Route returns hasDraft from service
    });

    it('should return 404 for missing section', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);
      // Mock service to return failure for nonexistent section
      mockSectionContentService.removeSection = vi.fn().mockResolvedValue({
        success: false,
        message: 'Section not found',
      });

      const response = await request(app)
        .post('/v1/internal/agent/storefront/remove-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', sectionId: 'nonexistent' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /storefront/reorder-sections', () => {
    it('should move section to new position', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/reorder-sections')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', sectionId: 'home-text-2', toPosition: 0 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasDraft).toBe(true);
    });
  });

  // Phase 5.2: POST /storefront/toggle-page tests removed
  // Single-page UX model - no multi-page toggle needed
  // Endpoint was deleted from internal-agent.routes.ts

  describe('POST /storefront/update-branding', () => {
    it('should update branding colors', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/update-branding')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          primaryColor: '#336699',
          fontFamily: 'Serif',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toContain('primaryColor');
      expect(mockTenantRepo.update).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          branding: expect.objectContaining({
            primaryColor: '#336699',
            fontFamily: 'Serif',
          }),
        })
      );
    });
  });

  describe('POST /storefront/preview', () => {
    it('should return preview URLs', async () => {
      // Phase 5.2: hasDraft now comes from SectionContentService
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);
      mockSectionContentService.hasDraft = vi.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/preview')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.hasDraft).toBe(true);
      expect(response.body.previewUrl).toContain('preview=draft');
      expect(response.body.liveUrl).toBeDefined();
    });
  });

  describe('POST /storefront/publish (T3 Action)', () => {
    it('should publish all draft sections to live', async () => {
      // Phase 5: Route now delegates to SectionContentService.publishAll()
      mockTenantRepo.findById = vi.fn().mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', confirmationReceived: true }); // T3 pattern requires explicit confirmation

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('published');
      expect(response.body.publishedCount).toBe(2);
      expect(response.body.hasDraft).toBe(false);
      // Phase 5: Now uses SectionContentService instead of tenant repository
      expect(mockSectionContentService.publishAll).toHaveBeenCalledWith('tenant-123', true);
    });

    it('should return success with 0 count when no drafts exist', async () => {
      // Service returns success with count=0 when no drafts
      mockSectionContentService.publishAll = vi.fn().mockResolvedValue({
        success: true,
        hasDraft: false,
        visibility: 'live' as const,
        message: 'No drafts to publish. Everything is already live.',
        publishedCount: 0,
      });

      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', confirmationReceived: true }); // T3 pattern requires explicit confirmation

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.publishedCount).toBe(0);
    });
  });

  describe('POST /storefront/discard (T3 Action)', () => {
    it('should discard all draft sections', async () => {
      // Phase 5: Route now delegates to SectionContentService.discardAll()
      const response = await request(app)
        .post('/v1/internal/agent/storefront/discard')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', confirmationReceived: true }); // T3 pattern requires explicit confirmation

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('discarded');
      expect(response.body.discardedCount).toBe(2);
      expect(response.body.hasDraft).toBe(false);
      // Phase 5: Now uses SectionContentService instead of tenant repository
      expect(mockSectionContentService.discardAll).toHaveBeenCalledWith('tenant-123', true);
    });

    it('should return success with 0 count when no drafts exist', async () => {
      // Service returns success with count=0 when no drafts
      mockSectionContentService.discardAll = vi.fn().mockResolvedValue({
        success: true,
        hasDraft: false,
        visibility: 'live' as const,
        message: 'No drafts to discard.',
        discardedCount: 0,
      });

      const response = await request(app)
        .post('/v1/internal/agent/storefront/discard')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', confirmationReceived: true }); // T3 pattern requires explicit confirmation

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.discardedCount).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION-LEVEL PUBLISH/DISCARD ENDPOINTS (Phase 3: Section Content Migration)
  // ==========================================================================

  describe('POST /storefront/publish-section (T3 Action)', () => {
    it('should require confirmation when confirmationReceived is false', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'section-123',
          confirmationReceived: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresConfirmation).toBe(true);
      expect(response.body.sectionId).toBe('section-123');
      expect(response.body.message).toBeDefined();
    });

    it('should publish section when confirmation received', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'section-123',
          confirmationReceived: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.visibility).toBe('live');
      expect(mockSectionContentService.publishSection).toHaveBeenCalledWith(
        'tenant-123',
        'section-123',
        true
      );
    });

    it('should return validation error for missing sectionId', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/publish-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          confirmationReceived: true,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /storefront/discard-section (T3 Action)', () => {
    it('should require confirmation when confirmationReceived is false', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/discard-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'section-123',
          confirmationReceived: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresConfirmation).toBe(true);
      expect(response.body.sectionId).toBe('section-123');
      expect(response.body.message).toContain('Discard');
    });

    it('should discard section when confirmation received', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/storefront/discard-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'section-123',
          confirmationReceived: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.visibility).toBe('live');
      expect(response.body.sectionId).toBe('section-123');
      expect(mockSectionContentService.getSectionContent).toHaveBeenCalledWith(
        'tenant-123',
        'section-123'
      );
      expect(mockSectionContentService.removeSection).toHaveBeenCalledWith(
        'tenant-123',
        'section-123'
      );
    });

    it('should return 404 when section not found', async () => {
      mockSectionContentService.getSectionContent = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/storefront/discard-section')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          sectionId: 'nonexistent',
          confirmationReceived: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Section not found');
    });
  });

  // ==========================================================================
  // BOOKING ENDPOINTS
  // ==========================================================================

  describe('POST /create-booking (T3 Critical Action)', () => {
    it('should create booking with checkout URL', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/create-booking')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          serviceId: 'pkg-1',
          customerName: 'John Smith',
          customerEmail: 'john@example.com',
          customerPhone: '555-1234',
          scheduledAt: '2024-06-15T14:00:00Z',
          notes: 'Looking forward to it!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.checkoutUrl).toContain('stripe.com');
      expect(response.body.booking).toMatchObject({
        serviceName: 'Wedding Package',
        customerName: 'John Smith',
        customerEmail: 'john@example.com',
      });

      expect(mockBookingService.createDateBooking).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          tierId: 'pkg-1',
          date: '2024-06-15',
          customerName: 'John Smith',
          customerEmail: 'john@example.com',
        })
      );
    });

    it('should return 404 for missing service', async () => {
      mockCatalogService.getTierById = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/create-booking')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          serviceId: 'nonexistent',
          customerName: 'John Smith',
          customerEmail: 'john@example.com',
          scheduledAt: '2024-06-15T14:00:00Z',
        });

      expect(response.status).toBe(404);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/create-booking')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          serviceId: 'pkg-1',
          customerName: 'John Smith',
          customerEmail: 'invalid-email',
          scheduledAt: '2024-06-15T14:00:00Z',
        });

      expect(response.status).toBe(400);
    });

    it('should require all mandatory fields', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/create-booking')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // AVAILABILITY ENDPOINT
  // ==========================================================================

  describe('POST /availability', () => {
    it('should return DATE-based availability by default', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/availability')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          serviceId: 'pkg-1',
          startDate: '2024-06-01',
          endDate: '2024-06-07',
        });

      expect(response.status).toBe(200);
      expect(response.body.bookingType).toBe('DATE');
      expect(response.body.dates).toBeDefined();
      expect(response.body.dates.length).toBe(7);
    });
  });
});
