/**
 * HTTP Integration Tests for Tenant Admin Scheduling Endpoints
 * Tests availability rule CRUD operations
 *
 * Test Coverage:
 * - Create availability rule
 * - Update availability rule (TODO-056 fix)
 * - Delete availability rule
 * - Authentication (JWT token required)
 * - Tenant isolation
 * - Service validation
 * - Partial updates
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../../src/generated/prisma';
import { createApp } from '../../src/app';
import { buildContainer } from '../../src/di';

describe('Tenant Admin Scheduling - Availability Rules', () => {
  let app: Express;
  let prisma: PrismaClient;
  let testTenantId: string;
  let testTenantSlug: string;
  let anotherTenantId: string;
  let validToken: string;
  let anotherTenantToken: string;
  let testServiceId: string;
  let testRuleId: string;
  const JWT_SECRET = 'test-jwt-secret-for-scheduling';

  beforeAll(async () => {
    // Setup database with test tenants
    prisma = new PrismaClient();

    // Create test tenant
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'scheduling-test-tenant' },
      update: {
        email: 'admin@schedulingtest.com',
        passwordHash: 'hashed-password',
        isActive: true,
      },
      create: {
        slug: 'scheduling-test-tenant',
        name: 'Scheduling Test Tenant',
        apiKeyPublic: 'pk_test_scheduling',
        apiKeySecret: 'sk_test_scheduling_hash',
        email: 'admin@schedulingtest.com',
        passwordHash: 'hashed-password',
        isActive: true,
      },
    });
    testTenantId = tenant.id;
    testTenantSlug = tenant.slug;

    // Create another tenant for isolation tests
    const anotherTenant = await prisma.tenant.upsert({
      where: { slug: 'scheduling-another-tenant' },
      update: {
        email: 'admin@schedulinganother.com',
        isActive: true,
      },
      create: {
        slug: 'scheduling-another-tenant',
        name: 'Another Test Tenant',
        apiKeyPublic: 'pk_test_another_sched',
        apiKeySecret: 'sk_test_another_sched_hash',
        email: 'admin@schedulinganother.com',
        passwordHash: 'hashed-password',
        isActive: true,
      },
    });
    anotherTenantId = anotherTenant.id;

    // Create a test service for the first tenant
    const service = await prisma.service.create({
      data: {
        tenantId: testTenantId,
        slug: 'test-service',
        name: 'Test Service',
        description: 'A test scheduling service',
        durationMinutes: 60,
        bufferMinutes: 0,
        priceCents: 5000,
        timezone: 'America/New_York',
        active: true,
        sortOrder: 0,
      },
    });
    testServiceId = service.id;

    // Generate valid JWT tokens for both tenants
    validToken = jwt.sign(
      {
        tenantId: testTenantId,
        slug: testTenantSlug,
        email: 'admin@schedulingtest.com',
        type: 'tenant',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    anotherTenantToken = jwt.sign(
      {
        tenantId: anotherTenantId,
        slug: 'scheduling-another-tenant',
        email: 'admin@schedulinganother.com',
        type: 'tenant',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Initialize app with test config
    // Pass through env vars for real mode, include connection pool defaults
    const config = {
      NODE_ENV: 'test',
      PORT: 3001,
      JWT_SECRET,
      ADAPTERS_PRESET: process.env.ADAPTERS_PRESET || 'mock',
      DATABASE_URL: process.env.DATABASE_URL!,
      DATABASE_CONNECTION_LIMIT: 1,
      DATABASE_POOL_TIMEOUT: 10,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    };

    const container = buildContainer(config);
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await prisma.availabilityRule.deleteMany({
      where: {
        tenantId: { in: [testTenantId, anotherTenantId] },
      },
    });

    await prisma.service.deleteMany({
      where: {
        tenantId: { in: [testTenantId, anotherTenantId] },
      },
    });

    await prisma.tenant.deleteMany({
      where: {
        slug: { in: ['scheduling-test-tenant', 'scheduling-another-tenant'] },
      },
    });

    await prisma.$disconnect();
  });

  describe('POST /v1/tenant-admin/availability-rules', () => {
    it('should create availability rule with valid data', async () => {
      const response = await request(app)
        .post('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          serviceId: testServiceId,
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          effectiveFrom: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        serviceId: testServiceId,
        tenantId: testTenantId,
      });

      // Save for update tests
      testRuleId = response.body.id;
    });

    it('should reject without authentication', async () => {
      const response = await request(app).post('/v1/tenant-admin/availability-rules').send({
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '17:00',
      });

      expect(response.status).toBe(401);
    });

    it('should validate invalid time format', async () => {
      const response = await request(app)
        .post('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          dayOfWeek: 1,
          startTime: '25:00', // Invalid hour
          endTime: '17:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate day of week range', async () => {
      const response = await request(app)
        .post('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          dayOfWeek: 7, // Invalid (0-6 only)
          startTime: '09:00',
          endTime: '17:00',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /v1/tenant-admin/availability-rules/:id (TODO-056 fix)', () => {
    it('should update availability rule with valid data', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          startTime: '10:00', // Change from 09:00 to 10:00
          endTime: '18:00', // Change from 17:00 to 18:00
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testRuleId,
        startTime: '10:00',
        endTime: '18:00',
        dayOfWeek: 1, // Should preserve unchanged fields
        tenantId: testTenantId,
      });
    });

    it('should support partial updates', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          dayOfWeek: 2, // Only change day of week
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testRuleId,
        dayOfWeek: 2,
        startTime: '10:00', // Should preserve previous update
        endTime: '18:00',
      });
    });

    it('should preserve rule ID on update', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          startTime: '11:00',
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testRuleId);
    });

    it('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .send({
          startTime: '10:00',
        });

      expect(response.status).toBe(401);
    });

    it('should reject cross-tenant update', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${anotherTenantToken}`)
        .send({
          startTime: '10:00',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await request(app)
        .put('/v1/tenant-admin/availability-rules/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          startTime: '10:00',
        });

      expect(response.status).toBe(404);
    });

    it('should validate invalid time format on update', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          startTime: 'invalid-time',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate day of week range on update', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          dayOfWeek: 10, // Invalid
        });

      expect(response.status).toBe(400);
    });

    it('should update effectiveFrom and effectiveTo dates', async () => {
      const newEffectiveFrom = new Date('2025-01-01T00:00:00Z').toISOString();
      const newEffectiveTo = new Date('2025-12-31T23:59:59Z').toISOString();

      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          effectiveFrom: newEffectiveFrom,
          effectiveTo: newEffectiveTo,
        });

      expect(response.status).toBe(200);
      expect(response.body.effectiveFrom).toBe(newEffectiveFrom);
      expect(response.body.effectiveTo).toBe(newEffectiveTo);
    });

    it('should allow clearing effectiveTo to make rule indefinite', async () => {
      const response = await request(app)
        .put(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          effectiveTo: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.effectiveTo).toBeNull();
    });
  });

  describe('GET /v1/tenant-admin/availability-rules', () => {
    it('should list all rules for authenticated tenant', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('dayOfWeek');
    });

    it('should filter by serviceId', async () => {
      const response = await request(app)
        .get(`/v1/tenant-admin/availability-rules?serviceId=${testServiceId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((rule: any) => {
        expect(rule.serviceId).toBe(testServiceId);
      });
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${anotherTenantToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should not see rules from testTenantId
      response.body.forEach((rule: any) => {
        expect(rule.tenantId).not.toBe(testTenantId);
      });
    });
  });

  describe('DELETE /v1/tenant-admin/availability-rules/:id', () => {
    it('should delete availability rule', async () => {
      const response = await request(app)
        .delete(`/v1/tenant-admin/availability-rules/${testRuleId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get('/v1/tenant-admin/availability-rules')
        .set('Authorization', `Bearer ${validToken}`);

      const deletedRule = getResponse.body.find((r: any) => r.id === testRuleId);
      expect(deletedRule).toBeUndefined();
    });

    it('should reject delete without authentication', async () => {
      const response = await request(app).delete(
        `/v1/tenant-admin/availability-rules/${testRuleId}`
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await request(app)
        .delete('/v1/tenant-admin/availability-rules/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
    });
  });
});
