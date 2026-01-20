/**
 * Unit tests for Internal Agent Bootstrap Endpoint
 *
 * Tests the /v1/internal/agent/bootstrap endpoint which provides
 * session context for the Concierge agent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { createInternalAgentRoutes } from '../../src/routes/internal-agent.routes';
import type { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import type { AdvisorMemoryService } from '../../src/agent/onboarding/advisor-memory.service';

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

  const mockOnboardingContext = {
    tenantId: 'tenant-123',
    currentPhase: 'NOT_STARTED' as const,
    memory: null,
    summaries: {
      discovery: '',
      marketContext: '',
      preferences: '',
      decisions: '',
      pendingQuestions: "Let's get started!",
    },
    isReturning: false,
    lastActiveAt: null,
  };

  // Mock dependencies
  let mockTenantRepo: Partial<PrismaTenantRepository>;
  let mockAdvisorMemoryService: Partial<AdvisorMemoryService>;
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockTenantRepo = {
      findById: vi.fn().mockResolvedValue(mockTenant),
      update: vi.fn().mockResolvedValue(mockTenant),
    };

    mockAdvisorMemoryService = {
      getOnboardingContext: vi.fn().mockResolvedValue(mockOnboardingContext),
    };

    // Create app with routes
    app = express();
    app.use(express.json());
    app.use(
      '/v1/internal/agent',
      createInternalAgentRoutes({
        internalApiSecret: INTERNAL_SECRET,
        catalogService: {} as any,
        bookingService: {} as any,
        tenantRepo: mockTenantRepo as PrismaTenantRepository,
        advisorMemoryService: mockAdvisorMemoryService as AdvisorMemoryService,
      })
    );
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

    it('should include discovery data from advisor memory', async () => {
      const mockMemoryWithDiscovery = {
        ...mockOnboardingContext,
        memory: {
          tenantId: 'tenant-123',
          currentPhase: 'DISCOVERY' as const,
          lastEventVersion: 1,
          lastEventTimestamp: new Date().toISOString(),
          discoveryData: {
            businessType: 'wedding photographer',
            businessName: 'Jane Photo',
            location: { city: 'Austin', state: 'TX' },
            targetMarket: 'luxury',
            yearsInBusiness: 5,
            servicesOffered: ['weddings', 'portraits'],
          },
        },
      };
      mockAdvisorMemoryService.getOnboardingContext = vi
        .fn()
        .mockResolvedValue(mockMemoryWithDiscovery);

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

    it('should merge discovery facts from branding', async () => {
      mockTenantRepo.findById = vi.fn().mockResolvedValue({
        ...mockTenant,
        branding: {
          discoveryFacts: {
            businessType: 'life coach',
            yearsInBusiness: 3,
          },
        },
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

    it('should work without advisor memory service (graceful degradation)', async () => {
      // Create app without advisor memory service
      const appNoMemory = express();
      appNoMemory.use(express.json());
      appNoMemory.use(
        '/v1/internal/agent',
        createInternalAgentRoutes({
          internalApiSecret: INTERNAL_SECRET,
          catalogService: {} as any,
          bookingService: {} as any,
          tenantRepo: mockTenantRepo as PrismaTenantRepository,
          // No advisorMemoryService
        })
      );

      const response = await request(appNoMemory)
        .post('/v1/internal/agent/bootstrap')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ tenantId: 'tenant-123' });

      expect(response.status).toBe(200);
      expect(response.body.discoveryData).toBeNull();
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
  });
});
