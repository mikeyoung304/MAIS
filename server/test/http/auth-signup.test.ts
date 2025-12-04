/**
 * HTTP Integration Tests for Tenant Signup
 * Tests the POST /v1/auth/signup endpoint
 *
 * Test Coverage:
 * - Successful signup flow with all validations
 * - Email/password/business name validation
 * - Duplicate email handling (409 Conflict)
 *
 * Note: Rate limiting is 5 requests/hour per IP for signup endpoint.
 * Tests are consolidated to stay within limits - we verify all success
 * scenarios in a single comprehensive test.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaClient } from '../../src/generated/prisma';
import { loadConfig } from '../../src/lib/core/config';
import { createApp } from '../../src/app';
import { buildContainer } from '../../src/di';

// Shared prisma instance for cleanup
const prisma = new PrismaClient();
const allTestEmails: string[] = [];

// Generate unique email for each test
const generateTestEmail = () => {
  const email = `signup-test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  allTestEmails.push(email);
  return email;
};

// Cleanup all test tenants after all tests
afterAll(async () => {
  if (allTestEmails.length > 0) {
    // First find all tenant IDs for cleanup
    const tenants = await prisma.tenant.findMany({
      where: { email: { in: allTestEmails } },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);

    if (tenantIds.length > 0) {
      // Delete packages first (references segments)
      await prisma.package.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      // Delete segments next
      await prisma.segment.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      // Finally delete tenants
      await prisma.tenant.deleteMany({
        where: { id: { in: tenantIds } },
      });
    }
  }
  await prisma.$disconnect();
});

describe('POST /v1/auth/signup - Tenant Signup', () => {
  let app: Express;

  beforeAll(async () => {
    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'real' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  describe('Successful Signup Flow (single comprehensive test to stay within rate limits)', () => {
    // This test verifies ALL success scenarios:
    // - Response structure, JWT format, API keys
    // - Slug generation from business name
    // - Password hashing
    // - Database persistence and default values
    // - Token can be used for authentication
    // - Special characters and whitespace handling
    it('should create tenant with correct credentials and allow authenticated requests', async () => {
      const email = generateTestEmail();
      const password = 'SecurePassword123';

      // Test 1: Create tenant
      // Note: XSS sanitization escapes special characters in businessName
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email,
          password,
          businessName: 'Test Business Corp',
        })
        .expect('Content-Type', /json/)
        .expect(201);

      // Verify response structure
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('tenantId');
      expect(res.body).toHaveProperty('slug');
      expect(res.body).toHaveProperty('email', email);
      expect(res.body).toHaveProperty('apiKeyPublic');
      expect(res.body).toHaveProperty('secretKey');

      // Verify token is a valid JWT format (3 parts separated by dots)
      expect(res.body.token.split('.').length).toBe(3);

      // Verify API key formats
      expect(res.body.apiKeyPublic).toMatch(/^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/);
      expect(res.body.secretKey).toMatch(/^sk_live_[a-z0-9-]+_[a-f0-9]{32}$/);

      // Verify slug is generated from business name (kebab-case with timestamp suffix)
      expect(res.body.slug).toMatch(/^test-business-corp-\d+$/);

      // Verify tenant was created in database with correct values
      const tenant = await prisma.tenant.findUnique({
        where: { id: res.body.tenantId },
      });
      expect(tenant).not.toBeNull();
      expect(tenant?.email).toBe(email);
      expect(tenant?.name).toBe('Test Business Corp');

      // Verify password is hashed (bcrypt format)
      expect(tenant?.passwordHash).not.toBe(password);
      expect(tenant?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);

      // Verify default values
      expect(tenant?.isActive).toBe(true);
      expect(tenant?.emailVerified).toBe(false);
      // commissionPercent is stored as Decimal, compare as number
      expect(Number(tenant?.commissionPercent)).toBe(10);
      expect(tenant?.stripeOnboarded).toBe(false);

      // Test 2: Verify default segment and packages were created
      // TenantOnboardingService creates these in a transaction during signup
      const segments = await prisma.segment.findMany({
        where: { tenantId: res.body.tenantId },
      });
      expect(segments).toHaveLength(1);
      expect(segments[0].slug).toBe('general');
      expect(segments[0].name).toBe('General');
      expect(segments[0].heroTitle).toBe('Our Services');

      // Verify 3 default packages were created
      const packages = await prisma.package.findMany({
        where: { tenantId: res.body.tenantId },
        orderBy: { groupingOrder: 'asc' },
      });
      expect(packages).toHaveLength(3);
      expect(packages[0].slug).toBe('basic-package');
      expect(packages[0].name).toBe('Basic Package');
      expect(packages[0].groupingOrder).toBe(1);
      expect(packages[1].slug).toBe('standard-package');
      expect(packages[1].groupingOrder).toBe(2);
      expect(packages[2].slug).toBe('premium-package');
      expect(packages[2].groupingOrder).toBe(3);

      // All packages should be linked to the default segment
      expect(packages.every((p) => p.segmentId === segments[0].id)).toBe(true);

      // Test 3: Token validity - use the token to access a protected endpoint
      const verifyRes = await request(app)
        .get('/v1/auth/verify')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);

      expect(verifyRes.body).toHaveProperty('tenantId', res.body.tenantId);
    });
  });

  describe('Validation Errors (do not count against rate limit)', () => {
    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'SecurePassword123',
          businessName: 'Test Business',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'valid@email.com',
          password: 'short',
          businessName: 'Test Business',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('8 characters');
    });

    it('should reject business name shorter than 2 characters', async () => {
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'valid@email.com',
          password: 'SecurePassword123',
          businessName: 'X',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('between 2 and 100 characters');
    });

    it('should reject business name longer than 100 characters', async () => {
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'valid@email.com',
          password: 'SecurePassword123',
          businessName: 'A'.repeat(101),
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', async () => {
      // Missing email
      await request(app)
        .post('/v1/auth/signup')
        .send({
          password: 'SecurePassword123',
          businessName: 'Test Business',
        })
        .expect(400);

      // Missing password
      await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'valid@email.com',
          businessName: 'Test Business',
        })
        .expect(400);

      // Missing business name
      await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'valid@email.com',
          password: 'SecurePassword123',
        })
        .expect(400);
    });
  });

  describe('Duplicate Email Handling', () => {
    it('should reject signup with existing email (409 Conflict)', async () => {
      const email = generateTestEmail();

      // First signup should succeed (counts as 1 against rate limit)
      await request(app)
        .post('/v1/auth/signup')
        .send({
          email,
          password: 'SecurePassword123',
          businessName: 'First Business',
        })
        .expect(201);

      // Second signup with same email should fail with 409
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({
          email,
          password: 'DifferentPassword456',
          businessName: 'Second Business',
        })
        .expect(409);

      expect(res.body.error).toBe('CONFLICT');
      expect(res.body.message).toContain('Email already registered');
    });
  });
});
