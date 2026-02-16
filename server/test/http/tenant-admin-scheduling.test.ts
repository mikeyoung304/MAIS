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
import { createApp } from '../../src/app';
import { buildContainer } from '../../src/di';
import { getTestPrisma } from '../helpers/global-prisma';

describe('Tenant Admin Scheduling - Availability Rules', () => {
  let app: Express;
  // Use singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();
  let testTenantId: string;
  let testTenantSlug: string;
  let anotherTenantId: string;
  let validToken: string;
  let anotherTenantToken: string;
  let testServiceId: string;
  let testRuleId: string;
  const JWT_SECRET = 'test-jwt-secret-for-scheduling';

  beforeAll(async () => {
    // Setup database with test tenants (singleton already initialized)

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

    // Create a test service for the first tenant (use upsert to handle reruns)
    const service = await prisma.service.upsert({
      where: {
        tenantId_slug: {
          tenantId: testTenantId,
          slug: 'test-service',
        },
      },
      update: {},
      create: {
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
    // No-op: singleton handles its own lifecycle
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
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
      expect(response.body.message).toContain('not found');
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
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

  describe('GET /v1/tenant-admin/appointments (P1 #276 - Pagination)', () => {
    let appointmentIds: string[] = [];
    let testTierId: string;

    beforeAll(async () => {
      // Create a segment first (required for tiers)
      const segment = await prisma.segment.upsert({
        where: {
          tenantId_slug: {
            tenantId: testTenantId,
            slug: 'scheduling-test-segment',
          },
        },
        update: {},
        create: {
          tenantId: testTenantId,
          slug: 'scheduling-test-segment',
          name: 'Scheduling Test Segment',
          heroTitle: 'Test',
          sortOrder: 0,
          active: true,
        },
      });

      // Create a test tier (required for bookings)
      const tier = await prisma.tier.create({
        data: {
          tenantId: testTenantId,
          segmentId: segment.id,
          slug: 'test-appointment-tier',
          name: 'Test Appointment Tier',
          description: 'Tier for appointment testing',
          priceCents: 5000,
          active: true,
          sortOrder: 1,
          features: [],
        },
      });
      testTierId = tier.id;

      // Create a customer for appointments
      const customer = await prisma.customer.create({
        data: {
          tenantId: testTenantId,
          email: 'customer@appointmenttest.com',
          name: 'Appointment Test',
        },
      });

      // Create multiple appointments for pagination testing
      const appointmentPromises = [];
      for (let i = 0; i < 10; i++) {
        const appointmentDate = new Date('2025-06-01');
        appointmentDate.setDate(appointmentDate.getDate() + i);

        appointmentPromises.push(
          prisma.booking.create({
            data: {
              tenantId: testTenantId,
              customerId: customer.id,
              tierId: testTierId,
              serviceId: testServiceId,
              bookingType: 'TIMESLOT',
              status: 'CONFIRMED',
              date: appointmentDate,
              startTime: appointmentDate,
              endTime: new Date(appointmentDate.getTime() + 60 * 60 * 1000), // +1 hour
              totalPrice: 5000, // Match the service price
              notes: `Test appointment ${i + 1}`,
            },
          })
        );
      }

      const appointments = await Promise.all(appointmentPromises);
      appointmentIds = appointments.map((a) => a.id);
    });

    afterAll(async () => {
      // Cleanup appointments
      await prisma.booking.deleteMany({
        where: {
          id: { in: appointmentIds },
        },
      });

      // Cleanup customer
      await prisma.customer.deleteMany({
        where: {
          tenantId: testTenantId,
          email: 'customer@appointmenttest.com',
        },
      });

      // Cleanup tier and segment
      await prisma.tier.deleteMany({
        where: {
          id: testTierId,
        },
      });
      await prisma.segment.deleteMany({
        where: {
          tenantId: testTenantId,
          slug: 'scheduling-test-segment',
        },
      });
    });

    it('should apply default limit of 100 when not specified', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should return at most 100 results (we only created 10, so should see all)
      expect(response.body.length).toBeLessThanOrEqual(100);
    });

    it('should respect custom limit when provided', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?limit=5')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });

    it('should enforce maximum limit of 500', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?limit=1000')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should be capped at 500, but we only have 10 appointments
      expect(response.body.length).toBeLessThanOrEqual(500);
    });

    it('should support offset for pagination', async () => {
      const response1 = await request(app)
        .get('/v1/tenant-admin/appointments?limit=5&offset=0')
        .set('Authorization', `Bearer ${validToken}`);

      const response2 = await request(app)
        .get('/v1/tenant-admin/appointments?limit=5&offset=5')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Results should be different (if we have enough data)
      if (response1.body.length > 0 && response2.body.length > 0) {
        expect(response1.body[0].id).not.toBe(response2.body[0].id);
      }
    });

    it('should reject invalid limit parameter', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?limit=invalid')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid limit parameter');
    });

    it('should reject negative limit', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?limit=-10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid limit parameter');
    });

    it('should reject zero limit', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?limit=0')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid limit parameter');
    });

    it('should reject invalid offset parameter', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?offset=invalid')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid offset parameter');
    });

    it('should reject negative offset', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?offset=-5')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid offset parameter');
    });

    it('should accept offset of zero', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?offset=0')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?status=CONFIRMED')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((appt: any) => {
        expect(appt.status).toBe('CONFIRMED');
      });
    });

    it('should filter by serviceId', async () => {
      const response = await request(app)
        .get(`/v1/tenant-admin/appointments?serviceId=${testServiceId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((appt: any) => {
        expect(appt.serviceId).toBe(testServiceId);
      });
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?startDate=2025-06-01&endDate=2025-06-05')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Verify dates are within range
      response.body.forEach((appt: any) => {
        const apptDate = new Date(appt.date);
        expect(apptDate.getTime()).toBeGreaterThanOrEqual(new Date('2025-06-01').getTime());
        expect(apptDate.getTime()).toBeLessThanOrEqual(new Date('2025-06-05').getTime());
      });
    });

    it('should validate date format for startDate', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?startDate=invalid-date')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid startDate format');
    });

    it('should validate date format for endDate', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?endDate=2025/06/01')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid endDate format');
    });

    it('should enforce 90-day maximum date range', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments?startDate=2025-01-01&endDate=2025-12-31')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Date range cannot exceed 90 days');
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get('/v1/tenant-admin/appointments')
        .set('Authorization', `Bearer ${anotherTenantToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should not see appointments from testTenantId
      response.body.forEach((appt: any) => {
        expect(appt.tenantId).not.toBe(testTenantId);
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/v1/tenant-admin/appointments');

      expect(response.status).toBe(401);
    });
  });
});
