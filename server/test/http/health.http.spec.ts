/**
 * Health Check HTTP Tests
 *
 * Tests for /health endpoint with deep check functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer, type Container } from '../../src/di';

describe('Health Check HTTP Endpoints', () => {
  let app: any;
  let container: Container;

  beforeAll(() => {
    const config = {
      ...loadConfig(),
      ADAPTERS_PRESET: 'mock',
      API_BASE_URL: 'http://localhost:3001',
    };
    container = buildContainer(config);
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  afterAll(async () => {
    await container.cleanup();
  });

  describe('GET /health', () => {
    it('should return 200 with basic health check (backward compatible)', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it('should return deep health check when ?deep=true', async () => {
      const response = await request(app).get('/health?deep=true');

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('mode');

      // Verify checks structure
      expect(response.body.checks).toHaveProperty('stripe');
      expect(response.body.checks).toHaveProperty('postmark');
      expect(response.body.checks).toHaveProperty('googleCalendar');

      // Each check should have status and lastChecked
      expect(response.body.checks.stripe).toHaveProperty('status');
      expect(response.body.checks.stripe).toHaveProperty('lastChecked');
      expect(response.body.checks.postmark).toHaveProperty('status');
      expect(response.body.checks.postmark).toHaveProperty('lastChecked');
      expect(response.body.checks.googleCalendar).toHaveProperty('status');
      expect(response.body.checks.googleCalendar).toHaveProperty('lastChecked');
    });

    it('should return healthy status in mock mode', async () => {
      const response = await request(app).get('/health?deep=true');

      // Mock mode should report services as not configured
      expect(response.body.mode).toBe('mock');

      // All checks should be unhealthy (not configured) in mock mode
      expect(response.body.checks.stripe.status).toBe('unhealthy');
      expect(response.body.checks.stripe.error).toContain('not configured');

      expect(response.body.checks.postmark.status).toBe('unhealthy');
      expect(response.body.checks.postmark.error).toContain('not configured');

      expect(response.body.checks.googleCalendar.status).toBe('unhealthy');
      expect(response.body.checks.googleCalendar.error).toContain('not configured');

      // Overall status should be degraded
      expect(response.body.status).toBe('degraded');
      expect(response.status).toBe(503);
    });

    it('should cache deep check results', async () => {
      // First call
      const response1 = await request(app).get('/health?deep=true');
      const firstTimestamp = response1.body.checks.stripe.lastChecked;

      // Immediate second call
      const response2 = await request(app).get('/health?deep=true');
      const secondTimestamp = response2.body.checks.stripe.lastChecked;

      // Should use cached results (same timestamp)
      expect(firstTimestamp).toBe(secondTimestamp);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness probe response', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('service', 'handled-api');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness probe response', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('mode');
    });

    it('should always be ready in mock mode', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks.mode).toBe('mock');
    });
  });
});

// Custom matcher for vitest
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});
