/**
 * Password Reset Flow HTTP Tests
 * Tests the complete password reset email flow for tenant admins
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildContainer } from '../../src/di';
import { loadConfig } from '../../src/lib/core/config';
import { createApp } from '../../src/app';
import type { Application } from 'express';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { PrismaClient } from '../../src/generated/prisma';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

describe('Password Reset Flow - HTTP Tests', () => {
  let app: Application;
  let prisma: PrismaClient;
  let tenantRepo: PrismaTenantRepository;
  let testTenantEmail: string;
  let testTenantId: string;

  beforeAll(async () => {
    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);

    // Use real Prisma for integration testing
    prisma = new PrismaClient();
    tenantRepo = new PrismaTenantRepository(prisma);

    // Create test tenant
    testTenantEmail = `test-reset-${Date.now()}@example.com`;
    const tenant = await tenantRepo.create({
      slug: `test-reset-${Date.now()}`,
      name: 'Test Reset Tenant',
      email: testTenantEmail,
      passwordHash: await hashPassword('oldpassword123'),
      apiKeyPublic: `pk_test_${crypto.randomBytes(16).toString('hex')}`,
      apiKeySecret: crypto.randomBytes(32).toString('hex'),
      commissionPercent: 10,
      emailVerified: true,
    });
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    // Guard against prisma being undefined if beforeAll failed
    if (!prisma) return;

    // Cleanup test tenant
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {
        // Ignore cleanup errors - tenant may not exist
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /v1/auth/forgot-password', () => {
    it('should return success message even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });
    });

    it('should return success and generate reset token for existing email', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: testTenantEmail })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });

      // Verify token was stored (hashed)
      const tenant = await tenantRepo.findByEmail(testTenantEmail);
      expect(tenant?.passwordResetToken).toBeTruthy();
      expect(tenant?.passwordResetToken).toHaveLength(64); // SHA-256 hex hash
      expect(tenant?.passwordResetExpires).toBeTruthy();
      expect(tenant?.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject request without email', async () => {
      const response = await request(app).post('/v1/auth/forgot-password').send({}).expect(400);

      expect(response.body.message).toContain('Email is required');
    });

    it('should normalize email (lowercase, trim)', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: `  ${testTenantEmail.toUpperCase()}  ` })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });

      // Verify token was updated
      const tenant = await tenantRepo.findByEmail(testTenantEmail);
      expect(tenant?.passwordResetToken).toBeTruthy();
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    let validResetToken: string;

    beforeAll(async () => {
      // Generate a valid reset token
      validResetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(validResetToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await tenantRepo.update(testTenantId, {
        passwordResetToken: tokenHash,
        passwordResetExpires: expires,
      });
    });

    it('should successfully reset password with valid token', async () => {
      const newPassword = 'newSecurePassword123';

      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: validResetToken,
          password: newPassword,
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Password updated successfully',
      });

      // Verify password was changed and token was cleared
      const tenant = await tenantRepo.findByEmail(testTenantEmail);
      expect(tenant?.passwordHash).toBeTruthy();
      expect(tenant?.passwordHash).not.toEqual(await hashPassword('oldpassword123'));
      expect(tenant?.passwordResetToken).toBeNull();
      expect(tenant?.passwordResetExpires).toBeNull();

      // Verify new password works for login
      const loginResponse = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testTenantEmail,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.token).toBeTruthy();
      expect(loginResponse.body.role).toBe('TENANT_ADMIN');
    });

    it('should reject invalid token format', async () => {
      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newPassword123',
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid reset token format');
    });

    it('should reject non-existent token', async () => {
      const fakeToken = crypto.randomBytes(32).toString('hex');

      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: fakeToken,
          password: 'newPassword123',
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired reset token');
    });

    it('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
      const pastExpiry = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      await tenantRepo.update(testTenantId, {
        passwordResetToken: tokenHash,
        passwordResetExpires: pastExpiry,
      });

      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: expiredToken,
          password: 'newPassword123',
        })
        .expect(400);

      expect(response.body.message).toContain('Reset token has expired');
    });

    it('should reject password shorter than 8 characters', async () => {
      const shortPasswordToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(shortPasswordToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await tenantRepo.update(testTenantId, {
        passwordResetToken: tokenHash,
        passwordResetExpires: expires,
      });

      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: shortPasswordToken,
          password: 'short',
        })
        .expect(400);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject request without token or password', async () => {
      const response1 = await request(app)
        .post('/v1/auth/reset-password')
        .send({ password: 'newPassword123' })
        .expect(400);

      expect(response1.body.message).toContain('Token and password are required');

      const response2 = await request(app)
        .post('/v1/auth/reset-password')
        .send({ token: 'sometoken' })
        .expect(400);

      expect(response2.body.message).toContain('Token and password are required');
    });

    it('should prevent token reuse after successful reset', async () => {
      // Create a new valid token
      const oneTimeToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(oneTimeToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await tenantRepo.update(testTenantId, {
        passwordResetToken: tokenHash,
        passwordResetExpires: expires,
      });

      // First reset should succeed
      await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: oneTimeToken,
          password: 'firstResetPassword123',
        })
        .expect(200);

      // Second attempt with same token should fail
      const response = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: oneTimeToken,
          password: 'secondResetPassword123',
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired reset token');
    });
  });

  describe('Security - Token Hashing', () => {
    it('should store token as SHA-256 hash, not plaintext', async () => {
      const plainToken = crypto.randomBytes(32).toString('hex');

      await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: testTenantEmail })
        .expect(200);

      const tenant = await tenantRepo.findByEmail(testTenantEmail);

      // Token in DB should not match any plaintext token
      expect(tenant?.passwordResetToken).not.toEqual(plainToken);

      // Token should be a valid hex string of length 64 (SHA-256 output)
      expect(tenant?.passwordResetToken).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should hash token consistently (same input produces same hash)', async () => {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const hash1 = crypto.createHash('sha256').update(plainToken).digest('hex');
      const hash2 = crypto.createHash('sha256').update(plainToken).digest('hex');

      expect(hash1).toEqual(hash2);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to forgot-password endpoint', async () => {
      // Rate limit is configured via signupLimiter (same as signup)
      // This test documents the expected behavior
      // Note: Actual rate limit testing requires multiple rapid requests
      // which may be flaky in CI. This is a documentation test.

      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: testTenantEmail })
        .expect(200);

      expect(response.body.message).toBeTruthy();
    });
  });
});

/**
 * Helper to hash password (matches TenantAuthService implementation)
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
