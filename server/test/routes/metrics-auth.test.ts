/**
 * Unit tests for Metrics Authentication Middleware
 *
 * Tests bearer token authentication for /metrics endpoints.
 *
 * Note: We test the middleware behavior, not full integration with prom-client,
 * to avoid metric registration conflicts in the test runner.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock all external dependencies before importing the module
vi.mock('prom-client', () => ({
  register: {
    metrics: vi.fn().mockResolvedValue('# Mock metrics'),
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
  },
  collectDefaultMetrics: vi.fn(),
  Counter: vi.fn().mockImplementation(() => ({ inc: vi.fn() })),
  Gauge: vi.fn().mockImplementation(() => ({ set: vi.fn() })),
}));

vi.mock('../../src/agent/orchestrator/metrics', () => ({
  getAgentMetrics: vi.fn().mockResolvedValue('# Agent metrics'),
  getAgentMetricsContentType: vi.fn().mockReturnValue('text/plain'),
}));

vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Metrics Authentication', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to create mock request/response
  function createMockReqRes(headers: Record<string, string> = {}) {
    const req = {
      headers,
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  }

  // We'll test the middleware logic directly by extracting it
  // This tests the auth logic without dealing with metric registration issues

  describe('with METRICS_BEARER_TOKEN configured', () => {
    const validToken = 'test-secret-token-12345';

    beforeEach(() => {
      process.env.METRICS_BEARER_TOKEN = validToken;
    });

    it('should return 401 when no Authorization header is provided', async () => {
      // Import fresh to pick up env var
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Missing Authorization header');
    });

    it('should return 401 when Authorization header format is invalid', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid Authorization header format');
    });

    it('should return 401 when token is incorrect', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer wrong-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid bearer token');
    });

    it('should allow access with correct token', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow access to /metrics/json with correct token', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics/json')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow access to /metrics/agent with correct token', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics/agent')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    it('should be case-insensitive for Bearer keyword', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/metrics')
        .set('Authorization', `bearer ${validToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('without METRICS_BEARER_TOKEN configured', () => {
    beforeEach(() => {
      delete process.env.METRICS_BEARER_TOKEN;
    });

    it('should return 403 in production mode', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('disabled');
    });

    it('should allow access in development mode', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
    });

    it('should allow access when NODE_ENV is not set (defaults to dev)', async () => {
      delete process.env.NODE_ENV;
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
    });
  });

  describe('all protected endpoints', () => {
    const validToken = 'secure-token';

    beforeEach(() => {
      process.env.METRICS_BEARER_TOKEN = validToken;
    });

    it('should protect all /metrics endpoints equally', async () => {
      vi.resetModules();
      const express = await import('express');
      const { registerMetricsRoutes } = await import('../../src/routes/metrics.routes');

      const app = express.default();
      registerMetricsRoutes(app, { startTime: Date.now() });

      const { default: request } = await import('supertest');

      // All should require auth
      const endpoints = ['/metrics', '/metrics/json', '/metrics/agent'];

      for (const endpoint of endpoints) {
        const noAuth = await request(app).get(endpoint);
        expect(noAuth.status).toBe(401);

        const withAuth = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${validToken}`);
        expect(withAuth.status).toBe(200);
      }
    });
  });
});
