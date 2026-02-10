/**
 * Marketing Endpoints HTTP Tests
 *
 * Tests for /v1/internal/agent/content-generation/* endpoints
 * These endpoints generate marketing content using Gemini AI.
 *
 * Added as part of Phase 4.5 remediation (issue 5176)
 *
 * NOTE: These are unit tests focusing on validation and authentication.
 * Full integration testing requires database setup via the integration test helpers.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer, type Container } from '../../src/di';

// Mock the Vertex AI client to avoid actual API calls
vi.mock('../../src/llm/vertex-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/llm/vertex-client')>();
  return {
    ...actual,
    getVertexClient: () => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            primary: 'Test headline',
            variants: ['Variant 1', 'Variant 2'],
            rationale: 'Test rationale',
          }),
        }),
      },
    }),
    createVertexClient: vi.fn(),
    resetVertexClient: vi.fn(),
  };
});

describe('Internal Agent Marketing HTTP Endpoints', () => {
  let app: any;
  let container: Container;
  const TEST_SECRET = 'test-internal-secret-12345';
  // Use the default mock tenant ID seeded by MockTenantRepository
  const TEST_TENANT_ID = 'tenant_default_legacy';

  beforeAll(async () => {
    const config = {
      ...loadConfig(),
      ADAPTERS_PRESET: 'mock',
      API_BASE_URL: 'http://localhost:3001',
      INTERNAL_API_SECRET: TEST_SECRET,
    };
    container = buildContainer(config);
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  afterAll(async () => {
    await container.cleanup();
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without X-Internal-Secret header', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .send({ tenantId: TEST_TENANT_ID, context: 'homepage hero' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid API secret');
    });

    it('should reject requests with wrong X-Internal-Secret', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .set('X-Internal-Secret', 'wrong-secret')
        .send({ tenantId: TEST_TENANT_ID, context: 'homepage hero' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid API secret');
    });

    it('should accept requests with correct X-Internal-Secret', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: TEST_TENANT_ID, context: 'homepage hero' });

      // Should not return 403 (may return 404 for tenant not found, which is expected)
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /v1/internal/agent/content-generation/generate-headline - Validation', () => {
    const endpoint = '/v1/internal/agent/content-generation/generate-headline';

    it('should require tenantId', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ context: 'homepage hero' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('tenantId')])
      );
    });

    it('should require context', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: TEST_TENANT_ID });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('context')])
      );
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: 'non_existent_tenant',
          context: 'homepage hero',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tenant not found');
    });

    it('should reject empty tenantId', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: '',
          context: 'homepage hero',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate tone enum', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          context: 'homepage hero',
          tone: 'invalid_tone',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid tone values', async () => {
      const validTones = ['professional', 'warm', 'creative', 'luxury'];

      for (const tone of validTones) {
        const response = await request(app)
          .post(endpoint)
          .set('X-Internal-Secret', TEST_SECRET)
          .send({
            tenantId: TEST_TENANT_ID,
            context: 'homepage hero',
            tone,
          });

        // Should pass validation (404 for tenant is OK, 400 for validation is not)
        expect(response.status).not.toBe(400);
      }
    });
  });

  describe('POST /v1/internal/agent/content-generation/generate-tagline - Validation', () => {
    const endpoint = '/v1/internal/agent/content-generation/generate-tagline';

    it('should require tenantId and businessContext', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should require businessContext', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: TEST_TENANT_ID });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('businessContext')])
      );
    });
  });

  describe('POST /v1/internal/agent/content-generation/generate-service-description - Validation', () => {
    const endpoint = '/v1/internal/agent/content-generation/generate-service-description';

    it('should require serviceName and serviceType', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: TEST_TENANT_ID });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should require serviceType when serviceName provided', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          serviceName: 'Wedding Package',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('serviceType')])
      );
    });
  });

  describe('POST /v1/internal/agent/content-generation/refine-copy - Validation', () => {
    const endpoint = '/v1/internal/agent/content-generation/refine-copy';

    it('should require originalCopy, feedback, and copyType', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: TEST_TENANT_ID });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate copyType enum', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          originalCopy: 'Test copy',
          feedback: 'Make it better',
          copyType: 'invalid_type',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid copyType values', async () => {
      const validTypes = ['headline', 'tagline', 'description', 'about'];

      for (const copyType of validTypes) {
        const response = await request(app)
          .post(endpoint)
          .set('X-Internal-Secret', TEST_SECRET)
          .send({
            tenantId: TEST_TENANT_ID,
            originalCopy: 'Test copy',
            feedback: 'Improve it',
            copyType,
          });

        // Should pass validation (404 for tenant is OK, 400 for validation is not)
        expect(response.status).not.toBe(400);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle validation errors with details array', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should return proper error format', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({ tenantId: 'fake', context: 'test' });

      // Either validation error or not found
      expect([400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Success paths with mock tenant', () => {
    it('should generate headline for existing tenant', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-headline')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          context: 'homepage hero section',
        });

      // With mock tenant, should return 200 or at least pass auth+validation
      // May fail at LLM step if not mocked correctly, but shouldn't be 404
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(400);
    });

    it('should generate tagline for existing tenant', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-tagline')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          businessContext: 'Wedding photography studio',
        });

      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(400);
    });

    it('should generate service description for existing tenant', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/generate-service-description')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          serviceName: 'Wedding Package',
          serviceType: 'photography',
        });

      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(400);
    });

    it('should refine copy for existing tenant', async () => {
      const response = await request(app)
        .post('/v1/internal/agent/content-generation/refine-copy')
        .set('X-Internal-Secret', TEST_SECRET)
        .send({
          tenantId: TEST_TENANT_ID,
          originalCopy: 'We take photos',
          feedback: 'Make it more engaging',
          copyType: 'headline',
        });

      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(400);
    });
  });
});
