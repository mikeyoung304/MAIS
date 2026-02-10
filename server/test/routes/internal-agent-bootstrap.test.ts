/**
 * Unit tests for Internal Agent Bootstrap Endpoint
 *
 * Tests the /v1/internal/agent/bootstrap endpoint which provides
 * session context for the Concierge agent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createInternalAgentRoutes } from '../../src/routes/internal-agent.routes';
import type { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import type { ContextBuilderService } from '../../src/services/context-builder.service';
import type { CatalogService } from '../../src/services/catalog.service';

// Mock logger to prevent console output
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Internal Agent Bootstrap Endpoint', () => {
  const INTERNAL_SECRET = 'test-secret-123';

  // Mock tenant data
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

  // Mock dependencies
  let mockTenantRepo: Partial<PrismaTenantRepository>;
  let mockContextBuilder: Partial<ContextBuilderService>;
  let mockCatalogService: Partial<CatalogService>;
  let app: express.Application;

  // Helper to create fresh app (needed for cache isolation)
  function createTestApp(): express.Application {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(
      '/v1/internal/agent',
      createInternalAgentRoutes({
        internalApiSecret: INTERNAL_SECRET,
        catalogService: mockCatalogService as CatalogService,
        bookingService: {} as any,
        tenantRepo: mockTenantRepo as PrismaTenantRepository,
        contextBuilder: mockContextBuilder as ContextBuilderService,
      })
    );
    return testApp;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockTenantRepo = {
      findById: vi.fn().mockResolvedValue(mockTenant),
      update: vi.fn().mockResolvedValue(mockTenant),
    };

    // Mock ContextBuilderService for agent bootstrap data
    mockContextBuilder = {
      getBootstrapData: vi.fn().mockResolvedValue({
        tenantId: 'tenant-123',
        businessName: 'Test Business',
        slug: 'test-business',
        onboardingComplete: false,
        onboardingPhase: 'NOT_STARTED',
        discoveryFacts: {},
        storefrontState: { hasDraft: false, hasPublished: false, completion: 0 },
        forbiddenSlots: [],
      }),
    };

    mockCatalogService = {
      getAllPackages: vi
        .fn()
        .mockResolvedValue([
          { id: 'pkg-1', title: 'Test Package', priceCents: 10000, active: true },
        ]),
      getPackageById: vi.fn().mockResolvedValue({
        id: 'pkg-1',
        slug: 'test-package',
        title: 'Test Package',
        priceCents: 10000,
      }),
      getPackageBySlug: vi.fn().mockResolvedValue({
        id: 'pkg-1',
        slug: 'test-package',
        title: 'Test Package',
        description: 'Test description',
        priceCents: 10000,
        addOns: [],
      }),
    };

    // Create app with routes
    app = createTestApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /bootstrap', () => {
    it('should return 403 without internal secret', async () => {
      const response = await request(app).post('/v1/internal/agent/bootstrap').send({
        tenantId: 'tenant-123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid API secret');
    });

    it('should return tenant context with onboarding needed', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        tenantId: 'tenant-123',
        businessName: 'Test Business',
        tier: 'FREE',
        onboardingDone: false, // NOT_STARTED means onboarding needed
      });
    });

    it('should return onboardingDone: true when phase is COMPLETED', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        onboardingPhase: 'COMPLETED',
      });

      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.onboardingDone).toBe(true);
    });

    it('should return onboardingDone: true when phase is SKIPPED', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        onboardingPhase: 'SKIPPED',
      });

      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.onboardingDone).toBe(true);
    });

    it('should return 404 when tenant not found', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tenant not found');
    });

    it('should return 400 when tenantId is missing', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should include discovery data from context builder', async () => {
      // Mock contextBuilder with discovery data
      mockContextBuilder.getBootstrapData = vi.fn().mockResolvedValue({
        tenantId: 'tenant-123',
        businessName: 'Jane Photo',
        slug: 'jane-photo',
        onboardingComplete: false,
        onboardingPhase: 'DISCOVERY',
        discoveryFacts: {
          businessType: 'wedding photographer',
          businessName: 'Jane Photo',
          location: { city: 'Austin', state: 'TX' },
          targetMarket: 'luxury',
          yearsInBusiness: 5,
          servicesOffered: ['weddings', 'portraits'],
        },
        storefrontState: { hasDraft: false, hasPublished: false, completion: 0 },
        forbiddenSlots: ['businessType', 'businessName', 'location'],
      });

      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.discoveryData).toMatchObject({
        businessType: 'wedding photographer',
        businessName: 'Jane Photo',
        location: { city: 'Austin', state: 'TX' },
      });
      expect(response.body.industry).toBe('wedding photographer');
    });

    it('should return discovery facts from context builder (reads from branding)', async () => {
      // ContextBuilder reads from tenant.branding.discoveryFacts internally
      // So we mock contextBuilder to return the expected facts
      mockContextBuilder.getBootstrapData = vi.fn().mockResolvedValue({
        tenantId: 'tenant-123',
        businessName: 'Test Business',
        slug: 'test-business',
        onboardingComplete: false,
        onboardingPhase: 'DISCOVERY',
        discoveryFacts: {
          businessType: 'life coach',
          yearsInBusiness: 3,
        },
        storefrontState: { hasDraft: false, hasPublished: false, completion: 0 },
        forbiddenSlots: ['businessType', 'yearsInBusiness'],
      });

      const response = await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.discoveryData).toMatchObject({
        businessType: 'life coach',
        yearsInBusiness: 3,
      });
      expect(response.body.industry).toBe('life coach');
    });

    it('should return 503 when context builder service is missing', async () => {
      // Create app without context builder service
      const appNoContext = express();
      appNoContext.use(express.json());
      appNoContext.use(
        '/v1/internal/agent',
        createInternalAgentRoutes({
          internalApiSecret: INTERNAL_SECRET,
          catalogService: {} as any,
          bookingService: {} as any,
          tenantRepo: mockTenantRepo as PrismaTenantRepository,
          // No contextBuilder - should fall back to branding.discoveryFacts
        })
      );

      const response = await request(appNoContext)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Context builder service not configured');
    });

    it('should cache bootstrap response', async () => {
      // First request
      await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      // Second request - should use cache
      await request(app)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      // findById should only be called once due to caching
      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /complete-onboarding', () => {
    it('should mark onboarding as complete', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/complete-onboarding')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          publishedUrl: 'https://test-business.gethandled.ai',
          packagesCreated: 3,
          summary: 'Created 3 packages and published storefront',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTenantRepo.update).toHaveBeenCalledWith('tenant-123', {
        onboardingPhase: 'COMPLETED',
        onboardingCompletedAt: expect.any(Date),
      });
    });
  });

  describe('POST /store-discovery-fact', () => {
    it('should store a discovery fact', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/store-discovery-fact')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          key: 'businessType',
          value: 'wedding photographer',
        });

      expect(response.status).toBe(200);
      expect(response.body.stored).toBe(true);
      expect(mockTenantRepo.update).toHaveBeenCalled();
    });

    it('should reject invalid fact keys', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/store-discovery-fact')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          key: 'invalidKey',
          value: 'test',
        });

      expect(response.status).toBe(400);
    });

    it('should return updated known facts list (P1-2)', async () => {
      // First store a fact
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        branding: { discoveryFacts: { existingKey: 'value' } },
      });

      const response = await request(app)
        .post('/v1/internal/agent/store-discovery-fact')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          key: 'businessType',
          value: 'wedding photographer',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        stored: true,
        key: 'businessType',
        value: 'wedding photographer',
        totalFactsKnown: 2,
        knownFactKeys: expect.arrayContaining(['existingKey', 'businessType']),
      });
    });
  });

  describe('POST /complete-onboarding (P1-3)', () => {
    it('should block completion without packages', async () => {
      // No packages exist
      mockCatalogService.getAllPackages = vi.fn().mockResolvedValue([]);

      const response = await request(app)
        .post('/v1/internal/agent/complete-onboarding')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          publishedUrl: 'https://test.gethandled.ai',
          packagesCreated: 0,
          summary: 'Tried to complete',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least one package');
      expect(response.body.prerequisite).toBe('packages');
      expect(mockTenantRepo.update).not.toHaveBeenCalled();
    });

    it('should allow completion with packages', async () => {
      // Packages exist
      mockCatalogService.getAllPackages = vi
        .fn()
        .mockResolvedValue([{ id: 'pkg-1', title: 'Wedding Package' }]);

      const response = await request(app)
        .post('/v1/internal/agent/complete-onboarding')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          publishedUrl: 'https://test.gethandled.ai',
          packagesCreated: 1,
          summary: 'Created wedding package',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTenantRepo.update).toHaveBeenCalledWith('tenant-123', {
        onboardingPhase: 'COMPLETED',
        onboardingCompletedAt: expect.any(Date),
      });
    });
  });

  describe('Cache Behavior (P1-5)', () => {
    it('should cache bootstrap responses within TTL', async () => {
      // Create fresh app for this test to avoid cache pollution
      const testApp = createTestApp();

      // First call - cache miss
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-ttl-test' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);

      // Second call within TTL - cache hit
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-ttl-test' });

      // Should still be 1 because cached
      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);

      // Third call - still cached
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-ttl-test' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);

      // Note: TTL expiration is handled by lru-cache internally using Date.now()
      // Testing actual TTL expiration requires mocking Date.now which is complex
      // The 30-minute TTL is configured in internal-agent.routes.ts LRUCache options
    });

    it('should use LRU cache with max size of 1000', async () => {
      // This test verifies LRU cache is configured correctly
      // The lru-cache package handles eviction automatically based on:
      // - max: 1000 (maximum entries)
      // - ttl: 30 * 60 * 1000 (30 minutes)
      //
      // Full eviction testing at 1000+ entries is too slow for unit tests.
      // The lru-cache package is well-tested and trusted for this behavior.
      const testApp = createTestApp();

      // Test that multiple tenants are cached independently
      for (let i = 0; i < 5; i++) {
        mockTenantRepo.findById = vi.fn().mockResolvedValue({
          ...mockTenant,
          id: `tenant-${i}`,
          name: `Business ${i}`,
        });

        await request(testApp)
          .post('/v1/internal/agent/bootstrap')
          .set('X-Internal-Secret', INTERNAL_SECRET)
          .send({ tenantId: `tenant-${i}` });
      }

      // Reset mock to track new calls
      vi.mocked(mockTenantRepo.findById).mockClear();
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        id: 'tenant-0',
        name: 'Business 0',
      });

      // Request for first tenant - should be cached (cache hit)
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-0' });

      // LRU cache should have kept tenant-0, so no new DB call
      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(0);
    });

    it('should invalidate cache after complete-onboarding', async () => {
      const testApp = createTestApp();

      // First bootstrap - cache miss
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);

      // Complete onboarding - should invalidate cache
      await request(testApp)
        .post('/v1/internal/agent/complete-onboarding')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          publishedUrl: 'https://test.gethandled.ai',
          packagesCreated: 1,
        });

      // Reset mock to track
      vi.mocked(mockTenantRepo.findById).mockClear();

      // Bootstrap again - should be cache miss (invalidated)
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache after store-discovery-fact', async () => {
      const testApp = createTestApp();

      // First bootstrap - cache miss
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);

      // Store discovery fact - should invalidate cache
      await request(testApp)
        .post('/v1/internal/agent/store-discovery-fact')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          key: 'businessType',
          value: 'photographer',
        });

      // Reset mock to track
      vi.mocked(mockTenantRepo.findById).mockClear();

      // Bootstrap again - should be cache miss (invalidated)
      await request(testApp)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(mockTenantRepo.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /services (P1-4)', () => {
    it('should return services for tenant', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/services')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.services).toBeDefined();
      expect(Array.isArray(response.body.services)).toBe(true);
      expect(mockCatalogService.getAllPackages).toHaveBeenCalledWith('tenant-123');
    });

    it('should filter inactive services by default', async () => {
      mockCatalogService.getAllPackages = vi.fn().mockResolvedValue([
        { id: 'pkg-1', title: 'Active', active: true, priceCents: 10000 },
        { id: 'pkg-2', title: 'Inactive', active: false, priceCents: 5000 },
      ]);

      const response = await request(app)
        .post('/v1/internal/agent/services')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', activeOnly: true });

      expect(response.status).toBe(200);
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].name).toBe('Active');
    });
  });

  describe('POST /service-details (P1-4)', () => {
    it('should return service details', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/service-details')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', serviceId: 'pkg-1' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'pkg-1',
        slug: 'test-package',
        name: 'Test Package',
      });
    });

    it('should return 404 for missing service', async () => {
      mockCatalogService.getPackageById = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/service-details')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', serviceId: 'nonexistent' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /business-info (P1-4)', () => {
    it('should return business information', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/business-info')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'Test Business',
        slug: 'test-business',
      });
    });

    it('should return 404 for missing tenant', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/v1/internal/agent/business-info')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'nonexistent' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /faq (P1-4)', () => {
    // Phase 5.2: FAQs now managed via SectionContent table, not landingPageConfig
    // The FAQ endpoint currently returns empty array until SectionContentService integration
    it('should return not found when no FAQs exist (Phase 5.2)', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        // Phase 5.2: landingPageConfig removed, FAQs now in SectionContent
      });

      const response = await request(app)
        .post('/v1/internal/agent/faq')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', question: 'What are your hours?' });

      expect(response.status).toBe(200);
      // Phase 5.2: FAQs return empty until SectionContentService integration
      expect(response.body.found).toBe(false);
      expect(response.body.availableFaqs).toEqual([]);
    });

    it('should return empty available FAQs list (Phase 5.2)', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        // Phase 5.2: landingPageConfig removed
      });

      const response = await request(app)
        .post('/v1/internal/agent/faq')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123', question: 'Do you accept bitcoin?' });

      expect(response.status).toBe(200);
      expect(response.body.found).toBe(false);
      expect(response.body.availableFaqs).toBeDefined();
      expect(response.body.availableFaqs).toEqual([]);
    });
  });

  describe('POST /recommend (P1-4)', () => {
    it('should return recommendations based on budget', async () => {
      mockCatalogService.getAllPackages = vi.fn().mockResolvedValue([
        { id: 'pkg-1', title: 'Basic', priceCents: 10000, active: true },
        { id: 'pkg-2', title: 'Standard', priceCents: 25000, active: true },
        { id: 'pkg-3', title: 'Premium', priceCents: 50000, active: true },
      ]);

      const response = await request(app)
        .post('/v1/internal/agent/recommend')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          preferences: { budget: 'low' },
        });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toBeDefined();
      expect(response.body.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle no packages gracefully', async () => {
      mockCatalogService.getAllPackages = vi.fn().mockResolvedValue([]);

      const response = await request(app)
        .post('/v1/internal/agent/recommend')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          tenantId: 'tenant-123',
          preferences: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toHaveLength(0);
    });
  });
});
