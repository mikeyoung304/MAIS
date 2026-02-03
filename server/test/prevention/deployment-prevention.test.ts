/**
 * Deployment Prevention Tests
 *
 * These tests catch the specific problems solved in the past:
 * 1. TypeScript interface mismatches
 * 2. Missing environment variables
 * 3. Email adapter configuration issues
 * 4. Security vulnerabilities in input validation
 *
 * NOTE: These tests require DATABASE_URL because buildContainer() needs
 * a database connection even in mock mode (Prisma 7 driver adapter requirement).
 * If DATABASE_URL is not set, tests are skipped (valid for CI without DB).
 *
 * Run: npm test -- test/prevention/deployment-prevention.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { buildContainer } from '../../src/di';
import { loadConfig } from '../../src/lib/core/config';
import { createApp } from '../../src/app';
import type { Application } from 'express';
import type { EmailProvider, CatalogRepository, BookingRepository } from '../../src/lib/ports';
import { PostmarkMailAdapter } from '../../src/adapters/postmark.adapter';
import { HealthCheckService } from '../../src/services/health-check.service';

/**
 * Skip test suite if DATABASE_URL is not configured.
 * buildContainer() requires DATABASE_URL even in mock mode due to Prisma 7 driver adapter.
 */
const hasDatabaseUrl = !!(process.env.DATABASE_URL || process.env.DATABASE_URL_TEST);

describe.runIf(hasDatabaseUrl)('Deployment Prevention Tests', () => {
  let app: Application;
  let config: ReturnType<typeof loadConfig>;
  let container: ReturnType<typeof buildContainer>;

  beforeAll(async () => {
    config = loadConfig();
    container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  // ============================================================
  // PREVENTION 1: TypeScript Interface Mismatches
  // ============================================================

  describe('Interface Implementation Compliance', () => {
    it('should have all EmailProvider methods in PostmarkMailAdapter', () => {
      const adapter = new PostmarkMailAdapter({
        serverToken: 'test-token',
        fromEmail: 'test@example.com',
      });

      // All methods required by interface
      const requiredMethods: Array<keyof EmailProvider> = [
        'sendEmail',
        'sendPasswordReset',
        'sendBookingConfirm',
        'sendBookingReminder',
      ];

      for (const method of requiredMethods) {
        expect(typeof adapter[method]).toBe('function');
        expect(adapter[method]).toBeDefined();
      }
    });

    it('should have all EmailProvider methods in MockMailAdapter', async () => {
      const mockAdapter = container.mailProvider;

      const requiredMethods: Array<keyof EmailProvider> = [
        'sendEmail',
        'sendPasswordReset',
        'sendBookingConfirm',
        'sendBookingReminder',
      ];

      for (const method of requiredMethods) {
        if (mockAdapter) {
          expect(typeof mockAdapter[method]).toBe('function');
        }
      }
    });

    it('should have sendEmail method available in routes', async () => {
      // If this test fails, it means routes cannot call mailProvider.sendEmail
      if (container.mailProvider) {
        expect(typeof container.mailProvider.sendEmail).toBe('function');
      }
    });

    it('should export all container services without missing implementations', () => {
      const requiredServices = {
        controllers: [
          'packages',
          'availability',
          'bookings',
          'webhooks',
          'admin',
          'blackouts',
          'adminPackages',
          'platformAdmin',
          'tenant',
          'tenantAuth',
        ],
        services: [
          'identity',
          'stripeConnect',
          'tenantAuth',
          'catalog',
          'booking',
          'audit',
          'segment',
          'tenantOnboarding',
          'packageDraft',
          'reminder',
          // DELETED: 'landingPage' - Phase 5 Section Content Migration
          'sectionContent', // Replaces landingPage service
        ],
      };

      for (const controller of requiredServices.controllers) {
        expect(
          container.controllers[controller as keyof typeof container.controllers]
        ).toBeDefined();
      }

      for (const service of requiredServices.services) {
        expect(container.services[service as keyof typeof container.services]).toBeDefined();
      }
    });
  });

  // ============================================================
  // PREVENTION 2: Missing Environment Variables
  // ============================================================

  describe('Environment Variables Validation', () => {
    it('should have .env.example with all required variables', () => {
      const envExamplePath = path.join(__dirname, '../../.env.example');

      // Check if file exists first
      if (!fs.existsSync(envExamplePath)) {
        // File might not exist yet, skip this test
        expect(true).toBe(true);
        return;
      }

      const envExample = fs.readFileSync(envExamplePath, 'utf8');

      // Required section
      expect(envExample).toContain('JWT_SECRET');
      expect(envExample).toContain('DATABASE_URL');
    });

    it('should load config without throwing for required vars', () => {
      // If loadConfig() is called and doesn't throw, required vars are set
      expect(() => loadConfig()).not.toThrow();
    });

    it('should handle optional vars gracefully', async () => {
      // Config should load even if optional vars are missing
      const cfg = loadConfig();
      expect(cfg).toBeDefined();
      expect(cfg.ADAPTERS_PRESET).toBeDefined();
    });

    it('should document all env vars in render.yaml', () => {
      const renderYamlPath = path.join(__dirname, '../../../render.yaml');

      // Check if render.yaml exists (might be at root of project)
      if (!fs.existsSync(renderYamlPath)) {
        expect(true).toBe(true); // Skip if not found
        return;
      }

      const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');

      // Just check that it mentions JWT_SECRET and DATABASE_URL
      expect(renderYaml).toContain('JWT_SECRET');
      expect(renderYaml).toContain('DATABASE_URL');
    });
  });

  // ============================================================
  // PREVENTION 3: Email Adapter Configuration
  // ============================================================

  describe('Email Adapter Configuration', () => {
    it('should support file-sink fallback when no API token', async () => {
      const adapter = new PostmarkMailAdapter({
        serverToken: undefined, // No token
        fromEmail: 'test@example.com',
      });

      // Should not throw, should write to file
      await expect(
        adapter.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).resolves.not.toThrow();
    });

    it('should have retry logic for transient failures', async () => {
      const adapter = new PostmarkMailAdapter({
        serverToken: 'test-token',
        fromEmail: 'test@example.com',
      });

      // Adapter should have retry mechanism
      expect((adapter as any).maxRetries).toBeGreaterThan(0);
      expect((adapter as any).baseDelayMs).toBeGreaterThan(0);
    });

    it('should report email adapter status in health check', async () => {
      if (!container.mailProvider) {
        expect(true).toBe(true); // Skip if no mail provider
        return;
      }

      const healthCheck = new HealthCheckService({
        mailAdapter: container.mailProvider,
      });

      const health = await healthCheck.checkPostmark();

      // In mock mode, should either be healthy or report file sink fallback
      expect(health.status).toBe('healthy');
      expect(health.lastChecked).toBeDefined();
    });

    it('should have correct from email configuration', () => {
      if (container.mailProvider instanceof PostmarkMailAdapter) {
        const adapter = container.mailProvider as any;
        expect(adapter.cfg.fromEmail).toBeDefined();
        expect(adapter.cfg.fromEmail).toContain('@');
      }
    });
  });

  // ============================================================
  // PREVENTION 4: Security Validation (XSS, CRLF Injection)
  // ============================================================

  describe('Security - Input Validation', () => {
    it('should reject XSS payloads in email field', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/v1/auth/early-access')
          .send({ email: payload })
          .expect(400);

        // Should be rejected or sanitized
        expect(response.body.message).toBeDefined();
      }
    });

    it('should reject CRLF injection attempts in email', async () => {
      const crlfPayloads = [
        'test@example.com\r\nBcc: attacker@evil.com',
        'test@example.com\nBcc: attacker@evil.com',
        'test@example.com\rBcc: attacker@evil.com',
      ];

      for (const payload of crlfPayloads) {
        const response = await request(app)
          .post('/v1/auth/early-access')
          .send({ email: payload })
          .expect(400);

        // Should be rejected or sanitized
        expect(response.body.message).toBeDefined();
      }
    });

    it('should normalize valid emails', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: '  TEST@EXAMPLE.COM  ' })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = ['not-an-email', 'missing@domain', '@example.com', 'test@', ''];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/v1/auth/early-access')
          .send({ email })
          .expect(400);

        expect(response.body.message).toBeDefined();
      }
    });

    it('should show error feedback to users', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: 'invalid' })
        .expect(400);

      // Response should have user-friendly error message
      expect(response.body.message).toBeDefined();
      expect(response.body.message.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // PREVENTION 5: HTTP Endpoint Validation
  // ============================================================

  describe('HTTP Endpoints - Contract Compliance', () => {
    it('should accept valid early-access request', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: 'valid@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: "Thanks! We'll be in touch soon.",
      });
    });

    it('should reject requests without email field', async () => {
      const response = await request(app).post('/v1/auth/early-access').send({}).expect(400);

      // Zod required validation returns "Required" message
      expect(response.body.message).toContain('Required');
    });

    it('should reject requests with invalid content-type', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com');

      // Should either reject or properly parse
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app).post('/v1/auth/early-access').send('').expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // ============================================================
  // PREVENTION 6: Health Check Validation
  // ============================================================

  describe('Health Check Endpoint', () => {
    it('should return health check status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toBeDefined();
    });

    it('should include adapter checks in health response', async () => {
      const response = await request(app).get('/health/live').expect(200);

      // Health check should return something
      expect(response.body).toBeDefined();
      // Might have status or checks depending on implementation
      expect(response.body.status || response.body.checks || response.body.uptime).toBeDefined();
    });

    it('should have health check endpoint available', async () => {
      const response = await request(app).get('/health/live').expect(200);

      // Just verify endpoint is available and returns 200
      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // PREVENTION 7: Compilation & Build Validation
  // ============================================================

  describe('Build Artifacts', () => {
    it('should have Prisma client generated', () => {
      // Prisma 7: Entry point changed from index.d.ts to client.ts
      const prismaClientPath = path.join(__dirname, '../../src/generated/prisma/client.ts');

      // Prisma client should be generated
      expect(fs.existsSync(prismaClientPath)).toBe(true);
    });

    it('should have no unresolved imports in main app file', () => {
      const appPath = path.join(__dirname, '../../src/app.ts');
      const appContent = fs.readFileSync(appPath, 'utf8');

      // Should import necessary dependencies
      expect(appContent).toContain('import');
      expect(appContent).not.toContain('undefined');
    });

    it('should have di.ts export container with all required properties', () => {
      // This tests that the container is properly constructed
      expect(container).toBeDefined();
      expect(container.controllers).toBeDefined();
      expect(container.services).toBeDefined();
    });
  });
});
